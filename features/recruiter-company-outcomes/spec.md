# Feature Spec: Recruiter / Company Outcome Tracking

Feature folder: `features/recruiter-company-outcomes/`

---

## Summary

Build a local-first Recruiter / Company Outcome Tracking layer for Life-OS.

This feature should extend Application Outcome ETL so the system can show which companies, recruiters, agencies, and source-company combinations are actually producing responses, interviews, or wasted effort.

The feature should help answer:

- which companies reply,
- which companies ghost,
- which recruiters reply,
- which agencies generate interviews,
- which agencies waste time,
- which source/company combinations produce useful roles,
- and which contacts are worth following up with.

---

## Strategic Rationale

Life-OS now has:

- Application Outcome ETL,
- CV Version Response Tracking,
- and a clearer read-only outcome snapshot.

That means the system can already say:

- which attempts exist,
- which attempts got responses,
- which CV versions appear stronger,
- and where ghosting or follow-up pressure exists.

What it still cannot show clearly is whether specific companies, recruiters, or agencies are worth more attention.

Recruiter / Company Outcome Tracking should extend the same outcomes snapshot so company and recruiter evidence becomes visible without creating another analytics pipeline.

---

## Goals

1. Build on `application-outcomes` as the source of truth.
2. Measure company, recruiter, agency, and source-company outcome performance using real application attempts.
3. Keep pipeline-only rows visible only for utility/leakage-style metrics where useful.
4. Keep all analysis local-first and read-only.
5. Avoid overclaiming results from tiny sample sizes.
6. Provide conservative action guidance such as `prioritise_follow_up`, `watch`, or `avoid_for_now` only when justified.
7. Add no external analytics or AI dependencies in v1.

---

## Non-Goals

This feature does not:

- create a second independent analytics pipeline,
- send analytics externally,
- add cloud analytics,
- call AI providers,
- read Gmail directly,
- scrape LinkedIn or external sources,
- generate outreach messages,
- mutate source application logs,
- mutate job records,
- change job ranking,
- change application statuses automatically,
- auto-send emails.

---

## Users

Primary user:

- Mohamed, using Life-OS to understand which employers, recruiters, and agencies are worth more energy.

Secondary users:

- maintainers and agents evaluating whether recruiter/company signals are strong enough to guide next actions.

---

## User Stories

### Story 1: See which companies respond

As the user, I want to know which companies produce responses or interviews so I can focus attention where effort is more likely to matter.

Acceptance criteria:

- company-level response metrics exist,
- company-level ghosting is visible,
- weak sample sizes are flagged.

### Story 2: See which recruiters or agencies are useful

As the user, I want to know which recruiters and agencies are associated with interviews or wasted effort so I can decide who deserves follow-up.

Acceptance criteria:

- recruiter-level metrics exist when recruiter metadata exists,
- agency-level metrics exist when agency metadata exists,
- unknown values remain visible rather than disappearing.

### Story 3: Keep evidence conservative

As the user, I want recommendations to remain cautious so the system does not overreact to one or two outcomes.

Acceptance criteria:

- confidence buckets exist,
- sample-size warnings exist,
- action guidance stays conservative.

### Story 4: Reuse outcomes ETL only

As the operator, I want recruiter/company tracking to derive from the existing outcomes snapshot so analytics stay coherent and local.

Acceptance criteria:

- `application-outcomes` remains the source of truth,
- no duplicate analytics pipeline is introduced,
- no additional storage file is required by default.

---

## Inputs

The feature should use:

- `application-outcomes` snapshot
- company field
- recruiterName field
- agencyName field
- source field
- roleTrack
- response/outcome fields
- follow-up and ghosting fields

It must not inspect secrets, Gmail, or external systems.

---

## Planning Questions and Chosen Answers

### 1. Should company/recruiter performance be embedded into `application-outcomes` or stored separately?

Chosen v1 direction:

- embed into `application-outcomes`

Why:

- this feature must use outcomes ETL as the source of truth,
- embedding avoids drift between files,
- it keeps local recomputation atomic,
- and avoids introducing another analytics artifact.

### 2. What counts as a recruiter response in v1?

Chosen v1 direction:

- use the same deterministic response rule already used in outcomes ETL:
  - `interview`,
  - `offer`,
  - or `rejected`

Why:

- the feature should not invent a second response definition,
- and should not depend on Gmail thread inspection.

### 3. How should unknown recruiter/company values be handled?

Chosen v1 direction:

- keep them visible as `unknown`

Why:

- hiding missing attribution would bias the metrics,
- and the user needs to see where data quality is weak.

### 4. Should agency performance and recruiter performance be separate?

Chosen v1 direction:

- yes

Why:

- agencies and named recruiters answer different questions,
- and some records may have one but not the other.

### 5. Should source/company combinations be included in v1?

Chosen v1 direction:

- yes, in a compact way

Why:

- source/company combinations directly answer which channels surface useful companies,
- and can be built from already-available fields.

### 6. What sample size threshold is required before recommending action?

Chosen v1 direction:

- use the same confidence buckets:
  - `insufficient_sample`: `0-2`
  - `directional`: `3-5`
  - `stronger_signal`: `6+`
- only allow stronger action guidance when the slice is `stronger_signal`

### 7. Should this feature produce recommendations or only evidence?

Chosen v1 direction:

- produce conservative evidence-first action guidance

Allowed examples:

- `prioritise_follow_up`
- `watch`
- `low_signal`
- `avoid_for_now`
- `insufficient_data`

Why:

- the user wants something more actionable than raw counts,
- but the guidance must stay bounded and conservative.

### 8. Should the first UI panel live inside the existing Application Outcomes panel or as a separate Career panel?

Chosen v1 direction:

- inside the existing Application Outcomes panel first

Why:

- this remains part of the same outcome-learning surface,
- avoids panel sprawl,
- and keeps the first experience compact.

### 9. What tests are required?

Chosen v1 direction:

- attempt vs pipeline-only distinction
- unknown bucket handling
- company/recruiter/agency grouping
- source-company grouping
- confidence buckets and sample-size warnings
- recommendation suppression on weak evidence
- no mutation of source outcome records.

---

## Functional Requirements

### FR-1: `application-outcomes` is the source of truth

Recruiter / Company Outcome Tracking must derive from `application-outcomes`.

It must not build a separate independent analytics pipeline.

### FR-2: Attempt-only conversion metrics

Only real application-attempt rows may affect response, interview, rejection, and offer rates for:

- companies,
- recruiters,
- agencies,
- and source-company combinations.

### FR-3: Pipeline-only rows must not dilute response rates

Tracked or shortlisted pipeline-only rows may contribute to utility or useful-role counts where explicitly appropriate, but must not dilute attempt-based conversion metrics.

### FR-4: Unknown values remain visible

Unknown recruiter, agency, or company values must remain visible in the output as `unknown`.

### FR-5: Embedded storage

V1 should embed the following sections into the outcomes snapshot when clean:

- `companyPerformance`
- `recruiterPerformance`
- `agencyPerformance`
- `sourceCompanyPerformance`

### FR-6: Metrics to compute

Each performance slice should support, at minimum:

- `companyName`
- `recruiterName`
- `agencyName`
- `source`
- `roleTrack`
- `attemptCount`
- `pipelineOnlyCount`
- `responseCount`
- `responseRate`
- `interviewCount`
- `interviewRate`
- `rejectionCount`
- `offerCount`
- `ghostedCount`
- `followUpDueCount`
- `usefulRoles`
- `averageDaysToResponse`
- `lastInteractionAt`
- `confidenceLevel`
- `sampleSizeWarning`
- `recommendedAction`

### FR-7: Confidence buckets required

Each slice must carry one of:

- `insufficient_sample`
- `directional`
- `stronger_signal`

### FR-8: Recommendation gating

Action guidance must remain conservative.

Use `stronger_signal` as the floor for stronger recommendations.

### FR-9: First UI home

The first UI surface should live inside the existing Application Outcomes panel on the Career dashboard.

### FR-10: No outreach or identity inference in v1

The feature must not:

- infer recruiter identity from Gmail,
- scrape LinkedIn,
- generate outreach,
- or auto-send messages.

---

## Recommendation Model

Allowed conservative recommendation states:

- `prioritise_follow_up`
- `watch`
- `low_signal`
- `avoid_for_now`
- `insufficient_data`

Recommended interpretation:

- `prioritise_follow_up`: stronger-signal positive slice with follow-up relevance
- `watch`: directional or mixed evidence worth monitoring
- `low_signal`: minimal observed value but not enough evidence to avoid strongly
- `avoid_for_now`: stronger-signal negative slice such as repeated ghosting or zero responses across enough attempts
- `insufficient_data`: sample too small to trust

V1 should prefer `watch` or `insufficient_data` over aggressive labels unless evidence is strong.

---

## Success Criteria

The feature succeeds when:

- company and recruiter outcome evidence is visible from the existing outcomes snapshot,
- weak sample sizes are clearly marked,
- pipeline-only rows do not distort response-rate metrics,
- recommendations remain conservative,
- and the feature stays local-first and read-only.
