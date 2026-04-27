# Tasks: Runtime Integration Guardrails

Feature folder: `features/runtime-integration-guardrails/`

---

## Phase 0 - Safety Preconditions

- [ ] Confirm `constitution.md` rules are satisfied.
- [ ] Confirm no `.env.local` access is required.
- [ ] Confirm no ranking or application-status behaviour will change.
- [ ] Confirm no external services or providers are added.
- [ ] Confirm no UI is required in v1.

---

## Phase 1 - Notion Guardrail

- [ ] Classify missing Notion config as clean skip.
- [ ] Classify Notion database 404 as `notion_misconfigured`.
- [ ] Emit one concise warning for Notion misconfiguration.
- [ ] Keep Notion sync best-effort and non-fatal to the pipeline.
- [ ] Avoid raw stack traces during expected misconfiguration cases.

---

## Phase 2 - Apollo Guardrail

- [ ] Preserve `plan_restricted` classification for free-plan endpoint restrictions.
- [ ] Prevent repeated company or people search once plan restriction is known in the same run.
- [ ] Keep email lookup fallback safe.
- [ ] Keep contact strategy returning fallback decision makers.
- [ ] Keep Apollo logs concise.

---

## Phase 3 - OpenRouter Free-Tier Guardrail

- [ ] Detect OpenRouter `:free` model rate-limit or quota failures.
- [ ] Classify them as `rate_limited`.
- [ ] Stop trying remaining OpenRouter free models in the same task run.
- [ ] Preserve any already-available reliable non-free fallback route if it exists.
- [ ] If no reliable fallback exists, return a safe failure state for `generate-outreach`.
- [ ] Do not change prompts.

---

## Phase 4 - Log Sanitisation

- [ ] Reuse or extract telemetry sanitization for runtime logs.
- [ ] Replace raw provider JSON console output with concise summaries.
- [ ] Keep safe task/provider/model metadata in logs.

---

## Phase 5 - Tests

- [ ] Test Notion missing-config skip.
- [ ] Test Notion 404 classification.
- [ ] Test Apollo free-plan restriction classification.
- [ ] Test Apollo repeated-call suppression in the same run.
- [ ] Test OpenRouter free-model 429 short-circuit.
- [ ] Test sanitized console logging.
- [ ] Avoid secret-dependent tests.

---

## Phase 6 - Verification

- [ ] Run lint.
- [ ] Run typecheck.
- [ ] Run tests.
- [ ] Run build.
- [ ] Manually confirm pipeline runs no longer spam known Notion/Apollo/OpenRouter failure noise.

---

## Phase 7 - Fix Commit

- [ ] Keep the PR narrowly scoped to runtime guardrails.
- [ ] Do not add UI unless implementation proves it is needed.
- [ ] Commit only after verification passes.

Suggested future commit:

```bash
git add .
git commit -m "fix(runtime): add integration guardrails"
```
