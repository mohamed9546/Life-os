# Feature Spec: Runtime Integration Guardrails

Feature folder: `features/runtime-integration-guardrails/`

---

## Summary

Build a small runtime-guardrail hardening layer for Life-OS.

This feature should reduce noisy failed integrations and repeated avoidable retries across:

- Notion job sync,
- Apollo company and people enrichment,
- OpenRouter free-model fallback for `generate-outreach`,
- and runtime console logging.

The goal is not to remove integrations, but to make them fail safely, concisely, and predictably.

---

## Strategic Rationale

Recent runtime logs exposed several noisy failure modes:

- Notion job sync fails when the database is missing or the integration is not shared.
- Apollo company or people search can be unavailable on the free plan.
- OpenRouter `:free` models can return repeated 429 or quota errors during `generate-outreach`.
- Raw provider JSON can leak into console logs, creating noise and making diagnosis harder.

These failures do not represent core product logic bugs in ranking or application review.

They are runtime hygiene problems.

Fixing them now reduces operator noise and wasted retry behaviour before deeper CV or recruiter intelligence work.

---

## Goals

1. Classify repeated integration failures into stable local categories.
2. Keep pipeline and enrichment runs alive when optional integrations fail.
3. Reduce repeated doomed retries within the same run.
4. Sanitize runtime console logs so provider JSON blobs do not spill into normal operator output.
5. Preserve local-first behaviour and add no new external dependencies.
6. Keep the feature small and focused.

---

## Non-Goals

This feature does not:

- change job ranking logic,
- change application statuses,
- add or remove providers,
- add new AI prompts,
- implement CV version tracking,
- implement recruiter graph modelling,
- implement Outcome ETL changes,
- auto-send emails or applications,
- add new UI by default,
- require new configuration,
- persist runtime restriction state in storage by default.

---

## Users

Primary user:

- Mohamed, operating the pipeline and wanting concise, trustworthy runtime behaviour.

Secondary user:

- Maintainers and agents diagnosing integration failures.

---

## User Stories

### Story 1: Notion failure should not spam the pipeline

As the operator, I want Notion misconfiguration to produce one concise warning rather than noisy stack traces so pipeline runs stay readable.

Acceptance criteria:

- Database lookup 404 is classified as `notion_misconfigured`.
- Missing config skips cleanly.
- Pipeline does not fail because Notion is unavailable.

### Story 2: Apollo free-plan limits should stop repeated calls

As the operator, I want Apollo plan restrictions to stop repeated enrichment attempts in the same run so the app does not keep hitting doomed endpoints.

Acceptance criteria:

- Free-plan restriction is classified as `plan_restricted`.
- Repeated company or people search does not continue once the restriction is known in the same run.
- Fallback contact strategy still returns safe data.

### Story 3: OpenRouter free-tier failures should not churn through free models

As the operator, I want `generate-outreach` to stop retrying other OpenRouter free models after a clear free-tier rate limit so the runtime fails fast and safely.

Acceptance criteria:

- OpenRouter 429 or quota failures are classified as rate limited.
- Remaining OpenRouter free models are skipped in the same task run.
- If no reliable fallback exists, the task returns a deterministic safe failure state.

### Story 4: Console logs should stay concise and sanitized

As the operator, I want runtime logs to retain useful context without printing raw provider JSON blobs.

Acceptance criteria:

- Logs preserve task, provider, and model when safe.
- Raw JSON error bodies are not printed during normal failures.
- Existing telemetry sanitization is reused when practical.

---

## Planning Questions and Chosen Answers

### 1. Which files need changes?

Chosen direction:

- `src/lib/integrations/notion-jobs.ts`
- `src/lib/enrichment/contact-strategy.ts`
- `src/lib/enrichment/providers/apollo.ts`
- `src/lib/ai/client.ts`
- `src/lib/ai/telemetry.ts` or a tiny shared AI error-summary helper if extraction is cleaner

Likely tests:

- `src/lib/integrations/notion-jobs.test.ts`
- `src/lib/enrichment/contact-strategy.test.ts`
- `src/lib/ai/client.guardrails.test.ts` or extension of existing client tests

### 2. Should Notion and Apollo restriction state be cached per run only, or persisted?

Chosen direction:

- per run only, with optional short-lived in-memory process cache where already natural

Why:

- this is runtime hygiene, not durable business state,
- persistence would add avoidable storage shape and reset problems,
- process-local caches already exist in Apollo health and budget logic.

### 3. How should OpenRouter free-model rate limits be classified?

Chosen direction:

- classify as `rate_limited`
- internally treat free-tier quota and 429 messages as an OpenRouter free-route restriction for the current task run

Why:

- that matches existing AI failure taxonomy,
- no new global provider type is required,
- the runtime can still behave differently for free-model churn without widening the public type system much.

### 4. Should console sanitization reuse telemetry sanitisation?

Chosen direction:

- yes

Why:

- the repo already has `sanitizeTelemetryErrorSummary()` logic,
- a shared pure helper is better than duplicate string-cleanup logic,
- task, provider, model, and failure-kind metadata should remain visible when safe.

### 5. How do we prevent repeated failed retries without changing all AI routing?

Chosen direction:

- use narrow guardrails inside the existing hot paths, not a new routing framework

Specifically:

- Notion: classify and short-circuit best-effort sync logging
- Apollo: circuit-break on plan restriction for the current contact-strategy run
- OpenRouter: short-circuit remaining `:free` models in the current `callAI()` task run

### 6. What tests are required?

Chosen direction:

- Notion 404 misconfiguration test
- Notion missing-config skip test
- Apollo free-plan restriction test
- Apollo repeated-search suppression test
- OpenRouter 429 free-model short-circuit test
- sanitized log output test

### 7. Should this be a fix PR or a small feature PR?

Chosen direction:

- fix PR

Why:

- this is hardening existing runtime behaviour,
- not a user-facing new capability,
- and should stay narrowly scoped.

---

## Functional Requirements

### FR-1: Notion missing config must skip cleanly

If Notion token or database ID is absent, best-effort sync must skip without noisy stack traces and without failing the pipeline.

### FR-2: Notion 404 must classify as `notion_misconfigured`

If Notion database lookup returns 404, classify the condition as `notion_misconfigured`.

Safe log example:

```text
[notion] job sync skipped: database not found or integration not shared
```

### FR-3: Notion failures must remain best-effort

Notion sync must never fail the main job pipeline.

### FR-4: Apollo free-plan restriction must classify as `plan_restricted`

If Apollo reports endpoint inaccessibility on free plan, classify it as `plan_restricted` and keep logging concise.

Safe log example:

```text
[apollo] enrichment skipped: plan restricted
```

### FR-5: Apollo restriction must suppress repeated calls in the same run

Once Apollo company or people search is known to be plan-restricted within the same contact-strategy run, later company or people calls in that run should short-circuit rather than repeat the same doomed requests.

### FR-6: Apollo fallback must remain safe

When Apollo is restricted or unavailable, contact strategy must still return a safe fallback result using existing fallback decision-maker logic.

### FR-7: OpenRouter free-model 429 must short-circuit remaining free models in the same task run

If an OpenRouter `:free` model returns a 429, free-quota, or free-plan rate-limit signal during `generate-outreach`, the AI client must stop trying other OpenRouter free models in that same task run.

### FR-8: OpenRouter guardrail must not remove OpenRouter entirely

OpenRouter stays supported.

This feature only reduces churn through obviously unavailable free-tier fallbacks.

### FR-9: Safe fallback for `generate-outreach`

If no reliable non-rate-limited runtime remains for `generate-outreach`, return a deterministic safe failure state rather than noisy repeated failures.

Recommended v1 safe failure state:

- `null` outreach strategy

Why:

- downstream code already tolerates `null`,
- it avoids inventing new outreach text behaviour in a guardrail-only PR.

### FR-10: Console logs must be sanitized

Runtime console logs must not print raw provider JSON payloads during normal failure handling.

Keep concise metadata when safe:

- task
- provider
- model
- high-level failure summary

Safe example:

```text
[ai-client] generate-outreach failed on openrouter: rate limit exceeded
```

### FR-11: Reuse existing storage and runtime boundaries

This feature must not add new storage keys unless implementation proves a strict need.

Use existing modules and in-memory guardrails first.

### FR-12: No UI required in v1

Do not add new UI unless implementation later proves a clear operator need.

### FR-13: Tests required

The eventual implementation must include tests for Notion misconfiguration, Apollo plan restriction, OpenRouter free-tier short-circuiting, and log sanitisation.

---

## Success Criteria

This feature succeeds when:

- Notion misconfiguration no longer spams stack traces,
- Apollo free-plan restrictions stop repeated doomed calls in the same run,
- OpenRouter free-tier 429 failures stop churning through more free models in the same task run,
- runtime logs stay concise and sanitized,
- no pipeline, ranking, application-status, or email-sending behaviour changes occur,
- and all of this happens without new dependencies or external services.
