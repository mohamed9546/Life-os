# Feature Spec: AI Telemetry

Feature folder: `features/ai-telemetry/`

---

## Summary

Build a local-first AI telemetry layer for Life-OS.

The feature should act as a black-box recorder for AI task execution metadata so the system can answer operational questions such as:

- which AI tasks are running,
- which provider/model is being used,
- which tasks are slow,
- which tasks fail,
- where fallback logic is being used,
- whether tasks are local or cloud,
- whether estimated cost and latency are becoming wasteful,
- whether sensitive tasks are being routed appropriately.

This feature must record telemetry without storing full prompts or full responses by default.

---

## Strategic Rationale

Life-OS already routes many different AI tasks through a shared AI runtime layer:

- job parsing,
- job fit scoring,
- follow-up generation,
- outreach generation,
- chat,
- CV optimisation,
- weekly summaries,
- money summaries,
- categorisation tasks.

The current app already logs some operational metadata in `ai-log`, but it does not yet provide a structured telemetry layer designed for:

- cost awareness,
- runtime-route analysis,
- sensitivity auditing,
- fallback-pattern analysis,
- monthly trend review,
- provider/model diagnostics.

Without that layer, AI issues can remain partially invisible:

- cloud tasks may become expensive without visibility,
- fallback routes may silently dominate,
- slow tasks may degrade UX,
- sensitive tasks may be routed incorrectly,
- some features may fail more often than expected.

AI Telemetry is the next operational hardening layer after Source Health.

---

## Goals

1. Record local telemetry for every AI task execution through the shared AI router.
2. Keep telemetry metadata-only by default.
3. Avoid storing sensitive prompt or response text by default.
4. Make fallback behaviour observable.
5. Make provider/model usage observable.
6. Make local vs cloud execution observable.
7. Make latency and failure patterns observable.
8. Make estimated token/cost usage visible when available.
9. Support future dashboards for operator insight.
10. Add no external telemetry service.

---

## Non-Goals

This feature does not:

- change prompt wording,
- change AI task outputs,
- change routing decisions by itself,
- send telemetry to any external service,
- store raw full prompts by default,
- store raw full responses by default,
- introduce Sentry, PostHog, LangSmith, Langfuse, or any third-party analytics,
- implement cost budgets or automatic throttling,
- replace the current AI log UI unless explicitly planned later.

---

## Users

Primary users:

- Mohamed, using Life-OS as the operator of the system.
- Maintainers/agents diagnosing AI behaviour and runtime quality.

---

## User Stories

### Story 1: See AI usage patterns

As the operator, I want to see which AI tasks are being called so I know what the system is actually doing.

Acceptance criteria:

- A telemetry store exists locally.
- Each AI call records task metadata.
- Aggregated counts can be computed by task/provider/model.

### Story 2: See failures and fallbacks

As the operator, I want to see which tasks fail and where fallbacks happen so I can identify unstable routes.

Acceptance criteria:

- Failure state is recorded.
- Failure type is recorded.
- Fallback usage is recorded.
- A fallback reason can be derived or captured when practical.

### Story 3: See latency and cost pressure

As the operator, I want to see which tasks are slow or potentially costly so I can spot waste.

Acceptance criteria:

- Latency is recorded.
- Token estimates are recorded when available.
- Estimated cost is recorded when derivable.
- Aggregates support today/week/month summaries.

### Story 4: Respect privacy boundaries

As the operator, I want telemetry to remain safe by default so operational visibility does not become a privacy leak.

Acceptance criteria:

- No full prompts by default.
- No full responses by default.
- Sensitive content categories are not stored as free text.
- Telemetry remains local-first only.

---

## Functional Requirements

### FR-1: Central Integration Point

Telemetry must integrate through the shared AI router:

```text
src/lib/ai/client.ts
```

It must not require every task module to invent separate telemetry calls manually.

### FR-2: Local-First Storage

Telemetry must be stored locally through the storage facade:

```text
src/lib/storage/index.ts
```

Expected logical key:

```text
ai-telemetry
```

Expected local file:

```text
data/ai-telemetry.json
```

### FR-3: Metadata Capture

Where available, each telemetry event should capture:

```text
taskName
taskType
callingModule
provider
model
runtimeRoute
localOrCloud
sensitivityLevel
startedAt
completedAt
latencyMs
success
errorType
errorSummary
fallbackUsed
fallbackReason
inputTokenEstimate
outputTokenEstimate
totalTokenEstimate
estimatedCost
metadataVersion
```

### FR-4: Privacy Default

The feature must not store by default:

- full prompts,
- full responses,
- personal journal text,
- recruiter message text,
- supplier pricing content,
- clinical or patient-adjacent free text,
- CV body text unless explicitly anonymised or summarised.

### FR-5: Sensitivity-Aware Metadata

The telemetry system should support a `sensitivityLevel` field so future features can mark tasks as:

- public,
- internal,
- sensitive,
- clinical-adjacent,
- recruiter-private,
- finance-private,

or an equivalent taxonomy aligned to repo conventions.

### FR-6: Runtime Route Visibility

Telemetry should make runtime route observable. At minimum it should distinguish:

- primary runtime success,
- fallback model within same runtime,
- secondary runtime fallback,
- secondary-preferred runtime,
- local vs cloud execution.

### FR-7: Token and Cost Estimates

If token usage is available from the runtime response, record it.

If exact usage is not available, record an estimate or null.

Estimated cost should only be stored when it can be derived locally from known pricing rules.

### FR-8: Error Recording

Record:

- success/failure,
- classified error type,
- short error summary,

but do not store full exception traces in the telemetry record.

### FR-9: Dashboard Capability

The telemetry design must support a future panel showing:

- total AI calls today / this week / this month,
- slowest tasks,
- failed tasks,
- fallback usage,
- provider/model usage,
- estimated monthly cost,
- local vs cloud split,
- sensitivity routing overview.

### FR-10: No Behaviour Change

Telemetry must not change:

- prompt text,
- model outputs,
- routing decisions,
- task semantics,

except for recording metadata.

---

## Proposed Data Model

```ts
export interface AITelemetryEntry {
  id: string;
  taskName: string;
  taskType: string;
  callingModule: string | null;
  provider: string | null;
  model: string | null;
  runtimeRoute: string | null;
  localOrCloud: "local" | "cloud" | "unknown";
  sensitivityLevel: string | null;
  startedAt: string;
  completedAt: string;
  latencyMs: number;
  success: boolean;
  errorType: string | null;
  errorSummary: string | null;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  inputTokenEstimate: number | null;
  outputTokenEstimate: number | null;
  totalTokenEstimate: number | null;
  estimatedCost: number | null;
  metadataVersion: number;
}
```

Possible aggregate shape:

```ts
export interface AITelemetrySummary {
  generatedAt: string;
  totalCalls: number;
  failures: number;
  fallbackCalls: number;
  localCalls: number;
  cloudCalls: number;
  estimatedCostGbp: number;
  byTask: Record<string, number>;
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
}
```

---

## Storage Strategy

Preferred first version:

- append-only local collection `ai-telemetry`
- keep only metadata records
- optionally retain only the last N events or last X days

This should be separate from the current `ai-log` collection rather than silently mutating that schema, unless implementation review later decides to migrate them together safely.

---

## UI Placement Candidates

Potential locations:

### Option A: Settings

Pros:

- closest to AI runtime configuration,
- natural place for provider/model/cost/fallback diagnostics,
- good fit for operational tuning.

Cons:

- may be less visible in day-to-day review.

### Option B: Automation / Admin panel

Pros:

- aligns with source health and worker/runtime operations,
- useful for admin/operator debugging,
- natural place for reliability and cost controls.

Cons:

- can become crowded with worker/source concerns.

### Option C: Life OS dashboard

Pros:

- good for high-level weekly/monthly trends,
- useful for behavioural overview and cost awareness.

Cons:

- weaker fit for operator debugging,
- too high-level for detailed runtime diagnostics.

The final implementation should explain and choose the placement deliberately rather than by convenience.

---

## Constraints

- no external analytics service,
- no prompt/response persistence by default,
- no `.env.local` inspection,
- no secret exposure,
- local-first only,
- preserve current AI behaviour,
- no unnecessary dependencies.

---

## Success Criteria

The feature succeeds when:

- every AI task call can produce a safe telemetry event,
- telemetry remains metadata-only by default,
- failures and fallbacks become visible,
- cost/latency can be summarised locally,
- sensitivity routing can be reviewed,
- no sensitive text is leaked into telemetry storage,
- the app behaves exactly as before except for recording metadata.
