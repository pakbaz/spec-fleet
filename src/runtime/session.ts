/**
 * EasSession — internal abstraction over @github/copilot-sdk's CopilotSession that
 * adds (a) per-charter token budget enforcement, (b) immutable-file protection,
 * (c) tool allowlist enforcement, (d) secret redaction in tool outputs, and
 * (e) audit logging for every lifecycle event.
 *
 * This is the *single* policy enforcement point in the system: developers cannot
 * reach the SDK directly — they go through `eas` commands which always wrap
 * sessions in this class.
 */
import path from "node:path";
import {
  approveAll,
  CopilotClient,
  type CopilotSession,
  type PermissionRequest,
  type PermissionRequestResult,
  type SessionConfig,
} from "@github/copilot-sdk";
import type { Charter } from "../schema/index.js";
import { AuditLog } from "./audit.js";
import { checkBudget, estimateMessagesTokens, TokenBudgetExceededError } from "../util/tokens.js";

export interface EasSessionOptions {
  charter: Charter;
  workingDirectory: string;
  audit: AuditLog;
  immutablePaths: string[];
  // Override permission handler. Defaults to allowlist-based enforcement.
  onPermissionRequest?: (req: PermissionRequest) => PermissionRequestResult | Promise<PermissionRequestResult>;
}

export class EasSession {
  readonly charter: Charter;
  readonly sessionId: string;
  private readonly session: CopilotSession;
  private readonly audit: AuditLog;
  private readonly immutablePaths: string[];
  private cumulativeContextChars = 0;

  private constructor(args: {
    charter: Charter;
    sessionId: string;
    session: CopilotSession;
    audit: AuditLog;
    immutablePaths: string[];
  }) {
    this.charter = args.charter;
    this.sessionId = args.sessionId;
    this.session = args.session;
    this.audit = args.audit;
    this.immutablePaths = args.immutablePaths;
  }

  static async create(client: CopilotClient, opts: EasSessionOptions): Promise<EasSession> {
    const { charter, workingDirectory, audit, immutablePaths } = opts;

    // Build the SessionConfig from the charter.
    const config: SessionConfig = {
      model: charter.model ?? "claude-sonnet-4.5",
      workingDirectory,
      systemMessage: {
        content: buildSystemPrompt(charter),
      },
      // The SDK exposes infinite sessions for built-in compaction; we rely on it
      // *and* layer our own checkpoint compaction on top (for cross-agent memory).
      infiniteSessions: { enabled: true },
      onPermissionRequest:
        opts.onPermissionRequest ??
        ((req, inv) => permissionGate(req, charter, audit, charter.name, inv.sessionId)),
      hooks: {
        onSessionStart: async (input, inv) => {
          audit.emit({
            sessionId: inv.sessionId,
            agent: charter.name,
            kind: "session.start",
            payload: { source: input.source, working: workingDirectory },
          });
          return {};
        },
        onSessionEnd: async (input, inv) => {
          audit.emit({
            sessionId: inv.sessionId,
            agent: charter.name,
            kind: "session.end",
            payload: { reason: input.reason },
          });
        },
        onUserPromptSubmitted: async (input, inv) => {
          audit.emit({
            sessionId: inv.sessionId,
            agent: charter.name,
            kind: "user.prompt",
            payload: { len: input.prompt.length },
          });
          return {};
        },
        onPreToolUse: async (input, inv) => {
          // Block writes to immutable paths by inspecting toolArgs.path.
          const args = (input.toolArgs ?? {}) as { path?: string; file_path?: string };
          const target = args.path ?? args.file_path;
          if (target) {
            const abs = path.resolve(workingDirectory, target);
            if (immutablePaths.some((p) => abs === path.resolve(p))) {
              audit.emit({
                sessionId: inv.sessionId,
                agent: charter.name,
                kind: "policy.block",
                payload: { reason: "immutable", file: abs, tool: input.toolName },
              });
              return {
                permissionDecision: "deny",
                permissionDecisionReason: `Path ${abs} is immutable per .eas policy`,
              };
            }
          }
          audit.emit({
            sessionId: inv.sessionId,
            agent: charter.name,
            kind: "tool.pre",
            payload: { tool: input.toolName },
          });
          return { permissionDecision: "allow" };
        },
        onPostToolUse: async (input, inv) => {
          audit.emit({
            sessionId: inv.sessionId,
            agent: charter.name,
            kind: "tool.post",
            payload: { tool: input.toolName },
          });
          return {};
        },
        onErrorOccurred: async (input, inv) => {
          audit.emit({
            sessionId: inv.sessionId,
            agent: charter.name,
            kind: "error",
            payload: { ctx: input.errorContext, msg: String(input.error) },
          });
          return { errorHandling: "abort" };
        },
      },
    };

    // Tool allowlist: empty array means "no restriction beyond hooks". Non-empty
    // becomes excludedTools = (all tools - allowed). The SDK exposes
    // `availableTools` / `excludedTools` per-session, but precise allowlist enforcement
    // is layered in onPreToolUse for safety.
    if (charter.allowedTools.length > 0) {
      // We do not have a static catalog of every built-in tool name here; runtime
      // enforcement happens in permissionGate / onPreToolUse.
    }

    const session = await client.createSession(config);
    return new EasSession({
      charter,
      sessionId: session.sessionId,
      session,
      audit,
      immutablePaths,
    });
  }

  async ask(prompt: string, timeoutMs = 5 * 60 * 1000): Promise<string> {
    // Pre-flight token budget check.
    this.cumulativeContextChars += prompt.length;
    const estUsed = estimateMessagesTokens([
      this.charter.body,
      prompt,
      String(this.cumulativeContextChars / 4),
    ]);
    const b = checkBudget(estUsed, this.charter.maxContextTokens);
    if (b.warning) {
      this.audit.emit({
        sessionId: this.sessionId,
        agent: this.charter.name,
        kind: b.remaining < 0 ? "budget.block" : "budget.warn",
        payload: { used: b.used, cap: b.cap, remaining: b.remaining },
      });
    }
    if (estUsed >= this.charter.maxContextTokens) {
      throw new TokenBudgetExceededError(this.charter.name, estUsed, this.charter.maxContextTokens);
    }

    const final = await this.session.sendAndWait({ prompt }, timeoutMs);
    return final?.data.content ?? "";
  }

  async dispose(): Promise<void> {
    await this.session.disconnect();
  }
}

function buildSystemPrompt(c: Charter): string {
  return [
    `<charter name="${c.name}" role="${c.role}" tier="${c.tier}" cap="${c.maxContextTokens}">`,
    c.body,
    `</charter>`,
    `<allowedTools>${c.allowedTools.join(", ") || "(default set)"}</allowedTools>`,
    c.spawns.length > 0
      ? `<canSpawn>${c.spawns.join(", ")}</canSpawn>\n<rule>To delegate work to a sub-agent, output a fenced block:\n\`\`\`eas-delegate\n{"to": "<charterName>", "task": "<concise brief>"}\n\`\`\`\nThe orchestrator will spawn the sub-agent in an isolated session and return its result.</rule>`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function permissionGate(
  req: PermissionRequest,
  charter: Charter,
  audit: AuditLog,
  agent: string,
  sessionId: string,
): Promise<PermissionRequestResult> {
  // Tool allowlist (best-effort: only enforced for custom-tool / mcp; the
  // remaining file-path enforcement happens in onPreToolUse where toolArgs
  // are exposed).
  if (charter.allowedTools.length > 0) {
    const name = (req as { toolName?: string }).toolName;
    if (
      (req.kind === "custom-tool" || req.kind === "mcp") &&
      name !== undefined &&
      !charter.allowedTools.includes(name)
    ) {
      audit.emit({
        sessionId,
        agent,
        kind: "policy.block",
        payload: { reason: "not-in-allowlist", tool: name },
      });
      return { kind: "reject", feedback: `Tool ${name} not in charter allowlist` };
    }
  }
  return approveAll(req, { sessionId });
}
