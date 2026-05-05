---
description: Phase 5 — Pre-implementation risk analysis.
tools: ["read", "write"]
model: ${SPECFLEET_MODEL}
---

# Analyze

Spec id `{{spec_id}}`. Inputs:
- `{{spec_dir}}/spec.md`, `plan.md`, `tasks.md`

## Constitution
{{constitution}}

## What to do

Write `{{spec_dir}}/analysis.md`:

```markdown
---
spec_id: {{spec_id}}
phase: analyze
generated: <YYYY-MM-DDTHH:MM:SSZ>
---

# Analysis for {{spec_id}}

## Risks

| # | Risk | Severity | Likelihood | Mitigation | Owner task |
|---|------|----------|------------|------------|------------|
| 1 | <risk> | high/med/low | high/med/low | <one sentence> | T# |

## Performance
- Hot paths: <expected QPS / latency / data volume>
- Bottlenecks: <where + how to measure>

## Security
- Threat model deltas: <new attack surfaces this introduces>
- Data classification: <PII / PCI / PHI / public>

## Operability
- Failure modes: <what breaks the system?>
- Observability gaps: <metrics/logs we are missing>

## Verdict
- Block Phase 6? yes / no
- If yes, why and what to add to `tasks.md` first.
```

## Constraints
- Risks of severity=high MUST have a mitigation that maps to an existing task in `tasks.md`. If none exists, propose a new task and set `Block Phase 6 = yes`.
- Cite plan.md sections by name when referring to a component.
- Stay under ~150 lines.
