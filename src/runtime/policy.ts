/**
 * Centralized pre/post tool-use policy enforcement.
 *
 * This module is the single place where v0.2 enforces:
 *   - secret detection in tool args/outputs (writes blocked, reads warned)
 *   - egress allowlist (blocks https?://host calls to non-allowlisted hosts)
 *   - IP guard (regex-based "internal codename" patterns; redact or block)
 *   - offline mode (deny-all egress regardless of allowlist)
 *   - immutable file paths
 *
 * It is invoked from `EasSession`'s `onPreToolUse` / `onPostToolUse` hooks.
 * Pure data in / pure data out — no SDK types leak through, so the unit tests
 * exercise it directly.
 */
import path from "node:path";
import type { AuditLog } from "./audit.js";
import { findSecrets, redact } from "../util/secrets.js";
import {
  type CompiledIpGuard,
  type EgressPolicy,
  applyIpGuardRedaction,
  extractHosts,
  findIpGuardMatches,
  isHostAllowed,
} from "../util/policies.js";

export interface PolicyContext {
  workingDirectory: string;
  immutablePaths: string[];
  egress: EgressPolicy | null;
  ipGuard: CompiledIpGuard | null;
  offline: boolean;
  audit: AuditLog;
  agent: string;
  sessionId: string;
}

export interface PreToolDecision {
  decision: "allow" | "deny";
  reason?: string;
  modifiedArgs?: unknown;
}

export interface PostToolDecision {
  modifiedResult?: { textResultForLlm: string } & Record<string, unknown>;
}

const WRITE_TOOLS = new Set(["Write", "Edit", "MultiEdit", "create", "edit"]);
const BASH_TOOLS = new Set(["Bash", "bash", "run_in_terminal"]);
// Bash patterns that constitute a "write" (file mutation). Conservative.
const BASH_WRITE_RE =
  /(?:^|[\s|;&(])(?:>>?|tee\s|dd\s|cp\s|mv\s|rm\s|cat\s+>|sed\s+-i|awk\s+.+>|echo\s+.+>)/;

export function isWriteTool(toolName: string, toolArgs: unknown): boolean {
  if (WRITE_TOOLS.has(toolName)) return true;
  if (BASH_TOOLS.has(toolName)) {
    const args = (toolArgs ?? {}) as { command?: string; cmd?: string; script?: string };
    const cmd = args.command ?? args.cmd ?? args.script ?? "";
    if (typeof cmd === "string" && BASH_WRITE_RE.test(cmd)) return true;
  }
  return false;
}

function stringifyArgs(toolArgs: unknown): string {
  if (toolArgs === undefined || toolArgs === null) return "";
  if (typeof toolArgs === "string") return toolArgs;
  try {
    return JSON.stringify(toolArgs);
  } catch {
    return String(toolArgs);
  }
}

/**
 * Recursively redact every string field in a JSON-ish args tree using the
 * provided redactor. Returns a new tree (does not mutate input).
 */
function redactArgsTree(value: unknown, redactor: (s: string) => string): unknown {
  if (typeof value === "string") return redactor(value);
  if (Array.isArray(value)) return value.map((v) => redactArgsTree(v, redactor));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactArgsTree(v, redactor);
    }
    return out;
  }
  return value;
}

export function enforcePreTool(
  toolName: string,
  toolArgs: unknown,
  ctx: PolicyContext,
): PreToolDecision {
  // 1. Immutable paths.
  const args = (toolArgs ?? {}) as { path?: string; file_path?: string };
  const target = args.path ?? args.file_path;
  if (typeof target === "string" && target.length > 0) {
    const abs = path.resolve(ctx.workingDirectory, target);
    if (ctx.immutablePaths.some((p) => abs === path.resolve(p))) {
      ctx.audit.emit({
        sessionId: ctx.sessionId,
        agent: ctx.agent,
        kind: "policy.block",
        payload: { reason: "immutable", file: abs, tool: toolName },
      });
      return { decision: "deny", reason: `Path ${abs} is immutable per .eas policy` };
    }
  }

  const stringified = stringifyArgs(toolArgs);

  // 2. Secrets in args.
  const secretMatches = findSecrets(stringified);
  if (secretMatches.length > 0) {
    if (isWriteTool(toolName, toolArgs)) {
      ctx.audit.emit({
        sessionId: ctx.sessionId,
        agent: ctx.agent,
        kind: "policy.block",
        payload: {
          reason: "secret-in-write-args",
          tool: toolName,
          rules: secretMatches.map((m) => m.rule),
        },
      });
      return {
        decision: "deny",
        reason: `Refusing to invoke ${toolName}: arguments contain a secret (${secretMatches
          .map((m) => m.rule)
          .join(", ")}). EAS will not write secrets to disk or shell.`,
      };
    }
    ctx.audit.emit({
      sessionId: ctx.sessionId,
      agent: ctx.agent,
      kind: "secret.warn",
      payload: {
        tool: toolName,
        rules: secretMatches.map((m) => m.rule),
        count: secretMatches.length,
      },
    });
  }

  // 3. Egress allowlist (and offline mode).
  if (ctx.egress || ctx.offline) {
    const hosts = extractHosts(stringified);
    for (const host of hosts) {
      if (ctx.offline) {
        ctx.audit.emit({
          sessionId: ctx.sessionId,
          agent: ctx.agent,
          kind: "egress.block",
          payload: { reason: "offline", host, tool: toolName },
        });
        return {
          decision: "deny",
          reason: `Offline mode (EAS_OFFLINE=1): refusing network access to ${host}`,
        };
      }
      if (ctx.egress && !isHostAllowed(host, ctx.egress)) {
        ctx.audit.emit({
          sessionId: ctx.sessionId,
          agent: ctx.agent,
          kind: "egress.block",
          payload: { reason: "not-allowlisted", host, tool: toolName },
        });
        return {
          decision: "deny",
          reason: `Host ${host} not in .eas/policies/egress.json allowlist`,
        };
      }
    }
  }

  // 4. IP guard on inputs.
  if (ctx.ipGuard) {
    const matches = findIpGuardMatches(stringified, ctx.ipGuard);
    if (matches.length > 0) {
      if (ctx.ipGuard.mode === "block") {
        ctx.audit.emit({
          sessionId: ctx.sessionId,
          agent: ctx.agent,
          kind: "ip.block",
          payload: {
            tool: toolName,
            patterns: matches.map((m) => m.name),
            count: matches.length,
            direction: "input",
          },
        });
        return {
          decision: "deny",
          reason: `IP-guard blocked: tool args matched protected pattern(s) ${[
            ...new Set(matches.map((m) => m.name)),
          ].join(", ")}`,
        };
      }
      // Redact mode: rewrite args.
      const modifiedArgs = redactArgsTree(toolArgs, (s) =>
        applyIpGuardRedaction(s, ctx.ipGuard!).redacted,
      );
      ctx.audit.emit({
        sessionId: ctx.sessionId,
        agent: ctx.agent,
        kind: "ip.redacted",
        payload: {
          tool: toolName,
          patterns: matches.map((m) => m.name),
          count: matches.length,
          direction: "input",
        },
      });
      return { decision: "allow", modifiedArgs };
    }
  }

  return { decision: "allow" };
}

export function enforcePostTool(
  toolName: string,
  toolResult: { textResultForLlm?: string } & Record<string, unknown>,
  ctx: PolicyContext,
): PostToolDecision {
  if (!toolResult || typeof toolResult.textResultForLlm !== "string") return {};
  let text = toolResult.textResultForLlm;
  let mutated = false;

  // 1. Secret redaction in outputs.
  const { redacted, matches } = redact(text);
  if (matches.length > 0) {
    text = redacted;
    mutated = true;
    ctx.audit.emit({
      sessionId: ctx.sessionId,
      agent: ctx.agent,
      kind: "secret.redacted",
      payload: {
        tool: toolName,
        rules: matches.map((m) => m.rule),
        count: matches.length,
      },
    });
  }

  // 2. IP-guard on outputs.
  if (ctx.ipGuard) {
    const guardMatches = findIpGuardMatches(text, ctx.ipGuard);
    if (guardMatches.length > 0) {
      if (ctx.ipGuard.mode === "block") {
        // For blocking on output, we can't unsend the call — replace the body.
        text = `[BLOCKED:ip-guard ${[...new Set(guardMatches.map((m) => m.name))].join(",")}]`;
        mutated = true;
        ctx.audit.emit({
          sessionId: ctx.sessionId,
          agent: ctx.agent,
          kind: "ip.block",
          payload: {
            tool: toolName,
            patterns: guardMatches.map((m) => m.name),
            count: guardMatches.length,
            direction: "output",
          },
        });
      } else {
        const r = applyIpGuardRedaction(text, ctx.ipGuard);
        text = r.redacted;
        mutated = true;
        ctx.audit.emit({
          sessionId: ctx.sessionId,
          agent: ctx.agent,
          kind: "ip.redacted",
          payload: {
            tool: toolName,
            patterns: guardMatches.map((m) => m.name),
            count: guardMatches.length,
            direction: "output",
          },
        });
      }
    }
  }

  if (!mutated) return {};
  return {
    modifiedResult: {
      ...toolResult,
      textResultForLlm: text,
    },
  };
}

// ---------------- Offline detection ----------------

export function isOfflineMode(): boolean {
  if (process.env.EAS_OFFLINE === "1" || process.env.EAS_OFFLINE === "true") return true;
  if (process.argv.includes("--offline")) return true;
  return false;
}
