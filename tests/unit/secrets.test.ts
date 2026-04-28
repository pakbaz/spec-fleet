import { describe, expect, it } from "vitest";
import { findSecrets, redact } from "../../src/util/secrets.js";

describe("findSecrets — built-in patterns", () => {
  it("detects a github classic PAT", () => {
    const m = findSecrets("token=ghp_" + "A".repeat(36));
    expect(m.length).toBe(1);
    expect(m[0].rule).toBe("github_pat");
  });

  it("detects an AWS access key id", () => {
    const m = findSecrets("AKIAIOSFODNN7EXAMPLE");
    expect(m.find((x) => x.rule === "aws_access_key")).toBeTruthy();
  });

  it("detects an OpenAI key", () => {
    const m = findSecrets("OPENAI_API_KEY=sk-" + "x".repeat(40));
    expect(m.find((x) => x.rule === "openai_key")).toBeTruthy();
  });

  it("detects a private key header", () => {
    const m = findSecrets("-----BEGIN RSA PRIVATE KEY-----");
    expect(m.find((x) => x.rule === "private_key")).toBeTruthy();
  });

  it("detects a JWT", () => {
    const jwt = "eyJ" + "a".repeat(20) + "." + "b".repeat(20) + "." + "c".repeat(20);
    const m = findSecrets(jwt);
    expect(m.find((x) => x.rule === "jwt")).toBeTruthy();
  });

  it("returns nothing for clean text", () => {
    expect(findSecrets("hello world")).toEqual([]);
  });
});

describe("redact", () => {
  it("replaces matches with [REDACTED:<rule>]", () => {
    const pat = "ghp_" + "A".repeat(36);
    const { redacted, matches } = redact(`token=${pat}`);
    expect(matches.length).toBe(1);
    expect(redacted).toContain("[REDACTED:github_pat]");
    expect(redacted).not.toContain(pat);
  });

  it("is a no-op for clean text", () => {
    const { redacted, matches } = redact("nothing to see");
    expect(redacted).toBe("nothing to see");
    expect(matches).toEqual([]);
  });
});
