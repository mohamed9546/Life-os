# Tasks: CV Version Response Tracking

Feature folder: `features/cv-version-response-tracking/`

---

## Phase 0 - Safety Preconditions

- [ ] Confirm `constitution.md` rules are satisfied.
- [ ] Confirm the feature remains local-first and read-only.
- [ ] Confirm Application Outcome ETL remains the source of truth.
- [ ] Confirm no Gmail, AI, ranking, or status mutation work is added.

---

## Phase 1 - Snapshot Contract

- [ ] Decide the embedded `cvVersionPerformance` snapshot shape.
- [ ] Add confidence bucket fields.
- [ ] Add sample-size warning fields.
- [ ] Add recommendation field shape.

---

## Phase 2 - Derived Metrics

- [ ] Build global CV performance metrics.
- [ ] Build track-specific CV performance metrics.
- [ ] Build source-specific CV performance metrics.
- [ ] Ensure only `application_attempt` rows count.
- [ ] Keep `unknown` CV visible.

---

## Phase 3 - Confidence and Recommendation Rules

- [ ] Implement `insufficient_sample`, `directional`, and `stronger_signal` buckets.
- [ ] Suppress “best CV” claims when evidence is weak.
- [ ] Add conservative recommendation gating for next-application guidance.

---

## Phase 4 - UI

- [ ] Add compact Career dashboard panel.
- [ ] Show best CV only when signal is strong enough.
- [ ] Show insufficient-data warnings.
- [ ] Show no-response CV versions.
- [ ] Show track-specific evidence.

---

## Phase 5 - Tests

- [ ] Test attempt-only inclusion.
- [ ] Test pipeline-only exclusion.
- [ ] Test unknown bucket retention.
- [ ] Test confidence bucket assignment.
- [ ] Test recommendation suppression under weak evidence.
- [ ] Test recommendation under stronger evidence.
- [ ] Test no mutation of source outcome records.

---

## Phase 6 - Verification

- [ ] Run lint.
- [ ] Run typecheck.
- [ ] Run tests.
- [ ] Run build.
- [ ] Manually verify the Career dashboard CV evidence panel.

---

## Phase 7 - Commit

- [ ] Keep scope to CV response tracking only.
- [ ] Do not expand into deeper CV lifecycle management.
- [ ] Commit only after verification passes.

Suggested future commit:

```bash
git add .
git commit -m "feat(cv-performance): add cv version response tracking"
```
