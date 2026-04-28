// ============================================================================
// identity.bicep — User-assigned managed identity for the API container app.
// All service-to-service auth uses this identity (zero-trust §1 workload).
// No client secrets, no connection strings.
// ============================================================================

@description('Azure region.')
param location string

@description('Resource name prefix.')
param prefix string

@description('Common tags.')
param tags object

resource apiIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-${prefix}-api'
  location: location
  tags: tags
}

output apiIdentityId string = apiIdentity.id
output apiIdentityName string = apiIdentity.name
output apiIdentityPrincipalId string = apiIdentity.properties.principalId
output apiIdentityClientId string = apiIdentity.properties.clientId
