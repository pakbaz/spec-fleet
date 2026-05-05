---
name: iac-review
applies_to: [devsecops, sre, architect]
---

# When to use

Run on any PR touching `*.tf`, `*.tfvars`, `*.bicep`, ARM JSON, CloudFormation,
Pulumi, or Helm/Kustomize manifests.

# Procedure

1. **Plan / what-if before review.**
   - Terraform: attach `terraform plan -no-color` output (sanitized).
   - Bicep: attach `az deployment group what-if` output.
   - Reject reviews without a plan; you cannot reason about drift otherwise.
2. **Drift & state hygiene.**
   - State backend is remote, locked, encrypted (S3+DynamoDB, Azure Storage
     with lease, Terraform Cloud).
   - **No secrets in state values.** Sensitive outputs marked
     `sensitive = true`; use Key Vault / Secrets Manager references, not raw
     strings.
   - State file is gitignored.
3. **Least-privilege IAM.**
   - No wildcard `Action: *` or `Resource: *` on managed identities, service
     principals, or IAM roles unless documented and time-boxed.
   - Prefer managed identity / workload identity over long-lived keys.
   - Role assignments scoped to the resource group or resource, not the
     subscription.
4. **Network posture.**
   - No `0.0.0.0/0` ingress on management ports (22, 3389, 5432, 1433, 6379).
   - Public endpoints justified; prefer private endpoints / VNet integration.
5. **Idempotency & tagging.**
   - Resources have stable names / `lifecycle.prevent_destroy` where
     appropriate.
   - All resources tagged: `env`, `owner`, `cost-center`, `data-class`.
6. **Policy gates.** Run `tfsec` / `checkov` / `psrule-azure` and attach
   results. HIGH findings block merge.
7. **Apply rehearsal.** For production, dry-run in a lower environment and
   capture the diff.

# Outputs

- `iac-review.md` block with findings table (severity, resource, issue, fix).
- Confirmation that scanner output is clean or that exceptions are documented
  in `decisions.md`.
