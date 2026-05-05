# The Eight-Phase Spec-Kit Pipeline

<!-- markdownlint-disable MD040 MD060 -->

SpecFleet runs the [Spec-Kit](https://github.com/github/spec-kit) eight-phase
spec-driven workflow on top of the GitHub Copilot CLI. Each phase is a
single `specfleet <verb> <spec-id>` command that:

1. Renders `.github/prompts/specfleet.<phase>.prompt.md` with mustache-lite
   placeholders.
2. Dispatches `copilot -p - --agent <charter>` with the prompt on stdin.
3. Writes the response into a per-spec artefact under
   `.specfleet/specs/<spec-id>/`.
4. Advances the spec's `status` frontmatter.

```
.specfleet/specs/<spec-id>/
  spec.md
  clarifications.md
  plan.md
  tasks.md
  analysis.md
  review.md
  checklist.md

.specfleet/scratchpad/<spec-id>.md
  working memory shared across implement runs
```

## Phase reference

### 1. `specify`

```bash
specfleet specify "todo-api" --description "REST API with JSON storage and CRUD"
```

- **Charter**: orchestrator
- **Output**: `spec.md` with frontmatter (`id`, `title`, `description`, `status: draft`).
- **Goal**: capture the user's intent before talking to a model. The
  prompt asks the orchestrator to flesh out Goal, Background,
  Requirements, Out of scope, and Risks, then identify ambiguities to
  resolve in `clarify`.

### 2. `clarify`

```bash
specfleet clarify todo-api --answer "stack: node 20" --answer "auth: none"
```

- **Charter**: orchestrator
- **Output**: `clarifications.md`. Each `--answer` flag is appended verbatim.
- **Status transition**: `draft → clarifying`
- **Why this phase**: the spec is rarely complete. Resolving ambiguity
  *before* planning prevents downstream rework.

### 3. `plan`

```bash
specfleet plan todo-api
```

- **Charter**: architect (overridable)
- **Output**: `plan.md` — high-level approach, components, sequencing.
- **Status transition**: `clarifying → planned`

### 4. `tasks`

```bash
specfleet tasks todo-api
```

- **Charter**: orchestrator
- **Output**: `tasks.md` — explicit, parallelisable work items.
- **Status transition**: `planned → tasked`

### 5. `analyze`

```bash
specfleet analyze todo-api
```

- **Charter**: architect
- **Output**: `analysis.md` — risk + dependency analysis written *before*
  implementation begins. Catches integration concerns the planner missed.

### 6. `implement`

```bash
specfleet implement todo-api --task crud-endpoints
```

- **Charter**: dev
- **Output**: appended to `.specfleet/scratchpad/<spec-id>.md`. Code
  lands in the working tree as part of the dispatch.
- **Status transition**: `tasked → implementing`
- The scratchpad has four canonical sections (Findings · Decisions ·
  Open Questions · Files Touched). Multiple `implement` runs accumulate
  there.

### 7. `review` — cross-model gate

```bash
specfleet review todo-api                  # uses models.review (default: gpt-5.1)
specfleet review todo-api --same-model     # disable cross-model gate
```

- **Charter**: architect
- **Model**: `models.review` (overridable via `--model` or
  `SPECFLEET_REVIEW_MODEL`).
- **Output**: `review.md`.
- **Why a different model**: asking the implementer to grade itself is a
  known weak gate. We default to a different vendor for review. See
  [adr/0005-cross-model-review.md](adr/0005-cross-model-review.md).

### 8. `checklist` — post-implement drift

```bash
specfleet checklist todo-api
```

- **Charter**: compliance
- **Output**: `checklist.md`.
- **Status transition**: `→ done`
- **Why this phase**: catches drift between `spec.md` and what shipped.
  The community Spec-Kit meetings called this out as the most common
  spec-vs-code divergence point.

## Placeholders

Each prompt template understands these placeholders:

| Placeholder | Source |
|---|---|
| `{{spec_id}}` | command argument |
| `{{spec_dir}}` | `.specfleet/specs/<spec-id>` |
| `{{workspace_root}}` | repo root |
| `{{instruction_path}}` | `.specfleet/instruction.md` |
| `{{project_path}}` | `.specfleet/project.md` |
| `{{constitution}}` | full body of `instruction.md` |
| `{{user_input}}` | freeform `--description` / `--answer` text |

Substitution is plain string replacement — no logic, no escaping. If a
placeholder is missing in the rendered output the runtime errors before
dispatching.
