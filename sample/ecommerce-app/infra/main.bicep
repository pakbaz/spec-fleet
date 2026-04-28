// ============================================================================
// main.bicep — Subscription-scope orchestrator for Acme Retail e-commerce.
// Creates a single resource group and delegates all resource composition to
// core.bicep. No subscription-scope role assignments are made here — every
// RBAC binding lives at RG or resource scope (zero-trust policy §2).
// ============================================================================

targetScope = 'subscription'

@minLength(1)
@maxLength(20)
@description('Azure Developer CLI environment name (e.g. dev, staging, prod). Drives RG name and resource prefixes.')
param environmentName string

@minLength(1)
@description('Azure region for the resource group and all child resources. Sample default: eastus2.')
param location string = 'eastus2'

@description('Object ID of the deployer principal (user or SP). Granted Key Vault Administrator at RG scope. Provided by azd at deploy time.')
param principalId string = ''

@description('Common tags applied to every resource. Required keys: env, cost-center, owner, data-classification, compliance-scope.')
param tags object = {
  env: environmentName
  'cost-center': 'ecom-mvp'
  owner: 'platform-engineering@acme-retail.example'
  'data-classification': 'internal'
  'compliance-scope': 'gdpr,zero-trust'
}

var rgName = 'rg-acme-retail-${environmentName}-${location}'

resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: rgName
  location: location
  tags: tags
}

module core 'core.bicep' = {
  name: 'core-${environmentName}'
  scope: rg
  params: {
    location: location
    environmentName: environmentName
    principalId: principalId
    tags: tags
  }
}

// ---------- azd outputs ----------
output AZURE_LOCATION string = location
output AZURE_RESOURCE_GROUP string = rg.name
output AZURE_TENANT_ID string = subscription().tenantId
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = core.outputs.acrLoginServer
output AZURE_CONTAINER_REGISTRY_NAME string = core.outputs.acrName
output AZURE_CONTAINER_APPS_ENVIRONMENT_ID string = core.outputs.containerAppsEnvId
output AZURE_CONTAINER_APPS_ENVIRONMENT_NAME string = core.outputs.containerAppsEnvName
output SERVICE_API_NAME string = core.outputs.apiName
output SERVICE_API_URI string = core.outputs.apiUri
output SERVICE_API_IDENTITY_PRINCIPAL_ID string = core.outputs.apiIdentityPrincipalId
output SERVICE_API_IDENTITY_CLIENT_ID string = core.outputs.apiIdentityClientId
output SERVICE_WEB_NAME string = core.outputs.swaName
output SERVICE_WEB_URI string = core.outputs.swaUri
output COSMOS_ENDPOINT string = core.outputs.cosmosEndpoint
output COSMOS_DATABASE_NAME string = core.outputs.cosmosDatabaseName
output KEYVAULT_NAME string = core.outputs.keyVaultName
output KEYVAULT_ENDPOINT string = core.outputs.keyVaultUri
output STORAGE_ACCOUNT_NAME string = core.outputs.storageName
output STORAGE_BLOB_ENDPOINT string = core.outputs.storageBlobEndpoint
output REDIS_HOSTNAME string = core.outputs.redisHostname
output APPLICATIONINSIGHTS_CONNECTION_STRING string = core.outputs.appInsightsConnectionString
output AZURE_LOG_ANALYTICS_WORKSPACE_ID string = core.outputs.logAnalyticsWorkspaceId
