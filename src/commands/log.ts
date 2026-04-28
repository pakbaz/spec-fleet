/**
 * `eas log` — v0.3 unified history command. Folds `eas audit tail` and
 * `eas replay` into one verb:
 *
 *   eas log               — tail recent audit events (was `audit tail`)
 *   eas log <sessionId>   — replay a session as a redacted timeline (was `replay`)
 *
 * Implementation is a thin dispatcher to the existing modules so all
 * v0.2-era tests keep passing untouched.
 */
import { auditCommand } from "./audit.js";
import { replayCommand, type ReplayOptions } from "./replay.js";

export interface LogOptions extends ReplayOptions {
  since?: string;
  agent?: string;
  tail?: boolean;
}

export async function logCommand(sessionId: string | undefined, opts: LogOptions = {}): Promise<void> {
  if (sessionId && sessionId.length > 0) {
    await replayCommand(sessionId, { from: opts.from, limit: opts.limit });
    return;
  }
  await auditCommand({ since: opts.since, agent: opts.agent, tail: opts.tail });
}
