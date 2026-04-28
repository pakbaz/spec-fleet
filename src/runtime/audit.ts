/**
 * JSONL audit logger — one file per session under .specfleet/audit/.
 *
 * v0.2: tamper-evident hash chain. Every event carries `seq`, `prevHash`, and
 * `hash`. `hash = sha256(prevHash + ":" + canonicalize(event_without_hash))`.
 * `prevHash` of the first event is `"0".repeat(64)`. `verify()` walks the
 * file and re-derives the chain; any mutation, deletion, or insertion breaks it.
 */
import { promises as fs, createWriteStream, readFileSync, existsSync, type WriteStream } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { AuditEventSchema, type AuditEvent } from "../schema/index.js";

const ZERO_HASH = "0".repeat(64);

interface ChainState {
  lastHash: string;
  lastSeq: number; // -1 means "no events yet"
}

export class AuditLog {
  private streams = new Map<string, WriteStream>();
  private chains = new Map<string, ChainState>();

  constructor(private readonly auditDir: string) {}

  async init(): Promise<void> {
    await fs.mkdir(this.auditDir, { recursive: true });
  }

  private fileFor(sessionId: string): string {
    return path.join(this.auditDir, `${sessionId}.jsonl`);
  }

  /**
   * Lazily compute the chain tail by reading the file synchronously on first
   * use for a session. This is O(file size) once per session per process.
   */
  private chainFor(sessionId: string): ChainState {
    let st = this.chains.get(sessionId);
    if (st) return st;
    const file = this.fileFor(sessionId);
    st = { lastHash: ZERO_HASH, lastSeq: -1 };
    if (existsSync(file)) {
      try {
        const raw = readFileSync(file, "utf8");
        const lines = raw.split("\n").filter((l) => l.trim().length > 0);
        if (lines.length > 0) {
          const last = JSON.parse(lines[lines.length - 1]!) as Partial<AuditEvent>;
          if (typeof last.hash === "string" && typeof last.seq === "number") {
            st.lastHash = last.hash;
            st.lastSeq = last.seq;
          }
        }
      } catch {
        // Corrupt file — leave fresh state; verify() will report it.
      }
    }
    this.chains.set(sessionId, st);
    return st;
  }

  private streamFor(sessionId: string): WriteStream {
    let s = this.streams.get(sessionId);
    if (!s) {
      s = createWriteStream(this.fileFor(sessionId), { flags: "a", encoding: "utf8" });
      this.streams.set(sessionId, s);
    }
    return s;
  }

  emit(event: Omit<AuditEvent, "ts" | "seq" | "prevHash" | "hash"> & { ts?: string }): AuditEvent {
    const base: Omit<AuditEvent, "hash"> = {
      ts: event.ts ?? new Date().toISOString(),
      sessionId: event.sessionId,
      agent: event.agent,
      kind: event.kind,
      payload: event.payload ?? {},
      seq: 0,
      prevHash: ZERO_HASH,
    };
    const chain = this.chainFor(event.sessionId);
    base.seq = chain.lastSeq + 1;
    base.prevHash = chain.lastHash;
    const hash = computeHash(base);
    const final: AuditEvent = AuditEventSchema.parse({ ...base, hash });
    chain.lastHash = hash;
    chain.lastSeq = base.seq;
    this.streamFor(event.sessionId).write(JSON.stringify(final) + "\n");
    return final;
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

  /**
   * Verify a single session's hash chain. Reads the JSONL file, recomputes
   * each event's hash, and confirms `prevHash`/`seq` linkage.
   */
  async verify(sessionId: string): Promise<{ ok: boolean; brokenAt?: number; reason?: string; total?: number }> {
    const file = this.fileFor(sessionId);
    let raw: string;
    try {
      raw = await fs.readFile(file, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return { ok: false, reason: `audit file not found: ${file}` };
      }
      throw err;
    }
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);
    let prev = ZERO_HASH;
    let expectedSeq = 0;
    for (let i = 0; i < lines.length; i++) {
      let parsed: AuditEvent;
      try {
        parsed = AuditEventSchema.parse(JSON.parse(lines[i]!));
      } catch (e) {
        return { ok: false, brokenAt: i, reason: `line ${i}: malformed (${(e as Error).message})` };
      }
      if (parsed.seq !== expectedSeq) {
        return { ok: false, brokenAt: i, reason: `line ${i}: seq ${parsed.seq} expected ${expectedSeq}` };
      }
      if (parsed.prevHash !== prev) {
        return { ok: false, brokenAt: i, reason: `line ${i}: prevHash mismatch` };
      }
      const recomputed = computeHash({
        ts: parsed.ts,
        sessionId: parsed.sessionId,
        agent: parsed.agent,
        kind: parsed.kind,
        payload: parsed.payload,
        seq: parsed.seq,
        prevHash: parsed.prevHash,
      });
      if (recomputed !== parsed.hash) {
        return { ok: false, brokenAt: i, reason: `line ${i}: hash mismatch (tampered)` };
      }
      prev = parsed.hash!;
      expectedSeq++;
    }
    return { ok: true, total: lines.length };
  }

  async listSessions(): Promise<string[]> {
    const files = await fs.readdir(this.auditDir).catch(() => [] as string[]);
    return files
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => f.slice(0, -".jsonl".length));
  }
}

// ---------------- Canonicalization & hashing ----------------

/**
 * Deterministic JSON: sorted keys at every depth, no whitespace.
 * Pure-function over JSON-safe values.
 */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalize).join(",") + "]";
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const parts: string[] = [];
  for (const k of keys) {
    parts.push(JSON.stringify(k) + ":" + canonicalize((value as Record<string, unknown>)[k]));
  }
  return "{" + parts.join(",") + "}";
}

function computeHash(event: Omit<AuditEvent, "hash">): string {
  const canon = canonicalize(event);
  return createHash("sha256").update(event.prevHash + ":" + canon).digest("hex");
}
