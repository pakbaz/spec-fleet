# Copilot guidance for this repo

This repository uses **SpecFleet** — a thin Spec-Kit pipeline over GitHub Copilot CLI. Treat `.specfleet/` as the source of intent and `.github/` as the runtime contract.

## Where to find the rules
- `.specfleet/instruction.md` — the **constitution** (non-negotiable invariants for this repo). Never override.
- `.specfleet/project.md` — the **project cheat sheet** (stack, integrations, compliance scope).
- `.github/agents/*.agent.md` — the **charters** (task contracts: goal, inputs, outputs, constraints).
- `.github/prompts/specfleet.<phase>.prompt.md` — the **8 pipeline prompts** (specify · clarify · plan · tasks · analyze · implement · review · checklist).
- `.github/instructions/*.instructions.md` — **path-scoped** rules (coding style, testing, compliance).

## How to make changes
- Run `specfleet specify "<feature>"` to start a new spec instead of patching code directly.
- Each spec lives at `.specfleet/specs/<id>/` and accumulates `spec.md → clarifications.md → plan.md → tasks.md → analysis.md` before any code is written.
- The implementation phase produces a `## Summary` block and updates `.specfleet/scratchpad/<id>.md`.
- The review phase runs with a **different model** than implement (configured in `.specfleet/config.json`). The checklist phase verifies every spec requirement has evidence in the working tree.

## Operating principles
- **Charters are task contracts, not personas.** They describe inputs, outputs, and constraints — never "you are the X agent".
- **MCP servers are off by default.** Only enable a server in a charter that genuinely needs it.
- **Token budgets are real.** Each charter has `maxContextTokens`; the runtime refuses prompts that exceed it.
- **Drift detection is mandatory.** Every implementation finishes with `specfleet checklist <id>` to confirm requirements ↔ evidence.
