import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { replayCommand } from "../../src/commands/replay.js";

let tmp: string;
const cwd = process.cwd();

async function seedAudit(events: Record<string, unknown>[]) {
  const auditDir = path.join(tmp, ".specfleet", "audit");
  await fs.mkdir(auditDir, { recursive: true });
  await fs.writeFile(
    path.join(auditDir, "sess-1.jsonl"),
    events.map((e) => JSON.stringify(e)).join("\n") + "\n",
    "utf8",
  );
}

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "specfleet-replay-"));
  await fs.mkdir(path.join(tmp, ".specfleet"), { recursive: true });
  process.chdir(tmp);
});

afterEach(async () => {
  process.chdir(cwd);
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("specfleet log", () => {
  it("prints all events for a session", async () => {
    await seedAudit([
      { ts: "2024-01-01T00:00:00Z", sessionId: "sess-1", agent: "dev", kind: "session.start", payload: {} },
      { ts: "2024-01-01T00:00:01Z", sessionId: "sess-1", agent: "dev", kind: "tool.pre", payload: { tool: "read" } },
      { ts: "2024-01-01T00:00:02Z", sessionId: "sess-1", agent: "dev", kind: "session.end", payload: {} },
    ]);
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await replayCommand("sess-1", {});
    const output = spy.mock.calls.map((c) => c.join(" ")).join("\n");
    spy.mockRestore();
    expect(output).toContain("session.start");
    expect(output).toContain("session.end");
    expect(output).toContain("3 of 3");
  });

  it("respects --from and --limit", async () => {
    await seedAudit([
      { ts: "2024-01-01T00:00:00Z", sessionId: "sess-1", agent: "dev", kind: "session.start", payload: {} },
      { ts: "2024-01-01T00:00:01Z", sessionId: "sess-1", agent: "dev", kind: "tool.pre", payload: { tool: "read" } },
      { ts: "2024-01-01T00:00:02Z", sessionId: "sess-1", agent: "dev", kind: "tool.post", payload: { tool: "read" } },
      { ts: "2024-01-01T00:00:03Z", sessionId: "sess-1", agent: "dev", kind: "session.end", payload: {} },
    ]);
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await replayCommand("sess-1", { from: 1, limit: 2 });
    const output = spy.mock.calls.map((c) => c.join(" ")).join("\n");
    spy.mockRestore();
    expect(output).toContain("2 of 4");
    expect(output).toContain("tool.pre");
    expect(output).toContain("tool.post");
    expect(output).not.toContain("session.start");
    expect(output).not.toContain("session.end");
  });

  it("throws when sessionId missing", async () => {
    await expect(replayCommand("", {})).rejects.toThrow(/sessionId required/);
  });

  it("throws on missing audit file", async () => {
    await expect(replayCommand("nope", {})).rejects.toThrow(/audit file not found/);
  });
});
