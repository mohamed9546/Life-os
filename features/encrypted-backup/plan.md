# Implementation Plan: Encrypted Backup / Restore

Feature folder: `features/encrypted-backup/`

---

## Technical Direction

Implement Encrypted Backup / Restore as a script-first local recovery feature.

It should:

- gather allowed local state,
- build a manifest,
- stage plaintext only in ignored paths,
- encrypt output to `.age`,
- support safe restore through staging and confirmation,
- avoid changing the existing runtime architecture.

This is not a cloud backup feature.

---

## Why Script-First Is Correct For v1

Backup and restore are destructive or sensitive operations.

Compared with a UI-first approach, script-first is safer because it:

- keeps control explicit,
- is easier to audit,
- avoids accidental clicks,
- works well with the existing `scripts/opencode/` pattern,
- reduces implementation complexity for the first version.

The Settings UI can be considered later after the backup semantics are stable.

---

## Proposed Files

### New files

```text
features/encrypted-backup/spec.md
features/encrypted-backup/plan.md
features/encrypted-backup/tasks.md
scripts/opencode/backup-life-os.ps1
scripts/opencode/restore-life-os.ps1
scripts/opencode/backup-life-os.mjs
src/lib/opencode/backup-manifest.ts
src/lib/opencode/backup-selection.ts
src/lib/opencode/backup-selection.test.ts
```

### Modified files

```text
docs/repo-safety-patch.md (optional if implementation docs need one small note)
README.md (optional if the feature becomes user-facing enough)
```

If implementation chooses pure PowerShell for v1, `backup-life-os.mjs` may be omitted, but selection logic should still remain testable in JS/TS.

---

## Backup Scope

### Include

Primary include targets:

- `data/`
- `data/opencode/`

Optional governance/doc targets:

- `constitution.md`
- `SPEC-KIT-GUIDE.md`
- selected `features/**` specs

Recommended v1 default:

- include runtime operational state from `data/`
- include `data/opencode/`
- include a manifest
- optionally include governance docs only if there is a clear restore portability requirement

### Exclude

Hard excludes:

- `.env*`
- `gmail-token.json`
- `gcp-oauth.keys.json`
- raw OAuth credentials
- plaintext files under `private/`
- `node_modules/`
- `.next/`
- `.logs/`
- `*.log`
- `python-ai/.venv/`
- `python-ai/**/__pycache__/`

Recommended v1 exclusions for size/noise:

- generated CV PDFs
- transient browser evidence
- exported workspace snapshots

---

## Output and Staging Layout

### Encrypted output

```text
private/exports/backup-YYYY-MM-DD-HHMM.age
```

### Plaintext temporary staging

```text
backups/staging/backup-YYYY-MM-DD-HHMM/
```

### Restore staging

```text
backups/restore-staging/<timestamp>/
```

### Pre-restore safety copy

```text
backups/pre-restore-<timestamp>/
```

All plaintext staging locations must remain gitignored.

---

## Encryption Dependency Strategy

Preferred encryption mechanism:

- external `age` CLI already aligned with current repo direction

Why:

- matches existing privacy docs,
- avoids adding JS crypto/archive dependencies,
- keeps key management outside the repo,
- works well with PowerShell scripts on Windows.

The implementation must document clearly that:

- `age` must be installed locally,
- recipient public key / identity file is provided outside the repo,
- private keys must never be committed.

---

## Manifest Design

Create a manifest per backup.

Suggested fields:

- backup version
- createdAt
- source root
- included paths
- excluded patterns
- encryption method
- restore instructions version
- optional file counts / byte counts

This manifest should be included inside the encrypted backup content and validated before restore touches live state.

---

## Restore Model

Recommended restore flow:

1. user selects encrypted `.age` backup file
2. decrypt into ignored restore staging folder
3. validate manifest and expected structure
4. if validation fails, abort without touching live state
5. create pre-restore safety copy of current live `data/` and `data/opencode/`
6. require explicit confirmation
7. restore selected paths into live locations

This should be non-destructive by default until the final confirmation step.

---

## Plaintext Cleanup Policy

The implementation should ensure:

- plaintext backup staging is removed after successful encryption,
- restore staging remains in ignored paths and can be cleaned explicitly,
- no plaintext archive is left under tracked directories,
- `private/` never contains plaintext backup data.

Recommended v1 behaviour:

- fail if encryption succeeds but plaintext cleanup fails,
- report cleanup failure clearly,
- never silently leave plaintext artifacts in tracked areas.

---

## Testing Strategy

The feature should test file selection/exclusion logic independently from the actual `age` binary.

Recommended tests:

- include targets selected correctly,
- excluded files filtered correctly,
- plaintext `private/` content excluded,
- token/credential file exclusion enforced,
- manifest content generation correct,
- restore validation rejects malformed backups.

Tests should not require real encryption keys.

For the external `age` CLI itself, treat encryption/decryption as an integration boundary and keep unit tests focused on:

- selection logic,
- manifest creation,
- restore preconditions.

---

## API / UI Considerations

The user specifically asked for script-first v1.

Therefore the implementation should avoid introducing a backup UI unless it is only documentation-level or deferred.

Potential future UI home:

- Settings

Pros:

- closest to privacy/runtime controls,
- operator-focused,
- good location for backup health and restore warnings.

Cons:

- destructive actions in the UI increase risk,
- more complex confirmation flows.

Recommended v1 decision:

- no UI yet
- scripts first
- optional later Settings panel after semantics are stable.

---

## Open Implementation Questions

1. Should governance/spec docs be included by default, or only runtime state?
2. Should generated CVs be excluded explicitly in v1?
3. Should the backup artifact be a zip/tar before encryption, or a structured staged directory piped directly into encryption?
4. Should restore support partial restore or only full restore in v1?
5. Should restore keep staging contents after success for inspection, or clean them immediately?

---

## Recommended Implementation Sequence

1. Build file selection/exclusion logic in a testable helper.
2. Build manifest generation helper.
3. Implement manual backup script using ignored staging.
4. Encrypt with external `age` CLI into `private/exports/*.age`.
5. Delete plaintext staging after successful encryption.
6. Implement restore staging and manifest validation.
7. Add pre-restore safety copy.
8. Add explicit confirmation gate.
9. Add tests.
10. Run lint/typecheck/test/build.

---

## Success Criteria

The feature is ready for implementation when the plan preserves:

- local-first behaviour,
- encrypted-only tracked export boundary,
- no secret inclusion,
- no plaintext tracked backup artifacts,
- safe restore semantics.
