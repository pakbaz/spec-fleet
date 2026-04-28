import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { initCommand } from "../../src/commands/init.js";
import { sreCommand } from "../../src/commands/sre.js";

let tmp: string;
const cwd = process.cwd();

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "specfleet-sre-"));
  await initCommand({ dir: tmp, nonInteractive: true });
  process.chdir(tmp);
  process.env.SPECFLEET_SRE_MOCK = "1";
});

afterEach(async () => {
  delete process.env.SPECFLEET_SRE_MOCK;
  process.chdir(cwd);
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("specfleet sre triage", () => {
  it("writes a triage report under .specfleet/triage/", async () => {
    // Seed an audit file with one error event.
    const auditDir = path.join(tmp, ".specfleet", "audit");
    await fs.mkdir(auditDir, { recursive: true });
    const evt = {
      ts: new Date().toISOString(),
      sessionId: "sess-1",
      agent: "dev",
      kind: "error",
      payload: { ctx: "tool", msg: "boom" },
    };
    await fs.writeFile(path.join(auditDir, "sess-1.jsonl"), JSON.stringify(evt) + "\n", "utf8");

    await sreCommand("triage", {});
    const triageDir = path.join(tmp, ".specfleet", "triage");
    const entries = await fs.readdir(triageDir);
    const md = entries.find((f) => f.endsWith(".md"));
    expect(md).toBeTruthy();
    const content = await fs.readFile(path.join(triageDir, md!), "utf8");
    expect(content).toContain("Triage");
    expect(content).toContain("1 failure(s)");
  });

  it("uses --sarif path when provided", async () => {
    const sarif = path.join(tmp, "scan.sarif");
    await fs.writeFile(
      sarif,
      JSON.stringify({ runs: [{ tool: { driver: { name: "fakelinter" } }, results: [] }] }),
      "utf8",
    );
    await sreCommand("triage", { sarif });
    const triageDir = path.join(tmp, ".specfleet", "triage");
    const entries = await fs.readdir(triageDir);
    expect(entries.find((f) => f.endsWith(".md"))).toBeTruthy();
  });

  it("rejects unknown action", async () => {
    await expect(sreCommand("bogus" as "triage", {})).rejects.toThrow(/Unknown sre action/);
  });
});
