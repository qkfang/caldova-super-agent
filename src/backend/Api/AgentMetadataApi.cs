using CaldovaSuper.Agents;
using CaldovaSuper.App.Services;

namespace CaldovaSuper.App.Api;

/// <summary>
/// Lightweight read-only endpoint that powers the "Agent Prompt &amp; Tools"
/// sub-tab on every agent page. Returns the system instructions the
/// Foundry agent is created with, plus the list of tools the agent has
/// access to in the current environment. Does not require Foundry to be
/// configured — instructions are static <c>const</c> strings on each
/// agent class.
/// </summary>
public static class AgentMetadataApi
{
    private record RoleMetadata(
        string RoleId,
        string Name,
        string Role,
        string Department,
        string AgentId,
        string Instructions,
        string[] DefaultTools,
        string[] McpTools);

    // Shared base tools every Caldova agent gets. Surfaced both in the
    // static "demo" view (defaultTools) and the runtime view
    // (configuredTools) when the corresponding Foundry connection ids
    // are present in configuration.
    private const string SearchToolDescription =
        "Azure AI Search — Caldova wealth knowledge base (PDS, trust deed, super rules, member case files)";
    private const string BingToolDescription =
        "Bing Grounding — open-web grounding for current public context (e.g. ATO rates)";

    private static readonly string[] DefaultTools =
    [
        SearchToolDescription,
        BingToolDescription
    ];

    // Per-role MCP tool surfaces. Each entry is the human-readable label
    // shown in the "Tools available" list in the Agent Prompt & Tools tab.
    // These mirror the [McpServerTool] methods in src/backend/Mcp/*.cs and
    // are appended to the runtime configuredTools list whenever
    // APP_MCP_URL is set.
    private static readonly string[] InvestmentsMcpTools =
    [
        "MCP · analyzeFactSheet — fetch and parse a Caldova Managed Portfolio fact sheet (fees, allocation, returns)",
        "MCP · compareModels — markdown comparison table + Mermaid chart of annual cost in dollars + observations",
        "MCP · generateClientWorkbook — write the case .xlsx workbook (summary + comparison + recommendations) and return its download URL"
    ];

    private static readonly string[] TransfersMcpTools =
    [
        "MCP · lookupFunds — Caldova directory of external super funds and counterparties (USI, SuperStream contact, turnaround)",
        "MCP · verifySmsf — SMSF verification check before any rollover out (registered SMSF, member linked, bank details and ESA match)",
        "MCP · generateTransferRequestPdf — generate the Caldova transfer / rollover request PDF and return the download URL"
    ];

    private static readonly string[] PaymentsMcpTools =
    [
        "MCP · payments_validatePayee — confirm the payee name and bank details match the member or beneficiary",
        "MCP · payments_checkCaseApproval — confirm the eligibility decision and approved amount on the case",
        "MCP · payments_calculateBenefit — tax-free / taxable components, PAYG withholding and net payment",
        "MCP · payments_checkAuthorityLimit — flag payments that need Team Leader approval",
        "MCP · payments_requestApproval — raise an approval and post an Adaptive Card to Microsoft Teams (uses teams_sendApprovalCard)",
        "MCP · payments_getApprovalStatus — poll the approval state",
        "MCP · payments_releasePayment — release the payment (gated, requires prior approval)",
        "MCP · teams_sendApprovalCard — deliver the Caldova payment-approval Adaptive Card to the approver in Microsoft Teams"
    ];

    private static readonly string[] NoMcpTools = Array.Empty<string>();

    private static readonly Dictionary<string, RoleMetadata> _catalog = new(StringComparer.OrdinalIgnoreCase)
    {
        ["onboarding"] = new(
            "onboarding", "Olivia", "Onboarding & Requests Officer", "Onboarding & Requests",
            "onboarding-agent", OnboardingAgent.Instructions, DefaultTools, NoMcpTools),
        ["benefits-eligibility"] = new(
            "benefits-eligibility", "Ben", "Benefits & Eligibility Assessor", "Benefits & Eligibility",
            "benefits-eligibility-agent", BenefitsEligibilityAgent.Instructions, DefaultTools, NoMcpTools),
        ["investment-analyst"] = new(
            "investment-analyst", "Ivy", "Investment Analyst", "Investment Solutions",
            "investment-analyst-agent", InvestmentAnalystAgent.Instructions, DefaultTools.Concat(InvestmentsMcpTools).ToArray(), InvestmentsMcpTools),
        ["financial-crime"] = new(
            "financial-crime", "Felix", "Financial Crime Investigator", "Financial Crime",
            "financial-crime-agent", FinancialCrimeAgent.Instructions, DefaultTools, NoMcpTools),
        ["transfers-rollovers"] = new(
            "transfers-rollovers", "Rory", "Transfers & Rollovers Coordinator", "Transfers & Rollovers",
            "transfers-rollovers-agent", TransfersRolloversAgent.Instructions, DefaultTools.Concat(TransfersMcpTools).ToArray(), TransfersMcpTools),
        ["payments"] = new(
            "payments", "Penny", "Payments Officer", "Payments",
            "payments-agent", PaymentsAgent.Instructions, DefaultTools.Concat(PaymentsMcpTools).ToArray(), PaymentsMcpTools),
        ["client-communications"] = new(
            "client-communications", "Cara", "Client Communications Specialist", "Client Communications",
            "client-communications-agent", ClientCommunicationsAgent.Instructions, DefaultTools, NoMcpTools),
        ["client-communications-voice"] = new(
            "client-communications-voice", "Cara", "Client Communications Specialist (Voice)", "Client Communications",
            "client-communications-voice-agent", ClientCommunicationsVoiceAgent.Instructions, DefaultTools, NoMcpTools),
        ["team-leader"] = new(
            "team-leader", "Theo", "Client Operations Team Leader", "Team Leader Office",
            "team-leader-agent", TeamLeaderAgent.Instructions, DefaultTools, NoMcpTools),
    };

    public static void MapAgentMetadataEndpoints(this WebApplication app, CaldovaAgentOptions options)
    {
        app.MapGet("/agents/{role}/metadata", (string role) =>
        {
            if (!_catalog.TryGetValue(role, out var m))
                return Results.NotFound(new { error = $"Unknown agent role '{role}'." });

            // Live runtime view of which tools the agent has wired up given
            // the current configuration. When APP_MCP_URL is set, the role's
            // MCP tool surface is also appended.
            var configuredTools = new List<string>();
            if (!string.IsNullOrWhiteSpace(options.SearchConnectionId) && !string.IsNullOrWhiteSpace(options.SearchIndexName))
                configuredTools.Add($"Azure AI Search — index '{options.SearchIndexName}'");
            if (!string.IsNullOrWhiteSpace(options.BingConnectionId))
                configuredTools.Add("Bing Grounding (web)");
            if (!string.IsNullOrWhiteSpace(options.AppMcpUrl) && m.McpTools.Length > 0)
                configuredTools.AddRange(m.McpTools);

            return Results.Ok(new
            {
                roleId = m.RoleId,
                name = m.Name,
                role = m.Role,
                department = m.Department,
                agentId = m.AgentId,
                modelDeployment = options.ModelDeploymentName ?? string.Empty,
                instructions = m.Instructions,
                defaultTools = m.DefaultTools,
                configuredTools = configuredTools,
                mcpTools = m.McpTools,
                mcpConfigured = !string.IsNullOrWhiteSpace(options.AppMcpUrl) && m.McpTools.Length > 0,
                isConfigured = options.IsConfigured
            });
        });
    }
}
