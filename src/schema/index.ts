/**
 * Zod schemas for .specfleet/ artifacts (v0.6).
 *
 * v0.6 dropped the persona-heavy charter shape (tier, parent, spawns,
 * requiresHumanGate, displayName, role, skills) in favour of a task-contract
 * frontmatter that maps 1:1 onto Copilot CLI agent files.
 */
import { z } from "zod";

// ---------------- Constitution (instruction.md) ----------------
//
// Lean v0.6 shape: a constitution is a short list of policies + pointers to
// external docs. We do *not* try to capture every corporate rule in YAML.
// The body of instruction.md (after the frontmatter) is where the
// nuanced guidance lives.

export const InstructionSchema = z.object({
  version: z.string().min(1),
  organization: z.string().min(1),
  effectiveDate: z.string(),
  owners: z.array(z.string()).min(1),
  // Each entry is a one-line invariant. Flat list — no categories.
  principles: z.array(z.string()).default([]),
  approvedRuntimes: z.array(z.string()).default([]),
  approvedFrameworks: z.array(z.string()).default([]),
  forbidden: z.array(z.string()).default([]),
  // External references the LLM can fetch on demand (URL or repo-relative path).
  seeAlso: z.array(z.string()).default([]),
  contacts: z.record(z.string(), z.string()).default({}),
});
export type Instruction = z.infer<typeof InstructionSchema>;

// ---------------- Project (per-repo cheat sheet) ----------------

export const ProjectSchema = z.object({
  name: z.string().min(1),
  mode: z.enum(["greenfield", "brownfield", "modernization"]),
  description: z.string(),
  primaryLanguage: z.string(),
  runtime: z.string(),
  frameworks: z.array(z.string()).default([]),
  dataStores: z.array(z.string()).default([]),
  integrations: z.array(z.string()).default([]),
  deploymentTargets: z.array(z.string()).default([]),
  complianceScope: z.array(z.string()).default([]),
  notes: z.string().optional(),
});
export type Project = z.infer<typeof ProjectSchema>;

// ---------------- Charter (task contract) ----------------
//
// v0.6 charter frontmatter is intentionally minimal:
//   - name                   identifier matching `.github/agents/<name>.agent.md`
//   - description            one-line purpose (Copilot CLI uses this for routing)
//   - model                  optional model override (otherwise workspace default)
//   - maxContextTokens       budget gate before dispatch
//   - allowedTools           Copilot CLI tool names; empty = inherit defaults
//   - mcpServers             manifest names in .specfleet/mcp/
//   - instructionsApplyTo    file globs for path-scoped instructions
//
// The body of the charter is the agent prompt. It must be *task-focused*
// (Goal / Inputs / Output / Constraints) — no "You are the X Agent" personas.

export const CharterNameSchema = z
  .string()
  .min(1)
  .regex(/^[a-z][a-z0-9-]*$/, {
    message:
      "Charter name must be lowercase, kebab-case (no slashes — subagents are spawned at runtime, not pre-declared)",
  });

export const CharterSchema = z.object({
  name: CharterNameSchema,
  description: z.string().min(1),
  model: z.string().optional(),
  // Hard ceiling: 95K (5K headroom under Copilot CLI's 100K context budget).
  maxContextTokens: z.number().int().positive().max(95_000).default(60_000),
  allowedTools: z.array(z.string()).default([]),
  mcpServers: z.array(z.string()).default([]),
  instructionsApplyTo: z.array(z.string()).default([]),
  // The free-form prompt body (everything after the YAML frontmatter).
  body: z.string().min(20),
});
export type Charter = z.infer<typeof CharterSchema>;

// ---------------- Run transcript (per `copilot -p` invocation) ----------------
//
// The runtime writes one `.specfleet/runs/<run-id>.jsonl` per invocation,
// capturing what was dispatched and what came back. Copilot CLI's own
// session-state under ~/.copilot/ remains the authoritative log.

export const RunEventSchema = z.object({
  ts: z.string(),
  runId: z.string(),
  charter: z.string(),
  phase: z.enum([
    "specify",
    "clarify",
    "plan",
    "tasks",
    "analyze",
    "implement",
    "review",
    "checklist",
    "freeform",
  ]),
  kind: z.enum(["start", "stdout", "stderr", "exit", "artifact", "budget.warn", "budget.block"]),
  payload: z.record(z.string(), z.unknown()).default({}),
});
export type RunEvent = z.infer<typeof RunEventSchema>;

// ---------------- Spec (Spec-Kit shape) ----------------
//
// We accept any frontmatter as long as `id` and `title` are present. The
// pipeline phases are responsible for adding their own sections to the body.

export const SpecFrontmatterSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    status: z
      .enum(["draft", "clarifying", "planned", "tasked", "implementing", "reviewed", "done"])
      .default("draft"),
    created: z.string().optional(),
    updated: z.string().optional(),
  })
  .passthrough();
export type SpecFrontmatter = z.infer<typeof SpecFrontmatterSchema>;
