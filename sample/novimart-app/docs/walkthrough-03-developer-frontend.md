# Walkthrough 03 — Frontend Developer: Cart Drawer with Optimistic Updates

> **Audience:** A React/TypeScript engineer joining the NoviMart team and picking up their
> first frontend story under the SpecFleet.
>
> **Story:** Build the customer-facing cart drawer (Story 2). The drawer must:
>
> - Open from the navbar `CartIcon` and trap focus while open.
> - Render line items, quantity steppers, totals, and a "checkout" CTA.
> - Support **optimistic** add/remove/update operations against `/api/v1/customers/{id}/cart` with
>   automatic rollback on server error.
> - Persist the cart locally (anonymous) until the user signs in, then merge into the
>   server-side cart.
> - Be fully accessible (keyboard, screen reader) and have ≥ 90% line coverage on the changed
>   files.
>
> **What you will learn:** how the **frontend** and **test** subagents collaborate, what an SpecFleet
> "review" feels like, and the four real bugs the test subagent caught before code review.

---

## Table of contents

1. [Prerequisites](#1-prerequisites)
2. [Pick up the story](#2-pick-up-the-story)
3. [Step 1 — `specfleet plan`](#step-1--specfleet-plan-implement-cart-drawer-story-2)
4. [Step 2 — Review the plan (human gate)](#step-2--review-the-plan-human-gate)
5. [Step 3 — `specfleet run --task=feature-cart-api-client`](#step-3--feature-cart-api-client)
6. [Step 4 — `specfleet run --task=feature-cart-persistence`](#step-4--feature-cart-persistence)
7. [Step 5 — `specfleet run --task=feature-cart-drawer-ui`](#step-5--feature-cart-drawer-ui)
8. [Step 6 — `specfleet run --task=tests-cart-drawer`](#step-6--tests-cart-drawer)
9. [Step 7 — `specfleet review`](#step-7--specfleet-review)
10. [Step 8 — Run the app](#step-8--run-the-app)
11. [Real bugs caught by the test subagent](#real-bugs-caught-by-the-test-subagent)
12. [Token budget retrospective](#12-token-budget-retrospective)

---

## 1. Prerequisites

```bash
# Node 20+
node --version  # v20.x or later
# pnpm or npm
npm --version

# Repo setup
cd sample/novimart-app/frontend
npm install
npm run dev          # http://localhost:5173
```

In a second terminal, run the backend so the cart API is reachable:

```bash
cd sample/novimart-app/backend
ASPNETCORE_ENVIRONMENT=Development dotnet run --project src/NoviMart.Api
```

Verify SpecFleet is healthy:

```bash
specfleet check
# ✓ .specfleet/instruction.md present (sha 4e7a…b1)
# ✓ All charters validate
# ✓ Frontend subagent token budget: 78,000 / 95,000 (within cap)
# ✓ Test subagent MCP allowlist: msw, vitest-runner, playwright-runner
```

---

## 2. Pick up the story

The story is in `.specfleet/plans/story-2-cart.md` (committed by the architect agent). Highlights:

```markdown
# Story 2 — Cart Drawer with Optimistic Updates

**Acceptance criteria**
- [ ] CartIcon shows live line-item count, updates within 50 ms of any mutation.
- [ ] Drawer opens via icon click OR keyboard (Enter / Space) and traps focus inside.
- [ ] Add/remove/update mutations are optimistic; on server error the UI rolls back AND
      surfaces a toast.
- [ ] Anonymous cart persists in localStorage; on sign-in it is merged with the server cart
      (server wins on quantity conflicts; deduplicated by productId).
- [ ] Closing the drawer with `Esc` or the close button restores focus to `CartIcon`.
- [ ] ≥ 90 % line coverage on `src/features/cart/**`.
- [ ] Lighthouse a11y score ≥ 95 for the drawer panel.
```

---

## Step 1 — `specfleet plan "implement cart drawer (story 2)"`

```bash
specfleet plan "implement cart drawer (story 2)"
```

Excerpt of orchestrator output (full transcript: `.specfleet/audit/2024-04-27_plan_story-2.jsonl`):

```text
[orchestrator] loaded charters: dev, test, frontend (subagent), unit (subagent)
[orchestrator] context budget after load: 12,400 / 95,000 tokens
[orchestrator] decomposing goal into role tasks...
  → dev (frontend subagent):
      • feature-cart-api-client      (≤ 14k tokens)
      • feature-cart-persistence     (≤ 12k tokens)
      • feature-cart-drawer-ui       (≤ 22k tokens)
  → test (unit subagent):
      • tests-cart-drawer            (≤ 18k tokens)
      • tests-cart-persistence       (≤  9k tokens)
  → compliance (gdpr subagent):
      • verify-no-pii-in-localstorage (read-only audit, ≤ 6k tokens)
[orchestrator] writing .specfleet/plans/story-2.plan.md
[orchestrator] paused at gate: plan_approved (awaits human approval)
```

The plan file is committed so the team can review on the PR before any code is generated.

---

## Step 2 — Review the plan (human gate)

Open `.specfleet/plans/story-2.plan.md`, read the dependency DAG, and approve:

```bash
specfleet run --all
```

The orchestrator records the approval in the audit log and resumes:

```jsonl
{"ts":"…","event":"gate_resumed","gate":"plan_approved","actor":"alice@novimart.example",
 "comment":"lgtm, please proceed in order","sessionId":"…"}
```

---

## Step 3 — `feature-cart-api-client`

```bash
specfleet run --task=feature-cart-api-client
```

The frontend subagent receives a brief that contains:

- `.specfleet/charters/dev.charter.md` and `subagents/dev/frontend.charter.md`
- The NoviMart house style: `src/features/<area>/api.ts` co-located, **Zod** schemas in `schemas.ts`
- Read-only access to `backend/src/NoviMart.Contracts/Cart*.cs` to mirror DTO shapes
- A token budget reservation of **14,000** tokens

Files written:

```text
sample/novimart-app/frontend/src/features/cart/schemas.ts
sample/novimart-app/frontend/src/features/cart/api.ts
```

Excerpts:

```ts
// schemas.ts
import { z } from 'zod'

export const cartItem = z.object({
  itemId: z.string().uuid(),
  productId: z.string().uuid(),
  productName: z.string(),
  unitPrice: z.object({ amount: z.number(), currency: z.string().length(3) }),
  quantity: z.number().int().min(1).max(999),
})
export type CartItem = z.infer<typeof cartItem>

export const cart = z.object({
  customerId: z.string().uuid(),
  items: z.array(cartItem),
  subtotal: z.object({ amount: z.number(), currency: z.string().length(3) }),
})
export type Cart = z.infer<typeof cart>
```

```ts
// api.ts (excerpt)
export async function addItem(customerId: string, productId: string, quantity = 1) {
  const r = await fetch(`/api/v1/customers/${customerId}/cart/items`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ productId, quantity }),
  })
  if (!r.ok) throw new CartApiError(r.status, await r.text())
  return cart.parse(await r.json())
}
```

The `onPostToolUse` hook ran `specfleet config validate` and the secret
scanner cleared the diff (no API keys, no PII).

---

## Step 4 — `feature-cart-persistence`

```bash
specfleet run --task=feature-cart-persistence
```

The subagent writes `useCartPersistence.ts` — a small hook that:

- Reads/writes the cart to `localStorage` under key `novimart.cart.v1` with a JSON `version` field.
- **Strips any field not present in the Zod schema** before persisting (defence-in-depth against
  PII leakage; satisfies the `gdpr` subagent's audit).
- Subscribes to `auth.signedIn` and triggers `mergeCart(local, server)` once.

Selected diff:

```ts
function sanitiseForStorage(c: Cart): PersistedCart {
  // Only store fields needed to rehydrate UI; never store payment info or PII.
  return {
    version: 1,
    items: c.items.map((i) => ({
      itemId: i.itemId,
      productId: i.productId,
      quantity: i.quantity,
    })),
  }
}
```

The compliance/gdpr subagent (read-only) reviewed the diff and emitted:

```text
[compliance.gdpr] PASS — no PII written to localStorage.
                    persisted shape: { version, items[].{itemId, productId, quantity} }
                    blocked fields:  productName, unitPrice, customerId
```

---

## Step 5 — `feature-cart-drawer-ui`

```bash
specfleet run --task=feature-cart-drawer-ui
```

This is the largest task in the plan (22 k token reservation). The subagent writes:

```text
src/features/cart/CartDrawer.tsx
src/features/cart/CartLineItem.tsx
src/features/cart/CartSummary.tsx
src/features/cart/CartIcon.tsx
```

Highlights from the generated `CartDrawer.tsx`:

- Uses the house `Drawer` primitive (`src/ui/Drawer.tsx`) which already implements focus trap +
  `Esc`-to-close. The subagent loaded `src/ui/Drawer.tsx` into context (4 KB) instead of
  reinventing focus management.
- Wraps mutations in TanStack Query's `useMutation` with `onMutate` / `onError` /
  `onSettled` hooks for **optimistic updates with rollback**:

```tsx
const removeMutation = useMutation({
  mutationFn: (itemId: string) => api.removeItem(customerId, itemId),
  onMutate: async (itemId) => {
    await qc.cancelQueries({ queryKey: ['cart', customerId] })
    const prev = qc.getQueryData<Cart>(['cart', customerId])
    qc.setQueryData<Cart>(['cart', customerId], (c) =>
      c ? { ...c, items: c.items.filter((i) => i.itemId !== itemId) } : c,
    )
    return { prev }
  },
  onError: (err, _id, ctx) => {
    if (ctx?.prev) qc.setQueryData(['cart', customerId], ctx.prev)
    toast.error('Could not remove item — please try again.')
  },
  onSettled: () => qc.invalidateQueries({ queryKey: ['cart', customerId] }),
})
```

The subagent **declined** to add a `useEffect` that re-fetched the cart on every render (a
common LLM antipattern); the dev charter explicitly forbids that pattern, and the subagent
cited the rule in its commit message.

---

## Step 6 — `tests-cart-drawer`

```bash
specfleet run --task=tests-cart-drawer
```

The unit/test subagent receives:

- The newly-written cart files (read-only)
- `vitest`, `@testing-library/react`, `msw` (mocked transport)
- A 90% coverage requirement and an explicit "use `findBy*` not `getBy*` after mutations" rule

Files written:

```text
src/features/cart/__tests__/CartDrawer.test.tsx
src/features/cart/__tests__/CartIcon.test.tsx
src/features/cart/__tests__/api.test.tsx
src/features/cart/__tests__/useCartPersistence.test.tsx
```

The first run failed — **on purpose**, four real bugs surfaced (see [§ Real bugs caught](#real-bugs-caught-by-the-test-subagent) below). The test subagent reported each failure
as a structured diagnostic to the orchestrator, which routed them back to the frontend
subagent for repair, then re-ran the tests until green:

```text
[test.unit] vitest: 38/38 passing, coverage 92.4 % (gate: 90 %)
[orchestrator] task tests-cart-drawer: SUCCESS
```

---

## Step 7 — `specfleet review`

```bash
specfleet review
```

Aggregates findings from architect / compliance / sre subagents on the full diff:

```text
[architect.solid]    PASS — no class > 250 lines, no fn > 40 lines.
[architect.scalable] PASS — TanStack Query cache key is properly scoped per customer.
[compliance.gdpr]    PASS — localStorage payload contains zero PII.
[compliance.pci]     PASS — no payment fields touched in this story.
[compliance.zt]      PASS — all fetches go through /api/v1 (BFF), credentials: 'include'.
[sre.observability]  WARN — drawer open/close events are not telemetry-emitted.
                            Suggestion: emit `cart.drawer.opened` /
                            `cart.drawer.closed` via lib/telemetry.
[sre.performance]    PASS — drawer mounts in 11 ms (budget 50 ms).
```

You apply the SRE suggestion in a follow-up commit (one-line change to `CartDrawer.tsx`).

---

## Step 8 — Run the app

```bash
npm run dev               # frontend
# in another terminal
dotnet run --project ../backend/src/NoviMart.Api
```

Click the cart icon, add a product, refresh the page — the cart persists. Sign in — the local
cart is merged into the server cart. Open devtools → Application → Local Storage and confirm
that **only** `novimart.cart.v1` is present and contains no PII.

```bash
npm test -- --coverage --run
# Tests:       77 passed, 77 total
# Coverage:    92.4 % lines (gate 90 %)
```

---

## Real bugs caught by the test subagent

The unit test subagent caught four issues that the frontend subagent's first pass shipped.
Each one is a real-world React/TanStack/RTL pitfall and the patterns below are reusable:

### 1. React Query render-before-data (use `waitFor`, not `expect` immediately after fire)

The first attempt asserted on the post-mutation cart synchronously:

```tsx
await user.click(screen.getByRole('button', { name: /remove/i }))
expect(screen.queryByText('Pro Hammer')).not.toBeInTheDocument()  // ❌ flaky
```

The test ran before TanStack Query's `onSettled` had refetched. Fix:

```tsx
await user.click(screen.getByRole('button', { name: /remove/i }))
await waitFor(() => {
  expect(screen.queryByText('Pro Hammer')).not.toBeInTheDocument()
})
```

### 2. Pointer-events disabled state lacked the inline style RTL queries against

The "checkout" CTA used `aria-disabled` but not `pointer-events: none`. RTL's `userEvent.click`
fires DOM events that bubble through aria-disabled elements — the test passed locally but the
button was actually clickable in production for a brief window. Fix: add the inline style.

```tsx
<button
  aria-disabled={cartIsEmpty}
  style={cartIsEmpty ? { pointerEvents: 'none', opacity: 0.5 } : undefined}
  …
/>
```

### 3. Fake timer leakage between tests caused intermittent failures

`useCartPersistence` debounces writes by 250 ms. Tests using `vi.useFakeTimers()` did not
**restore real timers** in `afterEach`, so a later test waiting on a real `setTimeout` hung
non-deterministically. Fix:

```tsx
afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})
```

### 4. Drawer focus trap restored focus to `document.body` instead of the trigger

The Drawer's `onClose` handler re-enabled scroll but didn't call `triggerRef.current?.focus()`.
RTL's `screen.getByRole('button', { name: /open cart/i })` had **lost** focus, so the next
keystroke (`Tab`) escaped the page tab order. Fix:

```tsx
function handleClose() {
  setOpen(false)
  // Restore focus to the trigger so keyboard users don't lose context.
  setTimeout(() => triggerRef.current?.focus(), 0)
}
```

All four issues now have regression tests in `__tests__/CartDrawer.test.tsx`.

---

## 12. Token budget retrospective

| Subagent             | Reserved | Peak used | Lazy skills loaded |
|----------------------|---------:|----------:|--------------------|
| dev/frontend (api)   |   14,000 |     9,800 | `react-query`, `zod-schemas` |
| dev/frontend (persist)|  12,000 |     7,400 | `localstorage-best-practices` |
| dev/frontend (ui)    |   22,000 |    18,900 | `drawer-a11y`, `tanstack-mutations` |
| test/unit            |   18,000 |    15,200 | `rtl-async`, `msw-handlers` |
| compliance/gdpr      |    6,000 |     3,100 | `gdpr-localstorage` |

No subagent exceeded its reservation. The 100K parent-orchestrator window peaked at **44,800
tokens** (47% utilisation) — the cap fan-out strategy is working as designed.

---

## What's next

- Walkthrough 04 — DevOps deploys this to Azure with `azd up`.
- Story 3 (not in this sample): integrate the stubbed payment provider into the checkout flow,
  honouring the PCI scope boundary documented in `docs/pci-scope-boundary.md`.
