import { describe, expect, it } from "vitest";
import { defaultCharterForPhase } from "../../src/commands/_phase.js";

describe("phase defaults", () => {
  it("routes planning and review phases to architect by default", () => {
    expect(defaultCharterForPhase("plan")).toBe("architect");
    expect(defaultCharterForPhase("analyze")).toBe("architect");
    expect(defaultCharterForPhase("review")).toBe("architect");
  });

  it("keeps orchestration, implementation, and checklist roles distinct", () => {
    expect(defaultCharterForPhase("specify")).toBe("orchestrator");
    expect(defaultCharterForPhase("clarify")).toBe("orchestrator");
    expect(defaultCharterForPhase("tasks")).toBe("orchestrator");
    expect(defaultCharterForPhase("implement")).toBe("dev");
    expect(defaultCharterForPhase("checklist")).toBe("compliance");
  });
});
