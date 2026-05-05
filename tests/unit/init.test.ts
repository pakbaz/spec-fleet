import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { initCommand } from "../../src/commands/init.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "specfleet-init-"));
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("specfleet init (v0.6)", () => {
  it("scaffolds a greenfield workspace with charters mirrored to .github/agents/", async () => {
    await initCommand({ dir: tmp, nonInteractive: true });
    expect((await fs.stat(path.join(tmp, ".specfleet"))).isDirectory()).toBe(true);
    expect((await fs.stat(path.join(tmp, ".specfleet", "instruction.md"))).isFile()).toBe(true);
    expect((await fs.stat(path.join(tmp, ".specfleet", "config.json"))).isFile()).toBe(true);
    const agents = await fs.readdir(path.join(tmp, ".github", "agents"));
    // 7 charters → 7 mirrored .agent.md files.
    expect(agents.filter((f) => f.endsWith(".agent.md")).length).toBe(7);
  });

  it("seeds the eight pipeline prompts under .github/prompts/", async () => {
    await initCommand({ dir: tmp, nonInteractive: true });
    const prompts = await fs.readdir(path.join(tmp, ".github", "prompts"));
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
  });

  it("writes a config.json with the cross-model defaults", async () => {
    await initCommand({ dir: tmp, nonInteractive: true });
    const cfg = JSON.parse(
      await fs.readFile(path.join(tmp, ".specfleet", "config.json"), "utf8"),
    );
    expect(cfg.models.default).toBe("claude-sonnet-4.5");
    expect(cfg.models.review).toBe("gpt-5.1");
  });

  it("re-running init preserves user-authored skill files", async () => {
    await initCommand({ dir: tmp, nonInteractive: true });
    const userFile = path.join(tmp, ".specfleet", "skills", "user-marker.md");
    await fs.writeFile(userFile, "marker", "utf8");
    await initCommand({ dir: tmp, nonInteractive: true });
    expect(await fs.readFile(userFile, "utf8")).toBe("marker");
  });

  it("--instruction rejects symlinks", async () => {
    const real = path.join(tmp, "real.md");
    await fs.writeFile(real, "# real", "utf8");
    const link = path.join(tmp, "link.md");
    await fs.symlink(real, link);
    const project = path.join(tmp, "project");
    await fs.mkdir(project);
    await expect(
      initCommand({ dir: project, nonInteractive: true, instruction: link }),
    ).rejects.toThrow(/symlink/);
  });

  it("--instruction rejects directories", async () => {
    const d = path.join(tmp, "i-am-a-dir");
    await fs.mkdir(d);
    const project = path.join(tmp, "project");
    await fs.mkdir(project);
    await expect(
      initCommand({ dir: project, nonInteractive: true, instruction: d }),
    ).rejects.toThrow(/regular file/);
  });
});
