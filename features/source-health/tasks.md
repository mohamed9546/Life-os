# Tasks: Source Health Monitoring

Feature folder: `features/source-health/`

---

## Phase 0 — Safety Precondition

- [ ] Apply `.gitignore` privacy patch from `docs/repo-safety-patch.md`.
- [ ] Run `git ls-files private`.
- [ ] Confirm no plaintext private files are tracked.
- [ ] Commit the safety patch before feature implementation.

---

## Phase 1 — Types and Storage

- [ ] Add `SourceHealthStatus`.
- [ ] Add `SourceHealthResult`.
- [ ] Add `SourceHealthSnapshot`.
- [ ] Add storage key for `source-health`.
- [ ] Confirm local file target is `data/source-health.json`.
- [ ] Ensure all reads/writes go through the storage facade.

---

## Phase 2 — Domain Logic

- [ ] Create `src/lib/jobs/source-health.ts`.
- [ ] Import or access the existing job source registry.
- [ ] Implement per-source probe runner.
- [ ] Measure latency per source.
- [ ] Catch source-level errors individually.
- [ ] Validate returned result shape.
- [ ] Classify each source as `ok`, `degraded`, `down`, or `unknown`.
- [ ] Aggregate counts into `SourceHealthSnapshot`.
- [ ] Implement `runSourceHealthCheck()`.
- [ ] Implement `getLatestSourceHealthSnapshot()`.

---

## Phase 3 — API Route

- [ ] Create `src/app/api/admin/source-health/route.ts`.
- [ ] Implement `GET` for latest snapshot.
- [ ] Implement `POST` for running fresh check.
- [ ] Ensure API does not expose stack traces or secrets.
- [ ] Ensure partial failures still return a snapshot.

---

## Phase 4 — UI

- [ ] Create `src/features/settings/source-health-panel.tsx`.
- [ ] Fetch latest snapshot on mount.
- [ ] Add manual `Run check` action.
- [ ] Add loading state.
- [ ] Add empty state.
- [ ] Add error state.
- [ ] Add summary counters.
- [ ] Add table for source-level results.
- [ ] Add panel to settings/admin source area.

---

## Phase 5 — Worker

- [ ] Register `source-health-check` in `src/lib/worker/task-registry.ts`.
- [ ] Make worker task call `runSourceHealthCheck()`.
- [ ] Ensure worker logs result summary.
- [ ] Ensure worker does not duplicate source health logic.

---

## Phase 6 — Tests

- [ ] Add test for all sources healthy.
- [ ] Add test for one source throwing.
- [ ] Add test for malformed result.
- [ ] Add test for empty latest snapshot.
- [ ] Add test for POST writing snapshot.
- [ ] Mock all source adapters.
- [ ] Confirm no live job APIs are called.

---

## Phase 7 — Verification

- [ ] Run lint.
- [ ] Run typecheck.
- [ ] Run tests.
- [ ] Run build.
- [ ] Start dev server.
- [ ] Visit Settings.
- [ ] Run manual source health check.
- [ ] Confirm `data/source-health.json` is created locally.
- [ ] Confirm `data/source-health.json` is not tracked by Git.

---

## Phase 8 — Commit

- [ ] Commit spec files and implementation together.

Suggested commits:

```bash
git add .
git commit -m "chore(spec-kit): adopt governance and source health spec"
git commit -m "feat(source-health): add job source smoke-check monitoring"
```
