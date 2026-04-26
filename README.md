# Life OS

Single-tenant personal operating system. It ingests UK/remote job sources, scores roles against a career profile, drafts candidate profile data from CV text, and stores everything on disk in `data/*.json` when running in local-first mode.

Built with Next.js 14, TypeScript, Tailwind, a local Python FastAPI sidecar for selected AI tasks, and configurable AI runtimes spanning Ollama, Gemini, and OpenRouter.

## Features

- **Career pipeline.** Pulls jobs from Adzuna, Reed, Jooble, Findwork, The Muse, Greenhouse, Lever, Remotive, Himalayas, SerpAPI, LinkedIn, Guardian, Careerjet, WeWorkRemotely, Arbeitnow, Indeed RSS, TotalJobs, and Jobs.ac.uk.
- **AI analyst and routing.** Paste a job posting and get structured parse, fit score, and action recommendation. `parse-job` and `evaluate-job` can use Gemini directly or the Python sidecar in local mode; secondary tasks can fall back through OpenRouter.
- **Application automation.** Gmail-backed recommendation pipeline, manual review logs, CV selection, retry/run endpoints, and Gmail-first recommendation prioritisation.
- **OpenCode starter kit.** Local `data/opencode/` workflows for shutdown planning, next-action picking, application follow-up drafting, regulatory watch digests, paper capture, and CTA-first track triage.
- **Contact enrichment fallback.** If live people-search APIs are unavailable, Career still shows suggested contact roles so decision-maker outreach never renders empty.
- **Career tools.** Cover-letter generation, CV optimization, interview prep, salary lookup, skill-gap analysis, and candidate-profile extraction from imported CV text.
- **Life OS surfaces.** Money, decisions, routines, goals, journal, weekly review, morning briefing, and worker status.
- **Local persistence.** `LIFE_OS_LOCAL_ONLY=true` forces Supabase off even if old env keys exist.

## Architecture

```text
Next.js app
  - UI pages and API routes
  - /api/jobs/pipeline -> runFullPipeline()
  - /api/ai/parse-job and /api/ai/evaluate-job -> Gemini or python-ai sidecar depending on runtime
  - /api/profile/candidate and /api/profile/import-cv -> candidate-profile extraction
  - /api/applications/* -> recommendation pipeline, logs, and manual retries
  - other /api/ai/* routes -> primary/secondary AI runtime routing
  - storage -> data/*.json

python-ai FastAPI sidecar
  - GET /health
  - POST /parse-job
  - POST /evaluate-job
  - POST /extract-candidate-profile
  - LLM_URL=http://127.0.0.1:11434/v1
```

Key files:

- [src/features/career/career-dashboard.tsx](src/features/career/career-dashboard.tsx) - flagship career UI
- [src/lib/jobs/pipeline/](src/lib/jobs/pipeline/) - fetch, dedupe, enrich, rank
- [src/lib/jobs/sources/](src/lib/jobs/sources/) - one adapter per job source
- [src/lib/applications/auto-apply.ts](src/lib/applications/auto-apply.ts) - recommendation/application orchestration
- [src/lib/ai/client.ts](src/lib/ai/client.ts) - AI runtime routing and fallback logic
- [python-ai/](python-ai/) - local Python AI sidecar
- [src/lib/storage/index.ts](src/lib/storage/index.ts) - local JSON storage facade

## Getting Started

1. Install Node 20+, Python 3.11+, and Ollama.
2. Install dependencies:

   ```bash
   npm install
   cd python-ai
   python -m venv .venv
   .venv/Scripts/python.exe -m pip install -e ".[dev]"
   cd ..
   ```

3. Copy `.env.local.template` to `.env.local`.

   Local-first defaults:

   ```env
   LIFE_OS_LOCAL_ONLY=true
   OLLAMA_BASE_URL=http://127.0.0.1:11434
   OLLAMA_MODEL=qwen3.5:2b
   USE_PYTHON_AI=true
   PYTHON_AI_URL=http://127.0.0.1:8800
   LLM_URL=http://127.0.0.1:11434/v1
   LLM_MODEL=qwen3.5:2b
   ```

   Cloud runtime notes:

   - Keep `GEMINI_API_KEY` and `OPENROUTER_API_KEY` in `.env.local` only.
   - Do not persist provider keys into `data/*.json`.
   - `LIFE_OS_LOCAL_ONLY=true` forces the app back to local-first behavior even if cloud keys exist.

4. Pull the local model:

   ```bash
   ollama pull qwen3.5:2b
   ```

5. Start and verify the local stack:

   ```bash
   npm run local:start
   npm run local:doctor
   ```

6. Open http://127.0.0.1:3000/settings or http://127.0.0.1:3000/career.

## Scripts

| Script | What it does |
|---|---|
| `npm run local:start` | Starts Ollama checks, Python sidecar on `:8800`, and Next.js on `:3000` |
| `npm run local:doctor` | Checks Ollama, sidecar, Settings API, AI health, parse-job, and evaluate-job |
| `npm run dev` | Next.js dev server |
| `npm run worker` | Continuous background worker; against a local dev server it now refuses by default unless you opt in |
| `npm run worker:once` | Single worker pass |
| `npm run opencode:shutdown` | Interactive shutdown ritual that writes tomorrow's top 3 into `data/opencode/` |
| `npm run opencode:next` | Picks the next best action from tomorrow notes, tasks, and application state |
| `npm run opencode:apps-status` | Rebuilds the local application-ops snapshot and markdown dashboard |
| `npm run opencode:followup-check` | Generates first/second follow-up drafts from stale applications |
| `npm run opencode:track-triage` | CTA-first job-track triage for a pasted JD or file |
| `npm run opencode:ats-score` | Deterministic ATS-style keyword coverage score for JD and CV files |
| `npm run opencode:paper-grab` | Pulls PubMed/Crossref metadata into a reusable paper note |
| `npm run opencode:reg-watch` | Fetches MHRA/FDA bulletin feeds into a local digest |
| `npm run lint` | ESLint check |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Production build check |

For local development, prefer `npm run worker:once`. Continuous local worker mode is opt-in via `node scripts/worker.mjs --allow-continuous-dev` or `WORKER_ALLOW_CONTINUOUS_DEV=true`.

## Data

`data/*.json` is the local source of truth. Back it up before destructive changes. Backups created by local migration work live under `backups/` and are intentionally ignored by git.

`data/opencode/` is the local OpenCode working area for shutdown notes, follow-up drafts, paper notes, and regulatory digests.

Cloud/provider secrets should stay env-only. Do not store Gemini, OpenRouter, or other provider keys in tracked files or `data/*.json`.

If you want tracked sensitive exports, use encrypted `.age` files under `private/` and see [docs/opencode-privacy.md](docs/opencode-privacy.md).
