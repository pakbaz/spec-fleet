// ============================================================================
// swa.bicep — Azure Static Web App (Standard tier) for the React SPA.
// The /api route is proxied to the Container App via app settings + linked
// backends (configured at deploy time by `azd deploy web`).
// ============================================================================

@description('Azure region. SWA has its own location semantics — we keep parity with the rest of the RG when available.')
param location string

@description('Resource name prefix.')
param prefix string

@description('Common tags.')
param tags object

@description('FQDN of the API container app — used to build the SWA app setting that the SPA reads at runtime.')
param apiFqdn string

var swaName = 'stapp-${prefix}'

// SWA is only GA in a small set of regions; map non-supported regions to a near-neighbour.
var supportedSwaRegions = [
  'westeurope'
  'northeurope'
  'eastus2'
  'westus2'
  'centralus'
  'eastasia'
]
var swaLocation = contains(supportedSwaRegions, location) ? location : 'eastus2'

resource swa 'Microsoft.Web/staticSites@2024-04-01' = {
  name: swaName
  location: swaLocation
  tags: union(tags, {
    'azd-service-name': 'web'
  })
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {
    allowConfigFileUpdates: true
    enterpriseGradeCdnStatus: 'Disabled'
    publicNetworkAccess: 'Enabled'  // SWA must be public (it serves the SPA); auth is enforced by Entra External ID
  }
}

resource swaConfig 'Microsoft.Web/staticSites/config@2024-04-01' = {
  parent: swa
  name: 'appsettings'
  properties: {
    VITE_API_BASE_URL: 'https://${apiFqdn}'
  }
}

output swaName string = swa.name
output swaUri string = 'https://${swa.properties.defaultHostname}'
output swaDefaultHostname string = swa.properties.defaultHostname
