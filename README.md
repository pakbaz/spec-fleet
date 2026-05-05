# SpecFleet

[![npm version](https://img.shields.io/npm/v/@pakbaz/specfleet.svg?logo=npm)](https://www.npmjs.com/package/@pakbaz/specfleet)
[![npm downloads](https://img.shields.io/npm/dm/@pakbaz/specfleet.svg)](https://www.npmjs.com/package/@pakbaz/specfleet)
[![CI](https://github.com/pakbaz/spec-fleet/actions/workflows/ci.yml/badge.svg)](https://github.com/pakbaz/spec-fleet/actions/workflows/ci.yml)
[![Release](https://github.com/pakbaz/spec-fleet/actions/workflows/release.yml/badge.svg)](https://github.com/pakbaz/spec-fleet/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/node/v/@pakbaz/specfleet.svg)](package.json)
[![Provenance](https://img.shields.io/badge/npm-provenance-success?logo=npm)](https://docs.npmjs.com/generating-provenance-statements)

> A **lean, thin Spec-Kit pipeline** over the [GitHub Copilot CLI](https://github.com/github/copilot)
> with cross-model review and a shared scratchpad MCP.

SpecFleet runs the eight Spec-Kit phases — **specify · clarify · plan · tasks ·
analyze · implement · review · checklist** — by shelling out to `copilot -p -`
with a charter-shaped prompt. Charters are committed task contracts under
`.specfleet/charters/`. Review uses a *different* model than implementation
by default, and the shared scratchpad keeps multi-charter work coordinated.

> Current release: **v<!-- x-version -->0.6.0<!-- /x-version -->** —
> `npm install -g @pakbaz/specfleet`

## What's new in v0.6

v0.6 is a deliberate **simplification** — see [docs/migration-from-0.5.md](docs/migration-from-0.5.md):

- **Thin shim over Copilot CLI** — dropped the `@github/copilot-sdk`
  dependency. One `dispatch()` function. ([ADR-0004](docs/adr/0004-thin-shim.md))
- **Eight-phase Spec-Kit pipeline** — `specify`, `clarify`, `plan`, `tasks`,
  `analyze`, `implement`, `review`, `checklist`. Each phase renders a
  prompt template and writes a single artefact under
  `.specfleet/specs/<id>/`.
- **Cross-model review by default** — implement with `claude-sonnet-4.5`,
  review with `gpt-5.1`. Configurable in `.specfleet/config.json`.
  ([ADR-0005](docs/adr/0005-cross-model-review.md))
- **Shared scratchpad** — four-section working memory per spec, surfaced
  as MCP tools via `specfleet mcp serve`.
- **Charters are pure task contracts** — Goal/Inputs/Output/Constraints,
  no personas. 7 root charters (orchestrator/architect/dev/test/devsecops/
  compliance/sre), no pre-declared subagents.
- **`specfleet init --from-v5`** archives the v0.5 layout and rebuilds.

## Quick start

```bash
# 1. Install
npm install -g @pakbaz/specfleet
specfleet --version          # → 0.6.0

# 2. Initialize a workspace (greenfield/brownfield/upgrade auto-detected)
mkdir ~/code/todo-api && cd ~/code/todo-api && git init
specfleet init --non-interactive

# 3. Customize the constitution
$EDITOR .specfleet/instruction.md
$EDITOR .specfleet/project.md

# 4. Run the eight-phase pipeline
specfleet specify    "todo-api"  --description "REST API with JSON storage"
specfleet clarify    todo-api    --answer "stack: node 20"
specfleet plan       todo-api
specfleet tasks      todo-api
specfleet analyze    todo-api
specfleet implement  todo-api
specfleet review     todo-api    # cross-model gate (gpt-5.1 by default)
specfleet checklist  todo-api

# 5. Sanity checks
specfleet check                  # validate charters / mirror / Copilot CLI / prompts / MCP
specfleet check --staged         # secret scan over `git diff --cached`
```

For the full walkthrough see [docs/quickstart.md](docs/quickstart.md) and
[docs/cli.md](docs/cli.md).

## Repo layout

```text
src/
  cli.ts                       commander entrypoint
  commands/                    one file per `specfleet <cmd>` (12 verbs)
    _phase.ts                  shared 8-phase runner
    {specify,clarify,plan,tasks,analyze,implement,review,checklist}.ts
    {init,check,config,mcp-serve}.ts
  runtime/
    dispatch.ts                spawns `copilot -p -`
    workspace.ts               .specfleet/config.json loader
    charter.ts                 loads + mirrors charters
    scratchpad.ts              4-section shared working memory
  schema/index.ts              Zod schemas (CharterSchema, SpecFrontmatterSchema, RunEventSchema)
  util/                        paths, tokens, secrets
templates/
  charters/                    7 root charters (no personas)
  skills/                      reusable how-tos
  .github/                     prompts/, instructions/, copilot-instructions.md
tests/                         vitest unit + e2e
```

## `specfleet` commands

### Workspace

| Command | What it does |
| --- | --- |
| `specfleet init` | Scaffold `.specfleet/` and `.github/`. Auto-detects greenfield/brownfield/upgrade. |
| `specfleet check` | Validate charters, mirror, Copilot CLI, prompts, MCP. `--staged` scans secrets. `--fix` re-mirrors charters. |
| `specfleet config show\|list\|set` | Read or update `.specfleet/config.json`. |
| `specfleet mcp serve` | Stdio JSON-RPC server exposing scratchpad + charter/constitution/project tools. |

### Pipeline (8 phase verbs)

| Command | Default charter | Writes |
| --- | --- | --- |
| `specfleet specify <id> --description "<text>"` | orchestrator | `spec.md` |
| `specfleet clarify <id> --answer "<text>" …` | orchestrator | `clarifications.md` |
| `specfleet plan <id>` | architect | `plan.md` |
| `specfleet tasks <id>` | orchestrator | `tasks.md` |
| `specfleet analyze <id>` | architect | `analysis.md` |
| `specfleet implement <id> --task <name>` | dev | `.specfleet/scratchpad/<id>.md` |
| `specfleet review <id>` | architect (review model) | `review.md` |
| `specfleet checklist <id>` | compliance | `checklist.md` |

All phase verbs accept `--charter`, `--model`, `--allow-tool` (repeatable),
and `--non-interactive`.

## Architecture

See [docs/architecture.md](docs/architecture.md), [docs/spec-pipeline.md](docs/spec-pipeline.md),
and the ADRs under [docs/adr/](docs/adr/).

## Documentation

- [docs/quickstart.md](docs/quickstart.md) — 10-minute guide
- [docs/cli.md](docs/cli.md) — full command reference
- [docs/architecture.md](docs/architecture.md) — v0.6 thin-shim design
- [docs/spec-pipeline.md](docs/spec-pipeline.md) — eight phases in detail
- [docs/migration-from-0.5.md](docs/migration-from-0.5.md) — v0.5 → v0.6 cutover
- [docs/security.md](docs/security.md) — threat model
- [docs/compliance/](docs/compliance/) — SOC 2 / ISO 27001 / HIPAA / PCI-DSS / GDPR alignment notes
- [docs/publishing.md](docs/publishing.md) — release & npm OIDC publishing flow
- [SECURITY.md](SECURITY.md) — AS-IS / no-support statement

## Sample: NoviMart retail commerce app

A complete demonstration lives in [sample/novimart-app/](sample/novimart-app/) —
.NET 10 BFF API + React/Vite SPA with Cosmos DB, Entra External ID, and
stubbed payments. The sample's `.specfleet/instruction.md` shows what a
fleshed-out corporate constitution looks like.

## Contributing

PRs welcome. Run `npm install && npm run build && npm test` before submitting.
Releases are cut by tagging `vX.Y.Z` on `main`; the [release
workflow](.github/workflows/release.yml) publishes to npm via the
[OIDC trusted publisher](https://docs.npmjs.com/trusted-publishers) — no
long-lived tokens required.

## License

[MIT](LICENSE) © 2026 Sepehr Pakbaz and contributors.
