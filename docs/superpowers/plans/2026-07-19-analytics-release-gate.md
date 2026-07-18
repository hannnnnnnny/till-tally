# Analytics release gate implementation plan

1. Add failing route tests for separate planner and execution rate limits, tenant isolation, and adversarial payload rejection.
2. Add failing safe-audit tests that prove prompts, secrets, filter values, and result rows cannot enter analytics logs.
3. Add a deterministic planning and numeric execution evaluation harness with case-level CI diagnostics.
4. Implement route limits, safe structured audit events, and explicit CI evaluation scripts.
5. Add accessibility tooling and 375px browser coverage for prompt, review, chart, table, and saved-report states.
6. Document optional live-provider checks and verify provider-offline and timeout recovery.
7. Run formatting, lint, typecheck, unit, contract, evaluation, build, Playwright, Docker, migration, dependency audit, and visual checks.
8. Commit, push, open a PR closing issue 189, wait for Linux CI, and merge.
