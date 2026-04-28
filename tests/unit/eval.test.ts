import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { initCommand } from "../../src/commands/init.js";
import { evalCommand } from "../../src/commands/eval.js";

let tmp: string;
const cwd = process.cwd();

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "specfleet-eval-"));
  await initCommand({ dir: tmp, nonInteractive: true });
  process.chdir(tmp);
  process.env.SPECFLEET_EVAL_MOCK = "1";
});

afterEach(async () => {
  delete process.env.SPECFLEET_EVAL_MOCK;
  process.chdir(cwd);
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("specfleet check --eval (SPECFLEET_EVAL_MOCK=1)", () => {
  it("falls back to starter benchmarks and writes scoreboard", async () => {
    const results = await evalCommand({});
    expect(results.length).toBeGreaterThanOrEqual(5);
    const scoreboard = path.join(tmp, ".specfleet", "eval", "scoreboard.jsonl");
    const raw = await fs.readFile(scoreboard, "utf8");
    const lines = raw.trim().split("\n").filter(Boolean);
    expect(lines.length).toBe(results.length);
    for (const line of lines) {
      const row = JSON.parse(line) as { id: string; charter: string; pass: boolean };
      expect(typeof row.pass).toBe("boolean");
    }
  });

  it("filters by --charter", async () => {
    const results = await evalCommand({ charter: "dev" });
    expect(results.length).toBe(1);
    expect(results[0]!.charter).toBe("dev");
  });

  it("respects --limit", async () => {
    const results = await evalCommand({ limit: 2 });
    expect(results.length).toBe(2);
  });

  it("scores not_contains forbidden words", async () => {
    // Create a custom benchmark that should fail because the prompt itself contains 'forbidden'.
    const benchDir = path.join(tmp, ".specfleet", "eval", "benchmarks");
    await fs.mkdir(benchDir, { recursive: true });
    await fs.writeFile(
      path.join(benchDir, "fails.md"),
      `---\nid: must-fail\ncharter: dev\nprompt: "this contains BADWORD inside"\nexpect:\n  not_contains: ["BADWORD"]\n---\nbody\n`,
      "utf8",
    );
    const results = await evalCommand({});
    const failed = results.find((r) => r.id === "must-fail");
    expect(failed).toBeTruthy();
    expect(failed!.pass).toBe(false);
    expect(failed!.failures.some((f) => f.includes("BADWORD"))).toBe(true);
  });
});
