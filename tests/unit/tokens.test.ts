import { describe, expect, it } from "vitest";
import {
  checkBudget,
  estimateMessagesTokens,
  estimateTokens,
  TokenBudgetExceededError,
} from "../../src/util/tokens.js";

describe("token estimation", () => {
  it("returns 0 for empty input", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("estimates ~chars/4", () => {
    expect(estimateTokens("a".repeat(40))).toBe(10);
  });

  it("sums message tokens with per-message overhead", () => {
    const total = estimateMessagesTokens(["abcd", "efgh"]);
    // 1 + 4 + 1 + 4 = 10
    expect(total).toBe(10);
  });
});

describe("checkBudget", () => {
  it("warns at 80% of cap", () => {
    const r = checkBudget(80, 100);
    expect(r.warning).toBe(true);
    expect(r.warnAt).toBe(80);
    expect(r.remaining).toBe(20);
  });

  it("does not warn under 80%", () => {
    const r = checkBudget(79, 100);
    expect(r.warning).toBe(false);
  });

  it("reports negative remaining when used exceeds cap", () => {
    const r = checkBudget(150, 100);
    expect(r.remaining).toBe(-50);
    expect(r.warning).toBe(true);
  });
});

describe("TokenBudgetExceededError", () => {
  it("captures agent, used, cap and includes them in the message", () => {
    const e = new TokenBudgetExceededError("dev/frontend", 96_000, 80_000);
    expect(e.agent).toBe("dev/frontend");
    expect(e.used).toBe(96_000);
    expect(e.cap).toBe(80_000);
    expect(e.message).toContain("dev/frontend");
    expect(e.message).toContain("96000");
  });
});
