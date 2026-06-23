# SpecFleet — a Spec Kit extension

[![CI](https://github.com/pakbaz/spec-fleet/actions/workflows/ci.yml/badge.svg)](https://github.com/pakbaz/spec-fleet/actions/workflows/ci.yml)
[![Release](https://github.com/pakbaz/spec-fleet/actions/workflows/release.yml/badge.svg)](https://github.com/pakbaz/spec-fleet/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> A **[Spec Kit](https://github.com/github/spec-kit) extension** that adds
> **charters** (committed task contracts), a **shared scratchpad** working memory,
> and a **charter-compliance cross-model review** to the core Spec Kit phases.

SpecFleet does **not** replace or orchestrate the core phases — it *augments* them.
Core Spec Kit gives you `specify · clarify · plan · tasks · analyze · implement ·
checklist`. SpecFleet layers three things on top:

- **Charters** — committed, version-controlled task contracts
  (Goal / Inputs / Output / Constraints) with one owning **role**
  (orchestrator / architect / dev / test / devsecops / compliance / sre).
- **Shared scratchpad** — a four-section working memory (Findings · Decisions ·
  Open Questions · Files Touched) so later phases absorb earlier findings without
  re-running prior work.
- **Charter-compliance review** — a read-only, cross-model gate that grades the
  implementation against its charter and scratchpad.

> Current release: **v<!-- x-version -->0.7.0<!-- /x-version -->**

## How this differs from the `fleet` extension

The community **[Fleet Orchestrator](https://github.com/sharathsatish/spec-kit-fleet)**
(`fleet`) chains the whole lifecycle into a single command with human gates and
parallel subagents. **SpecFleet is intentionally not an orchestrator.** It adds a
charter + scratchpad governance layer you can use phase-by-phase alongside the core
commands. Different id (`specfleet`), different commands, no overlap.

| | `fleet` (Fleet Orchestrator) | `specfleet` (this extension) |
| --- | --- | --- |
| Primary idea | One command runs all phases with gates | Charter + scratchpad layer over individual phases |
| Commands | `speckit.fleet.run`, `speckit.fleet.review` | `speckit.specfleet.charter` / `.scratchpad` / `.review` / `.check` |
| Owns the pipeline? | Yes (drives every phase) | No (you keep running core phases) |
| Distinct artifacts | — | `charter.md`, `scratchpad.md` |

## Install

SpecFleet installs like any other Spec Kit extension:

```bash
# From a GitHub release (recommended)
specify extension add specfleet \
  --from https://github.com/pakbaz/spec-fleet/archive/refs/tags/v0.7.0.zip

# Local development checkout
specify extension add --dev /path/to/spec-fleet

# Verify
specify extension list           # → specfleet (0.7.0) — SpecFleet
```

After installation the four commands register with your AI agent (for example under
`.claude/commands/speckit.specfleet.*.md` or your IDE's prompt list).

## Commands

| Command | What it does | Writes |
| --- | --- | --- |
| `speckit.specfleet.charter [role]` | Author/refresh a task contract for the active feature | `specs/<feature>/charter.md` |
| `speckit.specfleet.scratchpad [section=… author=… content="…"]` | Init/append the four-section shared working memory | `specs/<feature>/scratchpad.md` |
| `speckit.specfleet.review [feature]` | Charter-compliance cross-model review (read-only) | `specs/<feature>/review.md` |
| `speckit.specfleet.check [feature]` | Validate charters + scratchpad integrity (read-only) | — (report) |

### Hooks

SpecFleet wires into the core phases without taking them over — every hook is
**optional** and prompts before running:

| Event | Runs | Purpose |
| --- | --- | --- |
| `before_plan` | `speckit.specfleet.charter` | Capture a task contract before planning |
| `after_tasks` | `speckit.specfleet.scratchpad` | Open shared working memory for the feature |
| `after_implement` | `speckit.specfleet.review` | Charter-compliance cross-model review |

## Typical flow

```text
/speckit.specify   "checkout hardening"
/speckit.specfleet.charter architect      # task contract for the design work
/speckit.plan
/speckit.tasks
/speckit.specfleet.scratchpad             # open the shared working memory
/speckit.implement
/speckit.specfleet.review                 # cross-model charter-compliance gate
/speckit.specfleet.check                  # validate charter + scratchpad
```

## Configuration

Optional, at `.specify/extensions/specfleet/specfleet-config.yml` (copy from
[`specfleet-config.template.yml`](specfleet-config.template.yml)):

```yaml
models:
  default: "claude-sonnet-4.5"   # implementation / charter authoring
  review: "gpt-5.1"              # review runs with a DIFFERENT model on purpose
roles: [orchestrator, architect, dev, test, devsecops, compliance, sre]
scratchpad_sections: [Findings, Decisions, "Open Questions", "Files Touched"]
```

## Repo layout

```text
extension.yml                 Spec Kit extension manifest (id: specfleet)
commands/                     command files (speckit.specfleet.*)
  charter.md  scratchpad.md  review.md  check.md
specfleet-config.template.yml extension config template
.extensionignore              files excluded from the installed copy
templates/                    charter / skill / constitution source material
sample/                       two end-to-end demonstrations
src/                          optional TypeScript engine + scratchpad MCP server
tests/                        vitest unit + e2e (incl. extension manifest validation)
```

> **Note on the TypeScript engine.** `src/` ships an optional local CLI/MCP engine
> that predates the extension packaging. It is not required to use the extension —
> the extension is pure command files + manifest — but it remains available for
> running the scratchpad as an MCP server. See [docs/cli.md](docs/cli.md).

## Documentation

- [docs/extension.md](docs/extension.md) — extension guide & catalog submission
- [docs/quickstart.md](docs/quickstart.md) — 10-minute guide
- [docs/cli.md](docs/cli.md) — optional TypeScript engine / MCP server
- [docs/architecture.md](docs/architecture.md) — design
- [docs/spec-pipeline.md](docs/spec-pipeline.md) — how charters & scratchpad map to phases
- [docs/security.md](docs/security.md) — threat model
- [docs/compliance/](docs/compliance/) — SOC 2 / ISO 27001 / HIPAA / PCI-DSS / GDPR notes
- [SECURITY.md](SECURITY.md) — AS-IS / no-support statement

## Samples

Two end-to-end demonstrations ship under [`sample/`](sample/):

- **[sample/novimart-app/](sample/novimart-app/)** — *greenfield*. .NET 10 BFF API +
  React/Vite SPA. Walks through one finished feature (`checkout-hardening`) with its
  charter, scratchpad, and review artifacts.
- **[sample/hermes-telemetry/](sample/hermes-telemetry/)** — *brownfield*. Stdlib-only
  Go telemetry service; the first feature (`origin-allowlist`) fixes a CORS-equivalence
  bug, with charter + scratchpad + review.

## Contributing

PRs welcome. Run `npm install && npm run build && npm test` before submitting; the
suite includes [`tests/unit/extension.test.ts`](tests/unit/extension.test.ts), which
validates the extension manifest and command files.

## License

[MIT](LICENSE) © 2026 Sepehr Pakbaz and contributors.
