# Feature Spec: System Checkpoint Dashboard

Feature folder: `features/system-checkpoint-dashboard/`

---

## Summary

Build a lightweight System Checkpoint Dashboard for Life-OS.

The dashboard should provide one operator-facing control-room view that answers:

> Is Life-OS healthy enough to trust today?

It should summarize the current state of the shipped control layers:

- Source Health
- AI Telemetry
- Encrypted Backup status
- Runtime Integration Guardrails
- Application Outcomes

This is a visibility layer, not a new operational engine.

---

## Strategic Rationale

Life-OS already has meaningful operational control layers, but they are spread across:

- Settings
- Career dashboard
- scripts
- API routes
- local snapshots
- release tags

That fragmentation increases operator overhead.

The user should not need to remember where each subsystem lives to answer simple trust questions such as:

- are sources healthy,
- is AI behaving acceptably,
- is backup stale,
- are guardrails present,
- and are application outcomes current enough to trust.

The System Checkpoint Dashboard should provide a compact executive health surface without creating new heavy workflow logic.

---

## Goals

1. Show one compact read-only operational trust view.
2. Reuse existing local snapshots and domain helpers.
3. Avoid triggering heavy operations automatically.
4. Keep the dashboard local-first and metadata-only.
5. Make stale or missing operational checkpoints visible.
6. Provide easy navigation to existing detailed surfaces.
7. Add no external calls.
8. Add no new provider integrations.

---

## Non-Goals

This feature does not:

- run source checks automatically,
- run backup or restore scripts,
- decrypt or inspect backup contents,
- call Gmail,
- call AI providers,
- call job sources,
- mutate application logs,
- mutate job records,
- create a large analytics dashboard,
- implement CV versioning,
- implement recruiter graph logic,
- replace Settings, Career, or Automation surfaces.

---

## Users

Primary user:

- Mohamed, as operator of the local-first Life-OS runtime.

Secondary users:

- maintainers and agents checking whether the workspace is operationally trustworthy.

---

## User Stories

### Story 1: See overall trust state quickly

As the operator, I want one checkpoint view that tells me whether Life-OS is healthy enough to trust today.

Acceptance criteria:

- One overall status is shown.
- Each control layer has its own section status.
- Missing or stale checkpoints are visible.

### Story 2: Navigate to detailed control layers

As the operator, I want to jump from the checkpoint view into detailed panels when a subsystem needs attention.

Acceptance criteria:

- The dashboard links to existing detailed surfaces.
- It does not duplicate full subsystem UIs.

### Story 3: Read only local checkpoint data

As the operator, I want the checkpoint view to read local snapshots only so that loading the page does not trigger external systems or mutate state.

Acceptance criteria:

- Existing local snapshots are reused.
- No source fetches or provider calls happen when the view loads.
- Backup status is derived from encrypted backup metadata only.

---

## Control Layers In Scope

### 1. Source Health

Show:

- latest check time
- total sources
- `ok / degraded / down / unknown` counts
- worst failing sources
- link to detailed source health area

Preferred data source:

- latest source-health snapshot through domain helper

### 2. AI Telemetry

Show:

- calls today/week/month
- success/failure count
- fallback count
- average latency
- estimated cost
- recent failure count
- local vs cloud split
- link to detailed AI telemetry area

Preferred data source:

- AI telemetry summary through domain helper

### 3. Backup Status

Show:

- latest encrypted backup timestamp if one exists
- backup age in days
- stale or missing status
- no restore action from UI

Important constraints:

- do not read backup contents
- do not decrypt backups
- do not run backup or restore
- only inspect `.age` filename and filesystem metadata under `private/exports/`

Suggested status rules for v1:

- green: encrypted backup exists and is `<= 7` days old
- amber: encrypted backup exists and is `> 7` days old
- red: no encrypted backup found

### 4. Runtime Guardrails

Show a small read-only summary that guardrails are present.

Preferred v1 checks:

- expected runtime-guardrail files exist
- `.gitignore` still protects `private/`
- optional hook installer path exists

Avoid:

- Git shell calls from the app by default
- expensive repository introspection in the UI

Preferred v1 interpretation:

- show `Configured` when expected local files and `.gitignore` protections exist
- otherwise show `Attention`

### 5. Application Outcomes

Show:

- latest outcomes snapshot time
- total records
- total real attempts
- responses
- interviews
- offers
- ghosted
- follow-ups due
- best source / track / CV when sample size allows
- link to detailed Career outcomes surface

Preferred data source:

- latest application-outcomes snapshot through domain helper

---

## Planning Questions and Chosen Answers

### 1. Should v1 live in Settings, Automation, or a new `/system` route?

Chosen v1 direction:

- Automation page

Why:

- this is an operator-control surface, not a user preference surface,
- Automation is already admin-only and operational,
- the existing Automation page already frames internal runtime state,
- this avoids adding a new top-level route too early.

### 2. Should the dashboard read raw local files or only domain helper functions?

Chosen v1 direction:

- use domain helpers wherever they already exist
- add one small read-only backup metadata helper where no domain helper exists yet

Why:

- this preserves storage-facade discipline,
- minimizes duplicate logic,
- keeps backup inspection safely metadata-only.

### 3. Should backup status inspect `private/exports/*.age` metadata directly?

Chosen v1 direction:

- yes, metadata only

Why:

- there is no existing backup-status domain helper,
- encrypted backup presence is a filesystem concern,
- content inspection is explicitly out of scope.

### 4. Should it expose action buttons, or links only?

Chosen v1 direction:

- links only, plus cheap read-only refresh if useful

Why:

- avoid hidden side effects,
- keep this surface observational,
- preserve existing detailed panels as the place where real actions happen.

### 5. Should it automatically run source-health or outcomes refresh?

Chosen v1 direction:

- no

Why:

- checkpoint load should remain cheap and deterministic,
- no external or heavy operations should happen automatically,
- manual refresh should only re-read local status.

### 6. Should it include Git tag or version checkpoint display?

Chosen v1 direction:

- not required in the first dashboard body

Why:

- tag/version display is helpful but secondary,
- Git shell calls from the app are not preferred for v1,
- the dashboard should focus on operational trust, not repo release history.

### 7. What counts as stale backup?

Chosen v1 direction:

- 7 days

### 8. Should missing snapshots be `unknown` or `attention`?

Chosen v1 direction:

- `unknown` by default
- escalate to `attention` or `critical` only when missing data should reasonably exist

Examples:

- no source-health snapshot ever: `unknown`
- no outcomes snapshot and no application history: `unknown`
- no outcomes snapshot but application attempts exist: `attention`

### 9. Should it show operator checklist items?

Chosen v1 direction:

- yes, lightly

Why:

- a short operator checklist makes the checkpoint actionable,
- it should remain compact and deterministic, not a workflow engine.

### 10. Should sections hide themselves when files are missing?

Chosen v1 direction:

- no

Why:

- missing checkpoint data is itself useful status,
- sections should render explicit `unknown` or `missing` states rather than disappear.

---

## Functional Requirements

### FR-1: Read-only control room

The dashboard must be read-only.

It must not:

- trigger external providers,
- run source fetches,
- run Gmail sync,
- run backup or restore,
- mutate local domain records.

### FR-2: Local-first only

All status data must come from local snapshots, domain helpers, or safe local metadata inspection.

### FR-3: Compact overall status

The dashboard must compute one deterministic overall status:

- `healthy`
- `attention`
- `critical`
- `unknown`

### FR-4: Source Health section

The dashboard must summarize the latest source-health snapshot using existing source-health domain data.

### FR-5: AI Telemetry section

The dashboard must summarize the latest AI telemetry state using existing telemetry domain data.

### FR-6: Backup section

The dashboard must determine backup status from encrypted backup metadata only.

It must not inspect contents.

### FR-7: Runtime Guardrails section

The dashboard must expose a lightweight configured/attention/unknown view for runtime guardrails without live Git shell operations.

### FR-8: Application Outcomes section

The dashboard must summarize the latest outcomes snapshot using existing outcomes domain data.

### FR-9: Links to detailed surfaces

The dashboard should provide links to existing detailed areas such as:

- Source Health detail
- AI Telemetry detail
- Career outcomes detail
- backup docs or operator instructions if appropriate

### FR-10: No new heavy analytics dashboard

The first implementation must remain compact and operational.

---

## Overall Status Model

Suggested v1 deterministic rules:

### `critical`

- no encrypted backup exists
- source health shows multiple down sources among configured sources
- AI failure rate is very high in the current window
- outcomes snapshot missing while application attempts exist

### `attention`

- source health degraded
- encrypted backup is stale (`> 7` days)
- AI fallback/failure elevated
- follow-ups due exist
- ghosted applications exist

### `healthy`

- backup exists and is fresh
- source health mostly ok
- AI telemetry not failing heavily
- application outcomes snapshot exists and is current enough

### `unknown`

- required local snapshots have not been generated yet and there is not enough evidence to call the state attention or critical.

---

## Success Criteria

This feature succeeds when:

- one compact operational dashboard exists,
- it reads only existing local snapshots and safe metadata,
- it does not trigger heavy operations automatically,
- it makes stale or missing checkpoint layers visible,
- it gives one overall trust state for the day,
- and it points the operator to the right detailed control surfaces.
