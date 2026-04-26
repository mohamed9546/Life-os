# Feature Spec: Source Health Monitoring

Feature folder: `features/source-health/`

---

## Summary

Build a source health monitoring system for the Life-OS job ingestion pipeline.

The system must run lightweight smoke tests against every registered job source adapter, record whether each source is healthy, expose the latest health state through an API route, show a compact dashboard panel, and integrate with the worker layer for scheduled checks.

This feature protects the career pipeline from silent source failure.

---

## Strategic Rationale

Life-OS depends on multiple public and API-backed job sources.

If a source silently breaks because of:

- expired API keys,
- HTML structure changes,
- rate limits,
- network failure,
- malformed adapter output,
- provider downtime,

then the user may trust an incomplete job inbox.

That is unacceptable because the career pipeline is the centre of gravity of Life-OS.

Source health monitoring makes missing coverage visible.

---

## Goals

1. Test each registered source adapter with a lightweight probe.
2. Store the latest health result locally.
3. Surface failures clearly in the UI.
4. Avoid crashing the full pipeline when one source fails.
5. Provide enough information to debug source degradation.
6. Support manual and worker-triggered runs.
7. Add no new dependencies.

---

## Non-Goals

This feature does not:

- repair broken source adapters automatically,
- add new job sources,
- change ranking logic,
- change relevance gating,
- change Gmail job alert extraction,
- change application review logic,
- send notifications externally,
- call AI providers.

---

## Users

Primary user:

- Mohamed, using Life-OS to manage job discovery and career transition execution.

Secondary user:

- AI coding agent maintaining the Life-OS codebase.

---

## User Stories

### Story 1: See whether job sources are working

As the user, I want to see which job sources are healthy so I know whether the job pipeline is trustworthy.

Acceptance criteria:

- The UI lists every registered source.
- Each source has one of: `ok`, `degraded`, `down`, `unknown`.
- The UI shows last checked time.
- The UI shows latency where available.
- The UI shows a short error message for failures.

### Story 2: Run a manual source-health check

As the user, I want to trigger source health checks manually from the app.

Acceptance criteria:

- A button triggers the health check API.
- The button shows loading state.
- Results refresh after completion.
- One failing source does not block all other sources.

### Story 3: Worker can run source-health checks

As the system, I want a worker task that can check source health on a schedule.

Acceptance criteria:

- A task is registered in the worker registry.
- The task runs the same source-health function as the API.
- Results are stored in the same location.

### Story 4: Debug broken adapters

As the maintainer, I want enough detail to diagnose broken adapters.

Acceptance criteria:

- Store error message.
- Store result count if available.
- Store latency.
- Store source name.
- Store timestamp.
- Store check duration.
- Do not store full raw API responses.

---

## Functional Requirements

### FR-1: Source Enumeration

The health checker must use the existing source registry under:

```text
src/lib/jobs/sources/
```

It must not duplicate source names manually if the registry already exposes them.

### FR-2: Lightweight Probe

Each source should be probed with the smallest reasonable request.

Expected behaviour:

- fetch a minimal number of jobs, ideally 1-3,
- validate that the returned shape resembles `RawJobItem[]`,
- measure latency,
- catch all errors per source.

### FR-3: Health Status

Each result must have:

```ts
type SourceHealthStatus = "ok" | "degraded" | "down" | "unknown";
```

Status rules:

- `ok`: source returned valid results or a valid empty result.
- `degraded`: source responded but returned malformed partial data, suspicious empty result, or non-fatal warning.
- `down`: source threw an error, timed out, returned invalid response, or failed credentials/rate-limit checks.
- `unknown`: never checked or no result exists.

### FR-4: Storage

Store latest health state locally through the storage facade.

Target logical key:

```text
source-health
```

Expected local file:

```text
data/source-health.json
```

No direct random `fs` writes outside the storage layer.

### FR-5: API

Add API route:

```text
src/app/api/admin/source-health/route.ts
```

Supported methods:

- `GET`: return latest stored health state.
- `POST`: run health checks and return fresh state.

### FR-6: UI Panel

Add component:

```text
src/features/settings/source-health-panel.tsx
```

Surface it on the Settings page.

The panel should show:

- overall status,
- number of healthy sources,
- number of degraded/down sources,
- table of individual source status,
- last checked time,
- latency,
- error summary,
- manual refresh button.

### FR-7: Worker Task

Register worker task:

```text
source-health-check
```

Location:

```text
src/lib/worker/task-registry.ts
```

The task should call the same domain function used by the API route.

### FR-8: No AI Required

This feature must not call the AI router.

### FR-9: No New Dependencies

Use existing project utilities and built-in APIs.

### FR-10: Privacy

Do not store raw job result bodies, full HTTP responses, recruiter data, user data, or tokens.

Store only diagnostic metadata.

---

## Data Model

```ts
export type SourceHealthStatus = "ok" | "degraded" | "down" | "unknown";

export interface SourceHealthResult {
  sourceId: string;
  sourceName: string;
  status: SourceHealthStatus;
  checkedAt: string;
  latencyMs: number | null;
  resultCount: number | null;
  error: string | null;
  warning: string | null;
}

export interface SourceHealthSnapshot {
  checkedAt: string;
  durationMs: number;
  totalSources: number;
  ok: number;
  degraded: number;
  down: number;
  unknown: number;
  results: SourceHealthResult[];
}
```

---

## Constraints

- No AI calls.
- No new runtime architecture.
- No bypassing storage facade.
- No new job sources.
- No dependency on Supabase.
- No full raw response persistence.
- No secrets in output.

---

## Success Criteria

The feature succeeds when:

- the user can run a health check manually,
- the latest source-health state persists locally,
- broken sources are clearly visible,
- worker can run the same check,
- the app remains stable if one or more sources fail.
