/**
 * Smoke test: run `specfleet init --non-interactive` in a temp dir and assert
 * the v0.6 layout is in place. We do not exercise the Copilot CLI itself
 * (would require auth + network); that is covered separately with a stubbed
 * binary.
 */
import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { initCommand } from "../../src/commands/init.js";

describe("specfleet init (non-interactive)", () => {
  it("seeds .specfleet/ + .github/{agents,prompts,instructions}/ in an empty directory", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "specfleet-init-"));
    await initCommand({ dir, nonInteractive: true });

    // Core .specfleet/ artefacts (v0.6 layout — no audit/, no policies/packs requirement)
    await expect(fs.stat(path.join(dir, ".specfleet", "instruction.md"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(dir, ".specfleet", "config.json"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(dir, ".specfleet", "charters"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(dir, ".specfleet", "skills"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(dir, ".specfleet", "specs"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(dir, ".specfleet", "scratchpad"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(dir, ".specfleet", "runs"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(dir, ".specfleet", "policies"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(fs.stat(path.join(dir, ".specfleet", "benchmarks"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(fs.stat(path.join(dir, ".specfleet", "decisions.md"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(fs.stat(path.join(dir, ".specfleet", "spec.md"))).rejects.toMatchObject({ code: "ENOENT" });

    // .github/ scaffolding
    const agents = await fs.readdir(path.join(dir, ".github", "agents"));
    expect(agents.filter((f) => f.endsWith(".agent.md")).length).toBe(7);
    expect(agents).toContain("orchestrator.agent.md");

    const prompts = await fs.readdir(path.join(dir, ".github", "prompts"));
    for (const phase of [
      "specify",
      "clarify",
      "plan",
      "tasks",
      "analyze",
      "implement",
      "review",
      "checklist",
    ]) {
      expect(prompts).toContain(`specfleet.${phase}.prompt.md`);
    }

    const instructions = await fs.readdir(path.join(dir, ".github", "instructions"));
    expect(instructions).toContain("coding-style.instructions.md");
  });

  it("is idempotent — re-running does not corrupt files", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "specfleet-init-"));
    await initCommand({ dir, nonInteractive: true });
    const before = await fs.readFile(path.join(dir, ".specfleet", "instruction.md"), "utf8");
    await initCommand({ dir, nonInteractive: true });
    const after = await fs.readFile(path.join(dir, ".specfleet", "instruction.md"), "utf8");
    expect(after).toBe(before);
  });

  it("respects --instruction <path> override", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "specfleet-init-"));
    const customInstr = path.join(dir, "my-corp.md");
    await fs.writeFile(customInstr, "# Custom Corp Standards\n\nNo PHP allowed.\n", "utf8");
    await initCommand({ dir, nonInteractive: true, instruction: customInstr });
    const instr = await fs.readFile(path.join(dir, ".specfleet", "instruction.md"), "utf8");
    expect(instr).toContain("No PHP allowed");
  });
});
