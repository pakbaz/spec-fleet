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

  // Regression test for the off-by-one bug fixed in v0.2: the previous
  // implementation used `m.preview.length + 1` (preview is only ~7 chars),
  // leaving most of every secret visible after redaction.
  it("removes the ENTIRE secret, not just a prefix (regression for v0.1 leak)", () => {
    const pat = "ghp_" + "B".repeat(36);
    const { redacted } = redact(`before ${pat} after`);
    expect(redacted).toBe("before [REDACTED:github_pat] after");
    // No 4+ character substring of the secret survives in the output.
    for (let i = 0; i + 4 <= pat.length; i++) {
      expect(redacted).not.toContain(pat.slice(i, i + 4));
    }
  });

  it("redacts every built-in pattern with no leakage", () => {
    const samples: Array<[string, string]> = [
      ["github_pat", "ghp_" + "C".repeat(36)],
      ["github_pat_v2", "github_pat_" + "D".repeat(82)],
      ["aws_access_key", "AKIA" + "E".repeat(16)],
      ["openai_key", "sk-" + "F".repeat(40)],
      ["slack_token", "xoxb-" + "G".repeat(20)],
      ["jwt", "eyJ" + "H".repeat(20) + "." + "I".repeat(20) + "." + "J".repeat(20)],
      ["private_key", "-----BEGIN RSA PRIVATE KEY-----"],
    ];
    for (const [rule, secret] of samples) {
      const { redacted, matches } = redact(`x ${secret} y`);
      expect(matches.find((m) => m.rule === rule), `rule ${rule} missed`).toBeTruthy();
      // Strip the redaction markers themselves before checking — rule names
      // (e.g. "github_pat_v2") legitimately appear inside "[REDACTED:...]".
      const stripped = redacted.replace(/\[REDACTED:[^\]]+\]/g, "");
      // No 5+ char substring of the secret leaks past the redaction.
      for (let i = 0; i + 5 <= secret.length; i++) {
        const window = secret.slice(i, i + 5);
        // Skip pure-punctuation windows (e.g. "-----" in private key header).
        if (/^[-= ]+$/.test(window)) continue;
        expect(stripped, `leaked ${rule} window "${window}"`).not.toContain(window);
      }
    }
  });

  it("handles multiple secrets in one string without index drift", () => {
    const a = "ghp_" + "A".repeat(36);
    const b = "AKIA" + "B".repeat(16);
    const { redacted, matches } = redact(`one=${a}; two=${b}; end`);
    expect(matches.length).toBe(2);
    expect(redacted).toBe("one=[REDACTED:github_pat]; two=[REDACTED:aws_access_key]; end");
  });
});
