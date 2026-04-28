# GitHub Copilot SDK Research Report

**Research date:** 2026-04-27  
**Primary repositories examined:** `github/copilot-sdk` at commit `c63feb2794786342d57936c13d28c250e723c676`; `github/copilot-sdk-java` at commit `7ab1961ec69279508cc2676212a75aa5ded3cf14`.  
**Scope:** Public SDK architecture, current status, language implementations, APIs, authentication, deployment models, feature coverage, limitations, and real-world integration patterns.

## Executive Summary

GitHub Copilot SDK is best understood as a language-specific control plane for the GitHub Copilot CLI agent runtime, not as a standalone LLM wrapper: application code creates SDK clients and sessions, the SDK starts or connects to a headless Copilot CLI process, and the CLI owns the agent loop, model calls, tool orchestration, session state, MCP integration, authentication, and event stream over JSON-RPC.[^readme-architecture][^setup-architecture][^agent-loop-transport] The public positioning changed over time: GitHub announced the SDK as a technical preview in January 2026, while the current official docs and repository describe it as public preview with functionality subject to change and not yet guaranteed production-ready.[^github-blog-announcement][^docs-public-preview][^readme-production-caveat]

The strongest implementation finding is that the SDK gives developers programmatic access to the same execution loop that powers Copilot CLI: it can plan, invoke tools, edit files, run commands, stream events, use MCP servers, route to models, manage sessions, and resume persisted state.[^github-blog-agent-core][^features-index][^compatibility-available] The second strongest finding is that the SDK currently requires careful production hardening around permissions, CLI process lifecycle, version pinning, user/session isolation, and concurrency: the source implementations require permission handlers for session creation or resume, `sendAndWait` waits for `session.idle` rather than semantic task completion, and the scaling guidance explicitly warns that shared sessions need app-level locking because the SDK does not provide built-in session locks.[^node-create-session][^node-send-and-wait][^agent-loop-idle][^scaling-locks]

The supported language story is broad but uneven. The main `github/copilot-sdk` repository contains TypeScript/Node.js, Python, Go, and .NET SDKs, while Java lives in the separate `github/copilot-sdk-java` repository.[^readme-languages][^java-readme-status] Registry metadata observed during this research lists `@github/copilot-sdk` latest `0.3.0`, PyPI `github-copilot-sdk` latest `0.3.0`, NuGet `GitHub.Copilot.SDK` latest `0.3.0`, and Maven Central `com.github:copilot-sdk-java` latest `0.3.0-java.2`.[^npm-registry][^pypi-registry][^nuget-registry][^maven-central] For implementation work, treat the repository source and package registry metadata as the authority when docs conflict: for example, a GitHub Docs Node tutorial says Node.js 18+, while the current Node package declares `node >=20.0.0`; some docs snippets omit the required permission handler, while current source and package docs say it is required.[^docs-node18][^node-engine][^node-create-session][^nuget-permission-required]

## 1. What the SDK Is

The SDK is a programmable interface to Copilot CLI's agentic runtime. The official repository describes it as "Agents for every app," available in public preview across Python, TypeScript/Node.js, Go, .NET, and Java, and powered by the same engine behind GitHub Copilot CLI.[^readme-status] The GitHub announcement frames the value proposition as avoiding the need to build a planner, tool loop, runtime, model routing, MCP integration, permission system, and session manager from scratch.[^github-blog-agent-core] In practical terms, the SDK lets an application instantiate a `CopilotClient`, create or resume a `CopilotSession`, send prompts, subscribe to events, register custom tools and permission handlers, and let the CLI agent loop execute until it emits lifecycle events such as `session.idle`.[^getting-started-send][^node-session-api][^streaming-events]

The architecture is intentionally split. The language SDKs are thin-ish clients; the Copilot CLI process is the durable orchestrator. The README states that the app connects to a Copilot CLI server over JSON-RPC, that the SDK can start the CLI server or connect to an existing one, and that the CLI handles the "agent loop" including model interaction, tool calls, and session state.[^readme-architecture] The setup docs make the same point with a more explicit transport framing: SDKs communicate with the CLI server over JSON-RPC via stdio or TCP, while the CLI handles authentication, model calls, tools, MCP, sessions, and event emission.[^setup-architecture]

This matters because the SDK inherits both the power and constraints of Copilot CLI. Developers get a production-tested agent loop, model management, GitHub authentication, custom tools, MCP servers, custom agents, chat sessions, and streaming without implementing all of that themselves.[^github-blog-agent-core] Developers also inherit CLI-specific compatibility boundaries: not every TUI feature is available through the SDK because SDK capability must be explicitly exposed through the JSON-RPC protocol.[^compatibility-boundary]

### Architecture at a Glance

```text
Application / product code
  |
  | language SDK API
  |   CopilotClient, CopilotSession, SessionConfig, MessageOptions
  v
Language SDK package
  |
  | JSON-RPC over stdio or TCP
  v
Copilot CLI server/headless process
  |
  | owns the agent loop
  | - model routing / provider calls
  | - planning and tool-use loop
  | - MCP servers and custom tools
  | - permission requests
  | - session persistence and events
  v
GitHub Copilot service or BYOK provider + local/runtime tools
```

The app is responsible for UX, product policy, user/session boundaries, permission decisions, and any domain-specific tools it exposes.[^agent-loop-responsibilities] The CLI is responsible for the loop that repeatedly calls the model, evaluates tool calls, requests permissions, executes approved tools, updates conversation history, and emits events.[^agent-loop-tool-loop] The SDK is the typed transport and convenience layer that maps language-native objects to the JSON-RPC protocol and maps protocol events back to language-native events and callbacks.[^agent-loop-transport]

## 2. Current Status, Packages, and Compatibility

The current official docs say GitHub Copilot SDK is available with all Copilot plans and is in public preview, with functionality and availability subject to change.[^docs-public-preview] The repository README also states the SDK is in public preview and warns that, in this phase, GitHub does not recommend relying on the SDK for production applications that require API stability, because breaking changes may happen before general availability.[^readme-production-caveat] GitHub's January 2026 announcement used "technical preview" language and described the SDK as a way to embed the same agentic core that powers Copilot CLI in any application.[^github-blog-announcement]

| SDK | Package / module | Observed public package status | Runtime notes | CLI bundling / dependency |
|---|---:|---:|---|---|
| TypeScript / Node.js | `@github/copilot-sdk` | npm `latest` = `0.3.0` | Current repo package declares Node `>=20.0.0`; docs tutorial says Node 18+, so package metadata should win for implementation planning.[^npm-registry][^node-engine][^docs-node18] | Bundles/depends on `@github/copilot`; SDK can resolve and start the bundled CLI.[^node-package-deps][^node-resolve-cli][^bundled-cli] |
| Python | `github-copilot-sdk` / `copilot` | PyPI latest = `0.3.0`, Python `>=3.11` | Async/await-native client and sessions; repo `pyproject.toml` declares Python `>=3.11`.[^pypi-registry][^python-pyproject] | Bundled CLI wheels are described in setup docs and build metadata.[^bundled-cli][^python-pyproject] |
| Go | `github.com/github/copilot-sdk/go` | Go module in main repo | Current `go.mod` says `go 1.24`; getting-started docs say Go 1.21+.[^go-mod][^getting-started-prereqs] | Does not bundle the Copilot CLI; user/app must provide a local CLI path.[^bundled-cli-go] |
| .NET | `GitHub.Copilot.SDK` | NuGet latest list includes `0.3.0` | .NET SDK package docs show async client/session APIs and required `OnPermissionRequest`.[^nuget-registry][^nuget-permission-required] | Setup docs describe .NET as one of the SDKs that includes a bundled CLI.[^bundled-cli] |
| Java | `com.github:copilot-sdk-java` | Maven Central latest = `0.3.0-java.2`; repo snapshot is `0.3.1-java.1-SNAPSHOT` | Java 17+; separate repo tracks the official .NET/Node reference implementations.[^maven-central][^java-pom][^java-readme-status] | Java does not bundle the CLI and requires a CLI path, `COPILOT_CLI_PATH`, or PATH entry.[^java-cli-required][^bundled-cli-java] |

Two compatibility caveats are important enough to influence adoption plans. First, docs and source are not perfectly synchronized in preview. The official GitHub Docs Node getting-started page omits `onPermissionRequest` in the first `createSession` sample, but the current TypeScript source throws if `config.onPermissionRequest` is missing, and current .NET package docs explicitly mark `OnPermissionRequest` as required.[^docs-getting-started-omits-permission][^node-create-session][^nuget-permission-required] Second, preview package versions can be generated or overwritten during publishing: for example, the current Node source package file says `0.1.8`, while the npm registry reports `0.3.0` as latest, and the Node `package` script calls a `set-version.js` publishing step.[^node-package-version][^npm-registry][^node-package-script]

## 3. Core API Concepts

### `CopilotClient`

`CopilotClient` is the SDK object that owns process/connection lifecycle. In Node, the constructor validates mutually exclusive options such as `cliUrl`, `cliPath`, `githubToken`, and logged-in-user behavior; sets defaults; and prepares the client to either spawn a CLI process or connect to an existing server.[^node-client-constructor] The Node `start()` implementation starts or connects to the CLI, verifies protocol compatibility, and registers session filesystem handlers.[^node-client-start] The Node `stop()` implementation cleans up sessions, JSON-RPC connections, sockets, processes, and caches.[^node-client-stop] Similar lifecycle APIs exist in Python, Go, .NET, and Java, with language-appropriate async patterns.[^python-client][^go-client][^dotnet-client][^java-client]

The client also owns higher-level service methods such as `createSession`, `resumeSession`, `listModels`, auth/status checks, foreground session APIs, and lifecycle event subscriptions.[^node-client-create-session][^node-client-resume-session][^node-list-models][^nuget-client-docs] `listModels()` is particularly important for production because model availability and supported options such as reasoning effort can vary by account, provider, and time; the Node implementation caches model lists and uses a lock/custom handler path.[^node-list-models]

### `CopilotSession`

`CopilotSession` represents one conversation/workspace. It supports sending messages, waiting for responses, subscribing to typed or wildcard events, dispatching inbound tool calls, dispatching permission requests, retrieving messages, disconnecting, and in some SDKs aborting active work.[^node-session-api][^node-session-events][^node-tool-dispatch][^nuget-session-docs] In Node, `send()` is the low-level message send, while `sendAndWait()` sends a message and resolves when the session becomes idle, tracking the last assistant message and rejecting on session errors or timeout.[^node-send][^node-send-and-wait]

The semantic distinction between "idle" and "task complete" is not cosmetic. The agent-loop docs state that `sendAndWait()` waits for `session.idle`, not for `session.task_complete`; `session.idle` means the session is ready for the next message, while task completion is an assistant-level signal with different semantics.[^agent-loop-idle] Applications that need stronger completion criteria should listen for and interpret additional events, enforce timeouts, or add domain-specific output validation instead of assuming `sendAndWait()` means the agent achieved the user's business goal.

### `SessionConfig`

`SessionConfig` is the main policy and capability surface. The TypeScript `SessionConfig` type includes fields for session ID, client name, model, reasoning effort, config discovery, custom tools and commands, system message, available or excluded tools, provider/BYOK settings, required permission handler, user-input handler, elicitation handler, hooks, working directory, streaming, MCP servers, custom agents, skills, infinite sessions, per-session GitHub token, event handler, and session filesystem handler.[^node-session-config] The breadth of this type shows that the SDK is not only a chat API; it is a runtime embedding API.

In preview, the most important configuration field is the permission handler. The current Node implementation checks `config.onPermissionRequest` and throws if it is absent before it creates a session.[^node-create-session] Go and Java also require an `OnPermissionRequest` / permission handler for session creation, and Conductor's production-oriented provider has a dedicated default handler because "the SDK requires a permission handler on session creation."[^go-create-session][^java-create-session][^conductor-permission-handler] For prototypes, SDKs expose "approve all" helpers; for production, those helpers should only be used when the app already constrains tools and inputs tightly enough that automatic approval is safe.[^node-permission-types][^compatibility-permissions][^conductor-permission-handler]

### `MessageOptions`, Attachments, and Delivery Modes

Messages are sent through language-specific equivalents of `MessageOptions`. In TypeScript, the type covers prompt text, attachments, and delivery options such as enqueueing or immediate steering.[^node-message-options] The feature docs include image input and steering/queueing as SDK capabilities, which means apps can support richer interactions than single-turn text prompts.[^features-index] For long-running or interactive applications, event subscriptions are more robust than relying solely on returned assistant message content because tool activity, reasoning, streaming deltas, usage, errors, and lifecycle state are available as events.[^streaming-events][^node-session-events]

### Events

Session events are the SDK's operational backbone. The streaming docs describe a session event envelope with typed event names and data payloads, and they distinguish persisted conversation events from ephemeral runtime events.[^streaming-events] The feature docs also note language typing differences: strongly typed SDKs such as .NET and Java expose event classes, while JavaScript and Python expose more dynamic shapes.[^streaming-language-types] Official chat samples across Node, Python, Go, and .NET listen for `assistant.reasoning` and `tool.execution_start` to display intermediate progress, then call `sendAndWait()` for each user prompt.[^node-chat-sample][^python-chat-sample][^go-chat-sample][^dotnet-chat-sample]

### Tools and Permissions

Custom tools let application code expose domain operations to the Copilot agent. The TypeScript SDK defines a `Tool<TArgs>` shape with a name, description, parameter schema, handler, optional override behavior, and permission-skipping flag; `defineTool` wraps the definition into a reusable typed tool.[^node-tool-types] Java exposes a parallel `ToolDefinition` with factories for normal, override, and skip-permission tools.[^java-tool-definition] The Node session implementation handles inbound tool execution requests and returns tool results over JSON-RPC.[^node-tool-dispatch] Java's `RpcHandlerDispatcher` similarly registers JSON-RPC handlers, dispatches tool calls, and handles permission requests.[^java-rpc-dispatch]

The permission model is intentionally explicit. The compatibility docs describe an SDK deny-by-default permission model and direct developers to use permission handlers.[^compatibility-permissions] This is also visible in source: the SDK calls the configured permission handler, falls back only through defined SDK behavior, and rejects missing required handlers at session creation in the current TypeScript implementation.[^node-permission-dispatch][^node-create-session] The practical conclusion is simple: define permissions as product policy, not as an afterthought. Treat `approveAll` as a development shortcut or a safe internal-orchestration shortcut only when upstream policy constrains tool availability, as Conductor does by approving all because the workflow author controls the available tools.[^conductor-permission-handler]

## 4. Language-Specific Implementation Findings

### TypeScript / Node.js

The Node SDK is the most revealing reference implementation because it includes public types, process management, session management, tool dispatch, and event handling in one package. Its `package.json` declares the package name `@github/copilot-sdk`, an ESM/CJS export map, a TypeScript SDK description, runtime dependency on `@github/copilot`, `vscode-jsonrpc`, and `zod`, and a Node engine requirement of `>=20.0.0`.[^node-package][^node-package-deps][^node-engine] The client resolves the bundled CLI path from the `@github/copilot` dependency, which is the mechanism behind the "bundled CLI" setup path for Node.[^node-resolve-cli][^bundled-cli]

The constructor validates conflicting configuration and authentication combinations before any subprocess is launched, which is critical because `cliUrl`, `cliPath`, GitHub token auth, and logged-in-user behavior imply different trust and lifecycle models.[^node-client-constructor] The startup path either starts the CLI or connects to it, verifies protocol version compatibility, and registers session filesystem handling.[^node-client-start][^node-protocol] The spawn path uses headless CLI flags such as `--headless`, `--no-auto-update`, and stdio or TCP server options, plus auth and telemetry environment setup.[^node-spawn] This confirms that Node apps embedding the SDK are embedding or connecting to a CLI server, not linking directly to a model client.

Node's session code is also the cleanest description of operational semantics. `sendAndWait()` installs event listeners, sends a prompt, waits for `session.idle`, tracks the last assistant message, and rejects on session error or timeout.[^node-send-and-wait] `on()` supports both typed event subscriptions and wildcard subscriptions.[^node-session-events] Event dispatch routes internal broadcast events, tool execution requests, and permission requests back to app-registered handlers.[^node-event-dispatch][^node-tool-dispatch][^node-permission-dispatch]

### Python

The Python SDK exposes both `SubprocessConfig` and `ExternalServerConfig`, matching the same split between local child-process CLI and existing CLI server deployments.[^python-configs] The `CopilotClient` implementation includes async `start`, `create_session`, and `list_models` flows, while `CopilotSession` includes async `send_and_wait` and event subscription.[^python-client][^python-session] Python package metadata requires Python `>=3.11`, and the PyPI registry page for version `0.3.0` describes the SDK as public preview, async/await native, type-hinted, and supporting stdio/TCP transports, streaming events, and session history.[^python-pyproject][^pypi-registry]

Python is currently the most visible SDK in real-world orchestration examples. Microsoft's Conductor project depends on `github-copilot-sdk>=0.2.2`, imports `CopilotClient` and `PermissionHandler`, lazily starts one client behind an async lock, creates sessions with model, working directory, permission handler, and MCP server configuration, captures session IDs for checkpoint persistence, resumes previous sessions when possible, listens to SDK events, captures usage events, and layers idle recovery and structured-output recovery around the SDK.[^conductor-dependency][^conductor-imports][^conductor-session-create][^conductor-send-wait][^conductor-start-lock] This is a useful blueprint for production adoption because it shows the SDK wrapped with retries, output validation, session persistence, human interruption, and observability rather than used as a bare `send_and_wait()` call.

### Go

The Go SDK has a conventional module path, `github.com/github/copilot-sdk/go`, and the current module file declares `go 1.24`.[^go-mod] Its client options include CLI path/URL, transport and telemetry settings, authentication-related options, and session configuration types such as system messages and permission results.[^go-types] `NewClient` validates options and defaults, `Start` establishes the CLI connection, `Stop` cleans up, and `CreateSession` maps Go config into the JSON-RPC request while requiring `OnPermissionRequest`.[^go-client][^go-start-stop][^go-create-session] The Go `Session` type is documented in source as safe for concurrent use, with explicit `Send`, `SendAndWait`, `On`, tool registration, and permission handler registration flows.[^go-session]

Go differs operationally from Node/Python/.NET because the setup docs say the Go SDK does not bundle the Copilot CLI.[^bundled-cli-go] Official Go samples therefore pass a `CLIPath` explicitly and use `PermissionHandler.ApproveAll` in sample sessions.[^go-chat-sample] For teams building Go services, this means deployment packaging must provision a compatible CLI binary separately and verify compatibility at service startup.

### .NET

The .NET SDK follows idiomatic async disposable patterns. Its source includes `CopilotClient` fields and RPC handling, constructor validation, `StartAsync`, `CreateSessionAsync`, and `ListModelsAsync`; `CopilotSession` includes event channels, workspace/capability state, `SendAsync`, and `SendAndWaitAsync`.[^dotnet-client][^dotnet-session] Package metadata and NuGet docs describe the SDK as programmatic control of GitHub Copilot CLI, public preview, and show `OnPermissionRequest = PermissionHandler.ApproveAll` as required in session creation.[^nuget-package][^nuget-permission-required]

The .NET project also reveals packaging choices: it marks the package as AOT-compatible, includes package tags for `github`, `copilot`, `sdk`, `jsonrpc`, and `agent`, and generates props based on the bundled Copilot CLI version read from the Node package lock.[^dotnet-csproj] This supports the repository documentation that .NET is one of the SDKs with a bundled CLI path.[^bundled-cli]

### Java

Java is maintained in a separate official repository, `github/copilot-sdk-java`, and the README says it is a public-preview Java SDK that tracks the official .NET and Node reference implementations.[^java-readme-status] It requires Java 17+ and Copilot CLI 1.0.17+ installed in PATH, configured via `COPILOT_CLI_PATH`, or passed through a custom CLI path.[^java-cli-required] Maven Central publishes `com.github:copilot-sdk-java` at `0.3.0-java.2`, while the cloned repo's `pom.xml` shows the current development version as `0.3.1-java.1-SNAPSHOT`.[^maven-central][^java-pom]

The Java implementation mirrors the same client/session model. `CopilotClient` validates constructor options, starts the CLI connection, verifies protocol compatibility, creates sessions, and resumes sessions.[^java-client] `CopilotSession` stores session fields, sends messages, implements `sendAndWait`, and supports typed event subscriptions.[^java-session] `ToolDefinition` models custom tools, and `RpcHandlerDispatcher` handles inbound JSON-RPC calls for tool invocation and permission handling.[^java-tool-definition][^java-rpc-dispatch] The Java README also documents an automated sync strategy: it tracks upstream reference implementation changes with a `.lastmerge` file and runs against the official test harness, which is strong evidence that Java is intended to stay behaviorally aligned despite living in a separate repo.[^java-sync]

## 5. Authentication, Billing, and BYOK

The default Copilot path uses a GitHub account with Copilot entitlement. The README says a Copilot subscription is required unless you use Bring Your Own Key (BYOK), and it distinguishes Copilot-billed usage from BYOK provider-billed usage.[^readme-auth-billing] Official authentication docs list multiple modes: signed-in user through the CLI/device flow/keychain, OAuth app token flow, environment variable token auth, and BYOK/custom provider configuration.[^auth-methods][^auth-signed-in][^auth-oauth][^auth-env-vars]

Token support is narrower than "any GitHub token." The auth docs specify supported token prefixes such as `gho_`, `ghu_`, and fine-grained `github_pat_`, and state that classic `ghp_` PATs are not supported.[^auth-token-types] Environment variable priority is also defined: `COPILOT_GITHUB_TOKEN` is checked before `GH_TOKEN`, which is checked before `GITHUB_TOKEN`.[^auth-env-vars] Backend services should make this token strategy explicit because a wrong token type can fail authentication even if the token works for other GitHub APIs.

BYOK changes the trust and billing model. The BYOK docs state that BYOK bypasses GitHub Copilot authentication using the developer's own provider API keys, and they list support for OpenAI, Azure OpenAI, Anthropic, and OpenAI-compatible providers.[^byok-overview][^byok-providers] The TypeScript `ProviderConfig` type includes provider `type`, wire API shape, base URL, API key or bearer token, Azure API version, and custom headers.[^node-provider-config] This makes BYOK attractive for internal deployments that already standardize on Azure OpenAI, OpenAI-compatible gateways, or Anthropic, but it also means the app owner must own provider key management, model availability, rate limiting, and billing controls.

## 6. Deployment and Scaling Patterns

The setup docs define several deployment modes rather than one canonical mode. A local CLI setup uses an already installed and authenticated CLI, which is simplest for developer tools but makes the app responsible for local CLI compatibility.[^local-cli] A bundled CLI setup packages Copilot CLI with the application so users do not need to separately install or authenticate a compatible CLI, and the docs specifically say Node.js, Python, and .NET include Copilot CLI while Go and Java do not.[^bundled-cli][^bundled-cli-go][^bundled-cli-java] A backend service setup runs a persistent headless CLI server and has SDK clients connect through `cliUrl`, which is more appropriate for APIs, workers, and multi-user services.[^backend-services]

For server-side systems, the most important design question is isolation. The scaling docs describe three dimensions: process isolation, session isolation, and persistence.[^scaling-dimensions] The most isolated pattern runs one CLI process per user or tenant.[^scaling-isolated] A more resource-efficient pattern shares one CLI server while keeping sessions separate.[^scaling-shared-cli] The riskiest pattern shares sessions, and the docs explicitly say shared sessions need app-level locking because the SDK does not provide built-in session locking.[^scaling-locks] This is not an edge case: any app that sends multiple messages to the same session concurrently can create ordering and policy bugs unless it serializes access.

Session persistence is a first-class feature. The docs explain that sessions can be identified with custom session IDs, stored, resumed, and associated with workspace state.[^session-persistence] Local CLI setup docs place session storage under `~/.copilot/session-state/{sessionId}/`, and the session-persistence docs describe resume options for restoring conversations across restarts.[^local-session-storage][^session-resume] Conductor's provider captures Copilot session IDs after session creation, stores them in workflow checkpoints, and attempts resume before creating a new session, which shows how this feature can support durable orchestration.[^conductor-session-create]

## 7. Feature Coverage

Official feature docs list agent loop semantics, hooks, custom agents, MCP, skills, image input, streaming events, steering/queueing, and session persistence.[^features-index] Custom agents are named definitions with their own prompts, tool restrictions, and MCP configuration, and the runtime can delegate work to them as sub-agents.[^custom-agents] MCP support covers local stdio and HTTP/SSE server types, with configuration options for command, arguments, environment, and URL-based servers.[^mcp-overview][^mcp-config] Hooks let applications run custom logic at session lifecycle points, and the hooks docs list hook types and optional behavior.[^hooks-overview] Streaming events include session lifecycle, assistant message and delta events, tool execution, usage, error, and other runtime events.[^streaming-events]

The SDK's feature set is therefore broad enough for several application categories: interactive developer GUIs, background automation, multi-agent orchestration, CI/CD agents, internal knowledge tools, domain-specific copilots, and agent-backed workflows that need local commands or file editing.[^github-blog-examples][^techcommunity-case-study][^conductor-readme] The official GitHub blog lists internal examples such as YouTube chapter generators, custom GUIs for agents, speech-to-command desktop workflows, AI games, and summarization tools.[^github-blog-examples] Microsoft's Tech Community article describes an automated project-update tracker built with Copilot SDK and CLI, GitHub Actions, custom Copilot skills, and scheduled blog generation, although its code snippets should be treated as illustrative because they do not reflect the current required permission-handler pattern.[^techcommunity-case-study][^node-create-session]

## 8. Limitations, Risks, and Mismatches

The largest limitation is preview instability. Both GitHub Docs and the repository state that the SDK is in public preview and may change, and the repository README adds that production applications requiring API stability should not rely on it yet.[^docs-public-preview][^readme-production-caveat] This does not make the SDK unusable; it means production adopters should pin SDK and CLI versions, wrap the SDK behind their own adapter, test protocol compatibility at startup, and budget for breaking changes before GA.

The second limitation is feature parity. The compatibility docs state that SDK features require explicit JSON-RPC protocol exposure, so many TUI features remain CLI-only.[^compatibility-boundary] The same compatibility page distinguishes available SDK capabilities from unavailable CLI-only capabilities and describes the SDK permission model as deny-by-default.[^compatibility-available][^compatibility-unavailable][^compatibility-permissions] Any roadmap that assumes "everything the CLI can do is instantly callable from SDK code" is too optimistic.

The third limitation is documentation drift. The GitHub Docs getting-started page says Node.js 18+ and omits `onPermissionRequest` in TypeScript examples; current Node package metadata requires Node `>=20.0.0`, and current source requires `onPermissionRequest` for `createSession()`.[^docs-node18][^node-engine][^docs-getting-started-omits-permission][^node-create-session] The top-level repository getting-started guide says Go 1.21+, while current `go.mod` says Go 1.24.[^getting-started-prereqs][^go-mod] These are manageable preview issues, but teams should validate with the exact package version they intend to deploy rather than blindly copying docs snippets.

The fourth limitation is operational ownership. The SDK will start or connect to a CLI, but application owners still need to design authentication flows, multi-user isolation, session locking, permission policy, observability, retries, structured output validation, and cleanup.[^setup-decision-matrix][^scaling-locks][^conductor-send-wait] Conductor's implementation is instructive because it adds retries, idle recovery, output parsing recovery, session checkpointing, and event forwarding around SDK calls.[^conductor-send-wait][^conductor-session-create]

## 9. Practical Integration Guidance

For prototypes, the fastest path is a local or bundled CLI, a single session per user interaction, `approveAll` for a constrained tool set, and event logging for `assistant.reasoning`, `tool.execution_start`, `assistant.message`, `assistant.usage`, `session.idle`, and `session.error`.[^node-chat-sample][^python-chat-sample][^dotnet-chat-sample][^streaming-events] For production, the safer pattern is to create an internal adapter around the SDK, require explicit permission policy, keep user/tenant sessions isolated, serialize access to shared sessions, pin package and CLI versions, run `listModels()` at startup or per tenant, and add explicit timeouts and output validation.[^node-list-models][^scaling-locks][^compatibility-permissions][^conductor-send-wait]

For backend services, prefer `cliUrl` and a managed headless CLI server when many workers need to share a runtime, but prefer isolated CLI processes where tenant isolation or blast-radius reduction matters more than process overhead.[^backend-services][^scaling-isolated][^scaling-shared-cli] For Go and Java, explicitly package or provision the CLI because those SDKs do not bundle it.[^bundled-cli-go][^bundled-cli-java] For Node/Python/.NET, decide whether to use the bundled CLI for easier distribution or a local/external CLI for more explicit lifecycle control.[^bundled-cli][^local-cli][^backend-services]

For tool design, expose narrow, deterministic tools with JSON schemas, avoid high-power shell/file tools unless the user explicitly intends agentic execution, and use permission handlers to apply context-sensitive policy.[^node-tool-types][^java-tool-definition][^compatibility-permissions] If using MCP servers, classify them by trust boundary and failure mode because the SDK can surface MCP tools but your app still owns which servers are configured and which users can access them.[^mcp-overview][^mcp-config] If using BYOK, model/provider configuration should be treated as secrets-bearing production configuration rather than casual request parameters.[^byok-overview][^node-provider-config]

## 10. Confidence Assessment

Confidence is high for the architecture, API shape, language support, permission-handler requirement, `session.idle` semantics, and deployment patterns because those claims are supported by both official docs and current source code across multiple language implementations.[^readme-architecture][^setup-architecture][^node-create-session][^agent-loop-idle][^scaling-locks] Confidence is medium for exact package-version implications because registry metadata and repository source versions differ during preview publishing, although the current public registry values are directly cited.[^npm-registry][^pypi-registry][^nuget-registry][^maven-central] Confidence is medium for third-party usage patterns because public examples and blog posts demonstrate real integrations, but some snippets lag current API requirements and should not be copied without checking the current package docs and source.[^techcommunity-case-study][^conductor-session-create][^node-create-session]

The bottom-line recommendation is to use GitHub Copilot SDK when you want to embed Copilot CLI's agentic runtime into an application and are willing to own preview-version risk, process lifecycle, and product-level safety policy. Do not treat it as a generic chat-completion SDK; treat it as an embedded agent runtime with powerful tool execution, persistent state, and explicit permission boundaries.[^github-blog-agent-core][^agent-loop-responsibilities][^compatibility-permissions]

## Appendix A: Source Quality and Methodology

This report prioritized official GitHub repositories, official GitHub Docs, package registries, and source-code inspection. The main source repository was cloned locally at `github/copilot-sdk` commit `c63feb2794786342d57936c13d28c250e723c676`, and the Java repository was cloned at `github/copilot-sdk-java` commit `7ab1961ec69279508cc2676212a75aa5ded3cf14`. Public package registry metadata was checked for npm, PyPI, NuGet, and Maven Central. Public integration examples were reviewed from GitHub's blog, Microsoft Tech Community, `github/awesome-copilot`, and Microsoft's `conductor` repository.

Source confidence tiers:

| Tier | Sources | How used |
|---|---|---|
| Highest | Current source in `github/copilot-sdk` and `github/copilot-sdk-java` | API requirements, lifecycle behavior, language implementation details, permission handling, process management |
| High | Official GitHub Docs and repository docs | Public status, setup paths, auth modes, feature descriptions, deployment guidance |
| High | Package registries | Current public package names and latest observed versions |
| Medium | GitHub blog and Microsoft Tech Community | Positioning, examples, use cases, launch timeline, practical case studies |
| Medium | Microsoft Conductor source | Real-world wrapping pattern around Python SDK, retries, idle recovery, checkpointed sessions |

## Footnotes

[^readme-architecture]: `github/copilot-sdk` README, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 42-54. Describes SDK-to-CLI JSON-RPC architecture and CLI server lifecycle. URL: https://github.com/github/copilot-sdk/blob/main/README.md

[^setup-architecture]: `github/copilot-sdk/docs/setup/index.md`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 5-30. Describes architecture at a glance, JSON-RPC stdio/TCP, and CLI internals. URL: https://github.com/github/copilot-sdk/blob/main/docs/setup/index.md

[^agent-loop-transport]: `github/copilot-sdk/docs/features/agent-loop.md`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 5-18. Describes SDK as transport layer and CLI as orchestrator. URL: https://github.com/github/copilot-sdk/blob/main/docs/features/agent-loop.md

[^github-blog-announcement]: GitHub Blog, "Build an agent into any app with the GitHub Copilot SDK," published 2026-01-22 and updated 2026-01-23. Describes technical preview and programmable agent layer. URL: https://github.blog/news-insights/company-news/build-an-agent-into-any-app-with-the-github-copilot-sdk/

[^docs-public-preview]: GitHub Docs, "Getting started with Copilot SDK." States Copilot SDK is available with all Copilot plans and currently in public preview, with functionality and availability subject to change. URL: https://docs.github.com/en/copilot/how-tos/copilot-sdk/sdk-getting-started

[^readme-production-caveat]: `github/copilot-sdk` README, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 109-115. Describes models and public preview production-readiness caveat. URL: https://github.com/github/copilot-sdk/blob/main/README.md

[^github-blog-agent-core]: GitHub Blog, "Build an agent into any app with the GitHub Copilot SDK." Describes embedding the same Copilot agentic core that powers Copilot CLI and reusing model management, MCP, custom agents, sessions, and streaming. URL: https://github.blog/news-insights/company-news/build-an-agent-into-any-app-with-the-github-copilot-sdk/

[^features-index]: `github/copilot-sdk/docs/features/index.md`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 7-20. Lists SDK features including agent loop, hooks, custom agents, MCP, skills, image input, streaming, steering/queueing, and persistence. URL: https://github.com/github/copilot-sdk/blob/main/docs/features/index.md

[^compatibility-available]: `github/copilot-sdk/docs/troubleshooting/compatibility.md`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 11-92. Lists SDK-available capabilities. URL: https://github.com/github/copilot-sdk/blob/main/docs/troubleshooting/compatibility.md

[^node-create-session]: `github/copilot-sdk/nodejs/src/client.ts`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 664-781. `createSession()` requires `onPermissionRequest`, auto-starts client, registers handlers/tools/hooks, and sends `session.create`. URL: https://github.com/github/copilot-sdk/blob/main/nodejs/src/client.ts

[^node-send-and-wait]: `github/copilot-sdk/nodejs/src/session.ts`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 216-269. Implements `sendAndWait()` by waiting for `session.idle`, tracking assistant message, and handling errors/timeouts. URL: https://github.com/github/copilot-sdk/blob/main/nodejs/src/session.ts

[^agent-loop-idle]: `github/copilot-sdk/docs/features/agent-loop.md`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 108-171. Distinguishes `session.idle` from `session.task_complete` and explains `sendAndWait()` idle semantics. URL: https://github.com/github/copilot-sdk/blob/main/docs/features/agent-loop.md

[^scaling-locks]: `github/copilot-sdk/docs/setup/scaling.md`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 160-196. States shared sessions need app-level locking and SDK does not provide built-in session locking. URL: https://github.com/github/copilot-sdk/blob/main/docs/setup/scaling.md

[^readme-languages]: `github/copilot-sdk` README, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 17-23. Lists available SDKs and install commands. URL: https://github.com/github/copilot-sdk/blob/main/README.md

[^java-readme-status]: `github/copilot-sdk-java` README, commit `7ab1961ec69279508cc2676212a75aa5ded3cf14`, lines 17-21. Describes Java public preview and tracking of .NET/Node reference implementations. URL: https://github.com/github/copilot-sdk-java/blob/main/README.md

[^npm-registry]: npm registry metadata for `@github/copilot-sdk`, retrieved 2026-04-27. `dist-tags.latest` observed as `0.3.0`, `unstable` as `0.2.1-unstable.0`, and `prerelease` as `0.3.0-preview.1`. URL: https://registry.npmjs.org/@github%2Fcopilot-sdk

[^pypi-registry]: PyPI JSON metadata for `github-copilot-sdk`, retrieved 2026-04-27. Version observed as `0.3.0`; classifiers include Python 3.11-3.14 and description marks public preview. URL: https://pypi.org/pypi/github-copilot-sdk/json

[^nuget-registry]: NuGet flat-container index for `GitHub.Copilot.SDK`, retrieved 2026-04-27. Version list includes `0.3.0` as latest observed entry. URL: https://api.nuget.org/v3-flatcontainer/github.copilot.sdk/index.json

[^maven-central]: Maven Central page for `com.github:copilot-sdk-java`, retrieved 2026-04-27. Shows dependency version `0.3.0-java.2`. URL: https://central.sonatype.com/artifact/com.github/copilot-sdk-java

[^docs-node18]: GitHub Docs, "Getting started with Copilot SDK." Prerequisites section says Node.js 18 or later. URL: https://docs.github.com/en/copilot/how-tos/copilot-sdk/sdk-getting-started

[^node-engine]: `github/copilot-sdk/nodejs/package.json`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 81-83. Declares Node engine `>=20.0.0`. URL: https://github.com/github/copilot-sdk/blob/main/nodejs/package.json

[^nuget-permission-required]: NuGet package page for `GitHub.Copilot.SDK`, retrieved 2026-04-27. Shows `OnPermissionRequest` as required in quick start and API docs. URL: https://www.nuget.org/packages/GitHub.Copilot.SDK/

[^readme-status]: `github/copilot-sdk` README, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 9-13. Describes "Agents for every app," public preview, languages, and same engine behind Copilot CLI. URL: https://github.com/github/copilot-sdk/blob/main/README.md

[^getting-started-send]: `github/copilot-sdk/docs/getting-started.md`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 118-286. Shows minimal send-and-wait examples across languages. URL: https://github.com/github/copilot-sdk/blob/main/docs/getting-started.md

[^node-session-api]: `github/copilot-sdk/nodejs/src/session.ts`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 78-139 and 180-191. Defines `CopilotSession` internals and `send()`. URL: https://github.com/github/copilot-sdk/blob/main/nodejs/src/session.ts

[^streaming-events]: `github/copilot-sdk/docs/features/streaming-events.md`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 1-8 and 50-61. Describes session events, streaming, ephemeral vs persisted events, and event envelope fields. URL: https://github.com/github/copilot-sdk/blob/main/docs/features/streaming-events.md

[^agent-loop-responsibilities]: `github/copilot-sdk/docs/features/agent-loop.md`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 97-106. Lists responsibilities of app, CLI, LLM, and SDK. URL: https://github.com/github/copilot-sdk/blob/main/docs/features/agent-loop.md

[^agent-loop-tool-loop]: `github/copilot-sdk/docs/features/agent-loop.md`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 19-39. Describes tool-use loop and conversation history. URL: https://github.com/github/copilot-sdk/blob/main/docs/features/agent-loop.md

[^node-package-deps]: `github/copilot-sdk/nodejs/package.json`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 58-62. Shows dependencies on `@github/copilot`, `vscode-jsonrpc`, and `zod`. URL: https://github.com/github/copilot-sdk/blob/main/nodejs/package.json

[^node-resolve-cli]: `github/copilot-sdk/nodejs/src/client.ts`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 136-168. Resolves bundled CLI path from `@github/copilot`. URL: https://github.com/github/copilot-sdk/blob/main/nodejs/src/client.ts

[^bundled-cli]: `github/copilot-sdk/docs/setup/bundled-cli.md`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 1-10 and 26-30. Explains Node.js, Python, and .NET bundled CLI behavior and SDK-managed CLI version/session startup. URL: https://github.com/github/copilot-sdk/blob/main/docs/setup/bundled-cli.md

[^python-pyproject]: `github/copilot-sdk/python/pyproject.toml`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 5-28 and 47-52. Declares package name, Python `>=3.11`, dependencies, and package discovery for bundled CLI wheels. URL: https://github.com/github/copilot-sdk/blob/main/python/pyproject.toml

[^go-mod]: `github/copilot-sdk/go/go.mod`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 1-13. Declares module path and `go 1.24`. URL: https://github.com/github/copilot-sdk/blob/main/go/go.mod

[^getting-started-prereqs]: `github/copilot-sdk/docs/getting-started.md`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 17-24. Lists GitHub Copilot CLI and language runtime prerequisites. URL: https://github.com/github/copilot-sdk/blob/main/docs/getting-started.md

[^bundled-cli-go]: `github/copilot-sdk/docs/setup/bundled-cli.md`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 70-74. States Go does not bundle the Copilot CLI. URL: https://github.com/github/copilot-sdk/blob/main/docs/setup/bundled-cli.md

[^java-pom]: `github/copilot-sdk-java/pom.xml`, commit `7ab1961ec69279508cc2676212a75aa5ded3cf14`, lines 8-15 and 46-56. Shows Maven coordinates, current snapshot version, project description, and Java 17 compiler release. URL: https://github.com/github/copilot-sdk-java/blob/main/pom.xml

[^java-cli-required]: `github/copilot-sdk-java` README, commit `7ab1961ec69279508cc2676212a75aa5ded3cf14`, lines 23-29. Requires Java 17+ and Copilot CLI 1.0.17+ installed or configured by path. URL: https://github.com/github/copilot-sdk-java/blob/main/README.md

[^bundled-cli-java]: `github/copilot-sdk/docs/setup/bundled-cli.md`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 135-139. States Java does not bundle or embed the CLI and requires path/env configuration. URL: https://github.com/github/copilot-sdk/blob/main/docs/setup/bundled-cli.md

[^docs-getting-started-omits-permission]: GitHub Docs, "Getting started with Copilot SDK." The TypeScript `createSession({ model: "gpt-4.1" })` examples omit `onPermissionRequest`. URL: https://docs.github.com/en/copilot/how-tos/copilot-sdk/sdk-getting-started

[^node-package-version]: `github/copilot-sdk/nodejs/package.json`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 1-9. Source package file shows version `0.1.8`. URL: https://github.com/github/copilot-sdk/blob/main/nodejs/package.json

[^node-package-script]: `github/copilot-sdk/nodejs/package.json`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 34-48. Shows package/build scripts, including version-setting during package generation. URL: https://github.com/github/copilot-sdk/blob/main/nodejs/package.json

[^node-client-constructor]: `github/copilot-sdk/nodejs/src/client.ts`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 284-345. Constructor validation, option rules, defaults, and logged-in-user logic. URL: https://github.com/github/copilot-sdk/blob/main/nodejs/src/client.ts

[^node-client-start]: `github/copilot-sdk/nodejs/src/client.ts`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 410-443. `start()` starts/connects CLI, verifies protocol, and registers session filesystem handling. URL: https://github.com/github/copilot-sdk/blob/main/nodejs/src/client.ts

[^node-client-stop]: `github/copilot-sdk/nodejs/src/client.ts`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 468-633. `stop()` cleanup path for sessions, connection, socket, process, and cache. URL: https://github.com/github/copilot-sdk/blob/main/nodejs/src/client.ts

[^python-client]: `github/copilot-sdk/python/copilot/client.py`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 806-1191 and 1830 onward. Implements `CopilotClient`, `start`, `create_session`, and `list_models`. URL: https://github.com/github/copilot-sdk/blob/main/python/copilot/client.py

[^go-client]: `github/copilot-sdk/go/client.go`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 91-230. Defines client struct and `NewClient` validation/defaults. URL: https://github.com/github/copilot-sdk/blob/main/go/client.go

[^dotnet-client]: `github/copilot-sdk/dotnet/src/Client.cs`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 57-155, 201-235, 433 onward, and 745 onward. Defines client fields, constructor validation, `StartAsync`, `CreateSessionAsync`, and `ListModelsAsync`. URL: https://github.com/github/copilot-sdk/blob/main/dotnet/src/Client.cs

[^java-client]: `github/copilot-sdk-java/src/main/java/com/github/copilot/sdk/CopilotClient.java`, commit `7ab1961ec69279508cc2676212a75aa5ded3cf14`, lines 69-136, 143-224, 342-394, and 421-463. Defines Java client validation, startup/protocol verification, create session, and resume session. URL: https://github.com/github/copilot-sdk-java/blob/main/src/main/java/com/github/copilot/sdk/CopilotClient.java

[^node-client-create-session]: `github/copilot-sdk/nodejs/src/client.ts`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 664-781. Create-session flow. URL: https://github.com/github/copilot-sdk/blob/main/nodejs/src/client.ts

[^node-client-resume-session]: `github/copilot-sdk/nodejs/src/client.ts`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 808-925. Resume-session flow. URL: https://github.com/github/copilot-sdk/blob/main/nodejs/src/client.ts

[^node-list-models]: `github/copilot-sdk/nodejs/src/client.ts`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 975-1063. Status/auth/model listing and model-list caching/locking. URL: https://github.com/github/copilot-sdk/blob/main/nodejs/src/client.ts

[^nuget-client-docs]: NuGet package page for `GitHub.Copilot.SDK`, retrieved 2026-04-27. Lists `CopilotClient` methods including start, stop, create/resume session, ping, list sessions, foreground APIs, and lifecycle event subscriptions. URL: https://www.nuget.org/packages/GitHub.Copilot.SDK/

[^node-session-events]: `github/copilot-sdk/nodejs/src/session.ts`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 292-346. Typed and wildcard `on()` event subscriptions. URL: https://github.com/github/copilot-sdk/blob/main/nodejs/src/session.ts

[^node-tool-dispatch]: `github/copilot-sdk/nodejs/src/session.ts`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 457-497. Tool handler execution and RPC response. URL: https://github.com/github/copilot-sdk/blob/main/nodejs/src/session.ts

[^nuget-session-docs]: NuGet package page for `GitHub.Copilot.SDK`, retrieved 2026-04-27. Lists `CopilotSession` properties and methods including send, event subscription, abort, messages, and disposal. URL: https://www.nuget.org/packages/GitHub.Copilot.SDK/

[^node-send]: `github/copilot-sdk/nodejs/src/session.ts`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 180-191. Implements `send()`. URL: https://github.com/github/copilot-sdk/blob/main/nodejs/src/session.ts

[^node-session-config]: `github/copilot-sdk/nodejs/src/types.ts`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 1175-1381. Defines `SessionConfig` fields. URL: https://github.com/github/copilot-sdk/blob/main/nodejs/src/types.ts

[^go-create-session]: `github/copilot-sdk/go/client.go`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 571-653 onward. Creates sessions and requires `OnPermissionRequest`. URL: https://github.com/github/copilot-sdk/blob/main/go/client.go

[^java-create-session]: `github/copilot-sdk-java/src/main/java/com/github/copilot/sdk/CopilotClient.java`, commit `7ab1961ec69279508cc2676212a75aa5ded3cf14`, lines 342-394. Java create-session flow. URL: https://github.com/github/copilot-sdk-java/blob/main/src/main/java/com/github/copilot/sdk/CopilotClient.java

[^conductor-permission-handler]: `microsoft/conductor/src/conductor/providers/copilot.py`, commit `dbcf20f107f367b09ae0a3bf6fc822877d33860e`, lines 195-210. Defines default permission handler and states SDK requires permission handler on session creation. URL: https://github.com/microsoft/conductor/blob/main/src/conductor/providers/copilot.py

[^node-permission-types]: `github/copilot-sdk/nodejs/src/types.ts`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 753-768. Defines `PermissionRequest`, `PermissionHandler`, and `approveAll`. URL: https://github.com/github/copilot-sdk/blob/main/nodejs/src/types.ts

[^compatibility-permissions]: `github/copilot-sdk/docs/troubleshooting/compatibility.md`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 187-197. Describes SDK deny-by-default permission model and permission handler use. URL: https://github.com/github/copilot-sdk/blob/main/docs/troubleshooting/compatibility.md

[^node-message-options]: `github/copilot-sdk/nodejs/src/types.ts`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 1476-1515 onward. Defines `MessageOptions` and attachments. URL: https://github.com/github/copilot-sdk/blob/main/nodejs/src/types.ts

[^streaming-language-types]: `github/copilot-sdk/docs/features/streaming-events.md`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 209-213. Notes language typing differences for events. URL: https://github.com/github/copilot-sdk/blob/main/docs/features/streaming-events.md

[^node-chat-sample]: `github/copilot-sdk/nodejs/samples/chat.ts`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 1-35. Node chat sample uses `approveAll`, event subscriptions, and `sendAndWait()`. URL: https://github.com/github/copilot-sdk/blob/main/nodejs/samples/chat.ts

[^python-chat-sample]: `github/copilot-sdk/python/samples/chat.py`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 1-54. Python chat sample uses `PermissionHandler.approve_all`, event handling, and `send_and_wait()`. URL: https://github.com/github/copilot-sdk/blob/main/python/samples/chat.py

[^go-chat-sample]: `github/copilot-sdk/go/samples/chat.go`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 1-71. Go chat sample passes `CLIPath`, uses `PermissionHandler.ApproveAll`, events, and `SendAndWait()`. URL: https://github.com/github/copilot-sdk/blob/main/go/samples/chat.go

[^dotnet-chat-sample]: `github/copilot-sdk/dotnet/samples/Chat.cs`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 1-35. .NET chat sample uses `PermissionHandler.ApproveAll`, event subscriptions, and `SendAndWaitAsync()`. URL: https://github.com/github/copilot-sdk/blob/main/dotnet/samples/Chat.cs

[^node-tool-types]: `github/copilot-sdk/nodejs/src/types.ts`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 348-380. Defines `Tool<TArgs>` and `defineTool`. URL: https://github.com/github/copilot-sdk/blob/main/nodejs/src/types.ts

[^java-tool-definition]: `github/copilot-sdk-java/src/main/java/com/github/copilot/sdk/json/ToolDefinition.java`, commit `7ab1961ec69279508cc2676212a75aa5ded3cf14`, lines 13-67 and 85-135. Defines Java tool definition and factory methods. URL: https://github.com/github/copilot-sdk-java/blob/main/src/main/java/com/github/copilot/sdk/json/ToolDefinition.java

[^java-rpc-dispatch]: `github/copilot-sdk-java/src/main/java/com/github/copilot/sdk/RpcHandlerDispatcher.java`, commit `7ab1961ec69279508cc2676212a75aa5ded3cf14`, lines 68-85, 126-184, and 186-217 onward. Registers JSON-RPC handlers and dispatches tools/permission requests. URL: https://github.com/github/copilot-sdk-java/blob/main/src/main/java/com/github/copilot/sdk/RpcHandlerDispatcher.java

[^node-permission-dispatch]: `github/copilot-sdk/nodejs/src/session.ts`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 503-530. Permission handler execution/fallback. URL: https://github.com/github/copilot-sdk/blob/main/nodejs/src/session.ts

[^node-package]: `github/copilot-sdk/nodejs/package.json`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 1-9 and 11-33. Package name, repository, version, description, exports, and module type. URL: https://github.com/github/copilot-sdk/blob/main/nodejs/package.json

[^node-protocol]: `github/copilot-sdk/nodejs/src/client.ts`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 1069-1097. Protocol version verification, including minimum protocol version. URL: https://github.com/github/copilot-sdk/blob/main/nodejs/src/client.ts

[^node-spawn]: `github/copilot-sdk/nodejs/src/client.ts`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 1392-1641. CLI spawn/connect path with headless, no-auto-update, stdio/TCP, auth, telemetry, and timeout behavior. URL: https://github.com/github/copilot-sdk/blob/main/nodejs/src/client.ts

[^node-event-dispatch]: `github/copilot-sdk/nodejs/src/session.ts`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 355-451. Event dispatch and broadcast internal handling. URL: https://github.com/github/copilot-sdk/blob/main/nodejs/src/session.ts

[^python-configs]: `github/copilot-sdk/python/copilot/client.py`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 99-177. Defines `SubprocessConfig` and `ExternalServerConfig`. URL: https://github.com/github/copilot-sdk/blob/main/python/copilot/client.py

[^python-session]: `github/copilot-sdk/python/copilot/session.py`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 979 onward, 1138 onward, and 1211 onward. Implements `CopilotSession`, `send_and_wait`, and `on`. URL: https://github.com/github/copilot-sdk/blob/main/python/copilot/session.py

[^conductor-dependency]: `microsoft/conductor/pyproject.toml`, commit `dbcf20f107f367b09ae0a3bf6fc822877d33860e`, lines 33-47. Declares dependency `github-copilot-sdk>=0.2.2` and related runtime dependencies. URL: https://github.com/microsoft/conductor/blob/main/pyproject.toml

[^conductor-imports]: `microsoft/conductor/src/conductor/providers/copilot.py`, commit `dbcf20f107f367b09ae0a3bf6fc822877d33860e`, lines 42-52. Imports `CopilotClient` and `PermissionHandler` from the Python SDK. URL: https://github.com/microsoft/conductor/blob/main/src/conductor/providers/copilot.py

[^conductor-session-create]: `microsoft/conductor/src/conductor/providers/copilot.py`, commit `dbcf20f107f367b09ae0a3bf6fc822877d33860e`, lines 516-619. Builds SDK session kwargs, adds permission handler, working directory, MCP servers, resumes prior sessions, creates sessions, tracks session IDs, and sends prompts. URL: https://github.com/microsoft/conductor/blob/main/src/conductor/providers/copilot.py

[^conductor-send-wait]: `microsoft/conductor/src/conductor/providers/copilot.py`, commit `dbcf20f107f367b09ae0a3bf6fc822877d33860e`, lines 718-874. Wraps SDK send/wait with event handling, idle detection, usage capture, error handling, and partial response behavior. URL: https://github.com/microsoft/conductor/blob/main/src/conductor/providers/copilot.py

[^conductor-start-lock]: `microsoft/conductor/src/conductor/providers/copilot.py`, commit `dbcf20f107f367b09ae0a3bf6fc822877d33860e`, lines 1536-1554. Lazily starts `CopilotClient` behind an async lock and fixes subprocess pipe mode. URL: https://github.com/microsoft/conductor/blob/main/src/conductor/providers/copilot.py

[^go-types]: `github/copilot-sdk/go/types.go`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 20-237. Defines client options, telemetry config, system message config, and permission result kinds. URL: https://github.com/github/copilot-sdk/blob/main/go/types.go

[^go-start-stop]: `github/copilot-sdk/go/client.go`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 302-351 and 371-429. Implements `Start` and `Stop`. URL: https://github.com/github/copilot-sdk/blob/main/go/client.go

[^go-session]: `github/copilot-sdk/go/session.go`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 51-84, 132-154, 185-234, and 258-318. Defines concurrent-safe session, send/send-and-wait, event subscription, tool and permission handler registration. URL: https://github.com/github/copilot-sdk/blob/main/go/session.go

[^dotnet-session]: `github/copilot-sdk/dotnet/src/Session.cs`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 56-149, 184-203, and 232-275. Defines .NET session, event channel, workspace/capabilities, `SendAsync`, and `SendAndWaitAsync`. URL: https://github.com/github/copilot-sdk/blob/main/dotnet/src/Session.cs

[^nuget-package]: NuGet package page for `GitHub.Copilot.SDK`, retrieved 2026-04-27. Describes SDK for programmatic control of GitHub Copilot CLI and public preview status. URL: https://www.nuget.org/packages/GitHub.Copilot.SDK/

[^dotnet-csproj]: `github/copilot-sdk/dotnet/src/GitHub.Copilot.SDK.csproj`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 1-21, 31-42, and 44-71. Shows package metadata, AOT compatibility, dependencies, and bundled CLI version props/targets generation. URL: https://github.com/github/copilot-sdk/blob/main/dotnet/src/GitHub.Copilot.SDK.csproj

[^java-session]: `github/copilot-sdk-java/src/main/java/com/github/copilot/sdk/CopilotSession.java`, commit `7ab1961ec69279508cc2676212a75aa5ded3cf14`, lines 136-209, 422-469, 498-603, and 637-698. Defines Java session fields, send, sendAndWait, and event subscriptions. URL: https://github.com/github/copilot-sdk-java/blob/main/src/main/java/com/github/copilot/sdk/CopilotSession.java

[^java-sync]: `github/copilot-sdk-java` README, commit `7ab1961ec69279508cc2676212a75aa5ded3cf14`, lines 164-188. Describes automated weekly reference implementation sync and official test harness use. URL: https://github.com/github/copilot-sdk-java/blob/main/README.md

[^readme-auth-billing]: `github/copilot-sdk` README, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 58-70. Describes Copilot subscription requirement unless BYOK, billing, and BYOK note. URL: https://github.com/github/copilot-sdk/blob/main/README.md

[^auth-methods]: `github/copilot-sdk/docs/auth/index.md`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 5-13. Auth methods table. URL: https://github.com/github/copilot-sdk/blob/main/docs/auth/index.md

[^auth-signed-in]: `github/copilot-sdk/docs/auth/index.md`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 14-22. Signed-in user/device flow/keychain auth. URL: https://github.com/github/copilot-sdk/blob/main/docs/auth/index.md

[^auth-oauth]: `github/copilot-sdk/docs/auth/index.md`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 106-114. OAuth app token flow. URL: https://github.com/github/copilot-sdk/blob/main/docs/auth/index.md

[^auth-env-vars]: `github/copilot-sdk/docs/auth/index.md`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 234-245. Environment variable priority for `COPILOT_GITHUB_TOKEN`, `GH_TOKEN`, and `GITHUB_TOKEN`. URL: https://github.com/github/copilot-sdk/blob/main/docs/auth/index.md

[^auth-token-types]: `github/copilot-sdk/docs/auth/index.md`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 221-228. Supported token types and classic PAT caveat. URL: https://github.com/github/copilot-sdk/blob/main/docs/auth/index.md

[^byok-overview]: `github/copilot-sdk/docs/auth/byok.md`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 1-4. BYOK bypasses GitHub Copilot auth using own API keys. URL: https://github.com/github/copilot-sdk/blob/main/docs/auth/byok.md

[^byok-providers]: `github/copilot-sdk/docs/auth/byok.md`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 5-14. Provider support table. URL: https://github.com/github/copilot-sdk/blob/main/docs/auth/byok.md

[^node-provider-config]: `github/copilot-sdk/nodejs/src/types.ts`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 1427-1471. Defines provider config for OpenAI/Azure/Anthropic/OpenAI-compatible providers. URL: https://github.com/github/copilot-sdk/blob/main/nodejs/src/types.ts

[^local-cli]: `github/copilot-sdk/docs/setup/local-cli.md`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 1-10. Local CLI setup and compatibility responsibility. URL: https://github.com/github/copilot-sdk/blob/main/docs/setup/local-cli.md

[^backend-services]: `github/copilot-sdk/docs/setup/backend-services.md`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 1-10, 33-38, and 57-85. Backend services use a headless CLI server and SDK clients connect via `cliUrl`. URL: https://github.com/github/copilot-sdk/blob/main/docs/setup/backend-services.md

[^scaling-dimensions]: `github/copilot-sdk/docs/setup/scaling.md`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 7-25. Describes isolation, concurrency, and persistence dimensions. URL: https://github.com/github/copilot-sdk/blob/main/docs/setup/scaling.md

[^scaling-isolated]: `github/copilot-sdk/docs/setup/scaling.md`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 27-65. Isolated CLI per user pattern. URL: https://github.com/github/copilot-sdk/blob/main/docs/setup/scaling.md

[^scaling-shared-cli]: `github/copilot-sdk/docs/setup/scaling.md`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 100-158. Shared CLI with session isolation pattern. URL: https://github.com/github/copilot-sdk/blob/main/docs/setup/scaling.md

[^session-persistence]: `github/copilot-sdk/docs/features/session-persistence.md`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 5-24. Persistence model and custom `session_id`. URL: https://github.com/github/copilot-sdk/blob/main/docs/features/session-persistence.md

[^local-session-storage]: `github/copilot-sdk/docs/setup/local-cli.md`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 171-199. Environment token auth and session storage at `~/.copilot/session-state/{sessionId}/`. URL: https://github.com/github/copilot-sdk/blob/main/docs/setup/local-cli.md

[^session-resume]: `github/copilot-sdk/docs/features/session-persistence.md`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 129-145 and 232-252. Resume flow and resume options. URL: https://github.com/github/copilot-sdk/blob/main/docs/features/session-persistence.md

[^custom-agents]: `github/copilot-sdk/docs/features/custom-agents.md`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 1-8 and 244-256. Custom agents are named definitions with own prompt/tool restrictions/MCP and config reference. URL: https://github.com/github/copilot-sdk/blob/main/docs/features/custom-agents.md

[^mcp-overview]: `github/copilot-sdk/docs/features/mcp.md`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 1-5 and 17-25. SDK integrates with MCP and supports local stdio and HTTP/SSE server types. URL: https://github.com/github/copilot-sdk/blob/main/docs/features/mcp.md

[^mcp-config]: `github/copilot-sdk/docs/features/mcp.md`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 245-257. Local MCP config options. URL: https://github.com/github/copilot-sdk/blob/main/docs/features/mcp.md

[^hooks-overview]: `github/copilot-sdk/docs/features/hooks.md`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 1-8 and 22-31. Hooks plug custom logic into session lifecycle and define hook types. URL: https://github.com/github/copilot-sdk/blob/main/docs/features/hooks.md

[^github-blog-examples]: GitHub Blog, "Build an agent into any app with the GitHub Copilot SDK." Lists examples such as YouTube chapter generators, custom GUIs, speech-to-command workflows, AI games, and summarization tools. URL: https://github.blog/news-insights/company-news/build-an-agent-into-any-app-with-the-github-copilot-sdk/

[^techcommunity-case-study]: Microsoft Tech Community, "Building Agents with GitHub Copilot SDK: A Practical Guide to Automated Tech Updates," retrieved 2026-04-27. Describes automated update tracking, SDK capabilities, GitHub Actions automation, custom skills, and Agent Framework update example. URL: https://techcommunity.microsoft.com/blog/azuredevcommunityblog/building-agents-with-github-copilot-sdk-a-practical-guide-to-automated-tech-upda/4488948

[^conductor-readme]: `microsoft/conductor` README, commit `dbcf20f107f367b09ae0a3bf6fc822877d33860e`, lines 1-24 and 154-164. Describes Conductor as a CLI for multi-agent workflows with GitHub Copilot SDK and Anthropic Claude, plus provider comparison. URL: https://github.com/microsoft/conductor/blob/main/README.md

[^compatibility-boundary]: `github/copilot-sdk/docs/troubleshooting/compatibility.md`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 1-8. Explains SDK features require explicit JSON-RPC protocol exposure and many TUI features are CLI-only. URL: https://github.com/github/copilot-sdk/blob/main/docs/troubleshooting/compatibility.md

[^compatibility-unavailable]: `github/copilot-sdk/docs/troubleshooting/compatibility.md`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 93-169. Lists unavailable CLI-only features. URL: https://github.com/github/copilot-sdk/blob/main/docs/troubleshooting/compatibility.md

[^setup-decision-matrix]: `github/copilot-sdk/docs/setup/index.md`, commit `c63feb2794786342d57936c13d28c250e723c676`, lines 79-91 and 128-138. Setup decision matrix and SDK install notes. URL: https://github.com/github/copilot-sdk/blob/main/docs/setup/index.md
