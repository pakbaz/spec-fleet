// ============================================================================
// containerapps.bicep — Container Apps Environment + API container app.
//
// SAMPLE-MODE DEVIATION:
//   Production per zero-trust §3 mandates internal-only ingress fronted by
//   Front Door + WAF. For the sample we expose the Container App externally
//   on HTTPS so `azd up` produces a directly testable URL. A comment in
//   core.bicep flags Front Door as the production add-on.
//
// All workload-to-data calls authenticate via the user-assigned MI; the API
// reads its identity from AZURE_CLIENT_ID, never from a connection string.
// ============================================================================

@description('Azure region.')
param location string

@description('Resource name prefix.')
param prefix string

@description('Common tags.')
param tags object

@description('Subnet ID for the Container Apps Environment (snet-apps, delegated).')
param infrastructureSubnetId string

@description('Log Analytics customer/workspace ID.')
param logAnalyticsCustomerId string

@description('Log Analytics workspace resource ID (for diagnostic settings linkage).')
param logAnalyticsWorkspaceId string

@description('App Insights connection string — injected to the API.')
param appInsightsConnectionString string

@description('User-assigned managed identity resource ID for the API.')
param apiIdentityId string

@description('User-assigned managed identity client ID — injected as AZURE_CLIENT_ID.')
param apiIdentityClientId string

@description('ACR login server (e.g. crxxx.azurecr.io).')
param acrLoginServer string

@description('Cosmos endpoint URL.')
param cosmosEndpoint string

@description('Cosmos database name.')
param cosmosDatabaseName string

@description('Key Vault URI.')
param keyVaultUri string

@description('Storage blob endpoint.')
param storageBlobEndpoint string

@description('Redis hostname.')
param redisHostname string

@description('Image to deploy. azd substitutes this on first deploy; default points at a placeholder so provisioning succeeds.')
param apiImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

@description('Tag to apply to the api Container App (azd uses azd-service-name).')
param apiServiceTag string = 'api'

var caeName = 'cae-${prefix}'
var apiName = 'ca-${prefix}-api'

resource cae 'Microsoft.App/managedEnvironments@2024-10-02-preview' = {
  name: caeName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsCustomerId
        sharedKey: listKeys(logAnalyticsWorkspaceId, '2023-09-01').primarySharedKey
      }
    }
    vnetConfiguration: {
      internal: false  // sample: external ingress; production: set true behind Front Door
      infrastructureSubnetId: infrastructureSubnetId
    }
    zoneRedundant: false
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
  }
}

resource apiApp 'Microsoft.App/containerApps@2024-10-02-preview' = {
  name: apiName
  location: location
  tags: union(tags, {
    'azd-service-name': apiServiceTag
  })
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${apiIdentityId}': {}
    }
  }
  properties: {
    managedEnvironmentId: cae.id
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 8080
        transport: 'auto'
        allowInsecure: false
        traffic: [
          { weight: 100, latestRevision: true }
        ]
        corsPolicy: {
          allowedOrigins: [
            'https://*.azurestaticapps.net'
          ]
          allowedMethods: [ 'GET', 'POST', 'PUT', 'DELETE', 'OPTIONS' ]
          allowedHeaders: [ '*' ]
          allowCredentials: true
        }
      }
      registries: [
        {
          server: acrLoginServer
          identity: apiIdentityId
        }
      ]
      maxInactiveRevisions: 3
    }
    template: {
      containers: [
        {
          name: 'api'
          image: apiImage
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'PORT', value: '8080' }
            { name: 'ASPNETCORE_URLS', value: 'http://+:8080' }
            { name: 'AZURE_CLIENT_ID', value: apiIdentityClientId }
            { name: 'COSMOS__ENDPOINT', value: cosmosEndpoint }
            { name: 'COSMOS__DATABASE', value: cosmosDatabaseName }
            { name: 'KEYVAULT__URI', value: keyVaultUri }
            { name: 'STORAGE__BLOBENDPOINT', value: storageBlobEndpoint }
            { name: 'REDIS__HOSTNAME', value: redisHostname }
            { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsightsConnectionString }
            { name: 'OTEL_SERVICE_NAME', value: apiName }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: { path: '/livez', port: 8080 }
              initialDelaySeconds: 10
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: { path: '/readyz', port: 8080 }
              initialDelaySeconds: 5
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 5
        rules: [
          {
            name: 'http-rule'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

output containerAppsEnvId string = cae.id
output containerAppsEnvName string = cae.name
output apiName string = apiApp.name
output apiUri string = 'https://${apiApp.properties.configuration.ingress.fqdn}'
output apiFqdn string = apiApp.properties.configuration.ingress.fqdn
