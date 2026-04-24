# Chunk 1 — Career + AI (Flagship)

**Status:** walked-through 2026-04-24 (critical + real bugs fixed;
minor defensive-coding issues noted below but not fixed; smoke tests
not yet run end-to-end — re-verify after each future change)

**Scope:** The career dashboard, every AI task, every AI API route,
and every career-specific API route. This is the system's largest
surface because almost everything feeds into job ranking.

**What's been fixed already** (see [README.md](README.md) for full
diffs): 7 missing AI task types added; 2 mis-labeled task types
corrected; one brittle `.flat()` in `PipelineSection` hardened; cloud
persistence wired end-to-end.

---

## File inventory

### Career UI

- [ ] [src/app/career/page.tsx](../src/app/career/page.tsx) — thin shell, `redirect('/')` when no user
- [ ] [src/features/career/career-dashboard.tsx](../src/features/career/career-dashboard.tsx) — 1200 lines; three sections (Analyst / Inbox / Pipeline). Verify `jobs.refresh()` is called after every mutation.
- [ ] [src/features/career/application-analytics.tsx](../src/features/career/application-analytics.tsx)
- [ ] [src/features/career/cover-letter.tsx](../src/features/career/cover-letter.tsx) — hits `/api/career/cover-letter`
- [ ] [src/features/career/cv-optimizer.tsx](../src/features/career/cv-optimizer.tsx) — hits `/api/career/cv-optimize`
- [ ] [src/features/career/interview-notes.tsx](../src/features/career/interview-notes.tsx)
- [ ] [src/features/career/interview-prep.tsx](../src/features/career/interview-prep.tsx) — hits `/api/career/interview-prep`
- [ ] [src/features/career/job-timeline.tsx](../src/features/career/job-timeline.tsx)
- [ ] [src/features/career/kanban-board.tsx](../src/features/career/kanban-board.tsx)
- [ ] [src/features/career/paste-job-panel.tsx](../src/features/career/paste-job-panel.tsx)
- [ ] [src/features/career/salary-tracker.tsx](../src/features/career/salary-tracker.tsx) — hits `/api/career/salary`
- [ ] [src/features/career/skill-gap.tsx](../src/features/career/skill-gap.tsx) — hits `/api/career/skill-gap`
- [ ] [src/hooks/use-jobs.ts](../src/hooks/use-jobs.ts) — core hook; confirm every `refresh()` path
- [ ] [src/hooks/use-pipeline.ts](../src/hooks/use-pipeline.ts) — confirm `activeRunId` polling cadence
- [ ] [src/hooks/use-api.ts](../src/hooks/use-api.ts)
- [ ] [src/components/job-detail-panel.tsx](../src/components/job-detail-panel.tsx)
- [ ] [src/components/filter-bar.tsx](../src/components/filter-bar.tsx) + [src/components/ui/system.tsx](../src/components/ui/system.tsx)
- [ ] [src/lib/career/defaults.ts](../src/lib/career/defaults.ts)
- [ ] [src/lib/career/settings.ts](../src/lib/career/settings.ts) — verify `getEnabledUserSearchQueries` + `getEnabledUserSourceIds` respect per-user config

### AI config / client / schemas

- [ ] [src/lib/ai/client.ts](../src/lib/ai/client.ts) — the big one; 836 lines
  - [ ] confirm Gemini path, Ollama path, OpenAI/Anthropic compat modes all return the same shape
  - [ ] confirm `extractJSON` survives `responseMimeType: "text/plain"` from Gemini when `rawTextOutput:true`
  - [ ] **Known issue (deferred):** `logAICall` race condition via `appendToCollection('ai-log', …)` — see README
- [ ] [src/lib/ai/config.ts](../src/lib/ai/config.ts) — defaults + env overrides + `DEPRECATED_MODEL_MAP`. Confirm every task in `AI_TASK_ORDER` has a `DEFAULT_AI_CONFIG.taskSettings[…]` entry.
- [ ] [src/lib/ai/rate-limiter.ts](../src/lib/ai/rate-limiter.ts) — daily + per-task limits
- [ ] [src/lib/ai/schemas.ts](../src/lib/ai/schemas.ts) — Zod schemas; confirm `ParsedJobPostingSchema` + `JobFitEvaluationSchema` match `types/index.ts` exactly
- [ ] [src/lib/ai/user-profile.ts](../src/lib/ai/user-profile.ts) — prompt block used by `evaluateJobFit`; verify it loads from Supabase when available
- [ ] [src/lib/ai/index.ts](../src/lib/ai/index.ts) — barrel; no duplicates

### AI tasks (prompt + fallback per task)

Each task file follows the same pattern: prompt builder, `callAI` call,
schema validation, fallback. Walk each one looking for:
- prompt injection risk from user input (should slice/cap input length)
- fallback handler when AI fails (heuristic or deterministic)
- correct `taskType` string matches the enum

- [ ] [src/lib/ai/tasks/parse-job.ts](../src/lib/ai/tasks/parse-job.ts) — has deterministic fallback
- [ ] [src/lib/ai/tasks/evaluate-job.ts](../src/lib/ai/tasks/evaluate-job.ts) — has heuristic fallback
- [ ] [src/lib/ai/tasks/extract-candidate-profile.ts](../src/lib/ai/tasks/extract-candidate-profile.ts)
- [ ] [src/lib/ai/tasks/tailor-cv.ts](../src/lib/ai/tasks/tailor-cv.ts)
- [ ] [src/lib/ai/tasks/generate-followup.ts](../src/lib/ai/tasks/generate-followup.ts)
- [ ] [src/lib/ai/tasks/generate-linkedin-intro.ts](../src/lib/ai/tasks/generate-linkedin-intro.ts)

### Career API routes

- [ ] [src/app/api/career/cover-letter/route.ts](../src/app/api/career/cover-letter/route.ts) — taskType `cover-letter` ✓
- [ ] [src/app/api/career/cv-optimize/route.ts](../src/app/api/career/cv-optimize/route.ts) — taskType `cv-optimize` ✓
- [ ] [src/app/api/career/interview-prep/route.ts](../src/app/api/career/interview-prep/route.ts) — taskType `interview-prep` ✓
- [ ] [src/app/api/career/salary/route.ts](../src/app/api/career/salary/route.ts) — taskType `salary-lookup` ✓; salary-data collection persists last 20
- [ ] [src/app/api/career/skill-gap/route.ts](../src/app/api/career/skill-gap/route.ts) — taskType `skill-gap` ✓

### AI API routes

- [ ] [src/app/api/ai/parse-job/route.ts](../src/app/api/ai/parse-job/route.ts) — 400 if rawText < 20 chars
- [ ] [src/app/api/ai/evaluate-job/route.ts](../src/app/api/ai/evaluate-job/route.ts) — validates with `ParsedJobPostingSchema.safeParse` first
- [ ] [src/app/api/ai/chat/route.ts](../src/app/api/ai/chat/route.ts) — context assembly from other collections
- [ ] [src/app/api/ai/config/route.ts](../src/app/api/ai/config/route.ts) — GET/PATCH
- [ ] [src/app/api/ai/health/route.ts](../src/app/api/ai/health/route.ts) — surface of `checkAIHealth()`
- [ ] [src/app/api/ai/log/route.ts](../src/app/api/ai/log/route.ts) — read the ai-log collection for debugging
- [ ] [src/app/api/ai/models/route.ts](../src/app/api/ai/models/route.ts)
- [ ] [src/app/api/ai/test/route.ts](../src/app/api/ai/test/route.ts) — `testAIPrompt()` wrapper
- [ ] [src/app/api/ai/categorize-transaction/route.ts](../src/app/api/ai/categorize-transaction/route.ts)
- [ ] [src/app/api/ai/linkedin-intro/route.ts](../src/app/api/ai/linkedin-intro/route.ts)
- [ ] [src/app/api/ai/summarize-decision/route.ts](../src/app/api/ai/summarize-decision/route.ts)
- [ ] [src/app/api/ai/summarize-week/route.ts](../src/app/api/ai/summarize-week/route.ts)
- [ ] [src/app/api/ai/vision-receipt/route.ts](../src/app/api/ai/vision-receipt/route.ts) — multimodal call; verify image-size cap

---

## Issues found (2026-04-24 walk-through)

### Fixed this pass

1. **Dashboard KPIs for Applied / Interviews were always 0.** The
   `/api/jobs/dashboard` route was returning
   `tracked: enriched.filter(j => j.status === "tracked")`, but
   `career-dashboard.tsx` computes
   `applied = jobs.tracked.filter(j => j.status === "applied")` etc.
   Fixed by broadening `tracked` to include every in-flight kanban
   stage (`shortlisted|tracked|applied|interview|offer|archived`).
   Edit: [src/app/api/jobs/dashboard/route.ts](../src/app/api/jobs/dashboard/route.ts).
2. **`SalaryTracker` crashed when the salary API returned null.** On
   server failure the component did `setSaved(s => [data.salary, ...])`
   which pushed a `null` into history; subsequent iteration crashed on
   `r.role`. Fixed by guarding on `!data.salary` and surfacing the
   error. Edit: [src/features/career/salary-tracker.tsx](../src/features/career/salary-tracker.tsx).
3. **Pipeline returned 0 jobs because multi-keyword searches became
   AND-phrases.** Not strictly a chunk-1 file but surfaced during the
   walk. Fixed in `searchesToQueries` (fans out one query per phrase)
   and hardened in the Adzuna adapter.

### Open (defensive-coding / polish — not blocking)

4. **`CVOptimizer` swallows server errors.** Generic
   `"CV optimization failed"` toast even when the server returned a
   specific `error`. Low priority. Would read `data.error` and include it.
   File: [src/features/career/cv-optimizer.tsx:41-43](../src/features/career/cv-optimizer.tsx#L41-L43).
5. **`SkillGapAnalyzer` assumes `result.learningPriorities` exists.**
   If the AI returns a partial object, accessing `.length` on
   undefined would throw. Wrap with `result.learningPriorities?.length`.
   File: [src/features/career/skill-gap.tsx:149](../src/features/career/skill-gap.tsx#L149).
6. **`InterviewPrep` imports unused `RotateCcw`.** Cosmetic.
   File: [src/features/career/interview-prep.tsx:4](../src/features/career/interview-prep.tsx#L4).
7. **`RangeBar` divides by zero if `p75 === p25`.** CSS will
   normalize the broken `left:` but the median tick renders at 0%.
   File: [src/features/career/salary-tracker.tsx:32](../src/features/career/salary-tracker.tsx#L32).
8. **`useApi` sets `data: null` before the fetch resolves.** Any
   component rendering off `data` flickers to empty state during the
   request. Low priority — most callers also watch `loading`.
   File: [src/hooks/use-api.ts:21](../src/hooks/use-api.ts#L21).

### Architectural (deferred — see README)

9. **`logAICall` is a read-modify-write on a single `storage_kv` row.**
   Concurrent enrichment calls can lose log entries. Plan: real
   `ai_log` table with append-only inserts. Tracked in
   [README.md](README.md#known-architectural-issues-deferred--decide-before-fixing).

---

## Smoke tests

Run each from the repo root. These exercise the fixed paths end-to-end.

```bash
# 1) Typecheck must pass
npm run typecheck

# 2) Supabase connectivity + row counts
node --env-file=.env.local -e "
const {createClient}=require('@supabase/supabase-js');
const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
(async()=>{for(const t of ['jobs','raw_jobs','profiles','storage_kv']){
 const r=await sb.from(t).select('*',{count:'exact',head:true});
 console.log(t,r.error?'ERR '+r.error.message:'count='+r.count);}})();"
# Expected: jobs >= 120, raw_jobs >= 2296, profiles >= 1, storage_kv >= 19

# 3) Every career AI route resolves its task config without throwing
npm run dev &        # in another shell
sleep 8
curl -s -X POST http://localhost:3000/api/career/salary \
  -H "Content-Type: application/json" \
  -d '{"role":"Clinical Trial Assistant","location":"Glasgow"}' | jq
# Expected: {"salary":{...}} — NOT a 500 with "Cannot read properties of undefined"
```

4. **UI smoke (Brain-on):** open `/career`, click "Parse & Evaluate" on
   a pasted JD, confirm both panels render a score + reasons. Then
   click "Save to Inbox" and confirm the job appears in the ranked list
   after a refresh.
5. **Pipeline smoke:** click "Run Pipeline" from the hero bar. Confirm
   the `Pipeline running…` banner appears, then the summary banner
   replaces it within ~1–3 min, then `jobs.ranked.length` increases.
   Open the phone / deployed app and confirm the same ranked jobs are
   visible.

## Exit criteria

- [ ] Every file above is ✅.
- [ ] All 5 smoke tests pass.
- [ ] The `Issues found` section lists nothing marked `open`.
- [ ] README's "Already-applied fixes" is still accurate.
- [ ] Update the `Status:` line at the top of this file to `verified (YYYY-MM-DD)`.
