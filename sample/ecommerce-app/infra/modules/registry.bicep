// ============================================================================
// registry.bicep — Azure Container Registry.
//   - admin user disabled (Entra/MI only, zero-trust §1)
//   - public network access enabled but data-plane requires Entra token
//   - For production: switch publicNetworkAccess to Disabled and add a
//     private endpoint in snet-data (Premium SKU required)
// ============================================================================

@description('Azure region.')
param location string

@description('Resource name prefix.')
param prefix string

@description('Common tags.')
param tags object

@description('Principal IDs granted AcrPull on this registry.')
param acrPullPrincipalIds array = []

var roleAcrPull = '7f951dda-4ed3-11e8-a85e-9bbc31fdf38a'

var acrName = 'cr${take(uniqueString(resourceGroup().id, prefix), 20)}'

resource acr 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' = {
  name: acrName
  location: location
  tags: tags
  sku: { name: 'Standard' }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: 'Enabled'
    anonymousPullEnabled: false
    dataEndpointEnabled: false
    networkRuleBypassOptions: 'AzureServices'
    policies: {
      quarantinePolicy: { status: 'enabled' }
      retentionPolicy: { status: 'enabled', days: 30 }
      trustPolicy: { status: 'enabled', type: 'Notary' }
      exportPolicy: { status: 'enabled' }
    }
  }
}

output acrId string = acr.id
output acrName string = acr.name
output acrLoginServer string = acr.properties.loginServer

resource raAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for pid in acrPullPrincipalIds: {
  scope: acr
  name: guid(acr.id, pid, roleAcrPull)
  properties: {
    principalId: pid
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleAcrPull)
  }
}]
