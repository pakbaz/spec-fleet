import { describe, expect, it } from "vitest";
import { CharterSchema } from "../../src/schema/index.js";

describe("CharterSchema", () => {
  const base = {
    name: "dev/frontend",
    displayName: "Frontend Subagent",
    role: "dev",
    tier: "subagent",
    description: "Builds UI components.",
    body: "You are the Frontend subagent. Build accessible, tested React UI components.",
  };

  it("accepts a minimal valid charter and applies defaults", () => {
    const c = CharterSchema.parse(base);
    expect(c.maxContextTokens).toBe(80_000);
    expect(c.allowedTools).toEqual([]);
    expect(c.spawns).toEqual([]);
    expect(c.requiresHumanGate).toBe(false);
  });

  it("rejects names that are not kebab-case", () => {
    expect(() => CharterSchema.parse({ ...base, name: "Dev/Frontend" })).toThrow();
    expect(() => CharterSchema.parse({ ...base, name: "dev_frontend" })).toThrow();
    expect(() => CharterSchema.parse({ ...base, name: "1dev" })).toThrow();
  });

  it("accepts namespaced names with '/'", () => {
    expect(() => CharterSchema.parse({ ...base, name: "dev/frontend/react" })).not.toThrow();
  });

  it("enforces the 95K hard ceiling on maxContextTokens", () => {
    expect(() => CharterSchema.parse({ ...base, maxContextTokens: 96_000 })).toThrow();
    expect(() => CharterSchema.parse({ ...base, maxContextTokens: 95_000 })).not.toThrow();
  });

  it("rejects invalid roles and tiers", () => {
    expect(() => CharterSchema.parse({ ...base, role: "ceo" })).toThrow();
    expect(() => CharterSchema.parse({ ...base, tier: "captain" })).toThrow();
  });

  it("requires a body of at least 20 characters", () => {
    expect(() => CharterSchema.parse({ ...base, body: "short" })).toThrow();
  });
});
