# Walkthrough 1 — Admin setup: bringing SpecFleet online for NoviMart

> **Audience:** Platform / Security administrator standing up SpecFleet for the
> **NoviMart retail commerce** repo.
> **Estimated time:** 60–90 minutes (most of it reading and reviewing).
> **Outcome:** A reviewed, signed-off `.specfleet/` directory in `main`, locked down
> by CODEOWNERS, validated by `specfleet check`, and mirrored into
> `.github/agents/` for graceful degradation.

This walkthrough is the **first** of four. It targets a single human role: the
admin who is responsible for encoding NoviMart's engineering, security, and
compliance standards once, and ensuring no agent — and no engineer — can ship
code that bypasses them.

---

## Prerequisites

You will need on the workstation:

| Tool | Version | Why |
|---|---|---|
| Node.js | ≥ 20.0.0 | Runs the `specfleet` CLI and the GitHub Copilot SDK |
| .NET SDK | 10.0 (preview ok) | Builds the sample backend |
| Azure CLI (`az`) | ≥ 2.60 | OIDC + tenant lookups |
| Azure Developer CLI (`azd`) | ≥ 1.10 | One-shot infra+app deploys |
| Docker | ≥ 24 | Local container builds |
| `jq` | any | Audit log inspection |
| `gh` | ≥ 2.45 | PR creation, CODEOWNERS preview |

Clone the repo and build the runtime:

```bash
git clone https://github.com/novimart/specfleet.git
cd specfleet
npm install
npm run build
npm link            # exposes `specfleet` on $PATH for the rest of this guide

specfleet --help
```

```text
# Simulated output — actual command emits similar
Usage: specfleet [options] [command]

SpecFleet — autonomous ALM on the GitHub Copilot SDK + CLI.

Commands:
  init                 Bootstrap .specfleet/ and run the architect interview
  plan <goal>          Decompose a goal into role-agent tasks
  run [opts]           Execute the next ready task (or --all)
  review               Compliance + Architect re-review the git diff
  status               Charters, plans, and audit summary
  check                Health, audit verification, evals, and tuning
  log [sessionId]      Tail audit events or replay one session
  config <subcmd>      Inspect and edit instructions, charters, policies, MCP, skills
  spec <subcmd>        Author and list specs
  mcp serve            Run the SpecFleet MCP server
```

Now `cd` into the sample app — that is where the rest of this walkthrough
operates:

```bash
cd sample/novimart-app
```

> **Note:** If the sample's `.specfleet/` directory already exists (it does in this
> repo), treat the walkthrough as a guided code-review tour. Every step has a
> "what's already on disk" pointer so you can compare what `specfleet init` would
> have produced against the reviewed, hand-tuned version that is committed.

---

## Step 1 — `specfleet init`: the architect interview

`specfleet init` is a guided interview hosted by the **Architect role agent** (see
`.specfleet/charters/architect.charter.md`). It writes three files:
`.specfleet/instruction.md` (corporate standards stub), `.specfleet/project.md` (the
project spec), and `.specfleet/decisions.md` (an empty ADR log).

```bash
specfleet init
```

```text
# Simulated output — actual command would emit similar
SpecFleet init — guided architect interview
Session: arc-7f3c (charter: architect, budget: 80,000 tokens)
Audit:   .specfleet/audit/arc-7f3c.jsonl

? What is the project name?  NoviMart E-Commerce
? Mode (greenfield / brownfield / modernization)?  greenfield
? One-line description?
  B2C retail commerce for NoviMart — catalog, cart, checkout via tokenising
  redirect to a PCI provider, customer accounts, order history.
? Primary backend language / runtime?  csharp / dotnet10
? Primary frontend stack?  react + vite + typescript + tailwind
? Approved data stores (comma-separated)?
  azure-cosmos-nosql, azure-storage-blob, azure-cache-redis
? Hosting target (container-apps / app-service / aks / functions)?
  container-apps (api) + static-web-apps (web)
? Identity providers?
  customers: entra-external-id ; admins: entra-id + mfa
? Compliance scope (gdpr | pci | hipaa | sox | iso27001 | zero-trust ...)?
  gdpr, pci-scope-reduced, zero-trust
? Data classification of the highest-class data this service processes?
  restricted (PII + order history)
? Default Azure regions for restricted data?
  eu: westeurope, northeurope ; na: eastus2, westus2
? Generate role + subagent charter scaffolds for the above? (Y/n)  Y

✓ Wrote .specfleet/instruction.md   (template — review and harden)
✓ Wrote .specfleet/project.md
✓ Wrote .specfleet/decisions.md
✓ Wrote 7 role charters under .specfleet/charters/
✓ Wrote 18 subagent charters under .specfleet/charters/subagents/
✓ Wrote .specfleet/policies/secrets.json (default redaction patterns)
✓ Wrote .specfleet/mcp/.gitkeep      (scoped MCP manifests live here)
✓ Wrote .specfleet/audit/.gitkeep    (append-only JSONL log)
✓ Wrote .specfleet/CODEOWNERS.example

Next steps:
  1. Harden .specfleet/instruction.md (it is your corporate contract).
  2. Run: specfleet config validate
  3. Run: specfleet check
  4. PR `.specfleet/` into main with security + compliance reviewers.
```

> **What just happened?**
>
> The Architect agent ran in its own SDK session with an 80K-token cap and
> wrote audit events for every prompt, file write, and policy decision to
> `.specfleet/audit/arc-7f3c.jsonl`. The interview is the only SpecFleet flow that is
> allowed to write `.specfleet/instruction.md` — and only when the file does not
> already exist. After this session, instruction.md becomes immutable from
> the agent runtime's point of view (see Step 4).

---

## Step 2 — Author `instruction.md`: the corporate contract

`.specfleet/instruction.md` is the single, versioned, signed-off statement of "what
NoviMart considers a shippable change." Every subsequent agent session
loads it before doing anything else; the Compliance agent re-checks every
diff against it; CI re-validates it on every PR. **It is the most important
file in the repo.**

The committed version is at `sample/novimart-app/.specfleet/instruction.md`. Open
it now — we will walk every section.

### YAML frontmatter

```yaml
---
version: "1.0.0"
organization: "NoviMart"
effectiveDate: "2025-01-15"
owners:
  - "platform-engineering@novimart.example"
  - "security-leads@novimart.example"
  - "compliance@novimart.example"
policies:
  coding:        [...]
  security:      [...]
  compliance:    [...]
  operations:    [...]
  data:          [...]
approvedRuntimes:   [dotnet10, node20, node22]
approvedFrameworks: [asp.net-core, minimal-api, ef-core, react, vite, ...]
forbidden:          [eval, child_process.exec with unvalidated input, ...]
contacts:           {security, compliance, platform, privacy}
---
```

- `version` is **semver**. Bump *minor* when adding a non-breaking rule;
  bump *major* when removing or weakening one. The runtime exposes the
  version in every audit event so you can correlate findings to a specific
  policy revision.
- `effectiveDate` is what auditors will quote.
- `owners` is informational; CODEOWNERS is what the runtime enforces (Step 4).

### `policies.coding`

Each rule is a single declarative MUST/SHOULD sentence the agents can pattern-
match. Examples and rationale:

| Rule | Why it is a hard rule |
|---|---|
| All code MUST follow SOLID principles. | Compliance agent applies the SOLID subagent on every diff. |
| Public APIs MUST have inline XML/JSDoc. | Architect/readable subagent flags missing docs as MEDIUM. |
| Cyclomatic complexity ≤ 10 per function. | Maintainability gate — keeps Dev subagents from generating "clever" code. |
| Treat warnings as errors. | Closes the silent-warning loophole that .NET previews often introduce. |
| BFF pattern. | Architectural posture: each SPA gets its own API; no public/partner consumers (see ADR-0002). |
| 90% line coverage on changed and adjacent code. | Test agent enforces. The "adjacent" clause prevents shaving coverage by spreading edits. |

### `policies.security`

These are the rules that map directly to **NIST 800-53**, **CIS** controls,
and the **OWASP ASVS** checklist. The DevSecOps agent + Zero-Trust subagent
read every PR for violations.

| Rule | Maps to | Why |
|---|---|---|
| No secrets in source. | NIST IA-5 | Secret-scanning subagent + `.specfleet/policies/secrets.json` redactor. |
| Auth on every endpoint unless `[AllowAnonymous]`. | OWASP ASVS V2 | Default-deny posture; explicit anonymous needs a doc'd reason. |
| Service auth via Entra managed identity. | Zero Trust §3 | Removes connection-string and client-secret blast radius. |
| `dotnet list package --vulnerable` clean. | OWASP A06:2021 | CI gate. |
| Image scan with Trivy + sign with Cosign. | NIST SR-3 | `security.yml` workflow. |
| Customers on Entra External ID; admins on Entra ID + MFA. | NIST IA-2(1) | Two trust planes; never mix. |
| Server-side validation + output encoding. | OWASP A03:2021 | Always. |
| No CORS wildcards on authenticated endpoints. | OWASP A05:2021 | Audited per-PR. |

### `policies.compliance` — GDPR

Every personal-data path is in scope:

- **Encryption at rest with CMK for restricted data** — GDPR Art. 32(1)(a)
  ("appropriate technical measures"). CMK gives NoviMart a documented kill switch.
- **GDPR data subject rights endpoints** — Arts. 15–22. The compliance/gdpr
  subagent reviews every PR that touches customer data for missing
  access/rectify/erase/portability paths.
- **Audit retention 7y, security in tamper-evident storage** — Art. 30 records
  of processing + national supervisory authority guidance.
- **Restricted data must not leave approved EU/NA regions** — Art. 44–49
  cross-border transfer rules. The IaC subagent re-checks region pinning on
  every Bicep change.

### `policies.compliance` — PCI-DSS scope reduction

NoviMart's posture is **out of CDE scope by design**. The two relevant
clauses:

- "Cardholder data MUST NEVER be stored, logged, or transmitted by NoviMart
  systems. All payment flows MUST use a tokenising redirect/iframe to a
  PCI-DSS Level-1 provider." — maps to PCI-DSS v4.0 **Req. 3** (no storage)
  and **Req. 4** (transmission protection delegated to provider).
- "PCI-DSS scope reduction is mandatory; PRs introducing PAN/SAD MUST be
  blocked." — operationalised by the compliance/pci subagent's regex pack
  for PAN-shaped data, and by the `forbidden` list ("any logging of request
  bodies on /payments, /checkout, /account routes").

### `policies.compliance` — Zero Trust

- Verify explicitly, least privilege, assume breach.
- "Database public network access MUST be disabled." — directly enforced in
  `infra/modules/cosmos.bicep` (`publicNetworkAccess: 'Disabled'`).

### `policies.operations`

- `/livez` + `/readyz` — Kubernetes/Container Apps probe contract.
- OpenTelemetry → App Insights — observability is a feature.
- Reproducible from a tagged commit via `azd up` — disaster-recovery spec.
- Bundle budget 200 KB gz — frontend perf gate (LCP-bound).
- p99 500 ms read / 1500 ms write — SRE budget.
- All resources tagged with `env`, `cost-center`, `owner`,
  `data-classification`, `compliance-scope` — finance + audit + DR depend on
  this.

### `policies.data`

- N-1 schema compatibility — required for blue/green and rollback.
- Cosmos partition key documented in `/docs/architecture.md` — design hygiene.
- Audit event on every PII write — GDPR Art. 30.
- Retention table — concrete SLAs the GDPR subagent will check.

### `approvedRuntimes` / `approvedFrameworks` / `forbidden`

Whitelist + blacklist. The Architect agent rejects PRs that introduce a
runtime or framework not on the list (an ADR can extend the list — that PR
goes through the same CODEOWNERS gate). The `forbidden` list halts agent
work immediately.

> **What just happened?**
>
> No code was executed. The whole point of `instruction.md` is that it is a
> **declarative contract** parsed by every agent. When you run
> `specfleet config validate` (Step 5), the runtime parses this YAML against its
> Zod schema (`src/schema/`) and refuses to start any session if it is
> malformed. When you run `specfleet review` later, the Compliance role agent
> emits a `| severity | rule | file | message |` table grounded in these
> exact bullet points.

---

## Step 3 — Add policy files + compliance subagent charters

`instruction.md` is the contract. The `.specfleet/policies/` directory carries
**operational detail** that would clutter the contract — concrete regex
packs, retention tables, allow-/blocklists, sample DPIA templates. Three
files are committed for NoviMart:

```
.specfleet/policies/
  gdpr.md          Art-by-Art operational notes + DPIA trigger list
  pci.md           PAN/SAD detection patterns + redirect-only checklist
  zero-trust.md    Identity-/network-/data-plane controls matrix
  secrets.json     Redaction patterns applied to all session output
```

Now wire those policies into agent charters. The compliance role spawns four
subagents — one per scope — each with its own context budget:

```bash
specfleet config new charter compliance/compliance-gdpr
```

```text
# Simulated output — actual command emits similar
✓ Created .specfleet/charters/subagents/compliance/gdpr.charter.md
  template:        templates/charters/subagents/compliance/gdpr.charter.md
  parent:          compliance
  maxContextTokens: 50000   (default for subagents)
  allowedTools:    [read, search_code]
  mcpServers:      []
  requiresHumanGate: false

Edit the prompt body, then run: specfleet config validate
```

Open `.specfleet/charters/subagents/compliance/gdpr.charter.md`. The frontmatter
fields you must understand as an admin:

```yaml
---
name: compliance/gdpr            # routing key; must be unique
displayName: Compliance — GDPR
role: compliance
tier: subagent
parent: compliance               # role agent that may spawn this subagent
maxContextTokens: 50000          # hard cap; runtime refuses higher prompts
allowedTools:                    # ALLOWLIST. Anything not listed is denied.
  - read
  - search_code                  # NB: no `write`, no `shell`
spawns: []                       # leaf — cannot spawn further
mcpServers: []                   # no external network/MCP servers
skills: []
requiresHumanGate: false         # can run unattended in CI
---
```

The body is a **prompt**: a structured checklist of what to look for
(personal data, lawful basis, DSR endpoints, retention, transfers). The
runtime concatenates frontmatter rules + body + the brief into the SDK
session prompt and enforces the budget before sending.

> **What just happened?**
>
> `specfleet config new charter` only scaffolded a file. The runtime does **not** yet
> trust this charter — `specfleet config validate` (Step 5) is what binds it
> into the loadable charter set. Until then, the orchestrator will refuse
> to spawn `compliance/gdpr`.

Repeat for `compliance/pci`, `compliance/zero-trust`, and
`compliance/policies` (this last one is the catch-all that walks every
`policies.*` rule from instruction.md). All four are already committed.

---

## Step 4 — Lock down `.specfleet/instruction.md`

Two layers of protection. Both are needed.

### Layer 1 — CODEOWNERS

Copy the CODEOWNERS template into the **repo root** (it must live at
`.github/CODEOWNERS` to take effect on GitHub):

```bash
mkdir -p .github
cp .specfleet/CODEOWNERS.example .github/CODEOWNERS
```

The NoviMart rules:

```text
# Default
*                                @novimart/platform-engineering

# Immutable SpecFleet artifacts — restricted to security and compliance
.specfleet/instruction.md              @novimart/security-leads @novimart/compliance
.specfleet/policies/                   @novimart/security-leads @novimart/compliance
.specfleet/charters/                   @novimart/platform-engineering
.specfleet/charters/subagents/compliance/   @novimart/security-leads @novimart/compliance

# Backend / Frontend / IaC
backend/                         @novimart/backend-team
backend/src/NoviMart.Infrastructure/Payments/   @novimart/payments-team @novimart/compliance
frontend/                        @novimart/frontend-team
infra/                           @novimart/platform-engineering @novimart/security-leads
.github/workflows/               @novimart/platform-engineering
```

Combine with a **branch protection rule** on `main` that requires CODEOWNERS
review. The committed `sample/novimart-app/.github/CODEOWNERS` already
encodes this.

### Layer 2 — `onPreToolUse` runtime hook

GitHub branch protection only fires at PR-merge time. The runtime hook
fires **at every agent attempt to write the file** — including in CI when
`specfleet run` is running unattended. It is configured in
`.specfleet/charters/<role>.charter.md` (or globally) and lives in source at
`src/hooks/`. The behaviour:

```text
# Simulated output — actual hook fires inline during a session
[hook] onPreToolUse  charter=dev/backend  tool=write  path=.specfleet/instruction.md
[hook] DENY — file is in IMMUTABLE_AT_RUNTIME list. Aborting session.
[audit] {"ts":"2025-01-20T11:04:22Z","sessionId":"dev-9c1a","event":"policy.block",
         "rule":"immutable","path":".specfleet/instruction.md"}
```

The runtime exits the agent session, writes a `policy.block` audit entry,
and surfaces a non-zero exit to the orchestrator. The orchestrator does
**not** retry — instruction.md changes are a human concern only.

> **What just happened?**
>
> Two independent gates now protect instruction.md: GitHub will refuse the
> merge without `@novimart/security-leads` + `@novimart/compliance` approval, and
> the SpecFleet runtime will refuse the write attempt before it ever reaches a
> commit. Either gate alone is a single point of failure.

---

## Step 5 — `specfleet config validate`

```bash
specfleet config validate
```

```text
# Simulated output — actual command would emit similar
SpecFleet charter validate — sample/novimart-app/.specfleet/charters/

  ✓ root.charter.md                 (orchestrator,    cap: 90000, tools: read,search_code)
  ✓ architect.charter.md            (role,            cap: 80000, tools: read,search_code,write)
  ✓ dev.charter.md                  (role,            cap: 80000, tools: read,write,search_code,shell)
  ✓ test.charter.md                 (role,            cap: 80000)
  ✓ devsecops.charter.md            (role,            cap: 75000)
  ✓ compliance.charter.md           (role,            cap: 70000, humanGate: true)
  ✓ sre.charter.md                  (role,            cap: 75000)

subagents/
  architect/
    ✓ interviewer        cap: 60000   tools: read,write,search_code
    ✓ solid              cap: 50000   tools: read,search_code
    ✓ readable           cap: 50000
    ✓ maintainable       cap: 50000
    ✓ scalable           cap: 50000
  compliance/
    ✓ policies           cap: 60000
    ✓ gdpr               cap: 50000
    ✓ pci                cap: 50000
    ✓ zero-trust         cap: 50000
  dev/
    ✓ frontend           cap: 70000   tools: read,write,search_code,shell
    ✓ backend            cap: 70000   tools: read,write,search_code,shell
    ✓ database           cap: 60000
    ✓ messaging          cap: 60000
  devsecops/
    ✓ iac                cap: 60000
    ✓ cicd               cap: 60000
    ✓ deploy             cap: 50000
    ✓ idempotency        cap: 50000
  sre/
    ✓ observability      cap: 60000
    ✓ availability       cap: 60000
    ✓ performance        cap: 60000
    ✓ aiops              cap: 60000

Charter graph
  - 7 role agents, 22 subagents, 0 sub-subagents
  - All caps ≤ 90,000 (hard ceiling). ✓
  - All allowedTools subsets of role allowlist.  ✓
  - All MCP scopes resolve to a manifest in .specfleet/mcp/.  ✓
  - No orphan parents.  ✓
  - No cycles.  ✓

PASS  29 charters validated in 412 ms.
```

If a single check fails (e.g. a subagent declares `write` when its parent
does not, or `maxContextTokens > 95000`), the command exits non-zero and CI
turns red.

---

## Step 6 — `specfleet check`

`specfleet check` is the green-light check before merging:

```bash
specfleet check
```

```text
# Simulated output — actual command would emit similar
SpecFleet doctor — sample/novimart-app

[env]
  ✓ Node 20.11.0           (>= 20.0.0)
  ✓ git 2.46               (repo clean)
  ✓ GitHub Copilot CLI authenticated as platform-eng-bot
  ✓ SpecFleet runtime 0.4.0
[.specfleet integrity]
  ✓ instruction.md present, schema valid, version=1.0.0
  ✓ project.md present, schema valid
  ✓ decisions.md append-only (3 ADRs, monotonic timestamps)
  ✓ 29 charters loaded (see `specfleet config validate`)
  ✓ 4 policy files: gdpr.md, pci.md, zero-trust.md, secrets.json
  ✓ MCP scopes: 0 manifests (no external MCP servers in scope)
  ✓ audit/ writable, append-only mode set
  ✓ CODEOWNERS protects: instruction.md, policies/, charters/subagents/compliance/
[budgets]
  ✓ All charters ≤ 95,000 token cap
  ✓ Default orchestrator budget 90,000
[hooks]
  ✓ onPreToolUse  registered for: immutable paths, secret patterns
  ✓ onPostToolUse registered for: audit write, secret redaction
[telemetry]
  ✓ Audit dir: .specfleet/audit/  (mode 0644, append-only)
  ✓ Last 7 sessions complete (no orphan locks)

ALL GREEN — safe to commit and PR.
```

If `specfleet check` finds anything yellow (e.g. CODEOWNERS missing for
instruction.md, or audit dir not writable), it exits non-zero. Wire this
into `ci.yml` as a required check.

---

## Step 7 — Commit and open the bootstrap PR

```bash
git checkout -b admin/specfleet-bootstrap
git add .specfleet/ .github/CODEOWNERS docs/walkthrough-01-admin-setup.md
git commit -m "chore(specfleet): bootstrap .specfleet/ for NoviMart

- instruction.md v1.0.0 (corporate contract)
- 29 charters (7 role + 22 subagent)
- policies: GDPR, PCI scope-reduction, Zero Trust, secrets
- CODEOWNERS lock on instruction.md + policies + compliance charters

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
git push -u origin admin/specfleet-bootstrap
gh pr create --base main --fill --reviewer novimart/security-leads,novimart/compliance
```

PR description (recommended template):

```markdown
## SpecFleet bootstrap — NoviMart

This PR establishes the SpecFleet governance layer.

### What this PR does
- Adds `.specfleet/` with the immutable engineering contract (`instruction.md`).
- Defines the 29-agent hierarchy (7 role + 22 subagent charters).
- Wires GDPR / PCI scope-reduction / Zero-Trust policies into the
  Compliance role.
- Adds CODEOWNERS so future changes to `.specfleet/instruction.md` and
  `.specfleet/policies/` require Security + Compliance approval.

### What this PR does not do
- Does not deploy infra (see Walkthrough 4).
- Does not merge any application code.
- Does not change any developer workflow yet (see Walkthrough 2).

### Reviewer checklist
- [ ] `instruction.md` matches corporate engineering standards v2025.
- [ ] All policy bullets cite a regulatory or internal source.
- [ ] Forbidden list covers known attack patterns for this stack.
- [ ] CODEOWNERS rules are correct.
- [ ] `specfleet config validate` is green in CI.
- [ ] `specfleet check` is green in CI.
```

CODEOWNERS rules will auto-request review from
`@novimart/security-leads` and `@novimart/compliance`. The PR cannot
merge without both approvals.

> **What just happened?**
>
> The `.specfleet/` directory is now under the same change-management discipline
> as production code. From this point forward, **any** change to a policy,
> charter, or instruction must go through the same review loop.

---

## Step 8 — `specfleet check --fix`: graceful degradation

Not every engineer will have the `specfleet` CLI installed on day one. To make
sure those engineers still get the same charter context when they invoke
plain GitHub Copilot CLI custom agents, mirror the charters into
`.github/agents/`:

```bash
specfleet check --fix
```

```text
# Simulated output — actual command emits similar
SpecFleet check --fix — writing graceful-degradation copies

  ✓ .github/agents/architect.agent.md
  ✓ .github/agents/dev.agent.md
  ✓ .github/agents/test.agent.md
  ✓ .github/agents/devsecops.agent.md
  ✓ .github/agents/compliance.agent.md
  ✓ .github/agents/sre.agent.md
  + 22 subagents under .github/agents/subagents/

NOTE: mirrored copies do NOT carry the maxContextTokens enforcement, the
audit hooks, the secret redactor, or the immutable-path block. They are a
best-effort UX so that engineers without the SpecFleet runtime still load the
correct prompt. Only the SpecFleet runtime is policy-bearing.
```

Commit the mirror:

```bash
git add .github/agents/
git commit -m "chore(specfleet): mirror charters to .github/agents for fallback UX

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

> **Warning:** The mirror is **read-only convenience**. If a developer edits
> `.github/agents/dev.agent.md` directly, `specfleet check` will fail
> the next CI run because the source of truth (`.specfleet/charters/dev.charter.md`)
> is unchanged and the mirror is now out of sync. Run `specfleet check --fix`
> locally to regenerate mirrors, then commit the generated files.

---

## Operating runbook

These three procedures are what an admin will actually do in week 2 and
beyond. Save the page.

### Add a new policy

1. Open a PR adding the rule under the appropriate `policies.*` array in
   `.specfleet/instruction.md`.
2. CODEOWNERS auto-requests `@novimart/security-leads` + `@novimart/compliance`.
3. Append a one-paragraph entry to `.specfleet/decisions.md` explaining
   motivation and the regulatory or internal source.
4. Bump `version` in the YAML frontmatter (minor for additive, major for
   tightening that breaks existing workflows).
5. After merge, the next agent session loads the new rule. The Compliance
   agent will start enforcing it on the next `specfleet review` or PR.

### Retire a charter

1. Run `specfleet config list` to confirm no other charter declares it as
   `parent`. If any do, retire those first (or re-parent them).
2. Open a PR deleting the charter file. CI will re-run
   `specfleet config validate` and confirm no orphan parents.
3. The runtime treats the deleted charter as immediately unavailable; any
   queued plan task targeting it is failed with `charter_not_found`.
4. Append an entry to `.specfleet/decisions.md`.

### Roll out an instruction.md update with a comment period

For tightening changes that break existing workflows (e.g. raising coverage
to 95% or adding a new forbidden API):

1. Open a PR with the proposed change, **labeled `comment-period`**.
2. Run `specfleet review` locally against the proposed diff to preview the
   policy impact.
3. Post the report in the PR. Open for org-wide comment.
4. After the comment period, address feedback, get CODEOWNERS approval,
   merge. Bump version, update `effectiveDate`, append ADR.
5. Communicate the effective date in #eng-broadcast at least 7 days before
   the next sprint boundary.

---

## Appendix — what got written, where

```
sample/novimart-app/
├── .specfleet/
│   ├── instruction.md              # corporate contract (immutable)
│   ├── project.md                  # NoviMart spec
│   ├── decisions.md                # append-only ADR log
│   ├── CODEOWNERS.example          # copy → .github/CODEOWNERS
│   ├── charters/
│   │   ├── architect.charter.md    # role
│   │   ├── compliance.charter.md
│   │   ├── dev.charter.md
│   │   ├── devsecops.charter.md
│   │   ├── sre.charter.md
│   │   ├── test.charter.md
│   │   └── subagents/
│   │       ├── architect/{interviewer,solid,readable,maintainable,scalable}.charter.md
│   │       ├── compliance/{policies,gdpr,pci,zero-trust}.charter.md
│   │       ├── dev/{frontend,backend,database,messaging}.charter.md
│   │       ├── devsecops/{iac,cicd,deploy,idempotency}.charter.md
│   │       └── sre/{observability,availability,performance,aiops}.charter.md
│   ├── policies/
│   │   ├── gdpr.md
│   │   ├── pci.md
│   │   ├── zero-trust.md
│   │   └── secrets.json
│   ├── mcp/                        # scoped MCP manifests (none yet)
│   ├── audit/                      # JSONL audit log
│   ├── plans/                      # populated by `specfleet plan`
│   ├── checkpoints/                # populated by `specfleet run`
│   ├── skills/                     # lazy-loaded procedures
│   └── index/                      # session index
├── .github/
│   ├── CODEOWNERS                  # enforces instruction.md immutability
│   └── agents/                     # graceful-degradation mirror
└── docs/
    └── walkthrough-01-admin-setup.md   # this document
```

---

## Where to next

- **Walkthrough 2 — Developer flow.** A backend engineer runs `specfleet plan` →
  `specfleet run` to add a new endpoint, hits a compliance gate, fixes,
  ships.
- **Walkthrough 3 — Reviewer flow.** A compliance reviewer uses
  `specfleet review` + `specfleet log` to pre-screen a complex PR.
- **Walkthrough 4 — DevOps deployment.** First-time deploy of the full
  NoviMart stack to Azure with `azd up`, including the SpecFleet-driven
  pre-flight review of the Bicep.

You are now done with admin setup. The rest is enforcement, and
enforcement is automated.
