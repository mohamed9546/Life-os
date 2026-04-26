# Life-OS Constitution

This document defines the non-negotiable rules for every AI agent, coding assistant, or human contributor working in this codebase.

No specification, plan, task list, or implementation may violate this constitution.

---

## Identity

This project is **Life-OS**: a local-first, AI-assisted operating system for personal execution, career transition, regulated-healthcare opportunity management, and decision support.

The primary user is **Mohamed Abdalla**, an Egyptian clinical pharmacist based in Glasgow, UK, transitioning from community pharmacy into desk-based regulated healthcare roles including:

- Clinical Trial Assistant / Clinical Trials Associate
- Clinical Research Assistant / Clinical Research Coordinator
- Quality Assurance / Compliance / Document Control
- Regulatory Affairs, especially medical devices
- Pharmacovigilance / Medical Information
- Community pharmacy as an interim income and experience bridge

The system exists to create leverage: better job discovery, better filtering, better application decisions, stronger follow-up discipline, and accumulated operational intelligence.

---

## 1. Architecture Principles

### 1.1 Local-First Is Non-Negotiable

- The application MUST work with local JSON storage under `data/*.json`.
- Supabase is optional sync/cache infrastructure, never the primary source of truth.
- No feature may require Supabase to function.
- Network-dependent features must degrade gracefully.
- If a remote provider fails, the system must preserve local state and report the failure clearly.

### 1.2 Storage Facade Only

- Application data reads/writes MUST go through `src/lib/storage/index.ts`.
- Direct reads/writes to `data/` from app code are forbidden unless explicitly centralised inside the storage facade.
- OpenCode-specific scripts may use `src/lib/opencode/storage.ts`, but must follow the same local-first discipline.
- New storage keys must be documented in types or module-level documentation.
- JSON shape changes must be backward-compatible or include a migration step.

### 1.3 AI Runtime Router

- AI calls MUST go through `src/lib/ai/client.ts` and `src/lib/ai/config.ts`.
- No feature may hardcode a specific provider or model.
- Every AI task must have one of:
  - a deterministic fallback,
  - a safe empty result,
  - or a clear failure state that does not corrupt local data.
- AI runtime metadata should be captured where practical:
  - task name,
  - provider,
  - model,
  - latency,
  - success/failure,
  - fallback used,
  - token estimate if available,
  - sensitivity level.

### 1.4 Sensitivity-Based Routing

- Sensitive content should default to local inference through Ollama where possible.
- Sensitive content includes:
  - personal journal entries,
  - recruiter conversations,
  - supplier pricing,
  - medical-device business strategy,
  - regulatory dossier content,
  - patient-adjacent notes,
  - pharmacy shift reflections.
- Cloud AI may be used for low-sensitivity tasks such as public job parsing, public JD summarisation, and non-confidential formatting.
- The system should support a task-level `sensitivity` flag.

### 1.5 File Organisation

Use the existing project conventions:

- UI components: `src/features/{domain}/{component}.tsx`
- API routes: `src/app/api/{domain}/route.ts`
- Business logic: `src/lib/{domain}/`
- AI tasks: `src/lib/ai/tasks/{task-name}.ts`
- Worker tasks: `src/lib/worker/task-registry.ts`
- OpenCode scripts: `scripts/opencode/{script-name}.mjs`
- OpenCode helpers: `src/lib/opencode/{helper}.ts`
- Shared types: `src/types/index.ts`
- Module-local types: `{module}.types.ts`
- Local app data: `data/*.json`
- OpenCode runtime data: `data/opencode/`
- Specs: `features/{feature-name}/spec.md`
- Plans: `features/{feature-name}/plan.md`
- Tasks: `features/{feature-name}/tasks.md`

### 1.6 Technology Constraints

- Framework: Next.js 14 App Router.
- Language: TypeScript in `src/`.
- Styling: Tailwind CSS.
- Avoid unnecessary dependencies.
- No ORM unless explicitly justified by a future architectural decision.
- No LangChain/LangGraph unless a concrete failure pattern proves it is necessary.
- Prefer small deterministic modules over complex agentic abstractions.

---

## 2. Privacy and Security

### 2.1 Gitignore Boundaries

The following must never be committed in plaintext:

- `data/`
- `data/opencode/`
- `.env*`
- `backups/`
- `gmail-token.json`
- `gcp-oauth.keys.json`
- OAuth credential files
- API keys
- patient identifiers
- supplier pricing details unless intentionally public
- recruiter private contact notes
- raw personal journal exports

The `private/` directory is reserved only for encrypted exports and placeholder files.

Allowed inside `private/`:

- `private/.gitkeep`
- encrypted `.age` files only

Plaintext files inside `private/` are forbidden.

### 2.2 Required `.gitignore` Rule

The repository `.gitignore` must include:

```gitignore
private/*
!private/.gitkeep
!private/**/*.age
```

### 2.3 Encryption

- Sensitive exports must be encrypted with `age` before storage in `private/`.
- Plaintext sensitive snapshots should remain only in local ignored runtime folders.
- Pre-commit hooks should block:
  - plaintext files under `private/`,
  - likely NHS numbers,
  - likely CHI numbers,
  - date-of-birth patterns,
  - accidental `.env` files,
  - API keys.

### 2.4 Patient and Clinical Data

- No patient identifiers may appear in source code, tests, examples, specs, comments, notes, STAR stories, or fixtures.
- Do not store:
  - NHS numbers,
  - CHI numbers,
  - names linked to clinical events,
  - exact DOBs,
  - addresses,
  - phone numbers,
  - identifiable pharmacy incidents.
- STAR stories and pharmacy examples must be anonymised.

---

## 3. Clinical and Regulatory Safety

### 3.1 Never Invent Clinical Data

Any feature producing clinical, pharmacological, regulatory, or medical-device claims must either:

- cite a reliable source, or
- clearly state that the claim must be verified.

Acceptable sources include:

- BNF,
- SmPC,
- MHRA,
- EMA,
- FDA,
- PubMed,
- ICH guidance,
- NICE,
- official regulator guidance,
- manufacturer documentation for medical devices.

If no reliable source is available, the system should use this wording:

> I cannot confirm — verify against BNF / MHRA / SmPC before acting.

### 3.2 Jurisdiction Precision

Regulatory wording must be jurisdiction-specific:

- Great Britain: UK MDR 2002 as amended, MHRA.
- Northern Ireland: EU MDR 2017/745 where applicable.
- EU: EU MDR 2017/745 / IVDR 2017/746.
- Egypt: Egyptian Drug Authority / EDA requirements, including Form 4 where relevant.

Never use generic “MDR” language without jurisdiction.

### 3.3 Pharmacist Registration Precision

The system must not describe Mohamed as a UK pharmacist unless GPhC registration is confirmed.

Acceptable wording:

- clinical pharmacist by training,
- MSc Clinical Pharmacology graduate,
- community pharmacy clinical support,
- pharmacy professional,
- pharmacy experience in the UK,
- pharmacist experience in Egypt,
- working under Responsible Pharmacist governance where appropriate.

Avoid:

- UK pharmacist,
- registered UK pharmacist,
- GPhC pharmacist,

unless explicitly verified.

---

## 4. Career System Rules

### 4.1 Track Taxonomy

The career system recognises these tracks:

1. CTA / CRA / Clinical Trial Coordinator
2. Research Assistant
3. QA / Compliance / Document Control
4. Regulatory Affairs
5. Pharmacovigilance / Medical Information
6. Community Pharmacy
7. Special-case strategic roles, such as Healthcare & Life Sciences research analyst roles

New features must preserve this taxonomy unless the user explicitly changes it.

### 4.2 CTA-First Default

The default career posture is CTA-first because it is the highest-probability transition lane.

Primary target titles include:

- Clinical Trial Assistant
- Clinical Trials Assistant
- Clinical Trial Associate
- Clinical Research Assistant
- Clinical Research Coordinator
- Trial Coordinator
- Clinical Study Assistant / Coordinator
- Clinical Operations Assistant / Coordinator
- Study Start-Up Assistant / Coordinator
- Site Activation Assistant / Coordinator
- Trial Administrator
- Clinical Project Assistant

QA, regulatory, medinfo, and research-governance support are secondary tracks.

### 4.3 Review-First Application Workflow

- The system may draft, rank, and recommend.
- The system must not auto-submit applications or auto-send recruiter emails.
- Gmail draft creation is allowed.
- Sending must remain human-reviewed.

### 4.4 Do Not Store Garbage as Truth

- Broad public sources can produce irrelevant jobs.
- Features must make off-target roles visible as off-target or reject them early.
- Do not silently elevate weak-fit roles into strategic application candidates.
- Source health, relevance gating, and ranking quality are core product integrity concerns.

---

## 5. Worker and Automation Rules

### 5.1 Worker Reuse

- Worker tasks must reuse domain modules, not duplicate logic.
- If an API route and worker task do the same work, they should call the same underlying function.

### 5.2 Scheduled Work Must Be Safe

- Scheduled work must be idempotent where practical.
- One failing source/provider must not corrupt unrelated state.
- Worker summaries should store operational metadata, not sensitive raw content.

---

## 6. Testing and Verification

### 6.1 Verification Standard

For significant features, the expected verification stack is:

- lint
- typecheck
- tests where applicable
- build

### 6.2 No Secret-Dependent Tests by Default

- Tests must not require `.env.local` secrets.
- Tests must not require live provider credentials.
- External sources and adapters should be mocked in tests unless a very small manual smoke test is explicitly intended.

---

## 7. Spec Kit Usage Rules

Spec Kit is a **development discipline layer**, not a runtime feature layer.

Use Spec Kit when work:

- touches 3+ files,
- adds a module,
- adds a storage shape,
- adds an API route,
- changes the pipeline,
- changes the worker,
- changes privacy boundaries,
- changes AI routing,
- or requires tests.

Do not use Spec Kit for tiny text or CSS changes.

---

## 8. Stop Rules for Agents

Agents must stop and ask for clarification if implementation would require:

- reading or exposing `.env.local`,
- exposing secrets,
- committing plaintext private exports,
- inventing clinical or regulatory claims,
- bypassing the storage facade,
- replacing a mature existing module with duplicate infrastructure,
- auto-sending emails or applications,
- adding unnecessary dependencies.
