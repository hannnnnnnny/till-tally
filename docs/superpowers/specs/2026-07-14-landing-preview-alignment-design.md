# Landing Preview Alignment Design

## Problem

The desktop hero dashboard preview is positioned from the viewport center with a partial negative translation. At wide desktop sizes, its right edge extends beyond the viewport and hides part of the channel and product panels.

## Goal

Keep the complete dashboard preview visible inside the desktop viewport. Preserve the current layered hero composition, text position, preview scale, and mobile behavior.

## Design

- Replace center-based positioning with a right-side anchor.
- Give the preview a responsive width capped at its current 1180px desktop width.
- Reserve a consistent 24px to 32px right-side safety margin.
- Keep the existing large preview hidden below the desktop breakpoint.
- Do not change the reusable dashboard preview component or the standalone preview section.

## Responsive Rules

- At desktop widths, the preview width must never exceed the available viewport width after horizontal safety margins.
- At wide desktop widths, the preview keeps its 1180px maximum width.
- At mobile and tablet widths where the hero preview is hidden, the current text-first layout remains unchanged.

## Verification

- Verify the preview bounding box remains inside the viewport at 1024px, 1440px, and 1920px widths.
- Confirm there is no horizontal document overflow.
- Confirm the 375px mobile layout remains unchanged and has no horizontal overflow.
- Run client tests, typecheck, lint, and production builds.
