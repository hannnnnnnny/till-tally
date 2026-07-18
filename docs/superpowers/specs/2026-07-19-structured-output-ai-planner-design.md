# Structured-output analytics planner design

## Goal

Translate a bounded retail analytics question into the shared `AnalyticsPlan` contract without
letting natural language, model output, provider URLs, or merchant rows cross the executor trust
boundary.

## Architecture

- `AnalyticsPlanner` is the application interface. Callers receive `ready`, `clarification`, or
  `unsupported` results and never depend on a model vendor.
- `StructuredOutputProvider` is a small server-only adapter boundary. The Ollama implementation
  calls `/api/chat` with streaming disabled, temperature 0, an abort signal, and a JSON Schema in
  `format`.
- The planner sends only the question, date context, and exported semantic catalog. It never sends
  merchant rows or database identifiers.
- Every provider response is parsed as JSON and validated with Zod. A `ready` response then passes
  through the existing strict `AnalyticsPlan` parser before it can reach preview or execution.
- A deterministic local planner handles common retail questions and provides the safe fallback when
  a provider is absent, unavailable, times out, refuses, or returns invalid output.

## HTTP contract

`POST /api/analytics/plan` uses the existing authentication and business-access middleware. The
body contains `question`, optional `timezone`, and optional `today`. The endpoint returns one of:

- `ready`: validated plan plus `source` (`local` or `provider`).
- `clarification`: a focused question and safe example prompts.
- `unsupported`: a bounded explanation and safe example prompts.

Provider errors are intentionally converted to fallback results. Existing analytics preview and
execute routes remain independent.

## Reliability and security

- Question length, dates, timezone, retry count, provider timeout, URL, and model name are bounded.
- Ollama is disabled unless configured on the server. It is optional in Docker and production.
- One retry is allowed only for invalid provider output. Abort signals cap every provider attempt.
- Prompt instructions explicitly reject SQL, JavaScript, raw fields, and unsupported metrics.
- Tests cover provider success, invalid JSON, invalid schema, timeout, refusal, unsupported requests,
  fallback behavior, and HTTP isolation.
