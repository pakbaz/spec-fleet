# Enterprise Agents System (EAS)

> Autonomous Application Lifecycle Management for the enterprise — built on
> [GitHub Copilot SDK](https://github.com/github/copilot-sdk) and the GitHub
> Copilot CLI's fleet/subagent primitives.

EAS lets a platform team encode corporate engineering standards once
(`.eas/instruction.md`) and have every greenfield, brownfield, and modernization
project executed by a hierarchy of role agents (Architect, Dev, Test, DevSecOps,
Compliance, SRE) → subagents → sub-subagents — each in **its own SDK session**
with an enforced **<100K token context budget**.

## Why

Coding agents like Copilot have a hard context ceiling (~128K tokens). Real
enterprise work — onboarding a 200K-LoC service, modernizing a Java monolith,
greenfielding a microservice that must satisfy SOC2 + HIPAA — does not fit. EAS
solves this by:

1. **Decomposition.** A Main Orchestrator turns a goal into small briefs.
2. **Isolation.** Each brief runs in a fresh subagent session, so one's context
   never pollutes another's.
3. **Charters.** Every agent has a versioned, reviewable markdown contract
   (`*.charter.md`) declaring its tools, MCP scopes, token cap, and prompt body.
4. **Enforcement.** The `eas` runtime is the *only* path to the SDK; it gates
   permissions, redacts secrets, blocks immutable files, and emits an audit log.
5. **Reviewability.** Everything that matters lives in `.eas/` and is reviewed
   via PR — no opaque runtime state.

## Quick start

```bash
# 1. Install (until published to npm)
git clone https://github.com/<your-org>/enterprise-agents-system.git
cd enterprise-agents-system && npm install && npm run build && npm link

# 2. Bootstrap a project
mkdir ~/code/todo-api && cd ~/code/todo-api && git init
eas init --non-interactive

# 3. Customize corporate standards (immutable at runtime)
$EDITOR .eas/instruction.md

# 4. Plan → Implement → Review
eas plan "Build a TODO REST API in Express with Vitest tests"
eas implement --all
eas review
```

For brownfield projects, replace step 2/4 with `eas onboard` then `eas plan`.

**See [`docs/quickstart.md`](docs/quickstart.md) for the full 10-step guide**
(prerequisites, customization, CI integration, troubleshooting).

## Repo layout

```
src/                  TypeScript source
  cli.ts              commander entrypoint
  commands/           one file per `eas <cmd>`
  runtime/            EasRuntime, EasSession, charter loader, audit log
  schema/             Zod schemas for all .eas/ artifacts
  util/               paths, tokens, secrets
templates/            seeded into .eas/ on `eas init`
  charters/           one .charter.md per agent (root + 6 roles + subagents)
  policies/           secrets.json, etc.
  mcp/                scoped MCP server manifests
  skills/             lazy-loaded markdown procedures
tests/                vitest unit + e2e
```

## `eas` commands

| Command | What it does |
|---|---|
| `eas init` | Bootstrap `.eas/` (greenfield) + guided interview |
| `eas onboard` | Brownfield: detect stack, draft `project.md` |
| `eas plan "<goal>"` | Orchestrator decomposes into role-agent tasks |
| `eas implement [--task <id>] [--all]` | Execute next ready task (or all) |
| `eas review` | Compliance + Architect re-review of git diff |
| `eas status` | Charters, plans, audit summary |
| `eas audit [--tail]` | Stream audit events |
| `eas charter new \| list \| validate` | Manage charters |
| `eas doctor` | Validate `.eas/` integrity |

## Architecture

See [`docs/architecture.md`](docs/architecture.md) and the ADRs under
[`docs/adr/`](docs/adr/).

## Security model

- **`.eas/instruction.md` is immutable.** Writes are blocked at the SDK
  permission gate; PRs that touch it require a CODEOWNERS approval (see
  `templates/CODEOWNERS.example`).
- **Tool allowlists per charter.** A charter without `shell` cannot run
  commands; a charter without `write` cannot mutate the repo.
- **Scoped MCP servers per charter.** Each charter lists only the MCP servers it
  may use; manifests live in `.eas/mcp/`.
- **Secret redaction.** Output crossing a session boundary is scanned with
  built-in + custom patterns (`.eas/policies/secrets.json`) and replaced with
  `[REDACTED:<rule>]`.
- **Token budget.** Charters declare `maxContextTokens` (default 80K, hard cap
  95K). The runtime refuses to issue a prompt that would exceed the cap.
- **Audit log.** Every session start/end, prompt, tool use, permission request,
  and policy block is appended to `.eas/audit/<sessionId>.jsonl`.

## Sample: Acme Retail e-commerce app

A complete, runnable demonstration of EAS governing a full-stack greenfield app lives in
[`sample/ecommerce-app/`](sample/ecommerce-app/). It includes:

- **.NET 10 BFF API + React/Vite SPA** with Cosmos DB, Entra External ID, and stubbed payments
- **30+ EAS charters** (orchestrator, role agents, role subagents, compliance subagents)
- **Bicep IaC + `azd` template** (Container Apps + Static Web Apps + Cosmos + Key Vault)
- **GitHub Actions** CI/CD with 90 % coverage gate, CodeQL, and `eas review --strict`
- **4 walkthroughs**:
  [admin setup](sample/ecommerce-app/docs/walkthrough-01-admin-setup.md) ·
  [backend dev story](sample/ecommerce-app/docs/walkthrough-02-developer-backend.md) ·
  [frontend dev story](sample/ecommerce-app/docs/walkthrough-03-developer-frontend.md) ·
  [DevOps deploy](sample/ecommerce-app/docs/walkthrough-04-devops-deployment.md)
- **Compliance docs**:
  [PCI scope boundary](sample/ecommerce-app/docs/pci-scope-boundary.md) ·
  [GDPR data flows](sample/ecommerce-app/docs/gdpr-data-flows.md) ·
  [Zero Trust controls](sample/ecommerce-app/docs/zero-trust-controls.md)

```bash
cd sample/ecommerce-app
dotnet test backend/Acme.Retail.sln          # 21+ tests passing
azd up                                       # deploy to Azure
```

See [`sample/ecommerce-app/README.md`](sample/ecommerce-app/README.md) for the full tour.

## License

MIT
