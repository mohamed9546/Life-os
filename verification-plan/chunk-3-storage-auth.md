# Chunk 3 — Storage + auth + Supabase plumbing

**Status:** walked-through 2026-04-24 (2 real fixes landed; 3 open
items — one needs a schema decision, two are production notes)

**Scope:** Everything that decides *where* data lives: the `storage`
façade, the Supabase clients, the auth session, middleware, and the
SQL migrations. This chunk is small file-count but large in blast
radius — a bug here makes everything else look broken.

---

## File inventory

### Storage façade

- [ ] [src/lib/storage/index.ts](../src/lib/storage/index.ts) — tries Supabase `storage_kv` first, falls back to `data/*.json` on laptop or `/tmp/data` on Cloud Run.
  - Verify: every exported function has Supabase and disk paths, and they return the same shape.
  - Verify: `Collections` constants match actual on-disk filenames.
  - Verify: `writeCollection` of an empty array removes vs preserves (check intent).

### Supabase

- [ ] [src/lib/supabase/env.ts](../src/lib/supabase/env.ts)
- [ ] [src/lib/supabase/service.ts](../src/lib/supabase/service.ts) — service-role client; `null` when key missing
- [ ] [src/lib/supabase/client.ts](../src/lib/supabase/client.ts) — browser client
- [ ] [src/lib/supabase/server.ts](../src/lib/supabase/server.ts) — server-side cookie-aware client
- [ ] [src/lib/supabase/middleware.ts](../src/lib/supabase/middleware.ts) — verify `updateSession()` refreshes the access token; confirm no infinite redirect loops

### Auth + session

- [ ] [src/lib/auth/session.ts](../src/lib/auth/session.ts) — `getCurrentAppUser()` falls back to `PREVIEW_USER` using `LIFE_OS_DEFAULT_USER_ID`. Already wired in today's fix; verify on both laptop and deployed VM.
- [ ] [src/lib/auth](../src/lib/auth) — walk everything in here
- [ ] [src/app/api/auth](../src/app/api/auth) — login/logout/session refresh routes
- [ ] [middleware.ts](../middleware.ts) — the root middleware; confirm it only protects routes that actually need auth

### SQL migrations

- [ ] [supabase/migrations/20260419_career_beta.sql](../supabase/migrations/20260419_career_beta.sql) — profiles, raw_jobs, jobs, job_events, saved_searches, source_configs, worker_state, ai_usage
- [ ] [supabase/migrations/20260422_full_life_os.sql](../supabase/migrations/20260422_full_life_os.sql) — transactions, merchant_rules, money_reviews, decisions, weekly_reviews, routines, etc.
- [ ] [supabase/migrations/20260423183808_add_storage_kv.sql](../supabase/migrations/20260423183808_add_storage_kv.sql) — catch-all kv table

For each migration, confirm:
- [ ] Every table's RLS policy matches the pattern `using (auth.uid() = user_id)` OR is explicitly public-with-service-role (storage_kv).
- [ ] All foreign keys use `on delete cascade` (otherwise deleting a user strands rows).
- [ ] No column is `not null` without a default in a way that would break the existing app.

### Schema drift guard

- [ ] `scripts/migrate-local-to-supabase.ts` — still aligned with current tables?
- [ ] `types/index.ts` `EnrichedJob`, `RawJobItem`, `JobFitEvaluation` — still match SQL columns?

---

## Issues found (2026-04-24 walk-through)

### Fixed this pass

1. **`appendToCollection` race condition.** Every call did
   `readCollection → push → writeCollection` against a single
   `storage_kv` JSONB row. Concurrent callers (the pipeline firing
   multiple AI log entries during parallel enrichment) read the same
   pre-state, pushed their entry, and raced the write — last write
   wins, entries lost. Added a per-collection in-process promise
   chain so appends serialize. Edit:
   [src/lib/storage/index.ts](../src/lib/storage/index.ts).
2. **Silent data loss on Cloud Run when Supabase not configured.**
   The storage façade fell back to `/tmp/data` — a per-instance
   tmpfs that's wiped on every container restart — with no warning.
   Now emits a one-time loud console.error on the first fallback so
   misconfigured deployments surface immediately.
   Same edit as above.

### Open / noted

3. **`getActiveAdapters` doesn't consult user's `enabled` preference.**
   (Cross-reference to Chunk 2 finding — storage layer is fine, but
   surfaces here because `source_configs` is the kv record that
   should be the source of truth.)
4. **RLS bypass via service role key is the only write path.** Every
   server-side write uses `SUPABASE_SERVICE_ROLE_KEY` and bypasses
   RLS. If multi-tenancy ever arrives, the code needs to also
   enforce `user_id` correctness in every handler (not just trust
   the policies). Currently acceptable for a single-tenant personal
   OS.
5. **Cloud Run env is now populated** (verified live at
   https://life-os-856213759835.europe-west1.run.app/api/jobs/stats
   which returns the same numbers as Supabase). Keep
   `SUPABASE_SERVICE_ROLE_KEY` out of revisions history — consider
   rotating it into Google Secret Manager via `--update-secrets`.

## Known architectural issues (decide here)

These are the ones parked in [README.md](README.md#known-architectural-issues-deferred--decide-before-fixing):

1. **`storage_kv` vs structured tables** — decide per-collection where the canonical data lives. Draft a decision table:

   | Collection | Canonical source | Read path | Write path |
   |---|---|---|---|
   | jobs-raw / raw_jobs | SQL table | `storage.ts` via `readDbRawJobs` | `upsertDbRawJobs` |
   | jobs-{inbox,enriched,ranked,rejected} / jobs | SQL table | `readDbJobs` by status | `upsertDbJobs` |
   | candidate-profile | storage_kv | kv | kv |
   | saved-searches | SQL `saved_searches`? or kv? | **decide** | **decide** |
   | source-preferences | SQL `source_configs`? or kv? | **decide** | **decide** |
   | ai-log | **decide** (see issue #2) | | |
   | worker-runs / worker-state | SQL | SQL | SQL |

2. **`ai_log` race condition** — write the migration + switch the client. Rough plan: new table `ai_log(id uuid pk default gen_random_uuid(), user_id uuid null, task_type text, model text, success bool, duration_ms int, input_bytes int, output_bytes int, fallback_used bool, input_preview text, error text, created_at timestamptz default now())`. `logAICall` does a single insert.

3. **Single-tenant vs multi-tenant** — confirm the decision: this is a single-user personal OS. Then either (a) drop the per-user plumbing and use a single `OWNER` constant everywhere, or (b) keep it as-is and treat it as future-proofing. No action required today — just write the decision down.

---

## Smoke tests

```bash
# 1) Every structured table responds + row counts look sane
node --env-file=.env.local -e "
const {createClient}=require('@supabase/supabase-js');
const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
(async()=>{const tables=['profiles','saved_searches','source_configs','raw_jobs','jobs','job_events','worker_runs','worker_state','ai_usage','transactions','merchant_rules','money_reviews','decisions','decision_pattern_reviews','weekly_reviews','routines','routine_checkins','storage_kv'];
for(const t of tables){const r=await sb.from(t).select('*',{count:'exact',head:true});console.log(t.padEnd(30),r.error?'ERR '+r.error.message:'count='+r.count);}})();"

# 2) Read/write roundtrip via the storage façade
node --env-file=.env.local --loader=ts-node/esm -e "
import('./src/lib/storage/index.ts').then(async m=>{
  await m.writeObject('__verify_test', {ts: new Date().toISOString()});
  const back = await m.readObject('__verify_test');
  console.log('roundtrip:', back);
});"

# 3) Auth session mock
curl -s http://localhost:3000/api/profile | jq
# Expected: {"user":{"id":"aa56d89e-…","email":"mohamed.magdy.tc@gmail.com", …}}
```

## Exit criteria

- [ ] Every file above ✅.
- [ ] Smoke tests 1–3 pass.
- [ ] Decision table for `storage_kv` vs SQL is filled in.
- [ ] `ai_log` migration is either applied OR explicitly deferred with a ticket reference.
- [ ] Update `Status:` at the top.
