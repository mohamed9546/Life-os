"""AI output validator.

Adapted from ApplyPilot's validator.py with two changes:
  1. FABRICATION_WATCHLIST retargeted for pharma / life-sciences
     candidates (the TS side's relevance gate already blocks
     finance/sales jobs -- this guards the inverse: the CV itself
     claiming things the candidate doesn't have).
  2. BANNED_WORDS extended with the flabby corporate-speak we already
     catch in our TS evaluate-job prompt ("best-in-class", "synergy",
     etc.) plus ApplyPilot's list.

Modes
-----
strict  -- banned words trigger retries
normal  -- banned words are warnings; fabrication + structure are errors
lenient -- only fabrication and required-structure checks

For LLM text output (cover letter body, tailored CV summary), normal is
the default. For structured JSON we don't run banned-word checks at all
-- those run against the rendered text only.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Literal

from .profile import CandidateProfile


# ---------------------------------------------------------------------------
# Merged word lists
# ---------------------------------------------------------------------------

# Corporate-speak that reads as AI slop. Union of ApplyPilot's list and
# the phrases we already flag in the TS evaluate-job prompt.
BANNED_WORDS: tuple[str, ...] = (
    # ApplyPilot's core list
    "passionate",
    "dedicated",
    "committed to",
    "utilizing",
    "utilize",
    "harnessing",
    "spearheaded",
    "spearhead",
    "orchestrated",
    "championed",
    "pioneered",
    "robust",
    "scalable solutions",
    "cutting-edge",
    "state-of-the-art",
    "best-in-class",
    "proven track record",
    "track record of success",
    "demonstrated ability",
    "strong communicator",
    "team player",
    "fast learner",
    "self-starter",
    "go-getter",
    "synergy",
    "cross-functional collaboration",
    "holistic",
    "transformative",
    "innovative solutions",
    "paradigm",
    "ecosystem",
    "proactive",
    "detail-oriented",
    "highly motivated",
    "seamless",
    "full lifecycle",
    "deep understanding",
    "extensive experience",
    "comprehensive knowledge",
    "thrives in",
    "excels at",
    "adept at",
    "well-versed in",
    "i am confident",
    "i believe",
    "i am excited",
    "plays a critical role",
    "instrumental in",
    "integral part of",
    "strong track record",
    "eager to",
    "eager",
    # Cover-letter specific
    "this demonstrates",
    "this reflects",
    "i have experience with",
    "furthermore",
    "additionally",
    "moreover",
    # Life OS additions -- phrases our TS evaluate-job prompt flags
    "go-getter",
    "hit the ground running",
    "leverage",
    "value-add",
    "bring to the table",
)

# LLM apology / meta-commentary leaking into output. These are hard errors
# at any mode -- they indicate the model is responding TO the retry prompt
# instead of rewriting cleanly.
LLM_LEAK_PHRASES: tuple[str, ...] = (
    "i am sorry",
    "i apologize",
    "i will try",
    "let me try",
    "i am at a loss",
    "i am truly sorry",
    "apologies for",
    "i keep fabricating",
    "i will have to admit",
    "one final attempt",
    "one last time",
    "if it fails again",
    "persistent errors",
    "i am having difficulty",
    "i made an error",
    "my mistake",
    "here is the corrected",
    "here is the revised",
    "here is the updated",
    "here is my",
    "below is the",
    "as requested",
    "note:",
    "disclaimer:",
    "important:",
    "i have rewritten",
    "i have removed",
    "i have fixed",
    "i have replaced",
    "i have updated",
    "i have corrected",
    "per your feedback",
    "based on your feedback",
    "as per the instructions",
    "the following resume",
    "the resume below",
    "the following cover letter",
    "the letter below",
)

# Pharma / life-sciences fabrication watchlist. Completely unrelated
# skills/certs that would be instant red flags if they appeared on the
# candidate's CV. ApplyPilot's engineer-flavoured list (C++, Rust, K8s)
# doesn't apply here -- our candidate is a pharmacist.
FABRICATION_WATCHLIST: frozenset[str] = frozenset(
    {
        # Professional certifications the candidate doesn't have
        "cissp",
        "pmp",
        "scrum master",
        "prince2",
        "cfa",
        "cpa",
        "cta",  # Chartered Tax Advisor -- frequently misclassified as Clinical Trial Assistant
        "aca",
        "acca",
        # Clinical regulatory qualifications that require years of work to obtain
        "gphc registered",
        "rps",
        "independent prescriber",
        "consultant pharmacist",
        # Senior titles the candidate shouldn't claim
        "director of",
        "head of clinical",
        "head of regulatory",
        "vp of",
        "chief medical",
        "principal investigator",
        # Engineering skills that aren't in a pharmacist's background
        "kubernetes",
        "terraform",
        "golang",
        "rust",
        "c++",
        "react native",
        # Tools the candidate hasn't listed (check at runtime against skills_boundary too)
        "veeva vault",
        "argus safety",  # unless explicitly in the profile
        "oracle inform",
    }
)

REQUIRED_CV_SECTIONS: frozenset[str] = frozenset(
    {"SUMMARY", "EXPERIENCE", "EDUCATION"}
)


# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

Mode = Literal["strict", "normal", "lenient"]


@dataclass
class ValidationResult:
    ok: bool
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    banned_found: list[str] = field(default_factory=list)
    leak_found: list[str] = field(default_factory=list)
    fabrications_found: list[str] = field(default_factory=list)

    def add_error(self, msg: str) -> None:
        self.errors.append(msg)
        self.ok = False

    def add_warning(self, msg: str) -> None:
        self.warnings.append(msg)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def sanitize_text(text: str) -> str:
    """Strip control chars, normalize whitespace, unwrap markdown fences."""
    fence = re.match(r"^```(?:\w+)?\s*\n([\s\S]*?)\n```\s*$", text.strip())
    if fence:
        text = fence.group(1)
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def validate_text_output(
    text: str,
    *,
    mode: Mode = "normal",
    profile: CandidateProfile | None = None,
    require_sections: frozenset[str] | None = None,
) -> ValidationResult:
    """Validate LLM-generated free text (cover letter, CV summary, etc.).

    Use this on the final rendered string, NOT on JSON objects. For JSON
    use pydantic model validation instead.
    """
    result = ValidationResult(ok=True)
    lower = text.lower()

    # Always-checked: LLM leak phrases are a hard error everywhere.
    for phrase in LLM_LEAK_PHRASES:
        if phrase in lower:
            result.leak_found.append(phrase)
            result.add_error(f"LLM meta-commentary leaked into output: {phrase!r}")

    # Always-checked: fabrication watchlist.
    for term in FABRICATION_WATCHLIST:
        if _contains_word(lower, term):
            # Only flag if the profile doesn't already list it as legit.
            if profile is not None and _skill_is_in_boundary(profile, term):
                continue
            result.fabrications_found.append(term)
            result.add_error(f"Possible fabricated claim: {term!r}")

    # Mode-dependent: banned corporate-speak.
    if mode != "lenient":
        for phrase in BANNED_WORDS:
            if phrase in lower:
                result.banned_found.append(phrase)
                if mode == "strict":
                    result.add_error(f"Banned phrase: {phrase!r}")
                else:
                    result.add_warning(f"Banned phrase (prefer to rewrite): {phrase!r}")

    # Structural -- required CV sections.
    if require_sections:
        upper = text.upper()
        missing = [s for s in require_sections if s not in upper]
        if missing:
            result.add_error(f"Missing required sections: {', '.join(missing)}")

    return result


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _contains_word(haystack: str, term: str) -> bool:
    """Word-boundary match. `cta` shouldn't match `cataract`."""
    # Escape regex metachars in the term (e.g. "c++" needs escaping).
    pattern = rf"\b{re.escape(term)}\b"
    return bool(re.search(pattern, haystack, flags=re.IGNORECASE))


def _skill_is_in_boundary(profile: CandidateProfile, term: str) -> bool:
    """True if the term appears in any skills_boundary or resume_facts list."""
    sb = profile.skills_boundary
    everything = [
        *sb.languages,
        *sb.frameworks,
        *sb.devops,
        *sb.databases,
        *sb.tools,
        *sb.clinical,
        *sb.regulatory,
        *sb.lab_techniques,
        *profile.resume_facts.preserved_projects,
        *profile.resume_facts.preserved_companies,
    ]
    lower_term = term.lower()
    return any(lower_term in item.lower() for item in everything)
