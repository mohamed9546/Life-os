# Life OS: Complete Application Explanation

## Purpose

Life OS is a local-first operating system for personal execution, with a strong emphasis on career transition workflow.

Its current centre of gravity is the **career pipeline**: discover jobs, filter junk, parse roles, score fit, rank the shortlist, support manual application review, and maintain follow-up cadence.

Around that core, the app also provides:

- AI task routing and structured generation
- Gmail-assisted job discovery
- routines, journal, goals, decisions, money, and weekly review modules
- worker-based automation
- an OpenCode toolkit layer for fast operational actions and knowledge capture

The application is designed to keep working without cloud infrastructure. When Supabase is unavailable, state is stored locally in `data/*.json`.

## Main Surfaces

The most important pages are:

- [`/career`](../src/app/career/page.tsx)
- [`/life-os`](../src/app/life-os/page.tsx)
- [`/automation`](../src/app/automation/page.tsx)
- [`/settings`](../src/app/settings/page.tsx)

You can think of the app as five stacked layers:

1. **Career execution**
2. **AI runtime and task routing**
3. **Life OS reflection and planning**
4. **Automation and worker control**
5. **OpenCode toolkit and local operator workflows**

## Technology Stack

The application uses:

- **Next.js 14 App Router**
- **React + TypeScript**
- **Tailwind CSS**
- **Local JSON storage** via `data/*.json`
- **Optional Supabase** as a remote persistence layer
- **Optional Python FastAPI sidecar** for selected AI tasks
- **AI runtimes**:
  - Ollama for local inference
  - Gemini direct API as the primary cloud runtime
  - OpenRouter as optional fallback

Key infrastructure files:

- [`src/lib/storage/index.ts`](../src/lib/storage/index.ts)
- [`src/lib/ai/client.ts`](../src/lib/ai/client.ts)
- [`src/lib/ai/config.ts`](../src/lib/ai/config.ts)
- [`python-ai/`](../python-ai/)

## Career System

## What the Career System Does

The Career system is the flagship workflow.

It is responsible for:

- pulling jobs from multiple sources
- deduplicating and storing raw source records
- rejecting obvious off-target roles early
- parsing jobs into structured data
- evaluating fit against the user profile
- ranking the shortlist
- exposing inbox and tracked pipeline views
- supporting manual application review, contact strategy, outreach, and follow-up

Main UI:

- [`src/features/career/career-dashboard.tsx`](../src/features/career/career-dashboard.tsx)

Important support components:

- [`src/components/job-detail-panel.tsx`](../src/components/job-detail-panel.tsx)
- [`src/components/filter-bar.tsx`](../src/components/filter-bar.tsx)
- [`src/features/career/open-code-apps-status.tsx`](../src/features/career/open-code-apps-status.tsx)

## Core Job Types

The core types are defined in:

- [`src/types/index.ts`](../src/types/index.ts)

The two most important types are:

- `RawJobItem`
- `EnrichedJob`

`RawJobItem` is a fetched source record.

`EnrichedJob` wraps that raw record plus:

- parsed AI output
- fit evaluation
- workflow status
- contact intelligence
- outreach strategy
- follow-up metadata

## Source Adapters

Source adapters live under:

- [`src/lib/jobs/sources/`](../src/lib/jobs/sources/)

Current examples include:

- Adzuna
- Reed
- Jobs.ac.uk
- Totaljobs
- LinkedIn public search
- Guardian Jobs
- We Work Remotely
- Arbeitnow
- Remotive
- Himalayas
- Greenhouse
- Lever
- NHS Jobs

Registry:

- [`src/lib/jobs/sources/index.ts`](../src/lib/jobs/sources/index.ts)

## CTA-First Search Posture

The system is now deliberately **CTA-first**.

That means primary emphasis is placed on roles like:

- Clinical Trial Assistant
- Clinical Trials Assistant
- Clinical Trial Associate
- Clinical Research Assistant
- Clinical Research Coordinator
- Trial Coordinator
- Clinical Operations Assistant
- Study Start-Up Assistant / Coordinator
- Site Activation Assistant / Coordinator
- Trial Administrator

Default search posture and saved-search generation live in:

- [`src/lib/jobs/sources/types.ts`](../src/lib/jobs/sources/types.ts)
- [`src/lib/career/defaults.ts`](../src/lib/career/defaults.ts)

QA, regulatory, and medinfo are still supported, but are treated as secondary lanes rather than first-choice visibility.

## Ranked Shortlist Behaviour

The ranked inbox now has explicit visibility modes:

- **CTA-first**
- **Secondary lanes**
- **All ranked**

That logic lives in:

- [`src/features/career/career-dashboard.tsx`](../src/features/career/career-dashboard.tsx)

The default intent is:

- show CTA and close clinical-trial-support jobs first
- keep QA / regulatory / medinfo available but not dominant
- preserve access to the broader ranked pool when needed

## Pipeline Flow

Primary API entrypoint:

- [`src/app/api/jobs/pipeline/route.ts`](../src/app/api/jobs/pipeline/route.ts)

Pipeline orchestration:

- [`src/lib/jobs/pipeline/index.ts`](../src/lib/jobs/pipeline/index.ts)

High-level stages:

1. Fetch jobs from enabled source adapters
2. Import Gmail-derived job alerts when enabled
3. Filter and deduplicate raw jobs
4. Run strict relevance gating
5. Parse jobs into structured fields
6. Evaluate fit against the user profile
7. Save inbox / ranked / rejected state
8. Optionally continue into application-review automation

Core pipeline files:

- [`src/lib/jobs/pipeline/index.ts`](../src/lib/jobs/pipeline/index.ts)
- [`src/lib/jobs/pipeline/enrich.ts`](../src/lib/jobs/pipeline/enrich.ts)
- [`src/lib/jobs/pipeline/relevance.ts`](../src/lib/jobs/pipeline/relevance.ts)
- [`src/lib/jobs/pipeline/rank.ts`](../src/lib/jobs/pipeline/rank.ts)

## Relevance Gating and Junk Rejection

The app now rejects or heavily penalises broad categories of off-target roles before they become useful shortlist items.

Examples include:

- tax / finance / accounting
- offshore / oil & gas / rig-moving
- hospitality and food & beverage
- aviation security
- IT support / helpdesk
- driver / logistics / industrial operator roles
- unrelated senior / leadership roles
- radiography and unrelated allied-health delivery roles

This logic lives in:

- [`src/lib/jobs/pipeline/relevance.ts`](../src/lib/jobs/pipeline/relevance.ts)

This was added because broad public sources were previously allowing too many false positives into the ranked inbox.

## Parsing and Fit Evaluation

Structured parsing task:

- [`src/lib/ai/tasks/parse-job.ts`](../src/lib/ai/tasks/parse-job.ts)

Fit evaluation task:

- [`src/lib/ai/tasks/evaluate-job.ts`](../src/lib/ai/tasks/evaluate-job.ts)

Important recent improvements:

- synthetic prefixes like `Title:` are normalised away
- `Remote: unknown` no longer incorrectly marks roles as remote
- fallback matching is stricter for short acronyms
- CTA aliases are prioritised more explicitly

Both tasks still retain fallback behaviour so the system stays operational during AI failures.

## Gmail-Assisted Discovery

Gmail job alert handling lives in:

- [`src/lib/applications/gmail.ts`](../src/lib/applications/gmail.ts)
- [`src/app/api/gmail/sync-alerts/route.ts`](../src/app/api/gmail/sync-alerts/route.ts)

Current behaviour:

- scans the last `3d`
- detects job-alert-like emails
- looks for CTA-relevant signals
- identifies alert sources such as LinkedIn, Indeed, Totaljobs, IrishJobs, and NHS Jobs
- uses AI extraction first to pull one or more jobs from an email body
- falls back to source-specific heuristic parsing if needed

This Gmail discovery is now integrated into:

- manual pipeline runs
- recommendation pipeline runs
- worker full-pipeline runs

## Application Review Flow

Review-first application orchestration:

- [`src/lib/applications/auto-apply.ts`](../src/lib/applications/auto-apply.ts)

What it does:

- identifies eligible jobs
- applies stricter safety gating before review drafting
- selects or tailors a CV
- drafts outreach or application-review material
- creates Gmail review drafts where relevant
- records application log entries

This is still a **manual review system**, not a silent autonomous submitter.

Application log storage:

- [`src/lib/applications/storage.ts`](../src/lib/applications/storage.ts)

## AI Runtime Layer

The app has a central AI routing layer that decides which runtime executes which task.

Core files:

- [`src/lib/ai/client.ts`](../src/lib/ai/client.ts)
- [`src/lib/ai/config.ts`](../src/lib/ai/config.ts)

Supported runtime types:

- Ollama local runtime
- Gemini direct API runtime
- OpenRouter secondary fallback runtime

This AI layer powers:

- job parsing
- fit scoring
- salary lookup
- interview prep
- cover letters
- skill-gap analysis
- transaction categorisation
- weekly review generation
- morning briefings
- Gmail alert extraction

## Life OS Surface

Main Life OS dashboard:

- [`src/features/life-os/life-os-dashboard.tsx`](../src/features/life-os/life-os-dashboard.tsx)

It currently includes:

- weekly review
- month review
- morning briefing
- timeline
- review form
- task prioritiser
- export

## Weekly Review

API:

- [`src/app/api/life-os/weekly-review/route.ts`](../src/app/api/life-os/weekly-review/route.ts)

Logic:

- [`src/lib/life-os/weekly-review.ts`](../src/lib/life-os/weekly-review.ts)

It summarises the current state across:

- jobs
- money
- decisions
- routines

## Month Review

OpenCode-backed month review API:

- [`src/app/api/opencode/month-review/route.ts`](../src/app/api/opencode/month-review/route.ts)

UI:

- [`src/features/life-os/opencode-month-review.tsx`](../src/features/life-os/opencode-month-review.tsx)

It aggregates:

- application operations
- deep work
- journal activity
- paper-note capture
- regulatory digests
- shutdown entries

## Routines, Journal, Goals, Deep Work

These modules are the self-management layer of the app.

Relevant files:

- routines dashboard: [`src/features/routines/routines-dashboard.tsx`](../src/features/routines/routines-dashboard.tsx)
- deep work tracker: [`src/features/routines/deep-work-tracker.tsx`](../src/features/routines/deep-work-tracker.tsx)
- habit heatmap: [`src/features/routines/habit-heatmap.tsx`](../src/features/routines/habit-heatmap.tsx)
- journal API: [`src/app/api/journal/route.ts`](../src/app/api/journal/route.ts)
- journal UI: [`src/features/journal/journal-dashboard.tsx`](../src/features/journal/journal-dashboard.tsx)
- deep work API: [`src/app/api/deep-work/route.ts`](../src/app/api/deep-work/route.ts)

## Automation Layer

The Automation page is the operational control room.

Page:

- [`src/app/automation/page.tsx`](../src/app/automation/page.tsx)

Dashboard:

- [`src/features/automation/automation-dashboard.tsx`](../src/features/automation/automation-dashboard.tsx)

This surface combines:

- worker quick actions
- source runtime health
- AI runtime health
- the new OpenCode control panel

## OpenCode Toolkit Layer

The OpenCode toolkit is a local operator layer on top of the app.

Live storage root:

- `data/opencode/`

Shared storage helper:

- [`src/lib/opencode/storage.ts`](../src/lib/opencode/storage.ts)

The toolkit exists in three forms:

1. **CLI commands / scripts**
2. **App APIs**
3. **In-app control panel**

## OpenCode CLI Commands

Declared in:

- [`package.json`](../package.json)

Current scripts:

- `npm run opencode:shutdown`
- `npm run opencode:next`
- `npm run opencode:apps-status`
- `npm run opencode:followup-check`
- `npm run opencode:track-triage`
- `npm run opencode:ats-score`
- `npm run opencode:paper-grab`
- `npm run opencode:reg-watch`

CLI implementations:

- [`scripts/opencode/shutdown.mjs`](../scripts/opencode/shutdown.mjs)
- [`scripts/opencode/next.mjs`](../scripts/opencode/next.mjs)
- [`scripts/opencode/apps-status.mjs`](../scripts/opencode/apps-status.mjs)
- [`scripts/opencode/followup-check.mjs`](../scripts/opencode/followup-check.mjs)
- [`scripts/opencode/track-triage.mjs`](../scripts/opencode/track-triage.mjs)
- [`scripts/opencode/ats-score.mjs`](../scripts/opencode/ats-score.mjs)
- [`scripts/opencode/paper-grab.mjs`](../scripts/opencode/paper-grab.mjs)
- [`scripts/opencode/reg-watch.mjs`](../scripts/opencode/reg-watch.mjs)

## OpenCode App APIs

Current API routes:

- `/api/opencode/apps-status`
- `/api/opencode/month-review`
- `/api/opencode/shutdown`
- `/api/opencode/next`
- `/api/opencode/track-triage`
- `/api/opencode/ats-score`
- `/api/opencode/jd-ingest`
- `/api/opencode/jds`
- `/api/opencode/stars`
- `/api/opencode/star-pull`
- `/api/opencode/paper-grab`
- `/api/opencode/reg-watch`
- `/api/opencode/followup-check`

These routes exist so the same operator workflows can be used from both scripts and UI.

## OpenCode Control Panel

UI component:

- [`src/features/automation/opencode-control-panel.tsx`](../src/features/automation/opencode-control-panel.tsx)

Mounted inside:

- [`src/features/automation/automation-dashboard.tsx`](../src/features/automation/automation-dashboard.tsx)

Current in-app actions include:

- save shutdown entry
- pick next action
- refresh application ops status
- generate follow-up drafts
- run regulatory watch
- build month review
- ingest a JD
- run track triage
- run ATS scoring
- retrieve STAR stories
- capture a paper note

## Application Ops Status

Career application-ops panel:

- [`src/features/career/open-code-apps-status.tsx`](../src/features/career/open-code-apps-status.tsx)

Backed by:

- [`src/lib/opencode/apps-status.ts`](../src/lib/opencode/apps-status.ts)

It tracks:

- drafted review items
- application state buckets
- follow-up due windows
- ghosted roles

The view is intentionally narrower than the full shortlist. It focuses on **real application-state items**, not every ranked job.

## JD Ingest and Archive

JD ingest helper:

- [`src/lib/opencode/jd-ingest.ts`](../src/lib/opencode/jd-ingest.ts)

JD archive browser helper:

- [`src/lib/opencode/jd-archive.ts`](../src/lib/opencode/jd-archive.ts)

What JD ingest does:

- fetches a JD URL or accepts pasted text
- strips noisy page markup
- parses the role with the existing AI parser
- runs CTA-first track triage
- writes structured outputs to `data/opencode/jds/`

Archive outputs:

- markdown file for human reading
- JSON file for UI/API consumption

Archive browsing is exposed through:

- `/api/opencode/jds`
- the OpenCode control panel

## STAR Story Bank

STAR story helpers:

- [`src/lib/opencode/star-bank.ts`](../src/lib/opencode/star-bank.ts)

The STAR bank now supports:

- listing stories
- saving stories
- deleting stories
- retrieving best matches for an interview question

Persistence model:

- one markdown file per story under `data/opencode/stars/`

Template guide:

- [`docs/opencode-star-story-template.md`](./opencode-star-story-template.md)

This is surfaced in:

- `/api/opencode/stars`
- `/api/opencode/star-pull`
- the OpenCode control panel

## ATS Scoring

ATS scoring helper:

- [`src/lib/opencode/ats-score.ts`](../src/lib/opencode/ats-score.ts)

Purpose:

- compare JD text and CV text deterministically
- estimate keyword coverage
- flag missing terms
- evaluate whether the result is near the intended 9-15 keyword sweet spot

This exists as:

- CLI script
- API route
- control-panel action

## Knowledge Capture

## Paper Capture

Paper helper:

- [`src/lib/opencode/paper-grab.ts`](../src/lib/opencode/paper-grab.ts)

It supports:

- PMID lookup via PubMed
- DOI lookup via Crossref
- note generation into `data/opencode/notes/papers/`

## Regulatory Watch

Digest helper:

- [`src/lib/opencode/reg-watch.ts`](../src/lib/opencode/reg-watch.ts)

It watches public feeds such as:

- MHRA Drug Safety Update
- MHRA Drug and Device Alerts
- FDA Recalls

Output:

- markdown digests under `data/opencode/digests/regulatory/`
- dedupe cache so repeated runs only keep fresh items

## Privacy and Safety

The repo already ignores local operational data via:

- [`.gitignore`](../.gitignore)

Notably:

- `data/`
- `.env*`
- `backups/`

OpenCode privacy guidance:

- [`docs/opencode-privacy.md`](./opencode-privacy.md)

Current privacy model:

- `data/opencode/` is the live local working area
- `private/` is reserved for encrypted exports and sensitive snapshots

Pre-commit guardrail template:

- [`scripts/git-hooks/pre-commit`](../scripts/git-hooks/pre-commit)

Optional helper scripts:

- [`scripts/opencode/install-hooks.ps1`](../scripts/opencode/install-hooks.ps1)
- [`scripts/opencode/encrypt-private.ps1`](../scripts/opencode/encrypt-private.ps1)
- [`scripts/opencode/decrypt-private.ps1`](../scripts/opencode/decrypt-private.ps1)

## Worker and Automation Execution

Background worker registry:

- [`src/lib/worker/task-registry.ts`](../src/lib/worker/task-registry.ts)

Task runner:

- [`src/lib/worker/task-runner.ts`](../src/lib/worker/task-runner.ts)

External worker entrypoint:

- [`scripts/worker.mjs`](../scripts/worker.mjs)

The worker can run:

- source fetch tasks
- enrichment and ranking tasks
- Gmail-enhanced full pipeline runs
- recommendation pipeline runs
- weekly review tasks

## Current Direction

The application is now evolving in a very specific direction:

- **CTA-first job discovery and ranking**
- **lower junk, stronger early rejection**
- **Gmail-assisted discovery on every important run path**
- **review-first application operations**
- **local operational tooling with an in-app control surface**
- **knowledge capture that compounds over time**

It is no longer just a generic dashboard. It is becoming a purpose-built execution system for:

- career transition workflow
- regulated-healthcare opportunity management
- follow-up discipline
- AI-assisted planning and reflection

## Best Files to Read First

If you want to understand the codebase quickly, start here:

- [`src/features/career/career-dashboard.tsx`](../src/features/career/career-dashboard.tsx)
- [`src/lib/jobs/pipeline/index.ts`](../src/lib/jobs/pipeline/index.ts)
- [`src/lib/jobs/pipeline/relevance.ts`](../src/lib/jobs/pipeline/relevance.ts)
- [`src/lib/applications/gmail.ts`](../src/lib/applications/gmail.ts)
- [`src/lib/ai/client.ts`](../src/lib/ai/client.ts)
- [`src/features/life-os/life-os-dashboard.tsx`](../src/features/life-os/life-os-dashboard.tsx)
- [`src/features/automation/automation-dashboard.tsx`](../src/features/automation/automation-dashboard.tsx)
- [`src/features/automation/opencode-control-panel.tsx`](../src/features/automation/opencode-control-panel.tsx)
- [`src/lib/opencode/`](../src/lib/opencode/)
- [`src/lib/storage/index.ts`](../src/lib/storage/index.ts)

## Short Summary

Life OS is a local-first personal operating system whose strongest workflow is now a CTA-first career pipeline.

It discovers jobs, removes junk, parses and scores roles, supports application review and follow-up, and now layers on an OpenCode toolkit for shutdown planning, next-action selection, JD ingestion, STAR retrieval, ATS scoring, paper capture, and regulatory watching.

The newest additions make the system more operationally complete:

- a stricter CTA-first shortlist
- a persistent STAR story bank
- a JD archive
- a unified in-app OpenCode control panel
- richer local workflows without depending on MCP or external orchestrators
