# Tasks: AI Telemetry

Feature folder: `features/ai-telemetry/`

---

## Phase 0 — Safety Preconditions

- [ ] Confirm `constitution.md` rules are still satisfied.
- [ ] Confirm no telemetry design requires `.env.local` inspection.
- [ ] Confirm no external telemetry service will be added.
- [ ] Confirm telemetry remains local-first only.

---

## Phase 1 — Types and Storage

- [ ] Add `AITelemetryEntry` type.
- [ ] Add `AITelemetrySummary` type.
- [ ] Add a telemetry storage key/collection.
- [ ] Confirm local storage target (`data/ai-telemetry.json`).
- [ ] Ensure all reads/writes go through `src/lib/storage/index.ts`.

---

## Phase 2 — Domain Module

- [ ] Create `src/lib/ai/telemetry.ts`.
- [ ] Implement metadata sanitisation.
- [ ] Implement telemetry write helper.
- [ ] Implement recent-entry query helper.
- [ ] Implement summary builder.
- [ ] Implement retention strategy.
- [ ] Ensure no prompt/response text is stored by default.

---

## Phase 3 — AI Router Integration

- [ ] Extend `AICallOptions` with optional telemetry metadata fields.
- [ ] Add `callingModule` support.
- [ ] Add `sensitivityLevel` support.
- [ ] Instrument successful AI calls in `src/lib/ai/client.ts`.
- [ ] Instrument failed AI calls in `src/lib/ai/client.ts`.
- [ ] Instrument fallback route usage.
- [ ] Capture token estimates when available.
- [ ] Capture cost estimates when available.
- [ ] Preserve existing task outputs and behaviour.

---

## Phase 4 — API Route

- [ ] Create `src/app/api/admin/ai-telemetry/route.ts`.
- [ ] Implement `GET` for recent entries and/or summary.
- [ ] Support filtering by range and task/provider where reasonable.
- [ ] Ensure no raw sensitive content is exposed.

---

## Phase 5 — UI

- [ ] Choose final panel placement after reviewing Settings vs Automation vs Life OS trade-offs.
- [ ] Create UI component for telemetry summary.
- [ ] Show total calls today / week / month.
- [ ] Show slowest tasks.
- [ ] Show failed tasks.
- [ ] Show fallback usage.
- [ ] Show provider/model usage.
- [ ] Show estimated monthly cost.
- [ ] Show local vs cloud split.
- [ ] Show sensitivity routing overview.

---

## Phase 6 — Tests

- [ ] Add tests for successful telemetry recording.
- [ ] Add tests for failed telemetry recording.
- [ ] Add tests for fallback telemetry.
- [ ] Add tests for no prompt/response persistence by default.
- [ ] Add tests for summary aggregation.
- [ ] Add tests for API route responses.
- [ ] Mock AI runtime results; do not call providers.

---

## Phase 7 — Verification

- [ ] Run lint.
- [ ] Run typecheck.
- [ ] Run tests.
- [ ] Run build.
- [ ] Manually inspect `data/ai-telemetry.json`.
- [ ] Confirm no sensitive text is stored by default.
- [ ] Confirm UI panel renders.
- [ ] Confirm fallback and failure states are visible.

---

## Phase 8 — Commit

- [ ] Commit planning files first if needed.
- [ ] Commit implementation after verification.

Suggested implementation commit:

```bash
git add .
git commit -m "feat(ai-telemetry): add local ai runtime telemetry"
```

---

## Out of Scope

- [ ] No external analytics service.
- [ ] No prompt archive feature.
- [ ] No backup/export feature in this phase.
- [ ] No routing behaviour change beyond metadata capture.
