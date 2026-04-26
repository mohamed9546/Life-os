# Feature Spec: Encrypted Backup / Restore

Feature folder: `features/encrypted-backup/`

---

## Summary

Build a local-first encrypted backup and restore feature for Life-OS.

The feature should let the user create an encrypted snapshot of core local Life-OS state and restore from an encrypted snapshot later, without weakening privacy boundaries.

The feature must protect against laptop loss or disk failure while preserving the existing rules around ignored local state, encrypted exports, and secret isolation.

---

## Strategic Rationale

Life-OS is intentionally local-first.

That means its strongest property is also its main risk:

- the system works without cloud infrastructure,
- but a laptop failure can destroy the local source of truth.

The repo already distinguishes between:

- local runtime data in `data/`,
- encrypted export boundary in `private/`,
- and plaintext secrets that must never be committed.

Encrypted Backup / Restore should extend that privacy model rather than bypass it.

---

## Goals

1. Create encrypted local snapshots of core Life-OS state.
2. Restore safely from encrypted snapshots.
3. Prevent secrets and plaintext private files from entering backups.
4. Keep the feature local-first and offline-capable.
5. Ensure restore does not overwrite live state blindly.
6. Keep v1 simple and script-first.
7. Add no unnecessary dependencies.

---

## Non-Goals

This feature does not:

- implement cloud sync,
- upload backups anywhere,
- back up `.env*` files,
- back up OAuth tokens,
- back up plaintext private files,
- schedule automatic backup in v1,
- add a large backup UI in v1,
- replace the storage facade,
- change AI behaviour,
- rotate keys or manage secrets.

---

## Users

Primary user:

- Mohamed, as operator of the local-first Life-OS workspace.

Secondary user:

- Maintainers/agents responsible for operational recovery discipline.

---

## User Stories

### Story 1: Create an encrypted snapshot

As the user, I want to create an encrypted backup of Life-OS state so that I can recover from laptop failure later.

Acceptance criteria:

- Backup is created manually.
- Output is encrypted.
- Output lands under `private/exports/`.
- No plaintext backup artifact remains in tracked locations.

### Story 2: Restore safely from an encrypted snapshot

As the user, I want restore to be safe so I do not destroy current data accidentally.

Acceptance criteria:

- Restore decrypts into ignored staging first.
- Restore validates a manifest before touching live state.
- Restore requires explicit confirmation before overwrite.
- Restore creates a pre-restore safety copy.

### Story 3: Exclude secrets and unsafe files

As the user, I want backups to exclude secrets and unsafe content so backup discipline does not create a new privacy problem.

Acceptance criteria:

- `.env*` excluded.
- OAuth token files excluded.
- plaintext private files excluded.
- logs, build artifacts, dependencies, and caches excluded.

---

## Core Backup Targets

Primary targets:

- `data/`
- `data/opencode/`

Possible optional metadata targets:

- `constitution.md`
- `SPEC-KIT-GUIDE.md`
- selected `features/**` planning files

These optional documentation files are not part of the runtime source of truth, but can be included if the design wants operational portability.

---

## Required Exclusions

Backups must exclude:

- `.env*`
- `node_modules/`
- `.next/`
- `.logs/`
- `*.log`
- `python-ai/.venv/`
- `python-ai/**/__pycache__/`
- `gmail-token.json`
- `gcp-oauth.keys.json`
- raw OAuth credential files
- plaintext files under `private/`

Recommended additional v1 exclusions:

- bulky regenerable artifacts such as generated CVs or temporary browser evidence unless explicitly required later

---

## Output Location

Recommended encrypted output path:

```text
private/exports/*.age
```

This is preferred over `backups/*.age` because `private/` is already the explicit encrypted-export boundary defined by repo policy.

Allowed tracked content under `private/` remains:

- `private/.gitkeep`
- encrypted `.age` files only

---

## Restore Safety Model

Restore must not write directly into live `data/` immediately.

Required restore flow:

1. decrypt encrypted backup into an ignored staging location,
2. validate the manifest and structure,
3. require confirmation,
4. create a pre-restore safety copy of the current live state,
5. only then apply restore into live data paths.

Recommended staging location:

```text
backups/restore-staging/<timestamp>/
```

Recommended pre-restore safety copy location:

```text
backups/pre-restore-<timestamp>/
```

---

## Planning Questions and Chosen Answers

### 1. Manual backup only, or include scheduling?

Chosen v1 direction:

- manual backup only

Why:

- lower operational risk,
- easier to verify,
- avoids unattended plaintext staging concerns,
- matches current privacy-first posture.

### 2. Output to `private/exports/*.age` or `backups/*.age`?

Chosen v1 direction:

- `private/exports/*.age`

Why:

- aligns with the repo's encrypted-export boundary,
- works with current `.gitignore` and hook expectations.

### 3. Overwrite current `data/`, or restore into staging first?

Chosen v1 direction:

- restore into staging first

### 4. Require confirmation and pre-restore safety copy?

Chosen v1 direction:

- yes

### 5. App UI or script/API first?

Chosen v1 direction:

- script-first

Why:

- safer for destructive operations,
- easier to verify and audit,
- aligns with current repo script patterns.

### 6. Include all of `data/`, or only selected files?

Chosen v1 direction:

- include core local operational state from `data/`, excluding explicit denylist items and regenerable/nonessential bulk paths.

### 7. Encryption recipient/key configured outside repo?

Chosen v1 direction:

- yes

### 8. Verify plaintext staging archives are deleted after encryption?

Chosen v1 direction:

- yes

---

## Functional Requirements

### FR-1: Local-first only

The backup/restore feature must function without requiring Supabase or any external service.

### FR-2: Encrypted output only

Backup output must be `.age` encrypted before it is considered complete.

### FR-3: Script-first v1

The first implementation should be script-first.

UI exposure may come later.

### FR-4: Manifest required

Each backup must include a manifest describing:

- creation timestamp,
- backup version,
- included paths,
- excluded paths,
- restore expectations.

### FR-5: Restore staging required

Restore must decrypt into ignored staging before modifying live state.

### FR-6: Pre-restore safety copy required

Restore must create a safety copy before overwrite.

### FR-7: Exclusion policy enforced

The implementation must enforce the required exclusion list and must not depend on the operator remembering exclusions manually.

### FR-8: No plaintext backup archive in tracked paths

Any plaintext temporary archive or staging directory must exist only in ignored locations and must be removed after successful encryption when appropriate.

### FR-9: No secret inclusion

The implementation must not include:

- `.env*`
- OAuth credentials
- token files
- plaintext `private/` content

### FR-10: No cloud upload

No remote backup provider or sync system is allowed in v1.

---

## Success Criteria

The feature succeeds when:

- the user can manually create an encrypted backup,
- the encrypted backup is stored under `private/exports/`,
- restore uses staging first,
- restore requires explicit confirmation,
- a pre-restore safety copy is created,
- no secret or plaintext private files are included,
- no plaintext backup artifacts persist in tracked locations,
- all operational data remains local-first.
