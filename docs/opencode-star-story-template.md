# STAR Story Template

Store STAR stories under `data/opencode/stars/*.md`.

Recommended format:

```md
# Audit readiness under dispensing pressure

Tags: audit, ich-gcp, dispensing-error, documentation, pharmacy, escalation

## Situation
Describe the context in 2-4 sentences.

## Task
Describe what you specifically had to achieve.

## Action
List the concrete actions you took.

## Result
State the outcome, ideally with a measurable result.
```

Tips:

- Keep patient details fully redacted.
- Prefer one story per file.
- Use tags that match interview themes you want to retrieve later:
  - `audit`
  - `gmp`
  - `ich-gcp`
  - `deviation`
  - `documentation`
  - `stakeholder-management`
  - `prioritisation`
  - `incident-handling`
  - `patient-safety`

The OpenCode STAR retrieval endpoint reads these files and ranks them against an interview question.
