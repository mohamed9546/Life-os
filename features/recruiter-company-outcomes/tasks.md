# Tasks: Recruiter / Company Outcome Tracking

Feature folder: `features/recruiter-company-outcomes/`

---

## Phase 0 - Safety Preconditions

- [ ] Confirm `constitution.md` rules are satisfied.
- [ ] Confirm the feature remains local-first and read-only.
- [ ] Confirm `application-outcomes` remains the source of truth.
- [ ] Confirm no Gmail, AI, scraping, ranking, or status mutation work is added.

---

## Phase 1 - Snapshot Contract

- [ ] Define embedded company/recruiter/agency/source-company sections.
- [ ] Add confidence and sample-warning fields.
- [ ] Add conservative recommended-action field.

---

## Phase 2 - Derived Metrics

- [ ] Build company performance metrics.
- [ ] Build recruiter performance metrics.
- [ ] Build agency performance metrics.
- [ ] Build source-company performance metrics.
- [ ] Keep only attempt rows in conversion-rate metrics.
- [ ] Keep pipeline-only rows out of rate denominators.

---

## Phase 3 - Confidence and Recommendation Rules

- [ ] Apply `insufficient_sample`, `directional`, and `stronger_signal` buckets.
- [ ] Suppress strong recommendations on weak evidence.
- [ ] Emit conservative recommended-action states only when justified.

---

## Phase 4 - UI

- [ ] Extend the existing Application Outcomes panel.
- [ ] Show best responding companies.
- [ ] Show repeated ghosting companies.
- [ ] Show recruiter/agency response evidence where available.
- [ ] Show follow-up due by company/recruiter.
- [ ] Show low-sample warnings.

---

## Phase 5 - Tests

- [ ] Test company metrics use attempt rows only.
- [ ] Test recruiter metrics use attempt rows only.
- [ ] Test agency metrics use attempt rows only.
- [ ] Test source-company grouping.
- [ ] Test unknown buckets remain visible.
- [ ] Test confidence bucket assignment.
- [ ] Test recommendation suppression on weak evidence.
- [ ] Test no mutation of source outcome records.

---

## Phase 6 - Verification

- [ ] Run lint.
- [ ] Run typecheck.
- [ ] Run tests.
- [ ] Run build.
- [ ] Manually verify the Career outcomes panel recruiter/company section.

---

## Phase 7 - Commit

- [ ] Keep scope to recruiter/company outcome evidence only.
- [ ] Do not expand into recruiter graph or outreach generation.
- [ ] Commit only after verification passes.

Suggested future commit:

```bash
git add .
git commit -m "feat(recruiter-outcomes): track recruiter and company outcome signals"
```
