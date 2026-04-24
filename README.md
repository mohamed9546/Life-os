# Life OS

Single-tenant personal operating system. Ingests jobs from 20+ UK/remote
sources, scores them against a career profile with Gemini, and keeps
everything — jobs, money, decisions, routines, weekly reviews —
synced to Supabase so the laptop and phone see the same state.

Built with Next.js 14 (App Router), TypeScript, Tailwind, and Supabase
(Postgres + RLS + `storage_kv`).

---

## Features

- **Career pipeline.** Pulls jobs in parallel from Adzuna, Reed, Jooble,
  Findwork, The Muse, Greenhouse, Lever, Remotive, Himalayas, SerpAPI,
  LinkedIn (scraped / RapidAPI), Guardian, Careerjet, WeWorkRemotely,
  Arbeitnow, Bright Network, Indeed RSS, TotalJobs, Jobs.ac.uk.
  Dedupe across all sources, Gemini parse + fit-score, deterministic
  relevance gates, kanban tracker.
- **AI analyst.** Paste any job posting, get structured parse + fit
  score + action recommendation. Fallback to heuristic scoring when
  Gemini is rate-limited or down.
- **Career tools.** Cover-letter generator, CV optimizer (ATS score),
  interview prep, salary lookup, skill-gap analyzer.
- **Life OS surfaces.** Money (transaction categorization + weekly
  money review), decisions (pattern review), routines (streaks + AI
  focus suggestion), goals, journal, weekly review, morning briefing.
- **Background worker.** `npm run worker` — continuous loop that runs
  enabled tasks (fetch / enrich / weekly review / money review) on a
  schedule with rate-limit awareness.
- **Cloud persistence.** Writes go through a thin storage façade that
  prefers Supabase and falls back to `data/*.json` on disk. Your
  laptop can be closed and your phone still sees everything.

## Architecture

```
Next.js app (pages + API routes)
        │
        ├── /career, /money, /decisions, /routines, … (UI)
        │
        ├── /api/jobs/pipeline  → runFullPipeline()
        │     fetch → dedupe → enrich (AI) → rank
        │
        ├── /api/ai/{parse-job, evaluate-job, chat, …}
        │     → callAI() → Gemini / Ollama / OpenAI-compat
        │
        └── storage layer
              ├── Supabase (primary) — profiles, jobs, raw_jobs,
              │                       worker_state, storage_kv, …
              └── data/*.json (fallback on laptop / /tmp on Cloud Run)

scripts/worker.mjs — standalone Node worker that POSTs to the app's
                     own /api/worker/* endpoints
```

Key files:

- [src/app/career/page.tsx](src/app/career/page.tsx) + [src/features/career/career-dashboard.tsx](src/features/career/career-dashboard.tsx) — flagship UI
- [src/lib/jobs/pipeline/](src/lib/jobs/pipeline/) — `runFullPipeline`, `deduplicateJobs`, `enrichJobs`, `rankJobs`, `evaluate*Relevance`
- [src/lib/jobs/sources/](src/lib/jobs/sources/) — one adapter per source, all implementing `JobSourceAdapter`
- [src/lib/ai/client.ts](src/lib/ai/client.ts) — unified `callAI` with Gemini/Ollama/OpenAI/Anthropic compat
- [src/lib/ai/tasks/](src/lib/ai/tasks/) — one file per AI task (prompt + schema + fallback)
- [src/lib/storage/index.ts](src/lib/storage/index.ts) — Supabase-first, disk-fallback façade
- [supabase/migrations/](supabase/migrations/) — schema (profiles, jobs, raw_jobs, storage_kv, …)

## Getting started (local)

1. **Prereqs:** Node 20+, a Supabase project.
2. **Clone + install:**
   ```bash
   git clone https://github.com/mohamed9546/Life-os.git
   cd Life-os
   npm install
   ```
3. **Env setup:** copy `deploy/env.example` to `.env.local` and fill in:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
   GEMINI_API_KEY=...

   # Must be a real UUID from auth.users that owns your data:
   LIFE_OS_DEFAULT_USER_ID=<your-auth-user-id>
   LIFE_OS_DEFAULT_USER_EMAIL=<your-email>

   # Optional source API keys:
   ADZUNA_APP_ID=
   ADZUNA_APP_KEY=
   REED_API_KEY=
   THEMUSE_API_KEY=
   JOOBLE_API_KEY=
   FINDWORK_API_KEY=
   SERP_API_KEY=
   APOLLO_API_KEY=
   ```
4. **Apply migrations** against your Supabase:
   ```bash
   # via Supabase CLI (recommended)
   supabase db push

   # or paste each file from supabase/migrations/ into the SQL editor
   ```
5. **Run:**
   ```bash
   npm run dev
   # in another shell:
   npm run worker:once   # single background-task pass (optional)
   ```
6. Open http://localhost:3000/career. Click **Run Pipeline**. You
   should see `~100–400` jobs fetched, de-duped, ranked within ~1 min
   per enabled source.

## Deployment (Debian VM / GCE e2-medium)

```bash
# On a fresh VM:
curl -fsSL https://raw.githubusercontent.com/mohamed9546/Life-os/main/deploy/setup-vm.sh | bash

# Then edit /opt/life-os/env with real values (including
# LIFE_OS_DEFAULT_USER_ID) and:
sudo systemctl restart life-os
sudo journalctl -u life-os -f
```

The app listens on `127.0.0.1:8080`. Front with Caddy, nginx, or a
Cloudflare tunnel — see [deploy/cloudflared.example.yml](deploy/cloudflared.example.yml).

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Next.js dev server on :3000 |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run worker` | Continuous background worker |
| `npm run worker:once` | Single worker pass |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `node scripts/migrate-local-to-supabase.ts` | Seed Supabase from local JSON |

## Verification

A line-by-line verification plan lives in
[verification-plan/](verification-plan/) — 5 chunks, one per subsystem.
Recommended order: Career+AI → Jobs pipeline → Storage/auth → other
Life OS surfaces → Worker/deploy.

## Recent fixes

- **Cloud persistence end-to-end** (2026-04-24): pipeline + worker now
  write as the real Supabase auth UUID (via `LIFE_OS_DEFAULT_USER_ID`)
  instead of a placeholder string, so FK-guarded writes to
  `raw_jobs` / `jobs` actually succeed.
- **Missing AI task types** (2026-04-24): added 7 task types
  (`cover-letter`, `cv-optimize`, `interview-prep`, `salary-lookup`,
  `skill-gap`, `extract-job-from-scrape`, `extract-job-list-from-scrape`)
  that several routes were passing to `callAI()` — the lookup was
  returning `undefined` and crashing `getTaskRuntimeSettings`.
- **Pipeline returning zero jobs** (2026-04-24): `searchesToQueries`
  used to pass `["phrase a", "phrase b", …]` as one combined query to
  every adapter. Adzuna/Reed/etc. treat `what` as AND-joined, so
  nothing matched. Now one query per phrase, de-duped at the pipeline
  level.

## License

Private project. No license granted.
