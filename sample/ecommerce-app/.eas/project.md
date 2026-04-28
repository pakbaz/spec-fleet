---
name: "Acme Retail E-Commerce"
mode: "greenfield"
description: "B2C e-commerce platform for Acme Retail — product catalog, cart, checkout (with tokenising redirect to a PCI provider), customer accounts, order history. Backend is API-as-BFF for the React SPA."
primaryLanguage: "csharp"
runtime: "dotnet10"
frameworks:
  - "asp.net-core"
  - "minimal-api"
  - "react"
  - "vite"
  - "tanstack-query"
  - "tailwind"
  - "msal-react"
  - "xunit"
  - "vitest"
  - "playwright"
dataStores:
  - "azure-cosmos-db"
  - "azure-cache-for-redis"
  - "azure-storage-blob"
integrations:
  - "microsoft-entra-external-id"
  - "microsoft-entra-id"
  - "azure-key-vault"
  - "azure-monitor"
  - "application-insights"
  - "stripe-tokenising-redirect-stub"
deploymentTargets:
  - "azure-container-apps"
  - "azure-static-web-apps"
nfr:
  availabilityTier: "gold"
  performanceP99Ms: 500
  securityTier: "elevated"
complianceScope:
  - "gdpr"
  - "pci-dss"
  - "zero-trust"
notes: "Acme Retail is OUT of PCI-DSS CDE scope by design. Payment flows redirect to a tokenising provider (stubbed in this sample). The Acme Retail backend never receives PAN or CVV. The PCI Reviewer subagent enforces this boundary."
---

# Acme Retail E-Commerce — Project Spec

## Vision

A modern, accessible, GDPR-compliant e-commerce experience for Acme Retail
customers in the EU and North America. Predictable performance, observable
operations, reversible deploys.

## Personas

- **Shopper** — anonymous browse, optionally signs in via Entra External ID to save carts and view order history
- **Admin** — Acme Retail employee, signs in via Entra ID with MFA to manage catalog, view orders
- **Operator** — SRE / Platform, manages deployments, observes production

## Capabilities (MVP)

1. **Catalog browse** — list products by category, search by text, paginated
2. **Product detail** — single product with images, description, price, stock
3. **Cart** — add/remove items, persist for signed-in users, optimistic UI
4. **Checkout** — collect shipping address, redirect to payment provider (stubbed in this sample), receive tokenised completion callback, write order
5. **Account** — sign in/out, view orders, exercise GDPR rights (access, rectification, erasure, portability)
6. **Admin** — CRUD products, view orders (no PAN visibility), audit log

## Architecture (high level)

```
[ React SPA ]                     [ .NET 10 BFF API ]                 [ Cosmos DB ]
   (Static Web App)  ─── HTTPS ─►  (Container Apps)   ─── private  ─►  (private endpoint)
        │                                  │
        │                                  ├──► Azure Cache (Redis)   private endpoint
        │                                  ├──► Azure Storage (blob)  private endpoint
        │                                  ├──► Key Vault             managed identity
        │                                  └──► App Insights / OTEL
        │
        └─── MSAL ──► Entra External ID (customers)
                     Entra ID + MFA       (admins)

        [ Payment Provider ] ◄── browser redirect (tokenising hosted fields) ──┘
              (PCI L1)             completion callback returns token only
```

## Data model (Cosmos containers)

| Container | Partition key | Purpose | Notes |
|---|---|---|---|
| `products` | `/categoryId` | catalog items | read-heavy, public; cached in Redis |
| `categories` | `/region` | category tree | small, mostly read |
| `carts` | `/customerId` | active carts | TTL 30 days; ephemeral for anonymous |
| `orders` | `/customerId` | placed orders | append-only history; 7y retention |
| `customers` | `/customerId` | profile data | personal data, encrypted at rest with CMK |
| `audit` | `/aggregateId` | audit events | tamper-evident; 7y retention |

Partition keys chosen for read locality (one customer's data co-located) and
write distribution (categoryId for products spreads writes).

## Non-functional requirements

- **Availability**: gold tier — 99.9% monthly, multi-zone within region.
- **Performance**: p99 ≤ 500 ms on read endpoints (`/products`, `/categories`); p99 ≤ 1500 ms on write endpoints (`/cart`, `/orders`).
- **Security**: elevated tier — Zero Trust posture; managed identities only; private endpoints; CMK on personal-data containers.
- **Accessibility**: WCAG 2.1 AA on all customer-facing pages.
- **Bundle**: initial route ≤ 200 KB gzipped on the SPA.
- **Coverage**: ≥ 90% line coverage on changed and adjacent code.

## Compliance scope

- **GDPR** — applies (EU customers). Lawful bases: contract for orders, legitimate interest for catalog analytics, consent for marketing email. Subject rights endpoints required on `/api/me/*`.
- **PCI-DSS** — *out of CDE scope by design*. PCI Reviewer subagent blocks any PR introducing PAN/SAD into Acme systems.
- **Zero Trust** — applied across all six pillars (see `.eas/policies/zero-trust.md`).

## Out of scope (this sample)

- Inventory reservation / warehouse integration
- Marketing campaigns, recommendations engine
- Multi-currency / multi-tax-jurisdiction logic
- Returns / RMA workflow
- Real payment provider integration (stubbed — see `docs/pci-scope-boundary.md`)

## Glossary

- **BFF** — Backend for Frontend. The .NET API exists to serve the React SPA; it is not a public API surface.
- **CDE** — Cardholder Data Environment (PCI-DSS).
- **CIAM** — Customer Identity and Access Management (Entra External ID).
- **PIM** — Privileged Identity Management (just-in-time admin access).
- **CMK** — Customer-Managed Key (encryption-at-rest with keys we control via Key Vault).
