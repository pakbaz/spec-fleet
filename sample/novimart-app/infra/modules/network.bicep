// ============================================================================
// network.bicep — VNet with four subnets (zero-trust §3 segmentation):
//   snet-ingress — reserved for future Front Door / App Gateway WAF
//   snet-apps    — Container Apps Environment (delegated)
//   snet-data    — private endpoints to Cosmos / KV / Redis / Storage
//   snet-mgmt    — bastion / jumpbox hooks (reserved)
//
// NSGs are deny-by-default. No 0.0.0.0/0 rules. Private DNS zones are linked
// to the VNet so private-endpoint name resolution Just Works for apps.
// ============================================================================

@description('Azure region.')
param location string

@description('Resource name prefix (e.g. novimart-dev-eastus2).')
param prefix string

@description('Common tags.')
param tags object

var vnetName = 'vnet-${prefix}'

// IPv4 plan: /16 VNet, four /24 subnets — generous headroom for future scale.
var addressSpace = '10.40.0.0/16'
var snetIngressPrefix = '10.40.0.0/24'
var snetAppsPrefix = '10.40.1.0/23'      // /23 — Container Apps consumption needs ≥ /23
var snetDataPrefix = '10.40.4.0/24'
var snetMgmtPrefix = '10.40.5.0/24'

resource nsgIngress 'Microsoft.Network/networkSecurityGroups@2024-05-01' = {
  name: 'nsg-${prefix}-ingress'
  location: location
  tags: tags
  properties: {
    securityRules: [
      {
        name: 'allow-https-from-azure-front-door'
        properties: {
          priority: 100
          direction: 'Inbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourceAddressPrefix: 'AzureFrontDoor.Backend'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '443'
        }
      }
      {
        name: 'deny-all-inbound'
        properties: {
          priority: 4096
          direction: 'Inbound'
          access: 'Deny'
          protocol: '*'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '*'
        }
      }
    ]
  }
}

resource nsgApps 'Microsoft.Network/networkSecurityGroups@2024-05-01' = {
  name: 'nsg-${prefix}-apps'
  location: location
  tags: tags
  properties: {
    securityRules: [
      {
        name: 'allow-vnet-inbound'
        properties: {
          priority: 100
          direction: 'Inbound'
          access: 'Allow'
          protocol: '*'
          sourceAddressPrefix: 'VirtualNetwork'
          sourcePortRange: '*'
          destinationAddressPrefix: 'VirtualNetwork'
          destinationPortRange: '*'
        }
      }
      {
        name: 'deny-all-inbound'
        properties: {
          priority: 4096
          direction: 'Inbound'
          access: 'Deny'
          protocol: '*'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '*'
        }
      }
      {
        name: 'allow-azure-monitor-egress'
        properties: {
          priority: 100
          direction: 'Outbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: 'AzureMonitor'
          destinationPortRange: '443'
        }
      }
      {
        name: 'allow-vnet-egress'
        properties: {
          priority: 110
          direction: 'Outbound'
          access: 'Allow'
          protocol: '*'
          sourceAddressPrefix: 'VirtualNetwork'
          sourcePortRange: '*'
          destinationAddressPrefix: 'VirtualNetwork'
          destinationPortRange: '*'
        }
      }
      {
        name: 'allow-acr-egress'
        properties: {
          priority: 120
          direction: 'Outbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: 'AzureContainerRegistry'
          destinationPortRange: '443'
        }
      }
      {
        name: 'allow-aad-egress'
        properties: {
          priority: 130
          direction: 'Outbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: 'AzureActiveDirectory'
          destinationPortRange: '443'
        }
      }
    ]
  }
}

resource nsgData 'Microsoft.Network/networkSecurityGroups@2024-05-01' = {
  name: 'nsg-${prefix}-data'
  location: location
  tags: tags
  properties: {
    securityRules: [
      {
        name: 'allow-apps-inbound'
        properties: {
          priority: 100
          direction: 'Inbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourceAddressPrefix: snetAppsPrefix
          sourcePortRange: '*'
          destinationAddressPrefix: snetDataPrefix
          destinationPortRanges: [
            '443'
            '6380'
            '10255'
          ]
        }
      }
      {
        name: 'deny-all-inbound'
        properties: {
          priority: 4096
          direction: 'Inbound'
          access: 'Deny'
          protocol: '*'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '*'
        }
      }
    ]
  }
}

resource nsgMgmt 'Microsoft.Network/networkSecurityGroups@2024-05-01' = {
  name: 'nsg-${prefix}-mgmt'
  location: location
  tags: tags
  properties: {
    securityRules: [
      {
        name: 'deny-all-inbound'
        properties: {
          priority: 4096
          direction: 'Inbound'
          access: 'Deny'
          protocol: '*'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '*'
        }
      }
    ]
  }
}

resource vnet 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: vnetName
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [ addressSpace ]
    }
    subnets: [
      {
        name: 'snet-ingress'
        properties: {
          addressPrefix: snetIngressPrefix
          networkSecurityGroup: { id: nsgIngress.id }
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
      {
        name: 'snet-apps'
        properties: {
          addressPrefix: snetAppsPrefix
          networkSecurityGroup: { id: nsgApps.id }
          delegations: [
            {
              name: 'aca-delegation'
              properties: {
                serviceName: 'Microsoft.App/environments'
              }
            }
          ]
        }
      }
      {
        name: 'snet-data'
        properties: {
          addressPrefix: snetDataPrefix
          networkSecurityGroup: { id: nsgData.id }
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
      {
        name: 'snet-mgmt'
        properties: {
          addressPrefix: snetMgmtPrefix
          networkSecurityGroup: { id: nsgMgmt.id }
        }
      }
    ]
  }
}

// ---------- Private DNS zones (linked to VNet) ----------
var privateDnsZoneNames = [
  'privatelink.documents.azure.com'
  'privatelink.vaultcore.azure.net'
  'privatelink.redis.cache.windows.net'
  'privatelink.blob.${environment().suffixes.storage}'
]

resource pdnsZones 'Microsoft.Network/privateDnsZones@2024-06-01' = [for zone in privateDnsZoneNames: {
  name: zone
  location: 'global'
  tags: tags
}]

resource pdnsLinks 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = [for (zone, i) in privateDnsZoneNames: {
  parent: pdnsZones[i]
  name: '${vnetName}-link'
  location: 'global'
  tags: tags
  properties: {
    registrationEnabled: false
    virtualNetwork: { id: vnet.id }
  }
}]

output vnetId string = vnet.id
output vnetName string = vnet.name
output snetIngressId string = '${vnet.id}/subnets/snet-ingress'
output snetAppsId string = '${vnet.id}/subnets/snet-apps'
output snetDataId string = '${vnet.id}/subnets/snet-data'
output snetMgmtId string = '${vnet.id}/subnets/snet-mgmt'
output pdnsCosmosId string = pdnsZones[0].id
output pdnsKeyVaultId string = pdnsZones[1].id
output pdnsRedisId string = pdnsZones[2].id
output pdnsBlobId string = pdnsZones[3].id
