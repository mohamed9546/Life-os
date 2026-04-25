"""Extract a candidate profile draft from CV text.

This mirrors `src/lib/ai/tasks/extract-candidate-profile.ts`, but keeps
the parsing and repair logic in Python so the local app can gradually move
AI/data-shaping work out of the Next.js process.
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
from ..schemas import AIMetadata, CandidateProfileImportDraft

log = logging.getLogger(__name__)

ROLE_TRACKS = ("qa", "regulatory", "pv", "medinfo", "clinical", "other")
AI_CV_TEXT_LIMIT = 12_000

DEFAULT_TARGET_TITLES = [
    "Clinical Trial Assistant",
    "Clinical Research Coordinator",
    "Clinical Operations Assistant",
    "Clinical Study Coordinator",
    "Trial Administrator",
    "Junior CRA",
    "QA Associate",
    "Quality Systems Associate",
    "Document Control Associate",
    "Regulatory Affairs Assistant",
    "Pharmacovigilance Associate",
    "Drug Safety Associate",
    "Medical Information Associate",
]
DEFAULT_TARGET_TRACKS = ["qa", "regulatory", "pv", "medinfo", "clinical"]
DEFAULT_LOCATIONS = ["Glasgow", "Scotland", "United Kingdom", "Remote", "Hybrid"]
DEFAULT_STRENGTHS = [
    "GCP training",
    "Regulated healthcare documentation",
    "SOP and compliance-heavy workflows",
    "Trial support and coordination readiness",
]

SYSTEM_PROMPT = (
    "You extract candidate profiles from CV text for a local-first career operating system. "
    "Return valid JSON only. Preserve specifics from the CV. Do not invent certifications "
    "or achievements that are not grounded in the source text."
)


def _truncate(raw_text: str) -> str:
    if len(raw_text) <= AI_CV_TEXT_LIMIT:
        return raw_text
    return (
        raw_text[:AI_CV_TEXT_LIMIT]
        + "\n\n[CV text truncated for AI extraction. Preserve only facts visible above.]"
    )


def _build_prompt(raw_text: str, source_files: list[str]) -> str:
    files = "\n".join(f"- {item}" for item in source_files) or "- unknown"
    return f"""\
Extract a normalized candidate profile draft from this CV text.

Return exactly this JSON shape. For targetRoleTracks, use only separate values from:
["qa", "regulatory", "pv", "medinfo", "clinical", "other"].

{{
  "rawText": "the original text summarized or truncated only if necessary",
  "profile": {{
    "fullName": "string",
    "headline": "string",
    "location": "string",
    "openToRelocationUk": true,
    "summary": "string",
    "targetTitles": ["string"],
    "targetRoleTracks": ["clinical", "regulatory"],
    "locationConstraints": ["string"],
    "transitionNarrative": "string",
    "strengths": ["string"],
    "experienceHighlights": ["string"],
    "education": ["string"],
    "sourceCvIds": ["string"],
    "extraction": {{
      "reviewState": "draft",
      "confidence": 0.0,
      "issues": ["string"],
      "extractedAt": "ISO string",
      "sourceFiles": ["string"]
    }}
  }},
  "confidence": 0.0,
  "issues": ["string"],
  "sourceFiles": ["string"],
  "extractedAt": "ISO string"
}}

SOURCE FILES:
{files}

CV TEXT:
---
{_truncate(raw_text)}
---

Respond with JSON only."""


def _extract_json(raw: str) -> dict[str, Any] | None:
    text = raw.strip()
    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        pass

    fence = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if fence:
        try:
            parsed = json.loads(fence.group(1))
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            pass

    obj = re.search(r"\{[\s\S]*\}", text)
    if obj:
        try:
            parsed = json.loads(obj.group(0))
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            pass

    return None


def _unique(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        cleaned = value.strip()
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            result.append(cleaned)
    return result


def _coerce_role_tracks(value: Any) -> list[str]:
    values = value if isinstance(value, list) else [value]
    tracks: list[str] = []
    for item in values:
        if not isinstance(item, str):
            continue
        for part in re.split(r"[|,/]", item):
            cleaned = part.strip()
            if cleaned in ROLE_TRACKS:
                tracks.append(cleaned)
    return _unique(tracks) or ["other"]


def _repair(data: dict[str, Any], raw_text: str, source_files: list[str]) -> dict[str, Any]:
    extracted_at = datetime.now(UTC).isoformat()
    profile = data.get("profile") if isinstance(data.get("profile"), dict) else {}
    heuristic = _heuristic_profile(raw_text, source_files, "AI output was repaired before validation")
    heuristic_profile = heuristic["profile"]

    repaired_profile = {
        **heuristic_profile,
        **profile,
        "targetRoleTracks": _coerce_role_tracks(profile.get("targetRoleTracks")),
        "targetTitles": _string_list(profile.get("targetTitles")) or heuristic_profile["targetTitles"],
        "locationConstraints": _string_list(profile.get("locationConstraints"))
        or heuristic_profile["locationConstraints"],
        "strengths": _string_list(profile.get("strengths")) or heuristic_profile["strengths"],
        "experienceHighlights": _string_list(profile.get("experienceHighlights"))
        or heuristic_profile["experienceHighlights"],
        "education": _string_list(profile.get("education")) or heuristic_profile["education"],
        "sourceCvIds": _string_list(profile.get("sourceCvIds")) or source_files,
    }
    repaired_profile["extraction"] = {
        "reviewState": "draft",
        "confidence": _number(profile.get("extraction", {}).get("confidence"), 0.75)
        if isinstance(profile.get("extraction"), dict)
        else 0.75,
        "issues": _string_list(profile.get("extraction", {}).get("issues"))
        if isinstance(profile.get("extraction"), dict)
        else [],
        "extractedAt": extracted_at,
        "sourceFiles": source_files,
    }

    return {
        "rawText": data.get("rawText") if isinstance(data.get("rawText"), str) else raw_text,
        "profile": repaired_profile,
        "confidence": _number(data.get("confidence"), 0.75),
        "issues": _string_list(data.get("issues")),
        "sourceFiles": _string_list(data.get("sourceFiles")) or source_files,
        "extractedAt": data.get("extractedAt")
        if isinstance(data.get("extractedAt"), str)
        else extracted_at,
    }


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item.strip() for item in value if isinstance(item, str) and item.strip()]


def _number(value: Any, fallback: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return fallback
    return max(0.0, min(1.0, number))


def _useful_lines(raw_text: str) -> list[str]:
    return [
        line.strip()
        for line in raw_text.splitlines()
        if 2 <= len(line.strip()) <= 160
    ][:80]


def _infer_full_name(lines: list[str]) -> str:
    for line in lines[:10]:
        if re.match(r"^[A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){1,3}$", line) and not re.search(
            r"curriculum|vitae|resume|profile|contact|education|experience", line, re.I
        ):
            return line
    return ""


def _infer_headline(lines: list[str]) -> str:
    for line in lines:
        if re.search(
            r"clinical|research|trial|regulatory|quality|pharmacovigilance|medical information|CRA|CTA",
            line,
            re.I,
        ) and "@" not in line:
            return line
    return "Entry-level clinical operations, QA, regulatory, PV and medinfo candidate"


def _infer_location(lines: list[str]) -> str:
    for line in lines:
        if re.search(r"glasgow|scotland|london|uk|united kingdom|egypt", line, re.I):
            return line
    return "Glasgow, Scotland"


def _infer_education(lines: list[str]) -> list[str]:
    found = [
        line
        for line in lines
        if re.search(r"\b(MSc|BSc|PhD|Bachelor|Master|University|College|GCP)\b", line, re.I)
    ][:8]
    return _unique(found + ["MSc Clinical Pharmacology"])


def _infer_strengths(raw_text: str) -> list[str]:
    candidates = [
        ("GCP training", r"\bGCP\b|good clinical practice"),
        ("Clinical research coordination", r"clinical research|trial coordination|CTA|CRA"),
        ("Regulated healthcare documentation", r"documentation|SOP|compliance|audit"),
        ("Regulatory and quality awareness", r"regulatory|quality|QA|GxP"),
        ("Pharmacovigilance awareness", r"pharmacovigilance|drug safety|PV"),
    ]
    found = [label for label, pattern in candidates if re.search(pattern, raw_text, re.I)]
    return _unique(found + DEFAULT_STRENGTHS)[:10]


def _infer_experience(lines: list[str]) -> list[str]:
    found = [
        line
        for line in lines
        if re.search(
            r"intern|assistant|coordinator|research|clinical|hospital|pharma|laboratory|trial",
            line,
            re.I,
        )
    ][:8]
    fallback = [
        "Clinical research internship exposure",
        "Healthcare administration and regulated support workflows",
        "Documentation quality, filing, archiving and audit-readiness mindset",
    ]
    return _unique(found + fallback)[:10]


def _heuristic_profile(raw_text: str, source_files: list[str], reason: str) -> dict[str, Any]:
    extracted_at = datetime.now(UTC).isoformat()
    lines = _useful_lines(raw_text)
    full_name = _infer_full_name(lines)
    headline = _infer_headline(lines)
    location = _infer_location(lines)
    education = _infer_education(lines)
    strengths = _infer_strengths(raw_text)
    experience = _infer_experience(lines)
    summary_subject = full_name or "Candidate"

    return {
        "rawText": raw_text,
        "profile": {
            "fullName": full_name,
            "headline": headline,
            "location": location,
            "openToRelocationUk": True,
            "summary": (
                f"{summary_subject} with CV evidence around {headline}. "
                f"Based in or connected to {location}. Education/training: {education[0]}."
            ),
            "targetTitles": DEFAULT_TARGET_TITLES,
            "targetRoleTracks": DEFAULT_TARGET_TRACKS,
            "locationConstraints": DEFAULT_LOCATIONS,
            "transitionNarrative": (
                "Targeting desk-based transition roles in UK life sciences and pharma, "
                "with focus on clinical operations, QA, regulatory, PV, and medinfo pathways."
            ),
            "strengths": strengths,
            "experienceHighlights": experience,
            "education": education,
            "sourceCvIds": source_files,
            "extraction": {
                "reviewState": "draft",
                "confidence": 0.35,
                "issues": [
                    "AI extraction did not complete cleanly, so this draft was created "
                    f"from basic CV text parsing. Original error: {reason}"
                ],
                "extractedAt": extracted_at,
                "sourceFiles": source_files,
            },
        },
        "confidence": 0.35,
        "issues": [
            "AI extraction did not complete cleanly, so this draft needs review. "
            f"Original error: {reason}"
        ],
        "sourceFiles": source_files,
        "extractedAt": extracted_at,
    }


def extract_candidate_profile(
    raw_text: str, source_files: list[str]
) -> tuple[CandidateProfileImportDraft, AIMetadata]:
    started = time.time()
    input_bytes = len(raw_text.encode("utf-8"))

    result = chat(
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _build_prompt(raw_text, source_files)},
        ],
        temperature=0.1,
        max_tokens=1600,
        response_format="json",
    )
    duration_ms = int((time.time() - started) * 1000)

    def _fallback(kind: str, reason: str) -> tuple[CandidateProfileImportDraft, AIMetadata]:
        draft = CandidateProfileImportDraft.model_validate(
            _heuristic_profile(raw_text, source_files, reason)
        )
        meta = AIMetadata.model_validate(
            {
                "model": "heuristic-fallback",
                "promptType": "extract-candidate-profile",
                "timestamp": datetime.now(UTC).isoformat(),
                "confidence": draft.confidence,
                "durationMs": duration_ms,
                "inputBytes": input_bytes,
                "outputBytes": len(draft.model_dump_json().encode("utf-8")),
                "fallbackUsed": True,
                "fallbackAttempted": result.fallback_used,
                "attemptCount": 1,
                "effectiveTimeoutMs": 0,
                "jsonExtractionFallback": False,
                "failureKind": kind,
            }
        )
        return draft, meta

    if not result.success or result.text is None:
        reason = result.error or "Candidate profile extraction failed"
        log.warning("extract-candidate-profile LLM failed (%s)", result.failure_kind)
        return _fallback(result.failure_kind or "runtime_error", reason)

    data = _extract_json(result.text)
    if data is None:
        return _fallback("invalid_json", "Could not extract valid JSON from AI output")

    try:
        draft = CandidateProfileImportDraft.model_validate(_repair(data, raw_text, source_files))
    except ValidationError as exc:
        log.warning("candidate profile validation failed after repair: %s", exc)
        return _fallback("schema_validation", f"AI validation failed: {exc}")

    meta = AIMetadata.model_validate(
        {
            "model": result.model or "unknown",
            "promptType": "extract-candidate-profile",
            "timestamp": datetime.now(UTC).isoformat(),
            "confidence": draft.confidence,
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
    return draft, meta
