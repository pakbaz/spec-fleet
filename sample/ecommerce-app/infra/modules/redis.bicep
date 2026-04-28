// ============================================================================
// redis.bicep — Azure Cache for Redis.
//
// COST/SECURITY TRADE-OFF (sample-mode deviation):
//   Production per zero-trust §3 mandates publicNetworkAccess=Disabled +
//   private endpoint, which requires the Premium SKU (~$415/mo minimum).
//   For the sample we default to Basic C0 (~$16/mo) with TLS-only + Entra
//   auth and accept that the cache endpoint is publicly reachable on TCP/6380.
//   Set `usePremium = true` to deploy the production-grade Premium variant
//   with private endpoint and no public access.
//
//   Migration path: flip usePremium to true; the Container App connects via
//   the same hostname output regardless.
// ============================================================================

@description('Azure region.')
param location string

@description('Resource name prefix.')
param prefix string

@description('Common tags.')
param tags object

@description('When true, deploy Premium SKU with private endpoint and publicNetworkAccess=Disabled. Production must be true.')
param usePremium bool = false

@description('Subnet ID for the private endpoint (snet-data). Required when usePremium=true.')
param privateEndpointSubnetId string = ''

@description('Private DNS zone ID for privatelink.redis.cache.windows.net. Required when usePremium=true.')
param privateDnsZoneId string = ''

@description('Principal IDs granted Redis Cache Contributor on this cache.')
param contributorPrincipalIds array = []

var roleRedisContributor = 'e0f68234-74aa-48ed-b826-c38b57376e17'

var redisName = 'redis-${take(uniqueString(resourceGroup().id, prefix), 18)}'

resource redis 'Microsoft.Cache/redis@2024-11-01' = {
  name: redisName
  location: location
  tags: tags
  properties: {
    sku: usePremium ? {
      name: 'Premium'
      family: 'P'
      capacity: 1
    } : {
      name: 'Basic'
      family: 'C'
      capacity: 0
    }
    enableNonSslPort: false
    minimumTlsVersion: '1.2'
    redisVersion: '6'
    publicNetworkAccess: usePremium ? 'Disabled' : 'Enabled'
    redisConfiguration: {
      'aad-enabled': 'true'  // Entra auth (zero-trust §1 — no shared keys in app)
      'maxmemory-policy': 'allkeys-lru'
    }
  }
}

resource pe 'Microsoft.Network/privateEndpoints@2024-05-01' = if (usePremium) {
  name: 'pe-${redisName}'
  location: location
  tags: tags
  properties: {
    subnet: { id: privateEndpointSubnetId }
    privateLinkServiceConnections: [
      {
        name: 'redis-plsc'
        properties: {
          privateLinkServiceId: redis.id
          groupIds: [ 'redisCache' ]
        }
      }
    ]
  }
}

resource peDns 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-05-01' = if (usePremium) {
  parent: pe
  name: 'redis-dns'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'redis'
        properties: { privateDnsZoneId: privateDnsZoneId }
      }
    ]
  }
}

output redisId string = redis.id
output redisName string = redis.name
output redisHostname string = redis.properties.hostName
output redisSslPort int = redis.properties.sslPort
output isPremium bool = usePremium

resource raContrib 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for pid in contributorPrincipalIds: {
  scope: redis
  name: guid(redis.id, pid, roleRedisContributor)
  properties: {
    principalId: pid
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleRedisContributor)
  }
}]
