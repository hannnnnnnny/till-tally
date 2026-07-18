# Analytics release gate design

## Goal

Make Ask TillTally safe and predictable under adversarial input, provider outages, expensive requests, and small-screen use. The release gate must run deterministically in CI without a live model while keeping live-provider checks optional.

## Trust boundaries

- Natural-language questions and model output are untrusted input.
- Only the shared strict analytics contracts may cross from planning into execution.
- Business scope always comes from authenticated middleware. Request bodies and model output cannot select a tenant.
- The executor accepts validated plans only and continues to enforce bounded dates, metrics, dimensions, filters, and row limits.
- Planner and execution endpoints have separate rate-limit budgets because their cost and abuse modes differ.

## Safe observability

Analytics audit events contain an event name, outcome, duration, safe failure code, fingerprinted actor and business identifiers, and bounded plan metadata. They never contain the prompt, provider response, access tokens, secrets, filter values, raw result rows, email addresses, or business names.

## Deterministic evaluations

The CI evaluation suite uses a fixed clock, representative retail questions, expected plan properties, and an in-memory analytics fixture. It scores planning and numeric execution independently and prints case-level diagnostics. The required threshold is 100 percent for the deterministic suite. Live-provider evaluation is documented as an optional local check and is not a merge gate.

## Reliability and abuse controls

- Planner and execution requests receive independent per-IP limits with standard retry metadata.
- Invalid, oversized, tenant-selecting, schema-escaping, and raw-query payloads fail before provider or data-source work.
- Provider timeout and offline states fall back to the deterministic planner when possible.
- Execution timeouts return a stable public error without internal details.

## Responsive accessibility gate

The analytics workflow is checked at 375px across prompt, review, chart, table, and saved-report states. Automated checks cover serious accessibility violations, horizontal overflow, keyboard focus, dialog naming, loading status, and error announcements.

