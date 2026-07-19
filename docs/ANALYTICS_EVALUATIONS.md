# Analytics evaluations

Ask TillTally has a deterministic release gate that does not call a live model:

```bash
npm run test:analytics-evals -w server
```

The suite fixes the clock and retail dataset, then checks both the validated plan shape and exact numeric output for representative revenue, margin, product, and inventory questions. Every case must pass in CI. Failure output names the case and the property or rows that drifted.

Live-provider testing is optional and separate from the merge gate. To exercise Ollama locally, configure the analytics planner environment variables, run the application, and use the Analytics page. Provider failures must still return the deterministic local fallback or bounded clarification response; CI never requires provider availability or credentials.
