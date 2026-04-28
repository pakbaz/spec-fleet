import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { specCommand, readSpec } from "../../src/commands/spec.js";

let tmp: string;
const cwd = process.cwd();

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "eas-spec-"));
  await fs.mkdir(path.join(tmp, ".eas"), { recursive: true });
  process.chdir(tmp);
});

afterEach(async () => {
  process.chdir(cwd);
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("eas spec", () => {
  it("creates a spec from the template", async () => {
    await specCommand("new", { name: "Payment Flow" });
    const file = path.join(tmp, ".eas", "specs", "payment-flow.spec.md");
    const raw = await fs.readFile(file, "utf8");
    expect(raw).toContain("id: payment-flow");
    expect(raw).toContain("title: Payment Flow");
    expect(raw).toContain("status: draft");
    expect(raw).toContain("## Why");
    expect(raw).toContain("## Done When");
  });

  it("rejects duplicate spec creation", async () => {
    await specCommand("new", { name: "alpha" });
    await expect(specCommand("new", { name: "alpha" })).rejects.toThrow(/already exists/);
  });

  it("lists specs", async () => {
    await specCommand("new", { name: "alpha" });
    await specCommand("new", { name: "beta" });
    // list just prints — verify it does not throw
    await specCommand("list", {});
  });

  it("readSpec returns spec content by id", async () => {
    await specCommand("new", { name: "gamma" });
    const raw = await readSpec("gamma");
    expect(raw).toContain("title: gamma");
  });

  it("readSpec throws on missing", async () => {
    await expect(readSpec("does-not-exist")).rejects.toThrow(/spec not found/);
  });
});
