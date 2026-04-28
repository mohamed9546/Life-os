# Tasks: System Checkpoint Dashboard

Feature folder: `features/system-checkpoint-dashboard/`

---

## Phase 0 - Safety Preconditions

- [ ] Confirm `constitution.md` rules are satisfied.
- [ ] Confirm the feature stays local-first.
- [ ] Confirm the dashboard is read-only.
- [ ] Confirm no Gmail, AI provider, job source, backup, or restore actions are triggered automatically.
- [ ] Confirm no source logs or job records are mutated.

---

## Phase 1 - Checkpoint Contract

- [ ] Define checkpoint snapshot types.
- [ ] Define section status types.
- [ ] Define overall status reduction rules.
- [ ] Define operator checklist shape.

---

## Phase 2 - Source Health Integration

- [ ] Reuse source-health domain helper.
- [ ] Summarize latest source-health snapshot.
- [ ] Expose down/degraded counts and worst failing sources.
- [ ] Handle missing snapshots as `unknown`.

---

## Phase 3 - AI Telemetry Integration

- [ ] Reuse AI telemetry summary helper.
- [ ] Summarize calls, failures, fallbacks, cost, latency, and local/cloud split.
- [ ] Handle missing telemetry as `unknown`.

---

## Phase 4 - Backup Metadata Integration

- [ ] Read encrypted backup metadata from `private/exports/*.age` only.
- [ ] Ignore backup contents.
- [ ] Compute backup age and stale status.
- [ ] Mark no backup as `critical`.

---

## Phase 5 - Runtime Guardrails Integration

- [ ] Define the small set of static guardrail checks.
- [ ] Inspect `.gitignore` boundary safely without shell Git commands.
- [ ] Check expected local guardrail files exist.
- [ ] Map results to `healthy`, `attention`, or `unknown`.

---

## Phase 6 - Application Outcomes Integration

- [ ] Reuse latest application outcomes snapshot helper.
- [ ] Summarize attempts, responses, interviews, offers, ghosted, and follow-up due.
- [ ] Surface best source/track/CV if sample size is sufficient.
- [ ] Distinguish missing snapshot with attempts from missing snapshot without attempts.

---

## Phase 7 - Overall Status and Checklist

- [ ] Compute section statuses.
- [ ] Reduce to one overall trust status.
- [ ] Generate a short operator checklist.

---

## Phase 8 - API and UI

- [ ] Add a read-only admin API route if useful.
- [ ] Add a compact panel to Automation.
- [ ] Add links to existing detailed surfaces.
- [ ] Keep the UI compact and operational.

---

## Phase 9 - Tests

- [ ] Test missing snapshot states.
- [ ] Test backup fresh/stale/missing status rules.
- [ ] Test AI and source-health section status rules.
- [ ] Test outcomes section status rules.
- [ ] Test overall status reduction.
- [ ] Test operator checklist derivation.
- [ ] Avoid secret-dependent tests.

---

## Phase 10 - Verification

- [ ] Run lint.
- [ ] Run typecheck.
- [ ] Run tests.
- [ ] Run build.
- [ ] Manually verify the Automation control-room surface.

---

## Phase 11 - Consolidation Commit

- [ ] Keep scope to visibility only.
- [ ] Do not expand into a new engine.
- [ ] Commit only after verification passes.

Suggested future commit:

```bash
git add .
git commit -m "chore(system-checkpoint): add operational control-room summary"
```
