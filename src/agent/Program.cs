using Azure.AI.Projects;
using Azure.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using CaldovaSuper.Agents;

// Wealth Team in a Day — Caldova Wealth — .NET 10 Foundry agents
//
// Each staff character in the Caldova Wealth client operations office is
// implemented as a specialised Azure AI Foundry declarative agent. This
// console host lets you drive any individual agent from the command line
// for demo / testing purposes.
//
// Usage:
//   dotnet run -- --onboarding      "Adviser email: new Caldova Super account for Priya Natarajan, consolidate 2 funds"
//   dotnet run -- --benefits        "Is Tom Bradley (47, JobSeeker 31 weeks) eligible for a $15,000 hardship release?"
//   dotnet run -- --investments     "Compare Growth vs Balanced vs Index Balanced on a $138,200 balance"
//   dotnet run -- --fincrime        "Full-balance rollover to a 9-day-old SMSF two days after a mobile change"
//   dotnet run -- --transfers       "Consolidate Southern Cross Industry Super and Harbourline Retail Super"
//   dotnet run -- --payments        "Calculate a $10,000 hardship payment, 6% tax-free, member aged 47"
//   dotnet run -- --communications  "Draft a condolence letter to Robert Chen about his mother's death benefit"
//   dotnet run -- --team-leader     "Summarise today's approvals and IDR clocks"

var config = new ConfigurationBuilder()
    .AddJsonFile("appsettings.json", optional: false)
    .AddJsonFile("appsettings.Development.json", optional: true)
    .AddEnvironmentVariables()
    .Build();

var endpoint = config["AZURE_AI_PROJECT_ENDPOINT"];
if (string.IsNullOrWhiteSpace(endpoint))
    throw new InvalidOperationException("AZURE_AI_PROJECT_ENDPOINT is not set.");

var deploymentName = config["AZURE_AI_MODEL_DEPLOYMENT_NAME"];
if (string.IsNullOrWhiteSpace(deploymentName))
    throw new InvalidOperationException("AZURE_AI_MODEL_DEPLOYMENT_NAME is not set.");

var tenantId = config["AZURE_TENANT_ID"];

var credentialOptions = new DefaultAzureCredentialOptions
{
    ExcludeVisualStudioCredential = true,
    ExcludeVisualStudioCodeCredential = true,
    ExcludeSharedTokenCacheCredential = true
};
if (!string.IsNullOrWhiteSpace(tenantId))
{
    credentialOptions.TenantId = tenantId;
}
var credential = new DefaultAzureCredential(credentialOptions);
AIProjectClient aiProjectClient = new(new Uri(endpoint), credential);

using var loggerFactory = LoggerFactory.Create(b => b.AddConsole());

var searchConnectionId = config["AZURE_AI_SEARCH_CONNECTION_ID"];
var searchIndexName = config["AZURE_AI_SEARCH_INDEX_NAME"];
var bingConnectionId = config["AZURE_BING_CONNECTION_ID"];

string? flag = args.Length > 0 ? args[0] : null;
string request = args.Length > 1
    ? string.Join(" ", args.Skip(1))
    : "Walk me through how you would handle this request.";

CaldovaAgent? agent = flag switch
{
    "--onboarding"
        => new OnboardingAgent(aiProjectClient, deploymentName, searchConnectionId, searchIndexName, bingConnectionId, loggerFactory.CreateLogger<OnboardingAgent>()),
    "--benefits"
        => new BenefitsEligibilityAgent(aiProjectClient, deploymentName, searchConnectionId, searchIndexName, bingConnectionId, loggerFactory.CreateLogger<BenefitsEligibilityAgent>()),
    "--investments"
        => new InvestmentAnalystAgent(aiProjectClient, deploymentName, searchConnectionId, searchIndexName, bingConnectionId, loggerFactory.CreateLogger<InvestmentAnalystAgent>()),
    "--fincrime"
        => new FinancialCrimeAgent(aiProjectClient, deploymentName, searchConnectionId, searchIndexName, bingConnectionId, loggerFactory.CreateLogger<FinancialCrimeAgent>()),
    "--transfers"
        => new TransfersRolloversAgent(aiProjectClient, deploymentName, searchConnectionId, searchIndexName, bingConnectionId, mcpServerUri: null, logger: loggerFactory.CreateLogger<TransfersRolloversAgent>()),
    "--payments"
        => new PaymentsAgent(aiProjectClient, deploymentName, searchConnectionId, searchIndexName, bingConnectionId, loggerFactory.CreateLogger<PaymentsAgent>()),
    "--communications"
        => new ClientCommunicationsAgent(aiProjectClient, deploymentName, searchConnectionId, searchIndexName, bingConnectionId, loggerFactory.CreateLogger<ClientCommunicationsAgent>()),
    "--team-leader"
        => new TeamLeaderAgent(aiProjectClient, deploymentName, searchConnectionId, searchIndexName, bingConnectionId, loggerFactory.CreateLogger<TeamLeaderAgent>()),
    _ => null
};

if (agent is null)
{
    PrintUsage();
    return;
}

Console.WriteLine($"{agent.ConsoleColor}--- {agent.Name} ({agent.Role}) — {agent.Department} ---\u001b[0m");
Console.WriteLine($"Request: {request}");
Console.WriteLine();

await foreach (var chunk in agent.RunStreamingAsync(request))
{
    Console.Write(chunk);
}
Console.WriteLine();

static void PrintUsage()
{
    Console.WriteLine("Wealth Team in a Day — Caldova Wealth — Foundry agents");
    Console.WriteLine();
    Console.WriteLine("Usage:");
    Console.WriteLine("  dotnet run -- --onboarding      \"<message>\"   Olivia — Onboarding & Requests");
    Console.WriteLine("  dotnet run -- --benefits        \"<message>\"   Ben    — Benefits & Eligibility");
    Console.WriteLine("  dotnet run -- --investments     \"<message>\"   Ivy    — Investment Solutions");
    Console.WriteLine("  dotnet run -- --fincrime        \"<message>\"   Felix  — Financial Crime");
    Console.WriteLine("  dotnet run -- --transfers       \"<message>\"   Rory   — Transfers & Rollovers");
    Console.WriteLine("  dotnet run -- --payments        \"<message>\"   Penny  — Payments");
    Console.WriteLine("  dotnet run -- --communications  \"<message>\"   Cara   — Client Communications");
    Console.WriteLine("  dotnet run -- --team-leader     \"<message>\"   Theo   — Team Leader Office");
}
