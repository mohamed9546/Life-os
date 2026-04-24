# Chunk 4 — Other Life OS surfaces

**Status:** not started

**Scope:** Everything that isn't career/AI/pipeline/auth: money,
decisions, routines, goals, journal, overview, life-os weekly review,
gratitude, learning, calendar, contacts, deep-work, activity,
notifications, imports, settings.

**Run Chunks 1–3 first.** Almost every surface here reads from the
storage layer + calls an AI task — so bugs there surface here.

---

## File inventory

### Money

- [ ] [src/app/money/](../src/app/money/) — page + client
- [ ] [src/features/money/](../src/features/money/)
- [ ] [src/lib/money/](../src/lib/money/) — storage, merchant rules, transaction logic
- [ ] [src/app/api/money/](../src/app/api/money/) — transactions, reviews, rules
- [ ] [src/lib/ai/tasks/categorize-transaction.ts](../src/lib/ai/tasks/categorize-transaction.ts)
- [ ] [src/lib/ai/tasks/summarize-money.ts](../src/lib/ai/tasks/summarize-money.ts)
- [ ] [src/app/api/ai/categorize-transaction/route.ts](../src/app/api/ai/categorize-transaction/route.ts)
- [ ] [src/app/api/ai/vision-receipt/route.ts](../src/app/api/ai/vision-receipt/route.ts) — multimodal receipt scan

### Decisions

- [ ] [src/app/decisions/](../src/app/decisions/)
- [ ] [src/features/decisions/](../src/features/decisions/)
- [ ] [src/lib/decisions/](../src/lib/decisions/)
- [ ] [src/app/api/decisions/](../src/app/api/decisions/)
- [ ] [src/lib/ai/tasks/summarize-decision.ts](../src/lib/ai/tasks/summarize-decision.ts)
- [ ] [src/lib/ai/tasks/summarize-decision-patterns.ts](../src/lib/ai/tasks/summarize-decision-patterns.ts)

### Routines

- [ ] [src/app/routines/](../src/app/routines/)
- [ ] [src/features/routines/](../src/features/routines/)
- [ ] [src/lib/routines/](../src/lib/routines/)
- [ ] [src/app/api/routines/](../src/app/api/routines/)
- [ ] [src/lib/ai/tasks/suggest-routine-focus.ts](../src/lib/ai/tasks/suggest-routine-focus.ts)

### Goals + journal + life-os + overview

- [ ] [src/app/goals/](../src/app/goals/), [src/features/goals/](../src/features/goals/), [src/app/api/goals/](../src/app/api/goals/)
- [ ] [src/app/journal/](../src/app/journal/), [src/features/journal/](../src/features/journal/), [src/app/api/journal/](../src/app/api/journal/)
- [ ] [src/app/life-os/](../src/app/life-os/), [src/features/life-os/](../src/features/life-os/), [src/app/api/life-os/](../src/app/api/life-os/)
  - [ ] [src/app/api/life-os/morning-briefing/route.ts](../src/app/api/life-os/morning-briefing/route.ts)
  - [ ] [src/lib/life-os/weekly-review.ts](../src/lib/life-os/weekly-review.ts)
  - [ ] [src/lib/ai/tasks/summarize-week.ts](../src/lib/ai/tasks/summarize-week.ts)
- [ ] [src/app/overview/](../src/app/overview/), [src/features/overview/](../src/features/overview/)

### Smaller surfaces

- [ ] [src/app/calendar/](../src/app/calendar/), [src/features/calendar/](../src/features/calendar/)
- [ ] [src/app/contacts/](../src/app/contacts/), [src/features/contacts/](../src/features/contacts/), [src/app/api/contacts/](../src/app/api/contacts/)
- [ ] [src/app/chat/](../src/app/chat/), [src/features/chat/](../src/features/chat/) — confirm chat history persists to storage
- [ ] [src/app/learning/](../src/app/learning/), [src/features/learning/](../src/features/learning/), [src/app/api/learning/](../src/app/api/learning/)
- [ ] [src/app/automation/](../src/app/automation/), [src/features/automation/](../src/features/automation/)
- [ ] [src/app/imports/](../src/app/imports/), [src/features/imports/](../src/features/imports/), [src/app/api/imports/](../src/app/api/imports/), [src/lib/imports/](../src/lib/imports/)
  - CV import (PDF), Gmail/GDrive integrations
- [ ] [src/app/settings/](../src/app/settings/), [src/features/settings/](../src/features/settings/), [src/app/api/settings/](../src/app/api/settings/)
- [ ] [src/app/api/deep-work/](../src/app/api/deep-work/)
- [ ] [src/app/api/activity/](../src/app/api/activity/)
- [ ] [src/app/api/gratitude/](../src/app/api/gratitude/)
- [ ] [src/app/api/notifications/](../src/app/api/notifications/)
- [ ] [src/app/api/life-timeline/](../src/app/api/life-timeline/)
- [ ] [src/app/api/profile/](../src/app/api/profile/)
- [ ] [src/app/welcome/](../src/app/welcome/), [src/app/health/](../src/app/health/), [src/app/error.tsx](../src/app/error.tsx), [src/app/not-found.tsx](../src/app/not-found.tsx), [src/app/global-error.tsx](../src/app/global-error.tsx)

### Common checks for each surface

- [ ] Page redirects to `/` when no user (mirroring career/page.tsx)
- [ ] Every client hook path has a loading state + error state
- [ ] Every API route validates input before calling AI or writing to storage
- [ ] Every read goes through the storage façade (no direct `fs` reads)

---

## Issues found (append as you go)

_None recorded yet._

---

## Smoke tests

4 quick round-trips — one per top surface. All should return 200 + real data after Chunk 1's data migration.

```bash
for path in /api/money/transactions \
            /api/decisions \
            /api/routines \
            /api/goals \
            /api/journal \
            /api/life-os/morning-briefing \
            /api/learning \
            /api/contacts \
            /api/gratitude; do
  echo -n "$path → "
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000$path
done
# Expected: 200 for every one
```

Also:
- **Weekly review:** POST `/api/life-os/weekly-review` and confirm a new row in `weekly_reviews`.
- **Morning briefing:** GET `/api/life-os/morning-briefing` and confirm the `summarize-week` task succeeds.
- **CV import:** upload a PDF through `/imports` and confirm `candidate-profile` in `storage_kv` updates.

## Exit criteria

- [ ] Every file above ✅.
- [ ] Every smoke-test path returns 200.
- [ ] Update `Status:` at the top.
