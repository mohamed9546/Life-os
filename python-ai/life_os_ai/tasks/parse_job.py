"""Parse a raw job posting into structured data.

Mirrors `src/lib/ai/tasks/parse-job.ts`. Same prompt, same schema, same
deterministic fallback when the AI fails or returns invalid JSON.
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
from ..schemas import AIMetadata, ParsedJobPosting

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Prompts -- kept identical to the TS version so outputs stay comparable.
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = (
    "You are a job posting parser for the UK life sciences / pharma job market.\n"
    "Your task is to extract structured information from job postings.\n"
    "Classify roleTrack conservatively, with special care for CTA, trial support, "
    "clinical operations support, QA, regulatory, PV, and medinfo pathways.\n"
    "Always respond with valid JSON matching the exact schema requested.\n"
    "Never include explanatory text outside the JSON object.\n"
    "If information is not available in the posting, use reasonable defaults or null."
)


FINANCIAL_OVERRIDE_TERMS = (
    "chartered tax",
    "tax advisor",
    "tax consultant",
    "tax accountant",
    "tax assistant",
    "tax analyst",
    "tax manager",
    "payroll",
    "audit manager",
    "audit trainee",
    "financial audit",
    "financial analyst",
    "finance manager",
    "accountancy",
    "chartered accountant",
    "investment analyst",
    "trading associate",
)

TRACK_KEYWORDS: dict[str, tuple[str, ...]] = {
    "clinical": (
        "clinical trial",
        "clinical operations",
        "clinical trial assistant",
        "clinical operations assistant",
        "clinical operations coordinator",
        "clinical study assistant",
        "clinical study coordinator",
        "trial coordinator",
        "trial administrator",
        "study coordinator",
        "study admin",
        "site activation",
        "study startup",
        "study start-up",
        "study start up",
        "site management",
        "site management support",
        "clinical project assistant",
        "clinical project support",
        "trial master file",
        "tmf",
        "etmf",
        "isf",
        "essential documents",
        "ctms",
        "protocol compliance",
        "cra",
        "in-house cra",
        "junior cra",
        "clinical research associate",
    ),
    "regulatory": (
        "regulatory",
        "submissions",
        "regulatory affairs",
        "regulatory operations",
        "regulatory affairs assistant",
        "regulatory operations assistant",
        "ctd",
        "mhra",
        "ema",
        "regulatory submission",
        "post-market",
    ),
    "qa": (
        "quality assurance",
        "quality systems",
        "quality systems associate",
        "gmp",
        "good manufacturing practice",
        "document control",
        "document control associate",
        "deviation",
        "deviation management",
        "capa",
        "compliance",
        "gdocp",
        "qms",
        "quality management system",
    ),
    "pv": (
        "pharmacovigilance",
        "drug safety",
        "safety case",
        "argus",
        "case processing",
        "clinical safety",
        "icsr",
        "psur",
        "dsur",
        "adverse event",
        "signal detection",
        "drug safety associate",
        "pharmacovigilance associate",
    ),
    "medinfo": (
        "medical information",
        "medical affairs",
        "scientific support",
        "medical response",
        "product complaint",
        "scientific advisor",
        "medical copywriter",
    ),
}


def _build_prompt(raw_text: str, metadata: dict[str, str] | None) -> str:
    meta_block = ""
    if metadata:
        meta_block = "\nADDITIONAL METADATA:\n" + "\n".join(
            f"{k}: {v}" for k, v in metadata.items()
        )

    return f"""\
Parse the following job posting and return a JSON object with exactly these fields:

{{
  "title": "string - job title",
  "company": "string - company name",
  "location": "string - location",
  "salaryText": "string or null - salary as mentioned",
  "employmentType": "permanent | contract | temp | unknown",
  "seniority": "string - e.g. entry, mid, senior, lead, director",
  "remoteType": "remote | hybrid | onsite | unknown",
  "roleFamily": "string - broad category e.g. Quality, Regulatory, Pharma, Science",
  "roleTrack": "qa | regulatory | pv | medinfo | clinical | other",
  "mustHaves": ["array of must-have requirements"],
  "niceToHaves": ["array of nice-to-have requirements"],
  "redFlags": ["array of potential concerns - e.g. unrealistic requirements, vague descriptions, excessive travel, mismatched seniority"],
  "keywords": ["array of key terms and skills"],
  "summary": "string - 2-3 sentence summary of the role",
  "confidence": 0.0 to 1.0
}}
{meta_block}

JOB POSTING TEXT:
---
{raw_text}
---

Respond with ONLY the JSON object. No markdown, no explanation."""


# ---------------------------------------------------------------------------
# Deterministic fallback -- used when the LLM fails or returns invalid JSON
# ---------------------------------------------------------------------------


def _detect_role_track(text: str) -> str:
    lower = text.lower()
    if any(term in lower for term in FINANCIAL_OVERRIDE_TERMS):
        return "other"
    for track, keywords in TRACK_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            return track
    return "other"


def _detect_employment_type(text: str) -> str:
    lower = text.lower()
    if "contract" in lower or "fixed term" in lower:
        return "contract"
    if "temporary" in lower or "temp" in lower:
        return "temp"
    if "permanent" in lower or "full-time" in lower or "full time" in lower:
        return "permanent"
    return "unknown"


def _detect_remote_type(text: str) -> str:
    lower = text.lower()
    if "hybrid" in lower:
        return "hybrid"
    if "remote" in lower:
        return "remote"
    if (
        "on site" in lower
        or "onsite" in lower
        or "office-based" in lower
        or "office based" in lower
    ):
        return "onsite"
    return "unknown"


def _detect_seniority(text: str) -> str:
    lower = text.lower()
    if "director" in lower or "head of" in lower:
        return "director"
    if "senior" in lower or "manager" in lower or "lead" in lower:
        return "senior"
    if "junior" in lower or "entry level" in lower or "graduate" in lower:
        return "entry"
    if "assistant" in lower or "coordinator" in lower or "associate" in lower:
        return "entry-to-mid"
    return "mid"


def _extract_salary(text: str) -> str | None:
    match = re.search(
        r"((?:GBP|\xA3)\s?\d[\d,]*(?:\s*-\s*(?:GBP|\xA3)?\s?\d[\d,]*)?(?:\s*(?:per annum|per year|pa|annual|hour|per hour))?)",
        text,
        re.IGNORECASE,
    )
    if match:
        return match.group(1).strip()
    return None


def _pick_title(raw: str, metadata: dict[str, str] | None) -> str:
    if metadata and metadata.get("title", "").strip():
        return metadata["title"].strip()
    for line in raw.splitlines():
        line = line.strip()
        if 4 <= len(line) <= 120:
            return line
    return "Unknown role"


def _pick_company(raw: str, metadata: dict[str, str] | None) -> str:
    if metadata and metadata.get("company", "").strip():
        return metadata["company"].strip()
    match = re.search(r"(?:company|employer)\s*[:\-]\s*([^\n\r]+)", raw, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return "Unknown company"


def _pick_location(raw: str, metadata: dict[str, str] | None) -> str:
    if metadata and metadata.get("location", "").strip():
        return metadata["location"].strip()
    match = re.search(r"location\s*[:\-]\s*([^\n\r]+)", raw, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    remote = _detect_remote_type(raw)
    if remote == "remote":
        return "Remote"
    lower = raw.lower()
    if "united kingdom" in lower or " uk " in lower:
        return "United Kingdom"
    return "Unknown"


def _extract_list_by_signals(text: str, signals: tuple[str, ...], limit: int) -> list[str]:
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text.replace("\n", " ")) if s.strip()]
    return [s[:180] for s in sentences if any(sig in s.lower() for sig in signals)][:limit]


def _build_deterministic_fallback(
    raw_text: str, metadata: dict[str, str] | None, failure_kind: str | None
) -> ParsedJobPosting:
    lower = raw_text.lower()
    role_track = _detect_role_track(raw_text)
    remote_type = _detect_remote_type(raw_text)
    title = _pick_title(raw_text, metadata)
    company = _pick_company(raw_text, metadata)
    location = _pick_location(raw_text, metadata)
    must = _extract_list_by_signals(
        raw_text, ("must", "required", "experience with", "responsible for"), 4
    )
    nice = _extract_list_by_signals(raw_text, ("preferred", "nice to have", "bonus", "desirable"), 3)

    red_flags: list[str] = []
    if "sponsorship not available" in lower or "right to work required" in lower:
        red_flags.append("Possible visa or sponsorship barrier.")
    if "extensive travel" in lower or "travel required" in lower:
        red_flags.append("Travel requirement may reduce fit for a stable desk-based path.")
    if "laboratory" in lower or "lab-based" in lower or "bench work" in lower:
        red_flags.append("Role appears lab-heavy relative to the target transition path.")
    if any(t in lower for t in ("tax", "payroll", "accountant", "financial audit")):
        red_flags.append("Role appears to be finance/tax/accounting rather than regulated healthcare.")
    if "field sales" in lower or "territory manager" in lower:
        red_flags.append("Role appears to be field sales or territory coverage.")
    if "gphc registration essential" in lower:
        red_flags.append("GPhC registration is listed as essential.")
    if _detect_seniority(raw_text) == "senior":
        red_flags.append("Seniority expectations may be above the target transition level.")
    if failure_kind == "timeout":
        red_flags.append("AI timeout triggered deterministic fallback parsing.")
    red_flags = red_flags[:4]

    keyword_pool: set[str] = set()
    for keywords in TRACK_KEYWORDS.values():
        for kw in keywords:
            if kw in lower:
                keyword_pool.add(kw)
    if remote_type != "unknown":
        keyword_pool.add(remote_type)

    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", raw_text.replace("\n", " ")) if s.strip()]
    summary = " ".join(sentences[:2])[:320] or (
        "Structured fallback parsing was used because the LLM did not return valid JSON."
    )

    role_family = {
        "clinical": "Clinical Operations",
        "regulatory": "Regulatory",
        "qa": "Quality",
        "pv": "Pharmacovigilance",
        "medinfo": "Medical Information",
    }.get(role_track, "Other")

    return ParsedJobPosting.model_validate(
        {
            "title": title,
            "company": company,
            "location": location,
            "salaryText": _extract_salary(raw_text),
            "employmentType": _detect_employment_type(raw_text),
            "seniority": _detect_seniority(raw_text),
            "remoteType": remote_type,
            "roleFamily": role_family,
            "roleTrack": role_track,
            "mustHaves": must,
            "niceToHaves": nice,
            "redFlags": red_flags,
            "keywords": list(keyword_pool)[:8],
            "summary": summary,
            "confidence": 0.38,
        }
    )


# ---------------------------------------------------------------------------
# JSON extraction (handles ```json ``` fences, stray prose, etc.)
# ---------------------------------------------------------------------------


def _extract_json(raw: str) -> dict[str, Any] | None:
    text = raw.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    fence = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if fence:
        try:
            return json.loads(fence.group(1))
        except json.JSONDecodeError:
            pass

    obj = re.search(r"\{[\s\S]*\}", text)
    if obj:
        try:
            return json.loads(obj.group(0))
        except json.JSONDecodeError:
            pass

    return None


def _patch_parsed_job(data: dict[str, Any]) -> dict[str, Any]:
    """Fill in defaults for any missing fields so pydantic validation passes."""
    return {
        "title": data.get("title") or "Unknown",
        "company": data.get("company") or "Unknown",
        "location": data.get("location") or "Unknown",
        "salaryText": data.get("salaryText"),
        "employmentType": data.get("employmentType") or "unknown",
        "seniority": data.get("seniority") or "unknown",
        "remoteType": data.get("remoteType") or "unknown",
        "roleFamily": data.get("roleFamily") or "other",
        "roleTrack": data.get("roleTrack") or "other",
        "mustHaves": data.get("mustHaves") if isinstance(data.get("mustHaves"), list) else [],
        "niceToHaves": data.get("niceToHaves") if isinstance(data.get("niceToHaves"), list) else [],
        "redFlags": data.get("redFlags") if isinstance(data.get("redFlags"), list) else [],
        "keywords": data.get("keywords") if isinstance(data.get("keywords"), list) else [],
        "summary": data.get("summary") or "No summary available",
        "confidence": float(data.get("confidence") or 0.3),
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def parse_job(raw_text: str, metadata: dict[str, str] | None = None) -> tuple[ParsedJobPosting, AIMetadata]:
    """Parse a raw job posting. Always returns a usable result -- falls back
    to deterministic parsing if the LLM fails or returns invalid data."""
    started = time.time()
    input_bytes = len(raw_text.encode("utf-8"))

    result = chat(
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _build_prompt(raw_text, metadata)},
        ],
        temperature=0.1,
        max_tokens=1500,
        response_format="json",
    )

    duration_ms = int((time.time() - started) * 1000)

    def _fallback(kind: str) -> tuple[ParsedJobPosting, AIMetadata]:
        job = _build_deterministic_fallback(raw_text, metadata, kind)
        meta = AIMetadata.model_validate(
            {
                "model": "deterministic-fallback",
                "promptType": "parse-job",
                "timestamp": datetime.now(UTC).isoformat(),
                "confidence": job.confidence,
                "durationMs": duration_ms,
                "inputBytes": input_bytes,
                "outputBytes": len(job.model_dump_json().encode("utf-8")),
                "fallbackUsed": True,
                "fallbackAttempted": result.fallback_used,
                "attemptCount": 1,
                "effectiveTimeoutMs": 0,
                "jsonExtractionFallback": False,
                "failureKind": kind,
            }
        )
        return job, meta

    if not result.success or result.text is None:
        log.warning("parse-job LLM failed (%s) -- using deterministic fallback", result.failure_kind)
        return _fallback(result.failure_kind or "runtime_error")

    data = _extract_json(result.text)
    if data is None:
        log.warning("parse-job: couldn't extract JSON from LLM output -- deterministic fallback")
        return _fallback("invalid_json")

    try:
        job = ParsedJobPosting.model_validate(data)
    except ValidationError:
        # Try patching missing fields before giving up.
        try:
            job = ParsedJobPosting.model_validate(_patch_parsed_job(data))
        except ValidationError as exc:
            log.warning("parse-job: schema validation failed (%s) -- deterministic fallback", exc)
            return _fallback("schema_validation")

    meta = AIMetadata.model_validate(
        {
            "model": result.model or "unknown",
            "promptType": "parse-job",
            "timestamp": datetime.now(UTC).isoformat(),
            "confidence": job.confidence,
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
    return job, meta
