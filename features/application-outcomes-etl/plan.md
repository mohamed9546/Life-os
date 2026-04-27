# Implementation Plan: Application Outcome ETL

Feature folder: `features/application-outcomes-etl/`

---

## Technical Direction

Implement Application Outcome ETL as a read-only local analytics layer.

It should:

- read existing application logs and job records,
- join them into one canonical per-application outcome view,
- derive deterministic response, follow-up, and ghosted signals,
- write one local snapshot through the storage facade,
- expose the snapshot through a manual API path first,
- and leave ranking, source ingestion, and application sending behaviour unchanged.

This is not a cloud analytics feature.

---

## Why Read-Only ETL First Is Correct

This feature is meant to help the system learn from what already happened.

Compared with trying to automate status correction or external tracking immediately, a read-only ETL first approach is safer because it:

- preserves source truth,
- avoids accidental workflow mutation,
- is easier to validate,
- aligns with the constitution's review-first rules,
- and gives the career dashboard insight without operational side effects.

---

## Proposed Future Implementation Files

### Planning files

```text
features/application-outcomes-etl/spec.md
features/application-outcomes-etl/plan.md
features/application-outcomes-etl/tasks.md
```

### Likely implementation files

```text
src/lib/applications/outcomes.ts
src/lib/applications/outcomes.test.ts
src/app/api/applications/outcomes/route.ts
src/features/career/application-outcomes-panel.tsx
```

### Optional later files

```text
src/lib/opencode/application-outcomes.ts
src/lib/opencode/application-outcomes.test.ts
```

### Possible worker touchpoint

```text
src/lib/worker/task-registry.ts
```

The eventual implementation should prefer one shared domain module and let API or worker surfaces call it.

---

## Output Strategy

### Recommended v1 output

Use one consolidated snapshot object written through the storage facade.

Recommended logical key:

```text
application-outcomes
```

Recommended local file:

```text
data/application-outcomes.json
```

### Why not multiple output files in v1

Multiple outputs such as:

- `data/outcomes-by-track.json`
- `data/outcomes-by-source.json`
- `data/outcomes-by-cv-version.json`
- `data/recruiter-performance.json`

would introduce avoidable drift risk.

One canonical snapshot is better for v1 because it:

- keeps writes atomic,
- avoids recomputing or syncing separate files,
- gives UI and APIs one source of truth,
- still allows many grouped sections inside one object.

---

## Input Join Strategy

### Primary inputs

Use existing domain helpers where possible:

- `getApplicationLogs(userId, 1000)`
- `getRankedJobs(userId)`
- `getEnrichedJobs(userId)`
- `getInboxJobs(userId)`
- `getRejectedJobs(userId)`
- `getCvLibrary()`
- `getTargetCompanies()`

### Why helper-first is correct

The ETL should reuse domain modules rather than reimplement raw storage access because that:

- respects the storage facade,
- stays compatible with local JSON and Supabase-backed reads,
- keeps one place for user filtering and fallback behaviour.

### Job-level join key

Recommended canonical join key:

- `dedupeKey`

Why:

- it already links multiple stored views of the same role,
- it works when a job exists in both application logs and job collections.

Important:

- `dedupeKey` is the job-level join key,
- it is not the universal primary record ID for outcome analytics.

### Entity grain

Recommended v1 entity grain:

- one derived row per application attempt when an application attempt exists,
- one fallback row per job `dedupeKey` only for tracked or shortlisted jobs with no application attempt yet.

Recommended record identity:

- `recordId = applicationAttemptId` when available,
- `recordId = jobDedupeKey` only for fallback pipeline-only rows,
- `dedupeKey` retained on every row for joins and rollups.

This is the right balance between:

- preserving true attempt-level outcome analytics,
- avoiding job-level over-collapse,
- and still showing tracked or shortlisted roles that have not yet reached a real attempt.

---

## Status Model

### Existing status vocabularies

Application attempt logs:

- `planned`
- `drafted`
- `applied`
- `paused`
- `skipped`
- `failed`

Job or pipeline state:

- `inbox`
- `shortlisted`
- `tracked`
- `applied`
- `interview`
- `offer`
- `rejected`
- `archived`

### Recommended v1 handling

Do not replace these with a new source-of-truth status model.

Instead:

- store `pipelineStatus` and `latestAttemptStatus` separately,
- derive `currentStatus` for analytics,
- build grouped summaries from a normalized stage family only when needed.

Recommended current-status precedence:

1. pipeline status if present
2. latest attempt status if no pipeline status exists
3. `unknown`

---

## Derived Metric Rules

### Application date

Recommended v1 rule:

- use the earliest actionable application log time when present,
- otherwise fall back to the job's `stageChangedAt` when the current job status is at least `applied`,
- otherwise leave `applicationDate` as `null`.

For pipeline-only fallback rows, `applicationDate` may remain `null` because no real attempt exists.

### Last action date

Recommended v1 rule:

- use the most recent actionable application log time when present,
- otherwise use `stageChangedAt` when present,
- otherwise use `updatedAt`.

### Response definition

Recommended v1 rule:

- `responseReceived = true` when the job status is `interview`, `offer`, or `rejected`

Reason:

- these are deterministic current-state signals,
- they do not rely on Gmail scraping,
- rejection still counts as an employer response.

### Response date

Recommended v1 rule:

- use `stageChangedAt` when the current pipeline status is a response state,
- otherwise `null`.

### Follow-up due

Recommended v1 rule:

- actionable application with no recorded response and at least 8 days since last action

Pipeline-only tracked or shortlisted rows should not be treated as overdue application follow-ups unless a real application attempt exists.

### Ghosted

Recommended v1 rule:

- actionable application,
- no recorded response,
- at least 21 days since last action,
- and current pipeline status is not `interview`, `offer`, or `rejected`.

This intentionally mirrors the current `apps-status` logic.

Pipeline-only tracked or shortlisted rows should not be counted as ghosted applications because they are not yet real attempts.

### Stage leakage

V1 cannot calculate perfect stage transition durations because the source system does not yet store a complete application status-event history.

Recommended v1 stage-leak view:

- count records by normalized stage family,
- count records overdue for follow-up,
- count ghosted records,
- compute response, interview, offer, and rejection rates from currently known state.

This is a snapshot-based approximation, not a full event-timeline model.

---

## CV Attribution Strategy

Recommended order:

1. `selectedCvId`
2. selected CV path
3. tailored CV path
4. CV library match by path
5. `unknown`

This keeps attribution deterministic.

Do not infer CV version from free text, Gmail drafts, or AI output.

CV-version performance summaries should include only attempt rows.

---

## Recruiter and Company Attribution

### Company

Company is already available from:

- `job.raw.company`
- `companyIntel.name` when present

Use raw company as the canonical fallback.

### Recruiter

Recommended v1 recruiter fields:

- first decision-maker full name when present,
- otherwise first outreach target contact name when present,
- otherwise `null`.

Recruiter response-rate summaries should use attempt rows only.

### Agency

There is no reliable dedicated agency field in the current model.

Recommended v1 handling:

- `agencyName` is nullable,
- populate only when explicit metadata exists later,
- do not guess agency identity from source or company strings.

---

## Summary Sections

The consolidated snapshot should include summary sections for:

- totals
- by source
- by role track
- by CV version
- by company
- by recruiter
- stage leakage
- overdue follow-ups
- ghosted queue

Recommended dimension metrics:

- total records
- attempt records
- pipeline-only records
- useful roles
- applied attempts
- responded count
- interview count
- offer count
- rejection count
- ghosted count
- follow-up due count
- response rate
- interview rate
- offer rate

### Useful role definition

Recommended v1 rule:

- count as useful when the role reached `shortlisted`, `tracked`, `applied`, `interview`, or `offer`

This allows source and track summaries to reflect whether a role survived initial triage, not just whether an application was sent.

Conversion-metric rules for v1:

- `byCvVersion` should be attempt-only.
- recruiter and company response-rate metrics should use attempt rows only as denominators.
- tracked or shortlisted pipeline-only rows can still appear in source utility and stage-leak summaries.
- pipeline-only rows must not dilute application conversion rates.

---

## Storage and API Shape

### Storage method

Recommended implementation approach:

- use `writeObject` for the snapshot,
- use `readObject` for the latest snapshot,
- add a stable storage key constant during implementation.

### API surface

Recommended route:

```text
src/app/api/applications/outcomes/route.ts
```

Recommended methods:

- `GET` latest stored snapshot
- `POST` recompute and return fresh snapshot

### Why API first

API first gives:

- an easy manual trigger,
- one place for future worker reuse,
- a clean contract for a later Career dashboard panel.

---

## Worker Strategy

Recommended v1 direction:

- manual first,
- worker optional and disabled by default if added.

If a worker task is later added, suggested ID:

```text
application-outcomes-etl
```

The worker must call the same domain ETL function as the API.

---

## UI Strategy

Recommended first UI home:

- Career dashboard

Potential future panel contents:

- source conversion table,
- CV version performance summary,
- company and recruiter leaderboard,
- follow-up due queue,
- ghosted queue,
- stage-leak strip.

Settings is less natural because these insights are operational career decisions, not system configuration.

---

## Privacy and Safety Boundaries

The ETL must remain inside these boundaries:

- no `.env.local` access,
- no external analytics,
- no Gmail token inspection,
- no raw recruiter message-body parsing,
- no application or email sending,
- no mutation of source records,
- no direct writes outside the storage facade.

AI telemetry and source health may later be joined as optional diagnostic overlays, but they are not required for v1 and should not expand the privacy surface by default.

---

## Testing Strategy

The eventual implementation should test:

- collapsing multiple logs into one outcome record,
- joining logs to jobs by `dedupeKey`,
- `unknown` CV bucketing,
- response detection from current pipeline state,
- follow-up due at day 8,
- second follow-up due at day 18,
- ghosted at day 21,
- safe handling of missing recruiter metadata,
- stage-leak summary math,
- read-only behaviour with no source mutation.

Tests should not require:

- `.env.local`,
- Gmail access,
- live Supabase,
- AI provider credentials.

---

## Risks and Mitigations

### Risk 1: Current data lacks full status history

Impact:

- true time-to-stage analytics may be incomplete.

Mitigation:

- be explicit that v1 is snapshot-based,
- keep `stageChangedAt` and log timestamps separate,
- avoid pretending to know event sequences that are not stored.

### Risk 2: CV attribution is incomplete

Impact:

- some CV analytics may be noisy.

Mitigation:

- use deterministic attribution only,
- keep an `unknown` bucket,
- never infer from free text.

### Risk 3: Recruiter analytics may be sparse

Impact:

- recruiter tables may be incomplete early on.

Mitigation:

- treat recruiter analytics as opportunistic,
- keep company and source metrics as stronger v1 signals.

### Risk 4: Old stale data may dominate

Impact:

- all-time metrics may hide current behaviour.

Mitigation:

- include all-time records,
- but add recent-window summaries in the same snapshot.

---

## Open Implementation Questions

1. Should v1 store only the latest snapshot, or also keep ETL history snapshots for trend analysis?
2. Should recent-window summaries use 90 days, 180 days, or both?
3. Should a future implementation add a dedicated `application-status-events` collection to improve stage-transition accuracy?
4. Should archived-but-never-applied roles be counted in stage leakage, or only in pipeline utility summaries?
5. Should recruiter summaries hide rows below a minimum sample threshold in the UI?
6. Should `matchScore` remain `null` in v1, or be aliased to `fitScore` for display simplicity?

---

## Recommended Implementation Sequence

1. Define the ETL output types and storage key.
2. Build the read-only domain ETL module that reads logs, jobs, CV library, and company metadata.
3. Build attempt rows from application logs and fallback pipeline-only rows for tracked or shortlisted jobs with no attempts.
4. Implement derived fields for response, follow-up, ghosted, and CV attribution.
5. Implement grouped summaries for source, role track, CV, company, recruiter, and stage leakage.
6. Persist one canonical snapshot through the storage facade.
7. Add a manual API route with `GET` and `POST`.
8. Add tests for joins, heuristics, and read-only guarantees.
9. Run lint, typecheck, tests, and build.
10. Add a Career dashboard surface later, after the snapshot contract is stable.
