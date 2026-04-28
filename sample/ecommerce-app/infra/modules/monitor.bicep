// ============================================================================
// monitor.bicep — Log Analytics workspace + workspace-based App Insights.
// Required by every workload (instruction.md operations.* and zero-trust §3).
// ============================================================================

@description('Azure region.')
param location string

@description('Resource name prefix.')
param prefix string

@description('Common tags.')
param tags object

@description('Principal IDs that should receive Monitoring Metrics Publisher on the App Insights component.')
param metricsPublisherPrincipalIds array = []

var roleMetricsPublisher = '3913510d-42f4-4e42-8a64-420c390055eb'

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-${prefix}'
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    publicNetworkAccessForIngestion: 'Enabled'  // ingestion via AzureMonitor service tag from snet-apps
    publicNetworkAccessForQuery: 'Enabled'
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'appi-${prefix}'
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
    IngestionMode: 'LogAnalytics'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
    DisableIpMasking: false
  }
}

output logAnalyticsId string = logAnalytics.id
output logAnalyticsName string = logAnalytics.name
output logAnalyticsCustomerId string = logAnalytics.properties.customerId
output appInsightsId string = appInsights.id
output appInsightsName string = appInsights.name
output appInsightsConnectionString string = appInsights.properties.ConnectionString
output appInsightsInstrumentationKey string = appInsights.properties.InstrumentationKey

resource raMetrics 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for pid in metricsPublisherPrincipalIds: {
  scope: appInsights
  name: guid(appInsights.id, pid, roleMetricsPublisher)
  properties: {
    principalId: pid
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleMetricsPublisher)
  }
}]
