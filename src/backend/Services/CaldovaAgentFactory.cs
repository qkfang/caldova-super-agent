using Azure.AI.Projects;
using Azure.Identity;
using Microsoft.Extensions.Logging;
using OpenAI.Responses;
using CaldovaSuper.Agents;

namespace CaldovaSuper.App.Services;

/// <summary>
/// Factory for the Caldova Wealth Foundry agents defined in the <c>agent</c>
/// project. The Blazor app references <c>src/agent</c> as a .NET library and
/// uses this factory to invoke the same agents the CLI host exposes —
/// analogous to how
/// <see href="https://github.com/qkfang/quant-agent/tree/main/src/quantapi">quantapi</see>
/// instantiates <c>QuantAgent</c> subclasses from <c>quantlib</c>.
/// </summary>
public class CaldovaAgentFactory
{
    private readonly CaldovaAgentOptions _options;
    private readonly ILoggerFactory _loggerFactory;
    private readonly Lazy<AIProjectClient> _aiProjectClient;

    public CaldovaAgentFactory(CaldovaAgentOptions options, ILoggerFactory loggerFactory)
    {
        _options = options;
        _loggerFactory = loggerFactory;
        _aiProjectClient = new Lazy<AIProjectClient>(CreateAIProjectClient);
    }

    /// <summary>True when the underlying Foundry connection is configured.</summary>
    public bool IsConfigured => _options.IsConfigured;

    /// <summary>
    /// Create an agent for the given role key. Keys match the CLI flags in
    /// <c>src/agent</c> (<c>onboarding</c>, <c>benefits</c>,
    /// <c>investments</c>, <c>fincrime</c>, <c>transfers</c>,
    /// <c>payments</c>, <c>communications</c>, <c>communications-voice</c>,
    /// <c>team-leader</c>); the page route ids are accepted as aliases.
    /// </summary>
    /// <param name="role">Kebab-case role key or route id.</param>
    /// <param name="extraTools">Optional Foundry response tools (e.g. an
    /// MCP tool surface) to wire onto the agent in addition to the default
    /// Azure AI Search and Bing tools.</param>
    public CaldovaAgent Create(string role, IList<ResponseTool>? extraTools = null)
    {
        if (!IsConfigured)
        {
            throw new InvalidOperationException(
                "Caldova agent factory is not configured. Set AZURE_AI_PROJECT_ENDPOINT and " +
                "AZURE_AI_MODEL_DEPLOYMENT_NAME in appsettings.json or environment variables.");
        }

        var client = _aiProjectClient.Value;
        var deployment = _options.ModelDeploymentName!;
        var search = _options.SearchConnectionId;
        var index = _options.SearchIndexName;
        var bing = _options.BingConnectionId;
        var mcpUri = string.IsNullOrWhiteSpace(_options.AppMcpUrl)
            ? null
            : $"{_options.AppMcpUrl!.TrimEnd('/')}/mcp";

        return role.ToLowerInvariant() switch
        {
            "onboarding" or "intake"
                => new OnboardingAgent(client, deployment, search, index, bing, _loggerFactory.CreateLogger<OnboardingAgent>()),
            "benefits" or "benefits-eligibility"
                => new BenefitsEligibilityAgent(client, deployment, search, index, bing, _loggerFactory.CreateLogger<BenefitsEligibilityAgent>()),
            "investments" or "investment-analyst"
                => new InvestmentAnalystAgent(client, deployment, search, index, bing, _loggerFactory.CreateLogger<InvestmentAnalystAgent>(), mcpUri),
            "fincrime" or "financial-crime"
                => new FinancialCrimeAgent(client, deployment, search, index, bing, _loggerFactory.CreateLogger<FinancialCrimeAgent>()),
            "transfers" or "transfers-rollovers"
                => new TransfersRolloversAgent(client, deployment, search, index, bing, mcpUri, _loggerFactory.CreateLogger<TransfersRolloversAgent>()),
            "payments"
                => new PaymentsAgent(client, deployment, search, index, bing, _loggerFactory.CreateLogger<PaymentsAgent>(), extraTools),
            "communications" or "client-communications"
                => new ClientCommunicationsAgent(client, deployment, search, index, bing, _loggerFactory.CreateLogger<ClientCommunicationsAgent>()),
            "communications-voice" or "client-communications-voice"
                => new ClientCommunicationsVoiceAgent(client, deployment, search, index, bing, _loggerFactory.CreateLogger<ClientCommunicationsVoiceAgent>()),
            "team-leader" or "leader"
                => new TeamLeaderAgent(client, deployment, search, index, bing, _loggerFactory.CreateLogger<TeamLeaderAgent>()),
            _ => throw new ArgumentException($"Unknown Caldova agent role: '{role}'.", nameof(role))
        };
    }

    private AIProjectClient CreateAIProjectClient()
    {
        var credentialOptions = new Azure.Identity.DefaultAzureCredentialOptions
        {
            ExcludeVisualStudioCredential = true,
            ExcludeVisualStudioCodeCredential = true,
            ExcludeSharedTokenCacheCredential = true
        };
        if (!string.IsNullOrWhiteSpace(_options.TenantId))
        {
            credentialOptions.TenantId = _options.TenantId;
        }
        var credential = new Azure.Identity.DefaultAzureCredential(credentialOptions);
        return new AIProjectClient(new Uri(_options.ProjectEndpoint!), credential);
    }
}
