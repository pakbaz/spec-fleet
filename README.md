# Enterprise Agents System (EAS)

[![npm version](https://img.shields.io/npm/v/@pakbaz/eas.svg?logo=npm)](https://www.npmjs.com/package/@pakbaz/eas)
[![npm downloads](https://img.shields.io/npm/dm/@pakbaz/eas.svg)](https://www.npmjs.com/package/@pakbaz/eas)
[![CI](https://github.com/pakbaz/enteprise-agents-system/actions/workflows/ci.yml/badge.svg)](https://github.com/pakbaz/enteprise-agents-system/actions/workflows/ci.yml)
[![Release](https://github.com/pakbaz/enteprise-agents-system/actions/workflows/release.yml/badge.svg)](https://github.com/pakbaz/enteprise-agents-system/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/node/v/@pakbaz/eas.svg)](package.json)
[![Provenance](https://img.shields.io/badge/npm-provenance-success?logo=npm)](https://docs.npmjs.com/generating-provenance-statements)

> Autonomous Application Lifecycle Management for the enterprise — built on
> [GitHub Copilot SDK](https://github.com/github/copilot-sdk) and the GitHub
> Copilot CLI's fleet/subagent primitives.

EAS lets a platform team encode corporate engineering standards once
(`.eas/instruction.md`) and have every greenfield, brownfield, and modernization
project executed by a hierarchy of role agents (Architect, Dev, Test, DevSecOps,
Compliance, SRE) → subagents → sub-subagents — each in **its own SDK session**
with an enforced **<100K token context budget**.

## What's new in v0.2

- **Enterprise hardening.** Hash-chained audit log (`eas audit verify`),
  outbound egress allowlist, IP-leak guard, fail-closed secret redaction
  on every tool I/O, optional pre-commit secret scan
  (`eas install-hooks`), no-telemetry CI gate, SBOM + npm provenance.
- **Org-memory MCP server.** `eas mcp serve` exposes `decisions.md`,
  charters, project notes, and the audit log over stdio MCP for any
  consumer (Copilot CLI, VS Code, Claude Desktop).
- **Self-improving harness.** `eas eval` runs benchmark suites and
  appends to `.eas/eval/scoreboard.jsonl`; `eas tune` drafts advisory
  charter diffs from regressions. See
  [`docs/harness-management.md`](docs/harness-management.md).
- **Spec flow.** `eas spec new` / `eas spec list` / `eas plan
  --from-spec` aligned to GSD/SpecKit shape — closing the loop from
  product intent to dispatched plan.
- **SRE triage.** `eas sre triage` consumes SARIF + audit logs and
  produces a triage report under `.eas/triage/<ts>.md`.
- **Compliance packs.** `eas init --with-pack <soc2|iso27001|hipaa|pci-dss|gdpr>`
  bootstraps a `.eas/` with framework-aligned policy hooks.
- **Air-gap mode.** `EAS_OFFLINE=1` (or `--offline`) hard-disables any
  tool requiring network and verifies the air-gap from `eas doctor`.
- **Charter signing schema.** Optional `signature` frontmatter +
  `policies/trusted-signers.json` (verifier ships in v0.2; required-
  signature enforcement lands in v0.3).

See [`CHANGELOG.md`](CHANGELOG.md) for the full list and
[`docs/security.md`](docs/security.md) for the threat model.

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
# 1. Install — pick one
npm install -g @pakbaz/eas              # global install
# or run without installing:
npx @pakbaz/eas init --non-interactive  # one-off
# or as a dev dependency in your repo:
npm install --save-dev @pakbaz/eas

# 2. Bootstrap a project (optionally with a compliance pack)
mkdir ~/code/todo-api && cd ~/code/todo-api && git init
eas init --non-interactive
# or, with a compliance pack:
# eas init --non-interactive --with-pack soc2

# 3. Customize corporate standards (immutable at runtime)
$EDITOR .eas/instruction.md

# 4. Plan → Implement → Review
eas plan "Build a TODO REST API in Express with Vitest tests"
eas implement --all
eas review
```

For brownfield projects, replace step 2/4 with `eas onboard` then `eas plan`.

### Air-gap mode

Run any command with zero outbound network — the runtime refuses to
start if a charter declares an MCP that requires network and forces the
egress allowlist to empty:

```bash
EAS_OFFLINE=1 eas plan "Ship a hello-world endpoint"
eas doctor --offline
```

**See [`docs/quickstart.md`](docs/quickstart.md) for the full 10-step guide**
(prerequisites, customization, CI integration, troubleshooting).

> **Contributing / running from source?** `git clone` this repo, then `npm install && npm run build && npm link`. Releases are cut by tagging `vX.Y.Z` — see [`docs/publishing.md`](docs/publishing.md).

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
| `eas plan "<goal>"` | Orchestrator decomposes into role-agent tasks (`--from-spec <id>` to seed from a spec) |
| `eas implement [--task <id>] [--all]` | Execute next ready task (or all) |
| `eas review` | Compliance + Architect re-review of git diff |
| `eas status` | Charters, plans, audit summary |
| `eas audit tail` / `eas audit verify` | Stream events; verify hash-chain integrity |
| `eas charter new \| list \| validate` | Manage charters |
| `eas spec new \| list` | Author specs (GSD/SpecKit-shaped); feeds `eas plan --from-spec` |
| `eas mcp serve` | Stdio MCP server exposing decisions, charters, project, audit |
| `eas eval` | Run benchmark suite; append to `.eas/eval/scoreboard.jsonl` |
| `eas tune` | Draft advisory charter diffs from scoreboard + audit + decisions |
| `eas replay <session>` | Reconstruct a past session from its audit log |
| `eas sre triage` | SARIF + audit → triage report under `.eas/triage/<ts>.md` |
| `eas install-hooks` | Install pre-commit hook for secret + IP-guard scan |
| `eas precommit-scan` | Scan the staged diff (used by the hook) |
| `eas doctor` | Validate `.eas/` integrity (honours `--offline`) |

Every command also accepts the global `--offline` flag (equivalent to setting
`EAS_OFFLINE=1`).

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

### v0.2 hardening checklist

Full details in [`docs/security.md`](docs/security.md). Vulnerability
reports: [`SECURITY.md`](SECURITY.md).

- [x] Secret redaction on **all** tool I/O (`onPreToolUse` + `onPostToolUse`)
- [x] IP-guard for proprietary identifiers (`policies/ip-guard.json`)
- [x] Outbound egress allowlist, deny-all default (`policies/egress.json`)
- [x] Hash-chained audit log + `eas audit verify`
- [x] Air-gap mode (`EAS_OFFLINE=1` / `--offline`)
- [x] Pre-commit hook (`eas install-hooks`)
- [x] Charter signature schema (verifier in v0.2; enforcement in v0.3)
- [x] No-telemetry policy + CI grep gate
- [x] SBOM (SPDX) + npm provenance
- [x] Compliance packs (SOC 2, ISO 27001, HIPAA, PCI-DSS, GDPR)
- [x] Path-traversal hardening on `eas charter new`
- [x] Symlink rejection on `eas init --instruction`
- [x] Critical secret-redaction off-by-one fix (CVE-class, v0.1 affected)

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

## Documentation

- [`docs/quickstart.md`](docs/quickstart.md) — 10-step guide
- [`docs/architecture.md`](docs/architecture.md) + [ADRs](docs/adr/)
- [`docs/security.md`](docs/security.md) — threat model + hardening
- [`docs/context-strategies.md`](docs/context-strategies.md) — org-instructions vs Spaces vs custom agents vs MCP
- [`docs/harness-management.md`](docs/harness-management.md) — eval → tune → review loop
- [`docs/compliance/`](docs/compliance/) — one page per pack (SOC 2, ISO 27001, HIPAA, PCI-DSS, GDPR)
- [`docs/publishing.md`](docs/publishing.md) — release & npm OIDC publishing flow
- [`SECURITY.md`](SECURITY.md) — vulnerability reporting

## Contributing

PRs welcome. Run `npm install && npm run build && npm test` before submitting.
Releases are cut by tagging `vX.Y.Z` on `main`; the [release
workflow](.github/workflows/release.yml) publishes to npm via the
[OIDC trusted publisher](https://docs.npmjs.com/trusted-publishers) — no
long-lived tokens required.

## License

[MIT](LICENSE) © 2026 Sepehr Pakbaz and contributors.
