# Tasks: Encrypted Backup / Restore

Feature folder: `features/encrypted-backup/`

---

## Phase 0 — Safety Preconditions

- [ ] Confirm `constitution.md` rules are satisfied.
- [ ] Confirm `.gitignore` still protects `private/`.
- [ ] Confirm `private/` allows only `.gitkeep` and `.age` files.
- [ ] Confirm no plaintext backup output will be created under tracked paths.

---

## Phase 1 — Selection and Manifest Logic

- [ ] Create selection helper for backup inclusion/exclusion.
- [ ] Include `data/` and `data/opencode/` by default.
- [ ] Exclude `.env*`, OAuth files, logs, dependencies, build outputs, caches, and plaintext private files.
- [ ] Create manifest generator.
- [ ] Add tests for inclusion/exclusion behaviour.

---

## Phase 2 — Manual Backup Script

- [ ] Create manual backup script entrypoint.
- [ ] Stage plaintext backup only in ignored staging.
- [ ] Write manifest into backup payload.
- [ ] Encrypt output to `private/exports/*.age`.
- [ ] Confirm recipient/key configuration is external to repo.
- [ ] Remove plaintext staging after successful encryption.
- [ ] Report backup summary clearly.

---

## Phase 3 — Manual Restore Script

- [ ] Create restore entrypoint.
- [ ] Decrypt into ignored restore staging first.
- [ ] Validate manifest before touching live state.
- [ ] Create pre-restore safety copy.
- [ ] Require explicit confirmation before overwrite.
- [ ] Restore live state only after validation and confirmation.

---

## Phase 4 — Tests

- [ ] Test selection helper includes correct files.
- [ ] Test exclusion helper blocks secret/token/private plaintext files.
- [ ] Test manifest generation.
- [ ] Test restore validation rejects malformed backup content.
- [ ] Avoid real `age` dependency in unit tests.

---

## Phase 5 — Verification

- [ ] Run lint.
- [ ] Run typecheck.
- [ ] Run tests.
- [ ] Run build.
- [ ] Manually create encrypted backup.
- [ ] Confirm output lands in `private/exports/*.age`.
- [ ] Confirm no plaintext archive remains in tracked paths.
- [ ] Manually test restore staging and confirmation flow.

---

## Phase 6 — Commit

- [ ] Commit implementation only after verification.

Suggested commit:

```bash
git add .
git commit -m "feat(encrypted-backup): add local encrypted backup and restore"
```
