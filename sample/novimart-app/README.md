# NoviMart — SpecFleet Sample

> A complete, runnable demonstration of the **SpecFleet** governing a
> production-style full-stack application: a .NET 10 BFF API, a React + TypeScript SPA, Azure
> Cosmos DB persistence, Entra External ID for customers, full IaC via Bicep + `azd`, and a CI/CD
> pipeline. Wrapped end-to-end with SpecFleet charters that enforce GDPR, PCI scope reduction, and
> Zero Trust controls.

---

## What's in this sample?

```
sample/novimart-app/
├── .specfleet/                           # The corporate spec — admin-owned, immutable in CI
│   ├── instruction.md              # NoviMart standards (the "constitution")
│   ├── project.md                  # Project-level scope & NFRs
│   ├── decisions.md                # ADR log (append-only)
│   ├── charters/                   # 30+ agent / subagent role definitions
│   ├── policies/                   # GDPR, PCI, Zero Trust policy text
│   ├── plans/                      # Story plans authored by `specfleet plan`
│   ├── audit/                      # Tool-call audit log (JSONL)
│   ├── checkpoints/                # Compacted session memory
│   └── skills/                     # Lazy-loaded procedures
│
├── backend/                        # .NET 10 BFF API
│   ├── src/NoviMart.Api         # Minimal API host (Program.cs, endpoints)
│   ├── src/NoviMart.Domain      # Entities, value objects, Result<T>, specs
│   ├── src/NoviMart.Infrastructure  # Cosmos repos, Entra auth, payment stub
│   ├── src/NoviMart.Contracts   # Request/response DTOs
│   └── tests/NoviMart.UnitTests # xUnit + FluentAssertions + NSubstitute
│
├── frontend/                       # React 18 + TypeScript + Vite SPA
│   ├── src/app                     # Routing, providers, layout
│   ├── src/features                # catalog | cart | checkout | account
│   ├── src/lib                     # api client, auth (MSAL), telemetry
│   ├── src/ui                      # Design system primitives (Drawer, Button, etc.)
│   └── e2e                         # Playwright smoke tests
│
├── infra/                          # Bicep modules (subscription-scope main.bicep)
│   ├── main.bicep                  # Top-level orchestrator
│   ├── core.bicep                  # Resource-group-scope module
│   └── modules/                    # cosmos | containerapps | swa | keyvault | …
│
├── docs/                           # Walkthroughs + compliance reference
│   ├── architecture.md
│   ├── walkthrough-01-admin-setup.md
│   ├── walkthrough-02-developer-backend.md
│   ├── walkthrough-03-developer-frontend.md
│   ├── walkthrough-04-devops-deployment.md
│   ├── pci-scope-boundary.md
│   ├── gdpr-data-flows.md
│   └── zero-trust-controls.md
│
├── .github/workflows               # ci.yml, cd.yml, security.yml
├── azure.yaml                      # azd service map
└── Dockerfile                      # API container build
```

---

## Quick start

### Prerequisites

- **.NET 10.0.200+ SDK** (`dotnet --version`)
- **Node 20+** (`node --version`)
- **Docker Desktop** (for the API container build & Azure Cosmos emulator if used)
- **Azure CLI** + **Azure Developer CLI** (`azd version`) — only needed for cloud deployment
- **SpecFleet CLI** — install from the repo root: `npm i -g .` (this is the meta-runtime; sample
  works without it but you lose policy enforcement)

### Run locally (no Azure required)

```bash
# 1) Backend — API on http://localhost:5000
cd sample/novimart-app/backend
dotnet test                            # 21+ tests, all passing
ASPNETCORE_ENVIRONMENT=Development dotnet run --project src/NoviMart.Api

# 2) Frontend — SPA on http://localhost:5173 (in a new terminal)
cd sample/novimart-app/frontend
npm install
npm test                               # vitest + RTL
npm run dev
```

By default the SPA points at `http://localhost:5000/api/v1`. Open
[http://localhost:5173](http://localhost:5173) and browse the (seeded) catalog.

### Deploy to Azure

```bash
cd sample/novimart-app
azd auth login
azd env new novimart-dev
azd up
```

Full guide → [docs/walkthrough-04-devops-deployment.md](docs/walkthrough-04-devops-deployment.md).

---

## Read the walkthroughs (in order)

| # | Walkthrough | Audience | Time |
|---|-------------|----------|------|
| 1 | [Admin sets up the SpecFleet spec](docs/walkthrough-01-admin-setup.md) | Platform admin | 30 min |
| 2 | [Backend dev — Story 1: product search](docs/walkthrough-02-developer-backend.md) | .NET dev | 45 min |
| 3 | [Frontend dev — Story 2: cart drawer](docs/walkthrough-03-developer-frontend.md) | React dev | 45 min |
| 4 | [DevOps deploys with `azd up`](docs/walkthrough-04-devops-deployment.md) | DevOps / SRE | 30 min |

Each walkthrough shows the **real SpecFleet CLI commands**, the **simulated agent transcripts** for
the SDK-driven steps, the **gates** that pause for human approval, and the **bugs/issues**
the subagents catch on the first run.

## Compliance & architecture deep-dives

- [`architecture.md`](docs/architecture.md) — C4 view, sequence diagrams, BFF rationale
- [`pci-scope-boundary.md`](docs/pci-scope-boundary.md) — what is in / out of PCI scope and why
- [`gdpr-data-flows.md`](docs/gdpr-data-flows.md) — personal-data inventory, DSR endpoints, breach playbook
- [`zero-trust-controls.md`](docs/zero-trust-controls.md) — pillar-by-pillar control mapping

---

## Standards demonstrated

| Concern | Implementation |
|---------|----------------|
| Language / runtime | .NET 10, cross-platform only (no Windows-specific APIs) |
| Test coverage | ≥ 90 % gate enforced in CI; current backend coverage: see `dotnet test` output |
| Architecture | BFF (one API per SPA), SOLID, vertical slices, `Result<T>` over exceptions |
| Auth | Entra External ID (customers, PKCE) + Entra ID (admin) — JWT only, no cookies |
| Persistence | Cosmos DB NoSQL, partition keys per container, RBAC data-plane (no keys) |
| IaC | Bicep modules, subscription-scope orchestrator, `azd` for build/deploy |
| CI/CD | GitHub Actions: build → test (90 % gate) → security → `azd deploy` |
| Compliance | GDPR, PCI scope reduction (stubbed payment provider), Zero Trust pillars |
| Observability | OpenTelemetry → App Insights, Serilog with PII redaction |

Every one of these is **enforced** by an SpecFleet subagent charter — see `.specfleet/charters/` and the
walkthrough sections that show the subagent firing.

---

## Running the SpecFleet commands against this sample

```bash
cd sample/novimart-app

# Validate the .specfleet/ directory is internally consistent
specfleet check

# Validate every charter parses, has a token cap, and references valid skills/MCP servers
specfleet config validate

# Show the project's current backlog of plans + their gate state
specfleet status

# Read recent audit events
specfleet log --since 1h
```

For `specfleet plan` / `specfleet run` / `specfleet review` — see the relevant walkthrough; those
commands require GitHub Copilot SDK auth and exercise the actual sub-agent runtime.

---

## Costs & cleanup

A typical idle deployment costs $0–$5 / day (Container Apps consumption tier, Cosmos serverless,
SWA Free). To delete everything:

```bash
azd down --purge
```

`--purge` permanently removes the Key Vault and Cosmos account so they don't count against
soft-delete quotas.

---

## Status

| Area | Status |
|------|--------|
| `.specfleet/` — charters, policies, sample instruction & project | ✅ Authored |
| Backend — domain, infrastructure, API host | ✅ Builds clean (0 warnings, 0 errors) |
| Backend — unit tests | ✅ 21 tests passing (ProductSearchSpecification spec) |
| Frontend — features, UI primitives, tests | ✅ Authored (see `frontend/README.md` for run instructions) |
| IaC — Bicep modules + `azure.yaml` | ✅ Authored, `azd up`-ready |
| CI/CD — GitHub Actions | ✅ `.github/workflows/{ci,cd,security}.yml` present |
| Walkthroughs (4) | ✅ Complete |
| Compliance docs (3 + architecture) | ✅ Complete |
| Real `azd up` against your subscription | ⏳ Requires you to run it; guide is in `walkthrough-04` |

---

## Next steps

1. **Try local first.** Run the backend + frontend locally and click through the catalog and
   cart. Read `walkthrough-02` and `walkthrough-03` while you do.
2. **Inspect the charters.** Open `.specfleet/charters/dev.charter.md` and any subagent under
   `.specfleet/charters/subagents/` — these are the heart of the system.
3. **Deploy to Azure.** Follow `walkthrough-04` to run `azd up`. Tear down with `azd down`.
4. **Write your own story.** Add a third user story (e.g., "wishlist") and observe how
   `specfleet plan` decomposes it across the same agent hierarchy.
