# Implementation Plan: CV Version Response Tracking

Feature folder: `features/cv-version-response-tracking/`

---

## Technical Direction

Implement CV Version Response Tracking as a derived layer on top of Application Outcome ETL.

It should:

- consume the existing `application-outcomes` snapshot,
- compute CV-level summaries from real attempt rows only,
- embed those CV performance summaries back into the same local snapshot,
- and expose the result through the existing outcomes surfaces.

This is not a separate analytics engine.

---

## Why Embedding Into Outcomes Is Correct

The feature is specifically about interpreting the existing outcomes evidence.

Compared with creating a separate `cv-version-performance.json`, embedding into the outcomes snapshot is better because it:

- keeps one source of truth,
- avoids summary drift,
- preserves atomic recomputation,
- reduces storage complexity,
- and keeps UI reads simple.

Recommended v1 direction:

- extend `ApplicationOutcomeSnapshot.summaries` with one or more CV performance sections.

---

## Likely Implementation Files

### Planning files

```text
features/cv-version-response-tracking/spec.md
features/cv-version-response-tracking/plan.md
features/cv-version-response-tracking/tasks.md
```

### Likely implementation files

```text
src/lib/applications/outcomes.ts
src/lib/applications/outcomes.test.ts
src/types/index.ts
src/features/career/cv-version-performance-panel.tsx
src/features/career/career-dashboard.tsx
```

Possible route changes are optional only if the existing outcomes route already returns the expanded snapshot cleanly.

---

## Data Model Direction

Recommended additions inside the outcomes snapshot:

```ts
interface CvVersionPerformanceEntry {
  cvVersion: string;
  scope: "global" | "track" | "source";
  scopeKey: string;
  scopeLabel: string;
  attemptCount: number;
  responseCount: number;
  responseRate: number | null;
  interviewCount: number;
  interviewRate: number | null;
  rejectionCount: number;
  offerCount: number;
  ghostedCount: number;
  followUpDueCount: number;
  averageDaysToResponse: number | null;
  lastUsedAt: string | null;
  confidenceLevel: "insufficient_sample" | "directional" | "stronger_signal";
  sampleSizeWarning: string | null;
  recommendation: string | null;
}
```

Recommended snapshot sections:

- `cvVersionPerformance.global`
- `cvVersionPerformance.byTrack`
- `cvVersionPerformance.bySource`
- `cvVersionPerformance.recommendation`

This structure keeps the output compact while still supporting multiple scopes.

---

## Input Rules

The feature should use:

- `ApplicationOutcomeRecord[]`
- `ApplicationOutcomeSnapshot.summaries` where useful
- existing CV version labels already derived by outcomes ETL

Do not re-read raw logs or jobs through a separate analytics join unless the existing outcomes builder is already in the same execution path.

Preferred implementation approach:

- compute CV performance during the same outcome snapshot build step,
- using the attempt rows that outcomes ETL already produced.

---

## Metric Rules

### Base population

Count only rows where:

- `recordKind === "application_attempt"`

Exclude:

- pipeline-only rows

### Response rule

Use the outcomes ETL response model already established:

- response = interview, offer, or rejected

### Time-to-response

Use `daysToResponse` from outcomes ETL when present.

### Last used date

Use the most recent `applicationDate` within the CV slice.

### Unknown CV version

Keep `unknown` as its own CV bucket.

Do not hide or discard it.

---

## Confidence Model

Recommended thresholds:

- `insufficient_sample`: `0-2` attempts
- `directional`: `3-5` attempts
- `stronger_signal`: `6+` attempts

These thresholds should apply per comparison slice, not just globally.

Examples:

- a CV may be `stronger_signal` globally,
- but only `insufficient_sample` within a specific track.

---

## Recommendation Logic

Recommended v1 approach:

- default to no hard recommendation
- emit recommendation only when one candidate has `stronger_signal`

Suggested rule:

- top CV has `6+` attempts in the current scope
- top CV has at least one response
- top CV has a meaningful lead over the next best comparable CV

Possible lead rule:

- response rate lead `>= 10` percentage points

If these conditions are not met:

- show evidence only,
- or return `recommendation = null` with a sample-size warning.

This avoids fake confidence.

---

## Scope Strategy

Recommended v1 scopes:

### Global

- best all-around CV version

### By track

- CTA / clinical lane
- QA / compliance
- Regulatory
- PV / medinfo if enough data exists

### By source

- which CVs do better on specific source types

Why this scope is enough for v1:

- it answers the most important tactical selection questions,
- it stays inside already-available fields,
- it avoids premature high-dimensional overfitting.

### Company type

Company type should remain tentative unless deterministic category metadata already exists in the input.

Recommended v1 stance:

- do not make company-type performance a primary promised section,
- document it as a later extension once category mapping is reliable.

---

## UI Strategy

Recommended v1 UI home:

- Career dashboard

Potential component:

```text
src/features/career/cv-version-performance-panel.tsx
```

Recommended panel contents:

- top CV version when signal is strong enough
- CV versions with insufficient sample
- CV versions with zero response so far
- track-specific CV performance
- source-specific CV performance highlights
- clear warnings when data is weak

Avoid:

- giant matrices
- deep historical drilldowns
- “winner” language when evidence is weak.

---

## API Strategy

No separate route is required in v1 if:

- the existing outcomes route already returns the expanded snapshot cleanly.

That keeps the surface area small.

---

## Testing Strategy

Required tests should cover:

- only attempt rows contribute to CV metrics,
- unknown CV stays visible,
- sample-size bucket assignment,
- global CV performance summary,
- track-specific summary,
- source-specific summary,
- recommendation suppressed when evidence is weak,
- recommendation present only when evidence is strong,
- no mutation of source outcome records.

Tests should not require:

- `.env.local`
- Gmail
- AI providers
- external services.

---

## Risks and Mitigations

### Risk 1: Overclaiming weak signal

Mitigation:

- enforce explicit confidence buckets,
- suppress recommendation when evidence is weak.

### Risk 2: Duplicate analytics logic

Mitigation:

- compute inside the outcomes snapshot builder,
- avoid a second storage file.

### Risk 3: Misleading company-type analysis

Mitigation:

- defer strong company-type views until deterministic category data exists.

---

## Recommended Implementation Sequence

1. Extend outcome snapshot types with CV performance sections.
2. Compute CV performance from attempt rows inside the outcomes builder.
3. Add confidence bucketing and sample-size warnings.
4. Add recommendation logic with conservative gating.
5. Extend outcomes tests.
6. Add compact Career panel.
7. Run lint, typecheck, tests, and build.
