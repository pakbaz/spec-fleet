/**
 * JSONL audit logger — one file per session under .eas/audit/.
 */
import { promises as fs, createWriteStream, type WriteStream } from "node:fs";
import path from "node:path";
import { AuditEventSchema, type AuditEvent } from "../schema/index.js";

export class AuditLog {
  private streams = new Map<string, WriteStream>();

  constructor(private readonly auditDir: string) {}

  async init(): Promise<void> {
    await fs.mkdir(this.auditDir, { recursive: true });
  }

  private streamFor(sessionId: string): WriteStream {
    let s = this.streams.get(sessionId);
    if (!s) {
      const file = path.join(this.auditDir, `${sessionId}.jsonl`);
      s = createWriteStream(file, { flags: "a", encoding: "utf8" });
      this.streams.set(sessionId, s);
    }
    return s;
  }

  emit(event: Omit<AuditEvent, "ts"> & { ts?: string }): void {
    const e: AuditEvent = AuditEventSchema.parse({ ts: new Date().toISOString(), ...event });
    this.streamFor(e.sessionId).write(JSON.stringify(e) + "\n");
  }

  async close(): Promise<void> {
    await Promise.all(
      [...this.streams.values()].map(
        (s) =>
          new Promise<void>((resolve, reject) =>
            s.end((err: Error | null | undefined) => (err ? reject(err) : resolve())),
          ),
      ),
    );
    this.streams.clear();
  }

  async readAll(filter?: { sessionId?: string; agent?: string; since?: string }): Promise<AuditEvent[]> {
    const files = await fs.readdir(this.auditDir).catch(() => [] as string[]);
    const events: AuditEvent[] = [];
    for (const f of files) {
      if (!f.endsWith(".jsonl")) continue;
      if (filter?.sessionId && !f.startsWith(filter.sessionId)) continue;
      const raw = await fs.readFile(path.join(this.auditDir, f), "utf8");
      for (const line of raw.split("\n")) {
        if (!line.trim()) continue;
        try {
          const ev = AuditEventSchema.parse(JSON.parse(line));
          if (filter?.agent && ev.agent !== filter.agent) continue;
          if (filter?.since && ev.ts < filter.since) continue;
          events.push(ev);
        } catch {
          // skip malformed line
        }
      }
    }
    return events.sort((a, b) => a.ts.localeCompare(b.ts));
  }
}
