"""Smoke test: round-trip a job posting through parse + evaluate.

Runs only when LLM_URL, GEMINI_API_KEY, or OPENAI_API_KEY is set in the env.
Otherwise the tests are skipped so CI without secrets doesn't fail.
"""

from __future__ import annotations

import json
import os

import pytest

from life_os_ai.llm import (
    _GEMINI_COMPAT_BASE,
    LLMClient,
    ProviderConfig,
    _TruncatedOutput,
    _provider_configs,
)
from life_os_ai.profile import DEFAULT_LIFE_OS_PROFILE, CandidateProfile
from life_os_ai.tasks.evaluate_job import evaluate_job
from life_os_ai.tasks.extract_candidate_profile import extract_candidate_profile
from life_os_ai.tasks.parse_job import parse_job


_HAS_PROVIDER = bool(
    os.environ.get("LLM_URL", "").strip()
    or os.environ.get("GEMINI_API_KEY", "").strip()
    or os.environ.get("OPENAI_API_KEY", "").strip()
)


def _clear_provider_env() -> dict[str, str]:
    saved = {}
    for key in (
        "LLM_URL",
        "LLM_MODEL",
        "LLM_API_KEY",
        "LLM_PROVIDER_NAME",
        "LLM_JSON_MODE",
        "GEMINI_API_KEY",
        "OPENAI_API_KEY",
    ):
        value = os.environ.pop(key, None)
        if value is not None:
            saved[key] = value
    return saved


def _restore_env(saved: dict[str, str]) -> None:
    os.environ.update(saved)


def test_parse_deterministic_fallback_without_llm():
    """With no provider, parse_job still returns via deterministic fallback."""
    # Temporarily unset providers to force fallback -- restore after.
    saved = _clear_provider_env()
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
        _restore_env(saved)


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
    saved = _clear_provider_env()
    try:
        evaluation, meta = evaluate_job(
            clinical_entry, CandidateProfile(life_os=DEFAULT_LIFE_OS_PROFILE)
        )
        assert evaluation.priority_band in ("medium", "high")
        assert evaluation.fit_score >= 40
        assert meta.model == "heuristic"
    finally:
        _restore_env(saved)


def test_candidate_profile_fallback_without_llm():
    """Candidate profile extraction should still return a reviewable draft without an LLM."""
    saved = _clear_provider_env()
    try:
        draft, meta = extract_candidate_profile(
            "Mohamed Abdalla\n"
            "Clinical Research | CTA | Junior CRA | Trial Coordination\n"
            "Glasgow, UK\n"
            "MSc Clinical Pharmacology\n"
            "GCP training and clinical research internship experience.",
            ["Mohamed_Abdalla_CV_CRA.pdf"],
        )
        assert draft.profile.full_name == "Mohamed Abdalla"
        assert "clinical" in draft.profile.target_role_tracks
        assert draft.confidence == 0.35
        assert meta.fallback_used is True
    finally:
        _restore_env(saved)


def test_candidate_profile_repairs_pipe_delimited_role_tracks(monkeypatch):
    """The Python extractor repairs the exact bad enum shape local models emit."""
    from life_os_ai.tasks import extract_candidate_profile as module

    class FakeResult:
        success = True
        text = json.dumps(
            {
                "rawText": "Mohamed Abdalla",
                "profile": {
                    "fullName": "Mohamed Abdalla",
                    "headline": "Clinical Research",
                    "location": "Glasgow, UK",
                    "openToRelocationUk": True,
                    "summary": "Clinical research candidate.",
                    "targetTitles": ["Junior CRA"],
                    "targetRoleTracks": [
                        "clinical | regulatory | pv | medinfo | clinical | other"
                    ],
                    "locationConstraints": ["UK"],
                    "transitionNarrative": "Transitioning into clinical research.",
                    "strengths": ["GCP"],
                    "experienceHighlights": ["Clinical research internship"],
                    "education": ["MSc Clinical Pharmacology"],
                    "sourceCvIds": ["cv.pdf"],
                },
                "confidence": 0.82,
                "issues": [],
                "sourceFiles": ["cv.pdf"],
                "extractedAt": "2026-04-25T00:00:00Z",
            }
        )
        error = None
        model = "fake"
        duration_ms = 12
        fallback_used = False
        failure_kind = None

    monkeypatch.setattr(module, "chat", lambda **_: FakeResult())

    draft, meta = extract_candidate_profile("Mohamed Abdalla\nClinical Research", ["cv.pdf"])
    assert draft.confidence == 0.82
    assert draft.profile.target_role_tracks == [
        "clinical",
        "regulatory",
        "pv",
        "medinfo",
        "other",
    ]
    assert meta.model == "fake"


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


def test_llm_url_is_first_openai_compatible_provider():
    """LLM_URL mirrors ApplyPilot: it becomes the preferred provider."""
    saved = _clear_provider_env()
    try:
        os.environ["LLM_URL"] = "http://127.0.0.1:11434/v1"
        os.environ["LLM_MODEL"] = "gemma3:4b"
        os.environ["GEMINI_API_KEY"] = "gemini-key"
        os.environ["OPENAI_API_KEY"] = "openai-key"

        providers = _provider_configs()
        assert [provider.name for provider in providers] == ["local", "gemini", "openai"]
        assert providers[0].base_url == "http://127.0.0.1:11434/v1"
        assert providers[0].model == "gemma3:4b"
        assert providers[0].supports_json_mode is False
    finally:
        _restore_env(saved)


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
