# Research: github copilot cli agent orchestration subagent fl

*Generated: 4/26/2026, 10:17:16 PM*

---

# GitHub Copilot CLI Agent Orchestration, Subagents, Fleet Mode, and Tasks

**Generated:** 2026-04-27  
**Scope:** Public documentation and local source research on GitHub Copilot CLI orchestration, built-in agents, custom agents, subagents, `/fleet`, `/tasks`, autopilot, `/delegate`, Copilot SDK internals, and Squad-style enterprise multi-agent patterns.  
**Primary source snapshots:** `github/copilot-sdk` at commit `c63feb2794786342d57936c13d28c250e723c676`; `bradygaster/squad` at commit `ef3028692df38c74eef8f6807e29e74ba73a8ce8`.

## Executive Summary

GitHub Copilot CLI is best understood as a terminal-native orchestration shell for an agentic coding runtime, not just a chat interface. Its own README says it is powered by the same agentic harness as GitHub's Copilot coding agent and combines GitHub integration, planning and execution, MCP extensibility, and explicit user control over actions.[^1] The product surface exposes this orchestration model through interactive mode, programmatic `-p/--prompt` mode, plan mode, steering, resumable sessions, permission gates, custom agents, built-in subagents, `/fleet`, `/tasks`, `/delegate`, and `/review`.[^2][^3][^4]

The central design pattern is separation of coordination from execution. The main CLI agent owns the conversation, intent, permissions, context, and final synthesis. It may invoke tools directly, delegate specialist work to built-in or custom subagents, split work through `/fleet`, or hand work off to Copilot cloud agent through `/delegate`. Subagents are valuable because each one has a separate context window, can use a specialized agent profile and tool set, and can run in parallel when the work has weak dependencies.[^5][^6][^7] The `/tasks` command is the visibility layer for this background work: it lists shell sessions and subagent tasks and lets the user inspect, kill, or remove completed task records.[^4][^7]

For enterprise-scale AI coding, the strongest pattern is "plan, decompose, delegate, observe, integrate." Use plan mode to make work explicit; use `/fleet` only for independent tracks; use custom agents and skills to encode team-specific expertise; use tool allowlists, hooks, MCP scoping, and review gates for governance; use `/delegate` for asynchronous cloud work; and use repo-resident systems such as Squad when a team wants durable agent roles, histories, routing, and backlog automation.[^8][^9][^10][^11]

## Query Type and Research Method

This is a technical architecture research report. I treated the question as asking how Copilot CLI organizes agent work, how subagents and task management are represented, how `/fleet` differs from ordinary delegation, and how these mechanisms can be used in a large enterprise setup.

The evidence base combines three classes of sources. First, official GitHub documentation describes product-facing behavior: CLI modes, slash commands, custom agents, subagents, `/fleet`, `/tasks`, autopilot, steering, permissions, MCP, and Copilot cloud agent handoff.[^2][^3][^4][^5][^6][^7][^8][^9][^10][^12][^13][^14] Second, local Copilot SDK docs and source types explain runtime mechanics: JSON-RPC transport, CLI-owned tool loop, session events, `session.idle`, `session.task_complete`, custom agent configuration, subagent lifecycle events, tool scoping, hooks, MCP servers, steering, queueing, persistence, and resumable sessions.[^15][^16][^17][^18][^19][^20][^21][^22][^23][^24] Third, Brady Gaster's Squad source provides a concrete, repo-resident orchestration case study built around Copilot CLI and Copilot SDK concepts: coordinator charters, routing, fan-out, session pools, Ralph watch mode, fleet dispatch, and wave dispatch.[^25][^26][^27][^28][^29][^30][^31][^32]

## System Overview

At a high level, Copilot CLI is a local orchestrator with several execution lanes:

```text
User prompt / plan / steering
        |
        v
Main Copilot CLI agent
  - owns conversation and synthesis
  - manages permissions and trusted paths
  - chooses tools, subagents, fleet, or cloud handoff
        |
        +--> direct tools: read, edit, shell, GitHub MCP, custom MCP
        |
        +--> built-in or custom subagent
        |       - separate context window
        |       - scoped instructions/tools/model
        |       - lifecycle visible through task/event surfaces
        |
        +--> /fleet
        |       - decomposes plan into independent tracks
        |       - runs subagents in parallel where dependencies allow
        |       - monitored through /tasks
        |
        +--> /delegate
                - sends context to Copilot cloud agent
                - cloud agent works in GitHub Actions environment
                - opens draft PR and links back to the session
```

The same model appears from different angles in the docs. The CLI help exposes the user controls: `/agent` for agent selection, `/fleet` for parallel subagent execution, `/tasks` for background task management, `/delegate` for cloud handoff, `/review` for agentic code review, `/allow-all` for permission expansion, `/context` for context visibility, `/resume` for session selection, and `/compact` for context compression.[^4] The official CLI pages then describe the behavioral rules: the user starts in a trusted directory, approves modifying or executing tools unless broad permission is granted, can steer work while the agent is active, and can resume saved local sessions.[^2][^3][^5]

The SDK gives the underlying mechanics. It describes the SDK as a transport layer and the CLI as the component that runs the tool-use loop. When an application sends a prompt, the CLI calls the model, executes requested tools, feeds results back to the model, and repeats until the model emits a final response and the session becomes idle.[^16] This means orchestration decisions are not hidden in the SDK client. The SDK passes prompts, events, hooks, tool handlers, and session configuration across JSON-RPC, while the CLI owns the agent loop and model-facing work.[^16][^23]

## Copilot CLI as an Orchestration Shell

Copilot CLI has two primary user interfaces: interactive and programmatic. In interactive mode, `copilot` opens a terminal session where the user can discuss, plan, approve actions, steer active work, and change modes. In programmatic mode, `copilot -p "..."` or `copilot --prompt "..."` sends one prompt and exits, with approval flags needed when the prompt requires file modification or command execution.[^2] This split matters because enterprises often need both: interactive sessions for ambiguous engineering work and programmatic invocations for repeatable automation.

The interactive interface includes standard, plan, and autopilot modes. Official docs describe plan mode as a way to make Copilot analyze scope, ask clarifying questions, and create a structured implementation plan before code is written.[^2] Best-practice docs say plan mode creates a plan with checkboxes, saves it to `plan.md` in the session folder, and waits for approval before implementation.[^33] For large-scope work, plan mode is the front end of orchestration: it converts a broad request into a dependency graph that can later be executed directly, sent through `/fleet`, or delegated to cloud.

The CLI also has explicit context and state controls. Official best practices document "infinite sessions" with session state under `~/.copilot/session-state/{session-id}/`, including event logs, workspace metadata, plan files, checkpoints, and session files.[^34] The SDK persistence guide confirms the same conceptual model: session state includes conversation history, tool state, and planning context, and a caller can create or resume sessions by ID when persistence is enabled.[^22] In enterprise use, that makes session state an audit and recovery surface, not merely a UX convenience.

Permissioning is part of orchestration, not a separate concern. The CLI asks for trust before working in a folder and prompts before tools that modify or execute files.[^3] It supports session-level approval for a tool class, reset commands for approved tools, explicit allow and deny flags such as `--allow-tool` and `--deny-tool`, and broad permission commands such as `/allow-all`.[^3][^35] The practical result is that the main agent operates as a coordinator constrained by a policy envelope chosen by the user or automation.

## Agent Loop and Completion Model

The Copilot SDK's agent-loop documentation is the clearest source for how a single prompt becomes many model turns. One user prompt may produce multiple LLM calls: the model requests tools, the CLI executes them, the tool results are fed back, and the model either asks for more tools or emits final text.[^16] Each LLM call appears as an `assistant.turn_start` / `assistant.turn_end` pair, so the event log exposes the real number of model interactions rather than hiding internal calls.[^16]

The most important completion distinction is between `session.idle` and `session.task_complete`. The SDK docs say `session.idle` is always emitted when the tool-use loop ends and is the reliable "agent stopped processing" signal. By contrast, `session.task_complete` is optional, persisted, and depends on the model explicitly signaling that it considers the task fulfilled.[^16] A blocking client should wait for `session.idle`; a product UI or workflow monitor may treat `session.task_complete` as a semantic signal but should not depend on it as the only done condition.[^16]

Autopilot adds a second layer over that loop. The SDK docs state that in autonomous operation the CLI tracks whether the model called `task_complete`; if the tool-use loop ends without that signal, the CLI injects a synthetic user message nudging the model to implement rather than merely plan and to avoid marking the task complete too early.[^17] Official product docs describe the same behavior from the user's point of view: autopilot lets Copilot work through multiple steps without requiring user input after each step, ending when the agent decides the task is complete, hits a blocker, is stopped by the user, or reaches a configured step limit.[^8]

This is the underlying reason `/fleet`, subagents, and `/tasks` are coherent features. A subagent is not just a text prompt. It is another agent loop, with its own prompt, context, tools, events, and done signal. Fleet mode is not just a planning instruction. It is a higher-order orchestration loop in which the parent agent decides which subtasks are safe to run separately and then integrates their outputs.

## Built-in Agents, Subagents, and the Task Surface

The CLI ships with built-in custom agents for common work. Official docs list `explore`, `task`, `general-purpose`, `code-review`, and `research`. The explore agent is fast and read-only, designed for codebase analysis without polluting the main context. The task agent runs development commands such as tests, builds, linters, formatters, and installs, summarizing success and returning full output on failure. The general-purpose agent is close to the main agent but runs in a separate context. The code-review agent focuses on real defects rather than style noise. The research agent is staff-level and only triggered by `/research`, not automatic inference.[^9][^12]

There are three related but distinct "task" concepts:

| Term | Meaning | Enterprise implication |
| --- | --- | --- |
| `task` built-in agent | A command-execution subagent for tests, builds, linters, dependency installs, and other verbose commands.[^12] | Keeps noisy command output out of the main context while preserving failure detail. |
| `task` or custom-agent tool | The mechanism by which the main agent can delegate complex work to a subagent.[^13] | Enables the main agent to become an orchestrator rather than a single overloaded worker. |
| `/tasks` slash command | The user interface for inspecting and managing background subagent and shell tasks.[^4][^7] | Provides visibility and kill/remove controls during fleet or background execution. |

Official docs define subagents as delegated agent processes tied to the main agent, with their own context windows and task-specific work separate from the parent.[^13] Custom agents are the profiles used to specialize those subagents. This means the main agent can choose to keep a task inline, run a built-in subagent, or invoke a user-defined custom agent when the agent profile description matches the request.[^9][^12]

The SDK mirrors this product behavior. A session can receive `customAgents`, each with a name, display name, description, tool list, prompt, MCP servers, inference flag, and skills. The runtime matches user intent against agent names and descriptions; if the agent is available for inference, it can be selected, run in an isolated context with restricted tools, and stream lifecycle events back to the parent.[^18][^19][^23] The parent receives `subagent.selected`, `subagent.started`, `subagent.completed`, `subagent.failed`, and `subagent.deselected` events, with fields such as agent name, display name, tools, tool call ID, and error information.[^19]

The SDK also supports a tree-shaped view of subagent work. Subagent events include `toolCallId`, which can be used to reconstruct an execution tree and render running, completed, and failed nodes.[^20] That event model is the programmatic analogue of the CLI `/tasks` list: both are ways to make delegated background work visible enough for users or platform systems to manage.

## Custom Agent Profiles and Configuration

A CLI custom agent is a Markdown agent profile with YAML frontmatter and a prompt body. Official documentation describes profile fields such as optional `name`, required `description`, `tools`, `model`, `target`, `mcp-servers`, model-invocation controls, user-invocable controls, and metadata; the Markdown body contains the agent behavior and can be up to 30,000 characters.[^10] The CLI creation flow writes these profiles into `.github/agents/` for project agents or `~/.copilot/agents/` for user agents.[^6]

The `tools` property is central to enterprise use. The custom agent configuration reference says omitting `tools` or using `["*"]` enables all tools, an explicit list enables only named tools or aliases, and an empty list disables all tools. Tool aliases include `execute`, `read`, `edit`, `search`, `agent`, and `web`; the `agent` alias maps to invoking a different custom agent.[^10] SDK docs reinforce the same least-privilege pattern: define read-only agents with search/view tools, writer agents with edit/shell tools, and unrestricted agents only when the scope demands it.[^20]

Custom agents can also carry model and MCP configuration. Official docs say custom agents may specify a model, and `/fleet` docs say a subagent can use a custom agent profile's model or a model requested in the prompt for that part of the work.[^6][^7] MCP configuration can be embedded in an agent profile or supplied at the session/repository level, with tool filtering applied across built-in and MCP-sourced tools.[^10][^11][^21] For enterprises, this is the key governance pattern: put sensitive or expensive capabilities behind specialist agents rather than exposing every capability to the default agent.

There is one documentation inconsistency worth tracking. The "Using Copilot CLI" page says system-level agents override repository-level agents and repository-level agents override organization-level agents.[^9] The "Create custom agents for CLI" page says if a user and repository agent have the same name, the user-level agent is used.[^6] The custom agent configuration reference says the lowest-level configuration takes precedence for deduplication and later states repository overrides organization and organization overrides enterprise.[^10][^11] Until GitHub reconciles the wording, platform teams should avoid duplicate agent names across scopes or explicitly document which scope they expect to win.

## `/fleet`: Parallel Subagent Execution

The `/fleet` slash command is the CLI's explicit parallelization mode. Official docs define it as a command that lets Copilot break a complex request into smaller tasks and run them in parallel for efficiency and throughput.[^7] The main agent analyzes the prompt, determines whether it can be divided into smaller subtasks, checks dependencies, and acts as orchestrator when it assigns some or all subtasks to subagents.[^7]

Fleet mode has three main benefits. First, speed: independent work can be done in parallel, especially testing, analysis, refactoring across unrelated modules, and multi-file updates with weak dependencies.[^7] Second, specialization: if custom agents exist, Copilot can use the right profile for each subtask, and prompts can call out a specific agent with `@CUSTOM-AGENT-NAME`.[^7] Third, context isolation: each subagent has its own context window, so the parent agent can preserve high-level plan and integration context while subagents handle local details.[^7]

The official workflow places `/fleet` after planning. A typical path is: enter plan mode, produce an implementation plan, then select "Accept plan and build on autopilot + /fleet" or leave plan mode and prompt `/fleet implement the plan`.[^7][^8] This is a good default. If a plan is not explicit, fleet mode can still try to decompose the request, but the quality of decomposition depends on how well the user or plan described boundaries and dependencies.

Fleet mode is not a universal speed-up. Official docs warn that each subagent can interact with the LLM independently, so splitting work may consume more premium requests than a single-agent run.[^7] They also warn that inherently sequential work may see no benefit.[^7] The enterprise rule is simple: use `/fleet` for independent tracks with clear merge points; avoid it when one step's output defines the next step's input.

The `/tasks` command is the operational companion to `/fleet`. GitHub's how-to says `/tasks` lists background tasks for the current session, including subtasks handled by subagents. From that list, the user can view a subtask summary, kill a process, or remove completed/killed subtasks from the list.[^8] This makes `/fleet` usable in practice: users need a cockpit for many child workers, not just a prompt that starts them.

## Autopilot, Permissions, and Headless Work

Autopilot is different from `/fleet`. Official docs define autopilot as a mode in which Copilot works through a task without waiting for user input after each step; it is most suitable for well-defined tasks, batch operations, CI-style workflows, and large tasks that need many steps.[^8] Fleet mode is about parallelism through subagents; autopilot is about autonomous progress over multiple model interactions. They are often combined, but they solve different problems.[^7][^8]

Autopilot also differs from broad permissions. The docs state that `--allow-all` and `/allow-all` are permission controls: they let the CLI use tools, paths, and URLs without asking, but the agent may still stop at a decision point in the normal interactive flow.[^8] The `--no-ask-user` flag suppresses clarifying questions, forcing the agent to make decisions, but it does not itself make the agent run through successive model interactions without user involvement.[^8] Autopilot is the feature that makes the CLI self-drive across those interactions; broad permission merely removes approval prompts that would otherwise block actions.[^8]

This distinction is critical for automation. A headless command that grants all permissions but does not enable autopilot may still exit after a single model interaction or ask for a choice. A command that enables autopilot but lacks sufficient permissions may have all approval-requiring tools denied and fail to complete the work. For enterprise automation, the safer pattern is to use autopilot only with well-scoped prompts, trusted directories, explicit allow/deny rules where possible, and a bounded run policy.

## `/delegate` and Copilot Cloud Agent

`/delegate` is not local fleet mode. It pushes the current session to Copilot cloud agent on GitHub so the work can proceed asynchronously with preserved context.[^14] Official docs say the command asks to commit unstaged local changes as a checkpoint in a new branch, starts Copilot cloud agent, opens a draft pull request, and gives links to the PR and agent session.[^14]

Copilot cloud agent is a separate execution environment. GitHub describes it as an agent that works independently in the background, can research a repository, create plans, fix bugs, implement incremental features, improve test coverage, update documentation, address technical debt, and resolve merge conflicts.[^14][^15] It works in its own ephemeral development environment powered by GitHub Actions, where it can explore code, make changes, and run tests and linters.[^15] GitHub also distinguishes cloud agent from local IDE agent mode: cloud agent works on GitHub in a branch and can open a PR, while IDE/local agent modes make changes in the developer's environment.[^15]

The enterprise decision boundary is therefore clear. Use local CLI and `/fleet` when the work needs local context, interactive steering, local tools, or tight developer oversight. Use `/delegate` when work is asynchronous, branch/PR-oriented, or tangential enough that the developer should not wait locally. The cloud path gives team-visible commits and PR logs, while the local path gives immediate terminal control and access to local resources.[^15]

## SDK-Level Orchestration Primitives

The SDK exposes the primitives needed to build Copilot-powered orchestrators. Its feature index lists the agent loop, hooks, custom agents, MCP servers, skills, streaming events, steering and queueing, and session persistence as first-class capabilities.[^15] Those map directly to enterprise platform concerns: execution semantics, policy control, specialization, external tools, reusable instructions, observability, interruption/ordering, and durable state.

Custom agents are configured in SDK sessions through `customAgents`, while `defaultAgent.excludedTools` can hide specific tools from the default agent while leaving them available to specialist subagents.[^23] The custom-agent guide explains why this matters: heavy-context or sensitive tools can be made agent-exclusive so the default agent acts as an orchestrator and delegates the heavy work to an agent with the right prompt and tool access.[^20] This is the SDK version of a least-privilege team topology.

Streaming and event subscriptions supply observability. The SDK event guide says session events cover thinking, writing, tool execution, and idle signals; persisted events are saved to the session log, while ephemeral deltas and idle notifications are streamed in real time.[^24] For subagents, lifecycle events plus `toolCallId` let a product reconstruct the execution tree.[^19][^20] This event model is enough to build dashboards, audit logs, task panels, or enterprise workflow state machines.

Steering and queueing control message delivery while an agent is active. The SDK supports `mode: "immediate"` for steering into the current turn and `mode: "enqueue"` for FIFO handling after the current turn; if steering arrives too late for the current turn, it is moved to the regular queue.[^20] The official CLI steering page simplifies the UI story: input sent while Copilot is thinking is treated as steering in the current task, processed in order, and there is no separate instruction queue in the interactive UI.[^5]

Hooks give policy owners a programmable guardrail layer. The SDK hook guide lists `onSessionStart`, `onUserPromptSubmitted`, `onPreToolUse`, `onPostToolUse`, `onSessionEnd`, and `onErrorOccurred`, and shows `onPreToolUse` blocking non-read-only tools through a permission decision.[^21] The CLI customization comparison also lists hooks as lifecycle logic for pre/post tool use, prompts, session start/end, error, agent stop, and subagent stop, with use cases such as guardrails, telemetry, retry/abort handling, protected path checks, and subagent-finish interception.[^13] For regulated enterprises, hooks are where policy moves from "the agent should" to "the platform enforces."

MCP is the tool expansion layer. SDK docs say MCP servers can be local/stdio subprocesses or HTTP/SSE services, and tool lists can allow all tools, allow a subset, or disable all tools.[^21] CLI docs say GitHub MCP is built in and additional MCP servers can be added through `/mcp add`, with configuration stored by default under `~/.copilot/mcp-config.json` unless the home path is changed.[^9] Custom agents can also reference MCP servers and server-specific tools.[^10] The enterprise pattern is to expose external systems through MCP servers with narrow tools and then bind those tools to the agents that need them.

## Squad as a Concrete Orchestration Case Study

Squad is a useful reference implementation because it turns Copilot CLI orchestration ideas into repo-resident team mechanics. Its README describes Squad as a human-directed AI development team through GitHub Copilot: specialists live in repo files, persist across sessions, learn the codebase, share decisions, and keep oversight with humans.[^25] It also explicitly says each team member runs in its own context and writes back what it learned, making the work inspectable.[^25]

The Squad agent template makes the coordinator role explicit. The coordinator's identity is "orchestrator"; its mindset is "what can I launch right now"; it may not generate domain artifacts itself; and in team mode it is a dispatcher, not a doer.[^27] It detects the available dispatch mechanism: CLI mode uses the `task` tool with `agent_type`, `mode`, `model`, `name`, `description`, and `prompt`; VS Code mode uses `runSubagent`; fallback mode works inline only if no subagent mechanism exists.[^27][^29]

Squad also codifies a mode ladder. Direct mode answers known status or simple factual questions without spawning. Lightweight mode spawns one agent with a minimal prompt. Standard mode spawns one agent with fuller context and ceremony. Full mode does parallel fan-out for multi-agent work touching several domains.[^28] This is a practical enterprise pattern: do not make every request expensive, but do not under-delegate multi-domain work.

Squad's source contains lower-level orchestration components. The coordinator class routes a message, determines whether the strategy is direct, single-agent, multi-agent, or fallback, builds spawn configs, and calls `spawnParallel` when fan-out dependencies are available.[^30] The fan-out module uses `Promise.allSettled` to spawn multiple sessions concurrently, compile charters, resolve models, create sessions, register them in the session pool, send initial prompts, isolate failures, and aggregate events back to the coordinator bus.[^31] The session pool tracks concurrent sessions, enforces capacity, emits session/pool events, and cleans up idle sessions.[^32]

Ralph watch mode shows the backlog automation side. The README says Ralph polls for work, triages, hands off execution, monitors results, and escalates back to people when judgment or approval is needed.[^26] The execute capability filters for issues labeled `squad` or `squad:*`, skips human-assigned and blocked issues, classifies read-heavy versus write-heavy titles, builds a rich Ralph prompt, and invokes a single Copilot session with all eligible issues so the agent can decide which work is actionable.[^37]

The Squad fleet-dispatch capability is a direct analogue of `/fleet` automation. It batches read-heavy issues into a single `/fleet` prompt, asks for read-only analysis tracks to run in parallel, writes findings as issue comments, and invokes `copilot -p` with broad permissions, no clarifying questions, and autopilot.[^38] This is not official GitHub fleet internals, but it is a concrete pattern for platform teams: batch independent read-only work into fleet tracks, keep write-heavy work in fuller agent sessions, and route based on risk.

Wave dispatch is another pattern, but its current snapshot is less mature. It can parse markdown checklist subtasks and dependency annotations, then execute dependency waves with concurrency up to `maxConcurrent`.[^39] However, the inspected source calls `parseSubTasks(undefined)` when iterating list work items, so it skips items without loaded bodies.[^39] Treat this as a design sketch rather than a complete implementation in the inspected commit.

## Enterprise Patterns and Recommendations

The most robust enterprise workflow is:

1. Use custom instructions for always-on standards such as coding conventions, test requirements, repository boundaries, and review expectations.
2. Use plan mode for large changes so the agent must articulate scope, tasks, and dependencies before code is written.
3. Use `/fleet` only after the plan exposes independent tracks.
4. Use `/tasks` during fleet execution to inspect background subagents and stop bad tracks early.
5. Use specialist custom agents for repeatable domains such as frontend, data migration, security review, test generation, documentation, and release work.
6. Use skills for just-in-time procedures that are relevant only to certain tasks.
7. Use MCP servers for external systems, but scope their tools through custom agent profiles or session config.
8. Use hooks for guardrails, audit logs, protected paths, secret scanning, and post-tool redaction.
9. Use `/delegate` when branch/PR work can run asynchronously in the cloud.
10. Use a Squad-style repo layer when work requires durable roles, histories, routing, issue triage, and multi-agent governance.

The main anti-pattern is giving a single agent every instruction, every tool, and every repository boundary. That inflates context, weakens reasoning, increases blast radius, and makes review harder. Copilot CLI's orchestration features push in the opposite direction: keep the parent agent focused on coordination, route specialized work to subagents, preserve visibility through task and event surfaces, and enforce policy through permissions, tool scoping, hooks, and reviews.

For regulated teams, create a small catalog of approved agent profiles rather than letting every developer invent their own. Each profile should declare purpose, trigger conditions, allowed tools, model preference if needed, output contract, escalation rules, and whether inference is enabled. Sensitive agents such as cleanup, migration, deployment, security remediation, or data access should be explicit-invocation only rather than automatically inferred. The SDK supports this through `infer: false`; product documentation now also points to model-invocation and user-invocable controls in frontmatter.[^18][^10]

For platform teams, build telemetry around the event stream and task surface. Useful metrics include parent prompts, subagent counts, fleet track counts, model turn counts, failed tool calls, killed background tasks, task duration, permission denials, protected path attempts, test failures found by task agents, PRs created through `/delegate`, and post-review rejection rate. GitHub already exposes pull request lifecycle metrics for Copilot cloud agent outcomes, such as created/merged PRs and median time to merge.[^15] Local CLI/fleet telemetry can fill the gap for synchronous terminal work.

## Practical Decision Matrix

| Need | Best fit | Reason |
| --- | --- | --- |
| Understand a codebase quickly | Built-in `explore` or `/research` | Read-only separate context keeps the main session clean.[^12] |
| Run noisy build/test/lint commands | Built-in `task` agent | Success is summarized; failure details are preserved without flooding the parent.[^12] |
| Multi-file feature with unclear scope | Plan mode first | Plan mode asks questions, creates task structure, and waits for approval.[^33] |
| Independent implementation tracks | `/fleet` | Parent decomposes and runs subagents in parallel where dependencies allow.[^7] |
| Inspect active subagents | `/tasks` | Lists background subagent and shell tasks; supports details, kill, and cleanup controls.[^8] |
| Domain-specific repeatable work | Custom agent | Encodes role, tools, model, MCP, and behavior in a reusable profile.[^6][^10] |
| Reusable procedure for occasional tasks | Skill | Injects relevant instructions only when needed.[^13] |
| External systems or domain tools | MCP server | Adds tool collections and can be scoped by server and tool name.[^9][^21] |
| Guardrails and audit | Hooks plus permission controls | Hooks intercept lifecycle/tool moments; CLI permission controls bound actions.[^13][^21][^35] |
| Asynchronous PR-producing work | `/delegate` / Copilot cloud agent | Work moves to GitHub, branch/PR workflow, and Actions-backed environment.[^14][^15] |
| Persistent AI team with backlog routing | Squad-style coordinator | Repo files define roles, routing, decisions, histories, and watch automation.[^25][^26][^27] |

## Key Takeaways

Copilot CLI orchestration is layered. At the bottom is the CLI-owned tool-use loop over model turns and tools. Above that are session events, permissions, hooks, persistence, and MCP. Above that are built-in and custom agents running as subagents with isolated contexts. Above that is `/fleet`, which uses subagents as a parallel execution substrate. Beside it is `/delegate`, which moves work into Copilot cloud agent for asynchronous branch and PR work.

The most important practical distinction is between parallelism and autonomy. `/fleet` gives parallelism. Autopilot gives autonomous progress. `/tasks` gives visibility and control over the resulting background work. `--allow-all` gives permission breadth, not autonomous reasoning. Custom agents give specialization and tool boundaries. Hooks and MCP scoping give governance. These features are strongest when combined deliberately, not turned on indiscriminately.

For enterprise adoption, start with a governed catalog: approved custom instructions, approved skills, approved custom agents, approved MCP servers, and policy hooks. Then teach teams a simple workflow: explore, plan, review the plan, fleet only independent tracks, monitor `/tasks`, integrate results, verify, review, and only then merge. That workflow is slower than a single prompt, but it is much closer to how accountable enterprise software should be built.

## Confidence Assessment

**High confidence:** Official CLI behaviors around interactive/programmatic modes, trust and permission prompts, plan mode, built-in agents, custom agents, `/fleet`, `/tasks`, autopilot, steering, MCP, and `/delegate` are directly supported by GitHub documentation.[^2][^3][^4][^5][^6][^7][^8][^9][^10][^12][^14]

**High confidence:** SDK mechanics around the agent loop, `session.idle`, `session.task_complete`, custom agents, subagent events, tool scoping, hooks, MCP, streaming events, steering/queueing, and persistence are directly supported by local SDK docs and source types.[^15][^16][^17][^18][^19][^20][^21][^22][^23][^24]

**Medium confidence:** Custom agent precedence across user, repository, organization, enterprise, and system scopes needs caution because official pages use slightly different wording. Avoid duplicate names across scopes until the product documentation is reconciled.[^6][^9][^10][^11]

**Medium confidence:** Squad findings are accurate for the inspected commit, but Squad is alpha software and its README warns APIs and CLI commands may change between releases.[^25] Treat Squad as a source of patterns and reference implementation ideas, not as stable platform behavior.

## Source Notes

[^1]: GitHub Copilot CLI documentation bundle, README section, `/var/folders/x0/2_2cw45n6119s1_3fwg6j49c0000gn/T/1777266631734-copilot-tool-output-p3a7vv.txt`, lines 4-23.
[^2]: GitHub Docs, "About GitHub Copilot CLI", `/var/folders/x0/2_2cw45n6119s1_3fwg6j49c0000gn/T/1777266693554-copilot-tool-output-s2yask.txt`, lines 21-40 and 143-168.
[^3]: GitHub Docs, "Using GitHub Copilot CLI", `/var/folders/x0/2_2cw45n6119s1_3fwg6j49c0000gn/T/1777266693131-copilot-tool-output-ytb2ui.txt`, lines 15-66 and 110-123.
[^4]: GitHub Copilot CLI help output, `/var/folders/x0/2_2cw45n6119s1_3fwg6j49c0000gn/T/1777266631734-copilot-tool-output-p3a7vv.txt`, lines 228-262.
[^5]: GitHub Docs, "GitHub Copilot CLI command reference", `/var/folders/x0/2_2cw45n6119s1_3fwg6j49c0000gn/T/1777266711670-copilot-tool-output-0mk49p.txt`, lines 47-68.
[^6]: GitHub Docs, "Creating and using custom agents for GitHub Copilot CLI", https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/create-custom-agents-for-cli.
[^7]: GitHub Docs, "Running tasks in parallel with the /fleet command", https://docs.github.com/en/copilot/concepts/agents/copilot-cli/fleet.
[^8]: GitHub Docs, "Speeding up task completion with the /fleet command", https://docs.github.com/en/copilot/how-tos/copilot-cli/speed-up-task-completion, and "Allowing GitHub Copilot CLI to work autonomously", https://docs.github.com/en/copilot/concepts/agents/copilot-cli/autopilot.
[^9]: GitHub Docs, "Using GitHub Copilot CLI", custom agents and MCP sections, `/var/folders/x0/2_2cw45n6119s1_3fwg6j49c0000gn/T/1777266693131-copilot-tool-output-ytb2ui.txt`, lines 133-179 and 188-226.
[^10]: GitHub Docs, "Custom agents configuration", `/var/folders/x0/2_2cw45n6119s1_3fwg6j49c0000gn/T/1777266719801-copilot-tool-output-sh880g.txt`, lines 12-68.
[^11]: GitHub Docs, "Custom agents configuration", processing and MCP sections, `/var/folders/x0/2_2cw45n6119s1_3fwg6j49c0000gn/T/1777266719801-copilot-tool-output-sh880g.txt`, lines 69-195.
[^12]: GitHub Docs, "About custom agents", https://docs.github.com/en/copilot/concepts/agents/copilot-cli/about-custom-agents.
[^13]: GitHub Docs, "Comparing GitHub Copilot CLI customization features", `/var/folders/x0/2_2cw45n6119s1_3fwg6j49c0000gn/T/1777266729415-copilot-tool-output-iqa6oe.txt`, lines 7-43, 90-163, and 206-230.
[^14]: GitHub Docs, "Delegate tasks to Copilot cloud agent", https://docs.github.com/en/copilot/how-tos/copilot-cli/use-copilot-cli-agents/delegate-tasks-to-cca.
[^15]: GitHub Docs, "About GitHub Copilot cloud agent", `/var/folders/x0/2_2cw45n6119s1_3fwg6j49c0000gn/T/1777266693219-copilot-tool-output-8dgfhq.txt`, lines 15-51 and 67-77.
[^16]: Copilot SDK feature index and agent loop docs, `/Users/pakbaz/.copilot/session-state/71edabe5-c2c5-40fd-b9b2-5ff64e85ea09/research/sources/copilot-sdk/docs/features/index.md`, lines 7-19; `/Users/pakbaz/.copilot/session-state/71edabe5-c2c5-40fd-b9b2-5ff64e85ea09/research/sources/copilot-sdk/docs/features/agent-loop.md`, lines 5-40 and 97-118.
[^17]: Copilot SDK agent loop docs, `/Users/pakbaz/.copilot/session-state/71edabe5-c2c5-40fd-b9b2-5ff64e85ea09/research/sources/copilot-sdk/docs/features/agent-loop.md`, lines 126-153 and 173-175.
[^18]: Copilot SDK custom agents docs, `/Users/pakbaz/.copilot/session-state/71edabe5-c2c5-40fd-b9b2-5ff64e85ea09/research/sources/copilot-sdk/docs/features/custom-agents.md`, lines 1-8 and 26-59.
[^19]: Copilot SDK custom agents docs, subagent delegation and event types, `/Users/pakbaz/.copilot/session-state/71edabe5-c2c5-40fd-b9b2-5ff64e85ea09/research/sources/copilot-sdk/docs/features/custom-agents.md`, lines 408-445.
[^20]: Copilot SDK custom agents docs, agent tree and tool scoping, `/Users/pakbaz/.copilot/session-state/71edabe5-c2c5-40fd-b9b2-5ff64e85ea09/research/sources/copilot-sdk/docs/features/custom-agents.md`, lines 681-800.
[^21]: Copilot SDK hooks and MCP docs, `/Users/pakbaz/.copilot/session-state/71edabe5-c2c5-40fd-b9b2-5ff64e85ea09/research/sources/copilot-sdk/docs/features/hooks.md`, lines 1-31 and 230-257; `/Users/pakbaz/.copilot/session-state/71edabe5-c2c5-40fd-b9b2-5ff64e85ea09/research/sources/copilot-sdk/docs/features/mcp.md`, lines 1-25 and 156-195.
[^22]: Copilot SDK session persistence docs, `/Users/pakbaz/.copilot/session-state/71edabe5-c2c5-40fd-b9b2-5ff64e85ea09/research/sources/copilot-sdk/docs/features/session-persistence.md`, lines 5-24 and 129-155.
[^23]: Copilot SDK TypeScript types, session and custom-agent configuration, `/Users/pakbaz/.copilot/session-state/71edabe5-c2c5-40fd-b9b2-5ff64e85ea09/research/sources/copilot-sdk/nodejs/src/types.ts`, lines 1084-1141 and 1299-1334.
[^24]: Copilot SDK streaming events docs, `/Users/pakbaz/.copilot/session-state/71edabe5-c2c5-40fd-b9b2-5ff64e85ea09/research/sources/copilot-sdk/docs/features/streaming-events.md`, lines 1-62.
[^25]: Squad README, `/Users/pakbaz/.copilot/session-state/71edabe5-c2c5-40fd-b9b2-5ff64e85ea09/research/sources/squad/README.md`, lines 1-22 and 54-60.
[^26]: Squad README, Ralph watch mode, `/Users/pakbaz/.copilot/session-state/71edabe5-c2c5-40fd-b9b2-5ff64e85ea09/research/sources/squad/README.md`, lines 124-178 and 206-230.
[^27]: Squad agent template, coordinator identity and dispatch mechanism, `/Users/pakbaz/.copilot/session-state/71edabe5-c2c5-40fd-b9b2-5ff64e85ea09/research/sources/squad/.squad-templates/squad.agent.md`, lines 8-23 and 97-108.
[^28]: Squad agent template, response modes, `/Users/pakbaz/.copilot/session-state/71edabe5-c2c5-40fd-b9b2-5ff64e85ea09/research/sources/squad/.squad-templates/squad.agent.md`, lines 283-353.
[^29]: Squad agent template, client compatibility, `/Users/pakbaz/.copilot/session-state/71edabe5-c2c5-40fd-b9b2-5ff64e85ea09/research/sources/squad/.squad-templates/squad.agent.md`, lines 455-493.
[^30]: Squad coordinator source, `/Users/pakbaz/.copilot/session-state/71edabe5-c2c5-40fd-b9b2-5ff64e85ea09/research/sources/squad/packages/squad-sdk/src/coordinator/coordinator.ts`, lines 72-80, 121-169, and 228-245.
[^31]: Squad fan-out source, `/Users/pakbaz/.copilot/session-state/71edabe5-c2c5-40fd-b9b2-5ff64e85ea09/research/sources/squad/packages/squad-sdk/src/coordinator/fan-out.ts`, lines 64-86, 105-178, and 212-239.
[^32]: Squad session pool source, `/Users/pakbaz/.copilot/session-state/71edabe5-c2c5-40fd-b9b2-5ff64e85ea09/research/sources/squad/packages/squad-sdk/src/client/session-pool.ts`, lines 20-35, 69-83, 117-143, and 145-196.
[^33]: GitHub Docs, "Best practices for GitHub Copilot CLI", plan mode section, `/var/folders/x0/2_2cw45n6119s1_3fwg6j49c0000gn/T/1777266729434-copilot-tool-output-4mntat.txt`, lines 117-139 and 165-202.
[^34]: GitHub Docs, "Best practices for GitHub Copilot CLI", infinite sessions section, `/var/folders/x0/2_2cw45n6119s1_3fwg6j49c0000gn/T/1777266729434-copilot-tool-output-4mntat.txt`, lines 203-258.
[^35]: GitHub Docs, "Best practices for GitHub Copilot CLI", permissions and provider sections, `/var/folders/x0/2_2cw45n6119s1_3fwg6j49c0000gn/T/1777266729434-copilot-tool-output-4mntat.txt`, lines 58-80 and 103-114.
[^37]: Squad execute capability source, `/Users/pakbaz/.copilot/session-state/71edabe5-c2c5-40fd-b9b2-5ff64e85ea09/research/sources/squad/packages/squad-cli/src/cli/commands/watch/capabilities/execute.ts`, lines 21-46, 79-96, 109-143, and 145-238.
[^38]: Squad fleet-dispatch source, `/Users/pakbaz/.copilot/session-state/71edabe5-c2c5-40fd-b9b2-5ff64e85ea09/research/sources/squad/packages/squad-cli/src/cli/commands/watch/capabilities/fleet-dispatch.ts`, lines 1-9, 37-58, 61-97, and 116-172.
[^39]: Squad wave-dispatch source, `/Users/pakbaz/.copilot/session-state/71edabe5-c2c5-40fd-b9b2-5ff64e85ea09/research/sources/squad/packages/squad-cli/src/cli/commands/watch/capabilities/wave-dispatch.ts`, lines 13-35 and 80-140.
