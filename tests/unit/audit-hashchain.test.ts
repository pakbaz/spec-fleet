import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { AuditLog } from "../../src/runtime/audit.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "eas-audit-hash-"));
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function emitN(log: AuditLog, sid: string, n: number) {
  for (let i = 0; i < n; i++) {
    log.emit({ sessionId: sid, agent: "dev", kind: "tool.pre", payload: { i } });
  }
  await log.close();
}

describe("AuditLog hash chain", () => {
  it("verifies a clean run", async () => {
    const log = new AuditLog(tmp);
    await log.init();
    await emitN(log, "s1", 5);
    const log2 = new AuditLog(tmp);
    const r = await log2.verify("s1");
    expect(r.ok).toBe(true);
    expect(r.total).toBe(5);
  });

  it("populates seq, prevHash, and hash on every event", async () => {
    const log = new AuditLog(tmp);
    await log.init();
    await emitN(log, "s2", 3);
    const raw = await fs.readFile(path.join(tmp, "s2.jsonl"), "utf8");
    const lines = raw.trim().split("\n");
    expect(lines.length).toBe(3);
    const events = lines.map((l) => JSON.parse(l));
    expect(events[0].seq).toBe(0);
    expect(events[0].prevHash).toBe("0".repeat(64));
    expect(typeof events[0].hash).toBe("string");
    expect(events[0].hash).toMatch(/^[0-9a-f]{64}$/);
    expect(events[1].seq).toBe(1);
    expect(events[1].prevHash).toBe(events[0].hash);
    expect(events[2].seq).toBe(2);
    expect(events[2].prevHash).toBe(events[1].hash);
  });

  it("detects a mutated payload (tampering)", async () => {
    const log = new AuditLog(tmp);
    await log.init();
    await emitN(log, "s3", 4);
    const file = path.join(tmp, "s3.jsonl");
    const raw = await fs.readFile(file, "utf8");
    const lines = raw.split("\n").filter(Boolean);
    const obj = JSON.parse(lines[2]);
    obj.payload = { i: 999 };
    lines[2] = JSON.stringify(obj);
    await fs.writeFile(file, lines.join("\n") + "\n", "utf8");

    const r = await new AuditLog(tmp).verify("s3");
    expect(r.ok).toBe(false);
    expect(r.brokenAt).toBe(2);
    expect(r.reason).toMatch(/hash/);
  });

  it("detects a deleted line", async () => {
    const log = new AuditLog(tmp);
    await log.init();
    await emitN(log, "s4", 4);
    const file = path.join(tmp, "s4.jsonl");
    const raw = await fs.readFile(file, "utf8");
    const lines = raw.split("\n").filter(Boolean);
    lines.splice(1, 1);
    await fs.writeFile(file, lines.join("\n") + "\n", "utf8");

    const r = await new AuditLog(tmp).verify("s4");
    expect(r.ok).toBe(false);
    expect(r.brokenAt).toBe(1);
  });

  it("detects an inserted line", async () => {
    const log = new AuditLog(tmp);
    await log.init();
    await emitN(log, "s5", 3);
    const file = path.join(tmp, "s5.jsonl");
    const raw = await fs.readFile(file, "utf8");
    const lines = raw.split("\n").filter(Boolean);
    const fake = JSON.parse(lines[0]);
    fake.payload = { sneaky: true };
    lines.splice(1, 0, JSON.stringify(fake));
    await fs.writeFile(file, lines.join("\n") + "\n", "utf8");

    const r = await new AuditLog(tmp).verify("s5");
    expect(r.ok).toBe(false);
    expect(r.brokenAt).toBe(1);
  });

  it("detects a swap of two lines", async () => {
    const log = new AuditLog(tmp);
    await log.init();
    await emitN(log, "s6", 4);
    const file = path.join(tmp, "s6.jsonl");
    const raw = await fs.readFile(file, "utf8");
    const lines = raw.split("\n").filter(Boolean);
    [lines[1], lines[2]] = [lines[2], lines[1]];
    await fs.writeFile(file, lines.join("\n") + "\n", "utf8");

    const r = await new AuditLog(tmp).verify("s6");
    expect(r.ok).toBe(false);
  });

  it("continues a chain across process restarts (re-opens file)", async () => {
    const log1 = new AuditLog(tmp);
    await log1.init();
    log1.emit({ sessionId: "s7", agent: "a", kind: "tool.pre", payload: {} });
    log1.emit({ sessionId: "s7", agent: "a", kind: "tool.pre", payload: {} });
    await log1.close();

    // Fresh AuditLog instance — should resume seq=2 with prevHash from disk.
    const log2 = new AuditLog(tmp);
    await log2.init();
    log2.emit({ sessionId: "s7", agent: "a", kind: "tool.post", payload: {} });
    await log2.close();

    const r = await new AuditLog(tmp).verify("s7");
    expect(r.ok).toBe(true);
    expect(r.total).toBe(3);
  });
});
