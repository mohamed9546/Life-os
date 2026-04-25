"""FastAPI app -- the HTTP surface of the AI sidecar.

Endpoints:
  GET  /health           -> liveness + provider config
  POST /parse-job        -> { rawText, metadata? } -> { success, data, meta, error }
  POST /evaluate-job     -> { job, profile? } -> { success, data, meta, error }
  POST /extract-candidate-profile -> { rawText, sourceFiles } -> profile draft

The service is intentionally stateless -- profiles either come inline in
the request body (preferred, TS owns the profile store) or are loaded
from `LIFE_OS_PROFILE_PATH` for local dev.

Auth: we rely on Cloud Run's invoker IAM when the TS service calls this
one. For local dev there's no auth -- the service only binds to
localhost unless overridden.
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .profile import load_profile
from .schemas import (
    EvaluateJobRequest,
    EvaluateJobResponse,
    ExtractCandidateProfileRequest,
    ExtractCandidateProfileResponse,
    GenericApplicationPlanningResponse,
    ParseJobAlertEmailRequest,
    PlanApplicationAnswersRequest,
    PlanCvKeywordsRequest,
    ParseJobRequest,
    ParseJobResponse,
    SelectCvForJobRequest,
)
from .tasks.applications import (
    parse_job_alert_email,
    plan_application_answers,
    plan_cv_keywords,
    select_cv_for_job,
)
from .tasks.evaluate_job import evaluate_job
from .tasks.extract_candidate_profile import extract_candidate_profile
from .tasks.parse_job import parse_job

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Log provider config at startup so Cloud Run logs tell you immediately
    # which LLM will be used (vs silently falling back to a different one).
    local_ok = bool(os.environ.get("LLM_URL", "").strip())
    gemini_ok = bool(os.environ.get("GEMINI_API_KEY", "").strip())
    openai_ok = bool(os.environ.get("OPENAI_API_KEY", "").strip())
    log.info(
        "life-os-ai %s startup. local=%s gemini=%s openai=%s",
        __version__,
        "configured" if local_ok else "missing",
        "configured" if gemini_ok else "MISSING",
        "configured" if openai_ok else "MISSING",
    )
    if not local_ok and not gemini_ok and not openai_ok:
        log.error("NO LLM PROVIDER CONFIGURED -- all requests will return 503")
    yield


app = FastAPI(
    title="Life OS AI",
    version=__version__,
    description="Gemini/OpenAI-backed AI sidecar for Life OS.",
    lifespan=lifespan,
)

# CORS is permissive because the caller is our own TS service. Tighten to
# the Cloud Run URL if this ever faces the browser directly.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/health")
def health() -> dict[str, Any]:
    local_ok = bool(os.environ.get("LLM_URL", "").strip())
    gemini_ok = bool(os.environ.get("GEMINI_API_KEY", "").strip())
    openai_ok = bool(os.environ.get("OPENAI_API_KEY", "").strip())
    return {
        "ok": local_ok or gemini_ok or openai_ok,
        "service": "life-os-ai",
        "version": __version__,
        "providers": {
            "local": "configured" if local_ok else "missing",
            "gemini": "configured" if gemini_ok else "missing",
            "openai": "configured" if openai_ok else "missing",
        },
    }


@app.post("/parse-job", response_model=ParseJobResponse)
def parse_job_endpoint(req: ParseJobRequest) -> ParseJobResponse:
    raw = req.raw_text.strip()
    if len(raw) < 20:
        raise HTTPException(status_code=400, detail="rawText must be at least 20 characters")

    try:
        job, meta = parse_job(raw, req.metadata)
    except Exception as exc:  # noqa: BLE001 -- surface any uncaught task bug as 500
        log.exception("parse-job handler crashed")
        return ParseJobResponse(success=False, error=str(exc))

    return ParseJobResponse(success=True, data=job, meta=meta)


@app.post("/evaluate-job", response_model=EvaluateJobResponse)
def evaluate_job_endpoint(req: EvaluateJobRequest) -> EvaluateJobResponse:
    profile = load_profile(inline=req.profile)

    try:
        evaluation, meta = evaluate_job(req.job, profile)
    except Exception as exc:  # noqa: BLE001
        log.exception("evaluate-job handler crashed")
        return EvaluateJobResponse(success=False, error=str(exc))

    return EvaluateJobResponse(success=True, data=evaluation, meta=meta)


@app.post("/extract-candidate-profile", response_model=ExtractCandidateProfileResponse)
def extract_candidate_profile_endpoint(
    req: ExtractCandidateProfileRequest,
) -> ExtractCandidateProfileResponse:
    raw = req.raw_text.strip()
    if len(raw) < 20:
        raise HTTPException(status_code=400, detail="rawText must be at least 20 characters")

    try:
        draft, meta = extract_candidate_profile(raw, req.source_files)
    except Exception as exc:  # noqa: BLE001
        log.exception("extract-candidate-profile handler crashed")
        return ExtractCandidateProfileResponse(success=False, error=str(exc))

    return ExtractCandidateProfileResponse(success=True, data=draft, meta=meta)


@app.post("/parse-job-alert-email", response_model=GenericApplicationPlanningResponse)
def parse_job_alert_email_endpoint(
    req: ParseJobAlertEmailRequest,
) -> GenericApplicationPlanningResponse:
    return GenericApplicationPlanningResponse(
        success=True,
        data=parse_job_alert_email(req.raw_text, req.source),
    )


@app.post("/select-cv-for-job", response_model=GenericApplicationPlanningResponse)
def select_cv_for_job_endpoint(
    req: SelectCvForJobRequest,
) -> GenericApplicationPlanningResponse:
    return GenericApplicationPlanningResponse(success=True, data=select_cv_for_job(req.job))


@app.post("/plan-cv-keywords", response_model=GenericApplicationPlanningResponse)
def plan_cv_keywords_endpoint(
    req: PlanCvKeywordsRequest,
) -> GenericApplicationPlanningResponse:
    return GenericApplicationPlanningResponse(
        success=True,
        data=plan_cv_keywords(req.job, req.allowed_keywords),
    )


@app.post("/plan-application-answers", response_model=GenericApplicationPlanningResponse)
def plan_application_answers_endpoint(
    req: PlanApplicationAnswersRequest,
) -> GenericApplicationPlanningResponse:
    return GenericApplicationPlanningResponse(
        success=True,
        data=plan_application_answers(req.job, req.profile),
    )


# ---------------------------------------------------------------------------
# Local dev entry: python -m life_os_ai  OR  uvicorn life_os_ai.app:app
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "life_os_ai.app:app",
        host=os.environ.get("HOST", "127.0.0.1"),
        port=int(os.environ.get("PORT", "8000")),
        reload=bool(os.environ.get("RELOAD")),
    )
