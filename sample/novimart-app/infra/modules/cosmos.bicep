// ============================================================================
// cosmos.bicep — Cosmos DB NoSQL account with:
//   - Entra-only auth (disableLocalAuth = true)
//   - publicNetworkAccess = Disabled + private endpoint in snet-data
//   - CMK encryption from Key Vault (keyVaultKeyUri + UAMI)
//   - Continuous 7-day backup
//   - Six containers per project.md data model; 30-day TTL on carts
// ============================================================================

@description('Azure region.')
param location string

@description('Resource name prefix.')
param prefix string

@description('Common tags.')
param tags object

@description('Subnet ID for the private endpoint (snet-data).')
param privateEndpointSubnetId string

@description('Private DNS zone ID for privatelink.documents.azure.com.')
param privateDnsZoneId string

@description('Key Vault key URI (versioned) for CMK encryption.')
param cmkKeyUri string

@description('User-assigned managed identity resource ID granted KV Crypto Service Encryption User. Used as Cosmos defaultIdentity.')
param encryptionIdentityId string

@description('Optional list of principalIds to grant Cosmos Data Contributor data-plane role.')
param dataPlanePrincipalIds array = []

var accountName = 'cosmos-${take(uniqueString(resourceGroup().id, prefix), 18)}'
var databaseName = 'novimart'

// Sample mode: serverless capacity and a single region. Production deployments
// per instruction.md compliance.* would set additional EU/NA replicas with
// data residency boundaries enforced by region pinning.
resource cosmos 'Microsoft.DocumentDB/databaseAccounts@2024-11-15' = {
  name: accountName
  location: location
  tags: union(tags, {
    'data-classification': 'restricted'
    cmk: 'enabled'
  })
  kind: 'GlobalDocumentDB'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${encryptionIdentityId}': {}
    }
  }
  properties: {
    databaseAccountOfferType: 'Standard'
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    capabilities: [
      { name: 'EnableServerless' }
    ]
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    publicNetworkAccess: 'Disabled'
    isVirtualNetworkFilterEnabled: false
    disableLocalAuth: true
    minimalTlsVersion: 'Tls12'
    keyVaultKeyUri: cmkKeyUri
    defaultIdentity: 'UserAssignedIdentity=${encryptionIdentityId}'
    backupPolicy: {
      type: 'Continuous'
      continuousModeProperties: {
        tier: 'Continuous7Days'
      }
    }
  }
}

resource db 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-11-15' = {
  parent: cosmos
  name: databaseName
  properties: {
    resource: { id: databaseName }
  }
}

// Container catalogue per project.md §Data model.
var containers = [
  { name: 'products', pk: '/categoryId', ttl: -1 }
  { name: 'categories', pk: '/region', ttl: -1 }
  { name: 'carts', pk: '/customerId', ttl: 2592000 } // 30 days per instruction.md data.*
  { name: 'orders', pk: '/customerId', ttl: -1 }
  { name: 'customers', pk: '/customerId', ttl: -1 }
  { name: 'audit', pk: '/aggregateId', ttl: -1 }
]

resource cContainers 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-11-15' = [for c in containers: {
  parent: db
  name: c.name
  properties: {
    resource: {
      id: c.name
      partitionKey: {
        paths: [ c.pk ]
        kind: 'Hash'
      }
      defaultTtl: c.ttl
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          { path: '/*' }
        ]
        excludedPaths: [
          { path: '/"_etag"/?' }
        ]
      }
    }
  }
}]

resource pe 'Microsoft.Network/privateEndpoints@2024-05-01' = {
  name: 'pe-${accountName}'
  location: location
  tags: tags
  properties: {
    subnet: { id: privateEndpointSubnetId }
    privateLinkServiceConnections: [
      {
        name: 'cosmos-plsc'
        properties: {
          privateLinkServiceId: cosmos.id
          groupIds: [ 'Sql' ]
        }
      }
    ]
  }
}

resource peDns 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-05-01' = {
  parent: pe
  name: 'cosmos-dns'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'sql'
        properties: { privateDnsZoneId: privateDnsZoneId }
      }
    ]
  }
}

// Cosmos data-plane role: built-in "Cosmos DB Built-in Data Contributor".
// This role assignment is at the Cosmos account scope (not subscription).
var cosmosDataContributorRoleId = '00000000-0000-0000-0000-000000000002'

resource dataPlaneAssignments 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-11-15' = [for (pid, idx) in dataPlanePrincipalIds: if (length(dataPlanePrincipalIds) > 0) {
  parent: cosmos
  name: guid(cosmos.id, pid, cosmosDataContributorRoleId)
  properties: {
    roleDefinitionId: '${cosmos.id}/sqlRoleDefinitions/${cosmosDataContributorRoleId}'
    principalId: pid
    scope: cosmos.id
  }
}]

output cosmosAccountId string = cosmos.id
output cosmosAccountName string = cosmos.name
output cosmosEndpoint string = cosmos.properties.documentEndpoint
output cosmosDatabaseName string = databaseName
