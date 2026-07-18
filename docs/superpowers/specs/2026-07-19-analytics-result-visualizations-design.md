# Analytics Result Visualizations Design

## Purpose

Turn a validated Ask TillTally execution result into a readable, interactive chart and an equivalent data table. The renderer must remain deterministic: the analytics plan and server result choose the data, while client-owned code chooses every DOM element and Recharts property.

## Architecture

The result surface is split into two focused units:

- `client/src/analytics/resultModel.ts` is a pure adapter. It derives compatible views, chart points, metric formatting, filter and sort descriptions, and execution metadata from typed analytics results.
- `client/src/analytics/AnalyticsResultPanel.tsx` renders the adapter output. It owns the selected view and visible series, but never accepts HTML, SVG, JavaScript, or chart configuration from an API response.

`AnalyticsPage` continues to own request lifecycle and business isolation. It passes a completed result to the result panel and does not duplicate visualization logic.

## Visualization Rules

- Table is always available and is the textual equivalent for every chart.
- Line is available only for exactly one `day`, `week`, or `month` dimension.
- Bar is available only for exactly one dimension.
- Donut is available only for exactly one non-temporal dimension, no more than 12 rows, and complete non-negative values from a summable metric. Multi-metric results expose only compatible metrics in the selector; ratios such as margin percent and average order value remain table or Cartesian-chart values.
- Bar charts are available for no more than 20 categories. Denser results stay readable in the exact-value table.
- Results with no grouping or unsupported shapes fall back to table.
- Incompatible controls remain visible but disabled, with a concise reason exposed through accessible help text.

## Interaction And Information

The result header shows the report title, row count, execution time, and truncated state. A compact metadata band shows date range, grouping, filters, sort order, row limit, timezone, and exact generation time. Users can switch compatible views and toggle metric series, while at least one series always remains visible.

Charts use the existing restrained blue, emerald, amber, and slate data palette. Tooltips format values by unit. Line and bar legends are real series-toggle buttons with `aria-pressed`; donut reports use a bounded metric selector. All controls have visible focus and 44px targets. Empty results explain how to broaden the plan. Missing values render as `Unavailable` in tables and gaps in charts.

## Responsive And Accessibility

The chart frame has a stable 320px desktop height and 280px mobile height. Dense category labels are shortened on the axis while full values remain in tooltips and the table. Tables scroll inside their own boundary, never the document. At 375px, controls wrap into a full-width toolbar with no page-level horizontal overflow.

Charts receive a concise accessible name and are always paired with a table switch. Keyboard users can operate every view and series control. Color is never the only series cue because labels remain visible.

The analytics route and result renderer are separate lazy-loaded chunks. Recharts is requested only after an execution result exists, keeping the application shell and question workflow light on mobile devices.

## Testing

- Pure unit tests cover compatibility, formatting, chart projection, missing data, and series toggling.
- Static component tests cover metadata, accessible controls, empty states, and the absence of executable response markup.
- Playwright covers bar, line, donut, table, incompatible controls, series toggles, and 375px overflow.

## Scope Boundaries

This task does not add report persistence, saved views, exports, or model-generated narrative. Those belong to later issues. It does not change analytics aggregation beyond the donut validation needed to keep rendering unambiguous.
