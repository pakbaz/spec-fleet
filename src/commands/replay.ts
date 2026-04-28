/**
 * `specfleet log <sessionId>` — Read-only timeline pretty-print of an audit JSONL
 * file. Args are redacted via the existing secret patterns. Supports
 * --from <seq> and --limit N.
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import chalk from "chalk";
import { findSpecFleetRoot, specFleetPaths } from "../util/paths.js";
import { redact, loadCustomPatterns } from "../util/secrets.js";

export interface ReplayOptions {
  from?: number;
  limit?: number;
}

interface AuditLine {
  ts: string;
  sessionId: string;
  agent: string;
  kind: string;
  payload: Record<string, unknown>;
}

export async function replayCommand(sessionId: string, opts: ReplayOptions = {}): Promise<void> {
  if (!sessionId) throw new Error("sessionId required");
  const root = await findSpecFleetRoot();
  const p = specFleetPaths(root);
  await loadCustomPatterns(p.policiesDir);

  const file = path.join(p.auditDir, `${sessionId}.jsonl`);
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch {
    throw new Error(`audit file not found: ${file}`);
  }

  const events: AuditLine[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line) as AuditLine);
    } catch {
      // skip malformed
    }
  }

  const from = opts.from ?? 0;
  const limit = opts.limit ?? events.length;
  const slice = events.slice(from, from + limit);

  console.log(chalk.bold(`Replay ${sessionId} — ${slice.length} of ${events.length} event(s)`));
  for (let i = 0; i < slice.length; i++) {
    const e = slice[i]!;
    const seq = String(from + i).padStart(4, " ");
    const tag = colorFor(e.kind);
    const args = redact(JSON.stringify(e.payload)).redacted;
    console.log(
      `${chalk.gray(seq)}  ${chalk.gray(e.ts)}  ${tag(e.kind.padEnd(20))}  ` +
        `${chalk.cyan(e.agent.padEnd(22))} ${args}`,
    );
  }
}

function colorFor(kind: string): (s: string) => string {
  if (kind.startsWith("policy.") || kind === "error" || kind === "budget.block") return chalk.red;
  if (kind.startsWith("budget.") || kind === "secret.redacted") return chalk.yellow;
  if (kind.startsWith("gate.")) return chalk.magenta;
  if (kind.startsWith("session.")) return chalk.green;
  return chalk.white;
}
