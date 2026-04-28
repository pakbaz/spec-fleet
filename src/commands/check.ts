/**
 * `eas check` — v0.3 unified health/quality command. Folds:
 *
 *   doctor          → eas check                 (default, fast)
 *   audit verify    → eas check --audit         (or --deep)
 *   eval            → eas check --eval
 *   tune            → eas check --tune          (implies --eval if scoreboard empty)
 *   precommit-scan  → eas check --staged
 *
 * Default behaviour (no flags) runs the v0.2 `doctor` checks. `--deep` runs
 * doctor + audit-chain verification across every session. Other flags route
 * to the matching v0.2 module so existing tests stay green.
 */
import chalk from "chalk";
import path from "node:path";
import { promises as fs } from "node:fs";
import { doctorCommand } from "./doctor.js";
import { auditVerifyCommand } from "./audit.js";
import { evalCommand, type EvalOptions } from "./eval.js";
import { tuneCommand, type TuneOptions } from "./tune.js";
import { precommitScanCommand } from "./precommit-scan.js";

export interface CheckOptions {
  deep?: boolean;
  audit?: boolean;
  eval?: boolean;
  tune?: boolean;
  staged?: boolean;
  fix?: boolean;
  charter?: string;
  bench?: string;
  limit?: number;
  since?: string;
}

export async function checkCommand(opts: CheckOptions = {}): Promise<void> {
  const flags = [opts.audit, opts.eval, opts.tune, opts.staged].filter(Boolean).length;

  // --staged is a special, isolated mode (used by the git pre-commit hook).
  if (opts.staged) {
    await precommitScanCommand();
    return;
  }

  if (opts.eval && !opts.tune) {
    const evalOpts: EvalOptions = {
      charter: opts.charter,
      bench: opts.bench,
      limit: opts.limit,
    };
    await evalCommand(evalOpts);
    return;
  }

  if (opts.tune) {
    // Tune reads the scoreboard. If the user passed --eval too, refresh first.
    if (opts.eval) {
      const evalOpts: EvalOptions = {
        charter: opts.charter,
        bench: opts.bench,
        limit: opts.limit,
      };
      await evalCommand(evalOpts);
    }
    const tuneOpts: TuneOptions = { since: opts.since };
    await tuneCommand(tuneOpts);
    return;
  }

  if (opts.audit && flags === 1) {
    await auditVerifyCommand({ all: true });
    return;
  }

  // Default: doctor (always). With --deep, also run audit-verify --all.
  await doctorCommand();

  if (opts.deep) {
    console.log("");
    console.log(chalk.bold("Audit-chain verification"));
    await auditVerifyCommand({ all: true });
  }

  if (opts.fix) {
    // Trivial auto-fix: re-mirror charters to .github/agents/ in case they drifted.
    // (This is a low-risk operation that mirrors what `init` does.)
    try {
      const { findEasRoot, easPaths } = await import("../util/paths.js");
      const { mirrorCharters, loadAllCharters } = await import("../runtime/charter.js");
      const root = await findEasRoot();
      const p = easPaths(root);
      const charters = await loadAllCharters(p.chartersDir);
      await mirrorCharters(charters, p.githubAgentsDir);
      console.log(chalk.green(`✓ re-mirrored ${charters.length} charter(s) to .github/agents/`));
    } catch (e) {
      console.log(chalk.yellow(`  ⚠ --fix skipped: ${(e as Error).message}`));
    }
  }

  // Suppress "unused" warnings: path/fs reserved for future deeper checks
  void path;
  void fs;
}
