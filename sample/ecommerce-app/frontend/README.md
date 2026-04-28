# Acme Retail — Frontend (React + TypeScript + Vite)

The customer-facing SPA for Acme Retail e-commerce. Pairs with the .NET 10
BFF API in `../api`.

## Prerequisites

- Node.js ≥ 20 (CI uses 20 / 22)
- npm 10+

## Quick start

```bash
cp .env.example .env.local      # fill in real Entra IDs for full auth flow
npm install
npm run dev                     # http://localhost:5173 — proxies /api → :5000
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with HMR + API/auth/health proxy |
| `npm run build` | Type-check + production build into `dist/` |
| `npm run preview` | Serve the production build on :4173 (used by Playwright) |
| `npm test` | Vitest run (jsdom + RTL + MSW) |
| `npm run test:watch` | Watch-mode tests |
| `npm run test:cov` | Run tests with v8 coverage; fails build below 90% line / 80% branch |
| `npm run lint` | ESLint with `--max-warnings=0` |
| `npm run format` | Prettier write across `src/` |
| `npm run typecheck` | `tsc --noEmit` strict |
| `npm run e2e` | Playwright (chromium) smoke suite |
| `npm run e2e:install` | Install Playwright browsers |

## Environment variables

Copy `.env.example` to `.env.local`. The frontend never sees a server-side
secret — only `VITE_*` variables are visible to the client.

```
VITE_API_BASE_URL=/api
VITE_AZURE_AUTHORITY=https://acmeretailcustomers.ciamlogin.com/...
VITE_AZURE_CLIENT_ID=00000000-0000-0000-0000-000000000000
VITE_AZURE_API_SCOPE=api://acme-retail-api/access_as_user
VITE_AZURE_REDIRECT_URI=http://localhost:5173
VITE_APPINSIGHTS_CONNECTION_STRING=
```

## Architecture

```
src/
  app/         routing, error boundary, query/auth providers
  features/    catalog, cart, checkout, account
  lib/         api client, MSAL config, telemetry
  ui/          design-system primitives (Button, Drawer, Toast …)
  test/        Vitest setup + MSW server / handlers
e2e/           Playwright smoke
```

All network calls go through `lib/api/client.ts` which:

- Attaches `Authorization: Bearer <token>` from MSAL `acquireTokenSilent`
  for any call that isn't an anonymous catalog endpoint.
- Normalises errors to `{ status, code, message }`.
- Sends `withCredentials: true` so a future BFF cookie pattern flips on
  with no SPA changes (see `src/lib/auth/README.md`).

## Token storage trade-off

This sample stores MSAL tokens in `sessionStorage` and attaches a bearer
header on every call. Production should switch to the BFF cookie pattern
(`HttpOnly; Secure; SameSite=Strict`). The migration steps live in
`src/lib/auth/README.md`.

## Bundle budget

Engineering policy caps the **initial route at 200 KB gzipped**.
`npm run build` prints per-chunk sizes; the `manualChunks` split keeps
React, MSAL and TanStack Query in separately cacheable bundles. The cart
drawer is `React.lazy`-loaded so it never weighs on the first paint.

For a deeper inspection install `vite-bundle-visualizer` and run it
locally — we don't ship the visualiser into CI to keep installs fast.

## Content Security Policy (planning note)

Per `.eas/policies/pci.md`, the SPA must redirect to a tokenising payment
provider; the provider's domain must appear in `connect-src` and
`form-action`. Production CSP (set by the BFF / Static Web App config):

```
default-src 'self';
script-src 'self';
connect-src 'self' https://payments.example.com;
form-action  'self' https://payments.example.com;
img-src 'self' data: https://*.acme-retail.example;
style-src 'self' 'unsafe-inline';
frame-ancestors 'none';
```

## Accessibility

- Drawer: `role=dialog`, `aria-modal`, focus trap, Esc-to-close, restore focus.
- All interactive elements have an accessible name and a visible focus ring.
- `prefers-reduced-motion` disables drawer / spinner animations.
- Colour contrast targets WCAG 2.1 AA (acme-blue on white passes).

## Compliance touchpoints

- **GDPR** — Account → Privacy tab exposes Art. 15/17/20/21 endpoints.
- **PCI-DSS** — Checkout never collects PAN / CVV; the button just redirects.
- **Zero Trust** — Every API call requires authn unless explicitly anonymous;
  policy is enforced server-side and cross-checked client-side.

## Tests

- **Vitest + RTL + MSW** — unit + integration. Coverage gate: 90% line / 80% branch.
- **Playwright (chromium)** — smoke only; `npm run e2e:install` once before first run.
