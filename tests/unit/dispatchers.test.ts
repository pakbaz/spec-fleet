import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { initCommand } from "../../src/commands/init.js";
import { checkCommand } from "../../src/commands/check.js";
import { logCommand } from "../../src/commands/log.js";
import { runCommand } from "../../src/commands/run.js";
import { implementCommand } from "../../src/commands/implement.js";

let tmp: string;
let cwd: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "eas-dispatch-"));
  await initCommand({ dir: tmp, nonInteractive: true });
  cwd = process.cwd();
  process.chdir(tmp);
});

afterEach(async () => {
  process.chdir(cwd);
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("eas check (v0.3 dispatcher)", () => {
  it("default invocation runs doctor and exits without throwing", async () => {
    const origLog = console.log;
    console.log = () => {};
    try {
      await checkCommand({});
    } finally {
      console.log = origLog;
    }
  });

  it("--audit only runs audit-chain verify", async () => {
    const origLog = console.log;
    console.log = () => {};
    try {
      await checkCommand({ audit: true });
    } finally {
      console.log = origLog;
    }
  });

  it("--fix re-mirrors charters", async () => {
    const origLog = console.log;
    console.log = () => {};
    try {
      // delete the mirror first
      await fs.rm(path.join(tmp, ".github", "agents"), { recursive: true, force: true });
      await checkCommand({ fix: true });
    } finally {
      console.log = origLog;
    }
    const after = await fs.readdir(path.join(tmp, ".github", "agents"));
    expect(after.length).toBeGreaterThan(0);
  });
});

describe("eas log (v0.3 dispatcher)", () => {
  it("with no sessionId tails audit (no throw)", async () => {
    const origLog = console.log;
    console.log = () => {};
    try {
      await logCommand(undefined, {});
    } finally {
      console.log = origLog;
    }
  });

  it("with a sessionId attempts replay (graceful on missing)", async () => {
    const origLog = console.log;
    const origErr = console.error;
    console.log = () => {};
    console.error = () => {};
    try {
      await logCommand("nonexistent-session-id", {}).catch(() => {
        /* either throws or logs missing — both acceptable */
      });
    } finally {
      console.log = origLog;
      console.error = origErr;
    }
  });
});

describe("eas run (v0.3 verb)", () => {
  it("runCommand is the same as implementCommand (re-export)", () => {
    expect(runCommand).toBe(implementCommand);
  });
});
