/**
 * Token estimation. We avoid heavyweight tiktoken at runtime; the rough heuristic
 * `chars / 4` is well-established for English-heavy prompts and is fine for budget
 * gating. Charters with multilingual content can override the heuristic via
 * SPECFLEET_TOKEN_RATIO.
 */
function resolveRatio(): number {
  const raw = process.env.SPECFLEET_TOKEN_RATIO;
  if (!raw) return 4;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    // Invalid value (NaN, 0, negative) → fall back to default rather than
    // producing Infinity/NaN budget calculations.
    return 4;
  }
  return parsed;
}
const RATIO = resolveRatio();

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / RATIO);
}

/**
 * Estimate the total token cost of a list of message strings (system + history).
 * Adds a small per-message overhead (4 tokens) to account for role markers.
 */
export function estimateMessagesTokens(messages: string[]): number {
  return messages.reduce((sum, m) => sum + estimateTokens(m) + 4, 0);
}

export class TokenBudgetExceededError extends Error {
  override readonly name = "TokenBudgetExceededError";
  constructor(
    public readonly agent: string,
    public readonly used: number,
    public readonly cap: number,
  ) {
    super(
      `Token budget exceeded for agent "${agent}": used ${used} > cap ${cap}. ` +
        `Compact the session or split work into a sub-subagent.`,
    );
  }
}

export interface BudgetCheckResult {
  used: number;
  cap: number;
  remaining: number;
  warnAt: number; // 80 % of cap
  warning: boolean;
}

export function checkBudget(used: number, cap: number): BudgetCheckResult {
  const warnAt = Math.floor(cap * 0.8);
  return {
    used,
    cap,
    remaining: cap - used,
    warnAt,
    warning: used >= warnAt,
  };
}
