// ============================================================================
// core.bicep — Resource-group-scope composer.
//
// All role assignments are scoped to the target resource (NEVER subscription).
// Each resource module accepts principalId arrays and creates the role
// bindings inline — this keeps deployment-time evaluation safe (BCP120) and
// keeps blast radius tight per zero-trust §3.
// ============================================================================

targetScope = 'resourceGroup'

@description('Azure region.')
param location string

@description('azd environment name.')
param environmentName string

@description('Deployer principal ID (granted Key Vault Administrator at KV resource scope).')
param principalId string = ''

@description('Common tags.')
param tags object

var prefix = toLower(replace('${environmentName}-${location}', '_', '-'))

// ============================================================================
// Network — VNet, subnets, NSGs, private DNS zones
// ============================================================================
module net 'modules/network.bicep' = {
  name: 'net'
  params: {
    location: location
    prefix: prefix
    tags: tags
  }
}

// ============================================================================
// Identity — UAMI for the API
// ============================================================================
module id 'modules/identity.bicep' = {
  name: 'id'
  params: {
    location: location
    prefix: prefix
    tags: tags
  }
}

// Cosmos requires a dedicated UAMI for CMK access — it must hold the KV
// crypto role BEFORE the Cosmos account is created. We create it inline at
// composer scope so we can pass its principalId into the keyvault module.
resource cosmosEncryptionIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-${prefix}-cosmos-cmk'
  location: location
  tags: tags
}

// ============================================================================
// Monitor — Log Analytics + App Insights
// ============================================================================
module mon 'modules/monitor.bicep' = {
  name: 'mon'
  params: {
    location: location
    prefix: prefix
    tags: tags
    metricsPublisherPrincipalIds: [ id.outputs.apiIdentityPrincipalId ]
  }
}

// ============================================================================
// Key Vault — must be created (with the CMK role assignment) before Cosmos
// ============================================================================
module kv 'modules/keyvault.bicep' = {
  name: 'kv'
  params: {
    location: location
    prefix: prefix
    tags: tags
    privateEndpointSubnetId: net.outputs.snetDataId
    privateDnsZoneId: net.outputs.pdnsKeyVaultId
    secretsUserPrincipalIds: [ id.outputs.apiIdentityPrincipalId ]
    cryptoEncryptionUserPrincipalIds: [ cosmosEncryptionIdentity.properties.principalId ]
    adminPrincipalId: principalId
    adminPrincipalType: 'User'
  }
}

// ============================================================================
// Cosmos — depends on KV (key + role assignment)
// ============================================================================
module cosmos 'modules/cosmos.bicep' = {
  name: 'cosmos'
  params: {
    location: location
    prefix: prefix
    tags: tags
    privateEndpointSubnetId: net.outputs.snetDataId
    privateDnsZoneId: net.outputs.pdnsCosmosId
    cmkKeyUri: kv.outputs.cmkKeyUri
    encryptionIdentityId: cosmosEncryptionIdentity.id
    dataPlanePrincipalIds: [ id.outputs.apiIdentityPrincipalId ]
  }
}

// ============================================================================
// Redis — sample-mode Basic SKU (see redis.bicep header for prod note)
// ============================================================================
module redis 'modules/redis.bicep' = {
  name: 'redis'
  params: {
    location: location
    prefix: prefix
    tags: tags
    usePremium: false
    privateEndpointSubnetId: net.outputs.snetDataId
    privateDnsZoneId: net.outputs.pdnsRedisId
    contributorPrincipalIds: [ id.outputs.apiIdentityPrincipalId ]
  }
}

// ============================================================================
// Storage
// ============================================================================
module storage 'modules/storage.bicep' = {
  name: 'storage'
  params: {
    location: location
    prefix: prefix
    tags: tags
    privateEndpointSubnetId: net.outputs.snetDataId
    privateDnsZoneId: net.outputs.pdnsBlobId
    blobContributorPrincipalIds: [ id.outputs.apiIdentityPrincipalId ]
  }
}

// ============================================================================
// Container Registry
// ============================================================================
module acr 'modules/registry.bicep' = {
  name: 'acr'
  params: {
    location: location
    prefix: prefix
    tags: tags
    acrPullPrincipalIds: [ id.outputs.apiIdentityPrincipalId ]
  }
}

// ============================================================================
// Container Apps Environment + API app
// (Production deployment would front this with Azure Front Door + WAF and set
//  the environment internal-only. Sample exposes external HTTPS for
//  testability — see containerapps.bicep header.)
// ============================================================================
module ca 'modules/containerapps.bicep' = {
  name: 'ca'
  params: {
    location: location
    prefix: prefix
    tags: tags
    infrastructureSubnetId: net.outputs.snetAppsId
    logAnalyticsCustomerId: mon.outputs.logAnalyticsCustomerId
    logAnalyticsWorkspaceId: mon.outputs.logAnalyticsId
    appInsightsConnectionString: mon.outputs.appInsightsConnectionString
    apiIdentityId: id.outputs.apiIdentityId
    apiIdentityClientId: id.outputs.apiIdentityClientId
    acrLoginServer: acr.outputs.acrLoginServer
    cosmosEndpoint: cosmos.outputs.cosmosEndpoint
    cosmosDatabaseName: cosmos.outputs.cosmosDatabaseName
    keyVaultUri: kv.outputs.keyVaultUri
    storageBlobEndpoint: storage.outputs.storageBlobEndpoint
    redisHostname: redis.outputs.redisHostname
  }
}

// ============================================================================
// Static Web App
// ============================================================================
module swa 'modules/swa.bicep' = {
  name: 'swa'
  params: {
    location: location
    prefix: prefix
    tags: tags
    apiFqdn: ca.outputs.apiFqdn
  }
}

// ----- Outputs surfaced to main.bicep -----
output acrLoginServer string = acr.outputs.acrLoginServer
output acrName string = acr.outputs.acrName
output containerAppsEnvId string = ca.outputs.containerAppsEnvId
output containerAppsEnvName string = ca.outputs.containerAppsEnvName
output apiName string = ca.outputs.apiName
output apiUri string = ca.outputs.apiUri
output apiIdentityPrincipalId string = id.outputs.apiIdentityPrincipalId
output apiIdentityClientId string = id.outputs.apiIdentityClientId
output swaName string = swa.outputs.swaName
output swaUri string = swa.outputs.swaUri
output cosmosEndpoint string = cosmos.outputs.cosmosEndpoint
output cosmosDatabaseName string = cosmos.outputs.cosmosDatabaseName
output keyVaultName string = kv.outputs.keyVaultName
output keyVaultUri string = kv.outputs.keyVaultUri
output storageName string = storage.outputs.storageName
output storageBlobEndpoint string = storage.outputs.storageBlobEndpoint
output redisHostname string = redis.outputs.redisHostname
output appInsightsConnectionString string = mon.outputs.appInsightsConnectionString
output logAnalyticsWorkspaceId string = mon.outputs.logAnalyticsId
