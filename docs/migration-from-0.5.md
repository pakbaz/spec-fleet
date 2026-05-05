# Migrating from SpecFleet v0.5 to v0.6

<!-- markdownlint-disable MD060 -->

v0.6 is a deliberate **simplification** of v0.5. We dropped the SDK
dependency, the policy DSL, the audit hash chain, the hierarchical
subagent system, and a handful of niche commands. What remains is a
sharp, lean tool for running the Spec-Kit pipeline on Copilot CLI.

> v0.6 contains breaking changes. There is no automatic upgrade for the
> CLI surface — you will need to update your scripts. The
> `specfleet init --from-v5` helper handles the workspace files.

---

## Quick migration

```bash
cd path/to/your/repo
specfleet init --from-v5
```

This will:

1. Move `.specfleet/{audit,checkpoints,index,plans,instruction.md}` (if
   present) into `.specfleet/_v5-archive/`.
2. Re-scaffold the v0.6 layout (charters, prompts, instructions,
   scratchpad, runs).
3. Mirror charters into `.github/agents/`.
4. Re-probe Copilot CLI.

Your old `instruction.md` is preserved in `_v5-archive/` so you can
copy/paste sections into the new (slimmer) template.

---

## Removed CLI verbs

| v0.5 verb | v0.6 replacement |
|---|---|
| `specfleet plan "freeform brief"` | `specfleet specify` → `specfleet plan <spec-id>` |
| `specfleet spec` | `specfleet specify` |
| `specfleet review` (rebase risk audit) | `specfleet review <spec-id>` (cross-model gate) |
| `specfleet onboard` | `specfleet init` (auto-detects brownfield) |
| `specfleet replay` | gone — git history is the audit trail |
| `specfleet tune` | gone |
| `specfleet sre` | gone |
| `specfleet eval` | gone |
| `specfleet log` | inspect `.specfleet/runs/*.jsonl` directly |
| `specfleet status` | `specfleet config show` |
| `specfleet run` | individual phase verbs |
| `specfleet audit` | gone — see ADR-0004 for rationale |
| `specfleet install-hooks` | use `lefthook` / `pre-commit` directly with `specfleet check --staged` |
| `specfleet precommit-scan` | `specfleet check --staged` |
| `specfleet doctor` | `specfleet check` |
| `specfleet charter new` | edit a `.charter.md` by hand — no boilerplate |

## Removed dependencies

- `@github/copilot-sdk` — Copilot CLI does the same job and ships
  separately.
- `ajv`, `ajv-formats` — we now validate exclusively with Zod.

## Charter format changes

v0.5 charters had `name`, `displayName`, `role`, `tier`, `parent`,
`spawns`, `signature`, optional persona body. v0.6 charters drop all of
those — the only required keys are:

```yaml
---
name: dev
description: Implements code for the active spec.
maxContextTokens: 60000   # default, hard ceiling 95K
allowedTools: []          # empty = inherit Copilot defaults
mcpServers: []            # empty = MCP off
instructionsApplyTo: []   # path globs for path-scoped guidance
---
```

The body uses **task-contract shape** — no personas:

```markdown
## Goal
…
## Inputs
…
## Output
…
## Constraints
…
```

If you had `You are the X agent…` language in your old charters, drop
it. The community Spec-Kit meetings repeatedly flagged that personas
bias model behaviour without improving outcomes.

## Layout changes

| v0.5 | v0.6 |
|---|---|
| `.specfleet/charters/<role>/<sub>.charter.md` | `.specfleet/charters/<name>.charter.md` (flat, 7 of them) |
| `.specfleet/audit/*.jsonl` | `.specfleet/runs/<run-id>.jsonl` (no hash chain) |
| `.specfleet/policies/{egress,ip-guard,trusted-signers}.json` | gone — see ADR-0004 |
| `.specfleet/checkpoints/`, `.specfleet/index/`, `.specfleet/plans/` | replaced by `.specfleet/specs/<id>/` |
| (none) | `.specfleet/scratchpad/<id>.md` shared working memory |
| (none) | `.specfleet/config.json` cross-model defaults |
| `.github/agents/<role>-<sub>.agent.md` | `.github/agents/<charter>.agent.md` (flat) |
| (none) | `.github/prompts/specfleet.<phase>.prompt.md` × 8 |
| (none) | `.github/instructions/<x>.instructions.md` × 3 |
| (none) | `.github/copilot-instructions.md` |

## What if I relied on …

- **Hash-chained audit log** → use git for tamper-evidence. `runs/*.jsonl`
  is informational only.
- **Per-charter tool gating** → still works; `allowedTools` becomes
  `--allow-tool` flags on the Copilot CLI invocation. No runtime gate is
  enforced — you opt into Copilot's own tool prompts.
- **Subagents** → Copilot CLI spawns them at runtime. Don't pre-declare.
- **Policy packs** → stop. Use OPA / Rego separately if you need
  enforceable network policy.

If you need anything more, open an issue with your v0.5 use case and
we'll either document the v0.6 path or assess re-adding the capability.
