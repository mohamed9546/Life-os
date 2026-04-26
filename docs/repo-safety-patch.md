# Repo Safety Patch

This patch closes the privacy boundary before further feature work.

Life-OS uses local operational data and may contain sensitive career, recruiter, pharmacy, regulatory, and supplier information. The repository must not track plaintext private exports.

---

## Problem

The project already treats `data/` as ignored local runtime state, and `private/` is intended for encrypted sensitive exports only.

The required rule is:

- never commit plaintext files inside `private/`,
- allow `private/.gitkeep`,
- allow encrypted `.age` files only.

---

## Patch `.gitignore`

Add this block to `.gitignore`:

```gitignore
# Private encrypted exports only
private/*
!private/.gitkeep
!private/**/*.age
```

Keep existing rules for:

```gitignore
data/
.env*
backups/
node_modules/
.next/
```

---

## Check What Is Already Tracked

Run:

```bash
git status
git ls-files private
```

If nothing sensitive appears, continue.

If plaintext files are already tracked under `private/`, remove them from Git tracking without deleting local copies:

```bash
git rm --cached path/to/private-file
```

Then commit:

```bash
git add .gitignore private/.gitkeep
git commit -m "chore(security): protect private encrypted export boundary"
```

---

## If Sensitive Data Was Already Pushed

If secrets, patient identifiers, OAuth tokens, supplier pricing, or private recruiter notes were pushed:

1. Rotate any exposed secrets immediately.
2. Remove the file from the latest commit.
3. Consider full Git history cleanup only if the content is genuinely sensitive.
4. Do not rely on deletion from the GitHub UI as a full mitigation.

---

## Recommended `private/` Structure

```text
private/
  .gitkeep
  exports/
    snapshot-YYYY-MM-DD.age
```

Do not store plaintext `.json`, `.md`, `.txt`, `.pdf`, `.docx`, or `.csv` under `private/`.

---

## Pre-Commit Guardrail Requirements

The pre-commit hook should block:

- plaintext files under `private/`,
- `.env` files,
- OAuth credential files,
- likely NHS numbers,
- likely CHI numbers,
- likely DOB patterns,
- obvious API key patterns.

Suggested blocked patterns:

```text
NHS number: 10 digits, optionally spaced
CHI number: 10 digits where the first 6 look like DDMMYY
DOB: DD/MM/YYYY or DD-MM-YYYY
.env files
gmail-token.json
gcp-oauth.keys.json
```

Install the repo hook template with:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/opencode/install-hooks.ps1
```

---

## Acceptance Criteria

This patch is complete when:

- `.gitignore` protects `private/`,
- only `.age` and `.gitkeep` are allowed under `private/`,
- `git ls-files private` shows no plaintext sensitive files,
- the pre-commit hook blocks plaintext private files,
- the repo can still commit encrypted exports if intentionally needed.
