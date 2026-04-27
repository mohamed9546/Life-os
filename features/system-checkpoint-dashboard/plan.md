# Implementation Plan: System Checkpoint Dashboard

Feature folder: `features/system-checkpoint-dashboard/`

---

## Technical Direction

Implement a small read-only control-room layer that aggregates local operational checkpoints into one summary payload and one compact UI panel.

It should:

- reuse existing domain helpers where they already exist,
- read backup metadata locally without inspecting contents,
- compute one deterministic overall status,
- show compact section summaries,
- and link to existing detailed control surfaces.

This is not a new engine.

---

## Recommended UI Home

Recommended v1 location:

- Automation page

Why this is the best fit:

- Automation is already framed as internal operations,
- it is admin-only,
- it already surfaces AI runtime and task control information,
- this checkpoint is operational visibility, not end-user configuration,
- Settings already hosts detailed subsystem panels, so Automation can become the operator summary layer.

Recommended future relationship:

- Automation = executive control room
- Settings = detailed subsystem configuration and diagnostics
- Career = outcomes detail and application workflow detail

---

## Likely Implementation Files

### Domain helper

```text
src/lib/system-checkpoint.ts
```

### Optional API route

```text
src/app/api/admin/system-checkpoint/route.ts
```

### UI panel

```text
src/features/automation/system-checkpoint-panel.tsx
```

### Automation integration

```text
src/features/automation/automation-dashboard.tsx
```

### Tests

```text
src/lib/system-checkpoint.test.ts
src/app/api/admin/system-checkpoint/route.test.ts
```

---

## Data Sources

## 1. Source Health

Use:

- `getLatestSourceHealthSnapshot()` from `src/lib/jobs/source-health.ts`

Do not read `data/source-health.json` directly from arbitrary UI code.

## 2. AI Telemetry

Use:

- `getAiTelemetrySummary()` from `src/lib/ai/telemetry.ts`

Do not read `data/ai-telemetry.json` directly from arbitrary UI code.

## 3. Application Outcomes

Use:

- `getLatestApplicationOutcomeSnapshot(userId)` from `src/lib/applications/outcomes.ts`

## 4. Backup Metadata

There is no existing domain helper.

Recommended v1 approach:

- create a small helper inside the checkpoint domain module that inspects:
  - `private/exports/*.age`
- read only:
  - filename
  - last modified time
  - size

Do not:

- open file contents
- decrypt backups
- inspect any secret content

## 5. Runtime Guardrails

Recommended v1 approach:

- read local file existence and static repo boundary metadata only

Suggested checks:

- `.gitignore` contains required `private/*`, `!private/.gitkeep`, `!private/**/*.age` rules
- `scripts/opencode/install-hooks.ps1` exists
- runtime guardrail spec folder exists

Do not run Git shell commands from the app in v1.

---

## Domain Output Shape

Recommended domain result:

```ts
type SystemCheckpointStatus = "healthy" | "attention" | "critical" | "unknown";

interface CheckpointSection<T = Record<string, unknown>> {
  status: SystemCheckpointStatus;
  label: string;
  summary: string;
  updatedAt: string | null;
  data: T;
  actions?: Array<{ label: string; href: string }>;
}

interface SystemCheckpointSnapshot {
  generatedAt: string;
  overallStatus: SystemCheckpointStatus;
  operatorChecklist: string[];
  sourceHealth: CheckpointSection;
  aiTelemetry: CheckpointSection;
  backupStatus: CheckpointSection;
  runtimeGuardrails: CheckpointSection;
  applicationOutcomes: CheckpointSection;
}
```

This keeps the API and UI compact.

---

## Section Status Rules

## Source Health

Suggested v1 rules:

- `unknown` if no snapshot exists
- `critical` if multiple configured sources are down
- `attention` if any source is degraded or one important source is down
- `healthy` if sources are mostly ok

Potential data points:

- `checkedAt`
- `totalSources`
- `ok`
- `degraded`
- `down`
- `unknown`
- first few failing sources

## AI Telemetry

Suggested v1 rules:

- `unknown` if no telemetry exists yet
- `critical` if failure rate is very high in the recent window and volume is non-trivial
- `attention` if fallback rate or failure count is elevated
- `healthy` otherwise

Potential data points:

- today/week/month calls
- failure count
- fallback count
- average latency
- estimated cost
- local vs cloud split
- recent failure count

Recommended caution:

- avoid overreacting to tiny sample sizes

## Backup Status

Suggested v1 rules:

- `critical` if no encrypted backup exists
- `attention` if latest backup is older than 7 days
- `healthy` if backup exists and is 7 days old or newer
- `unknown` only if metadata cannot be read safely

Potential data points:

- latest backup filename
- latest backup timestamp
- latest backup age in days
- backup count

## Runtime Guardrails

Suggested v1 rules:

- `healthy` if expected guardrail files and `.gitignore` protections exist
- `attention` if any expected file or boundary is missing
- `unknown` if inspection fails

Potential data points:

- private boundary configured
- hook installer present
- guardrail feature present

## Application Outcomes

Suggested v1 rules:

- `unknown` if no outcomes snapshot exists and there are no attempts
- `attention` if follow-ups due or ghosted counts are non-zero
- `attention` if outcomes snapshot is missing while attempts exist
- `healthy` if outcomes snapshot exists and operational counts are manageable

Potential data points:

- latest snapshot time
- total records
- attempt records
- responses
- interviews
- offers
- ghosted
- follow-up due
- best source, track, and CV if sample size allows

---

## Overall Status Rules

Recommended v1 approach:

- compute all section statuses first
- reduce to overall with a simple deterministic priority:

```text
critical > attention > healthy > unknown
```

with one refinement:

- if everything is unknown, overall is `unknown`

Recommended interpretation:

- backup absence alone can force `critical`
- multiple severe source failures can force `critical`
- stale backup, elevated AI failures, or outcome follow-up pressure can force `attention`

---

## Operator Checklist

Recommended v1 checklist:

- if no source-health snapshot: `Run source health check`
- if backup missing: `Create encrypted backup`
- if backup stale: `Refresh encrypted backup`
- if outcomes missing and attempts exist: `Build application outcomes snapshot`
- if ghosted/follow-up counts are high: `Review application follow-ups`

This should remain short and derived from actual section state.

---

## API Shape

Recommended route:

```text
src/app/api/admin/system-checkpoint/route.ts
```

Recommended methods:

- `GET` only in v1

Why:

- loading the checkpoint should be read-only,
- a refresh button can simply re-fetch `GET`,
- `POST` is unnecessary unless it starts triggering real operations, which v1 should avoid.

Example response:

```json
{
  "ok": true,
  "snapshot": {}
}
```

---

## UI Shape

Recommended panel layout:

- overall status strip
- five compact section cards
- short operator checklist
- links to detailed surfaces

Recommended detailed links:

- Source Health detail
- AI Telemetry detail
- Career outcomes detail
- Backup instructions or operator docs if useful

Avoid:

- giant tables
- full subsystem duplication
- automatic runs

---

## Testing Strategy

Recommended tests:

- missing source-health snapshot -> `unknown`
- fresh backup -> `healthy`
- stale backup -> `attention`
- no backup -> `critical`
- missing outcomes snapshot with attempts present -> `attention`
- no outcomes snapshot and no attempts -> `unknown`
- AI failure rate and fallback pressure affect status correctly
- overall status reduction works correctly
- operator checklist derives the right items
- backup metadata reader ignores non-`.age` files

Tests should not require:

- `.env.local`
- live AI providers
- live Gmail
- live source adapters
- real backup contents

---

## Risks and Mitigations

### Risk 1: Too much logic in the UI

Mitigation:

- keep all status computation in one domain helper
- keep UI display-only

### Risk 2: Overstating certainty from missing data

Mitigation:

- prefer `unknown` when evidence is genuinely missing
- only escalate to `attention` or `critical` when evidence justifies it

### Risk 3: Backup section accidentally becomes a backup runner

Mitigation:

- v1 is metadata-only
- no script execution from the UI

---

## Recommended Implementation Sequence

1. Define checkpoint types.
2. Build one read-only domain helper.
3. Read source-health status through domain helper.
4. Read AI telemetry summary through domain helper.
5. Read application outcomes summary through domain helper.
6. Read backup metadata through a small safe helper.
7. Read runtime-guardrail static file state.
8. Compute section statuses and overall status.
9. Add a small admin API route if useful.
10. Add a compact Automation panel.
11. Add tests.
12. Run lint, typecheck, tests, and build.
