/**
 * `specfleet log` — v0.4 unified history command. Folds audit tail and
 * session replay into one verb:
 *
 *   specfleet log               — tail recent audit events
 *   specfleet log <sessionId>   — replay a session as a redacted timeline
 *
 * Implementation is a thin dispatcher to the existing modules.
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
