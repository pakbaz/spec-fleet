import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { charterCommand } from "../../src/commands/charter.js";

let tmp: string;
const cwd = process.cwd();

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "specfleet-charter-"));
  await fs.mkdir(path.join(tmp, ".specfleet", "charters", "subagents"), { recursive: true });
  process.chdir(tmp);
});

afterEach(async () => {
  process.chdir(cwd);
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("specfleet config new charter — name validation (path traversal regression)", () => {
  it("rejects '..' segments", async () => {
    await expect(charterCommand("new", { name: "../../etc/passwd" })).rejects.toThrow(
      /Invalid charter name/,
    );
  });

  it("rejects absolute paths", async () => {
    await expect(charterCommand("new", { name: "/etc/passwd" })).rejects.toThrow(
      /Invalid charter name/,
    );
  });

  it("rejects names containing parent traversal mixed with valid segments", async () => {
    await expect(charterCommand("new", { name: "dev/../../../foo" })).rejects.toThrow(
      /Invalid charter name/,
    );
  });

  it("rejects names with spaces or special chars", async () => {
    await expect(charterCommand("new", { name: "dev frontend" })).rejects.toThrow(
      /Invalid charter name/,
    );
    await expect(charterCommand("new", { name: "dev$shell" })).rejects.toThrow(
      /Invalid charter name/,
    );
  });

  it("accepts valid kebab-case role names", async () => {
    await charterCommand("new", { name: "data-science" });
    const exists = await fs
      .stat(path.join(tmp, ".specfleet", "charters", "data-science.charter.md"))
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
  });

  it("accepts valid subagent paths", async () => {
    await charterCommand("new", { name: "dev/frontend" });
    const exists = await fs
      .stat(path.join(tmp, ".specfleet", "charters", "subagents", "dev", "frontend.charter.md"))
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
  });
});
