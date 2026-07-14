# GitHub Pages Deployment Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the GitHub Pages portfolio preview route-safe, honest about its static capabilities,
and deploy only after successful CI.

**Architecture:** Add a focused runtime configuration module consumed by routing, authentication,
and asset rendering. Build Pages in explicit static-preview mode and trigger its workflow only from
a successful `main` CI run. Full-stack BrowserRouter and same-origin API behavior remain the default.

**Tech Stack:** React 18, React Router 7, TypeScript, Vite 6, Node test runner, GitHub Actions.

## Global Constraints

- Branch names do not use a `codex/` prefix.
- GitHub Pages never receives production secrets.
- Ubuntu/Docker behavior remains unchanged by default.
- Every behavior change follows red-green TDD.

---

### Task 1: Runtime Deployment Configuration

**Files:**
- Create: `client/src/config/runtime.ts`
- Test: `client/src/config/runtime.test.ts`

**Interfaces:**
- Produces: `createRuntimeConfig(env)`, `runtimeConfig`, and `assetUrl(path)`.
- Consumers: `App.tsx`, `AuthContext.tsx`, and `LandingPage.tsx`.

- [x] Write tests asserting default browser/full-stack mode and explicit hash/static-preview mode.
- [x] Run the focused runtime test and observe
  failure because the module does not exist.
- [x] Implement normalized base paths, static-preview detection, router mode, API availability, and
  base-aware asset URLs.
- [x] Rerun the targeted test and confirm it passes.

### Task 2: Route-Safe and Honest Static Preview

**Files:**
- Modify: `client/src/App.tsx`
- Modify: `client/src/auth/AuthContext.tsx`
- Modify: `client/src/landing/LandingPage.tsx`
- Modify: `client/index.html`

**Interfaces:**
- Consumes: runtime configuration from Task 1.
- Produces: HashRouter in static mode, no startup auth request in static mode, base-aware assets, and
  static-preview-specific calls to action.

- [x] Route static builds through `HashRouter` and skip authentication restoration when the API is
  unavailable.
- [x] Resolve public assets against the Vite base path and replace broken login actions with honest
  static-preview actions.
- [x] Verify desktop and mobile section navigation without hash-router conflicts.
- [x] Rerun client tests and confirm all pass.

### Task 3: CI-Gated Pages Workflow

**Files:**
- Modify: `.github/workflows/deploy-pages.yml`
- Modify: `server/src/ci/ciHygiene.test.ts`

**Interfaces:**
- Consumes: successful `CI` workflow completion on `main`.
- Produces: immutable, finite, static-preview Pages deployment.

- [x] Add failing workflow-policy tests for `workflow_run`, success gating, explicit checkout SHA,
  static-preview variables, timeout, cancellation, and commit-pinned actions.
- [x] Run the targeted CI hygiene tests and observe policy failures.
- [x] Update the Pages workflow with the smallest configuration satisfying those policies.
- [x] Rerun targeted tests and confirm they pass.

### Task 4: End-to-End Verification and Delivery

**Files:**
- Verify all modified files.

**Interfaces:**
- Consumes: Tasks 1-3.
- Produces: a reviewed PR targeting `main`.

- [x] Run `npm.cmd run format:check` in a clean LF checkout.
- [x] Run `npm.cmd run prisma:validate -w server` with a non-production database URL.
- [x] Run `npm.cmd run typecheck`, `npm.cmd test --workspaces --if-present`,
  `npm.cmd run build`, and `npm.cmd run lint`.
- [x] Build with `VITE_BASE_PATH=/till-tally/` and `VITE_STATIC_PREVIEW=true`, serve the artifact,
  and verify desktop plus 375px mobile behavior in a browser.
- [x] Confirm no `/api` request is made and reload remains inside `/till-tally/`.
- [ ] Commit, push `fix/pages-deployment-safety`, and open a ready PR to `main`.
