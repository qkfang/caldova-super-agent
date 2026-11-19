using Azure.AI.Projects;
using Azure.AI.Projects.Agents;
using Microsoft.Extensions.Logging;
using OpenAI.Responses;

namespace CaldovaSuper.Agents;

/// <summary>
/// Shared base for every staff-character agent in the Caldova Wealth client
/// operations office ("Wealth Team in a Day").
///
/// Each agent represents one specialist role from <c>docs/foundry_agents.md</c>
/// and is wired up with the same Foundry tools: Azure AI Search over the
/// <c>wealth_knowledge</c> index (PDS, trust deed, super rules and member case
/// files) and Bing grounding for current public context such as ATO rates.
/// Some roles additionally get an MCP tool surface served by the backend.
/// Analogous to <c>QuantAgent</c> in
/// https://github.com/qkfang/quant-agent/tree/main/src/quantlib/Agents/QuantAgent.cs.
/// </summary>
public class CaldovaAgent : BaseAgent
{
    /// <summary>Shared MCP server label for the backend's tool surface.</summary>
    public const string DefaultMcpServerLabel = "caldova-ops-mcp";

    /// <summary>Display name of the staff character (e.g. "Olivia").</summary>
    public string Name { get; }

    /// <summary>Staff role (e.g. "Onboarding &amp; Requests Officer").</summary>
    public string Role { get; }

    /// <summary>Department this agent belongs to in the voxel operations office.</summary>
    public string Department { get; }

    /// <summary>ANSI console colour used when streaming the agent's output.</summary>
    public string ConsoleColor { get; }

    /// <summary>
    /// Human-readable list of Foundry tools wired up for this agent based on
    /// the connections that were configured. Surfaced in the "Agent Prompt
    /// &amp; Tools" sub-tab on each agent page.
    /// </summary>
    public IReadOnlyList<string> ConfiguredTools { get; }

    public CaldovaAgent(
        AIProjectClient aiProjectClient,
        string agentId,
        string name,
        string role,
        string department,
        string consoleColor,
        string deploymentName,
        string instructions,
        string? searchConnectionId = null,
        string? searchIndexName = null,
        string? bingConnectionId = null,
        ILogger? logger = null,
        string? mcpServerUri = null,
        string? mcpServerLabel = null,
        IList<ResponseTool>? extraTools = null)
        : base(aiProjectClient, agentId, deploymentName, instructions, null,
            agentDef =>
            {
                if (!string.IsNullOrWhiteSpace(searchConnectionId) && !string.IsNullOrWhiteSpace(searchIndexName))
                    agentDef.Tools.Add(new AzureAISearchTool(new AzureAISearchToolOptions([
                        new AzureAISearchToolIndex { ProjectConnectionId = searchConnectionId, IndexName = searchIndexName, QueryType = AzureAISearchQueryType.Simple, TopK = 5 }
                    ])));

                if (!string.IsNullOrWhiteSpace(bingConnectionId))
                    agentDef.Tools.Add(new BingGroundingTool(new BingGroundingSearchToolOptions([
                        new BingGroundingSearchConfiguration(bingConnectionId)
                    ])));

                if (!string.IsNullOrWhiteSpace(mcpServerUri))
                {
                    var mcpTool = ResponseTool.CreateMcpTool(
                        serverLabel: mcpServerLabel ?? DefaultMcpServerLabel,
                        serverUri: new Uri(mcpServerUri),
                        toolCallApprovalPolicy: new McpToolCallApprovalPolicy(GlobalMcpToolCallApprovalPolicy.NeverRequireApproval));
                    agentDef.Tools.Add(mcpTool);
                }

                if (extraTools != null)
                {
                    foreach (var tool in extraTools)
                    {
                        if (tool != null) agentDef.Tools.Add(tool);
                    }
                }
            },
            logger)
    {
        Name = name;
        Role = role;
        Department = department;
        ConsoleColor = consoleColor;

        var tools = new List<string>();
        if (!string.IsNullOrWhiteSpace(searchConnectionId) && !string.IsNullOrWhiteSpace(searchIndexName))
            tools.Add($"Azure AI Search — index '{searchIndexName}'");
        if (!string.IsNullOrWhiteSpace(bingConnectionId))
            tools.Add("Bing Grounding (web)");
        if (!string.IsNullOrWhiteSpace(mcpServerUri))
            tools.Add($"MCP server '{mcpServerLabel ?? DefaultMcpServerLabel}' at {mcpServerUri}");
        if (extraTools != null && extraTools.Count > 0)
            tools.Add($"MCP tool surface ({extraTools.Count} tool{(extraTools.Count == 1 ? "" : "s")})");
        ConfiguredTools = tools;
    }
}
