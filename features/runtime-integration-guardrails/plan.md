# Implementation Plan: Runtime Integration Guardrails

Feature folder: `features/runtime-integration-guardrails/`

---

## Technical Direction

Implement Runtime Integration Guardrails as a small hardening pass over existing integration and AI runtime paths.

It should:

- classify common optional-integration failures,
- suppress repeated doomed retries inside the same run,
- return safe fallbacks for optional behaviour,
- sanitize logs,
- and leave business logic unchanged.

This is not a new integration feature.

---

## Why This Should Stay Small

The problem is not missing capability.

The problem is noisy failure behaviour.

The smallest correct approach is to patch the failure seams already present in:

- Notion best-effort sync,
- Apollo provider and contact strategy,
- OpenRouter task execution in the AI client,
- and console error logging.

This avoids introducing:

- new providers,
- new persistence,
- new UI,
- new routing abstractions,
- or new operational config.

---

## Likely Implementation Files

### Primary files

```text
src/lib/integrations/notion-jobs.ts
src/lib/enrichment/contact-strategy.ts
src/lib/enrichment/providers/apollo.ts
src/lib/ai/client.ts
```

### Secondary helper touchpoint

```text
src/lib/ai/telemetry.ts
```

or a tiny shared pure helper if sanitization extraction is cleaner.

### Tests

```text
src/lib/integrations/notion-jobs.test.ts
src/lib/enrichment/contact-strategy.test.ts
src/lib/ai/client.guardrails.test.ts
```

Existing tests may be extended instead of adding entirely new files if that is smaller and clearer.

---

## Guardrail Design

## 1. Notion guardrail

### Current behaviour

`syncJobsToNotionBestEffort()` and `syncAllJobsToNotionBestEffort()` catch all thrown errors and print:

- `[notion] job sync failed:` plus raw error object
- `[notion] full job sync failed:` plus raw error object

Database lookup currently throws generic errors such as:

- `Notion database lookup failed: 404`

### Recommended v1 design

Introduce narrow classification inside `src/lib/integrations/notion-jobs.ts`:

- `not_configured`
- `notion_misconfigured`
- generic runtime failure

Recommended rules:

- missing token or DB ID -> skip cleanly
- database lookup 404 -> `notion_misconfigured`
- optionally treat 403 similarly if the integration is not shared
- other statuses remain generic non-fatal sync failures

Recommended logging:

- log one concise warning
- suppress raw stacks during normal pipeline runs

Safe example:

```text
[notion] job sync skipped: database not found or integration not shared
```

### Storage/persistence impact

- none required

### API/pipeline impact

- pipeline route stays best-effort
- no ranking or stage logic change

---

## 2. Apollo guardrail

### Current behaviour

The Apollo provider already has a `plan_restricted` result status and already detects free-plan endpoint restrictions from `API_INACCESSIBLE`.

However:

- provider logs remain noisy,
- company enrichment and people search can still be attempted again later in the same run,
- contact strategy only partially suppresses logging for `plan_restricted`.

### Recommended v1 design

Treat Apollo restriction state as run-local circuit-breaker state.

Preferred direction:

- do not persist restriction state,
- optionally allow short-lived provider-process memory only where natural,
- keep the main suppression decision in the current run path.

Two acceptable small approaches:

1. add a run-local guardrail object inside `buildContactStrategy()` and propagate it through company enrichment, people search, and email backfill
2. add a small process-local TTL circuit breaker inside the Apollo provider and let callers observe `plan_restricted` immediately on later calls

Preferred option:

- provider-level short-lived in-memory circuit breaker plus caller-level concise logging

Why:

- the provider already owns health, cache, and budget logic,
- it prevents duplicate request attempts across multiple call sites in the same process,
- it avoids expanding every caller signature too much.

### Fallback behaviour

When `plan_restricted` is reached:

- company intel may remain `null`
- decision makers should fall back to the existing fallback hiring-team templates
- outreach generation may still proceed if enough fallback contact data exists, but must tolerate missing Apollo data

### Logging

Prefer a single concise log such as:

```text
[apollo] enrichment skipped: plan restricted
```

Avoid repeating endpoint-specific warnings on every later skipped call.

---

## 3. OpenRouter free-model fallback guardrail

### Current behaviour

`generate-outreach` is configured to prefer the secondary runtime:

- provider: `openrouter`
- model: `qwen/qwen3-next-80b-a3b-instruct:free`
- fallback model: free-tier as well by default at runtime config level

`callAI()` currently loops through runtime candidates and models and logs the raw error string. When the provider returns:

- `AI runtime returned 429: {...raw JSON...}`

the runtime may continue trying more free-tier routes in that same task flow.

### Recommended v1 design

Add a narrow guardrail inside `src/lib/ai/client.ts`.

Detection rule:

- runtime provider is `openrouter`
- current model name contains `:free`
- error indicates 429, rate limit, quota, or free-tier restriction

Behaviour:

- classify the failure as `rate_limited`
- stop trying other OpenRouter free models in the same task run
- continue to a reliable non-OpenRouter candidate only if one already exists in the current runtime candidate list
- if no reliable candidate exists, return a safe failure state to the caller

### Recommended caller outcome for `generate-outreach`

Use the existing safe fallback path:

- `generateOutreachStrategy()` returns `null`

Why this is correct:

- it already exists,
- no prompt changes are needed,
- no fabricated outreach text is introduced.

### No config changes required

Do not rewrite AI config in this fix.

This PR should harden runtime handling only.

---

## 4. Log sanitisation

### Current behaviour

`src/lib/ai/client.ts` currently logs failures like:

```text
[ai-client] generate-outreach using openrouter/model attempt 1 failed: AI runtime returned 429: {...raw JSON...}
```

### Recommended v1 design

Reuse existing sanitisation behaviour from `src/lib/ai/telemetry.ts` where possible.

Preferred implementation direction:

- extract or reuse a pure summarizer based on `sanitizeTelemetryErrorSummary()`
- keep console output to concise provider-safe summaries

Example result:

```text
[ai-client] generate-outreach failed on openrouter: rate limit exceeded
```

Keep safe metadata when available:

- task type
- provider
- model
- failure class

Avoid:

- raw provider JSON
- long stack traces in expected runtime restriction cases

---

## Classification Strategy

Recommended local classification vocabulary:

- Notion:
  - `not_configured`
  - `notion_misconfigured`
  - `runtime_error`
- Apollo:
  - existing `plan_restricted`
  - `not_configured`
  - `auth_failed`
  - `timeout`
  - `network_error`
- OpenRouter free-tier:
  - internal route classification `rate_limited`
  - with a narrow free-tier short-circuit rule in the current task run

No new global telemetry service or persisted integration-state storage is needed.

---

## Testing Strategy

Recommended tests:

### Notion

- database lookup 404 returns or surfaces `notion_misconfigured`
- missing config skips cleanly
- best-effort wrapper logs a concise warning without stack dump content

### Apollo

- free-plan `API_INACCESSIBLE` maps to `plan_restricted`
- after plan restriction is detected, later company or people lookups in the same run are skipped
- fallback decision makers still return

### OpenRouter and logging

- OpenRouter `:free` 429 stops remaining free-model attempts in the same task run
- caller receives safe failure state for `generate-outreach`
- console output is sanitized and does not include raw JSON blobs

Tests must not require:

- `.env.local`
- live Notion access
- live Apollo access
- live OpenRouter access
- any AI provider credentials

---

## Risks and Tradeoffs

### Risk 1: Over-suppressing logs

If sanitization hides too much, debugging unexpected failures becomes harder.

Mitigation:

- keep concise provider/task/model metadata,
- only suppress raw payload blobs and expected free-plan noise.

### Risk 2: Circuit breaker too broad

If plan restriction or rate-limit state is persisted too long, valid later calls may be skipped.

Mitigation:

- do not persist state,
- prefer per-run or short in-memory TTL only.

### Risk 3: OpenRouter guardrail accidentally changes broader AI routing

Mitigation:

- keep the change local to free-tier rate-limit handling,
- do not redesign `callAI()` candidate ordering.

---

## Recommended Implementation Sequence

1. Add typed Notion failure classification and concise best-effort logs.
2. Add Apollo plan-restriction circuit breaker behaviour with concise logs.
3. Add OpenRouter free-tier rate-limit short-circuit in the AI client.
4. Reuse or extract log sanitization from telemetry logic.
5. Add focused tests for Notion 404, Apollo free-plan restriction, OpenRouter 429, and sanitized logs.
6. Run lint, typecheck, tests, and build.

---

## Release Shape

Recommended commit type:

- `fix(runtime): add integration guardrails`

Recommended PR type:

- small fix PR

No UI or storage migration is required in v1.
