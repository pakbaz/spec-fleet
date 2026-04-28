/**
 * `specfleet config` — v0.4 single entry point for inspecting and editing the
 * orchestrator instructions, subagent charters, policies, MCP wiring, and
 * skills.
 *
 * Subcommands:
 *   specfleet config show [target]    — print one config (default: orchestrator)
 *   specfleet config list             — table of all configs (kind / name / path)
 *   specfleet config edit [target]    — open in $EDITOR, re-validate on close
 *   specfleet config new <kind> <n>   — scaffold (kinds: charter | policy | mcp | skill)
 *   specfleet config validate         — schema-check everything; non-zero on failure
 *   specfleet config diff             — drift between local configs and reference templates
 *
 * Targets:
 *   "orchestrator"        → .specfleet/instruction.md (default)
 *   "<charter-name>"      → .specfleet/charters/<n>.charter.md (or subagents/...)
 *   "policy:<file>"       → .specfleet/policies/<file>
 *   "mcp:<file>"          → .specfleet/mcp/<file>
 *   "skill:<file>"        → .specfleet/skills/<file>
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import chalk from "chalk";
import fg from "fast-glob";
import { findSpecFleetRoot, specFleetPaths, ensureDir } from "../util/paths.js";
import { loadAllCharters } from "../runtime/charter.js";
import {
  loadEgressPolicy,
  loadIpGuardPolicy,
  loadTrustedSigners,
} from "../util/policies.js";
import { redact, loadCustomPatterns } from "../util/secrets.js";

const __filename = fileURLToPath(import.meta.url);
// dist/commands/config.js -> ../../templates
const TEMPLATES_DIR = path.resolve(path.dirname(__filename), "..", "..", "templates");

export interface ConfigOptions {
  name?: string;
  kind?: string;
  noRedact?: boolean;
}

interface ResolvedTarget {
  kind: "orchestrator" | "charter" | "policy" | "mcp" | "skill";
  display: string;
  file: string;
}

export async function configCommand(
  action: "show" | "list" | "edit" | "new" | "validate" | "diff",
  target: string | undefined,
  opts: ConfigOptions = {},
): Promise<void> {
  if (action === "list") {
    await listConfigs();
    return;
  }
  if (action === "validate") {
    await validateConfigs();
    return;
  }
  if (action === "diff") {
    await diffConfigs();
    return;
  }
  if (action === "new") {
    await newConfig(opts);
    return;
  }
  if (action === "show" || action === "edit") {
    const t = await resolveTarget(target ?? "orchestrator");
    if (action === "show") {
      await showConfig(t, opts);
    } else {
      await editConfig(t);
    }
    return;
  }
  throw new Error(`unknown config action: ${action}`);
}

// -- show --------------------------------------------------------------------

async function showConfig(t: ResolvedTarget, opts: ConfigOptions): Promise<void> {
  const root = await findSpecFleetRoot();
  const p = specFleetPaths(root);
  // Load secret patterns so any leaked credential gets masked before printing.
  await loadCustomPatterns(p.policiesDir);
  let raw: string;
  try {
    raw = await fs.readFile(t.file, "utf8");
  } catch {
    throw new Error(`${t.display} not found at ${t.file}`);
  }
  const out = opts.noRedact ? raw : redact(raw).redacted;
  console.log(chalk.gray(`# ${t.kind}: ${t.display}`));
  console.log(chalk.gray(`# ${path.relative(root, t.file)}`));
  console.log("");
  process.stdout.write(out);
  if (!out.endsWith("\n")) process.stdout.write("\n");
}

// -- list --------------------------------------------------------------------

async function listConfigs(): Promise<void> {
  const root = await findSpecFleetRoot();
  const p = specFleetPaths(root);
  const rows: Array<{ kind: string; name: string; path: string; mtime: string }> = [];

  // orchestrator
  rows.push(await statRow("orchestrator", "instruction", p.instruction, root));

  // charters — glob the directory directly so we get the on-disk path
  try {
    const files = await fg("**/*.charter.md", { cwd: p.chartersDir, absolute: true });
    for (const file of files) {
      const name = path.basename(file).replace(/\.charter\.md$/, "");
      rows.push(await statRow("charter", name, file, root));
    }
  } catch {
    /* no charters */
  }

  for (const [kind, dir] of [
    ["policy", p.policiesDir],
    ["mcp", p.mcpDir],
    ["skill", p.skillsDir],
  ] as const) {
    try {
      const entries = await fs.readdir(dir);
      for (const f of entries) {
        if (f.startsWith(".")) continue;
        const full = path.join(dir, f);
        const st = await fs.stat(full);
        if (!st.isFile()) continue;
        rows.push(await statRow(kind, f, full, root));
      }
    } catch {
      /* dir absent */
    }
  }

  // Render
  const widths = {
    kind: Math.max(4, ...rows.map((r) => r.kind.length)),
    name: Math.max(4, ...rows.map((r) => r.name.length)),
    mtime: Math.max(8, ...rows.map((r) => r.mtime.length)),
  };
  console.log(
    chalk.bold(
      `${"KIND".padEnd(widths.kind)}  ${"NAME".padEnd(widths.name)}  ${"MODIFIED".padEnd(widths.mtime)}  PATH`,
    ),
  );
  for (const r of rows) {
    const tagged =
      r.kind === "orchestrator"
        ? chalk.cyan(r.kind.padEnd(widths.kind))
        : r.kind === "charter"
          ? chalk.green(r.kind.padEnd(widths.kind))
          : r.kind === "policy"
            ? chalk.yellow(r.kind.padEnd(widths.kind))
            : r.kind === "mcp"
              ? chalk.magenta(r.kind.padEnd(widths.kind))
              : chalk.gray(r.kind.padEnd(widths.kind));
    console.log(
      `${tagged}  ${r.name.padEnd(widths.name)}  ${chalk.gray(r.mtime.padEnd(widths.mtime))}  ${chalk.gray(r.path)}`,
    );
  }
  console.log(chalk.gray(`\n${rows.length} config(s)`));
}

async function statRow(
  kind: string,
  name: string,
  file: string,
  root: string,
): Promise<{ kind: string; name: string; path: string; mtime: string }> {
  let mtime = "—";
  try {
    const st = await fs.stat(file);
    mtime = st.mtime.toISOString().slice(0, 19).replace("T", " ");
  } catch {
    /* missing */
  }
  return { kind, name, path: path.relative(root, file), mtime };
}

// -- edit --------------------------------------------------------------------

async function editConfig(t: ResolvedTarget): Promise<void> {
  const editor = process.env.EDITOR ?? process.env.VISUAL ?? defaultEditor();
  // Make sure the file exists so $EDITOR doesn't open a buffer in nowhere.
  try {
    await fs.access(t.file);
  } catch {
    throw new Error(`${t.display} not found at ${t.file}`);
  }
  console.log(chalk.cyan(`▸ editing ${t.display} in ${editor}`));
  const r = spawnSync(editor, [t.file], { stdio: "inherit" });
  if (r.status !== 0) {
    console.log(chalk.yellow(`  editor exited with code ${r.status}; not validating`));
    return;
  }
  // Re-validate on close. For non-validatable kinds (raw skill markdown), we
  // simply accept. For charters/policies/mcp we run the schema-check so bad
  // edits surface immediately.
  console.log(chalk.gray(`  re-validating after edit…`));
  try {
    await validateOne(t);
    console.log(chalk.green(`✓ ${t.display} valid`));
  } catch (err) {
    console.log(chalk.red(`✖ ${t.display} failed validation: ${(err as Error).message}`));
    console.log(
      chalk.yellow(
        `  Your edits are saved on disk. Re-run \`specfleet config edit ${quoteTarget(t)}\` to fix, or \`specfleet config validate\` to recheck.`,
      ),
    );
    process.exitCode = 1;
  }
}

function defaultEditor(): string {
  return process.platform === "win32" ? "notepad" : "vi";
}

function quoteTarget(t: ResolvedTarget): string {
  if (t.kind === "orchestrator") return "orchestrator";
  if (t.kind === "charter") return t.display;
  return `${t.kind}:${t.display}`;
}

// -- new ---------------------------------------------------------------------

async function newConfig(opts: ConfigOptions): Promise<void> {
  const kind = opts.kind;
  const name = opts.name;
  if (!kind || !name) {
    throw new Error("usage: specfleet config new <kind> <name>  (kinds: charter | policy | mcp | skill)");
  }
  if (kind === "charter") {
    // Reuse the charter-new path which already has hardened name validation.
    const { charterCommand } = await import("./charter.js");
    await charterCommand("new", { name });
    return;
  }
  if (!/^[a-zA-Z0-9_.-]+$/.test(name)) {
    throw new Error(`invalid name: ${name}. Use [a-zA-Z0-9_.-] only.`);
  }
  const root = await findSpecFleetRoot();
  const p = specFleetPaths(root);
  let file: string;
  let body: string;
  if (kind === "policy") {
    file = path.join(p.policiesDir, name.endsWith(".json") ? name : `${name}.json`);
    body = "{\n  \"$comment\": \"TODO: define policy\"\n}\n";
  } else if (kind === "mcp") {
    file = path.join(p.mcpDir, name.endsWith(".json") ? name : `${name}.json`);
    body = JSON.stringify(
      { name, command: "TODO", args: [], env: {}, allowedTools: [] },
      null,
      2,
    ) + "\n";
  } else if (kind === "skill") {
    file = path.join(p.skillsDir, name.endsWith(".md") ? name : `${name}.md`);
    body = `# ${name} skill\n\nTODO: describe this skill.\n`;
  } else {
    throw new Error(`unknown kind: ${kind}`);
  }
  await ensureDir(path.dirname(file));
  try {
    await fs.access(file);
    throw new Error(`already exists: ${path.relative(root, file)}`);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  await fs.writeFile(file, body, "utf8");
  console.log(chalk.green(`✓ Created ${path.relative(root, file)}`));
}

// -- validate ----------------------------------------------------------------

async function validateConfigs(): Promise<void> {
  const root = await findSpecFleetRoot();
  const p = specFleetPaths(root);
  let errors = 0;
  let warnings = 0;

  // orchestrator
  try {
    await fs.access(p.instruction);
    console.log(chalk.green(`✓ orchestrator: ${path.relative(root, p.instruction)}`));
  } catch {
    console.log(chalk.red(`✖ orchestrator: ${path.relative(root, p.instruction)} not found`));
    errors++;
  }

  // charters
  try {
    const charters = await loadAllCharters(p.chartersDir);
    console.log(chalk.green(`✓ charters: ${charters.length} valid`));
  } catch (e) {
    console.log(chalk.red(`✖ charters: ${(e as Error).message}`));
    errors++;
  }

  // policies
  try {
    const eg = await loadEgressPolicy(p.policiesDir);
    if (eg) console.log(chalk.green(`✓ policies/egress.json (${eg.allow.length} allow / ${(eg.deny ?? []).length} deny)`));
    else { console.log(chalk.yellow(`⚠ policies/egress.json absent`)); warnings++; }
  } catch (e) {
    console.log(chalk.red(`✖ policies/egress.json: ${(e as Error).message}`));
    errors++;
  }
  try {
    const ip = await loadIpGuardPolicy(p.policiesDir);
    if (ip) console.log(chalk.green(`✓ policies/ip-guard.json (${ip.patterns.length} patterns, mode=${ip.mode})`));
    else { console.log(chalk.yellow(`⚠ policies/ip-guard.json absent`)); warnings++; }
  } catch (e) {
    console.log(chalk.red(`✖ policies/ip-guard.json: ${(e as Error).message}`));
    errors++;
  }
  try {
    await loadTrustedSigners(p.policiesDir);
    console.log(chalk.green(`✓ policies/trusted-signers.json schema-valid`));
  } catch (e) {
    console.log(chalk.red(`✖ policies/trusted-signers.json: ${(e as Error).message}`));
    errors++;
  }

  // mcp manifests — JSON-parse only (loose schema)
  try {
    const entries = await fs.readdir(p.mcpDir).catch(() => [] as string[]);
    let mcpCount = 0;
    for (const f of entries) {
      if (!f.endsWith(".json")) continue;
      const raw = await fs.readFile(path.join(p.mcpDir, f), "utf8");
      try {
        JSON.parse(raw);
        mcpCount++;
      } catch (e) {
        console.log(chalk.red(`✖ mcp/${f}: ${(e as Error).message}`));
        errors++;
      }
    }
    if (mcpCount > 0) console.log(chalk.green(`✓ mcp: ${mcpCount} manifest(s) parse OK`));
  } catch {
    /* mcp dir absent — fine */
  }

  console.log("");
  if (errors > 0) {
    console.log(chalk.red(`✖ ${errors} error(s), ${warnings} warning(s)`));
    process.exitCode = 1;
  } else {
    console.log(chalk.green(`✓ all configs valid (${warnings} warning(s))`));
  }
}

async function validateOne(t: ResolvedTarget): Promise<void> {
  const root = await findSpecFleetRoot();
  const p = specFleetPaths(root);
  if (t.kind === "orchestrator") {
    await fs.access(t.file);
    return;
  }
  if (t.kind === "charter") {
    // Re-load all charters (simplest correct check; charter loader validates frontmatter).
    await loadAllCharters(p.chartersDir);
    return;
  }
  if (t.kind === "policy") {
    const base = path.basename(t.file);
    if (base === "egress.json") {
      await loadEgressPolicy(p.policiesDir);
      return;
    }
    if (base === "ip-guard.json") {
      await loadIpGuardPolicy(p.policiesDir);
      return;
    }
    if (base === "trusted-signers.json") {
      await loadTrustedSigners(p.policiesDir);
      return;
    }
    // Other policy files: just JSON-parseable.
    const raw = await fs.readFile(t.file, "utf8");
    JSON.parse(raw);
    return;
  }
  if (t.kind === "mcp") {
    const raw = await fs.readFile(t.file, "utf8");
    JSON.parse(raw);
    return;
  }
  // skill — markdown, anything goes
}

// -- diff --------------------------------------------------------------------

async function diffConfigs(): Promise<void> {
  const root = await findSpecFleetRoot();
  const p = specFleetPaths(root);
  let drifted = 0;
  let total = 0;

  async function walkAndCompare(refDir: string, localDir: string, label: string): Promise<void> {
    let entries: string[];
    try {
      entries = await fs.readdir(refDir);
    } catch {
      return;
    }
    for (const name of entries) {
      const refPath = path.join(refDir, name);
      const localPath = path.join(localDir, name);
      const st = await fs.stat(refPath);
      if (st.isDirectory()) {
        await walkAndCompare(refPath, localPath, `${label}/${name}`);
        continue;
      }
      total++;
      let local: string | null = null;
      try {
        local = await fs.readFile(localPath, "utf8");
      } catch {
        console.log(chalk.yellow(`  + ${label}/${name}  (in template, missing locally)`));
        drifted++;
        continue;
      }
      const ref = await fs.readFile(refPath, "utf8");
      if (ref !== local) {
        console.log(chalk.cyan(`  ~ ${label}/${name}  (modified locally)`));
        drifted++;
      }
    }
  }

  console.log(chalk.bold("Drift vs bundled reference templates:"));
  await walkAndCompare(path.join(TEMPLATES_DIR, "charters"), p.chartersDir, "charters");
  await walkAndCompare(path.join(TEMPLATES_DIR, "policies"), p.policiesDir, "policies");
  await walkAndCompare(path.join(TEMPLATES_DIR, "mcp"), p.mcpDir, "mcp");
  await walkAndCompare(path.join(TEMPLATES_DIR, "skills"), p.skillsDir, "skills");
  // orchestrator instruction: bundled at templates/instruction.md
  total++;
  try {
    const ref = await fs.readFile(path.join(TEMPLATES_DIR, "instruction.md"), "utf8");
    const local = await fs.readFile(p.instruction, "utf8");
    if (ref !== local) {
      console.log(chalk.cyan(`  ~ instruction.md  (modified locally)`));
      drifted++;
    }
  } catch {
    /* either missing — already reported by validate */
  }

  console.log("");
  if (drifted === 0) console.log(chalk.green(`✓ no drift (${total} file(s) checked)`));
  else console.log(chalk.yellow(`${drifted} file(s) drifted from reference templates (${total} checked)`));
}

// -- target resolution -------------------------------------------------------

async function resolveTarget(spec: string): Promise<ResolvedTarget> {
  const root = await findSpecFleetRoot();
  const p = specFleetPaths(root);
  if (spec === "orchestrator" || spec === "instruction") {
    return { kind: "orchestrator", display: "orchestrator", file: p.instruction };
  }
  // Prefixed forms: policy:foo, mcp:bar, skill:baz
  const colon = spec.indexOf(":");
  if (colon > 0) {
    const kind = spec.slice(0, colon);
    const name = spec.slice(colon + 1);
    if (kind === "policy") {
      const file = path.join(p.policiesDir, name.endsWith(".json") ? name : `${name}.json`);
      return { kind: "policy", display: name, file };
    }
    if (kind === "mcp") {
      const file = path.join(p.mcpDir, name.endsWith(".json") ? name : `${name}.json`);
      return { kind: "mcp", display: name, file };
    }
    if (kind === "skill") {
      const file = path.join(p.skillsDir, name.endsWith(".md") ? name : `${name}.md`);
      return { kind: "skill", display: name, file };
    }
    throw new Error(`unknown target kind: ${kind} (use policy:/mcp:/skill:)`);
  }
  // Bare name → assume charter. Glob the charters dir to find any match.
  const matches = await fg(`**/${spec}.charter.md`, { cwd: p.chartersDir, absolute: true });
  if (matches.length === 1) {
    return { kind: "charter", display: spec, file: matches[0]! };
  }
  if (matches.length > 1) {
    throw new Error(
      `ambiguous charter "${spec}" (matches: ${matches.map((f) => path.relative(root, f)).join(", ")})`,
    );
  }
  throw new Error(`unknown target: ${spec}. Try \`specfleet config list\` to see available configs.`);
}
