# NoviMart E-Commerce — Decisions Log

Append-only ADR log written by SpecFleet agents and engineers. Newest entries at the bottom.

---

## ADR-0001 — Cosmos DB (NoSQL) over Azure SQL

- **id**: adr-0001
- **timestamp**: 2025-01-15T09:00:00Z
- **agent**: architect
- **kind**: decision
- **status**: accepted
- **refs**: [`.specfleet/project.md`]

### Context
The catalog has read-heavy, denormalised access patterns (products, categories,
carts indexed by customer). Multi-region read replicas are a likely Phase-2
requirement for global low-latency browse. Order history is append-only.

### Decision
Use **Azure Cosmos DB (NoSQL API)** as the primary store. Containers and
partition keys per `project.md`. Use the official Cosmos SDK directly with a
thin `IRepository<T>` abstraction; **do not** use EF Core for Cosmos in this
project.

### Consequences
- Pro: native multi-region, single-digit-ms reads, schema flexibility, serverless tier for dev
- Con: cross-partition queries are expensive; we accept the partition-key constraint as a design discipline
- Con: no transactions across containers — orders use a transactional batch within a single partition (`/customerId`)

---

## ADR-0002 — API-as-BFF (no separate Node BFF tier)

- **id**: adr-0002
- **timestamp**: 2025-01-15T09:05:00Z
- **agent**: architect
- **kind**: decision
- **status**: accepted
- **refs**: [`.specfleet/instruction.md`]

### Context
The instruction mandates the BFF pattern. Two options: (a) the .NET API is the
BFF for the React SPA (no extra tier); (b) introduce a Node BFF in front of
domain services.

### Decision
**Option (a)** — the .NET 10 minimal API serves *only* the SPA. It is not
exposed as a third-party API. Routes are tailored to SPA viewmodels, not
generic CRUD. This avoids an extra hop, network tier, and language boundary.

### Consequences
- Pro: simpler, fewer moving parts, single language for backend logic
- Pro: easier auth model — one bearer audience
- Con: if a future native mobile app is added, we add a parallel mobile-BFF (still per-client, not a shared API)
- Con: discipline required — no public/partner consumers of this API ever

---

## ADR-0003 — Payment via tokenising redirect (PCI scope reduction)

- **id**: adr-0003
- **timestamp**: 2025-01-15T09:10:00Z
- **agent**: compliance
- **kind**: decision
- **status**: accepted
- **refs**: [`.specfleet/instruction.md`, `.specfleet/policies/pci.md`, `docs/pci-scope-boundary.md`]

### Context
NoviMart must not enter the PCI-DSS CDE. Two options surveyed:
(a) tokenising redirect to a hosted payment page;
(b) embedded iframe with hosted fields.

### Decision
**Option (a)** — full redirect. The browser navigates from the NoviMart checkout
page to the payment provider's hosted page; on completion, the provider
redirects back with an opaque token + status; NoviMart never sees the PAN or CVV.

For the sample we **stub** the provider with a deterministic mock service that
returns a token after a fake delay. The contract is identical to a real
provider (we can swap to Stripe, Adyen, or Braintree by changing config).

### Consequences
- Pro: lowest possible PCI scope (SAQ-A category)
- Pro: provider switch is config-only
- Con: UX has a redirect step (acceptable; provider pages are themable)
- Con: real provider integration deferred to Phase 2 — stub clearly labeled in code and docs
