/**
 * `Workspace` — v0.6 thin replacement for v0.5's `SpecFleetRuntime`. We no
 * longer wrap the Copilot CLI in an SDK session; we shell out via `dispatch()`
 * each phase. The Workspace type is just a tidy bundle of paths, charters,
 * project metadata, and the merged config.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { findSpecFleetRoot, specFleetPaths, readMaybe, type SpecFleetPaths } from "../util/paths.js";
import { loadAllCharters } from "./charter.js";
import type { Charter, Project } from "../schema/index.js";
import { ProjectSchema } from "../schema/index.js";

/**
 * Workspace-level configuration. Stored at `.specfleet/config.json` so that
 * both the CLI and any embedding tool see the same defaults.
 */
export interface WorkspaceConfig {
  /**
   * Model selection. v0.6 default pair leans on Claude Sonnet 4.5 for
   * implementation and GPT-5.1 for cross-model review (see ADR-0005).
   */
  models: {
    default: string;
    review: string;
  };
  /**
   * Base allow-list of Copilot CLI tools. Charters may narrow further but
   * cannot widen beyond what Copilot already grants.
   */
  defaultAllowTool: string[];
  /** Hard cap on per-charter context, applied before dispatch. */
  defaultMaxContextTokens: number;
  /**
   * MCP servers default OFF (per the SpecKit community guidance: the more
   * tools in scope, the more brittle the prompt). Charters may opt in.
   */
  defaultMcpServers: string[];
}

export const DEFAULT_CONFIG: WorkspaceConfig = {
  models: {
    default: "claude-sonnet-4.5",
    review: "gpt-5.1",
  },
  defaultAllowTool: [],
  defaultMaxContextTokens: 60_000,
  defaultMcpServers: [],
};

export interface WorkspaceOpenOptions {
  cwd?: string;
}

export class Workspace {
  readonly root: string;
  readonly paths: SpecFleetPaths;
  readonly charters: Charter[];
  readonly project: Project | null;
  readonly config: WorkspaceConfig;
  readonly instruction: string | null;

  private constructor(args: {
    root: string;
    paths: SpecFleetPaths;
    charters: Charter[];
    project: Project | null;
    config: WorkspaceConfig;
    instruction: string | null;
  }) {
    this.root = args.root;
    this.paths = args.paths;
    this.charters = args.charters;
    this.project = args.project;
    this.config = args.config;
    this.instruction = args.instruction;
  }

  static async open(opts: WorkspaceOpenOptions = {}): Promise<Workspace> {
    const root = await findSpecFleetRoot(opts.cwd ?? process.cwd());
    const paths = specFleetPaths(root);
    const charters = await loadAllCharters(paths.chartersDir);
    const project = await loadProject(paths.project);
    const config = await loadConfig(paths.config);
    const instruction = await readMaybe(paths.instruction);
    return new Workspace({ root, paths, charters, project, config, instruction });
  }

  charter(name: string): Charter {
    const c = this.charters.find((x) => x.name === name);
    if (!c) throw new Error(`Charter not found: ${name}`);
    return c;
  }

  hasCharter(name: string): boolean {
    return this.charters.some((c) => c.name === name);
  }

  /** Resolve which model to use for a charter. Charter wins over defaults. */
  modelFor(name: string): string {
    const c = this.charter(name);
    return c.model ?? this.config.models.default;
  }

  /** Merge defaultAllowTool with charter.allowedTools (union, dedup). */
  allowToolFor(name: string): string[] {
    const c = this.charter(name);
    const set = new Set([...this.config.defaultAllowTool, ...c.allowedTools]);
    return [...set];
  }
}

async function loadProject(file: string): Promise<Project | null> {
  const raw = await readMaybe(file);
  if (!raw) return null;
  // project.md is markdown with a leading YAML frontmatter; allow either an
  // explicit JSON block or just frontmatter. Be permissive — schema parse
  // returns null on shape mismatches rather than throwing the whole CLI.
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return null;
  try {
    const yaml = await import("yaml");
    const obj = yaml.parse(fmMatch[1] ?? "") as unknown;
    const parsed = ProjectSchema.safeParse(obj);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function loadConfig(file: string): Promise<WorkspaceConfig> {
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw) as Partial<WorkspaceConfig>;
    return mergeConfig(DEFAULT_CONFIG, parsed);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return DEFAULT_CONFIG;
    throw err;
  }
}

function mergeConfig(a: WorkspaceConfig, b: Partial<WorkspaceConfig>): WorkspaceConfig {
  return {
    models: { ...a.models, ...(b.models ?? {}) },
    defaultAllowTool: b.defaultAllowTool ?? a.defaultAllowTool,
    defaultMaxContextTokens: b.defaultMaxContextTokens ?? a.defaultMaxContextTokens,
    defaultMcpServers: b.defaultMcpServers ?? a.defaultMcpServers,
  };
}

/** Helper used by `init` to write a default config.json when one is missing. */
export async function ensureWorkspaceConfig(file: string): Promise<void> {
  try {
    await fs.access(file);
  } catch {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n", "utf8");
  }
}
