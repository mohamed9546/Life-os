"""Pydantic schemas.

These mirror the Zod schemas in the TS app (`src/lib/ai/schemas.ts`) and
the TS types (`src/types/index.ts`). If you change one side, change both.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# ---------------------------------------------------------------------------
# Job parsing (mirrors ParsedJobPostingSchema)
# ---------------------------------------------------------------------------

RoleTrack = Literal["qa", "regulatory", "pv", "medinfo", "clinical", "other"]
RemoteType = Literal["remote", "hybrid", "onsite", "unknown"]
EmploymentType = Literal["permanent", "contract", "temp", "unknown"]


class ParsedJobPosting(BaseModel):
    title: str
    company: str
    location: str
    salary_text: str | None = Field(default=None, alias="salaryText")
    employment_type: EmploymentType = Field(alias="employmentType")
    seniority: str
    remote_type: RemoteType = Field(alias="remoteType")
    role_family: str = Field(alias="roleFamily")
    role_track: RoleTrack = Field(alias="roleTrack")
    must_haves: list[str] = Field(default_factory=list, alias="mustHaves")
    nice_to_haves: list[str] = Field(default_factory=list, alias="niceToHaves")
    red_flags: list[str] = Field(default_factory=list, alias="redFlags")
    keywords: list[str] = Field(default_factory=list)
    summary: str
    confidence: float = Field(ge=0.0, le=1.0)

    model_config = ConfigDict(populate_by_name=True)


# ---------------------------------------------------------------------------
# Job fit evaluation (mirrors JobFitEvaluationSchema)
# ---------------------------------------------------------------------------

PriorityBand = Literal["high", "medium", "low", "reject"]
VisaRisk = Literal["green", "amber", "red"]
ActionRecommendation = Literal["apply now", "apply if time", "skip"]


class JobFitEvaluation(BaseModel):
    fit_score: int = Field(ge=0, le=100, alias="fitScore")
    red_flag_score: int = Field(ge=0, le=100, alias="redFlagScore")
    priority_band: PriorityBand = Field(alias="priorityBand")
    why_matched: list[str] = Field(default_factory=list, alias="whyMatched")
    why_not: list[str] = Field(default_factory=list, alias="whyNot")
    strategic_value: str = Field(alias="strategicValue")
    likely_interviewability: str = Field(alias="likelyInterviewability")
    action_recommendation: ActionRecommendation = Field(alias="actionRecommendation")
    visa_risk: VisaRisk = Field(alias="visaRisk")
    confidence: float = Field(ge=0.0, le=1.0)

    model_config = ConfigDict(populate_by_name=True)


# ---------------------------------------------------------------------------
# AI metadata (mirrors AIMetadata)
# ---------------------------------------------------------------------------


class AIMetadata(BaseModel):
    model: str
    prompt_type: str = Field(alias="promptType")
    timestamp: str
    confidence: float
    duration_ms: int = Field(alias="durationMs")
    input_bytes: int = Field(default=0, alias="inputBytes")
    output_bytes: int = Field(default=0, alias="outputBytes")
    fallback_used: bool = Field(default=False, alias="fallbackUsed")
    fallback_attempted: bool = Field(default=False, alias="fallbackAttempted")
    attempt_count: int = Field(default=1, alias="attemptCount")
    effective_timeout_ms: int = Field(default=0, alias="effectiveTimeoutMs")
    json_extraction_fallback: bool = Field(default=False, alias="jsonExtractionFallback")
    failure_kind: str | None = Field(default=None, alias="failureKind")

    model_config = ConfigDict(populate_by_name=True)

    def model_dump_camel(self) -> dict:
        """Return a camelCase dict matching the TS AIMetadata type."""
        return self.model_dump(by_alias=True)


# ---------------------------------------------------------------------------
# API request / response shapes
# ---------------------------------------------------------------------------


class ParseJobRequest(BaseModel):
    raw_text: str = Field(alias="rawText")
    metadata: dict[str, str] | None = None

    model_config = ConfigDict(populate_by_name=True)


class ParseJobResponse(BaseModel):
    success: bool
    data: ParsedJobPosting | None = None
    meta: AIMetadata | None = None
    error: str | None = None

    model_config = ConfigDict(populate_by_name=True)


class EvaluateJobRequest(BaseModel):
    job: ParsedJobPosting
    profile: dict | None = None  # optional override -- falls back to server-side profile


class EvaluateJobResponse(BaseModel):
    success: bool
    data: JobFitEvaluation | None = None
    meta: AIMetadata | None = None
    error: str | None = None
