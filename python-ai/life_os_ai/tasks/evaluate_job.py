"""Evaluate job fit against the candidate profile.

Mirrors `src/lib/ai/tasks/evaluate-job.ts`. Same system prompt, same
scoring rubric, same heuristic fallback when the AI is rate-limited or
returns invalid data.
"""

from __future__ import annotations

import json
import logging
import re
import time
from datetime import UTC, datetime
from typing import Any

from pydantic import ValidationError

from ..llm import chat
from ..profile import CandidateProfile, build_profile_prompt_block
from ..schemas import AIMetadata, JobFitEvaluation, ParsedJobPosting

log = logging.getLogger(__name__)


SYSTEM_PROMPT = (
    "Evaluate entry-level UK life-sciences jobs for a candidate moving into clinical "
    "operations, QA, regulatory, pharmacovigilance, or medical information. Reward CTA, "
    "trial coordination, TMF/eTMF, GCP, SOP, documentation, governance, QA, regulatory, "
    "PV, medinfo, and junior/support roles. Penalise senior roles, retail/community "
    "pharmacy, finance/tax/payroll, legal assistant, field sales, and wet-lab execution. "
    "Return valid JSON only."
)


def _build_prompt(job: ParsedJobPosting, profile_block: str) -> str:
    must_haves = ", ".join(job.must_haves) if job.must_haves else "None listed"
    nice_to_haves = ", ".join(job.nice_to_haves) if job.nice_to_haves else "None listed"
    red_flags = ", ".join(job.red_flags) if job.red_flags else "None"

    return f"""\
Evaluate this job against the candidate profile. Be realistic for an entry/support-level transition.

CANDIDATE:
{profile_block[:1800]}

JOB TO EVALUATE:
Title: {job.title}
Company: {job.company}
Location: {job.location}
Salary: {job.salary_text or "Not specified"}
Employment Type: {job.employment_type}
Seniority: {job.seniority}
Remote Type: {job.remote_type}
Role Family: {job.role_family}
Role Track: {job.role_track}
Must Haves: {must_haves}
Nice to Haves: {nice_to_haves}
Red Flags: {red_flags}
Summary: {job.summary}

Return exactly this compact JSON object:
{{
  "fitScore": 0-100,
  "redFlagScore": 0-100,
  "priorityBand": "high | medium | low | reject",
  "whyMatched": ["reasons this job is a good fit"],
  "whyNot": ["reasons this job is not ideal"],
  "strategicValue": "string explaining strategic career value",
  "likelyInterviewability": "string assessing chances of getting an interview",
  "actionRecommendation": "apply now | apply if time | skip",
  "visaRisk": "green | amber | red",
  "confidence": 0.0 to 1.0
}}

Rules: high=70+, medium=40-69, low=20-39, reject<20. green visa=no concern, amber=right-to-work ambiguity, red=explicit no sponsorship. Use short strings and max 2 items per array. Respond with only JSON."""


# ---------------------------------------------------------------------------
# Heuristic fallback -- mirrors buildHeuristicFallback in the TS version.
# ---------------------------------------------------------------------------

_TRACK_BASE_SCORES = {
    "qa": 65,
    "regulatory": 70,
    "pv": 68,
    "clinical": 72,
    "medinfo": 65,
    "other": 22,
}

_TRACK_LABELS = {
    "qa": "QA/GMP",
    "regulatory": "Regulatory Affairs",
    "pv": "Pharmacovigilance",
    "clinical": "Clinical Operations",
    "medinfo": "Medical Information",
    "other": "Other",
}


def _heuristic_evaluation(job: ParsedJobPosting) -> JobFitEvaluation:
    track = job.role_track or "other"
    title = (job.title or "").lower()
    seniority = (job.seniority or "").lower()
    red_flags = job.red_flags or []

    fit_score = _TRACK_BASE_SCORES.get(track, 22)

    # Seniority adjustment
    if re.search(r"director|vp\b|vice president|head of", seniority):
        fit_score -= 20
    elif re.search(r"senior|manager", seniority):
        fit_score -= 10
    elif re.search(r"assistant|associate|coordinator|junior", seniority):
        fit_score += 8

    # Title bonuses for entry-level transition roles
    if re.search(r"\b(assistant|associate|coordinator|support|officer)\b", title):
        fit_score += 5

    # Penalise clearly off-track roles
    if track == "other" and re.search(r"\b(tax|accountant|software|developer|engineer|scientist|bench)\b", title):
        fit_score -= 15

    red_flag_score = min(100, len(red_flags) * 10)
    if re.search(r"director|vp\b", seniority):
        red_flag_score += 15
    if any(re.search(r"visa|sponsor", m, re.IGNORECASE) for m in job.must_haves):
        red_flag_score += 20
    red_flag_score = min(100, red_flag_score)

    fit_score = max(0, min(100, fit_score))

    if fit_score >= 65 and red_flag_score < 40:
        priority_band = "high"
    elif fit_score >= 40 and red_flag_score < 60:
        priority_band = "medium"
    elif fit_score >= 20 and red_flag_score < 70:
        priority_band = "low"
    else:
        priority_band = "reject"

    track_label = _TRACK_LABELS.get(track, track)
    in_target = track != "other"

    why_matched = [f"{track_label} track aligns with transition targets (heuristic)"] if in_target else []
    if not in_target:
        why_not = ["Role track is outside primary transition targets (heuristic)"]
    elif red_flag_score > 30:
        why_not = ["Some red flags detected -- review before applying"]
    else:
        why_not = []

    strategic_value = (
        f"{track_label} experience builds toward career transition goals"
        if in_target
        else "Limited strategic value for current transition targets"
    )

    if fit_score >= 65:
        interviewability = "Good -- profile-role alignment looks strong"
    elif fit_score >= 40:
        interviewability = "Moderate -- some alignment, review gaps"
    else:
        interviewability = "Low -- significant gap between profile and role"

    if priority_band == "high":
        action: str = "apply now"
    elif priority_band == "medium":
        action = "apply if time"
    else:
        action = "skip"

    if red_flag_score > 40:
        visa_risk = "red"
    elif red_flag_score > 20:
        visa_risk = "amber"
    else:
        visa_risk = "green"

    return JobFitEvaluation.model_validate(
        {
            "fitScore": fit_score,
            "redFlagScore": red_flag_score,
            "priorityBand": priority_band,
            "whyMatched": why_matched,
            "whyNot": why_not,
            "strategicValue": strategic_value,
            "likelyInterviewability": interviewability,
            "actionRecommendation": action,
            "visaRisk": visa_risk,
            "confidence": 0.3,
        }
    )


# ---------------------------------------------------------------------------
# JSON extraction (same helper as parse_job but duplicated to keep the
# two task files decoupled -- they'll evolve independently).
# ---------------------------------------------------------------------------


def _extract_json(raw: str) -> dict[str, Any] | None:
    text = raw.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        log.debug("direct json.loads failed: %s (text len=%d)", exc, len(text))
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if fence:
        try:
            return json.loads(fence.group(1))
        except json.JSONDecodeError as exc:
            log.debug("fenced json.loads failed: %s", exc)
    obj = re.search(r"\{[\s\S]*\}", text)
    if obj:
        try:
            return json.loads(obj.group(0))
        except json.JSONDecodeError as exc:
            log.debug("braced json.loads failed: %s", exc)
    return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def evaluate_job(
    job: ParsedJobPosting,
    profile: CandidateProfile,
) -> tuple[JobFitEvaluation, AIMetadata]:
    """Evaluate fit. Always returns a usable result -- heuristic fallback
    kicks in when the LLM fails or returns invalid data."""
    started = time.time()
    profile_block = build_profile_prompt_block(profile)
    input_bytes = len(profile_block.encode("utf-8")) + len(job.model_dump_json().encode("utf-8"))

    result = chat(
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _build_prompt(job, profile_block)},
        ],
        temperature=0.1,
        max_tokens=700,
        response_format="json",
    )

    duration_ms = int((time.time() - started) * 1000)

    def _fallback(kind: str) -> tuple[JobFitEvaluation, AIMetadata]:
        evaluation = _heuristic_evaluation(job)
        meta = AIMetadata.model_validate(
            {
                "model": "heuristic",
                "promptType": "evaluate-job",
                "timestamp": datetime.now(UTC).isoformat(),
                "confidence": evaluation.confidence,
                "durationMs": duration_ms,
                "inputBytes": input_bytes,
                "outputBytes": len(evaluation.model_dump_json().encode("utf-8")),
                "fallbackUsed": True,
                "fallbackAttempted": result.fallback_used,
                "attemptCount": 1,
                "effectiveTimeoutMs": 0,
                "jsonExtractionFallback": False,
                "failureKind": kind,
            }
        )
        return evaluation, meta

    if not result.success or result.text is None:
        log.warning("evaluate-job LLM failed (%s) -- using heuristic fallback", result.failure_kind)
        return _fallback(result.failure_kind or "runtime_error")

    data = _extract_json(result.text)
    if data is None:
        log.warning("evaluate-job: couldn't extract JSON; using heuristic fallback")
        return _fallback("invalid_json")

    try:
        evaluation = JobFitEvaluation.model_validate(data)
    except ValidationError as exc:
        log.warning("evaluate-job: schema validation failed (%s) -- heuristic fallback", exc)
        return _fallback("schema_validation")

    meta = AIMetadata.model_validate(
        {
            "model": result.model or "unknown",
            "promptType": "evaluate-job",
            "timestamp": datetime.now(UTC).isoformat(),
            "confidence": evaluation.confidence,
            "durationMs": result.duration_ms,
            "inputBytes": input_bytes,
            "outputBytes": len(result.text.encode("utf-8")),
            "fallbackUsed": result.fallback_used,
            "fallbackAttempted": result.fallback_used,
            "attemptCount": 1,
            "effectiveTimeoutMs": 0,
            "jsonExtractionFallback": False,
        }
    )
    return evaluation, meta
