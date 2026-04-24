"""Smoke test: round-trip a job posting through parse + evaluate.

Runs only when GEMINI_API_KEY or OPENAI_API_KEY is set in the env.
Otherwise the tests are skipped so CI without secrets doesn't fail.
"""

from __future__ import annotations

import os

import pytest

from life_os_ai.llm import (
    _GEMINI_COMPAT_BASE,
    LLMClient,
    ProviderConfig,
    _TruncatedOutput,
)
from life_os_ai.profile import DEFAULT_LIFE_OS_PROFILE, CandidateProfile
from life_os_ai.tasks.evaluate_job import evaluate_job
from life_os_ai.tasks.parse_job import parse_job


_HAS_PROVIDER = bool(
    os.environ.get("GEMINI_API_KEY", "").strip()
    or os.environ.get("OPENAI_API_KEY", "").strip()
)


def test_parse_deterministic_fallback_without_llm():
    """With no provider, parse_job still returns via deterministic fallback."""
    # Temporarily unset both to force fallback -- restore after.
    saved_gemini = os.environ.pop("GEMINI_API_KEY", None)
    saved_openai = os.environ.pop("OPENAI_API_KEY", None)
    try:
        job, meta = parse_job(
            "Clinical Trial Assistant wanted in Glasgow. Entry-level role. "
            "Must have GCP awareness. Site activation paperwork focus."
        )
        assert job.role_track == "clinical"
        assert meta.fallback_used is True
        assert meta.model == "deterministic-fallback"
        assert job.confidence < 0.5
    finally:
        if saved_gemini:
            os.environ["GEMINI_API_KEY"] = saved_gemini
        if saved_openai:
            os.environ["OPENAI_API_KEY"] = saved_openai


def test_heuristic_evaluation_returns_sane_bands():
    """Heuristic fallback scores a clinical entry role as at least medium."""
    from life_os_ai.schemas import ParsedJobPosting

    clinical_entry = ParsedJobPosting.model_validate(
        {
            "title": "Clinical Trial Assistant",
            "company": "Iqvia",
            "location": "Glasgow, Scotland",
            "salaryText": None,
            "employmentType": "permanent",
            "seniority": "entry",
            "remoteType": "hybrid",
            "roleFamily": "Clinical Operations",
            "roleTrack": "clinical",
            "mustHaves": ["GCP awareness", "strong attention to detail"],
            "niceToHaves": [],
            "redFlags": [],
            "keywords": ["tmf", "gcp"],
            "summary": "Entry-level CTA supporting TMF maintenance.",
            "confidence": 0.8,
        }
    )

    # Force the heuristic by clearing provider keys for this call only.
    saved_gemini = os.environ.pop("GEMINI_API_KEY", None)
    saved_openai = os.environ.pop("OPENAI_API_KEY", None)
    try:
        evaluation, meta = evaluate_job(
            clinical_entry, CandidateProfile(life_os=DEFAULT_LIFE_OS_PROFILE)
        )
        assert evaluation.priority_band in ("medium", "high")
        assert evaluation.fit_score >= 40
        assert meta.model == "heuristic"
    finally:
        if saved_gemini:
            os.environ["GEMINI_API_KEY"] = saved_gemini
        if saved_openai:
            os.environ["OPENAI_API_KEY"] = saved_openai


def test_gemini_json_truncation_retries_native(monkeypatch):
    """Gemini compat truncation should retry native before the task falls back."""
    client = LLMClient(
        ProviderConfig(
            name="gemini",
            base_url=_GEMINI_COMPAT_BASE,
            model="gemini-2.5-flash",
            api_key="test-key",
        )
    )
    native_calls = {"count": 0}

    def fake_compat(messages, temperature, max_tokens, response_format):
        raise _TruncatedOutput("gemini", "length", '{"fitScore": 57')

    def fake_native(messages, temperature, max_tokens, response_format):
        native_calls["count"] += 1
        assert response_format == "json"
        return '{"ok": true}'

    monkeypatch.setattr(client, "_chat_compat", fake_compat)
    monkeypatch.setattr(client, "_chat_gemini_native", fake_native)

    assert client.chat([], response_format="json") == '{"ok": true}'
    assert native_calls["count"] == 1
    assert client._use_native_gemini is True


@pytest.mark.skipif(not _HAS_PROVIDER, reason="No LLM provider configured")
def test_llm_round_trip_clinical_role():
    """End-to-end: parse -> evaluate a clinical entry role via the LLM."""
    raw = (
        "Clinical Trial Assistant -- Glasgow\n"
        "We're looking for an entry-level Clinical Trial Assistant to support "
        "our clinical operations team with TMF maintenance, site activation "
        "paperwork, and protocol compliance filing. GCP awareness preferred. "
        "Full-time permanent role. Hybrid working (2 days office)."
    )
    job, parse_meta = parse_job(raw)
    assert job.role_track in ("clinical", "other")
    assert len(job.summary) > 20

    evaluation, eval_meta = evaluate_job(
        job, CandidateProfile(life_os=DEFAULT_LIFE_OS_PROFILE)
    )
    assert evaluation.priority_band in ("high", "medium", "low", "reject")
    assert eval_meta.duration_ms >= 0
