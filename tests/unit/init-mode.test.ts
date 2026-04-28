import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { initCommand } from "../../src/commands/init.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "specfleet-init-mode-"));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("specfleet init — v0.4 mode detection & flags", () => {
  it("greenfield: empty dir + --non-interactive scaffolds without prompting", async () => {
    await initCommand({ dir: tmp, nonInteractive: true });
    const specFleetDir = path.join(tmp, ".specfleet");
    expect((await fs.stat(specFleetDir)).isDirectory()).toBe(true);
    // Charter mirroring happens
    const agents = await fs.readdir(path.join(tmp, ".github", "agents"));
    expect(agents.length).toBeGreaterThan(0);
  });

  it("upgrade: re-running with --non-interactive on an existing .specfleet/ preserves user files", async () => {
    await initCommand({ dir: tmp, nonInteractive: true });
    // User edits a skill — must survive upgrade (skills/ is non-charter)
    const userFile = path.join(tmp, ".specfleet", "skills", "user-marker.md");
    await fs.writeFile(userFile, "marker", "utf8");
    await initCommand({ dir: tmp, nonInteractive: true });
    const stillThere = await fs.readFile(userFile, "utf8").catch(() => null);
    expect(stillThere).toBe("marker");
  });

  it("explicit --mode upgrade works on existing .specfleet/", async () => {
    await initCommand({ dir: tmp, nonInteractive: true });
    await initCommand({ dir: tmp, nonInteractive: true, mode: "upgrade" });
    expect((await fs.stat(path.join(tmp, ".specfleet"))).isDirectory()).toBe(true);
  });

  it("legacy .eas/ is migrated to .specfleet/ on upgrade", async () => {
    const legacyDir = path.join(tmp, ".eas");
    await fs.mkdir(path.join(legacyDir, "skills"), { recursive: true });
    await fs.writeFile(path.join(legacyDir, "skills", "legacy.md"), "legacy", "utf8");

    await initCommand({ dir: tmp, nonInteractive: true, mode: "upgrade" });

    await expect(fs.readFile(path.join(tmp, ".specfleet", "skills", "legacy.md"), "utf8")).resolves.toBe(
      "legacy",
    );
    await expect(fs.stat(legacyDir)).resolves.toBeTruthy();
  });

  it("--mode overwrite without --force throws", async () => {
    await initCommand({ dir: tmp, nonInteractive: true });
    await expect(
      initCommand({ dir: tmp, nonInteractive: true, mode: "overwrite" }),
    ).rejects.toThrow(/--force/);
  });

  it("--mode overwrite + --force resets .specfleet/", async () => {
    await initCommand({ dir: tmp, nonInteractive: true });
    const stale = path.join(tmp, ".specfleet", "skills", "stale-marker.md");
    await fs.writeFile(stale, "stale", "utf8");
    await initCommand({ dir: tmp, nonInteractive: true, mode: "overwrite", force: true });
    const gone = await fs.readFile(stale, "utf8").catch(() => null);
    expect(gone).toBe(null);
  });

  it("--no-hooks suppresses hook install even when .git/ exists", async () => {
    await fs.mkdir(path.join(tmp, ".git"), { recursive: true });
    await initCommand({ dir: tmp, nonInteractive: true, noHooks: true });
    const hookExists = await fs
      .access(path.join(tmp, ".git", "hooks", "pre-commit"))
      .then(() => true)
      .catch(() => false);
    expect(hookExists).toBe(false);
  });

  it("auto-installs git hook when .git/ is present and --no-hooks is absent", async () => {
    await fs.mkdir(path.join(tmp, ".git", "hooks"), { recursive: true });
    await initCommand({ dir: tmp, nonInteractive: true });
    const hook = await fs.readFile(path.join(tmp, ".git", "hooks", "pre-commit"), "utf8");
    expect(hook).toContain("SPECFLEET_SCANNER");
    expect(hook).toContain("specfleet check --staged");
  });

  it("--hooks-only skips template scaffolding", async () => {
    await fs.mkdir(path.join(tmp, ".git", "hooks"), { recursive: true });
    await initCommand({ dir: tmp, hooksOnly: true });
    const specFleetExists = await fs
      .access(path.join(tmp, ".specfleet"))
      .then(() => true)
      .catch(() => false);
    expect(specFleetExists).toBe(false);
    const hookExists = await fs
      .access(path.join(tmp, ".git", "hooks", "pre-commit"))
      .then(() => true)
      .catch(() => false);
    expect(hookExists).toBe(true);
  });
});
