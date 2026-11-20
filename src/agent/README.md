# Wealth Team in a Day — Foundry Agents (`src/agent`)

This project hosts the **.NET 10** Microsoft Foundry agents that power the
**Caldova Wealth** client operations demo (*Wealth Team in a Day*). Each staff
character described in [`docs/characters.md`](../../docs/characters.md) is
implemented as a specialised Foundry declarative agent, following the role
and tooling mapping in [`docs/foundry_agents.md`](../../docs/foundry_agents.md).

The C# pattern is modelled on
[`qkfang/quant-agent` → `src/quantlib`](https://github.com/qkfang/quant-agent/tree/main/src/quantlib):

- `Agents/BaseAgent.cs` — wraps a Foundry declarative agent and the project
  Responses client, with MCP auto-approval, streaming, tracing and citation
  extraction.
- `Agents/CaldovaAgent.cs` — shared base for every staff agent; wires up
  Azure AI Search grounding over the `wealth_knowledge` index (PDS, trust
  deed, super rules and member case files), Bing grounding, and an optional
  MCP tool surface (server label `caldova-ops-mcp`).
- One class per staff character, each with its own Foundry agent id,
  persona, instructions and structured output format.

## Agents

| Staff character | Role | Class | Foundry agent id | CLI flag | Extra tools |
| --- | --- | --- | --- | --- | --- |
| Olivia | Onboarding & Requests Officer | `OnboardingAgent` | `onboarding-agent` | `--onboarding` | — |
| Ben | Benefits & Eligibility Assessor | `BenefitsEligibilityAgent` | `benefits-eligibility-agent` | `--benefits` | — (emits a JSON eligibility checklist) |
| Ivy | Investment Analyst | `InvestmentAnalystAgent` | `investment-analyst-agent` | `--investments` | MCP: `analyzeFactSheet`, `compareModels`, `generateClientWorkbook` |
| Felix | Financial Crime Investigator | `FinancialCrimeAgent` | `financial-crime-agent` | `--fincrime` | — (backend adds Content Understanding document checks) |
| Rory | Transfers & Rollovers Coordinator | `TransfersRolloversAgent` | `transfers-rollovers-agent` | `--transfers` | MCP: `lookupFunds`, `verifySmsf`, `generateTransferRequestPdf` |
| Penny | Payments Officer | `PaymentsAgent` | `payments-agent` | `--payments` | MCP: `payments_*` + Teams approval card |
| Cara | Client Communications Specialist | `ClientCommunicationsAgent` | `client-communications-agent` | `--communications` | — |
| Cara (voice) | Client Communications Specialist (Voice) | `ClientCommunicationsVoiceAgent` | `client-communications-voice-agent` | — (used by Voice Live) | — |
| Theo | Client Operations Team Leader | `TeamLeaderAgent` | `team-leader-agent` | `--team-leader` | — (manages the multi-agent group chat) |

Every agent supports — never replaces — human judgement. Agents check rules,
calculate, draft and recommend; humans approve declines, partial approvals,
financial-crime holds, high-value payments, death benefits, hardship releases
and sensitive communications. Agents never give personal financial advice.

## Configuration

Set the following keys in `appsettings.json` (or as environment variables):

| Key | Purpose |
| --- | --- |
| `AZURE_AI_PROJECT_ENDPOINT` | Microsoft Foundry project endpoint URL (e.g. `https://aif-caldovacs.services.ai.azure.com/api/projects/aif-caldovacs-project`) |
| `AZURE_AI_MODEL_DEPLOYMENT_NAME` | Chat model deployment (e.g. `gpt-5.4`) |
| `AZURE_TENANT_ID` | Optional tenant ID for `DefaultAzureCredential` |
| `AZURE_AI_SEARCH_CONNECTION_ID` | Foundry connection ID for the Azure AI Search service |
| `AZURE_AI_SEARCH_INDEX_NAME` | Knowledge index name (`wealth_knowledge`) |
| `AZURE_BING_CONNECTION_ID` | Foundry Bing grounding connection ID |

Authentication uses `DefaultAzureCredential`, so any locally configured
identity (Azure CLI, Managed Identity, etc.) will work.

## Running an agent

```bash
cd src/agent
dotnet run -- --onboarding "Adviser email: new Caldova Super account for Priya Natarajan, consolidate two funds"
dotnet run -- --benefits "Is a 47-year-old on JobSeeker for 31 weeks eligible for a \$15,000 hardship release?"
dotnet run -- --team-leader "Summarise today's approvals and IDR clocks"
```

Run with no arguments to print the full usage list.

## Used as a .NET library

The project is a `Microsoft.NET.Sdk` Exe assembly (the same shape as
[`quantlib`](https://github.com/qkfang/quant-agent/tree/main/src/quantlib)),
so it can run as a command-line host **and** be referenced as a library.

The Blazor web app in [`src/backend`](../backend) takes a `ProjectReference`
on `cs-agent.csproj` and resolves a `CaldovaAgentFactory` from DI to invoke the
same `OnboardingAgent`, `BenefitsEligibilityAgent`, … classes the CLI exposes.

## Adding a new agent

1. Create `Agents/<Name>Agent.cs` that extends `CaldovaAgent`.
2. Define a unique Foundry agent id (kebab-case, ending in `-agent`).
3. Provide an `Instructions` string that follows the structure in
   `docs/foundry_agents.md` (Purpose, Inputs, Tools, Outputs, Human Approval).
4. Add a CLI flag in `Program.cs` and a role key in
   `src/backend/Services/CaldovaAgentFactory.cs`.
