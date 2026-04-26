# Life-OS Spec Kit Guide

This guide explains how to use Spec Kit inside the Life-OS repository without creating architectural drift.

---

## Purpose

Spec Kit is used for feature development discipline.

It is not the runtime automation layer.

- **Spec Kit**: guides development of the Life-OS application.
- **OpenCode scripts**: run operational workflows inside Life-OS.
- **Ollama/Gemini/OpenRouter**: execute AI tasks through the app's AI router.

Do not confuse these layers.

---

## When to Use Spec Kit

Use Spec Kit when a change:

- touches 3+ files,
- creates a new module,
- adds a data model,
- adds an API route,
- changes the job pipeline,
- changes AI task routing,
- changes privacy or storage boundaries,
- affects application workflow state,
- needs tests.

Skip Spec Kit for:

- one-line bug fixes,
- simple CSS adjustments,
- small text changes,
- one-file refactors.

---

## Current Command Shape

Most agents expose Spec Kit through slash commands such as:

```text
/speckit.constitution
/speckit.specify
/speckit.clarify
/speckit.plan
/speckit.tasks
/speckit.analyze
/speckit.implement
```

Some tools may expose equivalent command names. Use the command names supported by your installed agent.

---

## Install

From the Life-OS repo root:

```bash
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git
```

Then initialise:

```bash
cd Life-os
specify init . --ai opencode
```

If your tool expects a different agent option, use the one matching your coding agent.

---

## Required Files

At minimum, keep these:

```text
constitution.md
features/
  source-health/
    spec.md
    plan.md
    tasks.md
docs/
  repo-safety-patch.md
```

---

## Recommended Workflow

### 1. Establish constitution

Paste `constitution.md` into the repo root.

Then run the equivalent of:

```text
/speckit.constitution Use the repo constitution.md as the governing principles for all future work. Do not violate local-first storage, privacy boundaries, AI-router usage, review-first application workflow, or pharmacist-registration precision.
```

### 2. Create a feature spec

For the first feature:

```text
/speckit.specify Build source health monitoring for all job source adapters. Follow features/source-health/spec.md exactly.
```

### 3. Clarify

```text
/speckit.clarify Focus on storage shape, failure states, source adapter compatibility, and UI empty states.
```

### 4. Plan

```text
/speckit.plan Use Next.js 14 App Router, TypeScript, Tailwind, local JSON storage through src/lib/storage/index.ts, existing worker registry, and no new dependencies.
```

### 5. Generate tasks

```text
/speckit.tasks
```

Compare generated tasks with `features/source-health/tasks.md`.

### 6. Analyze

```text
/speckit.analyze
```

Use this to catch contradictions between constitution, spec, plan, and tasks.

### 7. Implement

```text
/speckit.implement
```

Do not let the agent implement if it tries to:

- bypass the storage facade,
- write directly to `data/` from random modules,
- add unnecessary dependencies,
- hardcode a provider/model,
- auto-send emails,
- commit plaintext private files,
- invent clinical or regulatory claims.

---

## First Three Features to Spec

### 1. Source Health Monitoring

Why: protects pipeline integrity.

Folder:

```text
features/source-health/
```

### 2. AI Cost and Latency Telemetry

Why: prevents silent cost/performance waste.

Suggested folder:

```text
features/ai-telemetry/
```

### 3. Encrypted Backup / Restore

Why: local-first means local failure risk.

Suggested folder:

```text
features/encrypted-backup/
```

---

## Pre-Commit Hook Install

Install the local hook template with:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/opencode/install-hooks.ps1
```

---

## Non-Negotiable Agent Instruction

Use this when starting a coding session:

```text
You are working in Life-OS. Obey constitution.md. Preserve local-first architecture. Use the storage facade. Do not add dependencies without justification. Do not auto-send applications or emails. Do not commit plaintext private files. Do not invent clinical, regulatory, or career evidence. Implement only the current spec and stop.
```
