# Ask TillTally workspace design

## Goal

Give an authenticated retailer a fast, reviewable path from a plain-language question to a safe
analytics plan and result without presenting model output as an unquestionable answer.

## Information architecture

- Add `Analytics` as a first-class route directly after Dashboard in the desktop navigation.
- Make Analytics a primary mobile destination; move Imports into More so the bottom navigation
  remains a stable five-item row.
- Use a dedicated workspace instead of a modal. Desktop uses a prompt column and a wider plan/result
  column. At 375px the same content becomes a single document flow above the fixed navigation.

## Interaction

- The prompt composer provides four useful retail examples, a 3-500 character question field, a
  clear submit action, and cancellation while planning.
- Planning returns one of three reviewable states: ready, clarification, or unsupported. Network or
  service failures keep the prompt and offer retry.
- A ready plan identifies whether it was built locally or AI-assisted. Users can edit metrics,
  grouping, date range, timezone, chart type, and row limit using standard controls.
- `Run analysis` first sends the edited plan through the strict preview endpoint, then executes it.
  Validation errors stay beside the plan; successful results appear as a bounded, horizontally
  scrollable data table.
- Changing the active business aborts pending work and clears the entire workspace so questions and
  results cannot cross business boundaries.

## Visual direction

The workspace follows TillTally's quiet operational UI. The prompt area is a compact dark command
surface that creates a strong first focal point without decorative gradients. The plan inspector is
white, dense, and explicit, with blue reserved for current selection and primary action. Cards are
used only for the command surface, plan inspector, and result tool; there are no nested cards.

## Accessibility and resilience

- Every control has a visible label, focus ring, disabled state, and at least a 44px touch target on
  mobile.
- Status changes use polite live regions; errors use alert semantics.
- The textarea remains visible when the mobile keyboard is open and no action bar is fixed over it.
- No UI accepts or displays SQL, JavaScript, provider URLs, model names, or credentials.
- Unit, component-render, and Playwright tests cover successful review/execution, clarification,
  validation, provider/network failure, business switching, cancellation, and 375px overflow.
