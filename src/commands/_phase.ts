/**
 * Shared helpers for the eight Spec-Kit pipeline commands. Each phase command
 * (`specify`, `clarify`, `plan`, `tasks`, `analyze`, `implement`, `review`,
 * `checklist`) is a thin wrapper around `runPhase` — they differ only in the
 * prompt template they load and which artefact they write.
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import matter from "gray-matter";
import { Workspace } from "../runtime/workspace.js";
import { dispatch } from "../runtime/dispatch.js";
import { specPaths, ensureDir, readMaybe } from "../util/paths.js";
import { estimateTokens } from "../util/tokens.js";
import { SpecFrontmatterSchema } from "../schema/index.js";

const __filename = fileURLToPath(import.meta.url);
// dist/commands/_phase.js → ../../templates
const TEMPLATES_DIR = path.resolve(path.dirname(__filename), "..", "..", "templates");
const PROMPTS_DIR = path.join(TEMPLATES_DIR, ".github", "prompts");

export type Phase =
  | "specify"
  | "clarify"
  | "plan"
  | "tasks"
  | "analyze"
  | "implement"
  | "review"
  | "checklist";

export interface PhaseRunOptions {
  ws: Workspace;
  phase: Phase;
  specId: string;
  /** Charter to delegate to (orchestrator selects, but caller can override). */
  charter: string;
  /** Extra user input appended to the rendered prompt. */
  userInput?: string;
  /** Override model (otherwise charter/config decides). */
  model?: string;
  /** Explicit tool allowlist for this dispatch. If omitted, use config + charter defaults. */
  allowTool?: string[];
  /** Force Copilot CLI prompt mode to disable interactive prompts. */
  nonInteractive?: boolean;
  /** Use the workspace's review model (cross-model review). */
  useReviewModel?: boolean;
  /** Skip writing artefacts; just print the response. */
  dryRun?: boolean;
}

export interface PhaseRunResult {
  runId: string;
  exitCode: number;
  stdout: string;
  artefactPath: string | null;
}

export interface SharedPhaseCommandOptions {
  charter?: string;
  model?: string;
  allowTool?: string[];
  nonInteractive?: boolean;
  dryRun?: boolean;
}

/**
 * Map each phase to the artefact file it produces under `.specfleet/specs/<id>/`.
 */
function artefactFor(phase: Phase, sp: ReturnType<typeof specPaths>): string {
  switch (phase) {
    case "specify":
      return sp.spec;
    case "clarify":
      return sp.clarifications;
    case "plan":
      return sp.plan;
    case "tasks":
      return sp.tasks;
    case "analyze":
      return sp.analysis;
    case "implement":
      // `implement` writes code, not a single markdown artefact. We log to
      // the scratchpad instead and return a sentinel.
      return sp.scratchpad;
    case "review":
      return sp.review;
    case "checklist":
      return sp.checklist;
  }
}

export async function runPhase(opts: PhaseRunOptions): Promise<PhaseRunResult> {
  const { ws, phase, specId, charter } = opts;
  if (!ws.hasCharter(charter)) {
    throw new Error(`Charter not found: ${charter}`);
  }
  const sp = specPaths(ws.root, specId);
  await ensureDir(sp.dir);
  await ensureDir(ws.paths.scratchpadDir);

  const charterDef = ws.charter(charter);
  const promptBody = await renderPrompt(phase, {
    specId,
    specDir: sp.dir,
    workspaceRoot: ws.root,
    userInput: opts.userInput ?? "",
    instructionPath: ws.paths.instruction,
    projectPath: ws.paths.project,
    constitution: ws.instruction ?? "(no constitution)",
  });

  const tokens = estimateTokens(promptBody);
  const cap = charterDef.maxContextTokens;
  if (tokens > cap) {
    throw new Error(
      `Phase "${phase}" prompt is ${tokens} tokens, exceeds charter "${charter}" cap of ${cap}. ` +
        `Trim user input or split work into a follow-up.`,
    );
  }
  if (tokens > Math.floor(cap * 0.8)) {
    console.warn(chalk.yellow(`  ⚠ prompt at ${tokens}/${cap} tokens (>80% of cap)`));
  }

  const model = opts.model ?? (opts.useReviewModel ? process.env.SPECFLEET_REVIEW_MODEL ?? ws.config.models.review : ws.modelFor(charter));

  console.log(chalk.cyan(`▸ ${phase} (${charter} · ${model}) → ${path.relative(ws.root, sp.dir)}`));

  const result = await dispatch({
    prompt: promptBody,
    agent: charter,
    model,
    allowTool: opts.allowTool ?? ws.allowToolFor(charter),
    nonInteractive: opts.nonInteractive ?? !process.stdout.isTTY,
    cwd: ws.root,
    specId,
    phase,
    runsDir: ws.paths.runsDir,
  });

  if (result.exitCode !== 0) {
    throw new Error(`copilot exited with code ${result.exitCode}: ${result.stderr.slice(0, 500)}`);
  }

  const target = artefactFor(phase, sp);
  if (opts.dryRun) {
    return { runId: result.runId, exitCode: result.exitCode, stdout: result.stdout, artefactPath: null };
  }

  // For the scratchpad-backed phase (implement) we append; everything else writes a fresh artefact.
  if (phase === "implement") {
    const banner = `\n<!-- run ${result.runId} · ${new Date().toISOString()} -->\n`;
    await fs.appendFile(target, banner + extractImplementSummary(result.stdout) + "\n", "utf8");
  } else {
    await ensureDir(path.dirname(target));
    await fs.writeFile(target, ensureFrontmatter(result.stdout, specId, phase), "utf8");
  }

  // Update the spec's status frontmatter to reflect the latest phase, when present.
  await maybeAdvanceStatus(sp.spec, phase);

  return { runId: result.runId, exitCode: result.exitCode, stdout: result.stdout, artefactPath: target };
}

async function renderPrompt(
  phase: Phase,
  ctx: {
    specId: string;
    specDir: string;
    workspaceRoot: string;
    userInput: string;
    instructionPath: string;
    projectPath: string;
    constitution: string;
  },
): Promise<string> {
  const file = path.join(PROMPTS_DIR, `specfleet.${phase}.prompt.md`);
  const raw = await fs.readFile(file, "utf8");
  const fm = matter(raw);
  // The frontmatter description/tools/model fields are advisory; we expand
  // mustache-lite placeholders in the body and append user input.
  let body = fm.content.trim();
  body = body
    .replace(/\{\{\s*spec_id\s*\}\}/g, ctx.specId)
    .replace(/\{\{\s*spec_dir\s*\}\}/g, ctx.specDir)
    .replace(/\{\{\s*workspace_root\s*\}\}/g, ctx.workspaceRoot)
    .replace(/\{\{\s*instruction_path\s*\}\}/g, ctx.instructionPath)
    .replace(/\{\{\s*project_path\s*\}\}/g, ctx.projectPath)
    .replace(/\{\{\s*constitution\s*\}\}/g, ctx.constitution)
    .replace(/\{\{\s*user_input\s*\}\}/g, ctx.userInput || "(none)");
  return body;
}

function ensureFrontmatter(content: string, specId: string, phase: Phase): string {
  // If model wrote frontmatter already, trust it; otherwise prepend a stamp.
  if (/^---\s*\n/.test(content)) return content;
  const stamp = new Date().toISOString();
  if (phase === "specify") {
    return [
      "---",
      `id: ${specId}`,
      `title: ${specId}`,
      "status: draft",
      `created: ${stamp.slice(0, 10)}`,
      "---",
      "",
      content.trim(),
      "",
    ].join("\n");
  }
  return [
    "---",
    `spec_id: ${specId}`,
    `phase: ${phase}`,
    `generated: ${stamp}`,
    "---",
    "",
    content.trim(),
    "",
  ].join("\n");
}

function extractImplementSummary(stdout: string): string {
  // The implement prompt asks for a "## Summary" section; surface that in the
  // scratchpad. Fall back to first 40 lines if missing.
  const m = stdout.match(/## Summary[\s\S]*?(?=\n## |$)/);
  if (m && m[0]) return m[0];
  return stdout.split("\n").slice(0, 40).join("\n");
}

async function maybeAdvanceStatus(specFile: string, phase: Phase): Promise<void> {
  const raw = await readMaybe(specFile);
  if (!raw) return;
  const fm = matter(raw);
  const candidate = SpecFrontmatterSchema.safeParse(fm.data);
  if (!candidate.success) return;
  const next: typeof candidate.data.status =
    phase === "specify"
      ? "draft"
      : phase === "clarify"
        ? "clarifying"
        : phase === "plan"
          ? "planned"
          : phase === "tasks"
            ? "tasked"
            : phase === "implement"
              ? "implementing"
              : phase === "review"
                ? "reviewed"
                : phase === "checklist"
                  ? "done"
                  : candidate.data.status;
  const updated = matter.stringify(fm.content, {
    ...candidate.data,
    status: next,
    updated: new Date().toISOString().slice(0, 10),
  });
  await fs.writeFile(specFile, updated, "utf8");
}

/** Slugify a free-form spec name into a stable id. */
export function slugifySpecId(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Pick a default charter for a phase. The orchestrator usually selects, but
 * single-phase callers (e.g. `specfleet review`) need a deterministic default.
 */
export function defaultCharterForPhase(phase: Phase): string {
  switch (phase) {
    case "specify":
    case "clarify":
    case "tasks":
      return "orchestrator";
    case "plan":
    case "analyze":
    case "review":
      return "architect";
    case "implement":
      return "dev";
    case "checklist":
      return "compliance";
  }
}
