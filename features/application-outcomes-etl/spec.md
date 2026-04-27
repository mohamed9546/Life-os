# Feature Spec: Application Outcome ETL

Feature folder: `features/application-outcomes-etl/`

---

## Summary

Build a local-first Application Outcome ETL layer for Life-OS.

The feature should join application logs, ranked and tracked job records, CV choices, source metadata, role-track classification, company and recruiter context, and current pipeline state into a local analytics snapshot that shows what is actually converting.

This feature should turn the career pipeline from a job collector into a learning system.

---

## Strategic Rationale

Life-OS already does several parts of the career workflow well:

- it collects jobs,
- it enriches and ranks them,
- it creates review-only application drafts,
- it tracks some follow-up and outcome state,
- and it stores all of that locally.

What it does not yet do well enough is learn from its own history.

Without a dedicated outcome ETL layer, the system cannot answer operational questions such as:

- which sources surface useful roles,
- which tracks lead to real responses,
- which CV versions perform best,
- which companies deserve more attention,
- which recruiters reply,
- which role families repeatedly waste time,
- which stages leak,
- and which applications need follow-up now.

Application Outcome ETL is the learning layer that should sit on top of the existing pipeline without changing ranking, application sending, or source records.

---

## Goals

1. Build a read-only ETL pipeline over existing local application and job data.
2. Produce a local analytics snapshot that can answer source, track, CV, company, recruiter, and stage questions.
3. Preserve local-first behaviour and use the storage facade only.
4. Avoid mutating application logs, ranked jobs, or tracked jobs during ETL.
5. Support manual runs first.
6. Reuse existing follow-up and ghosting heuristics where possible.
7. Keep v1 deterministic and non-AI by default.
8. Make overdue follow-up and stalled-stage patterns visible.
9. Keep output private and local only.
10. Add no external analytics provider.

---

## Non-Goals

This feature does not:

- send analytics anywhere,
- add cloud analytics,
- add Sentry, PostHog, LangSmith, Langfuse, or any third-party telemetry product,
- auto-send applications,
- auto-send recruiter emails,
- change job ranking logic,
- auto-change application statuses,
- rewrite historical application logs,
- scrape Gmail directly in v1,
- require AI in v1,
- replace existing application ops views,
- replace the storage facade.

---

## Users

Primary user:

- Mohamed, operating Life-OS as a CTA-first career transition system.

Secondary users:

- Maintainers and agents trying to understand which parts of the application pipeline are working.

---

## User Stories

### Story 1: Learn which sources and tracks are worth time

As the user, I want to see which sources and role tracks produce useful roles and actual responses so I can stop wasting effort on weak channels.

Acceptance criteria:

- The system can group outcomes by source.
- The system can group outcomes by role track.
- The system can distinguish useful pipeline progression from dead-end traffic.

### Story 2: Learn which CVs and companies convert

As the user, I want to see which CV versions and which companies correlate with better outcomes so I can refine where I apply and which CV I use.

Acceptance criteria:

- The system can bucket outcomes by CV version.
- The system can bucket outcomes by company.
- Missing CV attribution is allowed and grouped safely as `unknown`.

### Story 3: See recruiter and follow-up patterns

As the user, I want to see which recruiters or contacts respond and which applications are overdue for follow-up so I can prioritise action.

Acceptance criteria:

- The system derives follow-up due state locally.
- The system derives likely ghosted state locally.
- Recruiter-level summaries are only produced when contact metadata exists.

### Story 4: Run a safe local ETL refresh

As the operator, I want to run the ETL manually and store the resulting snapshot locally so I can inspect current outcomes without changing source records.

Acceptance criteria:

- A manual run path exists.
- Output is written locally.
- ETL is read-only with respect to source job and application records.

---

## Inputs

The ETL should consider these existing local inputs:

- `application-logs`
- job state collections surfaced through job storage helpers
- ranked jobs
- inbox jobs
- tracked jobs
- rejected jobs
- enriched jobs where needed for metadata completion
- CV library entries
- target companies
- company intelligence if already attached to jobs
- decision-maker or recruiter metadata if already attached to jobs
- follow-up metadata already stored on jobs
- source health only as optional future context
- AI telemetry only as optional future diagnostic context

The ETL must not inspect secrets and must not depend on Gmail token contents or `.env.local`.

---

## Planning Questions and Chosen Answers

### 1. One consolidated file or several derived summary files?

Chosen v1 direction:

- one consolidated snapshot file

Why:

- avoids drift between multiple derived files,
- keeps writes atomic,
- makes GET and UI loading simpler,
- still allows multiple summary sections inside one object.

### 2. Which application statuses exist today?

Chosen v1 direction:

- preserve both existing vocabularies

Current attempt-log statuses:

- `planned`
- `drafted`
- `applied`
- `paused`
- `skipped`
- `failed`

Current pipeline or job statuses:

- `inbox`
- `shortlisted`
- `tracked`
- `applied`
- `interview`
- `offer`
- `rejected`
- `archived`

Why:

- both vocabularies exist already,
- collapsing them too early would lose signal,
- the ETL should derive a normalized view while retaining raw fields.

### 3. How should `response` be defined?

Chosen v1 direction:

- a response is any recorded employer-side outcome that moves a job into `interview`, `offer`, or `rejected`

Why:

- that is deterministic from current data,
- it avoids guessing from Gmail or free-text notes,
- rejection still counts as a response because silence and explicit rejection are different operational outcomes.

### 4. How should `ghosted` be defined?

Chosen v1 direction:

- keep the current local heuristic: likely ghosted when an actionable application has no recorded response after 21 days

Supporting v1 thresholds:

- first follow-up due at day 8
- second follow-up due at day 18
- likely ghosted at day 21

Why:

- this matches the existing application ops view,
- it keeps ETL and ops dashboards consistent.

### 5. Should unknown CV version be allowed?

Chosen v1 direction:

- yes

Why:

- existing logs may not always contain structured CV attribution,
- dropping records would bias analytics,
- `unknown` is safer than guessing.

### 6. Separate recruiter and company outputs, or one summary?

Chosen v1 direction:

- one consolidated snapshot with separate summary sections

Why:

- keeps one canonical output,
- still allows UI or downstream views to focus on recruiter or company slices independently.

### 7. Manual run, worker, or both?

Chosen v1 direction:

- manual run first, worker path optional and planned for reuse later

Why:

- easiest to verify,
- lowest operational risk,
- still compatible with a later worker task that reuses the same domain function.

### 8. First UI surface: Career, Automation, or Settings?

Chosen v1 direction:

- Career dashboard first, after API and summary exist

Why:

- the insights are career-facing,
- the current career page already exposes application ops and pipeline state,
- Settings is less natural for funnel learning.

### 9. Should old or stale jobs be included?

Chosen v1 direction:

- yes for all-time learning, but summaries should support recent windows as well

Why:

- historical applications contain the learning signal,
- stale rows should not dominate day-to-day views,
- a single snapshot can carry both all-time and recent-window summaries.

### 10. Should ETL read Gmail directly in v1?

Chosen v1 direction:

- no

Why:

- existing local application logs and job states are sufficient for a useful v1,
- direct Gmail inference adds privacy and reliability complexity,
- the constitution already requires review-first and local-first discipline.

---

## Functional Requirements

### FR-1: Read-Only ETL

The ETL must be read-only with respect to source records.

It must not:

- modify application logs,
- modify existing job statuses,
- modify ranked jobs,
- modify tracked jobs,
- auto-create recruiter outreach,
- auto-send applications or emails.

### FR-2: Local-First Storage Only

The ETL must write output through:

```text
src/lib/storage/index.ts
```

Recommended logical key:

```text
application-outcomes
```

Recommended local file:

```text
data/application-outcomes.json
```

### FR-3: One Canonical Snapshot

V1 should produce one canonical snapshot object containing:

- metadata about the ETL run,
- row-level outcome records,
- aggregated summary sections,
- overdue follow-up views,
- stage-leak and conversion summaries.

### FR-4: Canonical Record Grain

The ETL should not use `dedupeKey` as the universal primary record grain.

Recommended v1 entity grain:

- one row per application attempt when an application attempt exists,
- fallback to one row per job `dedupeKey` only for non-applied tracked or shortlisted jobs with no application attempt,
- retain `dedupeKey` as the job-level join key,
- keep `jobId` when available.

Recommended v1 record identity:

- `recordId = applicationAttemptId` when available
- `recordId = jobDedupeKey` only when no application attempt exists

This avoids corrupting CV, recruiter, company, and response-rate analytics by collapsing multiple attempts into one job-level row.

### FR-5: Preserve Both Status Layers

Each outcome record should retain:

- `pipelineStatus`
- `latestAttemptStatus`
- derived `currentStatus`

The ETL must not pretend the app has a richer event history than it currently stores.

### FR-6: Outcome Record Fields

Each derived outcome record should support at minimum:

```text
applicationId
jobId
source
company
roleTitle
roleTrack
cvVersion
applicationDate
currentStatus
latestStatusDate
responseReceived
responseDate
interviewReceived
rejectionReceived
offerReceived
ghosted
daysSinceApplication
daysToResponse
followUpDue
recruiterName
agencyName
location
remoteType
salaryText
fitScore
matchScore
notes
```

Notes for v1:

- `matchScore` may remain `null` unless a distinct deterministic metric already exists.
- `agencyName` may remain `null` unless explicit metadata exists.
- additional diagnostic fields may be included if they are deterministic and privacy-safe.

### FR-7: Response and Follow-Up Heuristics

The ETL must derive:

- `responseReceived`
- `responseDate`
- `followUpDue`
- `ghosted`

using deterministic rules only.

V1 should align with current app heuristics:

- follow-up first due at day 8,
- follow-up second due at day 18,
- likely ghosted at day 21 when there is no recorded response.

### FR-8: CV Attribution

The ETL should attribute CV version using existing local data in this order when practical:

1. `selectedCvId`
2. selected or tailored CV path
3. CV library lookup
4. `unknown`

The ETL must not guess a CV version from free text.

CV-version performance summaries must only include records with real application attempts.

### FR-9: Recruiter and Company Attribution

The ETL should use existing attached metadata only:

- `companyIntel`
- `decisionMakers`
- `outreachStrategy`

If recruiter metadata is missing, recruiter metrics should remain sparse rather than invented.

Recruiter and company response-rate summaries must distinguish applied attempts from merely tracked or shortlisted jobs.

### FR-10: Summary Dimensions

The canonical snapshot should support grouped summaries at minimum for:

- source
- role track
- CV version
- company
- recruiter when present
- current status
- follow-up due state

Conversion-metric rules for v1:

- CV version summaries must use attempt rows only.
- Recruiter and company response-rate denominators must use real application attempts only.
- Non-applied tracked or shortlisted job rows may appear in utility summaries, source utility summaries, and stage-leak views.
- Non-applied tracked or shortlisted job rows must not dilute application conversion metrics.

### FR-11: Stage Leakage View

The ETL should produce a stage-leak summary that helps answer:

- where roles stall before apply,
- where applications stall after apply,
- where response rates are weakest,
- where interviews do or do not convert.

V1 may use current-state approximation rather than full event history.

Non-applied tracked or shortlisted rows may appear here because they help explain pre-application leakage.

### FR-12: Manual Run Path

V1 should support a manual refresh path.

Recommended future interface:

- `GET` latest snapshot
- `POST` recompute snapshot

### FR-13: Worker Reuse Path

If a worker task is added later, it must call the same domain ETL function used by the manual API path.

### FR-14: No AI Required in v1

This feature should not require AI in v1.

AI telemetry may later be used as optional diagnostic context, but it is not part of the core outcome model.

### FR-15: Privacy and Safety

The ETL must not:

- send analytics externally,
- expose `.env.local`,
- read or expose Gmail token contents,
- expose OAuth secrets,
- write plaintext data into `private/`,
- infer sensitive recruiter content from message bodies.

### FR-16: Tests Required

The eventual implementation must include tests for:

- joining logs and jobs correctly,
- unknown CV handling,
- response and ghosting heuristics,
- forbidden mutation of source records,
- grouped summary correctness,
- stale or missing metadata handling.

---

## Data Model

```ts
export interface ApplicationOutcomeRecord {
  recordId: string;
  applicationAttemptId: string | null;
  rowKind: "attempt" | "pipeline-only";
  dedupeKey: string;
  jobId: string | null;
  source: string;
  company: string;
  roleTitle: string;
  roleTrack: string | null;
  cvVersion: string;
  pipelineStatus: string | null;
  latestAttemptStatus: string | null;
  currentStatus: string;
  applicationDate: string | null;
  latestStatusDate: string | null;
  responseReceived: boolean;
  responseDate: string | null;
  interviewReceived: boolean;
  rejectionReceived: boolean;
  offerReceived: boolean;
  followUpDue: boolean;
  followUpStage: "first" | "second" | null;
  ghosted: boolean;
  daysSinceApplication: number | null;
  daysSinceLastAction: number | null;
  daysToResponse: number | null;
  recruiterName: string | null;
  agencyName: string | null;
  location: string | null;
  remoteType: string | null;
  salaryText: string | null;
  fitScore: number | null;
  matchScore: number | null;
  notes: string | null;
}

export interface ApplicationOutcomeDimensionSummary {
  key: string;
  label: string;
  total: number;
  attemptRecords: number;
  pipelineOnlyRecords: number;
  usefulRoles: number;
  appliedAttempts: number;
  responded: number;
  interviews: number;
  offers: number;
  rejections: number;
  ghosted: number;
  followUpDue: number;
  responseRate: number | null;
  interviewRate: number | null;
  offerRate: number | null;
}

export interface ApplicationOutcomeSnapshot {
  generatedAt: string;
  etlVersion: number;
  thresholds: {
    firstFollowUpDays: number;
    secondFollowUpDays: number;
    ghostedDays: number;
  };
  records: ApplicationOutcomeRecord[];
  summaries: {
    totals: Record<string, number>;
    bySource: ApplicationOutcomeDimensionSummary[];
    byRoleTrack: ApplicationOutcomeDimensionSummary[];
    byCvVersion: ApplicationOutcomeDimensionSummary[];
    byCompany: ApplicationOutcomeDimensionSummary[];
    byRecruiter: ApplicationOutcomeDimensionSummary[];
    stageLeakage: Array<Record<string, unknown>>;
    overdueFollowUps: ApplicationOutcomeRecord[];
  };
}
```

---

## Success Criteria

The feature succeeds when:

- a manual local ETL run can produce an outcomes snapshot,
- the snapshot is written locally through the storage facade,
- no source job or application record is mutated by ETL,
- the user can see grouped outcomes by source, track, CV, company, and recruiter when present,
- multiple application attempts for the same `dedupeKey` are not silently collapsed into one universal row,
- follow-up due and ghosted applications are derived deterministically,
- the system can answer which channels and CVs are converting better,
- the feature remains local-first and private.
