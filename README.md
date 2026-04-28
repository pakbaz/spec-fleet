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

## What's new in v0.3

v0.3 simplifies the CLI surface: **17 visible commands → 10**, plus a single new
`eas config` command for inspecting and editing every piece of agent
configuration.

- **Trim surface**, organized into 5 lifecycle verbs + 4 reflection verbs.
- **`eas init` is now smart** — detects greenfield / brownfield / existing
  `.eas/` and prompts for the right mode. Auto-installs the git pre-commit hook.
- **`eas config`** — single entry point to `show` / `list` / `edit` / `new` /
  `validate` / `diff` orchestrator instructions, charters, policies, MCP
  manifests, and skills. `edit` opens `$EDITOR` and re-validates on close.
- **`eas check`** unifies `doctor`, `audit verify`, `eval`, `tune`, and
  `precommit-scan` behind one health command with flag dispatch.
- **`eas log`** unifies `audit tail` and `replay`.
- **`eas implement` is renamed `eas run`**.
- All v0.2 commands continue to work as **deprecated hidden aliases** with a
  one-line warning. Aliases will be **removed in v0.4** — migrate now.

See [`CHANGELOG.md`](CHANGELOG.md) for the full diff and
[`docs/cli.md`](docs/cli.md) for the complete command reference.

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

# 2. Bootstrap a project — `eas init` detects state and asks the right thing
mkdir ~/code/todo-api && cd ~/code/todo-api && git init
eas init                                 # prompts: greenfield / brownfield / modify
# Or skip the prompt:
eas init --mode greenfield --non-interactive

# 3. Customize corporate standards
eas config edit orchestrator             # opens .eas/instruction.md in $EDITOR
eas config list                          # see every wired charter / policy / MCP / skill

# 4. Plan → Run → Review
eas plan "Build a TODO REST API in Express with Vitest tests"
eas run --all
eas review

# 5. Health & history
eas check                                # fast: doctor + chain verify
eas check --deep                         # also re-verifies every audit chain
eas log                                  # tail recent audit events
eas log <sessionId>                      # replay one session
```

For full walkthroughs see [`docs/quickstart.md`](docs/quickstart.md) and
[`docs/cli.md`](docs/cli.md).

### Air-gap mode

```bash
EAS_OFFLINE=1 eas plan "Ship a hello-world endpoint"
eas check --offline
```

## Repo layout

```
src/                  TypeScript source
  cli.ts              commander entrypoint (10 visible + hidden aliases)
  commands/           one file per `eas <cmd>`
  runtime/            EasRuntime, EasSession, charter loader, audit log
  schema/             Zod schemas for all .eas/ artifacts
  util/               paths, tokens, secrets, deprecation shim
templates/            seeded into .eas/ on `eas init`
  charters/           one .charter.md per agent (root + 6 roles + subagents)
  policies/           egress.json, ip-guard.json, secrets.json, trusted-signers.json
  mcp/                scoped MCP server manifests
  skills/             lazy-loaded markdown procedures
  benchmarks/         eval harness fixtures
tests/                vitest unit + e2e (141 tests)
```

## `eas` commands (v0.3)

### Lifecycle

| Command | What it does |
|---|---|
| `eas init` | Detect repo state → greenfield / brownfield / modify / upgrade. Auto-installs git hook. |
| `eas plan "<goal>"` | Orchestrator decomposes goal into role-agent tasks (`--from-spec <id>` to seed from a spec). |
| `eas run [--task <id>] [--all]` | Execute next ready task (or all). |
| `eas review` | Compliance + Architect re-review of pending changes. |
| `eas status` | Active sessions, subagent tasks, gates awaiting approval. |

### Reflection

| Command | What it does |
|---|---|
| `eas check` | Health & quality. Default: doctor. `--deep`, `--eval`, `--tune`, `--staged`, `--audit`, `--fix`. |
| `eas log [sessionId]` | No arg → tail audit. With sessionId → redacted replay. |
| `eas config <show\|list\|edit\|new\|validate\|diff>` | Inspect & edit orchestrator + charters + policies + MCP + skills. |
| `eas spec <new\|list>` | Author specs (GSD / Spec-Kit shape); feeds `eas plan --from-spec`. |

### Services

| Command | What it does |
|---|---|
| `eas mcp serve` | Stdio MCP server exposing decisions, charters, project, audit. |
| `eas sre triage` | SARIF + audit → triage report under `.eas/triage/<ts>.md`. |

Every command also accepts the global `--offline` flag (equivalent to setting
`EAS_OFFLINE=1`).

### Migrating from v0.2

The v0.2 commands still work but print a deprecation warning. They are
**removed in v0.4**.

| v0.2 | v0.3 |
|---|---|
| `eas onboard` | `eas init --mode brownfield` |
| `eas implement` | `eas run` |
| `eas doctor` | `eas check` |
| `eas audit tail` | `eas log` |
| `eas audit verify` | `eas check --audit` |
| `eas replay <id>` | `eas log <id>` |
| `eas eval` | `eas check --eval` |
| `eas tune` | `eas check --tune` |
| `eas precommit-scan` | `eas check --staged` *(also kept as the internal hook target)* |
| `eas install-hooks` | `eas init --hooks-only` |
| `eas charter new` / `list` / `validate` | `eas config new charter` / `list` / `validate` |

Suppress deprecation warnings (CI / scripts):

```bash
EAS_NO_DEPRECATION_WARN=1 eas implement --all
```

## Architecture

See [`docs/architecture.md`](docs/architecture.md) and the ADRs under
[`docs/adr/`](docs/adr/).

## Security model

- **`.eas/instruction.md` is immutable.** Writes are blocked at the SDK
  permission gate; PRs that touch it require a CODEOWNERS approval (see
  `templates/CODEOWNERS.example`).
- **Tool allowlists per charter.** A charter without `shell` cannot run
  commands; a charter without `write` cannot mutate the repo.
- **Scoped MCP servers per charter.** Each charter lists only the MCP servers
  it may use; manifests live in `.eas/mcp/`.
- **Secret redaction.** Output crossing a session boundary is scanned with
  built-in + custom patterns (`.eas/policies/secrets.json`) and replaced with
  `[REDACTED:<rule>]`. `eas config show` redacts before printing.
- **Token budget.** Charters declare `maxContextTokens` (default 80K, hard cap
  95K). The runtime refuses to issue a prompt that would exceed the cap.
- **Audit log.** Every session start/end, prompt, tool use, permission request,
  and policy block is appended to `.eas/audit/<sessionId>.jsonl`. `eas check
  --deep` verifies the hash chain across every session.

Full details in [`docs/security.md`](docs/security.md). EAS is provided
**AS-IS** — see [`SECURITY.md`](SECURITY.md).

## Sample: Acme Retail e-commerce app

A complete, runnable demonstration of EAS governing a full-stack greenfield app
lives in [`sample/ecommerce-app/`](sample/ecommerce-app/). It includes:

- **.NET 10 BFF API + React/Vite SPA** with Cosmos DB, Entra External ID, and
  stubbed payments
- **30+ EAS charters** (orchestrator, role agents, role subagents, compliance
  subagents)
- **Bicep IaC + `azd` template** (Container Apps + Static Web Apps + Cosmos +
  Key Vault)
- **GitHub Actions** CI/CD with 90% coverage gate, CodeQL, and `eas review
  --strict`
- **4 walkthroughs** covering admin setup, backend dev, frontend dev, and
  DevOps deployment.

```bash
cd sample/ecommerce-app
dotnet test backend/Acme.Retail.sln          # 21+ tests passing
azd up                                       # deploy to Azure
```

See [`sample/ecommerce-app/README.md`](sample/ecommerce-app/README.md) for the
full tour.

## Documentation

- [`docs/quickstart.md`](docs/quickstart.md) — 10-step guide
- [`docs/cli.md`](docs/cli.md) — full v0.3 command reference
- [`docs/architecture.md`](docs/architecture.md) + [ADRs](docs/adr/)
- [`docs/security.md`](docs/security.md) — threat model + hardening
- [`docs/context-strategies.md`](docs/context-strategies.md) — org-instructions
  vs Spaces vs custom agents vs MCP
- [`docs/harness-management.md`](docs/harness-management.md) — eval → tune →
  review loop
- [`docs/compliance/`](docs/compliance/) — SOC 2, ISO 27001, HIPAA, PCI-DSS, GDPR
- [`docs/publishing.md`](docs/publishing.md) — release & npm OIDC publishing flow
- [`SECURITY.md`](SECURITY.md) — AS-IS / no-support statement

## Contributing

PRs welcome. Run `npm install && npm run build && npm test` before submitting.
Releases are cut by tagging `vX.Y.Z` on `main`; the [release
workflow](.github/workflows/release.yml) publishes to npm via the
[OIDC trusted publisher](https://docs.npmjs.com/trusted-publishers) — no
long-lived tokens required.

## License

[MIT](LICENSE) © 2026 Sepehr Pakbaz and contributors.
