# Walkthrough 04 — DevOps: Deploy Acme Retail to Azure with `azd up`

> **Audience:** A platform / DevOps engineer responsible for shipping the Acme Retail sample to
> a real Azure subscription, validating the security posture, and tearing it down.
>
> **What you will deploy:**
>
> - Azure Container Apps (the .NET 10 BFF API)
> - Azure Static Web Apps (the React SPA)
> - Azure Cosmos DB for NoSQL (Serverless tier)
> - Azure Key Vault (secret-less; managed identity only)
> - Azure Container Registry (ACR), Log Analytics, Application Insights
> - User-assigned Managed Identity, RBAC role assignments
>
> **Cost:** ~ $0–5 / day idle. Run `azd down` when finished.

---

## Table of contents

1. [Prerequisites](#1-prerequisites)
2. [One-time tenant setup (Entra External ID)](#2-one-time-tenant-setup-entra-external-id)
3. [Step 1 — `azd auth login` and `azd init`](#step-1--azd-auth-login-and-azd-init)
4. [Step 2 — Pre-deployment hooks (`infra/hooks/preprovision.sh`)](#step-2--pre-deployment-hooks-infrahookspreprovisionsh)
5. [Step 3 — `azd up`](#step-3--azd-up)
6. [Step 4 — Verify the deployment](#step-4--verify-the-deployment)
7. [Step 5 — Run the EAS deployment compliance gate](#step-5--run-the-eas-deployment-compliance-gate)
8. [Step 6 — Configure the GitHub Actions CI/CD pipeline](#step-6--configure-the-github-actions-cicd-pipeline)
9. [Step 7 — Smoke test the public URLs](#step-7--smoke-test-the-public-urls)
10. [Step 8 — Tear down with `azd down`](#step-8--tear-down-with-azd-down)
11. [Architecture & naming reference](#architecture--naming-reference)
12. [Troubleshooting](#troubleshooting)

---

## 1. Prerequisites

```bash
# Required
az --version             # Azure CLI 2.60+
azd version              # azure-developer-cli 1.10+
docker --version         # Docker 24+ (required to build the API image locally)
gh --version             # GitHub CLI (for CI/CD wiring)

# Optional but recommended
bicep --version          # 0.28+ (azd bundles its own copy)
jq --version             # for inspecting outputs
```

You must own (or be `Owner` on) the target subscription, since the Bicep template assigns RBAC
roles. If you only have `Contributor`, ask a subscription owner to grant you `User Access
Administrator` on the resource group beforehand.

```bash
# Choose target
export AZURE_SUBSCRIPTION_ID=<your-sub-id>
export AZURE_LOCATION=eastus2          # any region with Container Apps + Cosmos serverless
az account set --subscription "$AZURE_SUBSCRIPTION_ID"
```

---

## 2. One-time tenant setup (Entra External ID)

The customer-facing storefront uses **Microsoft Entra External ID** (CIAM) for sign-in; the
admin pages use the workforce **Entra ID** tenant. For the demo, we register two app
registrations and store their identifiers as `azd` environment values — **no secrets** are
stored, only public client IDs and authority URLs.

```bash
# 1) Create / pick an External ID tenant in the Azure portal once.
#    Note its tenant subdomain, e.g.,  acmeretail-ciam.onmicrosoft.com

# 2) App registration for the SPA (public client, PKCE)
az ad app create --display-name "Acme Retail Storefront" \
  --sign-in-audience AzureADMyOrg \
  --enable-id-token-issuance true \
  --web-redirect-uris http://localhost:5173 \
  --query appId -o tsv > /tmp/spa.appid

# 3) App registration for the API
az ad app create --display-name "Acme Retail API" \
  --identifier-uris api://acme-retail \
  --query appId -o tsv > /tmp/api.appid

# 4) Capture into azd env (no secrets — these are public identifiers).
azd env set AZURE_CIAM_AUTHORITY    "https://acmeretail-ciam.ciamlogin.com/$(az account show --query tenantId -o tsv)/v2.0"
azd env set AZURE_CIAM_AUDIENCE     "api://acme-retail"
azd env set AZURE_CIAM_SPA_CLIENTID "$(cat /tmp/spa.appid)"
azd env set AZURE_CIAM_API_CLIENTID "$(cat /tmp/api.appid)"
```

> If you don't want to set up CIAM now, `infra/hooks/preprovision.sh` sets safe placeholder
> values so the deployment still succeeds; the SPA will display "anonymous browsing only".

---

## Step 1 — `azd auth login` and `azd init`

```bash
cd sample/ecommerce-app

azd auth login
azd env new acme-retail-dev
azd env set AZURE_LOCATION "$AZURE_LOCATION"
azd env set AZURE_SUBSCRIPTION_ID "$AZURE_SUBSCRIPTION_ID"
```

The `azure.yaml` already declares two services (`api` → Container App, `web` → Static Web App),
so `azd init` is **not** needed — the layout is preconfigured.

Verify EAS is still happy:

```bash
eas doctor
# ✓ infra/main.bicep references all charters' allow-listed resource types.
# ✓ No charter forbids any planned resource SKU.
# ✓ devsecops/iac subagent budget: 22,000 / 95,000
```

---

## Step 2 — Pre-deployment hooks (`infra/hooks/preprovision.sh`)

`azd` runs hooks declared in `azure.yaml` (already wired). The pre-provision hook performs
three EAS-mandated checks **before** any cloud resource is created:

```bash
# 1) Validate Bicep with both `bicep build` and `az deployment what-if`
bicep build infra/main.bicep --outfile /tmp/main.json

# 2) Run the EAS DevSecOps subagent against the planned diff
eas review --scope=infra --strict
#   ✓ All resources have tags
#   ✓ No public network rules on Cosmos
#   ✓ Key Vault has purgeProtection=true, softDelete >= 7
#   ✓ Container App ingress is set to "external" with HTTPS only
#   ✓ Managed identity used everywhere; no SAS tokens, no connection strings

# 3) Pre-flight check: quotas (vCPU, Cosmos accounts, Static Web Apps free tier)
az vm list-usage --location "$AZURE_LOCATION" --query "[?currentValue<limit]" -o table
```

If `eas review --scope=infra --strict` exits non-zero, `azd up` aborts.

---

## Step 3 — `azd up`

```bash
azd up
```

What this does (timing on a typical broadband link, eastus2):

| Phase | Duration | What happens |
|------:|---------:|--------------|
| `package` | ~ 1 m | `dotnet publish` → Docker build → push API image to ACR; `vite build` for SPA |
| `provision` | ~ 4 m | Bicep `subscription` deployment creates RG + all modules in parallel |
| `deploy` | ~ 1 m | Container App revision pinned to new image; SPA dist/ uploaded to SWA |
| `postprovision` | ~ 30 s | Seed Cosmos containers with sample categories/products |

Sample tail:

```text
Deploying services (azd deploy)
  (✓) Done: Deploying service api
  (✓) Done: Deploying service web

Outputs:
  AZURE_CONTAINER_APP_FQDN     = api-xt5n.kindgrass-1234abcd.eastus2.azurecontainerapps.io
  AZURE_STATIC_WEB_APP_URL     = https://acme-retail-web.azurestaticapps.net
  AZURE_COSMOS_ENDPOINT        = https://acme-retail-cosmos-xt5n.documents.azure.com:443/
  AZURE_KEY_VAULT_URI          = https://acme-retail-kv-xt5n.vault.azure.net/
  AZURE_APPLICATION_INSIGHTS_CONNECTION_STRING = (sensitive — written to AZD env, not stdout)
```

> 💡 The connection string is saved to your local `.azure/<env>/.env` file by `azd`. It is
> **not** stored in source control, and the App Insights resource itself is the only place the
> instrumentation key is shared with the API (via container env var, not Key Vault — App Insights
> connection strings are not secret material under our threat model).

---

## Step 4 — Verify the deployment

```bash
# Read all the outputs
azd env get-values | grep -E '^(AZURE_(CONTAINER|STATIC|COSMOS|KEY|APP)|API_)'

# Hit the API health probe
curl -fsS "https://$(azd env get-value AZURE_CONTAINER_APP_FQDN)/healthz/ready"
# {"status":"Healthy","results":{"cosmos":{"status":"Healthy"},"keyvault":{"status":"Healthy"}}}

# Hit the SPA
curl -fsSI "$(azd env get-value AZURE_STATIC_WEB_APP_URL)" | head -1
# HTTP/2 200
```

Confirm RBAC was granted (no secret-based access anywhere):

```bash
RG=$(azd env get-value AZURE_RESOURCE_GROUP)
MI=$(az identity list --resource-group "$RG" --query "[0].principalId" -o tsv)

# The API's user-assigned identity should have Cosmos DB Data Contributor
az role assignment list --assignee "$MI" --all -o table
```

You should see at minimum:

| Role                                     | Scope                                  |
|------------------------------------------|----------------------------------------|
| Cosmos DB Built-in Data Contributor      | Cosmos account                         |
| Key Vault Secrets User                   | Key Vault                              |
| Monitoring Metrics Publisher             | App Insights                           |
| AcrPull                                  | Container Registry                     |

No `Storage Blob Data Owner`, no `Contributor`, no overly-broad scopes — that's the Zero
Trust subagent's `least-privilege` rule asserting itself.

---

## Step 5 — Run the EAS deployment compliance gate

```bash
eas review --scope=deploy --env=acme-retail-dev
```

The compliance subagents query Azure to verify the **runtime** posture matches the
declared spec:

```text
[compliance.gdpr]    Cosmos region = eastus2 (US). For EU-resident customers, deploy a
                     second instance in westeurope and route via Front Door geo-filter.
                     INFO — single-region demo deployment is acceptable for non-prod.
[compliance.pci]     PASS — no PAN storage container exists; checkout uses the stub.
[compliance.zt]      PASS — verified:
                       • Container App has ingress = external, allowInsecure = false
                       • Cosmos has publicNetworkAccess = "Disabled" (with private endpoint)
                       • Key Vault has rbacAuthorization = true (no access policies)
                       • Key Vault has purge protection + 90-day soft delete
                       • All managed identities are user-assigned (no system-assigned drift)
                       • SPA enforces HTTPS via SWA platform default
[sre.availability]   WARN — Container App minReplicas = 1; for SLA > 99.9 set minReplicas ≥ 2.
                            Action: set in main.parameters.json before promoting to prod.
[sre.observability]  PASS — App Insights connected; logs flowing; OTel traces visible.
```

The `INFO`/`WARN` items are recorded into `.eas/audit/<date>_deploy_review.jsonl` for the
subsequent prod-promotion gate.

---

## Step 6 — Configure the GitHub Actions CI/CD pipeline

```bash
# This wires Federated Credential between GitHub and Entra so Actions can run azd without
# storing secrets in GitHub.
azd pipeline config --provider github
```

What the helper does:

1. Creates a workforce app registration `acme-retail-cicd`.
2. Adds **federated credentials** for branches `main` and `release/*` and PRs.
3. Grants the SP `Contributor` on the resource group and `User Access Administrator` for the
   role assignments inside the template.
4. Pushes `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` as **GitHub
   variables** (not secrets — these aren't sensitive).

Inspect the workflows already in `.github/workflows/`:

| File          | Trigger              | What runs |
|---------------|----------------------|-----------|
| `ci.yml`      | PR + push            | `dotnet build/test` (90% gate), `npm test`, `eas charter validate` |
| `cd.yml`      | push to `main`       | `azd provision && azd deploy` to the dev environment |
| `security.yml`| PR + nightly         | CodeQL, Dependabot review, secret scan, `eas review --scope=code` |

---

## Step 7 — Smoke test the public URLs

```bash
WEB=$(azd env get-value AZURE_STATIC_WEB_APP_URL)
API="https://$(azd env get-value AZURE_CONTAINER_APP_FQDN)"

# Storefront should render and call /api/v1/categories
curl -fsS "$WEB" | head -50

# Anonymous catalog endpoint (no auth required)
curl -fsS "$API/api/v1/categories?region=NA" | jq '.[0]'
# {
#   "id": "kitchen-knives",
#   "name": "Kitchen Knives",
#   "region": "NA",
#   "sortOrder": 1
# }

# An authenticated endpoint should reject anonymous calls
curl -i "$API/api/v1/customers/00000000-0000-0000-0000-000000000000/cart" | head -5
# HTTP/2 401
# www-authenticate: Bearer
```

Open `$WEB` in a browser, sign in with a CIAM test user, browse → add to cart → confirm the
drawer behaviour from Walkthrough 03 works end-to-end.

---

## Step 8 — Tear down with `azd down`

```bash
azd down --purge
```

`--purge` permanently deletes the Key Vault and Cosmos account (otherwise they enter
soft-delete and continue to count against your subscription's per-region quota). The command
prompts for confirmation; if you script it, append `--force --purge`.

Verify:

```bash
az group exists --name "$(azd env get-value AZURE_RESOURCE_GROUP)"   # → false
az keyvault list-deleted --query "[?name=='acme-retail-kv-xt5n']"    # → []
```

---

## Architecture & naming reference

```
Resource group: rg-acme-retail-<env>-<region>-<token>
  ├─ Container Apps environment        cae-acme-retail-<token>
  │    └─ Container App                ca-api-<token>
  ├─ Static Web App                    swa-acme-retail-<token>
  ├─ Cosmos DB account (Serverless)    cosmos-acme-retail-<token>
  │    └─ Database "acme-retail"
  │         ├─ Container "products"   PK: /categoryId
  │         ├─ Container "carts"      PK: /customerId
  │         └─ Container "orders"     PK: /customerId
  ├─ Key Vault (RBAC, purge-protected) kv-acme-retail-<token>
  ├─ Container Registry (Premium)      acracmeretail<token>
  ├─ Log Analytics workspace           log-acme-retail-<token>
  ├─ Application Insights              appi-acme-retail-<token>
  ├─ User-assigned managed identity    id-acme-retail-api-<token>
  └─ Private endpoint(s) → VNet        pe-cosmos-<token>
```

Naming follows [Azure CAF abbreviations](https://learn.microsoft.com/azure/cloud-adoption-framework/ready/azure-best-practices/resource-abbreviations);
the canonical list is in `infra/abbreviations.json`. The 5-character `<token>` is generated
from `uniqueString(resourceGroup().id)`.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `azd up` hangs at "Deploying service api" | ACR image build failed silently | `azd deploy api --debug` and inspect the docker build logs |
| Container App returns 500 immediately | Missing managed-identity role on Cosmos | `eas review --scope=deploy` — it specifically checks this |
| SPA shows "Cannot connect to API" | Wrong CORS origin | Set `Cors__AllowedOrigins__0` to the SWA URL in the Container App env |
| `azd down` leaves a soft-deleted Key Vault | Forgot `--purge` flag | `az keyvault purge --name <name> --location <region>` |
| Cosmos requests get 403 | Data plane RBAC pending propagation (~ 1 min) | Retry; if persistent, `az cosmosdb sql role assignment list --account-name <a> --resource-group <rg>` |
| `azd pipeline config` fails with "insufficient privileges" | You aren't `User Access Administrator` | Ask a tenant admin or pre-create the SP and pass `--principal-id` |

---

## What's next

You have a fully-functional Acme Retail demo running on Azure with:

- HTTPS-only public surfaces (Container App + SWA)
- Managed-identity-only data-plane access (no secrets)
- Key Vault with purge protection
- Audit-log-ready Cosmos containers
- App Insights wired in
- A repeatable `azd up` / `azd down` lifecycle gated by EAS compliance subagents

To promote to a "prod-grade" environment, run:

```bash
azd env new acme-retail-prod
# Edit infra/main.parameters.json: minReplicas=2, geo-redundant Cosmos, multi-region SWA
azd up
eas review --scope=deploy --env=acme-retail-prod  # must be PASS, no WARNs
```
