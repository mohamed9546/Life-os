# Implementation Plan: AI Telemetry

Feature folder: `features/ai-telemetry/`

---

## Technical Direction

Implement AI Telemetry as a local-first metadata recorder integrated at the shared AI router layer.

The feature should reuse the current AI runtime entrypoint in:

```text
src/lib/ai/client.ts
```

The telemetry system should not require task modules to duplicate instrumentation manually.

---

## Why This Is The Right Integration Point

The AI router already has access to most of the required operational metadata:

- task type,
- provider,
- model,
- fallback state,
- latency,
- token usage when available,
- estimated cost calculation,
- failure kind,
- runtime mode.

That makes `src/lib/ai/client.ts` the correct instrumentation boundary.

Instrumenting at individual task files would create drift and inconsistent coverage.

---

## Relationship To Existing `ai-log`

The current AI router already writes a lightweight operational log to `Collections.AI_LOG`.

Observed current fields include:

- taskType,
- model,
- success,
- durationMs,
- inputBytes,
- outputBytes,
- fallbackUsed,
- fallbackAttempted,
- attemptCount,
- failureKind,
- optional input preview.

For AI Telemetry, the safest direction is:

- **do not mutate the current `ai-log` schema in place as the sole solution**,
- create a dedicated telemetry collection such as `ai-telemetry`,
- keep `ai-log` as legacy or low-detail operational history until migration is explicitly planned.

Rationale:

- avoids schema confusion,
- avoids accidentally widening storage of sensitive content,
- allows a clearer retention policy,
- allows a future dashboard with explicit structure.

---

## Proposed Files

### New files

```text
src/lib/ai/telemetry.ts
src/app/api/admin/ai-telemetry/route.ts
src/features/settings/ai-telemetry-panel.tsx
features/ai-telemetry/spec.md
features/ai-telemetry/plan.md
features/ai-telemetry/tasks.md
src/lib/ai/telemetry.test.ts
src/app/api/admin/ai-telemetry/route.test.ts
```

### Modified files

```text
src/lib/ai/client.ts
src/lib/storage/index.ts
src/types/index.ts
src/features/settings/ai-control-room.tsx
or
src/features/automation/automation-dashboard.tsx
or
src/features/life-os/life-os-dashboard.tsx
```

Final UI placement should be chosen after evaluating the trade-offs below.

---

## Proposed Domain Module

Create:

```text
src/lib/ai/telemetry.ts
```

Responsibilities:

- define telemetry entry shape,
- sanitise and constrain metadata,
- persist telemetry events locally through the storage facade,
- expose query helpers,
- expose summary builders,
- enforce default privacy behaviour.

Suggested exports:

```ts
export async function recordAITelemetry(entry: AITelemetryEntry): Promise<void>;

export async function getAITelemetryEntries(options?: {
  limit?: number;
  taskType?: string;
  provider?: string;
  success?: boolean;
}): Promise<AITelemetryEntry[]>;

export async function buildAITelemetrySummary(options?: {
  range?: "today" | "week" | "month";
}): Promise<AITelemetrySummary>;

export function sanitizeTelemetryInput(input: unknown): SanitizedTelemetryContent;
```

---

## Suggested Data Model

Telemetry should capture:

- taskName
- taskType
- callingModule
- provider
- model
- runtimeRoute
- localOrCloud
- sensitivityLevel
- startedAt
- completedAt
- latencyMs
- success
- errorType
- errorSummary
- fallbackUsed
- fallbackReason
- inputTokenEstimate
- outputTokenEstimate
- totalTokenEstimate
- estimatedCost
- metadataVersion

Recommended additions to support future implementation:

- `id`
- optional `userId` if needed in multi-user mode

---

## Storage Strategy

Preferred logical key:

```text
ai-telemetry
```

Expected local file:

```text
data/ai-telemetry.json
```

Recommended implementation approach:

- store as a collection using `readCollection` / `writeCollection` / `appendToCollection`
- do not bypass `src/lib/storage/index.ts`
- add a dedicated collection constant such as:

```ts
Collections.AI_TELEMETRY
```

Retention suggestion for implementation:

- cap raw event records to a manageable size, e.g. last 2,000 to 10,000 entries,
- or keep last 90 days,
- but do not introduce file sharding in the first version unless required.

---

## Privacy Strategy

Telemetry is metadata-only by default.

The implementation should explicitly avoid storing:

- full prompts,
- full raw responses,
- journal text,
- recruiter message text,
- supplier pricing text,
- clinical or patient-adjacent text,
- CV body text.

Recommended first-version strategy:

- record only byte counts and token estimates,
- record optional coarse sensitivity label,
- record optional `callingModule`,
- if any preview support is ever added, it must be opt-in and disabled by default.

Because the current AI config already contains `logPromptPreviews`, the implementation must decide whether:

1. AI Telemetry ignores prompt previews entirely, or
2. AI Telemetry reads that setting but still sanitises aggressively.

Recommended first version:

- ignore prompt preview content for telemetry,
- keep telemetry metadata-only even if the older `ai-log` can still include previews when explicitly enabled.

---

## Integration With `src/lib/ai/client.ts`

The current AI client already computes or knows:

- task type,
- provider,
- model,
- fallback state,
- failure kind,
- token usage where available,
- estimated cost,
- duration,
- runtime mode.

Implementation should instrument at the point where:

- runtime call begins,
- runtime call succeeds,
- runtime call fails,
- fallback path is used.

This means telemetry can be recorded without changing prompts or task outputs.

Possible future extension:

- extend `AICallOptions` with optional metadata fields:
  - `callingModule?: string`
  - `sensitivityLevel?: string`

This is likely necessary because the central router cannot infer `callingModule` or `sensitivityLevel` reliably from `taskType` alone.

These should be optional and backward-compatible.

---

## Runtime Route Vocabulary

Implementation should define a stable vocabulary for `runtimeRoute`.

Recommended options:

- `primary`
- `primary-fallback-model`
- `secondary-fallback-runtime`
- `secondary-preferred`
- `secondary-budget-route`
- `unavailable`

This avoids overloading plain `fallbackUsed` and makes routing behaviour analyzable later.

---

## Cost Estimation

The current AI client already has `estimateCostGbp()` for Gemini-like usage.

Implementation plan should reuse that logic where practical.

Important constraints:

- cost should be `null` when it cannot be estimated safely,
- do not invent provider pricing for unsupported routes,
- do not block calls if cost estimation is unavailable.

---

## UI Placement Trade-offs

The user explicitly asked that placement not be decided without trade-off analysis.

### Option A: Settings / AI Control Room

Pros:

- closest to runtime configuration,
- most natural place for provider/model/fallback/cost analysis,
- operator-friendly for tuning AI settings.

Cons:

- less visible for broader operational review,
- can crowd the AI Control Room.

### Option B: Automation / Admin Panel

Pros:

- aligns with source health and worker operations,
- good for admin/operator runtime monitoring,
- natural fit for “system health” workflows.

Cons:

- may blur AI-specific concerns with worker/source concerns,
- less obvious for non-admin review.

### Option C: Life OS Dashboard

Pros:

- useful for aggregate weekly/monthly metrics,
- good for the behavioural “how much AI did I use?” layer.

Cons:

- too high-level for operational debugging,
- less suited to detailed task/provider/fallback inspection.

### Recommended implementation direction

Primary panel in **Settings / AI Control Room**.

Why:

- closest to AI configuration,
- strongest conceptual match,
- easiest place to compare runtime config against telemetry behaviour.

Optional future additions:

- a small summary tile in Automation,
- a lightweight monthly rollup in Life OS.

---

## API Design

Recommended first route:

```text
src/app/api/admin/ai-telemetry/route.ts
```

Suggested methods:

- `GET`
  - returns recent entries and/or a computed summary
- optional query params:
  - range,
  - taskType,
  - provider,
  - success

If raw entries and summary are both needed, a first version can return:

```json
{
  "ok": true,
  "summary": {},
  "entries": []
}
```

or support separate helper functions inside the same route.

---

## Worker Considerations

No dedicated worker task is strictly required for raw telemetry capture if all AI tasks already pass through the central AI client.

Possible future worker tasks:

- nightly summary rollup,
- retention pruning,
- monthly archive snapshot.

For the first implementation, these should likely be deferred unless data growth or UI performance requires them.

---

## Testing Strategy

The implementation should include tests for:

- metadata-only recording,
- no prompt/response persistence by default,
- successful AI call telemetry,
- failed AI call telemetry,
- fallback route telemetry,
- local/cloud classification,
- cost estimate propagation when available,
- null cost when unavailable,
- summary aggregation correctness,
- route GET behaviour.

Recommended test files:

```text
src/lib/ai/telemetry.test.ts
src/app/api/admin/ai-telemetry/route.test.ts
```

---

## Verification Expectations

When implementation happens later, verification should include:

- lint
- typecheck
- tests
- build
- manual UI review
- manual API review
- privacy review of stored `data/ai-telemetry.json`

Manual privacy verification must confirm:

- no prompt text stored by default,
- no response text stored by default,
- no secrets,
- no sensitive content leakage.

---

## Open Questions For Implementation

1. Should AI Telemetry replace `ai-log` or live beside it initially?
   - Recommended: live beside it first.

2. Should `callingModule` and `sensitivityLevel` be derived centrally or passed in via `AICallOptions`?
   - Recommended: add optional fields to `AICallOptions`.

3. Should prompt previews ever be allowed in telemetry when `logPromptPreviews` is enabled?
   - Recommended: no, not in telemetry.

4. What retention policy should raw telemetry use?
   - Recommended: bounded collection or 90-day retention.

5. Should the first UI panel show raw events, only summaries, or both?
   - Recommended: summary first, with a compact recent-events table.

---

## Proposed Implementation Sequence

1. Add AI telemetry types.
2. Add storage key/collection support.
3. Build `src/lib/ai/telemetry.ts`.
4. Extend `AICallOptions` with optional metadata fields.
5. Instrument `src/lib/ai/client.ts`.
6. Add admin API route.
7. Add UI panel in Settings / AI Control Room.
8. Add tests.
9. Run lint/typecheck/test/build.

The implementation should stop there and not expand into external telemetry, backup systems, or prompt-logging scope creep.
