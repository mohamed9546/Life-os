# Tasks: Application Outcome ETL

Feature folder: `features/application-outcomes-etl/`

---

## Phase 0 - Safety Preconditions

- [ ] Confirm `constitution.md` rules are satisfied.
- [ ] Confirm the feature stays local-first.
- [ ] Confirm output writes will go through `src/lib/storage/index.ts`.
- [ ] Confirm the ETL is read-only with respect to application logs and job records.
- [ ] Confirm `.env.local` and secrets are not required.
- [ ] Confirm no external analytics service is added.

---

## Phase 1 - Output Contract

- [ ] Define the canonical snapshot shape.
- [ ] Decide the storage key for the outcomes snapshot.
- [ ] Decide whether the snapshot is stored as an object rather than a collection.
- [ ] Define the canonical outcome record grain.
- [ ] Define required summary sections.
- [ ] Define recent-window versus all-time summary rules.

---

## Phase 2 - Input Join Layer

- [ ] Reuse existing helpers for application logs.
- [ ] Reuse existing helpers for ranked, tracked, inbox, enriched, and rejected jobs.
- [ ] Reuse CV library helpers for CV attribution.
- [ ] Reuse target-company or attached company metadata where useful.
- [ ] Build one row per application attempt when an attempt exists.
- [ ] Build fallback pipeline-only rows only for tracked or shortlisted jobs with no application attempt yet.
- [ ] Retain `dedupeKey` as the job-level join key without using it as the universal primary row ID.
- [ ] Handle missing job records or missing logs safely.

---

## Phase 3 - Derived Metrics

- [ ] Derive `applicationDate` deterministically.
- [ ] Derive `latestStatusDate` deterministically.
- [ ] Derive `currentStatus` from existing status vocabularies.
- [ ] Derive `responseReceived` and `responseDate`.
- [ ] Derive `followUpDue` and `followUpStage`.
- [ ] Derive `ghosted` using the agreed threshold.
- [ ] Derive `daysSinceApplication`, `daysSinceLastAction`, and `daysToResponse`.
- [ ] Derive CV version buckets, including `unknown`.
- [ ] Derive recruiter and company attribution without guessing.

---

## Phase 4 - Summary Sections

- [ ] Build totals summary.
- [ ] Build summary by source.
- [ ] Build summary by role track.
- [ ] Build CV-version summaries from real application-attempt rows only.
- [ ] Build company summaries with attempt-based response metrics.
- [ ] Build recruiter summaries with attempt-based response metrics when metadata exists.
- [ ] Build stage-leak summary.
- [ ] Build overdue follow-up and ghosted queues.
- [ ] Ensure pipeline-only tracked or shortlisted rows can appear in utility or leakage views without diluting conversion rates.

---

## Phase 5 - Manual Run Surface

- [ ] Add a domain ETL function.
- [ ] Add a `GET` route for the latest snapshot.
- [ ] Add a `POST` route to recompute the snapshot.
- [ ] Return only local analytics payloads.
- [ ] Keep manual run first-class in v1.

---

## Phase 6 - Optional Worker Reuse

- [ ] Decide whether to register an optional worker task in v1.
- [ ] If added, ensure the worker calls the same domain ETL function as the API route.
- [ ] Keep worker execution disabled by default unless explicitly justified.

---

## Phase 7 - Optional UI Follow-Up

- [ ] Decide the first Career dashboard surface after API stability.
- [ ] Show source, CV, company, recruiter, and stage summaries.
- [ ] Show follow-up due and ghosted queues.
- [ ] Keep the first UI read-only.

---

## Phase 8 - Tests

- [ ] Test join logic across logs and jobs.
- [ ] Test one-row-per-attempt behaviour for multiple attempts on the same `dedupeKey`.
- [ ] Test fallback pipeline-only rows for tracked or shortlisted jobs with no attempts.
- [ ] Test unknown CV version handling.
- [ ] Test response detection.
- [ ] Test follow-up due thresholds.
- [ ] Test ghosted threshold.
- [ ] Test grouped summary calculations.
- [ ] Test that CV-version and recruiter or company conversion summaries use attempt rows only.
- [ ] Test that ETL does not mutate source records.
- [ ] Avoid secret-dependent tests.

---

## Phase 9 - Verification

- [ ] Run lint.
- [ ] Run typecheck.
- [ ] Run tests.
- [ ] Run build.
- [ ] Manually verify the snapshot output on local non-secret data.
- [ ] Verify no source records were mutated.
- [ ] Verify no external analytics calls were introduced.

---

## Phase 10 - Implementation Commit

- [ ] Implement only after planning is approved.
- [ ] Commit after verification passes.

Suggested future commit style:

```bash
git add .
git commit -m "feat(application-outcomes-etl): add local application outcome analytics"
```
