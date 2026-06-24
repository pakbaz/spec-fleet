---
name: accessibility
applies_to: [dev, test, architect]
---

# When to use

Run on any PR that touches UI markup, components, styling, or interaction
logic. Required for WCAG 2.2 AA conformance claims.

# Procedure

1. **Semantics first.**
   - One `<h1>` per view; heading levels not skipped.
   - Landmarks: `<header>`, `<nav>`, `<main>`, `<footer>` present.
   - Lists are `<ul>/<ol>`, not styled `<div>`s.
2. **Keyboard navigation.**
   - Every interactive control reachable with Tab in DOM order.
   - Visible focus ring (do not `outline: none` without replacement).
   - Escape closes dialogs; Enter/Space activate buttons; arrow keys navigate
     composite widgets (menus, tabs, listbox).
   - No keyboard traps.
3. **ARIA hygiene.**
   - Prefer native elements over `role=`. Don't put `role=button` on a `<div>`
     if a `<button>` works.
   - `aria-label` only when visible text is absent or insufficient.
   - `aria-live` regions for async status changes (form errors, toasts).
   - Modals: `role=dialog`, `aria-modal=true`, focus trap, focus restored on
     close.
4. **Forms.**
   - Every input has a programmatically associated `<label>`.
   - Error messages referenced via `aria-describedby`; not colour-only.
   - Required state via `aria-required` AND a visible indicator.
5. **Contrast & motion.**
   - Text contrast ≥ 4.5:1 (3:1 for large text and UI components per WCAG 2.2
     1.4.11).
   - Respect `prefers-reduced-motion`; no autoplay > 5s without controls.
6. **Tooling.** Run axe-core or Lighthouse a11y; capture violations count.

# Outputs

- An `accessibility-review.md` block listing: WCAG SC reference, element,
  evidence, severity, fix.
- A note on whether any AAA criteria were attempted (optional, but call out
  when claimed).
