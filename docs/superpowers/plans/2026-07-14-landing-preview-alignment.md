# Landing Preview Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the complete hero dashboard preview inside the desktop viewport without changing the landing copy or mobile layout.

**Architecture:** Replace the center-plus-translation positioning contract with a right-anchored, viewport-constrained wrapper. Add a source-level regression test for the positioning contract, then verify the rendered bounding box in a production Pages build.

**Tech Stack:** React, TypeScript, Tailwind CSS, Node test runner, Vite, Playwright CLI

## Global Constraints

- The complete dashboard preview must remain visible with no clipping.
- Preserve the current hero text position and preview component markup.
- Keep the large hero preview hidden below the existing desktop breakpoint.
- Do not change the standalone dashboard preview section.
- Branch names must not use a `codex/` prefix.

---

### Task 1: Constrain the Hero Dashboard Preview

**Files:**

- Create: `client/src/landing/LandingPage.test.ts`
- Modify: `client/src/landing/LandingPage.tsx`

**Interfaces:**

- Consumes: the existing `HeroDashboardPreview` component and desktop-only hero backdrop.
- Produces: a `data-testid="hero-dashboard-backdrop"` wrapper anchored to the right edge with responsive viewport width and a maximum width of 1180px.

- [ ] **Step 1: Write the failing positioning-contract test**

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const landingSource = readFileSync(new URL('./LandingPage.tsx', import.meta.url), 'utf8');

describe('landing hero dashboard alignment', () => {
  it('anchors the full preview inside the desktop viewport', () => {
    assert.match(landingSource, /data-testid="hero-dashboard-backdrop"/);
    assert.match(landingSource, /right-6/);
    assert.match(landingSource, /max-w-\[1180px\]/);
    assert.match(landingSource, /w-\[calc\(100vw-3rem\)\]/);
    assert.match(landingSource, /lg:top-8/);
    assert.doesNotMatch(landingSource, /left-1\/2/);
    assert.doesNotMatch(landingSource, /-translate-x-/);
  });
});
```

- [ ] **Step 2: Run the focused test and observe the positioning failure**

Run: `npm.cmd test -w client`

Expected: FAIL because the current hero wrapper uses `left-1/2` and negative translation and does not expose the test id or right-side constraints.

- [ ] **Step 3: Implement the right-anchored responsive wrapper**

Replace the current inner hero preview wrapper with:

```tsx
<div
  data-testid="hero-dashboard-backdrop"
  className="absolute right-6 top-8 w-[calc(100vw-3rem)] max-w-[1180px] lg:right-8 lg:top-8 lg:w-[calc(100vw-4rem)]"
>
  <HeroDashboardPreview />
</div>
```

- [ ] **Step 4: Run the focused test and all client tests**

Run: `npm.cmd test -w client`

Expected: the new alignment test and all existing client tests pass.

- [ ] **Step 5: Verify real production layout at desktop and mobile widths**

Build and serve the same static mode used by GitHub Pages:

```powershell
$env:VITE_BASE_PATH='/till-tally/'
$env:VITE_STATIC_PREVIEW='true'
npm.cmd run build -w client
npm.cmd run preview -w client -- --host 127.0.0.1
```

Use Playwright at 1024px, 1440px, and 1920px widths to assert:

```js
const box = await page.getByTestId('hero-dashboard-backdrop').boundingBox();
const viewport = page.viewportSize();
box.x >= 0;
box.x + box.width <= viewport.width;
document.documentElement.scrollWidth === viewport.width;
```

At 375px, confirm the desktop preview is hidden and `document.documentElement.scrollWidth === 375`.

- [ ] **Step 6: Run repository verification**

Run: `npm.cmd run lint`

Expected: exit 0.

Run: `npm.cmd run typecheck`

Expected: exit 0.

Run: `npm.cmd run build`

Expected: exit 0.

Run: `git diff --check`

Expected: no output.

- [ ] **Step 7: Commit the implementation**

```powershell
git add client/src/landing/LandingPage.tsx client/src/landing/LandingPage.test.ts docs/superpowers/plans/2026-07-14-landing-preview-alignment.md
git commit -m "fix: keep landing preview inside viewport"
```
