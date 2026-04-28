import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { scanStagedDiff } from "../../src/commands/precommit-scan.js";
import { installHooksCommand } from "../../src/commands/install-hooks.js";

let tmp: string;
const cwd = process.cwd();

function git(args: string[], opts: { cwd: string }) {
  const r = spawnSync("git", args, { ...opts, encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed (${r.status}): ${r.stderr}`);
  }
  return r.stdout;
}

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "eas-precommit-"));
  git(["init", "-q", "-b", "main"], { cwd: tmp });
  git(["config", "user.email", "test@example.com"], { cwd: tmp });
  git(["config", "user.name", "Test"], { cwd: tmp });
  git(["commit", "--allow-empty", "-q", "-m", "init"], { cwd: tmp });
});
afterEach(async () => {
  process.chdir(cwd);
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("precommit scanStagedDiff", () => {
  it("returns ok when no staged changes", async () => {
    const r = await scanStagedDiff(tmp);
    expect(r.ok).toBe(true);
    expect(r.findings.length).toBe(0);
  });

  it("flags a github PAT in a staged add", async () => {
    const file = path.join(tmp, "config.txt");
    await fs.writeFile(file, "TOKEN=ghp_" + "A".repeat(36) + "\n");
    git(["add", "config.txt"], { cwd: tmp });
    const r = await scanStagedDiff(tmp);
    expect(r.ok).toBe(false);
    expect(r.findings.some((f) => f.rule === "secret:github_pat")).toBe(true);
    expect(r.findings[0].file).toBe("config.txt");
  });

  it("does NOT flag clean staged content", async () => {
    await fs.writeFile(path.join(tmp, "hello.txt"), "hello world\n");
    git(["add", "hello.txt"], { cwd: tmp });
    const r = await scanStagedDiff(tmp);
    expect(r.ok).toBe(true);
  });

  it("respects ip-guard when .eas is present", async () => {
    await fs.mkdir(path.join(tmp, ".eas", "policies"), { recursive: true });
    await fs.mkdir(path.join(tmp, ".eas", "charters"), { recursive: true });
    await fs.writeFile(
      path.join(tmp, ".eas", "policies", "ip-guard.json"),
      JSON.stringify({
        mode: "block",
        patterns: [{ name: "codename", regex: "Project Atlas", flags: "g" }],
      }),
    );
    await fs.writeFile(path.join(tmp, "doc.md"), "We launched Project Atlas\n");
    git(["add", "."], { cwd: tmp });
    const r = await scanStagedDiff(tmp);
    expect(r.ok).toBe(false);
    expect(r.findings.some((f) => f.rule === "ip-guard:codename")).toBe(true);
  });
});

describe("install-hooks command", () => {
  it("writes an executable pre-commit hook", async () => {
    await installHooksCommand({ dir: tmp });
    const hookPath = path.join(tmp, ".git", "hooks", "pre-commit");
    const st = await fs.stat(hookPath);
    expect(st.isFile()).toBe(true);
    // executable bit
    expect(st.mode & 0o111).toBeGreaterThan(0);
    const content = await fs.readFile(hookPath, "utf8");
    expect(content).toMatch(/EAS_SCANNER/);
    expect(content).toMatch(/precommit-scan/);
  });

  it("refuses to overwrite a foreign pre-commit without --force", async () => {
    const hookPath = path.join(tmp, ".git", "hooks", "pre-commit");
    await fs.mkdir(path.dirname(hookPath), { recursive: true });
    await fs.writeFile(hookPath, "#!/bin/sh\necho 'someone else lives here'\n");
    const before = await fs.readFile(hookPath, "utf8");
    await installHooksCommand({ dir: tmp });
    const after = await fs.readFile(hookPath, "utf8");
    expect(after).toBe(before);
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });

  it("overwrites with --force", async () => {
    const hookPath = path.join(tmp, ".git", "hooks", "pre-commit");
    await fs.mkdir(path.dirname(hookPath), { recursive: true });
    await fs.writeFile(hookPath, "#!/bin/sh\necho 'someone else lives here'\n");
    await installHooksCommand({ dir: tmp, force: true });
    const after = await fs.readFile(hookPath, "utf8");
    expect(after).toMatch(/EAS_SCANNER/);
  });
});
