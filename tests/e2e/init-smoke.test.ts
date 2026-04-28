/**
 * Smoke test: run `eas init --non-interactive` in a temp dir and assert that
 * .eas/ + .github/agents/ are populated. We do NOT exercise the SDK here
 * (which would require Copilot auth + real network); that integration is
 * covered manually until we add SDK mocks.
 */
import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { initCommand } from "../../src/commands/init.js";

describe("eas init (non-interactive)", () => {
  it("seeds .eas/ + .github/agents/ in an empty directory", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "eas-init-"));
    await initCommand({ dir, nonInteractive: true });

    // Core .eas/ artifacts
    await expect(fs.stat(path.join(dir, ".eas", "instruction.md"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(dir, ".eas", "charters"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(dir, ".eas", "policies", "secrets.json"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(dir, ".eas", "skills"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(dir, ".eas", "audit"))).resolves.toBeTruthy();

    // Mirror to .github/agents/
    const mirrored = await fs.readdir(path.join(dir, ".github", "agents"));
    expect(mirrored.length).toBeGreaterThan(0);
    expect(mirrored.every((f) => f.endsWith(".agent.md"))).toBe(true);

    // Orchestrator must be mirrored as a flat name
    expect(mirrored).toContain("orchestrator.agent.md");

    // Subagent namespacing flattened with `-`
    const flat = mirrored.find((f) => f.startsWith("dev-frontend"));
    expect(flat).toBeDefined();
  });

  it("is idempotent — re-running does not corrupt files", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "eas-init-"));
    await initCommand({ dir, nonInteractive: true });
    const before = await fs.readFile(path.join(dir, ".eas", "instruction.md"), "utf8");
    await initCommand({ dir, nonInteractive: true });
    const after = await fs.readFile(path.join(dir, ".eas", "instruction.md"), "utf8");
    expect(after).toBe(before);
  });

  it("respects --instruction <path> override", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "eas-init-"));
    const customInstr = path.join(dir, "my-corp.md");
    await fs.writeFile(customInstr, "# Custom Corp Standards\n\nNo PHP allowed.\n", "utf8");
    await initCommand({ dir, nonInteractive: true, instruction: customInstr });
    const instr = await fs.readFile(path.join(dir, ".eas", "instruction.md"), "utf8");
    expect(instr).toContain("No PHP allowed");
  });
});
