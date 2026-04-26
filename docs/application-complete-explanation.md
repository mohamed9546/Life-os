# Life OS Application Explanation

## What This Application Is

Life OS is a local-first personal operating system built around one main idea: turn personal execution into a structured, searchable, automatable system.

In practice, the application combines:

- a **career pipeline** for finding, ranking, and managing jobs
- an **AI analysis layer** for parsing jobs, evaluating fit, generating career outputs, and summarising information
- **life operations modules** for routines, goals, journal, weekly review, and decision tracking
- an **automation layer** for scheduled work, Gmail-based job discovery, and background maintenance
- a new **OpenCode toolkit layer** for daily workflow helpers such as shutdown planning, next-action picking, application follow-up drafting, regulatory watch digests, and paper capture

The app is designed to work even without cloud infrastructure. When Supabase is unavailable, it stores its state in local JSON files under `data/*.json`.

## Core Product Shape

At a high level, the application has five major surfaces:

1. **Career**
2. **Life OS**
3. **Money / Decisions / Routines / Goals / Journal / Learning**
4. **Automation**
5. **Settings / Admin Integrations**

The most important operational pages today are:

- [`/career`](../src/app/career/page.tsx)
- [`/settings`](../src/app/settings/page.tsx)
- [`/life-os`](../src/app/life-os/page.tsx)
- [`/automation`](../src/app/automation/page.tsx)

## Technology Stack

The application is built with:

- **Next.js 14 App Router** for UI and API routes
- **TypeScript** throughout the app
- **Tailwind CSS** for styling
- **React client components** for dashboards and operational panels
- **Local JSON storage** under `data/*.json`
- **Optional Supabase** for persistent remote storage
- **Optional Python FastAPI sidecar** for some AI tasks
- **Multiple AI runtimes**:
  - Ollama for local models
  - Gemini direct API for cloud primary inference
  - OpenRouter as an optional fallback runtime

Relevant files:

- [`src/lib/storage/index.ts`](../src/lib/storage/index.ts)
- [`src/lib/ai/client.ts`](../src/lib/ai/client.ts)
- [`src/lib/ai/config.ts`](../src/lib/ai/config.ts)
- [`python-ai/`](../python-ai/)

## Main Functional Areas

## 1. Career System

The Career system is the flagship workflow.

Its job is to:

- discover jobs from many sources
- deduplicate them
- parse them into structured data
- evaluate strategic fit against the user profile
- rank them
- expose them in inbox / pipeline views
- support manual action, follow-up, outreach, and application review

Main UI:

- [`src/features/career/career-dashboard.tsx`](../src/features/career/career-dashboard.tsx)

Supporting components:

- [`src/components/job-detail-panel.tsx`](../src/components/job-detail-panel.tsx)
- [`src/components/filter-bar.tsx`](../src/components/filter-bar.tsx)
- [`src/features/career/open-code-apps-status.tsx`](../src/features/career/open-code-apps-status.tsx)

### Career Data Model

The job pipeline revolves around two major objects:

- `RawJobItem`
- `EnrichedJob`

Definitions live in:

- [`src/types/index.ts`](../src/types/index.ts)

`RawJobItem` is the fetched source record.
`EnrichedJob` wraps the raw record plus:

- parsed AI output
- fit evaluation
- workflow status
- contact intelligence
- outreach strategy
- follow-up metadata

### Job Discovery Sources

The application supports multiple source adapters under:

- [`src/lib/jobs/sources/`](../src/lib/jobs/sources/)

Examples include:

- Adzuna
- Reed
- Jobs.ac.uk
- Totaljobs
- LinkedIn public fetches
- Remotive
- Arbeitnow
- Himalayas
- Guardian Jobs
- We Work Remotely
- Greenhouse
- Lever
- NHS Jobs

Registry:

- [`src/lib/jobs/sources/index.ts`](../src/lib/jobs/sources/index.ts)

Default search posture:

- [`src/lib/jobs/sources/types.ts`](../src/lib/jobs/sources/types.ts)
- [`src/lib/career/defaults.ts`](../src/lib/career/defaults.ts)

The current search posture is deliberately **CTA-first**.
That means Clinical Trial Assistant and close clinical-trial-support aliases are prioritised above secondary QA/regulatory tracks.

### Job Pipeline Flow

The main job pipeline entrypoint is:

- [`src/app/api/jobs/pipeline/route.ts`](../src/app/api/jobs/pipeline/route.ts)

It calls:

- [`src/lib/jobs/pipeline/index.ts`](../src/lib/jobs/pipeline/index.ts)

Pipeline stages:

1. Fetch jobs from enabled sources
2. Optionally import Gmail-discovered jobs
3. Filter and deduplicate raws
4. Run relevance gating
5. Parse jobs into structured data
6. Evaluate fit against the user profile
7. Save inbox / rejected / ranked collections
8. Optionally run recommendation / follow-up flows

Key files:

- [`src/lib/jobs/pipeline/index.ts`](../src/lib/jobs/pipeline/index.ts)
- [`src/lib/jobs/pipeline/enrich.ts`](../src/lib/jobs/pipeline/enrich.ts)
- [`src/lib/jobs/pipeline/relevance.ts`](../src/lib/jobs/pipeline/relevance.ts)
- [`src/lib/jobs/pipeline/rank.ts`](../src/lib/jobs/pipeline/rank.ts)

### Relevance Gating

Before a job becomes useful UI data, the app now applies stronger domain-specific relevance filtering.

This is important because broad public sources often return unrelated jobs.

The relevance gate now tries to block or heavily penalise:

- tax / accounting roles
- offshore / oil & gas roles
- drivers / logistics / industrial operator roles
- hospitality and food & beverage roles
- aviation security roles
- IT support / helpdesk roles
- radiography and unrelated allied-health execution roles
- obviously senior / leadership roles

This logic lives in:

- [`src/lib/jobs/pipeline/relevance.ts`](../src/lib/jobs/pipeline/relevance.ts)

### Parsing and Fit Evaluation

The AI parsing task converts job text into structured fields such as:

- title
- company
- location
- employment type
- remote type
- role track
- must-haves
- keywords
- summary

Parser:

- [`src/lib/ai/tasks/parse-job.ts`](../src/lib/ai/tasks/parse-job.ts)

Fit evaluation:

- [`src/lib/ai/tasks/evaluate-job.ts`](../src/lib/ai/tasks/evaluate-job.ts)

Both tasks support fallback behaviour if AI calls fail.
The parser especially has deterministic fallback logic to keep the pipeline resilient.

### Gmail-Based Job Discovery

The app can scan Gmail for job alert emails.

Relevant files:

- [`src/lib/applications/gmail.ts`](../src/lib/applications/gmail.ts)
- [`src/app/api/gmail/sync-alerts/route.ts`](../src/app/api/gmail/sync-alerts/route.ts)

Current behaviour:

- scans the last `3d`
- looks for job-alert-like emails and CTA-relevant terms
- detects sources like LinkedIn / Indeed / Totaljobs / IrishJobs / NHS Jobs
- attempts AI extraction of job records from the email body
- falls back to source-specific heuristic parsing if needed

This Gmail discovery now feeds both:

- manual pipeline runs
- recommendation pipeline runs
- worker-based full pipeline runs

### Application / Recommendation Flow

The app includes a review-first application automation system.

Main orchestration:

- [`src/lib/applications/auto-apply.ts`](../src/lib/applications/auto-apply.ts)

What it does:

- identifies eligible jobs
- selects or tailors a CV
- drafts outreach or application content
- creates Gmail review drafts where appropriate
- writes application log entries

It is currently not a full autonomous submitter. It is designed as a **manual review pipeline with assistance**, not silent blind auto-apply.

Logs and profile state:

- [`src/lib/applications/storage.ts`](../src/lib/applications/storage.ts)

## 2. AI Runtime Layer

The app has a centralised AI runtime router that decides which model/provider executes each task.

Core files:

- [`src/lib/ai/client.ts`](../src/lib/ai/client.ts)
- [`src/lib/ai/config.ts`](../src/lib/ai/config.ts)

Supported runtime types:

- Ollama local runtime
- Gemini direct API runtime
- OpenRouter secondary runtime fallback

Important behaviour:

- the app can use task-specific runtime preferences
- individual tasks can prefer primary or secondary runtime
- some tasks are structured JSON tasks
- the system records runtime metadata, not just free-form text

The AI system is used for:

- job parsing
- fit scoring
- interview prep
- cover letters
- salary lookup
- skill-gap analysis
- transaction categorisation
- weekly review summaries
- morning briefings
- OpenCode Gmail alert extraction helper tasks

## 3. Life OS Surface

The Life OS surface is the broader personal operating system layer.

Main UI:

- [`src/features/life-os/life-os-dashboard.tsx`](../src/features/life-os/life-os-dashboard.tsx)

It currently contains:

- weekly review
- month review
- morning briefing
- timeline
- review form
- task prioritiser
- export

The Life OS area helps convert stored system state into a reflective or planning view.

### Weekly Review

API:

- [`src/app/api/life-os/weekly-review/route.ts`](../src/app/api/life-os/weekly-review/route.ts)

Logic:

- [`src/lib/life-os/weekly-review.ts`](../src/lib/life-os/weekly-review.ts)

Inputs include:

- jobs
- money data
- decisions
- routines

### Morning Briefing

API:

- [`src/app/api/life-os/morning-briefing/route.ts`](../src/app/api/life-os/morning-briefing/route.ts)

This generates an operational start-of-day summary from current state.

### Month Review

New OpenCode-backed API:

- [`src/app/api/opencode/month-review/route.ts`](../src/app/api/opencode/month-review/route.ts)

New UI:

- [`src/features/life-os/opencode-month-review.tsx`](../src/features/life-os/opencode-month-review.tsx)

The month review aggregates:

- application state
- deep work
- journal activity
- paper notes
- regulatory digests
- shutdown entries

## 4. Routines, Goals, Journal, and Deep Work

These modules hold the self-management layer of the system.

### Routines

- [`src/features/routines/routines-dashboard.tsx`](../src/features/routines/routines-dashboard.tsx)
- [`src/features/routines/deep-work-tracker.tsx`](../src/features/routines/deep-work-tracker.tsx)
- [`src/features/routines/habit-heatmap.tsx`](../src/features/routines/habit-heatmap.tsx)

### Goals

- [`src/features/goals/goals-dashboard.tsx`](../src/features/goals/goals-dashboard.tsx)

### Journal

API:

- [`src/app/api/journal/route.ts`](../src/app/api/journal/route.ts)

UI:

- [`src/features/journal/journal-dashboard.tsx`](../src/features/journal/journal-dashboard.tsx)

### Deep Work

API:

- [`src/app/api/deep-work/route.ts`](../src/app/api/deep-work/route.ts)

UI:

- [`src/features/routines/deep-work-tracker.tsx`](../src/features/routines/deep-work-tracker.tsx)

## 5. OpenCode Toolkit Layer

The new OpenCode layer is a local operational toolkit built on top of the main app.

Live storage root:

- `data/opencode/`

Shared helpers:

- [`src/lib/opencode/storage.ts`](../src/lib/opencode/storage.ts)
- [`src/lib/opencode/apps-status.ts`](../src/lib/opencode/apps-status.ts)
- [`src/lib/opencode/month-review.ts`](../src/lib/opencode/month-review.ts)

### Current OpenCode Commands

Package scripts are defined in:

- [`package.json`](../package.json)

Available commands:

- `npm run opencode:shutdown`
- `npm run opencode:next`
- `npm run opencode:apps-status`
- `npm run opencode:followup-check`
- `npm run opencode:track-triage`
- `npm run opencode:ats-score`
- `npm run opencode:paper-grab`
- `npm run opencode:reg-watch`

Implementation files:

- [`scripts/opencode/shutdown.mjs`](../scripts/opencode/shutdown.mjs)
- [`scripts/opencode/next.mjs`](../scripts/opencode/next.mjs)
- [`scripts/opencode/apps-status.mjs`](../scripts/opencode/apps-status.mjs)
- [`scripts/opencode/followup-check.mjs`](../scripts/opencode/followup-check.mjs)
- [`scripts/opencode/track-triage.mjs`](../scripts/opencode/track-triage.mjs)
- [`scripts/opencode/ats-score.mjs`](../scripts/opencode/ats-score.mjs)
- [`scripts/opencode/paper-grab.mjs`](../scripts/opencode/paper-grab.mjs)
- [`scripts/opencode/reg-watch.mjs`](../scripts/opencode/reg-watch.mjs)

### OpenCode Application Ops Surface

API:

- [`src/app/api/opencode/apps-status/route.ts`](../src/app/api/opencode/apps-status/route.ts)

UI:

- [`src/features/career/open-code-apps-status.tsx`](../src/features/career/open-code-apps-status.tsx)

This surface tracks:

- application drafts
- applied roles
- interview / offer pipeline state
- first and second follow-up due windows
- likely ghosted roles

### OpenCode Knowledge Capture

Paper capture:

- `paper-grab`

Regulatory digest generation:

- `reg-watch`

These are meant to build a reusable local knowledge layer without depending on external proprietary tooling.

## 6. Storage Model

The storage system is deliberately simple.

### Local JSON Storage

Primary local storage lives under:

- `data/*.json`

Examples:

- `jobs-raw.json`
- `jobs-inbox.json`
- `jobs-ranked.json`
- `jobs-rejected.json`
- `application-logs.json`
- `career-profiles.json`
- `saved-searches.json`
- `source-preferences.json`
- `gmail-token.json`
- `deep-work-sessions.json`
- `journal` collection via storage abstraction

Storage facade:

- [`src/lib/storage/index.ts`](../src/lib/storage/index.ts)

This facade can read/write either:

- Supabase `storage_kv`
- or local disk JSON files

depending on environment availability.

### Local-First Behaviour

The app is intentionally local-first.

If Supabase is absent or broken:

- the app keeps working
- data falls back to local JSON

This is a key architectural property, not a backup-only mode.

## 7. Worker / Automation Layer

Background work is handled by the worker system.

Registry:

- [`src/lib/worker/task-registry.ts`](../src/lib/worker/task-registry.ts)

Execution:

- [`src/lib/worker/task-runner.ts`](../src/lib/worker/task-runner.ts)

External shell entrypoint:

- [`scripts/worker.mjs`](../scripts/worker.mjs)

This worker system can run:

- source fetch tasks
- enrichment tasks
- ranking tasks
- weekly review tasks
- full pipeline tasks
- recommendation pipeline tasks

The source runtime board in Settings / Admin helps expose worker/source state.

## 8. Privacy and Safety

The app handles personal workflow data and career materials, so privacy boundaries matter.

### Existing Boundary

The repo already ignores:

- `data/`
- `.env*`
- `backups/`

See:

- [`.gitignore`](../.gitignore)

### OpenCode Privacy Layer

The new privacy notes live in:

- [`docs/opencode-privacy.md`](./opencode-privacy.md)

The intended model is:

- `data/opencode/` = live local working state
- `private/` = encrypted export area for sensitive snapshots

Hook scaffolding:

- [`scripts/git-hooks/pre-commit`](../scripts/git-hooks/pre-commit)
- [`scripts/opencode/install-hooks.ps1`](../scripts/opencode/install-hooks.ps1)

Optional encryption helpers:

- [`scripts/opencode/encrypt-private.ps1`](../scripts/opencode/encrypt-private.ps1)
- [`scripts/opencode/decrypt-private.ps1`](../scripts/opencode/decrypt-private.ps1)

## 9. How The Main Flows Work Together

### Job Flow

1. A source fetch or Gmail scan finds raw jobs
2. Raw jobs are saved
3. Relevance gating removes obvious junk
4. AI parsing structures the job
5. AI fit scoring evaluates strategic value
6. Ranked / inbox / rejected collections are updated
7. Career UI surfaces the results
8. Review-only application assistance can draft follow-ups or Gmail drafts

### Daily Operations Flow

1. You use `opencode:shutdown` to record the day and set tomorrow's top 3
2. `opencode:next` can choose the next best action
3. `opencode:apps-status` rebuilds application ops state
4. `opencode:followup-check` drafts follow-up messages when due
5. `opencode:reg-watch` and `opencode:paper-grab` keep knowledge fresh
6. Life OS month review aggregates the results

### Weekly / Monthly Reflection Flow

1. Deep work and journal entries accumulate
2. Career and application data accumulates
3. Weekly review summarises tactical state
4. Month review summarises strategic behaviour and throughput

## 10. Current Direction Of The Application

The app is moving toward a tighter, opinionated operating model:

- **CTA-first** job discovery and prioritisation
- **higher signal, lower junk** in the pipeline
- **Gmail-assisted discovery** on every important run path
- **local operational tooling** for decision support and execution
- **knowledge capture that compounds over time**

This means the app is no longer just a generic personal dashboard. It is becoming a domain-specific system for:

- career transition execution
- regulated-healthcare opportunity management
- AI-assisted operational discipline

## Short Summary

Life OS is a local-first AI-assisted operating system for career execution and personal decision support.

Its most developed workflow is the Career pipeline, which discovers jobs, parses them, scores fit, ranks them, and supports review-first application operations.

Around that core, the app provides planning, review, journaling, routines, decision tracking, automation, and now an OpenCode toolkit layer for faster daily execution.

If you want to understand the system quickly, start with these files:

- [`src/features/career/career-dashboard.tsx`](../src/features/career/career-dashboard.tsx)
- [`src/lib/jobs/pipeline/index.ts`](../src/lib/jobs/pipeline/index.ts)
- [`src/lib/ai/client.ts`](../src/lib/ai/client.ts)
- [`src/features/life-os/life-os-dashboard.tsx`](../src/features/life-os/life-os-dashboard.tsx)
- [`src/lib/storage/index.ts`](../src/lib/storage/index.ts)
- [`scripts/opencode/`](../scripts/opencode/)
