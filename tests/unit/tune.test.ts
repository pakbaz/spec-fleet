import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { initCommand } from "../../src/commands/init.js";
import { tuneCommand } from "../../src/commands/tune.js";

let tmp: string;
const cwd = process.cwd();

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "eas-tune-"));
  await initCommand({ dir: tmp, nonInteractive: true });
  process.chdir(tmp);
});

afterEach(async () => {
  process.chdir(cwd);
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("eas tune", () => {
  it("returns null when scoreboard is empty", async () => {
    const out = await tuneCommand({});
    expect(out).toBeNull();
  });

  it("writes a diff for the worst charters", async () => {
    const evalDir = path.join(tmp, ".eas", "eval");
    await fs.mkdir(evalDir, { recursive: true });
    const rows = [
      { ts: "2024-01-01T00:00:00Z", id: "a", charter: "dev", pass: false, failures: ['forbidden:"password"'], duration_ms: 10 },
      { ts: "2024-01-01T00:01:00Z", id: "b", charter: "dev", pass: false, failures: ["tool_calls=99>10"], duration_ms: 10 },
      { ts: "2024-01-01T00:02:00Z", id: "c", charter: "test", pass: false, failures: ['forbidden:"skip"'], duration_ms: 10 },
      { ts: "2024-01-01T00:03:00Z", id: "d", charter: "compliance", pass: true, failures: [], duration_ms: 10 },
    ];
    await fs.writeFile(
      path.join(evalDir, "scoreboard.jsonl"),
      rows.map((r) => JSON.stringify(r)).join("\n") + "\n",
      "utf8",
    );

    const out = await tuneCommand({});
    expect(out).toBeTruthy();
    const raw = await fs.readFile(out!, "utf8");
    expect(raw).toContain("Must avoid: password");
    expect(raw).toContain("Must avoid: skip");
    expect(raw).toContain("tool-call efficient");
    expect(raw).toContain("charter:dev");
    expect(raw).toContain("charter:test");
    // compliance was passing, so must NOT appear
    expect(raw).not.toContain("charter:compliance");
  });

  it("--since filters older rows", async () => {
    const evalDir = path.join(tmp, ".eas", "eval");
    await fs.mkdir(evalDir, { recursive: true });
    const rows = [
      { ts: "2023-01-01T00:00:00Z", id: "old", charter: "dev", pass: false, failures: ['forbidden:"x"'], duration_ms: 10 },
    ];
    await fs.writeFile(
      path.join(evalDir, "scoreboard.jsonl"),
      rows.map((r) => JSON.stringify(r)).join("\n") + "\n",
      "utf8",
    );
    const out = await tuneCommand({ since: "2024-01-01T00:00:00Z" });
    expect(out).toBeNull();
  });
});
