@description('Name of the existing Foundry (AI Services) account')
param foundryName string

@description('Name of the existing Application Insights resource')
param appInsightsName string

resource foundry 'Microsoft.CognitiveServices/accounts@2025-10-01-preview' existing = {
  name: foundryName
}

resource project 'Microsoft.CognitiveServices/accounts/projects@2025-06-01' existing = {
  parent: foundry
  name: '${foundryName}-project'
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' existing = {
  name: appInsightsName
}

// Connecting Application Insights to the Foundry project turns on tracing
// (Foundry portal > Tracing) for every agent run in the project.
#disable-next-line BCP081
resource appInsightsConnection 'Microsoft.CognitiveServices/accounts/projects/connections@2025-10-01-preview' = {
  parent: project
  name: appInsightsName
  properties: {
    authType: 'ApiKey'
    category: 'AppInsights'
    target: appInsights.id
    credentials: {
      key: appInsights.properties.ConnectionString
    }
    metadata: {
      ApiType: 'Azure'
      ResourceId: appInsights.id
    }
  }
}

output connectionId string = appInsightsConnection.id
