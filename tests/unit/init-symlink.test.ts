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

describe("specfleet init --instruction — symlink rejection (regression)", () => {
  it("refuses to copy a symlinked source", async () => {
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

  it("refuses to copy a directory passed as instruction", async () => {
    const dir = path.join(tmp, "i-am-a-dir");
    await fs.mkdir(dir);
    const project = path.join(tmp, "project");
    await fs.mkdir(project);

    await expect(
      initCommand({ dir: project, nonInteractive: true, instruction: dir }),
    ).rejects.toThrow(/regular file/);
  });

  it("accepts a normal file", async () => {
    const file = path.join(tmp, "instruction.md");
    await fs.writeFile(file, "---\nversion: 1\n---\n# corp", "utf8");
    const project = path.join(tmp, "project");
    await fs.mkdir(project);

    // Should not throw.
    await initCommand({ dir: project, nonInteractive: true, instruction: file });

    const dst = await fs.readFile(path.join(project, ".specfleet", "instruction.md"), "utf8");
    expect(dst).toContain("# corp");
  });
});
