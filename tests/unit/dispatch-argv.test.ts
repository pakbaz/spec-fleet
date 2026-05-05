import { describe, expect, it } from "vitest";
import { buildArgv } from "../../src/runtime/dispatch.js";

describe("buildArgv — Copilot CLI argument shaping", () => {
  it("produces -p - by default so the prompt is read from stdin", () => {
    const argv = buildArgv({ prompt: "anything" });
    expect(argv).toContain("-p");
    expect(argv).toContain("-");
  });

  it("includes --no-interactive when nonInteractive is true", () => {
    const argv = buildArgv({ prompt: "x", nonInteractive: true });
    expect(argv).toContain("--no-interactive");
  });

  it("emits one --allow-tool flag per tool", () => {
    const argv = buildArgv({ prompt: "x", allowTool: ["read", "write", "shell"] });
    const allowFlags = argv.filter((a) => a === "--allow-tool");
    expect(allowFlags.length).toBe(3);
    expect(argv).toContain("read");
    expect(argv).toContain("write");
    expect(argv).toContain("shell");
  });

  it("forwards agent and model when set", () => {
    const argv = buildArgv({ prompt: "x", agent: "dev", model: "claude-sonnet-4.5" });
    const ai = argv.indexOf("--agent");
    const mi = argv.indexOf("--model");
    expect(ai).toBeGreaterThan(-1);
    expect(argv[ai + 1]).toBe("dev");
    expect(mi).toBeGreaterThan(-1);
    expect(argv[mi + 1]).toBe("claude-sonnet-4.5");
  });

  it("omits agent/model flags when not provided", () => {
    const argv = buildArgv({ prompt: "x" });
    expect(argv).not.toContain("--agent");
    expect(argv).not.toContain("--model");
  });
});
