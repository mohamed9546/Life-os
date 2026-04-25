"""Application-planning helpers for the local auto-apply pipeline."""

from __future__ import annotations

import re
from typing import Any

CV_RULES = [
    (
        "cv-qa-compliance",
        "QA / Compliance",
        ("qa", "quality", "compliance", "gmp", "sop", "document control"),
    ),
    (
        "cv-regulatory",
        "Regulatory Affairs",
        ("regulatory", "submission", "regulatory affairs", "regulatory operations"),
    ),
    (
        "cv-pharmacy",
        "Pharmacy / PV / MedInfo",
        ("pharmacy", "pharmacovigilance", "drug safety", "medical information", "pv"),
    ),
    (
        "cv-research-assistant",
        "Research Assistant",
        ("research assistant", "laboratory", "data collection", "research"),
    ),
    (
        "cv-cra",
        "CRA / Clinical Research",
        ("clinical", "trial", "cra", "cta", "tmf", "gcp", "clinical research"),
    ),
]


def parse_job_alert_email(raw_text: str, source: str = "gmail") -> list[dict[str, Any]]:
    links = re.findall(r"https?://[^\s<>\")']+", raw_text)
    lines = [
        line.strip()
        for line in raw_text.splitlines()
        if 4 <= len(line.strip()) <= 160
    ]
    title_lines = [
        line
        for line in lines
        if re.search(
            r"clinical|trial|research|regulatory|quality|pharmacovigilance|drug safety|medical information|qa|gcp|cra|cta",
            line,
            re.I,
        )
    ]
    jobs: list[dict[str, Any]] = []
    for idx, title in enumerate(title_lines[:10]):
        jobs.append(
            {
                "title": title,
                "company": _infer_company(raw_text, links[idx] if idx < len(links) else ""),
                "location": _infer_location(raw_text),
                "link": links[idx] if idx < len(links) else "",
                "source": source,
                "confidence": 0.55,
            }
        )
    return jobs


def select_cv_for_job(job: dict[str, Any]) -> dict[str, Any]:
    text = " ".join(str(value) for value in job.values()).lower()
    best_id = "cv-cra"
    best_label = "CRA / Clinical Research"
    best_score = 0
    for cv_id, label, keywords in CV_RULES:
        score = sum(1 for keyword in keywords if keyword in text)
        if score > best_score:
            best_id = cv_id
            best_label = label
            best_score = score
    return {
        "cvId": best_id,
        "label": best_label,
        "confidence": min(0.95, max(0.35, best_score / 5)),
        "reason": "Matched role-track and job keywords",
    }


def plan_cv_keywords(job: dict[str, Any], allowed_keywords: list[str]) -> dict[str, Any]:
    text = " ".join(str(value) for value in job.values()).lower()
    chosen = [
        keyword
        for keyword in allowed_keywords
        if keyword and _token_overlap(keyword.lower(), text) >= 0.25
    ]
    if not chosen:
        chosen = allowed_keywords[:8]
    return {
        "keywords": chosen[:12],
        "confidence": 0.75 if chosen else 0.35,
        "guardrail": "Only reorder or emphasize truthful skills already present in the supplied profile/CV library.",
    }


def plan_application_answers(job: dict[str, Any], profile: dict[str, Any]) -> dict[str, Any]:
    required = ["fullName", "email", "rightToWork", "sponsorship"]
    missing = [field for field in required if not profile.get(field)]
    return {
        "canSubmit": not missing,
        "missingFields": missing,
        "answers": {
            "fullName": profile.get("fullName", ""),
            "email": profile.get("email", ""),
            "rightToWork": profile.get("rightToWork", ""),
            "sponsorship": profile.get("sponsorship", ""),
            "noticePeriod": profile.get("noticePeriod", ""),
            "salaryExpectation": profile.get("salaryExpectation", ""),
        },
        "blocker": "missing-profile" if missing else None,
    }


def _infer_company(text: str, link: str) -> str:
    match = re.search(r"(?:company|employer)\s*:?\s*([A-Z][^\n]{2,80})", text)
    if match:
        return match.group(1).strip()
    host = re.sub(r"^https?://(www\.)?", "", link).split("/")[0]
    return host.split(".")[0] if host else "Unknown Company"


def _infer_location(text: str) -> str:
    match = re.search(
        r"\b(Glasgow|Edinburgh|Scotland|London|Dublin|Ireland|United Kingdom|UK|Egypt|Cairo|Remote|Hybrid)\b",
        text,
        re.I,
    )
    return match.group(1) if match else "United Kingdom"


def _token_overlap(left: str, right: str) -> float:
    left_tokens = {token for token in re.split(r"\W+", left) if len(token) > 2}
    right_tokens = {token for token in re.split(r"\W+", right) if len(token) > 2}
    if not left_tokens or not right_tokens:
        return 0.0
    return len(left_tokens & right_tokens) / max(len(left_tokens), len(right_tokens))
