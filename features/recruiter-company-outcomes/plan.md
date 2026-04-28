# Implementation Plan: Recruiter / Company Outcome Tracking

Feature folder: `features/recruiter-company-outcomes/`

---

## Technical Direction

Implement Recruiter / Company Outcome Tracking as an embedded extension of Application Outcome ETL.

It should:

- consume the existing outcomes snapshot,
- compute company, recruiter, agency, and source-company summaries from it,
- embed those summaries back into the same snapshot,
- and expose the result inside the existing Career outcomes surface.

This is not a separate analytics engine.

---

## Why Embedding Into Outcomes Is Correct

The user asked for recruiter/company outcome visibility, not a second local analytics subsystem.

Embedding into the existing outcomes snapshot is better than a new file because it:

- keeps one source of truth,
- avoids drift between snapshots,
- keeps recomputation atomic,
- and keeps the UI contract simpler.

Recommended v1 direction:

- extend `ApplicationOutcomeSnapshot.summaries` with recruiter/company performance sections.

---

## Likely Implementation Files

### Planning files

```text
features/recruiter-company-outcomes/spec.md
features/recruiter-company-outcomes/plan.md
features/recruiter-company-outcomes/tasks.md
```

### Likely implementation files

```text
src/lib/applications/outcomes.ts
src/lib/applications/outcomes.test.ts
src/types/index.ts
src/features/career/application-outcomes-panel.tsx
src/features/career/career-dashboard.tsx
```

No new route should be required if the existing outcomes route already returns the expanded snapshot.

---

## Data Model Direction

Recommended additions inside the outcomes snapshot:

```ts
interface CompanyPerformanceEntry {
  companyName: string;
  roleTrack: string | null;
  attemptCount: number;
  pipelineOnlyCount: number;
  responseCount: number;
  responseRate: number | null;
  interviewCount: number;
  interviewRate: number | null;
  rejectionCount: number;
  offerCount: number;
  ghostedCount: number;
  followUpDueCount: number;
  usefulRoles: number;
  averageDaysToResponse: number | null;
  lastInteractionAt: string | null;
  confidenceLevel: "insufficient_sample" | "directional" | "stronger_signal";
  sampleSizeWarning: string | null;
  recommendedAction: string;
}
```

Parallel slices should exist for:

- company
- recruiter
- agency
- source + company

Recommended output sections:

- `companyPerformance`
- `recruiterPerformance`
- `agencyPerformance`
- `sourceCompanyPerformance`

---

## Input Rules

Use the existing `ApplicationOutcomeRecord[]` and embedded outcomes summary context.

Do not re-read raw job or log sources through a separate join path unless the existing outcomes builder already has them in scope during snapshot recomputation.

Preferred implementation approach:

- compute recruiter/company summaries inside the same outcomes builder step.

---

## Metric Rules

### Base population

For conversion rates, count only rows where:

- `recordKind === "application_attempt"`

### Pipeline-only handling

Pipeline-only rows may contribute to:

- `pipelineOnlyCount`
- `usefulRoles` only when the existing outcomes semantics already allow it

Pipeline-only rows must not contribute to:

- `responseRate`
- `interviewRate`
- `rejectionCount`
- `offerCount`

### Response rule

Reuse the existing outcomes ETL response rule:

- `interview`
- `offer`
- `rejected`

### Time-to-response

Use `daysToResponse` from outcomes ETL when available.

### Last interaction date

Use the most recent `latestStatusDate` or `applicationDate` in the slice.

### Unknown values

Keep unknown company, recruiter, or agency as visible buckets.

---

## Confidence Model

Reuse the same confidence thresholds:

- `insufficient_sample`: `0-2` attempts
- `directional`: `3-5` attempts
- `stronger_signal`: `6+` attempts

This keeps recruiter/company evidence aligned with CV evidence.

---

## Recommendation Logic

Recommended v1 approach:

- default to conservative evidence-first guidance
- prefer neutral guidance unless signal is strong

Suggested mapping:

- `insufficient_data`: sample below 3 attempts
- `watch`: directional evidence, mixed signal, or moderate follow-up pressure
- `low_signal`: little response evidence but not enough attempts to avoid strongly
- `prioritise_follow_up`: meaningful positive evidence plus active follow-up opportunity
- `avoid_for_now`: stronger-signal negative slice, such as repeated ghosting or zero response across enough attempts

V1 should avoid aggressive negative labels unless evidence reaches `stronger_signal`.

---

## Scope Strategy

Recommended v1 dimensions:

### Company performance

- all attempts grouped by company

### Recruiter performance

- grouped by `recruiterName`
- only when recruiter metadata exists

### Agency performance

- grouped by `agencyName`
- likely sparse in v1

### Source-company performance

- grouped by source + company pair

Why include source-company now:

- it directly answers which channel/company combinations surface valuable roles,
- it is already derivable from existing fields,
- it remains smaller than a general relationship graph.

---

## UI Strategy

Recommended v1 UI home:

- inside the existing `ApplicationOutcomesPanel`

Why:

- this is still part of the same outcomes evidence layer,
- it keeps the Career dashboard compact,
- and avoids another standalone Career card too early.

Recommended visible sections:

- best responding companies
- companies with repeated ghosting
- recruiters/agencies with responses when enough data exists
- follow-ups due by company or recruiter
- low-sample warnings
- recent company or recruiter outcome highlights

Avoid:

- giant tables
- full graph/network views
- outreach action generation.

---

## API Strategy

No new route is needed in v1 if the existing outcomes route returns the expanded snapshot.

That keeps the surface area small and consistent.

---

## Testing Strategy

Required tests should cover:

- attempt-only conversion metrics,
- pipeline-only exclusion from rate denominators,
- unknown company/recruiter/agency buckets,
- company grouping,
- recruiter grouping,
- agency grouping,
- source-company grouping,
- confidence buckets,
- recommendation suppression on weak evidence,
- no mutation of source outcome records.

Tests should not require:

- `.env.local`
- Gmail
- AI providers
- external services.

---

## Risks and Mitigations

### Risk 1: Sparse recruiter or agency data

Mitigation:

- keep unknown buckets visible,
- prefer warnings over strong conclusions.

### Risk 2: Overclaiming company quality from tiny samples

Mitigation:

- enforce confidence buckets,
- suppress stronger recommendations below 6 attempts.

### Risk 3: Scope sprawl into contact graph logic

Mitigation:

- keep only grouped summaries,
- explicitly defer relationship graph work.

---

## Recommended Implementation Sequence

1. Extend outcomes snapshot types with recruiter/company performance sections.
2. Compute company, recruiter, agency, and source-company summaries inside the outcomes builder.
3. Reuse confidence buckets and sample-size warnings.
4. Add conservative recommended-action logic.
5. Extend outcomes tests.
6. Add a compact recruiter/company section to the existing outcomes panel.
7. Run lint, typecheck, tests, and build.
