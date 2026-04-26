# Implementation Plan: Source Health Monitoring

Feature folder: `features/source-health/`

---

## Technical Direction

Implement source health monitoring as a small domain module reused by:

- API route,
- Settings UI,
- worker task.

Do not implement logic inside the React component or route handler.

---

## Proposed Files

### New files

```text
src/lib/jobs/source-health.ts
src/app/api/admin/source-health/route.ts
src/features/settings/source-health-panel.tsx
features/source-health/spec.md
features/source-health/plan.md
features/source-health/tasks.md
```

### Modified files

```text
src/lib/storage/index.ts
src/lib/worker/task-registry.ts
src/features/settings/settings-panel.tsx
src/features/settings/admin-integrations-panel.tsx
src/types/index.ts
```

Potential test files:

```text
src/lib/jobs/source-health.test.ts
src/app/api/admin/source-health/route.test.ts
```

---

## Domain Module

Create:

```text
src/lib/jobs/source-health.ts
```

Responsibilities:

- load registered job sources,
- run lightweight probe per source,
- measure latency,
- validate result shape,
- catch source-level errors,
- aggregate snapshot,
- read latest snapshot,
- write latest snapshot.

Suggested exports:

```ts
export async function runSourceHealthCheck(): Promise<SourceHealthSnapshot>;

export async function getLatestSourceHealthSnapshot(): Promise<SourceHealthSnapshot | null>;

export function classifySourceHealthResult(args: {
  resultCount: number | null;
  error: string | null;
  warning: string | null;
  malformed?: boolean;
}): SourceHealthStatus;
```

---

## Storage

Update storage facade to support:

```text
source-health
```

Expected file:

```text
data/source-health.json
```

Do not write from the health checker directly with raw `fs` unless that is already the established pattern inside the storage facade.

---

## Source Probe Strategy

Each adapter should be probed using the smallest supported search.

Preferred query:

```text
clinical trial assistant
```

Preferred limit:

```text
1
```

If adapter does not support limit, use the smallest default fetch.

Validation:

- result must be an array,
- each item should have enough identifying data to be treated as a raw job:
  - title or equivalent,
  - source or source id,
  - URL or id where available.

Do not reject valid empty arrays automatically. Some sources may legitimately return no result during testing.

Suggested classification:

- valid array, no error: `ok`
- array but suspicious/malformed partial item: `degraded`
- thrown error: `down`
- no stored result: `unknown`

---

## API Route

Create:

```text
src/app/api/admin/source-health/route.ts
```

Methods:

### GET

Returns latest stored snapshot.

Response:

```json
{
  "ok": true,
  "snapshot": null
}
```

or:

```json
{
  "ok": true,
  "snapshot": {
    "checkedAt": "...",
    "durationMs": 1234,
    "totalSources": 13,
    "ok": 10,
    "degraded": 1,
    "down": 2,
    "unknown": 0,
    "results": []
  }
}
```

### POST

Runs check and stores result.

Response:

```json
{
  "ok": true,
  "snapshot": {}
}
```

If the whole check fails unexpectedly:

```json
{
  "ok": false,
  "error": "Source health check failed"
}
```

Do not expose secrets or full stack traces.

---

## UI Component

Create:

```text
src/features/settings/source-health-panel.tsx
```

Behaviour:

- fetch latest snapshot on mount,
- show empty state if none,
- allow manual refresh,
- show loading state,
- show error banner if API fails,
- table results by source.

Suggested visual hierarchy:

1. Card title: `Source health`
2. Description
3. Summary counters
4. Run check button
5. Table

Table columns:

- Source
- Status
- Last checked
- Latency
- Result count
- Error / warning

---

## Settings Integration

Modify:

```text
src/features/settings/settings-panel.tsx
src/features/settings/admin-integrations-panel.tsx
```

Add the panel in a logical section near runtime/source configuration.

Do not replace the existing source runtime board. Source Health sits beside it.

---

## Worker Integration

Register a worker task:

```text
source-health-check
```

Worker should call the same domain function used by the API route.

---

## Verification Strategy

Verification should include:

- lint
- typecheck
- tests
- build
- manual API check
- manual UI check
- gitignore/privacy check

---

## Notes

- No AI required.
- No new job sources.
- No runtime key changes.
- No raw payload persistence.
