# Specs in SpecFleet (v0.6)

A SpecFleet **spec** is the per-feature folder produced by the eight-phase
pipeline:

```text
.specfleet/specs/<spec-id>/
  spec.md              ← Phase 1: specify
  clarifications.md    ← Phase 2: clarify
  plan.md              ← Phase 3: plan
  tasks.md             ← Phase 4: tasks
  analysis.md          ← Phase 5: analyze
  review.md            ← Phase 7: review
  checklist.md         ← Phase 8: checklist

.specfleet/scratchpad/<spec-id>.md
  shared, append-only working memory for Phase 6 implement runs
```

The `<spec-id>` is kebab-case (auto-slugified from the title on
`specfleet specify`). The folder is created by `specfleet specify`
and never moved or renamed — every later phase reads and writes
into it.

## Spec frontmatter

Every `spec.md` begins with frontmatter validated by
`SpecFrontmatterSchema`:

```yaml
---
id: payment-flow
title: Payment Flow
description: Replace the legacy redirect checkout with an embedded form.
status: draft        # draft → clarifying → planned → tasked → implementing → reviewed → done
owner: alice@example.com
---
```

The status field advances automatically as phases complete:

| After phase | New status |
| --- | --- |
| `specify` | `draft` |
| `clarify` | `clarifying` |
| `plan` | `planned` |
| `tasks` | `tasked` |
| `analyze` | `tasked` (no transition; analysis is informational) |
| `implement` | `implementing` |
| `review` | `reviewed` |
| `checklist` | `done` |

## Authoring conventions

- **Goal · Background · Requirements · Out of scope · Risks** sections
  in `spec.md` (the prompt template asks the orchestrator to populate
  them).
- **Each `--answer` to `clarify`** is appended verbatim to
  `clarifications.md` so the dialogue is auditable.
- **`tasks.md` rows are filterable** by `--task <name>` on
  `specfleet implement`, so you can run a single task in isolation.
- **`.specfleet/scratchpad/<spec-id>.md` is shared and append-only.** All
  `implement` runs write into the same file under the four canonical sections
  (Findings · Decisions · Open Questions · Files Touched).

## What changed from v0.5

- v0.5 wrote specs into `.specfleet/plans/<timestamp>.md` plus a
  separate `.specfleet/checkpoints/`. v0.6 collapses both into the
  per-spec folder.
- v0.5 had `specfleet sre triage` consuming SARIF. That feature is out
  of scope for v0.6 — use GitHub Code Scanning directly.
- v0.5 emitted hash-chained audit JSONL alongside specs. v0.6 emits
  plain JSONL run transcripts under `.specfleet/runs/`; spec history
  lives in git.

For the per-phase walkthrough see [spec-pipeline.md](spec-pipeline.md).
For the CLI reference see [cli.md](cli.md).
