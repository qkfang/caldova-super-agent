# Wealth Team in a Day — Operations Web App (`src/backend`)

A .NET 10 Blazor Server web app for the **Caldova Wealth** client operations
office. Every Microsoft Foundry agent in [`src/agent/Agents`](../agent/Agents)
gets its own page that opens straight into a live **Try it out** demo against
a real Member Case (Client Communications adds a **Voice chat** tab and Team
Leader a **Group Chat** tab). The same app hosts the five scenario pages,
the in-process **MCP server** the Foundry agents call back into, and the
Voice Live proxy for Cara.

## Run

```bash
dotnet run --project src/backend/cs-backend.csproj
```

Then open <http://localhost:5212>. With no Foundry configuration every
Try-it-out flow still completes using deterministic, scenario-accurate
results — so the demo works offline. Configure Foundry (below) to see the
real agents stream their reasoning, cite the knowledge base and call MCP
tools.

## Routes

| Route | What it is |
| --- | --- |
| `/` | Operations office landing page — scenario list and one card per agent |
| `/agents/{id}` | Agent page — the live Try it out demo (`?caseNumber=REQ-…` pre-selects a case on Benefits, Investments, Transfers and Payments) |
| `/scenarios/{id}` | Scenario steps, each with a **Run this step** link to that agent's page for the case |
| `/account` | "Ask AI" member chatbot with related-agent references |
| `/mcp` | MCP server (investments, transfers, payments and Teams tools) |

### Agent pages

| Route id | Agent (staff) | Try-it-out endpoints | Foundry capability on show |
| --- | --- | --- | --- |
| `onboarding` | Onboarding Agent (Olivia) | `/onboarding/*` | Document extraction → Member Case, NIGO checklist |
| `benefits-eligibility` | Benefits & Eligibility Agent (Ben) | `/benefits/*` | Azure AI Search grounding with cited rules, structured JSON checklist |
| `investment-analyst` | Investment Analyst Agent (Ivy) | `/investments/*` | MCP tools: fact sheets → comparison table, Mermaid chart, Excel workbook |
| `financial-crime` | Financial Crime Agent (Felix) | `/fincrime/*` | Azure Content Understanding document authenticity + explainable risk |
| `transfers-rollovers` | Transfers & Rollovers Agent (Rory) | `/transfers/*` | MCP tools: fund directory, SMSF verification, transfer-request PDF |
| `payments` | Payments Agent (Penny) | `/payments/*` | MCP payment tools + Microsoft Teams approval card, gated release |
| `client-communications` | Client Communications Agent (Cara) | `/communications/*` | Tone-matched drafts for members and advisers + Voice Live |
| `team-leader` | Team Leader Agent (Theo) | `/team-leader/*` | Floor dashboard + multi-agent group chat orchestration |

Every engage step shows five sub-tabs — **Agent Narrative**, **Reference**,
**Agent Prompt & Tools** (from `/agents/{id}/metadata`), **Agent Input** and
**Raw Output** — so the audience can see exactly what the agent saw, which
tools it called and what it produced.

### Seeded Member Cases

`CaseStore.SeedDefaults()` creates one case per scenario at start-up, so every
page has something to work on immediately (cases minted live by the
Onboarding demo are added alongside them):

| Case | Member | Request |
| --- | --- | --- |
| `REQ-20261103-OPS001` | Priya Natarajan | New account & consolidation (via Yarra Private Wealth) |
| `REQ-20261106-OPS002` | Grace Williams | Rollover out to SMSF — identity takeover, blocked |
| `REQ-20261109-OPS003` | George Papadopoulos | Pension commencement (via Bayside Financial Partners) |
| `REQ-20261111-OPS004` | Tom Bradley | Financial hardship release (partial) |
| `REQ-20261113-OPS005` | Robert Chen for Mei Chen | Death benefit claim (binding nomination) |

## Configuration

The app references the [`agent`](../agent) project as a .NET library and uses
the same Foundry configuration keys as the CLI host. Set them in
`appsettings.json`, `appsettings.Development.json`, or as environment variables:

| Key | Purpose |
| --- | --- |
| `AZURE_AI_PROJECT_ENDPOINT` | Microsoft Foundry project endpoint URL |
| `AZURE_AI_MODEL_DEPLOYMENT_NAME` | Chat model deployment (e.g. `gpt-5.4`) |
| `AZURE_TENANT_ID` | Optional tenant ID for `DefaultAzureCredential` |
| `AZURE_AI_SEARCH_CONNECTION_ID` | Foundry connection ID for Azure AI Search |
| `AZURE_AI_SEARCH_INDEX_NAME` | Knowledge index (`wealth_knowledge` — see [`ai-search/`](../../ai-search)) |
| `AZURE_BING_CONNECTION_ID` | Foundry Bing grounding connection ID |
| `APP_MCP_URL` | Public base URL of this app (e.g. a dev tunnel) so Foundry can reach `/mcp`. Leave it unset for purely local runs — otherwise agents call the MCP tools on that host. |
| `AZURE_CONTENT_UNDERSTANDING_ENDPOINT` | Optional. Azure Content Understanding endpoint for the Financial Crime document-authenticity pass (falls back to manifest verdicts when unset) |
| `AZURE_CONTENT_UNDERSTANDING_KEY` | Optional API key (otherwise `DefaultAzureCredential` is used) |
| `AZURE_CONTENT_UNDERSTANDING_ANALYZER_ID` | Optional analyzer id (default `caldova_fincrime_authenticity_v1`, created on first use) |
| `AZURE_CONTENT_UNDERSTANDING_COMPLETION_MODEL` / `_EMBEDDING_MODEL` | Optional model deployments for the analyzer (defaults `gpt-4.1` / `text-embedding-3-large`) |

When the endpoint and model are set, `CaldovaAgentFactory.IsConfigured` is
`true` and pages invoke the real agents (`factory.Create("payments")`, …).
Otherwise the offline (deterministic) results are used.

## Financial Crime — document authenticity

The Financial Crime Try-it-out tab runs a per-document authenticity pass over
the documents attached to each case (identity documents, bank statements,
SMSF registration letters, death certificates). Sample documents live under
[`wwwroot/fincrime/samples/`](wwwroot/fincrime/samples/) with a
[`manifest.json`](wwwroot/fincrime/samples/manifest.json); they are visibly
fictitious ("SPECIMEN — DEMO ONLY") and were generated once by
[`tools/generate_fincrime_samples.py`](../../tools/generate_fincrime_samples.py).

`FinCrimeDocumentVerifier` sends each document to Azure Content Understanding
with a shared authenticity field schema (document type, issuer, holder name,
document number, dates, tamper indicators, security features, consistency
summary) and folds the result into a small deterministic checks layer, giving
each document a verdict (`legit` / `suspicious` / `fake`), the checks performed
and the reasons any failed. The findings are passed to Felix so his risk
narrative cites each document by number. Without Content Understanding the
verifier falls back to the manifest's expected verdicts, so the story still
plays end to end.

## Payments — human approval in Microsoft Teams

Penny's agent calls the `payments_*` MCP tools to validate the payee, confirm
the eligibility decision, calculate tax components and PAYG withholding, check
authority limits and raise an approval request. `teams_sendApprovalCard`
posts an Adaptive Card to Microsoft Teams; `payments_releasePayment` refuses
to run until the approver has approved. The page also offers an in-page
approve/reject fallback for demos without Teams.
