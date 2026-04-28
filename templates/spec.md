---
id: __ID__
title: __TITLE__
status: draft
created: __CREATED__
---

# __TITLE__

## Why

Describe the user / business problem this spec solves. One paragraph.
Link to source signals (issue #, customer interview, incident).

## What

### User stories

- As a **<persona>**, I want **<capability>**, so that **<outcome>**.

### Acceptance criteria

- [ ] Behaviour 1 is observable via …
- [ ] Behaviour 2 fails closed when …
- [ ] Performance: p99 < N ms under load X.

## How

### Architecture

- Components touched: …
- Data model deltas: …
- External dependencies / contracts: …
- Migration / rollout strategy: …

### Charters & subagents

Which EAS charters will execute this spec (e.g. `dev/backend`, `test`,
`compliance`). Note any new subagent that needs scaffolding.

## Risks

- **Risk 1** — likelihood / impact / mitigation.
- **Risk 2** — …

## Done When

- All acceptance criteria green in `eas eval`.
- Compliance review signed off (decision logged in `.eas/decisions.md`).
- Runbook updated (if SRE-impacting).
