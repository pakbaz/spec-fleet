import { describe, expect, it } from "vitest";
import { hasSignature, verifyCharterSignature } from "../../src/util/sign.js";
import { CharterSchema, type Charter } from "../../src/schema/index.js";

const baseCharter = (overrides: Partial<Charter> = {}): Charter => {
  const raw = {
    name: "dev/frontend",
    displayName: "Frontend",
    role: "dev",
    tier: "subagent",
    description: "Builds UI components.",
    body: "You are the frontend subagent. Build accessible, tested React UI components.",
    ...overrides,
  };
  return CharterSchema.parse(raw);
};

describe("charter signature schema", () => {
  it("accepts a charter without signature fields", () => {
    const c = baseCharter();
    expect(c.signature).toBeUndefined();
    expect(c.signed_by).toBeUndefined();
  });
  it("accepts an optional signature + signed_by", () => {
    const c = baseCharter({ signature: "abc123", signed_by: "ops@example.com" });
    expect(c.signature).toBe("abc123");
    expect(c.signed_by).toBe("ops@example.com");
  });
});

describe("verifyCharterSignature (v0.2 stub)", () => {
  it("returns no-signature when none present", () => {
    const r = verifyCharterSignature(baseCharter(), null);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.reason).toBe("no-signature");
  });
  it("returns no-trusted-signers when signed but no trust file", () => {
    const r = verifyCharterSignature(baseCharter({ signature: "x", signed_by: "y" }), null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no-trusted-signers");
  });
  it("returns not-implemented when signed and trust file present", () => {
    const r = verifyCharterSignature(
      baseCharter({ signature: "x", signed_by: "ops@example.com" }),
      { keys: [{ id: "ops@example.com", pubkey: "abc", alg: "ed25519" }] },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("not-implemented");
  });
});

describe("hasSignature", () => {
  it("returns true only when signature is a non-empty string", () => {
    expect(hasSignature(baseCharter())).toBe(false);
    expect(hasSignature(baseCharter({ signature: "" }))).toBe(false);
    expect(hasSignature(baseCharter({ signature: "x" }))).toBe(true);
  });
});
