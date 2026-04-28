# Auth — Token Storage Trade-off

The Acme Retail engineering policy (`.eas/instruction.md`) forbids
client-side storage of access tokens in `localStorage` because the policy
considers that a high-XSS-blast-radius pattern. The policy permits two
approved options:

1. **HttpOnly cookies via the BFF** (preferred). The browser performs the
   MSAL flow, hands the resulting token to `/auth/exchange` on the .NET
   API, and the API responds with a cookie session
   (`HttpOnly; Secure; SameSite=Strict`). The SPA never reads the access
   token — it just trusts the cookie on every request.

2. **`sessionStorage` with strict patterns** (acceptable). Tokens live for
   the tab's lifetime only; the SPA must scrub the cache on sign-out.

This sample uses option **(2)** to keep the dev loop simple — the React
app calls `acquireTokenSilent` and attaches `Authorization: Bearer …` on
every `/api/*` request that requires auth. **Production must switch to
option (1).** The .NET API already supports the cookie exchange route;
the work to flip the SPA is in `lib/api/client.ts`.

When you make the switch:

- Remove the `Authorization` header injector in `lib/api/client.ts`.
- Add `withCredentials: true` to the axios instance (already present here).
- Implement `POST /auth/exchange` on first sign-in (after `loginRedirect`
  resolves) to seed the cookie.
- Drop `sessionStorage` from `cacheLocation` in `msalConfig`.

A reviewer/PR template should call out which mode is active.
