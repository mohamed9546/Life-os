# Life OS — Line-by-Line Verification Plan

The codebase is ~300 TypeScript files. We split it into 5 chunks so each
pass is self-contained: one chunk per sitting, one checklist per chunk,
one set of test commands per chunk. Do them in order — later chunks
assume earlier ones are verified.

## Chunks

1. [Chunk 1 — Career + AI (Flagship)](chunk-1-career-ai.md) — ← current focus
2. [Chunk 2 — Jobs pipeline + sources](chunk-2-jobs-pipeline.md)
3. [Chunk 3 — Storage + auth + Supabase plumbing](chunk-3-storage-auth.md)
4. [Chunk 4 — Other Life OS surfaces (money, decisions, routines, goals, journal, life-os)](chunk-4-life-os-surfaces.md)
5. [Chunk 5 — Worker, scraper, deploy, top-level glue](chunk-5-worker-deploy.md)

## How to run a chunk

1. Open its markdown file.
2. Walk the **File inventory** top-to-bottom. For each file:
   - Read it. Mark it ✅ when it compiles, runs, and matches intent.
   - If a `Known issue` is listed, verify the fix is applied (or fix it).
   - If you spot a new issue, append it to the **Issues found** section.
3. Run the **Smoke tests** at the bottom. All must pass before the chunk
   is considered verified.
4. Update the top-of-file status line: `Status: in progress` → `verified`.

## Already-applied fixes (2026-04-24)

These fixes landed today as part of the initial walk-through. Chunks
should not re-discover them:

- **Cloud persistence**: pipeline + worker write as real UUID
  (`LIFE_OS_DEFAULT_USER_ID=aa56d89e-…`) instead of the string
  `"preview-user"`. Profiles row created; 2,296 raw jobs + 120 jobs +
  19 storage_kv keys migrated from local JSON to Supabase.
  Edits: [.env.local](../.env.local),
  [src/lib/auth/session.ts](../src/lib/auth/session.ts),
  [src/lib/worker/task-runner.ts](../src/lib/worker/task-runner.ts),
  [src/lib/jobs/storage.ts](../src/lib/jobs/storage.ts),
  [deploy/env.example](../deploy/env.example).
- **Missing AI task types**: added 7 task types (`cover-letter`,
  `cv-optimize`, `interview-prep`, `salary-lookup`, `skill-gap`,
  `extract-job-from-scrape`, `extract-job-list-from-scrape`) that
  career / scraper routes were passing to `callAI()`. Before the fix,
  `getTaskConfig` returned `undefined` and `getTaskRuntimeSettings`
  crashed on `.enabled`. Edits:
  [src/types/index.ts](../src/types/index.ts),
  [src/lib/ai/config.ts](../src/lib/ai/config.ts).
- **Mis-labeled route task types**:
  [cover-letter/route.ts](../src/app/api/career/cover-letter/route.ts)
  was reusing `generate-followup`'s rate-limit bucket;
  [skill-gap/route.ts](../src/app/api/career/skill-gap/route.ts) was
  reusing `evaluate-job`'s. Both now use their own task types.
- **Confusing `.flat()`**: [career-dashboard.tsx:894](../src/features/career/career-dashboard.tsx#L894)
  `[...tracked, ...inbox, rejected].flat()` → `[...tracked, ...inbox, ...rejected]`.

## Known architectural issues (deferred — decide before fixing)

These were found but not fixed because they require a schema or API
surface decision. Each chunk will link back to these.

- **`ai-log` is an append-everything JSONB blob**: every AI call does
  read-modify-write on a single `storage_kv` row via
  `appendToCollection('ai-log', ...)`. Under concurrent enrichment this
  loses log entries (last-write-wins). A real `ai_log` table with
  append-only inserts would fix it. See
  [src/lib/ai/client.ts:65-71](../src/lib/ai/client.ts#L65-L71).
- **`storage_kv` is the fallback for everything**: we have structured
  tables (`jobs`, `raw_jobs`, `profiles`, etc.) AND a catch-all kv
  table. Right now both paths are used inconsistently — writes go to
  structured tables if available, fallback to kv. Reads are split
  across the two. Decide: pick one storage path per collection or
  formalize the split.
- **Pipeline runs under a single "owner" UUID**: acceptable for a
  single-tenant personal OS, but the app is structured as if it were
  multi-tenant (RLS policies, user_id FKs everywhere). Either commit to
  multi-tenant (add real login flow enforcement) or simplify down to
  single-tenant.
