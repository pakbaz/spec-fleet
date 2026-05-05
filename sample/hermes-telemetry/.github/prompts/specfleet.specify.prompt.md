---
description: Phase 1 — Draft a fresh spec for a feature request.
tools: ["read", "write"]
model: ${SPECFLEET_MODEL}
---

# Specify

You are running the **specify** phase of SpecFleet's pipeline for spec id `{{spec_id}}`.

## Constitution
{{constitution}}

## Project cheat sheet
@{{project_path}}

## User input
{{user_input}}

## What to do

1. Read existing context:
   - `{{spec_dir}}/spec.md` (may be a stub — replace it).
   - `.specfleet/specs/` for similar specs (avoid duplication).
2. Produce a new `{{spec_dir}}/spec.md` with this exact shape:

```markdown
---
id: {{spec_id}}
title: <short title>
status: draft
created: <YYYY-MM-DD>
---

# {{spec_id}}

## Goal
<1–3 sentences: what user value will this deliver?>

## Background
<Why now? Reference the constitution and project cheat sheet.>

## Requirements
1. <numbered, testable, observable>
2. ...

## Out of scope
- <explicit non-goals>

## Risks
- <known unknowns>
```

## Constraints
- Do **not** invent business context the user did not provide. If something is unclear, list it under "Risks" and stop — Phase 2 (`clarify`) will resolve it.
- Each requirement must be testable with a single sentence assertion.
- Keep the spec under ~200 lines.
