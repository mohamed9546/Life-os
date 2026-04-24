# Chunk 5 — Worker, scraper, deploy, top-level glue

**Status:** not started

**Scope:** The standalone worker, scrapers, deploy scripts, Docker /
systemd setup, and the top-level things that aren't a feature:
`layout.tsx`, `providers.tsx`, global CSS, `components/ui`, and the
odd `test-*.ts` / `reset-config.ts` files at the repo root.

**Run Chunks 1–4 first.** This chunk verifies that all the things
Chunks 1–4 built actually run in the background and on the deployed
server.

---

## File inventory

### Worker

- [ ] [scripts/worker.mjs](../scripts/worker.mjs) — standalone entry; hits local API
- [ ] [src/lib/worker/](../src/lib/worker/) — task-runner + registry + run-history
- [ ] [src/app/api/worker/](../src/app/api/worker/) — config / run / status endpoints
- [ ] Confirm `WORKER_USER_ID` uses `LIFE_OS_DEFAULT_USER_ID` (already done, re-verify here)
- [ ] Confirm every task in `DEFAULT_TASK_CONFIGS` either has a real implementation or an explicit `TODO` stub

### Scraper

- [ ] [src/lib/scraper/](../src/lib/scraper/)
  - [ ] [src/lib/scraper/ai-extractor.ts](../src/lib/scraper/ai-extractor.ts) — uses `extract-job-from-scrape` + `extract-job-list-from-scrape` (added to AI_TASK_ORDER in today's fix)
  - [ ] [src/lib/scraper/scrape-board/](../src/lib/scraper/scrape-board/)
  - [ ] [src/lib/scraper/scrape-job/](../src/lib/scraper/scrape-job/)
  - [ ] [src/lib/scraper/health/](../src/lib/scraper/health/)
- [ ] [src/app/api/scraper/](../src/app/api/scraper/) — on-demand scrape routes

### Deploy

- [ ] [Dockerfile](../Dockerfile) — multi-stage, standalone output
- [ ] [docker-compose.yml](../docker-compose.yml)
- [ ] [deploy/setup-vm.sh](../deploy/setup-vm.sh) — Debian-12 VM bootstrap
- [ ] [deploy/life-os.service](../deploy/life-os.service) — systemd unit
- [ ] [deploy/update.sh](../deploy/update.sh)
- [ ] [deploy/env.example](../deploy/env.example) — already updated today with `LIFE_OS_DEFAULT_USER_ID`. Confirm the real `/opt/life-os/env` on the VM has it.
- [ ] [deploy/cloudflared.example.yml](../deploy/cloudflared.example.yml) — tunnel config

### Top-level glue

- [ ] [src/app/layout.tsx](../src/app/layout.tsx)
- [ ] [src/app/providers.tsx](../src/app/providers.tsx)
- [ ] [src/app/page.tsx](../src/app/page.tsx) — landing
- [ ] [src/app/globals.css](../src/app/globals.css)
- [ ] [src/components/](../src/components/) — UI kit + shared components. Verify `ui/system.tsx` is the only panel/button/status-chip source.
- [ ] [tailwind.config.ts](../tailwind.config.ts), [postcss.config.js](../postcss.config.js), [next.config.js](../next.config.js)
- [ ] [middleware.ts](../middleware.ts) (root)
- [ ] [tsconfig.json](../tsconfig.json)
- [ ] [package.json](../package.json) — every script runs; deps are pinned to safe ranges
- [ ] [scripts/clean-next-artifacts.mjs](../scripts/clean-next-artifacts.mjs)
- [ ] [scripts/export-workspace-json.mjs](../scripts/export-workspace-json.mjs)
- [ ] [scripts/migrate-local-to-supabase.ts](../scripts/migrate-local-to-supabase.ts) — confirm it matches current schema

### Loose files at the repo root

Decide: keep, move to `scripts/`, or delete.

- [ ] [test-adapters.ts](../test-adapters.ts)
- [ ] [test-adzuna.ts](../test-adzuna.ts)
- [ ] [test-config.ts](../test-config.ts)
- [ ] [test-pdf.ts](../test-pdf.ts)
- [ ] [test-pipeline.ts](../test-pipeline.ts)
- [ ] [test-read.ts](../test-read.ts)
- [ ] [reset-config.ts](../reset-config.ts)
- [ ] [implementation_plan.md.resolved](../implementation_plan.md.resolved) — stale doc?
- [ ] [life-os-source.json](../life-os-source.json), [life-os-workspace.json](../life-os-workspace.json) — keep or gitignore?
- [ ] [skills-lock.json](../skills-lock.json)

### Health & CI

- [ ] [src/app/api/debug/](../src/app/api/debug/) — debug endpoints; confirm these are disabled in production OR behind admin gate
- [ ] [src/app/health/page.tsx](../src/app/health/page.tsx) + [src/app/api/health/route.ts](../src/app/api/health/route.ts)

---

## Issues found (append as you go)

_None recorded yet._

---

## Smoke tests

```bash
# 1) Docker build succeeds
docker build -t life-os:verify .

# 2) Standalone worker single pass
npm run worker:once
# Watch: every enabled task either runs to success or logs a graceful skip

# 3) On the deployed VM (cloud persistence lane)
ssh <vm> 'cat /opt/life-os/env | grep LIFE_OS_DEFAULT_USER_ID'
# Expected: LIFE_OS_DEFAULT_USER_ID=aa56d89e-f36e-4287-a958-476a282bf64e

# 4) App health on the VM
ssh <vm> 'curl -s http://127.0.0.1:8080/api/ai/health' | jq
# Expected: .health.available == true

# 5) Phone-facing smoke (via Cloudflare tunnel)
curl -s https://<your-tunnel-hostname>/api/jobs/stats | jq
# Expected: same counts as local Chunk 2 smoke
```

6. **Cleanup pass:** after finishing Chunks 1–5, grep for `TODO`, `FIXME`, `XXX`, `HACK`, `console.log` left in source, and decide per-match whether to fix, keep-with-context, or delete.

## Exit criteria

- [ ] Every file above ✅.
- [ ] Docker build succeeds.
- [ ] `npm run worker:once` completes without fatal errors.
- [ ] Deployed VM and phone show the same job counts as the laptop.
- [ ] Cleanup pass reduces stray `console.log` to intentional logging only.
- [ ] Update `Status:` at the top.
- [ ] Final sweep: set every chunk's `Status:` to `verified (YYYY-MM-DD)` and open a PR with all the changes.
