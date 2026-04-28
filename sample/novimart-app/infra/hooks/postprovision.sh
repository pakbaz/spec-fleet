#!/usr/bin/env sh
# postprovision.sh — runs after `azd provision`. Echoes useful endpoints and
# reminds the operator of out-of-band steps that azd cannot automate
# (Entra External ID tenant, SWA app settings, etc.).
set -euo pipefail

echo ""
echo "============================================================"
echo "NoviMart E-Commerce — provision complete"
echo "============================================================"
echo "Resource group : ${AZURE_RESOURCE_GROUP:-<unset>}"
echo "Region         : ${AZURE_LOCATION:-<unset>}"
echo "API service    : ${SERVICE_API_NAME:-<unset>}"
echo "API URL        : ${SERVICE_API_URI:-<unset>}"
echo "Web (SWA)      : ${SERVICE_WEB_URI:-<unset>}"
echo "Cosmos         : ${COSMOS_ENDPOINT:-<unset>}"
echo "Key Vault      : ${KEYVAULT_ENDPOINT:-<unset>}"
echo ""
echo "Out-of-band follow-ups (NOT automated by azd):"
echo "  1. Provision the Entra External ID tenant for customer auth."
echo "     See infra/README.md §Entra setup checklist."
echo "  2. Configure SWA app settings (VITE_AZURE_AD_CLIENT_ID,"
echo "     VITE_AZURE_AD_TENANT_ID, VITE_AZURE_AD_AUTHORITY) once the"
echo "     Entra tenant is up."
echo "  3. Verify private endpoints resolve correctly from the Container"
echo "     Apps environment (see runbooks/private-endpoint-check.md)."
echo "============================================================"
