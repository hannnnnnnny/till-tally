# Analytics evaluations

Ask TillTally has a deterministic release gate that does not call a live model:

```bash
npm run test:analytics-evals -w server
```

The suite fixes the clock and a small retail dataset, then checks the validated plan (metrics, grouping, chart, limit and resolved date range) and, where relevant, the exact executed rows. Every case must pass in CI. Failure output names the case and the property or rows that drifted.

The 18 cases cover:

| Area | Examples |
| --- | --- |
| Metrics and grouping | daily revenue, top products, margin by channel, gross profit by category, average order value, order counts |
| Date phrases | this week, this month, last 7 days, last month, yesterday |
| Inventory | low stock and dead stock by category |
| Chart requests | a chart type named in the first question ("as a table") |
| Refinements | switching metric, chart type or date range on an existing plan |
| Guidance | vague questions ask for clarification; code generation and customer lifetime value are refused |

Live-provider testing is optional and separate from the merge gate. To exercise Ollama locally, configure the analytics planner environment variables, run the application, and use the Analytics page. Provider failures must still return the deterministic local fallback or bounded clarification response; CI never requires provider availability or credentials.
