# SpecFleet

[![npm version](https://img.shields.io/npm/v/@pakbaz/specfleet.svg?logo=npm)](https://www.npmjs.com/package/@pakbaz/specfleet)
[![npm downloads](https://img.shields.io/npm/dm/@pakbaz/specfleet.svg)](https://www.npmjs.com/package/@pakbaz/specfleet)
[![CI](https://github.com/pakbaz/spec-fleet/actions/workflows/ci.yml/badge.svg)](https://github.com/pakbaz/spec-fleet/actions/workflows/ci.yml)
[![Release](https://github.com/pakbaz/spec-fleet/actions/workflows/release.yml/badge.svg)](https://github.com/pakbaz/spec-fleet/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/node/v/@pakbaz/specfleet.svg)](package.json)
[![Provenance](https://img.shields.io/badge/npm-provenance-success?logo=npm)](https://docs.npmjs.com/generating-provenance-statements)

> Spec-driven agent orchestration for enterprise software delivery — a
> SpecKit-vNext style CLI built on [GitHub Copilot SDK](https://github.com/github/copilot-sdk)
> and the GitHub Copilot CLI's fleet/subagent primitives.

SpecFleet lets a platform team encode corporate engineering standards once
(`.specfleet/instruction.md`) and have every greenfield, brownfield, and modernization
project executed by a hierarchy of role agents (Architect, Dev, Test, DevSecOps,
Compliance, SRE) → subagents → sub-subagents — each in **its own SDK session**
with an enforced **<100K token context budget**.

> Current release: **v<!-- x-version -->0.5.1<!-- /x-version -->** —
> `npm install -g @pakbaz/specfleet`

## What's new in v0.5

v0.5 hardens the toolchain and supply chain on top of the v0.4 SpecFleet
rebrand. v0.5.1 is a docs patch — see below.

- **Stricter TypeScript.** `noUncheckedIndexedAccess` is on across `src/`.
  Every array/index access is null-guarded, eliminating an entire class of
  "undefined is not a function" runtime bugs.
- **Supply-chain hygiene.** `.github/dependabot.yml` keeps GitHub Actions and
  npm dependencies current on a weekly cadence with grouped PRs. CI cancels
  obsolete runs via `concurrency.cancel-in-progress`.
- **Docs stay in sync with `package.json`.** `scripts/sync-docs-version.mjs`
  runs on `npm version <X.Y.Z>` and rewrites version literals in the README,
  quickstart, and any markdown that opts in via
  `<!-- x-version -->X.Y.Z<!-- /x-version -->` markers. CI fails the build if
  docs drift.
- **Security & robustness fixes.** `sync-docs-version.mjs` no longer
  shell-interpolates filenames (uses `execFileSync` with an argv array);
  `SPECFLEET_TOKEN_RATIO` is clamped against 0/negative/`NaN`;
  `precommit-scan` surfaces real `git` failures instead of silently passing;
  `specfleet status` resolves `$HOME` via `os.homedir()` so it works in
  minimal containers and on Windows.
- **v0.5.1 patch.** README's "What's new" section now tracks v0.5 (was still
  describing the v0.4 rebrand). No source changes vs 0.5.0.

See [`CHANGELOG.md`](CHANGELOG.md) for the full diff and
[`docs/cli.md`](docs/cli.md) for the complete command reference.

## Why

Coding agents like Copilot have a hard context ceiling (~128K tokens). Real
enterprise work — onboarding a 200K-LoC service, modernizing a Java monolith,
greenfielding a microservice that must satisfy SOC2 + HIPAA — does not fit. SpecFleet
solves this by:

1. **Decomposition.** A Main Orchestrator turns a goal into small briefs.
2. **Isolation.** Each brief runs in a fresh subagent session, so one's context
   never pollutes another's.
3. **Charters.** Every agent has a versioned, reviewable markdown contract
   (`*.charter.md`) declaring its tools, MCP scopes, token cap, and prompt body.
4. **Enforcement.** The `specfleet` runtime is the *only* path to the SDK; it gates
   permissions, redacts secrets, blocks immutable files, and emits an audit log.
5. **Reviewability.** Everything that matters lives in `.specfleet/` and is reviewed
   via PR — no opaque runtime state.

## Quick start

```bash
# 1. Install — pick one
npm install -g @pakbaz/specfleet      # global install
# or run without installing:
npx @pakbaz/specfleet init --non-interactive  # one-off
# or as a dev dependency in your repo:
npm install --save-dev @pakbaz/specfleet

# 2. Bootstrap a project — `specfleet init` detects state and asks the right thing
mkdir ~/code/todo-api && cd ~/code/todo-api && git init
specfleet init                                 # prompts: greenfield / brownfield / modify
# Or skip the prompt:
specfleet init --mode greenfield --non-interactive

# 3. Customize corporate standards
specfleet config edit orchestrator             # opens .specfleet/instruction.md in $EDITOR
specfleet config list                          # see every wired charter / policy / MCP / skill

# 4. Plan → Run → Review
specfleet plan "Build a TODO REST API in Express with Vitest tests"
specfleet run --all
specfleet review

# 5. Health & history
specfleet check                                # fast: doctor + chain verify
specfleet check --deep                         # also re-verifies every audit chain
specfleet log                                  # tail recent audit events
specfleet log <sessionId>                      # replay one session
```

For full walkthroughs see [`docs/quickstart.md`](docs/quickstart.md) and
[`docs/cli.md`](docs/cli.md).

### Air-gap mode

```bash
SPECFLEET_OFFLINE=1 specfleet plan "Ship a hello-world endpoint"
specfleet check --offline
```

## Repo layout

```
src/                  TypeScript source
  cli.ts              commander entrypoint
  commands/           one file per `specfleet <cmd>`
  runtime/            SpecFleetRuntime, SpecFleetSession, charter loader, audit log
  schema/             Zod schemas for all .specfleet/ artifacts
  util/               paths, tokens, secrets, policies
templates/            seeded into .specfleet/ on `specfleet init`
  charters/           one .charter.md per agent (root + 6 roles + subagents)
  policies/           egress.json, ip-guard.json, secrets.json, trusted-signers.json
  mcp/                scoped MCP server manifests
  skills/             lazy-loaded markdown procedures
  benchmarks/         eval harness fixtures
tests/                vitest unit + e2e (142 tests)
```

## `specfleet` commands

### Lifecycle

| Command | What it does |
|---|---|
| `specfleet init` | Detect repo state → greenfield / brownfield / modify / upgrade. Auto-installs git hook. |
| `specfleet plan "<goal>"` | Orchestrator decomposes goal into role-agent tasks (`--from-spec <id>` to seed from a spec). |
| `specfleet run [--task <id>] [--all]` | Execute next ready task (or all). |
| `specfleet review` | Compliance + Architect re-review of pending changes. |
| `specfleet status` | Active sessions, subagent tasks, gates awaiting approval. |

### Reflection

| Command | What it does |
|---|---|
| `specfleet check` | Health & quality. Default: doctor. `--deep`, `--eval`, `--tune`, `--staged`, `--audit`, `--fix`. |
| `specfleet log [sessionId]` | No arg → tail audit. With sessionId → redacted replay. |
| `specfleet config <show\|list\|edit\|new\|validate\|diff>` | Inspect & edit orchestrator + charters + policies + MCP + skills. |
| `specfleet spec <new\|list>` | Author specs (GSD / Spec-Kit shape); feeds `specfleet plan --from-spec`. |

### Services

| Command | What it does |
|---|---|
| `specfleet mcp serve` | Stdio MCP server exposing decisions, charters, project, audit. |
| `specfleet sre triage` | SARIF + audit → triage report under `.specfleet/triage/<ts>.md`. |

Every command also accepts the global `--offline` flag (equivalent to setting
`SPECFLEET_OFFLINE=1`).

### Migrating from legacy projects

For an existing project with `.eas/`, run:

```bash
specfleet init --mode upgrade
```

That copies legacy state into `.specfleet/` non-destructively. Review the new
directory, then remove `.eas/` when you no longer need the old package line.

## Architecture

See [`docs/architecture.md`](docs/architecture.md) and the ADRs under
[`docs/adr/`](docs/adr/).

## Security model

- **`.specfleet/instruction.md` is immutable.** Writes are blocked at the SDK
  permission gate; PRs that touch it require a CODEOWNERS approval (see
  `templates/CODEOWNERS.example`).
- **Tool allowlists per charter.** A charter without `shell` cannot run
  commands; a charter without `write` cannot mutate the repo.
- **Scoped MCP servers per charter.** Each charter lists only the MCP servers
  it may use; manifests live in `.specfleet/mcp/`.
- **Secret redaction.** Output crossing a session boundary is scanned with
  built-in + custom patterns (`.specfleet/policies/secrets.json`) and replaced with
  `[REDACTED:<rule>]`. `specfleet config show` redacts before printing.
- **Token budget.** Charters declare `maxContextTokens` (default 80K, hard cap
  95K). The runtime refuses to issue a prompt that would exceed the cap.
- **Audit log.** Every session start/end, prompt, tool use, permission request,
  and policy block is appended to `.specfleet/audit/<sessionId>.jsonl`. `specfleet check
  --deep` verifies the hash chain across every session.

Full details in [`docs/security.md`](docs/security.md). SpecFleet is provided
**AS-IS** — see [`SECURITY.md`](SECURITY.md).

## Sample: NoviMart retail commerce app

A complete, runnable demonstration of SpecFleet governing a full-stack greenfield app
lives in [`sample/novimart-app/`](sample/novimart-app/). It includes:

- **.NET 10 BFF API + React/Vite SPA** with Cosmos DB, Entra External ID, and
  stubbed payments
- **30+ SpecFleet charters** (orchestrator, role agents, role subagents, compliance
  subagents)
- **Bicep IaC + `azd` template** (Container Apps + Static Web Apps + Cosmos +
  Key Vault)
- **GitHub Actions** CI/CD with 90% coverage gate, CodeQL, and `specfleet review
  --strict`
- **4 walkthroughs** covering admin setup, backend dev, frontend dev, and
  DevOps deployment.

```bash
cd sample/novimart-app
dotnet test backend/NoviMart.sln          # 21+ tests passing
azd up                                       # deploy to Azure
```

See [`sample/novimart-app/README.md`](sample/novimart-app/README.md) for the
full tour.

## Documentation

- [`docs/quickstart.md`](docs/quickstart.md) — 10-step guide
- [`docs/cli.md`](docs/cli.md) — full command reference
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
