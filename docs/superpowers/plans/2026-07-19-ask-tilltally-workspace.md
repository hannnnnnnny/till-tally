# Ask TillTally Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an authenticated, mobile-safe prompt-to-plan review and execution workspace.

**Architecture:** A focused analytics API module handles planner, preview, and execution requests.
Pure plan helpers own labels, edits, and client constraints. A render-testable plan panel displays
and edits the draft, while the route page owns abortable workflow state scoped to one business.

**Tech Stack:** React 18, TypeScript, React Router, Tailwind CSS, Node test runner, Playwright.

## Global Constraints

- Preserve the active business boundary and reset all work when it changes.
- Never accept or display executable SQL or JavaScript.
- Keep the full workflow usable at 375px without horizontal overflow or fixed keyboard overlap.
- Identify provider-generated plans and require review before execution.
- Use the existing AppShell, controls, colors, spacing, and state components.

---

### Task 1: Define the client analytics contract and request layer

**Files:**
- Create: `client/src/analytics/types.ts`
- Create: `client/src/analytics/api.ts`
- Create: `client/src/analytics/api.test.ts`

**Interfaces:**
- Produces: `planAnalyticsQuestion`, `previewAnalyticsPlan`, `executeAnalyticsPlan` and bounded client
  response types used by the page.

- [x] Write failing tests for headers, request bodies, abort signals, and structured API errors.
- [x] Run `npm test -w client` and confirm the missing module failure.
- [x] Implement the three API calls and safe JSON error reader.
- [x] Run the client tests and typecheck.

### Task 2: Add editable plan helpers and the plan review component

**Files:**
- Create: `client/src/analytics/plan.ts`
- Create: `client/src/analytics/plan.test.ts`
- Create: `client/src/analytics/PlanReviewPanel.tsx`
- Create: `client/src/analytics/PlanReviewPanel.test.ts`

**Interfaces:**
- Produces: metric/dimension/chart option catalogs, `validateAnalyticsPlan`, immutable update helpers,
  and `PlanReviewPanel` props for controlled plan editing.

- [x] Write failing tests for incompatible edits, date order, bounded limits, safe rendered labels,
  provider identification, and absence of executable fields.
- [x] Run the targeted tests and confirm failure.
- [x] Implement pure helpers and the controlled review panel with standard form controls.
- [x] Run client tests, lint, and typecheck.

### Task 3: Build the abortable workspace route and navigation

**Files:**
- Create: `client/src/pages/AnalyticsPage.tsx`
- Modify: `client/src/App.tsx`
- Modify: `client/src/navigation/routes.ts`
- Modify: `client/src/navigation/routes.test.ts`
- Modify: `client/src/layout/AppShell.tsx`

**Interfaces:**
- Consumes: analytics API functions and `PlanReviewPanel`.
- Produces: `/analytics` route with prompt, clarification, unsupported, failure, plan review, and
  result states.

- [x] Extend navigation tests first and confirm they fail for the absent Analytics route.
- [x] Add the route, icon, desktop/mobile ordering, and business-scoped workflow state.
- [x] Add prompt examples, cancellation, retry, strict preview-before-execute, and result table.
- [x] Run client tests, lint, typecheck, and production build.

### Task 4: Verify browser behavior and responsive quality

**Files:**
- Create: `client/e2e/analytics-workspace.spec.ts`

**Interfaces:**
- Exercises: authenticated mocked API workflow at desktop and 375px.

- [x] Add Playwright scenarios for ready review/execution, clarification, provider/network failure,
  cancellation, business isolation, keyboard operation, touch targets, and no horizontal overflow.
- [x] Run the browser tests and inspect desktop and mobile screenshots.
- [x] Fix any visual, accessibility, or state defects found during browser review.
- [x] Run full tests, lint, typecheck, build, Docker build, and dependency audit before the PR.
