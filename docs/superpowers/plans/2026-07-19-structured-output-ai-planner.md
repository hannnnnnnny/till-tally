# Structured-output analytics planner implementation plan

1. Add shared planner request/result schemas and JSON Schema generation inputs.
2. Write failing service tests for deterministic prompts and provider failure modes.
3. Implement the provider-neutral planner and deterministic fallback.
4. Write failing adapter tests, then implement the bounded Ollama `/api/chat` adapter.
5. Write failing route tests, then add the authenticated `/api/analytics/plan` endpoint.
6. Add optional server configuration and local Docker/developer documentation.
7. Run package, server, full-repository, Docker, and CI verification before merging.
