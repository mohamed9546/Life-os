# Chunk 2 — Jobs pipeline + sources

**Status:** not started

**Scope:** Everything that feeds raw jobs into the ranked inbox. The
pipeline orchestrator, dedupe, enrich, rank, relevance gates, and every
source adapter (22 of them). Also the source-configuration API.

**Do Chunk 1 first.** Chunk 2 assumes the AI task config is clean and
the Supabase connection works.

---

## File inventory

### Pipeline core

- [ ] [src/lib/jobs/pipeline/index.ts](../src/lib/jobs/pipeline/index.ts) — `runFullPipeline`; parallel adapters, sequential queries per adapter
  - Confirm: `Promise.all(adapters.map(...))` does not silently swallow partial failures
  - Confirm: `dedupeResult.newJobs` is what gets saved — duplicates are dropped
- [ ] [src/lib/jobs/pipeline/dedupe.ts](../src/lib/jobs/pipeline/dedupe.ts)
  - Verify: `getAllDedupeKeys()` union across raw + enriched + inbox + ranked + rejected is correct
  - Verify: `generateDedupeKey` strategy (title + company + link; fallback to title + company + location) matches docs
- [ ] [src/lib/jobs/pipeline/enrich.ts](../src/lib/jobs/pipeline/enrich.ts)
  - Verify: rate-limit break breaks both inner loops cleanly
  - Verify: `buildContactStrategy` errors don't corrupt the enriched record — check try/catch
- [ ] [src/lib/jobs/pipeline/rank.ts](../src/lib/jobs/pipeline/rank.ts) — `computeSortScore`: hand-trace one job through all bonuses/penalties
- [ ] [src/lib/jobs/pipeline/relevance.ts](../src/lib/jobs/pipeline/relevance.ts) — hard-reject keywords; verify FINANCE_TERMS, WET_LAB_TERMS, OTHER_HARD_NEGATIVES reflect current intent
- [ ] [src/lib/jobs/pipeline/runs.ts](../src/lib/jobs/pipeline/runs.ts) — persistent run records (keep across restarts)
- [ ] [src/lib/jobs/pipeline/config.ts](../src/lib/jobs/pipeline/config.ts) — budget profiles (manual vs worker)
- [ ] [src/lib/jobs/storage.ts](../src/lib/jobs/storage.ts) — the user-scoped façade; already touched in today's cloud-persistence fix
- [ ] [src/lib/jobs/selectors.ts](../src/lib/jobs/selectors.ts)

### Source adapters

Each adapter implements `JobSourceAdapter` from `sources/types.ts`.
For each: confirm `isConfigured()`, `fetchJobs(query)`, normalize output,
and handle API errors (never throw to caller — return `{ jobs: [], error }`).

- [ ] [src/lib/jobs/sources/index.ts](../src/lib/jobs/sources/index.ts) — registry + `DEFAULT_SEARCH_QUERIES`
- [ ] [src/lib/jobs/sources/normalize.ts](../src/lib/jobs/sources/normalize.ts) — `generateDedupeKey`, `normalizeRawJob`
- [ ] [src/lib/jobs/sources/types.ts](../src/lib/jobs/sources/types.ts)
- [ ] [src/lib/jobs/sources/adzuna.ts](../src/lib/jobs/sources/adzuna.ts) — UK-specific, 1000 req/day
- [ ] [src/lib/jobs/sources/reed.ts](../src/lib/jobs/sources/reed.ts) — UK-specific, strong coverage
- [ ] [src/lib/jobs/sources/themuse.ts](../src/lib/jobs/sources/themuse.ts)
- [ ] [src/lib/jobs/sources/findwork.ts](../src/lib/jobs/sources/findwork.ts)
- [ ] [src/lib/jobs/sources/jooble.ts](../src/lib/jobs/sources/jooble.ts)
- [ ] [src/lib/jobs/sources/careerjet.ts](../src/lib/jobs/sources/careerjet.ts) — affiliate-gated
- [ ] [src/lib/jobs/sources/guardianjobs.ts](../src/lib/jobs/sources/guardianjobs.ts)
- [ ] [src/lib/jobs/sources/brightnetwork.ts](../src/lib/jobs/sources/brightnetwork.ts)
- [ ] [src/lib/jobs/sources/arbeitnow.ts](../src/lib/jobs/sources/arbeitnow.ts)
- [ ] [src/lib/jobs/sources/greenhouse.ts](../src/lib/jobs/sources/greenhouse.ts) — board-specific
- [ ] [src/lib/jobs/sources/lever.ts](../src/lib/jobs/sources/lever.ts) — board-specific
- [ ] [src/lib/jobs/sources/remotive.ts](../src/lib/jobs/sources/remotive.ts)
- [ ] [src/lib/jobs/sources/himalayas.ts](../src/lib/jobs/sources/himalayas.ts)
- [ ] [src/lib/jobs/sources/weworkremotely.ts](../src/lib/jobs/sources/weworkremotely.ts)
- [ ] [src/lib/jobs/sources/indeed.ts](../src/lib/jobs/sources/indeed.ts) — **disabled** (INDEED_ENABLED=false). Confirm adapter refuses to fetch when flag is off.
- [ ] [src/lib/jobs/sources/totaljobs.ts](../src/lib/jobs/sources/totaljobs.ts)
- [ ] [src/lib/jobs/sources/jobsac.ts](../src/lib/jobs/sources/jobsac.ts)
- [ ] [src/lib/jobs/sources/linkedin.ts](../src/lib/jobs/sources/linkedin.ts)
- [ ] [src/lib/jobs/sources/linkedin-scraper.ts](../src/lib/jobs/sources/linkedin-scraper.ts)
- [ ] [src/lib/jobs/sources/rapidapi-linkedin.ts](../src/lib/jobs/sources/rapidapi-linkedin.ts)
- [ ] [src/lib/jobs/sources/serpapi.ts](../src/lib/jobs/sources/serpapi.ts)

### Jobs API routes

- [ ] [src/app/api/jobs/pipeline/route.ts](../src/app/api/jobs/pipeline/route.ts) — background-run model via `activeRuns` Set
- [ ] [src/app/api/jobs/fetch/route.ts](../src/app/api/jobs/fetch/route.ts) — single-source fetch
- [ ] [src/app/api/jobs/inbox/route.ts](../src/app/api/jobs/inbox/route.ts)
- [ ] [src/app/api/jobs/ranked/route.ts](../src/app/api/jobs/ranked/route.ts)
- [ ] [src/app/api/jobs/tracked/route.ts](../src/app/api/jobs/tracked/route.ts)
- [ ] [src/app/api/jobs/rejected/route.ts](../src/app/api/jobs/rejected/route.ts)
- [ ] [src/app/api/jobs/actions/route.ts](../src/app/api/jobs/actions/route.ts) — track/reject/apply state changes
- [ ] [src/app/api/jobs/manual/route.ts](../src/app/api/jobs/manual/route.ts) — Analyst save-to-inbox
- [ ] [src/app/api/jobs/dashboard/route.ts](../src/app/api/jobs/dashboard/route.ts)
- [ ] [src/app/api/jobs/stats/route.ts](../src/app/api/jobs/stats/route.ts)
- [ ] [src/app/api/jobs/tailor-cv/route.ts](../src/app/api/jobs/tailor-cv/route.ts)
- [ ] [src/app/api/jobs/[id]/route.ts](../src/app/api/jobs/%5Bid%5D/route.ts) — single-job detail + update
- [ ] [src/app/api/enrichment](../src/app/api/enrichment) — contact/outreach on-demand refresh

### Enrichment sub-module

- [ ] [src/lib/enrichment](../src/lib/enrichment) — Apollo + SERP + outreach AI. Walk each provider file; confirm timeouts and graceful fallback on 401/429.

---

## Issues found (append as you go)

_None recorded yet._

---

## Smoke tests

```bash
# 1) Pipeline end-to-end, fetch-only (cheap)
curl -s -X POST http://localhost:3000/api/jobs/pipeline \
  -H "Content-Type: application/json" \
  -d '{"skipEnrich":true,"skipRank":true,"sources":["adzuna"]}' | jq

# 2) Same, full pipeline on one source
curl -s -X POST http://localhost:3000/api/jobs/pipeline \
  -H "Content-Type: application/json" \
  -d '{"sources":["adzuna"],"maxEnrich":5}' | jq

# 3) Stats — should show both raw + enriched counts climbing
curl -s http://localhost:3000/api/jobs/stats | jq
```

4. **Source health check:** for each adapter, call `/api/jobs/fetch?source=<id>&keywords=clinical+trial+assistant` and confirm `jobsFetched > 0` OR a meaningful `error` string (no silent empties).
5. **Dedupe check:** run the same pipeline twice. Second run should show `dedupedNew: 0` or very close to it in the summary banner.
6. **Ranking check:** pick 3 tracked jobs with very different `fitScore`s and confirm their order in the ranked inbox matches `computeSortScore` output.

## Exit criteria

- [ ] Every file above ✅.
- [ ] Every enabled adapter returned at least 1 job in smoke test #4 (or has a documented reason).
- [ ] Dedupe smoke returns 0 new on the second run.
- [ ] Update `Status:` at the top.
