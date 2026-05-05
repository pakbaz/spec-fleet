---
description: Phase 3 — Architecture plan for an implementation.
tools: ["read", "write"]
model: ${SPECFLEET_MODEL}
---

# Plan

Spec id `{{spec_id}}`. Inputs:
- `{{spec_dir}}/spec.md`
- `{{spec_dir}}/clarifications.md` (apply defaults for any open questions)

## Constitution
{{constitution}}

## Project cheat sheet
@{{project_path}}

## What to do

Write `{{spec_dir}}/plan.md` in this exact shape:

```markdown
---
spec_id: {{spec_id}}
phase: plan
generated: <YYYY-MM-DDTHH:MM:SSZ>
---

# Plan for {{spec_id}}

## Architecture
- Components: <name → responsibility>
- Contracts: <API / event / data shapes>
- Integration points: <where this plugs into existing systems>

## Data
- Schemas: <new tables / fields / migrations>
- Retention & PII: <reference instruction.md if applicable>

## Security & Compliance
- Authn/z: <how callers authenticate / what scopes>
- Secrets: <where stored, who accesses>
- Controls: <which constitution clauses this satisfies>

## Operations
- Observability: <metrics / logs / traces>
- Deploy: <how this rolls out>
- Rollback: <how to undo>

## Decisions
- D1: <choice>. Why: <one sentence>. Alternatives considered: <one line>.
- D2: ...
```

## Constraints
- Reuse libraries already in `project.md` before introducing new ones.
- Every decision must list at least one alternative and why it lost.
- If a constitution clause conflicts with the spec, stop and add a `## Conflict` block instead of writing the plan.
- Stay under ~250 lines.
