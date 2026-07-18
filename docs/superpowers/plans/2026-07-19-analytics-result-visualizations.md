# Analytics Result Visualizations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render every validated analytics result as a safe interactive chart and equivalent data table.

**Architecture:** A pure result adapter owns compatibility and formatting. A React result panel owns only view and series state and renders a fixed Recharts component whitelist. `AnalyticsPage` keeps request lifecycle and active-business isolation.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Recharts 3, Node test runner, Playwright.

## Global Constraints

- Never execute model-generated HTML, SVG, JavaScript, or chart configuration.
- Every chart must have an accessible table equivalent.
- Document width must not overflow at 375px.
- Use the existing product design system and chart palette.

---

### Task 1: Build the pure result adapter

**Files:**
- Create: `client/src/analytics/resultModel.ts`
- Create: `client/src/analytics/resultModel.test.ts`
- Modify: `client/src/analytics/types.ts`

**Interfaces:**
- Produces: `getVisualizationOptions(result)`, `buildAnalyticsChartData(result)`, `formatAnalyticsValue(value, unit)`, `toggleMetricSeries(visible, key)`, and metadata formatters.

- [x] Write tests for line, bar, summable-metric donut, table-only, dense charts, units, null values, and series toggling.
- [x] Run the tests and confirm the adapter module is missing.
- [x] Implement typed compatibility and formatting helpers without React or Recharts.
- [x] Re-run the tests and confirm they pass.

### Task 2: Render the interactive result panel

**Files:**
- Create: `client/src/analytics/AnalyticsResultPanel.tsx`
- Create: `client/src/analytics/AnalyticsResultPanel.test.ts`
- Modify: `client/src/pages/AnalyticsPage.tsx`

**Interfaces:**
- Consumes: `{ result: AnalyticsExecutionResult }`
- Produces: fixed line, bar, donut, and table views with metadata and empty states.

- [x] Write static markup tests for metadata, view controls, unsupported feedback, empty results, and response-markup escaping.
- [x] Run the tests and confirm the component is missing.
- [x] Implement the result panel with fixed Recharts components and 44px controls.
- [x] Replace the inline table in `AnalyticsPage` with the panel.
- [x] Re-run client tests and typecheck.

### Task 3: Verify browser interaction and responsive layout

**Files:**
- Modify: `client/e2e/analytics-workspace.spec.ts`

**Interfaces:**
- Exercises: result view switcher, series toggles, tooltips/table fallback, and 375px layout.

- [x] Extend API fixtures with chart series data and alternate line/donut results.
- [x] Add Playwright assertions for bar, line, donut, table, unavailable focusable views, and no horizontal overflow.
- [x] Run the targeted Playwright file and fix only observed failures.
- [x] Capture desktop and 375px screenshots and inspect them.

### Task 4: Release verification

**Files:**
- Review all changed files.

- [x] Run format check for changed files, lint, all tests, all typechecks, production build, and full Playwright.
- [x] Run `npm audit --omit=dev` and inspect the staged diff for generated or unrelated changes.
- [ ] Commit, push, create a concise PR with `Closes #187`, wait for Linux CI, and merge only after it passes.
