/**
 * `eas precommit-scan` — scans the staged git diff for secrets and IP-guard
 * pattern matches in *added* lines only. Exits non-zero (blocking the commit)
 * when matches are found.
 *
 * This file is also runnable directly:  `node dist/commands/precommit-scan.js`
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { findSecrets } from "../util/secrets.js";
import { findIpGuardMatches, loadIpGuardPolicy, type CompiledIpGuard } from "../util/policies.js";
import { findEasRoot, easPaths } from "../util/paths.js";

interface ScanResult {
  ok: boolean;
  findings: Array<{ file: string; line: number; rule: string; preview: string }>;
}

export async function scanStagedDiff(repoRoot: string): Promise<ScanResult> {
  const findings: ScanResult["findings"] = [];
  const out = spawnSync("git", ["diff", "--cached", "--unified=0", "--no-color"], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  if (out.status !== 0) {
    // No staged changes or git error — nothing to scan; treat as ok.
    return { ok: true, findings };
  }
  const diff = out.stdout ?? "";

  // Try to load IP-guard policy (best-effort).
  let ipGuard: CompiledIpGuard | null = null;
  try {
    const easRoot = await findEasRoot(repoRoot);
    const p = easPaths(easRoot);
    ipGuard = await loadIpGuardPolicy(p.policiesDir);
  } catch {
    // No .eas/ dir in this repo — fine; secret scan still runs.
  }

  let currentFile = "";
  let newLineNo = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ ")) {
      // +++ b/path/to/file
      const m = /^\+\+\+ (?:b\/)?(.+)$/.exec(line);
      currentFile = m ? m[1] : "";
      continue;
    }
    if (line.startsWith("@@")) {
      const m = /\+(\d+)(?:,\d+)?/.exec(line);
      newLineNo = m ? parseInt(m[1], 10) : 0;
      continue;
    }
    if (line.startsWith("+") && !line.startsWith("+++")) {
      const added = line.slice(1);
      const secretMatches = findSecrets(added);
      for (const sm of secretMatches) {
        findings.push({
          file: currentFile || "(unknown)",
          line: newLineNo,
          rule: `secret:${sm.rule}`,
          preview: sm.preview,
        });
      }
      if (ipGuard) {
        const ipMatches = findIpGuardMatches(added, ipGuard);
        for (const im of ipMatches) {
          findings.push({
            file: currentFile || "(unknown)",
            line: newLineNo,
            rule: `ip-guard:${im.name}`,
            preview: added.slice(im.index, im.index + Math.min(im.length, 32)),
          });
        }
      }
      newLineNo++;
    } else if (!line.startsWith("-") && !line.startsWith("\\")) {
      // context line (in --unified=0 these are rare, but be defensive)
      newLineNo++;
    }
  }

  return { ok: findings.length === 0, findings };
}

export async function precommitScanCommand(): Promise<void> {
  const repoRoot = await resolveRepoRoot();
  const r = await scanStagedDiff(repoRoot);
  if (r.ok) {
    process.exitCode = 0;
    return;
  }
  process.stderr.write(
    `\u2716 EAS pre-commit scan blocked your commit — ${r.findings.length} finding(s):\n`,
  );
  for (const f of r.findings) {
    process.stderr.write(`  ${f.file}:${f.line}  [${f.rule}]  ${f.preview}\n`);
  }
  process.stderr.write(
    `\nIf this is a false positive, fix the line, amend, or (last resort) re-run with: git commit --no-verify\n`,
  );
  process.exitCode = 1;
}

async function resolveRepoRoot(): Promise<string> {
  const out = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" });
  if (out.status === 0) return (out.stdout ?? "").trim();
  return process.cwd();
}

// Self-invocation when this file is executed directly:
//   node dist/commands/precommit-scan.js
const __filename = fileURLToPath(import.meta.url);
const invokedAsScript =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (invokedAsScript) {
  precommitScanCommand().catch((err) => {
    process.stderr.write(`\u2716 precommit-scan crashed: ${(err as Error).message}\n`);
    process.exit(2);
  });
}
