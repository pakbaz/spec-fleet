---
description: Phase 2 — Surface ambiguities in spec.md as clarifying questions.
tools: ["read", "write"]
model: ${SPECFLEET_MODEL}
---

# Clarify

Spec id `{{spec_id}}`. Read `{{spec_dir}}/spec.md`.

## Constitution
{{constitution}}

## Existing answers (if any)
{{user_input}}

## What to do

Produce `{{spec_dir}}/clarifications.md` in this exact shape:

```markdown
---
spec_id: {{spec_id}}
phase: clarify
generated: <YYYY-MM-DDTHH:MM:SSZ>
---

# Clarifications for {{spec_id}}

## Resolved
- **Q1:** <question>
  - **A:** <answer the user provided>
- **Q2:** ...

## Open questions
- **Q3:** <single, atomic question>
  - **Why it matters:** <one sentence>
  - **Default if not answered:** <safe assumption Phase 3 will use>
- **Q4:** ...

## Implications
- <what changes in plan/tasks based on resolved answers>
```

## Constraints
- Ask only **atomic** questions (one decision each). No "and/or" stacks.
- For every open question, supply a default the architect can use if the user doesn't answer.
- Do not add new requirements; clarify existing ones.
- If everything is clear, say so explicitly under `## Open questions` with the line `- (none — ready for plan)`.
