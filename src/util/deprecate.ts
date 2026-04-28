/**
 * Helper for v0.3 deprecated command aliases. Prints a yellow warning to
 * stderr (so it doesn't pollute piped stdout) the first time an alias is hit
 * in a process, then forwards to the new implementation.
 *
 * v0.3 keeps the v0.2 surface as hidden aliases. They will be removed in v0.4
 * per the deprecation horizon decision.
 */
import chalk from "chalk";

const warned = new Set<string>();

export function warnDeprecated(oldCmd: string, newCmd: string): void {
  if (process.env.EAS_NO_DEPRECATION_WARN === "1") return;
  if (warned.has(oldCmd)) return;
  warned.add(oldCmd);
  process.stderr.write(
    chalk.yellow(
      `⚠ \`eas ${oldCmd}\` is deprecated; use \`eas ${newCmd}\` (will be removed in v0.4).\n`,
    ),
  );
}
