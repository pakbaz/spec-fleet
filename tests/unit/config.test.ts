import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { initCommand } from "../../src/commands/init.js";
import { configCommand } from "../../src/commands/config.js";

let tmp: string;
let cwd: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "specfleet-config-"));
  await initCommand({ dir: tmp, nonInteractive: true });
  cwd = process.cwd();
  process.chdir(tmp);
});

afterEach(async () => {
  process.chdir(cwd);
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("specfleet config", () => {
  it("list prints a header and at least one charter row", async () => {
    const log: string[] = [];
    const orig = console.log;
    console.log = (...args: unknown[]) => {
      log.push(args.map(String).join(" "));
    };
    try {
      await configCommand("list", undefined);
    } finally {
      console.log = orig;
    }
    const all = log.join("\n");
    expect(all).toMatch(/KIND/);
    expect(all).toMatch(/orchestrator/);
    expect(all).toMatch(/charter/);
  });

  it("show orchestrator prints the instruction body", async () => {
    const orig = process.stdout.write.bind(process.stdout);
    let captured = "";
    (process.stdout.write as unknown as (s: string) => boolean) = (s: string) => {
      captured += s;
      return true;
    };
    const origLog = console.log;
    console.log = () => {};
    try {
      await configCommand("show", "orchestrator");
    } finally {
      process.stdout.write = orig;
      console.log = origLog;
    }
    expect(captured.length).toBeGreaterThan(10);
  });

  it("validate succeeds on a freshly-init'd repo", async () => {
    process.exitCode = 0;
    const origLog = console.log;
    console.log = () => {};
    try {
      await configCommand("validate", undefined);
    } finally {
      console.log = origLog;
    }
    expect(process.exitCode).toBe(0);
  });

  it("new charter <name> creates a file", async () => {
    const origLog = console.log;
    console.log = () => {};
    try {
      await configCommand("new", undefined, { kind: "charter", name: "my-test-role" });
    } finally {
      console.log = origLog;
    }
    const file = path.join(tmp, ".specfleet", "charters", "my-test-role.charter.md");
    expect((await fs.stat(file)).isFile()).toBe(true);
  });

  it("new policy <name> creates a JSON file", async () => {
    const origLog = console.log;
    console.log = () => {};
    try {
      await configCommand("new", undefined, { kind: "policy", name: "custom" });
    } finally {
      console.log = origLog;
    }
    const file = path.join(tmp, ".specfleet", "policies", "custom.json");
    const raw = await fs.readFile(file, "utf8");
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it("new with no kind/name throws helpfully", async () => {
    await expect(configCommand("new", undefined, {})).rejects.toThrow(/usage/);
  });

  it("show on an unknown target throws", async () => {
    await expect(configCommand("show", "definitely-not-a-real-charter")).rejects.toThrow(
      /unknown target/,
    );
  });

  it("diff runs without throwing on a fresh init", async () => {
    const origLog = console.log;
    console.log = () => {};
    try {
      await configCommand("diff", undefined);
    } finally {
      console.log = origLog;
    }
  });
});
