# Feature Spec: CV Version Response Tracking

Feature folder: `features/cv-version-response-tracking/`

---

## Summary

Build a local-first CV Version Response Tracking layer for Life-OS.

This feature should extend Application Outcome ETL so the system can show which CV versions perform best across application attempts, role tracks, and sources, without inventing a second analytics pipeline.

The feature should help answer:

- which CV version gets the highest response rate,
- which CV version gets interviews,
- which CV version performs best for CTA roles,
- which CV version performs best for QA / RA / PV roles,
- which CV versions have too little data,
- which CV versions never get responses,
- which CV versions should be avoided or retired later,
- and which CV version should be recommended for a new application when the signal is strong enough.

---

## Strategic Rationale

Life-OS now has Application Outcome ETL as a local learning layer.

That means the system can already measure outcome signals such as:

- attempts,
- responses,
- interviews,
- offers,
- ghosting,
- and follow-up pressure.

What it still lacks is CV-specific interpretation of that data.

Without CV Version Response Tracking, the system can say which applications converted, but not which CV versions are helping or hurting those outcomes.

This feature should convert raw outcome evidence into a disciplined CV-performance view while staying conservative about weak sample sizes.

---

## Goals

1. Build on Application Outcome ETL as the single source of truth.
2. Measure CV-version performance using only real application attempts.
3. Keep all analysis local-first and read-only.
4. Warn clearly when sample sizes are too small to trust.
5. Show global, track-specific, and source-specific CV performance where meaningful.
6. Support a cautious “recommended CV for next application” signal only when evidence is strong enough.
7. Add no external analytics and no AI dependency in v1.

---

## Non-Goals

This feature does not:

- create a second independent analytics pipeline,
- send analytics externally,
- add cloud analytics,
- call AI providers,
- read Gmail directly,
- mutate source application logs,
- mutate job records,
- change job ranking,
- auto-send applications or emails,
- change application statuses automatically,
- implement deep CV lineage/version-graph tracking,
- retire CV versions automatically in v1.

---

## Users

Primary user:

- Mohamed, using Life-OS to improve conversion from tracked roles into real responses and interviews.

Secondary users:

- maintainers and agents reviewing whether CV evidence is strong enough to guide recommendations.

---

## User Stories

### Story 1: See which CV versions get responses

As the user, I want to see which CV versions get the best response and interview rates so I can stop guessing which CV to send.

Acceptance criteria:

- response-rate metrics exist per CV version,
- interview-rate metrics exist per CV version,
- only real application attempts count.

### Story 2: See track-specific CV strength

As the user, I want to know which CV version performs best for CTA versus QA/RA/PV tracks so I can match the right CV to the right role family.

Acceptance criteria:

- track-specific CV performance exists,
- unknown CV usage stays visible,
- small sample warnings are explicit.

### Story 3: Avoid overclaiming weak evidence

As the user, I want the system to say when there is not enough evidence so it does not overclaim a winning CV from tiny sample sizes.

Acceptance criteria:

- confidence buckets exist,
- sample-size warnings exist,
- “best CV” is only shown when evidence is strong enough.

### Story 4: Keep CV tracking aligned with outcomes ETL

As the operator, I want CV performance to derive from the outcomes snapshot rather than a second analytics flow so the system stays coherent.

Acceptance criteria:

- Application Outcome ETL remains the source of truth,
- there is no duplicate independent metrics pipeline,
- storage remains local and deterministic.

---

## Inputs

The feature should use:

- `application-outcomes` snapshot data
- CV library metadata
- application outcome records
- role track
- source
- company and recruiter context when already present
- outcome status fields already present in Application Outcome ETL

It must not inspect `.env.local`, Gmail, or secrets.

---

## Planning Questions and Chosen Answers

### 1. Store separately or embed into application-outcomes snapshot?

Chosen v1 direction:

- embed into the existing `application-outcomes` snapshot

Why:

- the feature must use Outcome ETL as the source of truth,
- embedding avoids drift between two local analytics files,
- one snapshot keeps recomputation atomic,
- no second analytics pipeline is needed.

### 2. What sample size is required before calling a CV “best”?

Chosen v1 direction:

- use confidence buckets:
  - `insufficient_sample`: `0-2` attempts
  - `directional`: `3-5` attempts
  - `stronger_signal`: `6+` attempts
- only allow a “best CV” or “recommended CV” label when the candidate is in `stronger_signal`

Why:

- tiny samples should not masquerade as evidence,
- the user still needs directional visibility before large volumes accumulate,
- this keeps the language conservative.

### 3. Should metrics be global, track-specific, source-specific, or all three?

Chosen v1 direction:

- global, track-specific, and source-specific

Why:

- those are directly supported by current outcome fields,
- they answer the core “which CV works where?” question,
- they do not require a second pipeline.

### 4. Should the feature recommend a CV automatically or only show evidence?

Chosen v1 direction:

- show evidence first,
- emit a recommendation only when the signal is `stronger_signal`

Why:

- weak evidence should not drive hard recommendations,
- the user asked for a next-application signal only when justified.

### 5. How should unknown CV versions be handled in the UI?

Chosen v1 direction:

- keep `unknown` visible as its own bucket

Why:

- hidden missing attribution would bias the data,
- the user needs to see where tracking discipline is weak.

### 6. Should retired CVs be supported now or later?

Chosen v1 direction:

- later

Why:

- retirement is a workflow decision, not just a metric,
- v1 should stay read-only and evidence-oriented.

### 7. Manual-run only or update whenever Outcome ETL runs?

Chosen v1 direction:

- update whenever Application Outcome ETL runs

Why:

- CV performance is derived directly from outcomes,
- it should stay in sync with the source snapshot,
- this avoids adding a second trigger path.

### 8. What tests are required?

Chosen v1 direction:

- attempt-only inclusion
- unknown bucket handling
- sample-size confidence bucketing
- global, track, and source CV summaries
- recommendation suppression on weak evidence
- recommendation presence on strong evidence
- no mutation of outcome source records

---

## Functional Requirements

### FR-1: Outcome ETL is the source of truth

CV Version Response Tracking must derive from Application Outcome ETL.

It must not create a second unrelated analytics pipeline.

### FR-2: Attempt-only metrics

Only real application-attempt rows may count toward CV conversion metrics.

Pipeline-only rows must not affect CV response, interview, rejection, or offer rates.

### FR-3: Unknown CV bucket retained

Unknown CV versions must remain bucketed as `unknown` and must stay visible in summaries.

### FR-4: Embedded storage

V1 should store CV performance summaries inside the `application-outcomes` snapshot, rather than writing a separate `cv-version-performance` file.

### FR-5: Metrics to compute

The feature should compute, at minimum:

- `cvVersion`
- `track`
- `source`
- `attemptCount`
- `responseCount`
- `responseRate`
- `interviewCount`
- `interviewRate`
- `rejectionCount`
- `offerCount`
- `ghostedCount`
- `followUpDueCount`
- `averageDaysToResponse`
- `lastUsedAt`
- `confidenceLevel`
- `sampleSizeWarning`
- `recommendation`

### FR-6: Confidence buckets required

Each CV performance slice must carry one of:

- `insufficient_sample`
- `directional`
- `stronger_signal`

### FR-7: Best CV must be conservative

The feature must not label a CV version as best unless sample size is strong enough.

### FR-8: Recommendation gating

A “recommended CV for next application” signal may appear only when:

- sample size is in `stronger_signal`,
- response signal is meaningfully better than alternatives,
- and the comparison set is not too sparse.

### FR-9: UI home

The first UI home should be the Career dashboard.

### FR-10: Read-only only

This feature must not:

- modify source logs,
- modify job records,
- change status,
- trigger AI,
- trigger Gmail,
- trigger external services.

---

## Company Type Handling

Company type is not yet a reliable first-class field in the current outcomes snapshot.

Chosen v1 direction:

- do not promise a strong company-type slice unless deterministic category metadata is already available
- focus v1 on global, track-specific, and source-specific CV performance
- treat company-type support as a possible follow-on if explicit category mapping is added later

This keeps the design honest with current data.

---

## Success Criteria

The feature succeeds when:

- the user can see CV response and interview performance from local data,
- the system refuses to overclaim weak evidence,
- the feature stays embedded in Application Outcome ETL rather than forking into a second pipeline,
- the Career dashboard can later surface a compact CV evidence panel,
- and the entire feature remains read-only and local-first.
