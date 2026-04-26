# OpenCode Privacy Guardrail

Live operational state lives under `data/opencode/`.

- `data/` is already gitignored and is the runtime source of truth.
- `private/` is reserved for encrypted exports, snapshots, and any sensitive material you may want to keep in the repo only after encrypting with `age`.

Rules:

- Never commit plaintext files inside `private/`.
- Only `.age` files and `private/.gitkeep` should be allowed there.
- Do not paste patient identifiers into notes, STAR stories, or pearls.
- The pre-commit hook blocks staged files containing likely NHS numbers or date-of-birth patterns.

Recommended flow:

1. Work locally in `data/opencode/`.
2. Export sensitive snapshots to `private/` only after encrypting them.
3. Keep STAR stories and outreach drafts anonymised by default.
