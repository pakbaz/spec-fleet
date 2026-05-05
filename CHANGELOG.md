# Changelog

<!-- markdownlint-disable MD024 -->

All notable changes to `@pakbaz/specfleet` will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.6.0] — 2026-05-05

SpecFleet v0.6 is a deliberate **simplification**: a thin shim over the
GitHub Copilot CLI that runs the Spec-Kit eight-phase pipeline. The SDK
dependency is gone, the policy DSL is gone, the audit hash chain is
gone, and the hierarchical subagent system is gone. What remains is
sharp and lean. Run `specfleet init --from-v5` to migrate.

### Breaking

- **Dropped `@github/copilot-sdk` (and `ajv`/`ajv-formats`) deps.** All
  dispatch goes through `copilot -p -` via `spawn`. See
  [ADR-0004](docs/adr/0004-thin-shim.md).
- **Charter shape** — removed `displayName`, `role`, `tier`, `parent`,
  `spawns`, `signature`. Only `name` (kebab-case, no slashes),
  `description`, `body` are required. Body uses Goal/Inputs/Output/
  Constraints headings — **no personas**.
- **Removed CLI verbs**: `audit`, `eval`, `sre`, `tune`, `replay`,
  `log`, `status`, `run`, `onboard`, `install-hooks`, `precommit-scan`,
  `doctor`, `charter`, `spec`. See
  [migration-from-0.5.md](docs/migration-from-0.5.md) for replacements.
- **`plan`** is now a Spec-Kit phase verb (`specfleet plan <spec-id>`),
  not a freeform brief verb. Use `specfleet specify` to start a spec.
- **`review`** is now Phase 7 (cross-model review) — no longer the
  rebase-risk audit from v0.5.
- **Workspace layout** — `.specfleet/{audit,checkpoints,index,plans,
  policies/packs}` are removed. New layout: `.specfleet/specs/<id>/`,
  `.specfleet/scratchpad/`, `.specfleet/runs/`, `.specfleet/config.json`.
- **MCP servers default off**. Per-charter `mcpServers: []` until the
  user opts in (community Spec-Kit guidance).

### Added

- **Eight-phase pipeline**: `specify`, `clarify`, `plan`, `tasks`,
  `analyze`, `implement`, `review`, `checklist`. See
  [docs/spec-pipeline.md](docs/spec-pipeline.md).
- **Cross-model review by default** (`models.default = claude-sonnet-4.5`,
  `models.review = gpt-5.1`). Configurable in `.specfleet/config.json`,
  override per call with `--model` or `SPECFLEET_REVIEW_MODEL`. See
  [ADR-0005](docs/adr/0005-cross-model-review.md).
- **Shared scratchpad** — `.specfleet/scratchpad/<id>.md` with four
  canonical sections (Findings/Decisions/Open Questions/Files Touched),
  surfaced as MCP tools by `specfleet mcp serve`.
- **`specfleet init --from-v5`** — archives the v0.5 layout into
  `.specfleet/_v5-archive/` and re-scaffolds v0.6.
- **`.github/prompts/specfleet.<phase>.prompt.md`** × 8 — phase prompts
  with mustache-lite placeholders, mirrored on `init`.
- **`.github/instructions/{coding-style,testing,compliance}.instructions.md`** —
  three path-scoped instruction files using `applyTo` frontmatter.
- **`.github/copilot-instructions.md`** — repo-wide guidance pointing
  at `.specfleet/` and `.github/`.
- **`SPECFLEET_COPILOT_BINARY`** env var — override the `copilot`
  binary for tests / dev sandboxing.

### Changed

- Default `maxContextTokens` lowered from 80K → **60K** (95K hard
  ceiling unchanged).
- `init` now emits a `.specfleet/project.md` template alongside
  `instruction.md`.
- `check` consolidates `doctor`, `precommit-scan`, and post-init
  validation into one verb (`--staged` for secret scan, `--fix` for
  charter re-mirror).

### Removed

- `@github/copilot-sdk`, `ajv`, `ajv-formats` from dependencies.
- All policy enforcement code (`src/util/policies.ts`, `src/util/sign.ts`,
  `src/runtime/policy.ts`, `src/runtime/audit.ts`,
  `src/runtime/interview.ts`, `src/runtime/session.ts`).

### Samples

- **`sample/novimart-app/`** rewritten for v0.6 — replaced the v0.5
  policy/subagent layout with the eight-phase `.specfleet/specs/`
  layout. One finished spec (`checkout-hardening`) ships with all 7
  phase artefacts plus scratchpad + run transcript, exercising real
  TypeScript code in `frontend/src/lib/api/client.ts` and
  `frontend/src/features/checkout/CheckoutPage.tsx`.
- **`sample/hermes-telemetry/`** added — a stdlib-only Go telemetry
  service used as the brownfield demo. The spec
  `origin-allowlist` walks the eight phases against pre-existing code,
  fixing a CORS-equivalence bug between `localhost` and `127.0.0.1`.

## [0.5.1] — 2026-04-28

### Fixed

- README's "What's new" section advertised v0.4 (the rebrand) even after
  v0.5.0 shipped. Replaced with a v0.5 summary covering
  `noUncheckedIndexedAccess`, Dependabot + CI concurrency, the docs
  auto-sync flow, and the security/robustness fixes from 0.5.0.

### Changed

- README now carries a `<!-- x-version -->` marker for the current release
  line, so future `npm version <X.Y.Z>` bumps keep the badge text honest via
  `scripts/sync-docs-version.mjs`.

### Notes

- No source or runtime changes versus 0.5.0.

## [0.5.0] — 2026-04-28

### Added

- `tsconfig.json` now sets `noUncheckedIndexedAccess: true`. All array/index
  accesses across `src/` are explicitly null-guarded — runtime "undefined is not
  a function" classes of bugs are no longer reachable from index access.
- `.github/dependabot.yml` keeps GitHub Actions and npm dependencies up to date
  on a weekly cadence with grouped PRs. Combined with SHA-pinning (recommended
  for enterprise), this closes the supply-chain gap on workflow actions.
- CI workflow now sets `concurrency.cancel-in-progress: true`, so rapid pushes
  to the same ref cancel obsolete runs instead of racing.

### Changed

- Docs and READMEs are kept in lockstep with `package.json` version.
  `scripts/sync-docs-version.mjs` runs automatically on `npm version <X.Y.Z>`
  (via the `version` lifecycle hook) and stages updated docs into the version
  commit. CI fails the build if docs drift from `package.json`. Add
  `<!-- x-version -->X.Y.Z<!-- /x-version -->` markers in any new doc to opt
  that location into automatic sync — placeholders like `X.Y.Z` in
  documentation are *not* rewritten (the regex requires a SemVer-shaped
  literal).

### Fixed

- `scripts/sync-docs-version.mjs` no longer shell-interpolates filenames into
  `git add`. Switched to `execFileSync` with an argv array, eliminating a
  command-injection risk if a malicious filename ever entered the working tree.
- `scripts/sync-docs-version.mjs` constructs a fresh regex per file so
  `/g.lastIndex` state cannot leak across iterations and skip matches.
- `src/util/tokens.ts` clamps `SPECFLEET_TOKEN_RATIO` against 0, negative, and
  `NaN` inputs. Previously a misconfigured env var produced `Infinity` token
  estimates and confusing budget-exhausted errors.
- `src/commands/precommit-scan.ts` now surfaces real git failures (`spawnSync`
  `error` field) instead of treating them as "no staged changes" and silently
  green-lighting the commit. Missing `git` binary or corrupted `.git` directory
  fails loud.
- `src/commands/status.ts` resolves the home directory via `os.homedir()`
  instead of a bare `process.env.HOME`. Status now works correctly in minimal
  containers where `HOME` is unset, and supports Windows (`USERPROFILE`).

## [0.4.1] — 2026-04-28

### Changed

- Re-publish via OIDC trusted publisher (`pakbaz/spec-fleet` → `release.yml` → `publish` env). 0.4.0 was published manually with a temporary token while the trusted publisher and registry permissions were still being configured; 0.4.1 is the first version published end-to-end through GitHub Actions OIDC with npm provenance.

### Notes

- No source or runtime changes versus 0.4.0.

## [0.4.0] — 2026-04-28

Full SpecFleet rebrand and package transition. This release moves the project
to the new `@pakbaz/specfleet` package and `specfleet` command, positioning it as a
SpecKit-vNext style, spec-first agent orchestration platform.

### Breaking

- Package name is now `@pakbaz/specfleet`.
- CLI binary is now `specfleet`; no `eas` binary is shipped by this package.
- Generated project state now lives under `.specfleet/`.
- Deprecated v0.3 subcommand aliases are removed from the visible runtime
  surface. Use `run`, `check`, `log`, and `config`.

### Added

- Legacy `.eas/` migration path: `specfleet init --mode upgrade` copies old
  state into `.specfleet/` non-destructively and leaves `.eas/` in place for
  review.
- NoviMart sample app replaces the previous sample branding and path.

### Changed

- README, CLI reference, quickstart, specs, security docs, publishing docs,
  templates, and tests now use SpecFleet naming and `.specfleet/` paths.
- GitHub repository metadata points to `pakbaz/spec-fleet`.
- npm OIDC release workflow checks and publishes the `@pakbaz/specfleet` package.
- Pre-commit hook script invokes `specfleet check --staged`.

## [0.3.0] — 2026-04-27

Final release of the prior package line before the SpecFleet rename. It
introduced the simplified 10-command surface, smart init, `config`, `check`,
and `log`.

## [0.2.0] — 2026-04-27

Enterprise hardening + spec-coverage release. Closes the four spec
questions in [`docs/specs.md`](docs/specs.md), ships the org-memory MCP
server, the eval/tune harness, and 13 hardening controls.

### Breaking

- None. v0.2 is additive over v0.1; existing `.specfleet/` directories
  continue to work. New defaults (e.g. empty egress allowlist) only
  apply when the corresponding policy file is added.

### Added

- `specfleet mcp serve` — stdio MCP server exposing `query_decisions`,
  `query_charter`, `query_project`, `query_audit` tools.
- `specfleet check --eval` — run benchmark suites; append to
  `.specfleet/eval/scoreboard.jsonl`. Ships 5 starter benchmarks
  (orchestrator, dev, test, compliance, sre).
- `specfleet check --tune` — advisory charter diffs from scoreboard + audit +
  decisions; written to `.specfleet/tune/<ts>.diff`. Never auto-applies.
- `specfleet log <session>` — read-only reconstruction of a past session
  from its audit log.
- `specfleet spec new <name>` / `specfleet spec list` — GSD/SpecKit-shaped spec
  authoring; `specfleet plan --from-spec <id>` feeds a spec into the plan.
- `specfleet sre triage` — SARIF + audit → triage report under
  `.specfleet/triage/<ts>.md`; new `triage` skill.
- `specfleet init --hooks-only` — install a pre-commit hook running secret +
  IP-guard scans on the staged diff.
- `specfleet check --audit` — walks `.specfleet/audit/*.jsonl`, recomputes the
  hash chain, reports tampering.
- `--offline` flag (and `SPECFLEET_OFFLINE=1` env) — air-gap mode; refuses
  network-bound tools and MCPs.
- `specfleet init --with-pack <name>` — bootstrap with a compliance pack
  (`soc2`, `iso27001`, `hipaa`, `pci-dss`, `gdpr`).
- Charter signature schema: optional `signature` frontmatter and
  `policies/trusted-signers.json` (verifier present; enforcement in
  v0.4).
- 6 production skills under `templates/skills/`: `security-review`,
  `perf-review`, `accessibility`, `observability`, `iac-review`,
  `dependency-hygiene`.
- Benchmarks library under `templates/benchmarks/`.

### Fixed

- **CRITICAL** Secret redaction off-by-one in `src/util/secrets.ts`
  that left most of every matched secret visible. Regression test
  asserts no substring of the input secret remains for every built-in
  pattern.
- **HIGH** Path traversal in `specfleet config new charter` — names containing
  `..`, leading `/`, or non-normalized segments are now rejected.
- **HIGH** Symlink follow in `specfleet init --instruction <path>` — the
  source is now `lstat`'d and refused if it is a symlink or
  non-regular file.
- CLI version is now read from `package.json` instead of hardcoded.

### Security

- Hash-chained audit log: each `AuditEvent` carries `prevHash` and
  `hash = sha256(prevHash || canonical(event))`. Tampering is
  detectable via `specfleet check --audit`. Required for SOC 2 evidence.
- Outbound egress allowlist (`policies/egress.json`): default empty
  (deny-all external); enforced via `onPreToolUse`.
- IP-guard (`policies/ip-guard.json`): patterns for proprietary
  identifiers; integrated into the same redact pipeline as secrets;
  fail-closed on detection.
- Secret + IP-guard redaction now applied to **all** tool I/O via
  `onPreToolUse` (block writes containing matches) and
  `onPostToolUse` (redact before parent reads).
- Pre-commit hook scans staged diff for secrets + IP-guard matches.
- No-telemetry CI gate: `grep` over `dist/` for forbidden hosts;
  build fails on match. Documented in
  [`docs/security.md`](docs/security.md).
- SBOM (`dist/sbom.spdx.json`) generated at build time and shipped in
  the npm tarball; npm publish provenance enabled.
- Air-gap mode forces empty egress regardless of policy file.

### Docs

- New: [`docs/context-strategies.md`](docs/context-strategies.md) —
  the 4-strategy comparison and recommendation matrix.
- New: [`docs/harness-management.md`](docs/harness-management.md) —
  the eval → tune → review loop, cadence, anti-patterns.
- New: [`docs/security.md`](docs/security.md) — threat model and the
  13 hardening controls with config snippets.
- New: 5 compliance pages under `docs/compliance/` (`soc2.md`,
  `iso27001.md`, `hipaa.md`, `pci-dss.md`, `gdpr.md`).
- New: [`SECURITY.md`](SECURITY.md) — AS-IS / no-support statement.
- Updated: README — "What's new in v0.2", security one-pager
  checklist, command table, air-gap snippet.
- Updated: [`docs/specs.md`](docs/specs.md) — appended "How SpecFleet v0.2
  answers this" footer mapping each Q1–Q5 to commands and files.

## [0.1.0] — 2025-04-27

Initial public release.

### Added

- `specfleet init` — bootstrap `.specfleet/` in a greenfield repo with charters, policies,
  decisions, and a guided interview.
- `specfleet onboard` — non-destructive scaffold for brownfield repos.
- `specfleet plan` / `specfleet run` / `specfleet review` — orchestrator → role agent →
  subagent flow on top of GitHub Copilot SDK + CLI fleet mode.
- `specfleet config` — create / validate / list charters with per-charter
  `maxContextTokens` enforcement.
- `specfleet status` — session inspector for live and completed runs.
- `specfleet log` — query `.specfleet/audit/<sessionId>.jsonl` event streams.
- `specfleet check` — environment + auth + policy preflight.
- 32 charter templates covering orchestrator, architect, dev, test, devsecops,
  compliance (GDPR / PCI / Zero Trust), and SRE roles plus their subagents.
- Policy gates: secret redaction, token-budget caps (default 80K, hard cap 95K),
  immutable corporate `instruction.md`.
- Append-only audit log of every prompt, tool use, permission request, and
  policy block.
- Sample full-stack NoviMart app under `sample/novimart-app/` (.NET 10 BFF
  plus React/Vite, Bicep IaC, GitHub Actions, 4 walkthroughs, 3 compliance docs).

### Packaging

- Published to npmjs.com as `@pakbaz/specfleet` with build provenance.
- ESM-only, Node 20+.
- Ships `dist/`, `templates/`, `LICENSE`, `README.md`, `CHANGELOG.md`.

[Unreleased]: https://github.com/pakbaz/spec-fleet/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/pakbaz/spec-fleet/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/pakbaz/spec-fleet/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/pakbaz/spec-fleet/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/pakbaz/spec-fleet/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/pakbaz/spec-fleet/compare/v0.3.0...v0.4.0
[0.2.0]: https://github.com/pakbaz/spec-fleet/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/pakbaz/spec-fleet/releases/tag/v0.1.0
