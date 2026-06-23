# SpecFleet as a Spec Kit extension

SpecFleet ships as a **[Spec Kit](https://github.com/github/spec-kit) extension**.
This page covers how it is packaged, how to install it, and how to submit it to the
community catalog. For the conceptual overview see the [README](../README.md).

## Why an extension (and not an orchestrator)

The community **[Fleet Orchestrator](https://github.com/sharathsatish/spec-kit-fleet)**
(`fleet`) already chains the whole lifecycle into one command with human gates and
parallel subagents. To avoid overlap, SpecFleet is deliberately **not** an orchestrator.
It is a thin **governance layer** you run phase-by-phase alongside the core commands:

- a committed **charter** (task contract) per feature/role,
- a four-section **shared scratchpad** working memory, and
- a **charter-compliance** cross-model review.

| | `fleet` | `specfleet` |
| --- | --- | --- |
| id | `fleet` | `specfleet` |
| Drives the pipeline | Yes | No |
| Commands | `run`, `review` | `charter`, `scratchpad`, `review`, `check` |
| New artifacts | — | `charter.md`, `scratchpad.md` |

## Package layout

```text
extension.yml                 manifest (schema_version "1.0", id "specfleet")
commands/
  charter.md                  speckit.specfleet.charter
  scratchpad.md               speckit.specfleet.scratchpad
  review.md                   speckit.specfleet.review
  check.md                    speckit.specfleet.check
specfleet-config.template.yml installed to .specify/extensions/specfleet/specfleet-config.yml
.extensionignore              excludes src/, tests/, docs/, sample/, etc. from the install
```

The manifest declares four commands and three optional hooks
(`before_plan`, `after_tasks`, `after_implement`). Each hook is `optional: true` and
prompts before it runs, so the extension never silently takes over a phase.

## Installing

```bash
# From a tagged GitHub release (recommended)
specify extension add specfleet \
  --from https://github.com/pakbaz/spec-fleet/archive/refs/tags/v0.7.0.zip

# From a local checkout while developing
specify extension add --dev /path/to/spec-fleet

specify extension list      # → specfleet (0.7.0) — SpecFleet
specify extension remove specfleet
```

Commands are registered under your agent's command directory, e.g.
`.claude/commands/speckit.specfleet.charter.md`.

## Configuration

Copy [`specfleet-config.template.yml`](../specfleet-config.template.yml) to
`.specify/extensions/specfleet/specfleet-config.yml` and edit. Layered precedence:

1. Manifest `defaults`
2. `.specify/extensions/specfleet/specfleet-config.yml`
3. `.specify/extensions/specfleet/specfleet-config.local.yml` (gitignored)
4. Environment variables (`SPECKIT_SPECFLEET_*`)

Never commit credentials — use environment variables.

## Validating the package

The repository's test suite includes
[`tests/unit/extension.test.ts`](../tests/unit/extension.test.ts), which asserts:

- `schema_version` is `1.0` and `id` is `specfleet` (and **not** `fleet`);
- `version` is semver and a minimum `speckit_version` is required;
- every command is named `speckit.specfleet.<cmd>`, its file exists, has frontmatter,
  and consumes `$ARGUMENTS`;
- only valid hook events are referenced;
- the config template, `LICENSE`, and `.extensionignore` are present.

Run it with:

```bash
npm install
npm run build
npm test            # 58 tests incl. extension manifest validation
```

## Submitting to the community catalog

To list SpecFleet in the Spec Kit community catalog
([`extensions/catalog.community.json`](https://github.com/github/spec-kit/blob/main/extensions/catalog.community.json)):

1. Cut a GitHub release tagged `v0.7.0` (the `release` workflow builds the artifact).
2. File the
   [Extension Submission](https://github.com/github/spec-kit/issues/new?template=extension_submission.yml)
   issue with the metadata below.
3. A maintainer reviews and updates the catalog.

Suggested catalog entry (keep it distinct from the `fleet` entry):

```json
{
  "name": "SpecFleet",
  "id": "specfleet",
  "description": "Charter-driven task contracts and a shared scratchpad working memory that augment the core Spec Kit phases, plus a charter-compliance cross-model review.",
  "author": "pakbaz",
  "version": "0.7.0",
  "download_url": "https://github.com/pakbaz/spec-fleet/archive/refs/tags/v0.7.0.zip",
  "repository": "https://github.com/pakbaz/spec-fleet",
  "homepage": "https://github.com/pakbaz/spec-fleet",
  "documentation": "https://github.com/pakbaz/spec-fleet/blob/main/README.md",
  "changelog": "https://github.com/pakbaz/spec-fleet/blob/main/CHANGELOG.md",
  "license": "MIT",
  "category": "process",
  "effect": "read-write",
  "requires": { "speckit_version": ">=0.1.0" },
  "provides": { "commands": 4, "hooks": 3 },
  "tags": ["charter", "scratchpad", "task-contract", "cross-model-review", "governance"]
}
```

See the upstream
[Extension Development Guide](https://github.com/github/spec-kit/blob/main/extensions/EXTENSION-DEVELOPMENT-GUIDE.md)
for the full manifest reference.
