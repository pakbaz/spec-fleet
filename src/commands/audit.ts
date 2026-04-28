/**
 * `eas audit` — Tail/filter audit events from .eas/audit/.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { EasRuntime } from "../runtime/index.js";

interface AuditOptions {
  since?: string;
  agent?: string;
  tail?: boolean;
}

export async function auditCommand(opts: AuditOptions): Promise<void> {
  const rt = await EasRuntime.open();
  try {
    const events = await rt.audit.readAll({ since: opts.since, agent: opts.agent });
    for (const e of events) {
      const tag = colorFor(e.kind);
      console.log(`${chalk.gray(e.ts)}  ${tag(e.kind.padEnd(20))}  ${chalk.cyan(e.agent.padEnd(22))} ${JSON.stringify(e.payload)}`);
    }

    if (opts.tail) {
      console.log(chalk.gray("\n[tailing… Ctrl-C to exit]"));
      const seen = new Set(events.map((e) => `${e.sessionId}:${e.ts}`));
      // Naive poll-tail. Production would use fs.watch but JSONL flushes vary.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        await sleep(500);
        try {
          const files = await fs.readdir(rt.paths.auditDir);
          for (const f of files) {
            if (!f.endsWith(".jsonl")) continue;
            const raw = await fs.readFile(path.join(rt.paths.auditDir, f), "utf8");
            for (const line of raw.split("\n")) {
              if (!line.trim()) continue;
              try {
                const ev = JSON.parse(line) as { ts: string; sessionId: string; agent: string; kind: string; payload: unknown };
                const k = `${ev.sessionId}:${ev.ts}`;
                if (seen.has(k)) continue;
                seen.add(k);
                if (opts.agent && ev.agent !== opts.agent) continue;
                const tag = colorFor(ev.kind);
                console.log(`${chalk.gray(ev.ts)}  ${tag(ev.kind.padEnd(20))}  ${chalk.cyan(ev.agent.padEnd(22))} ${JSON.stringify(ev.payload)}`);
              } catch { /* skip */ }
            }
          }
        } catch { /* dir gone */ }
      }
    }
  } finally {
    await rt.dispose();
  }
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function colorFor(kind: string): (s: string) => string {
  if (kind.startsWith("policy.") || kind.startsWith("budget.block") || kind === "error") return chalk.red;
  if (kind.startsWith("budget.") || kind === "secret.redacted") return chalk.yellow;
  if (kind.startsWith("gate.")) return chalk.magenta;
  if (kind.startsWith("session.")) return chalk.green;
  return chalk.white;
}
