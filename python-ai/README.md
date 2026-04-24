# life-os-ai

Python AI sidecar for Life OS. Gemini-primary, OpenAI-fallback.
Stateless. Ported from `src/lib/ai/tasks/` so the two implementations
can run side-by-side during migration via the `USE_PYTHON_AI` feature
flag on the TS side.

Status: **v0.1** -- parse-job + evaluate-job ported. Everything else
still lives in TypeScript.

## Endpoints

| Endpoint            | Purpose                                      |
|---------------------|----------------------------------------------|
| `GET  /health`      | Liveness + which providers are configured    |
| `POST /parse-job`   | `{rawText, metadata?}` -> `{success, data, meta}` |
| `POST /evaluate-job`| `{job, profile?}` -> `{success, data, meta}`   |

Request / response shapes mirror the TS versions exactly -- see
`life_os_ai/schemas.py`. A TS client that already hits
`/api/ai/parse-job` doesn't need to know whether the handler ran TS
or Python.

## Local dev

```bash
cd python-ai
python -m venv .venv
source .venv/bin/activate   # or .venv/Scripts/activate on Windows
pip install -e ".[dev]"

# Env -- at least one must be set.
export GEMINI_API_KEY=...
# or
export OPENAI_API_KEY=...

# Optional:
export GEMINI_MODEL=gemini-2.5-flash   # default
export OPENAI_MODEL=gpt-4o-mini        # default
export LIFE_OS_PROFILE_PATH=./profile.json   # optional inline profile

# Run it
python -m life_os_ai
# or with reload:
RELOAD=1 python -m life_os_ai
```

## Smoke tests

```bash
# Health
curl -s http://127.0.0.1:8000/health | jq

# Parse a job
curl -s -X POST http://127.0.0.1:8000/parse-job \
  -H "Content-Type: application/json" \
  -d '{"rawText":"Clinical Trial Assistant wanted in Glasgow. Entry-level role supporting trial master file maintenance and site activation paperwork. GCP awareness preferred."}' | jq

# Evaluate a parsed job
curl -s -X POST http://127.0.0.1:8000/evaluate-job \
  -H "Content-Type: application/json" \
  -d '{"job":{"title":"Clinical Trial Assistant","company":"Iqvia","location":"Glasgow","salaryText":null,"employmentType":"permanent","seniority":"entry","remoteType":"hybrid","roleFamily":"Clinical Operations","roleTrack":"clinical","mustHaves":["GCP awareness"],"niceToHaves":[],"redFlags":[],"keywords":["tmf","gcp"],"summary":"Entry-level CTA supporting TMF maintenance.","confidence":0.8}}' | jq
```

## Wiring into the TS app

Add to `.env.local` (or Cloud Run env):

```
PYTHON_AI_URL=http://127.0.0.1:8000         # local dev
# PYTHON_AI_URL=https://life-os-ai-xxx.run.app   # production
USE_PYTHON_AI=true
```

When `USE_PYTHON_AI=true` AND `PYTHON_AI_URL` is reachable, `/api/ai/parse-job`
and `/api/ai/evaluate-job` proxy to this service. On any sidecar error the
TS routes fall back to their local implementations automatically -- the main
app never breaks because the sidecar is broken.

## Deploy (Cloud Run)

```bash
# Build & push
gcloud builds submit python-ai \
  --tag europe-west1-docker.pkg.dev/project-f59be79a-0177-483d-969/life-os/life-os-ai:latest

# Deploy
gcloud run deploy life-os-ai \
  --project=project-f59be79a-0177-483d-969 \
  --region=europe-west1 \
  --image=europe-west1-docker.pkg.dev/project-f59be79a-0177-483d-969/life-os/life-os-ai:latest \
  --platform=managed \
  --port=8080 \
  --cpu=1 \
  --memory=512Mi \
  --concurrency=10 \
  --min-instances=0 \
  --max-instances=4 \
  --set-env-vars=GEMINI_API_KEY=...,OPENAI_API_KEY=...

# Get the URL and set PYTHON_AI_URL on the main life-os service
gcloud run services update life-os \
  --project=project-f59be79a-0177-483d-969 \
  --region=europe-west1 \
  --update-env-vars=PYTHON_AI_URL=https://life-os-ai-xxx.europe-west1.run.app,USE_PYTHON_AI=true
```

## Architecture note

The sidecar is **stateless**. It doesn't talk to Supabase. It takes JSON
in, returns JSON out. Storage writes happen on the TS side, which means:

- The Python service can be rebuilt / redeployed without data loss.
- The profile can be passed inline per-request (TS owns the profile store).
- Rate-limit windows are per-instance -- Cloud Run autoscales to handle
  bursts.

If later we want the Python service to own DB writes (e.g. to pull
backlog from `raw_jobs`), it'll get its own Supabase client -- but not yet.

## Credits

LLM client pattern (Gemini compat + native fallback, Retry-After
handling) adapted from
[ApplyPilot](https://github.com/Pickle-Pixel/ApplyPilot).
