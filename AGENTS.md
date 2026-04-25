# Life OS

## Stack
- Single-package `npm` repo. Main app is Next.js 14 App Router + strict TypeScript.
- `python-ai/` is a separate FastAPI sidecar with its own venv and tests.
- Local-first runtime is the default shape of the repo: Ollama + JSON data files under `data/*.json`.

## First Commands
- Install root deps with `npm install`.
- Preferred local startup is `npm run local:start`, then `npm run local:doctor`.
- `local:start` auto-creates `python-ai/.venv`, starts Ollama if needed, starts the Python sidecar on `:8800`, and starts Next.js on `:3000`.

## Verification
- Root JS checks are `npm run lint`, `npm run typecheck`, and `npm run build`.
- `npm run typecheck` runs `scripts/clean-next-artifacts.mjs --types` first; `npm run build` runs `--all` first. Expect `.next/types`, `.next`, and `tsconfig.tsbuildinfo` to be deleted before those commands.
- There is no root `npm test` script and no repo CI workflow checked in.
- End-to-end local stack verification is `npm run local:doctor`.
- Python sidecar checks run from `python-ai/`: `.venv\Scripts\python.exe -m pytest tests/test_parse_and_evaluate.py -q` and `.venv\Scripts\python.exe -m ruff check .`.

## Architecture
- Main UI/manual smoke targets are `/career` and `/settings`; those pages mount `src/features/career/career-dashboard.tsx` and `src/features/settings/settings-panel.tsx`.
- Job pipeline entrypoint is `src/app/api/jobs/pipeline/route.ts`; orchestration lives in `src/lib/jobs/pipeline/index.ts` and source adapters live in `src/lib/jobs/sources/*.ts`.
- The standalone worker is `scripts/worker.mjs`, but it does not import TS worker code directly; it calls the running app over `/api/worker/*`. Keep `npm run dev` running before `npm run worker` or `npm run worker:once`.
- Storage writes go through `src/lib/storage/index.ts`. Without a usable Supabase service client, server writes fall back to local JSON files.
- Supabase schema history lives in `supabase/migrations/`, but local mode is still a first-class path in current code.

## Important Gotchas
- `LIFE_OS_LOCAL_ONLY=true` or `NEXT_PUBLIC_LIFE_OS_LOCAL_ONLY=true` forces preview-user mode and forces the AI config back to Ollama/local even if older cloud config or Supabase env exists.
- `USE_PYTHON_AI=true` only affects selected AI routes. `/api/ai/parse-job` and `/api/ai/evaluate-job` proxy to the Python sidecar when reachable, but both routes fall back to the TS implementation on sidecar failure.
- The Python sidecar is stateless. Storage still happens on the TS side.
- On Cloud Run without Supabase, `src/lib/storage/index.ts` writes to `/tmp/data`, which is ephemeral across restarts.
- `python-ai/tests/test_parse_and_evaluate.py` has one real LLM round-trip test, but it is skipped unless `LLM_URL`, `GEMINI_API_KEY`, or `OPENAI_API_KEY` is set. The fallback/heuristic tests still run without provider secrets.
