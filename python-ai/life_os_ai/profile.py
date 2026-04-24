"""Merged candidate profile.

Combines Life OS's existing fields (`targetLocations`, `targetRoleTracks`,
`transitionNarrative`, `experienceHighlights`, ...) with ApplyPilot's
`profile.example.json` shape (`skills_boundary`, `resume_facts`,
`work_authorization`, `eeo_voluntary`). Both sides are optional -- any
field can be absent.

The profile is loaded from `LIFE_OS_PROFILE_PATH` or defaults to
`./profile.json` next to the process CWD. In production (Cloud Run) we
intend to proxy the profile in via the API request body from the TS
side, so file loading is primarily for local dev + tests.
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Pydantic model -- every field is optional so partial profiles load fine
# ---------------------------------------------------------------------------


class Personal(BaseModel):
    full_name: str | None = None
    preferred_name: str | None = None
    email: str | None = None
    phone: str | None = None
    city: str | None = None
    country: str | None = None
    linkedin_url: str | None = None
    github_url: str | None = None
    portfolio_url: str | None = None


class WorkAuthorization(BaseModel):
    legally_authorized_to_work: str | None = None
    require_sponsorship: str | None = None
    work_permit_type: str | None = None


class Availability(BaseModel):
    earliest_start_date: str | None = None
    available_for_full_time: str | None = None
    available_for_contract: str | None = None


class Compensation(BaseModel):
    salary_expectation: str | None = None
    salary_currency: str | None = None
    salary_range_min: str | None = None
    salary_range_max: str | None = None


class Experience(BaseModel):
    years_of_experience_total: str | None = None
    education_level: str | None = None
    current_job_title: str | None = None
    current_company: str | None = None
    target_role: str | None = None


class SkillsBoundary(BaseModel):
    """What the CV can legitimately claim. Everything else is a fabrication."""
    languages: list[str] = Field(default_factory=list)
    frameworks: list[str] = Field(default_factory=list)
    devops: list[str] = Field(default_factory=list)
    databases: list[str] = Field(default_factory=list)
    tools: list[str] = Field(default_factory=list)
    # Pharma / life-sciences specific -- not in ApplyPilot's schema.
    clinical: list[str] = Field(default_factory=list)
    regulatory: list[str] = Field(default_factory=list)
    lab_techniques: list[str] = Field(default_factory=list)


class ResumeFacts(BaseModel):
    preserved_companies: list[str] = Field(default_factory=list)
    preserved_projects: list[str] = Field(default_factory=list)
    preserved_school: str | None = None
    real_metrics: list[str] = Field(default_factory=list)


class EEOVoluntary(BaseModel):
    gender: str | None = None
    race_ethnicity: str | None = None
    veteran_status: str | None = None
    disability_status: str | None = None


class LifeOSProfile(BaseModel):
    """Life OS-specific fields inherited from our candidate-profile.json.
    These drive the target-role fit evaluation, not the CV tailoring."""

    target_role_tracks: list[str] = Field(default_factory=list)
    target_locations: list[str] = Field(default_factory=list)
    remote_preference: str = "flexible"
    preferred_seniority: str = "entry-to-mid"
    transition_narrative: str = ""
    experience_highlights: list[str] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    target_titles: list[str] = Field(default_factory=list)
    location_constraints: list[str] = Field(default_factory=list)


class CandidateProfile(BaseModel):
    """Full profile -- union of ApplyPilot's structure and ours.

    Loaded from file OR accepted inline via the API (TS side can pass the
    profile on every request so the Python service stays stateless).
    """

    personal: Personal = Field(default_factory=Personal)
    work_authorization: WorkAuthorization = Field(default_factory=WorkAuthorization)
    availability: Availability = Field(default_factory=Availability)
    compensation: Compensation = Field(default_factory=Compensation)
    experience: Experience = Field(default_factory=Experience)
    skills_boundary: SkillsBoundary = Field(default_factory=SkillsBoundary)
    resume_facts: ResumeFacts = Field(default_factory=ResumeFacts)
    eeo_voluntary: EEOVoluntary = Field(default_factory=EEOVoluntary)
    life_os: LifeOSProfile = Field(default_factory=LifeOSProfile)


# ---------------------------------------------------------------------------
# Default profile -- used when no file is set AND no inline profile passed.
# Mirrors the transition narrative from src/lib/ai/user-profile.ts so the
# Python side matches TS behavior out of the box.
# ---------------------------------------------------------------------------

DEFAULT_LIFE_OS_PROFILE = LifeOSProfile(
    target_role_tracks=["qa", "regulatory", "pv", "medinfo", "clinical"],
    target_locations=["Glasgow", "Scotland", "United Kingdom"],
    remote_preference="flexible",
    preferred_seniority="entry-to-mid",
    transition_narrative=(
        "Candidate holds an MSc in Clinical Pharmacology (Distinction) and a BSc in Clinical "
        "Pharmacy. They have extensive experience managing high-volume community dispensaries "
        "(13,000+ items/mo), strict Controlled Drug governance, and patient triage. They also "
        "possess molecular biology lab experience (DNA/RNA extraction, Illumina MiSeq). They "
        "are leveraging their GDocP, GCP awareness, and clinical knowledge to transition "
        "entirely out of retail pharmacy into desk-based industry roles (PV, QA, Regulatory, "
        "or Clinical Ops). They have NO prior industry experience -- only transferable pharmacy "
        "and lab skills."
    ),
)


# ---------------------------------------------------------------------------
# Loader
# ---------------------------------------------------------------------------


def _profile_path() -> Path | None:
    """Resolve the profile path from env, falling back to ./profile.json."""
    override = os.environ.get("LIFE_OS_PROFILE_PATH", "").strip()
    if override:
        return Path(override)
    local = Path.cwd() / "profile.json"
    if local.exists():
        return local
    return None


def load_profile(inline: dict[str, Any] | None = None) -> CandidateProfile:
    """Load the profile.

    Priority:
      1. inline dict passed from the API request
      2. file at LIFE_OS_PROFILE_PATH or ./profile.json
      3. Default (empty personal fields + Life OS transition narrative)
    """
    if inline:
        try:
            return CandidateProfile.model_validate(inline)
        except Exception as exc:
            log.warning("Inline profile failed validation (%s) -- falling back to defaults.", exc)

    path = _profile_path()
    if path is not None:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            return CandidateProfile.model_validate(data)
        except Exception as exc:
            log.warning("Profile at %s failed to load (%s) -- using defaults.", path, exc)

    # Defaults -- personal section is empty (no PII), but the transition
    # narrative + target tracks are present so fit evaluation still works.
    return CandidateProfile(life_os=DEFAULT_LIFE_OS_PROFILE)


# ---------------------------------------------------------------------------
# Prompt block builder -- mirrors buildUserProfilePromptBlock() in TS
# ---------------------------------------------------------------------------


def _format_role_track(track: str) -> str:
    return {
        "qa": "Quality Assurance",
        "regulatory": "Regulatory Affairs",
        "pv": "Pharmacovigilance",
        "medinfo": "Medical Information",
        "clinical": "Clinical Operations",
    }.get(track, track)


def build_profile_prompt_block(profile: CandidateProfile) -> str:
    """Render the profile as a prompt block for fit evaluation.

    Keeps the shape of the TS `buildUserProfilePromptBlock` output so
    prompts behave identically across the two implementations during
    parallel running.
    """
    los = profile.life_os
    sb = profile.skills_boundary
    rf = profile.resume_facts

    role_lines = "\n".join(f"- {_format_role_track(t)}" for t in (los.target_role_tracks or []))
    loc_lines = "\n".join(f"- {loc}" for loc in (los.target_locations or []))
    highlights_block = (
        "\n".join(f"- {h}" for h in los.experience_highlights)
        if los.experience_highlights
        else "(none supplied)"
    )
    strengths_block = (
        "\n".join(f"- {s}" for s in los.strengths) if los.strengths else "(none supplied)"
    )

    skills_block_lines: list[str] = []
    for category, items in sb.model_dump().items():
        if items:
            skills_block_lines.append(f"- {category.replace('_', ' ').title()}: {', '.join(items)}")
    skills_block = "\n".join(skills_block_lines) or "(none specified)"

    preserved_block_lines: list[str] = []
    if rf.preserved_companies:
        preserved_block_lines.append(f"- Companies: {', '.join(rf.preserved_companies)}")
    if rf.preserved_projects:
        preserved_block_lines.append(f"- Projects: {', '.join(rf.preserved_projects)}")
    if rf.preserved_school:
        preserved_block_lines.append(f"- School: {rf.preserved_school}")
    if rf.real_metrics:
        preserved_block_lines.append(f"- Real metrics: {', '.join(rf.real_metrics)}")
    preserved_block = "\n".join(preserved_block_lines) or "(none supplied)"

    return f"""\
USER PROFILE FOR FIT EVALUATION:

CANDIDATE BACKGROUND (read this first -- it must inform every score):
{los.transition_narrative or "(no narrative supplied)"}
- Favor roles with structured onboarding, transition accessibility, and desk-based work.
- Penalise senior-only, lab-heavy, retail pharmacy, financial services, or travel-heavy roles.

STRONGEST TARGET PATHS:
{role_lines or "(none specified)"}

PREFERRED LOCATIONS:
{loc_lines or "(none specified)"}

REMOTE PREFERENCE: {los.remote_preference}
PREFERRED SENIORITY: {los.preferred_seniority}

SKILLS BOUNDARY (candidate can legitimately claim these):
{skills_block}

PRESERVED RESUME ENTITIES (never invent replacements):
{preserved_block}

EXPERIENCE HIGHLIGHTS:
{highlights_block}

STRENGTHS:
{strengths_block}
"""
