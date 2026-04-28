// ============================================================================
// storage.bicep — Storage account for product images.
//   - HTTPS-only, TLS 1.2+, no anonymous blob access
//   - publicNetworkAccess = Disabled, private endpoint in snet-data
//   - Soft delete (containers + blobs) enabled, 30-day retention
//   - Container "products" (private)
// ============================================================================

@description('Azure region.')
param location string

@description('Resource name prefix.')
param prefix string

@description('Common tags.')
param tags object

@description('Subnet ID for the private endpoint (snet-data).')
param privateEndpointSubnetId string

@description('Private DNS zone ID for privatelink.blob.{suffix}.')
param privateDnsZoneId string

@description('Principal IDs granted Storage Blob Data Contributor on this account.')
param blobContributorPrincipalIds array = []

var roleBlobContributor = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'

var stName = 'st${take(uniqueString(resourceGroup().id, prefix), 20)}'

resource storage 'Microsoft.Storage/storageAccounts@2024-01-01' = {
  name: stName
  location: location
  tags: tags
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false  // Entra-only data plane (zero-trust §1)
    publicNetworkAccess: 'Disabled'
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'AzureServices'
    }
    encryption: {
      services: {
        blob: { enabled: true, keyType: 'Account' }
        file: { enabled: true, keyType: 'Account' }
      }
      keySource: 'Microsoft.Storage'
    }
  }
}

resource blobSvc 'Microsoft.Storage/storageAccounts/blobServices@2024-01-01' = {
  parent: storage
  name: 'default'
  properties: {
    deleteRetentionPolicy: {
      enabled: true
      days: 30
    }
    containerDeleteRetentionPolicy: {
      enabled: true
      days: 30
    }
    isVersioningEnabled: true
  }
}

resource productsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2024-01-01' = {
  parent: blobSvc
  name: 'products'
  properties: {
    publicAccess: 'None'
  }
}

resource pe 'Microsoft.Network/privateEndpoints@2024-05-01' = {
  name: 'pe-${stName}'
  location: location
  tags: tags
  properties: {
    subnet: { id: privateEndpointSubnetId }
    privateLinkServiceConnections: [
      {
        name: 'blob-plsc'
        properties: {
          privateLinkServiceId: storage.id
          groupIds: [ 'blob' ]
        }
      }
    ]
  }
}

resource peDns 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-05-01' = {
  parent: pe
  name: 'blob-dns'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'blob'
        properties: { privateDnsZoneId: privateDnsZoneId }
      }
    ]
  }
}

output storageId string = storage.id
output storageName string = storage.name
output storageBlobEndpoint string = storage.properties.primaryEndpoints.blob

resource raBlobContrib 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for pid in blobContributorPrincipalIds: {
  scope: storage
  name: guid(storage.id, pid, roleBlobContributor)
  properties: {
    principalId: pid
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleBlobContributor)
  }
}]
