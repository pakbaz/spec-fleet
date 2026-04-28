/**
 * Zod schemas for .eas/ artifacts. The runtime validates every charter, instruction,
 * and project file against these before any agent session is created.
 */
import { z } from "zod";

// ---------------- Instruction (corporate, immutable) ----------------

export const InstructionSchema = z.object({
  version: z.string().min(1),
  organization: z.string().min(1),
  effectiveDate: z.string(),
  owners: z.array(z.string()).min(1),
  policies: z
    .object({
      coding: z.array(z.string()).default([]),
      security: z.array(z.string()).default([]),
      compliance: z.array(z.string()).default([]),
      operations: z.array(z.string()).default([]),
      data: z.array(z.string()).default([]),
    })
    .default({
      coding: [],
      security: [],
      compliance: [],
      operations: [],
      data: [],
    }),
  approvedRuntimes: z.array(z.string()).default([]),
  approvedFrameworks: z.array(z.string()).default([]),
  forbidden: z.array(z.string()).default([]),
  contacts: z.record(z.string(), z.string()).default({}),
});
export type Instruction = z.infer<typeof InstructionSchema>;

// ---------------- Project (per-repo, output of guided interview) ----------------

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
  nfr: z
    .object({
      availabilityTier: z.enum(["bronze", "silver", "gold", "platinum"]).default("silver"),
      performanceP99Ms: z.number().int().positive().default(500),
      securityTier: z.enum(["standard", "elevated", "regulated"]).default("standard"),
    })
    .default({
      availabilityTier: "silver",
      performanceP99Ms: 500,
      securityTier: "standard",
    }),
  complianceScope: z.array(z.string()).default([]),
  notes: z.string().optional(),
});
export type Project = z.infer<typeof ProjectSchema>;

// ---------------- Charter (per agent) ----------------

export const CharterRoleSchema = z.enum([
  "orchestrator",
  "architect",
  "dev",
  "test",
  "devsecops",
  "compliance",
  "sre",
]);
export type CharterRole = z.infer<typeof CharterRoleSchema>;

export const CharterTierSchema = z.enum(["root", "role", "subagent", "subsubagent"]);
export type CharterTier = z.infer<typeof CharterTierSchema>;

export const CharterSchema = z.object({
  name: z.string().min(1).regex(/^[a-z][a-z0-9-]*(\/[a-z][a-z0-9-]*)*$/, {
    message: "Charter name must be lowercase, kebab-case, optionally namespaced with '/'",
  }),
  displayName: z.string().min(1),
  role: CharterRoleSchema,
  tier: CharterTierSchema,
  parent: z.string().optional(),
  description: z.string().min(1),
  // Token budget enforced by EAS runtime. Hard ceiling 95K (5K headroom under 100K).
  maxContextTokens: z.number().int().positive().max(95_000).default(80_000),
  // Allowlist of CLI/SDK tool names. Anything else is excludedTools at session boundary.
  allowedTools: z.array(z.string()).default([]),
  // Subagents this charter may spawn. Used to plan delegation graph.
  spawns: z.array(z.string()).default([]),
  // MCP servers this charter is allowed to use, by manifest name in .eas/mcp/.
  mcpServers: z.array(z.string()).default([]),
  // Skills to lazy-load on demand (filenames in .eas/skills/, no extension).
  skills: z.array(z.string()).default([]),
  // Model selection. Optional; runtime picks a default if absent.
  model: z.string().optional(),
  // If true, requires human approval gate before completing the agent's turn.
  requiresHumanGate: z.boolean().default(false),
  // The free-form prompt body (everything after the YAML frontmatter).
  body: z.string().min(20),
  // Optional cryptographic signature over the charter (full v0.3 sigstore wiring;
  // v0.2 ships the schema + verifier hook only).
  signature: z.string().optional(),
  signed_by: z.string().optional(),
});
export type Charter = z.infer<typeof CharterSchema>;

// ---------------- Decisions log (append-only) ----------------

export const DecisionSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  agent: z.string(),
  kind: z.enum(["plan", "decision", "gate", "result", "error"]),
  title: z.string(),
  body: z.string(),
  refs: z.array(z.string()).default([]),
});
export type Decision = z.infer<typeof DecisionSchema>;

// ---------------- Audit event ----------------

export const AuditEventSchema = z.object({
  ts: z.string(),
  sessionId: z.string(),
  agent: z.string(),
  kind: z.enum([
    "session.start",
    "session.end",
    "user.prompt",
    "tool.pre",
    "tool.post",
    "permission.request",
    "policy.block",
    "secret.redacted",
    "secret.warn",
    "egress.block",
    "ip.block",
    "ip.redacted",
    "budget.warn",
    "budget.block",
    "gate.requested",
    "gate.approved",
    "gate.denied",
    "error",
  ]),
  payload: z.record(z.string(), z.unknown()).default({}),
  // Tamper-evident hash chain (v0.2). Optional in schema for backward-compat
  // when reading older logs; AuditLog.emit always populates them on write.
  seq: z.number().int().nonnegative().optional(),
  prevHash: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  hash: z.string().regex(/^[0-9a-f]{64}$/).optional(),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;
