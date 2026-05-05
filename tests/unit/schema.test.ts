import { describe, expect, it } from "vitest";
import { CharterSchema, SpecFrontmatterSchema } from "../../src/schema/index.js";

describe("CharterSchema (v0.6 — task contract)", () => {
  const base = {
    name: "dev",
    description: "Implementer charter.",
    body: "## Goal\nDo the thing.\n## Constraints\nDo not break the build.",
  };

  it("accepts a minimal charter and applies the lean defaults", () => {
    const c = CharterSchema.parse(base);
    expect(c.maxContextTokens).toBe(60_000);
    expect(c.allowedTools).toEqual([]);
    expect(c.mcpServers).toEqual([]);
    expect(c.instructionsApplyTo).toEqual([]);
  });

  it("requires kebab-case names (no slashes — subagents are runtime-spawned)", () => {
    expect(() => CharterSchema.parse({ ...base, name: "Dev" })).toThrow();
    expect(() => CharterSchema.parse({ ...base, name: "dev/frontend" })).toThrow();
    expect(() => CharterSchema.parse({ ...base, name: "dev_frontend" })).toThrow();
    expect(() => CharterSchema.parse({ ...base, name: "1dev" })).toThrow();
  });

  it("enforces the 95K hard ceiling on maxContextTokens", () => {
    expect(() => CharterSchema.parse({ ...base, maxContextTokens: 96_000 })).toThrow();
    expect(() => CharterSchema.parse({ ...base, maxContextTokens: 95_000 })).not.toThrow();
  });

  it("rejects empty bodies and short descriptions", () => {
    expect(() => CharterSchema.parse({ ...base, body: "tiny" })).toThrow();
    expect(() => CharterSchema.parse({ ...base, description: "" })).toThrow();
  });
});

describe("SpecFrontmatterSchema", () => {
  it("accepts a draft spec stub", () => {
    const fm = SpecFrontmatterSchema.parse({
      id: "payment-flow",
      title: "Payment flow",
      status: "draft",
    });
    expect(fm.status).toBe("draft");
  });

  it("rejects unknown statuses", () => {
    expect(() =>
      SpecFrontmatterSchema.parse({
        id: "x",
        title: "x",
        status: "pending-review-magic",
      }),
    ).toThrow();
  });
});
