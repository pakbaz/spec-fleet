// ============================================================================
// keyvault.bicep — RBAC-mode Key Vault, public access disabled, private endpoint
// in snet-data, plus a CMK key for Cosmos encryption (instruction.md
// compliance.* — CMK on personal-data containers).
// ============================================================================

@description('Azure region.')
param location string

@description('Resource name prefix.')
param prefix string

@description('Common tags.')
param tags object

@description('Subnet ID for the private endpoint (snet-data).')
param privateEndpointSubnetId string

@description('Private DNS zone ID for privatelink.vaultcore.azure.net.')
param privateDnsZoneId string

@description('Tenant ID.')
param tenantId string = subscription().tenantId

@description('Principal IDs that should receive Key Vault Secrets User on this vault (e.g. API UAMI).')
param secretsUserPrincipalIds array = []

@description('Principal IDs that should receive Key Vault Crypto Service Encryption User on this vault (e.g. Cosmos CMK UAMI).')
param cryptoEncryptionUserPrincipalIds array = []

@description('Principal ID granted Key Vault Administrator (deployer/operator). Empty string = skip.')
param adminPrincipalId string = ''

@description('Principal type for adminPrincipalId. Default User; set ServicePrincipal for SP/MI.')
@allowed([ 'User', 'Group', 'ServicePrincipal' ])
param adminPrincipalType string = 'User'

var kvName = 'kv-${take(uniqueString(resourceGroup().id, prefix), 16)}'

// Built-in role IDs (subscription-scope role *definitions*; assignments below are scoped to the KV resource).
var roleSecretsUser = '4633458b-17de-408a-b874-0445c86b69e6'
var roleCryptoEncryptionUser = 'e147488a-f6f5-4113-8e2d-b22465e65bf6'
var roleAdministrator = '00482a5a-887f-4fb3-b363-3b7fe8e74483'

resource kv 'Microsoft.KeyVault/vaults@2024-11-01' = {
  name: kvName
  location: location
  tags: union(tags, {
    'data-classification': 'restricted'
    'cmk-holder': 'true'
  })
  properties: {
    tenantId: tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
    publicNetworkAccess: 'Disabled'
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'AzureServices'
    }
  }
}

// CMK key — RSA 3072 per zero-trust.md §3 encryption.
resource cmkCosmos 'Microsoft.KeyVault/vaults/keys@2024-11-01' = {
  parent: kv
  name: 'cmk-cosmos'
  properties: {
    kty: 'RSA'
    keySize: 3072
    keyOps: [
      'wrapKey'
      'unwrapKey'
      'encrypt'
      'decrypt'
    ]
    attributes: {
      enabled: true
    }
    rotationPolicy: {
      lifetimeActions: [
        {
          trigger: { timeBeforeExpiry: 'P30D' }
          action: { type: 'notify' }
        }
        {
          trigger: { timeAfterCreate: 'P335D' }
          action: { type: 'rotate' }
        }
      ]
      attributes: {
        expiryTime: 'P365D'
      }
    }
  }
}

resource pe 'Microsoft.Network/privateEndpoints@2024-05-01' = {
  name: 'pe-${kvName}'
  location: location
  tags: tags
  properties: {
    subnet: { id: privateEndpointSubnetId }
    privateLinkServiceConnections: [
      {
        name: 'kv-plsc'
        properties: {
          privateLinkServiceId: kv.id
          groupIds: [ 'vault' ]
        }
      }
    ]
  }
}

resource peDns 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-05-01' = {
  parent: pe
  name: 'kv-dns'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'vault'
        properties: { privateDnsZoneId: privateDnsZoneId }
      }
    ]
  }
}

// Role assignments (scoped to the KV resource — never subscription).
resource raSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for pid in secretsUserPrincipalIds: {
  scope: kv
  name: guid(kv.id, pid, roleSecretsUser)
  properties: {
    principalId: pid
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleSecretsUser)
  }
}]

resource raCryptoEnc 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for pid in cryptoEncryptionUserPrincipalIds: {
  scope: kv
  name: guid(kv.id, pid, roleCryptoEncryptionUser)
  properties: {
    principalId: pid
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleCryptoEncryptionUser)
  }
}]

resource raAdmin 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(adminPrincipalId)) {
  scope: kv
  name: guid(kv.id, adminPrincipalId, roleAdministrator)
  properties: {
    principalId: adminPrincipalId
    principalType: adminPrincipalType
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleAdministrator)
  }
}

output keyVaultId string = kv.id
output keyVaultName string = kv.name
output keyVaultUri string = kv.properties.vaultUri
output cmkKeyUri string = cmkCosmos.properties.keyUriWithVersion
output cmkKeyUriUnversioned string = cmkCosmos.properties.keyUri
