# NoviMart — SpecFleet v0.6 sample

A complete, runnable e-commerce app built on .NET 10 + React + Azure,
governed end-to-end by SpecFleet v0.6. Use this as a reference for what a
production codebase governed by the lean Spec-Kit-style pipeline (8 phase
verbs, 7 flat charters, instructions + prompt files mirrored to
`.github/`) looks like in practice.

> **Greenfield mode.** The `.specfleet/project.md` is in `mode: greenfield`.
> See `sample/hermes-telemetry/` for the brownfield equivalent.

---

## Layout

```text
sample/novimart-app/
├── .specfleet/                       # SpecFleet workspace (source of truth)
│   ├── instruction.md                # NoviMart standards (the constitution)
│   ├── project.md                    # Project mode + primary language
│   ├── config.json                   # implement / review model split
│   ├── charters/                     # 7 flat charters (architect, dev, test, …)
│   ├── skills/                       # reusable lazy-loaded procedures
│   ├── mcp/                          # MCP server registrations
│   ├── specs/
│   │   └── checkout-hardening/       # one finished spec, all 8 phases
│   │       ├── spec.md
│   │       ├── clarifications.md
│   │       ├── plan.md
│   │       ├── tasks.md
│   │       ├── analysis.md
│   │       ├── review.md
│   │       └── checklist.md
│   ├── scratchpad/                   # working memory shared across phases
│   └── runs/                         # transcripts of completed pipeline runs
│
├── .github/                          # runtime contract, mirrored from .specfleet/
│   ├── copilot-instructions.md       # what Copilot loads automatically
│   ├── instructions/                 # coding-style / testing / compliance
│   ├── prompts/                      # 8 phase prompt files (.prompt.md)
│   ├── agents/                       # 7 charter agent files (.agent.md)
│   ├── workflows/                    # ci / cd / security pipelines
│   └── CODEOWNERS
│
├── backend/                          # .NET 10 BFF API
├── frontend/                         # React 18 + TypeScript + Vite SPA
├── infra/                            # Bicep modules + azd orchestration
├── docs/                             # architecture + compliance deep-dives
├── azure.yaml                        # azd service map
└── Dockerfile                        # API container build
```

---

## Quick start

### Prerequisites

- **.NET 10.0.200+ SDK** (`dotnet --version`)
- **Node 20+** (`node --version`)
- **Docker Desktop** (only for container build / Cosmos emulator)
- **Azure CLI** + **Azure Developer CLI** (only for cloud deployment)
- **SpecFleet CLI** v0.6 (`npx @pakbaz/specfleet --version`)

### Run locally — no Azure required

```bash
# backend on http://localhost:5000
cd sample/novimart-app/backend
dotnet test
ASPNETCORE_ENVIRONMENT=Development dotnet run --project src/NoviMart.Api

# frontend on http://localhost:5173 (in a new terminal)
cd sample/novimart-app/frontend
npm install
npm test                       # vitest + RTL — 54 tests pass
npm run dev
```

The SPA points at `http://localhost:5000/api/v1` by default. Open
[http://localhost:5173](http://localhost:5173) and browse the seeded catalog.

### Deploy to Azure

```bash
cd sample/novimart-app
azd auth login
azd env new novimart-dev
azd up
```

A typical idle deployment costs $0–$5 / day (Container Apps consumption,
Cosmos serverless, SWA Free). Tear down with `azd down --purge`.

---

## What SpecFleet did here

Walk a single, finished spec end-to-end. Open
[`.specfleet/specs/checkout-hardening/`](.specfleet/specs/checkout-hardening/)
and read the artefacts in this order:

| Phase | Artefact | What it shows |
| --- | --- | --- |
| `specify` | [spec.md](.specfleet/specs/checkout-hardening/spec.md) | 5 testable requirements + scope + risks |
| `clarify` | [clarifications.md](.specfleet/specs/checkout-hardening/clarifications.md) | 3 questions resolved before planning |
| `plan` | [plan.md](.specfleet/specs/checkout-hardening/plan.md) | architecture / data / security / operations / decisions |
| `tasks` | [tasks.md](.specfleet/specs/checkout-hardening/tasks.md) | 6 ordered, independently testable tasks |
| `analyze` | [analysis.md](.specfleet/specs/checkout-hardening/analysis.md) | cross-artefact consistency + constitution check |
| `implement` | [`client.ts`](frontend/src/lib/api/client.ts) + [`CheckoutPage.tsx`](frontend/src/features/checkout/CheckoutPage.tsx) | actual code diff (claude-sonnet-4.5) |
| `review` | [review.md](.specfleet/specs/checkout-hardening/review.md) | cross-model review (gpt-5.1) — anti-bias mechanic per ADR-0005 |
| `checklist` | [checklist.md](.specfleet/specs/checkout-hardening/checklist.md) | every requirement mapped to evidence (file:line) |

A simulated transcript of the run is in
[`.specfleet/runs/checkout-hardening.log.md`](.specfleet/runs/checkout-hardening.log.md).

### The actual fix

When a session expires mid-checkout, the BFF returns 401. Before this spec,
the SPA showed a generic "couldn't start checkout" toast and the customer
lost their cart. After this spec, the api client maps 401 → `auth_required`
and the CheckoutPage renders an amber alert with a **Sign in to continue**
link returning to `/checkout`.

The change is two files (`client.ts` + `CheckoutPage.tsx`) plus one new
unit test. Small fix, but a perfect-sized example for the pipeline.

---

## Try the pipeline yourself

```bash
cd sample/novimart-app
specfleet check                         # validates .specfleet/ schema + .github/ mirror
specfleet specify "wishlist support"    # drafts a new spec
specfleet clarify wishlist-support
specfleet plan wishlist-support
specfleet tasks wishlist-support
specfleet analyze wishlist-support
specfleet implement wishlist-support
specfleet review wishlist-support
specfleet checklist wishlist-support
```

Each command shells out to GitHub Copilot CLI (`copilot -p -`) with the
matching charter loaded; nothing is run in-process.

---

## Standards demonstrated

| Concern | Implementation |
| --- | --- |
| Language / runtime | .NET 10, cross-platform only |
| Test coverage | ≥ 90 % gate enforced in CI |
| Architecture | BFF, SOLID, vertical slices, `Result<T>` over exceptions |
| Auth | Entra External ID (customers, PKCE) + Entra ID (admin) — JWT only |
| Persistence | Cosmos DB NoSQL, RBAC data-plane (no keys) |
| IaC | Bicep modules, `azd` for build/deploy |
| CI/CD | GitHub Actions: build → test → security → `azd deploy` |
| Compliance | GDPR, PCI scope reduction, Zero Trust pillars |
| Observability | OpenTelemetry → App Insights, Serilog with PII redaction |

The SpecFleet `.specfleet/instruction.md` (the "constitution") is the single
source of truth for these. Every charter and skill loads it; CI rejects
spec artefacts that contradict it.

---

## Compliance & architecture deep-dives

- [`architecture.md`](docs/architecture.md) — C4 view + sequence diagrams
- [`pci-scope-boundary.md`](docs/pci-scope-boundary.md) — what is in / out of PCI scope
- [`gdpr-data-flows.md`](docs/gdpr-data-flows.md) — personal-data inventory + DSR endpoints
- [`zero-trust-controls.md`](docs/zero-trust-controls.md) — pillar-by-pillar control mapping

---

## Status

| Area | Status |
| --- | --- |
| `.specfleet/` v0.6 layout (charters, skills, mcp, specs, scratchpad, runs) | ✅ |
| `.github/` mirror (copilot-instructions, prompts, instructions, agents) | ✅ |
| Finished sample spec (`checkout-hardening`, 8 phases) | ✅ |
| Backend builds clean | ✅ 0 warnings, 0 errors |
| Backend unit tests | ✅ 21 tests pass |
| Frontend tests | ✅ 54 tests pass |
| IaC + `azd up` ready | ✅ |
| Cloud deployment | ⏳ run `azd up` against your subscription |

---

## Next steps

1. **Run it locally.** Backend + frontend, click through catalog and cart.
2. **Read the spec end-to-end.** `.specfleet/specs/checkout-hardening/`.
3. **Inspect a charter.** `.specfleet/charters/dev.charter.md` is a good
   starting point.
4. **Author your own spec.** Add a wishlist feature using the commands
   above and watch the eight-phase pipeline produce its artefacts.
