# Purpose

The `triage` skill standardises how the SRE charter reviews recent failures
(audit log + SARIF findings) and produces an actionable triage report. The
output is consumed by humans and by `specfleet check --tune` to suggest charter edits.

# Procedure

1. **Group** failures by `kind` (error, policy.block, budget.block) and by
   `agent`. A single root cause often produces a cluster.
2. For each cluster ≥2 events, pick a representative and answer:
   - What was the agent trying to do? (read `payload`)
   - Was the failure deterministic (policy, budget, schema) or stochastic
     (network, model output)?
   - Is there a charter, skill, or policy change that would prevent recurrence?
3. **Classify** each cluster with one of:
   - `regression` — worked before, broken now → file an issue
   - `policy` — agent attempted disallowed action → tighten charter
   - `budget` — token cap hit → split task or raise cap (with justification)
   - `external` — upstream API/network → add retry / backoff
   - `noise` — transient, no action
4. **Cross-reference SARIF** — if a SARIF rule maps to a failing audit kind,
   raise the severity and link both in the report.
5. **Output format** (markdown):

   ```
   ## Cluster <n>: <one-line summary>
   - count: <int>
   - agents: <list>
   - classification: <regression|policy|budget|external|noise>
   - root cause hypothesis: <1-2 sentences>
   - recommended action: <imperative>
   - refs: <audit ids / SARIF rule ids>
   ```
6. End with a **Top-3 recommendations** section so `specfleet check --tune` can act on it.
7. Never propose auto-applying charter edits. All changes are advisory.
