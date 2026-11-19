# `src/logic` — Member Request Email Logic App workflows

This folder contains the Azure **Logic Apps Standard** workflow set used by the **Wealth Team in a Day** demo for **Caldova Wealth**. It is the email front door of **Caldova Client Operations**: when a member or adviser emails the operations mailbox, these workflows pick the email up, decide which sub-flow should handle it, call a Foundry agent to capture and route the request as a **Member Case** using MCP tools, log each step to OneLake (Microsoft Fabric), and escalate to the human **Client Operations Team Leader** via Teams when the agent cannot complete the request.

The workflows here were ported from the reference implementation in
[`qkfang/tfn-processing/apps/logicapp-tfn`](https://github.com/qkfang/tfn-processing/tree/main/apps/logicapp-tfn) and re-pointed at Caldova Wealth resources, agents, and terminology.

## Files

| File | Type | Purpose |
| --- | --- | --- |
| `monitor-email-processing.json` | Stateful workflow | Trigger on a new email arriving in the operations mailbox (Office 365 connector, Inbox folder). An orchestrator Agent action reads the sender, subject and body and dispatches to either `member-request-processing` (new member / adviser requests, or new information for an existing case) or `return-email-processing` (acknowledgements and outbound status emails). |
| `member-request-processing.json` | Stateful workflow | Main member-request pipeline. Uploads attachments to blob, builds the Foundry conversation, calls the `member-request-agent`, records each step to a OneLake JSON log via `fabric-file-log`, and engages the Client Operations Team Leader via Teams (HIL) when the agent reports `processed_status=false`. |
| `return-email-processing.json` | Stateful workflow | Mirror pipeline for acknowledgement / status-update emails to members and advisers, using the `return-email-agent`. Same Fabric-log + HIL escalation pattern. |
| `fabric-file-log.json` | Stateful workflow | Helper workflow that PUTs a JSON file into the `LH_Operations.Lakehouse/Files/` folder of the `Caldova_Wealth_Demo` Fabric workspace using the workflow's user-assigned managed identity. Called by both processing workflows at each major step. |
| `Analyze_Document_for_Prebuilt_or_Custom_models_v4_x_API.json` | Stateful workflow | Wrapper around the Document Intelligence v4 connector. Exposed as the `Analyze_Document_for_Prebuilt_or_Custom_models_v4_x_API` tool inside `document-int-mcp`; reads the attachment from the `email-attachment` blob container (or a URL). |
| `member-request-agent.yaml` | Foundry agent prompt | Instructions for the **Onboarding & Requests Officer** (Olivia) agent: read the email + attachments, extract the Member Case fields, run the NIGO checklist, flag scam / identity-takeover indicators for Financial Crime, and create/update the case via the `caldova_ops_data_mcp` MCP server. |
| `return-email-agent.yaml` | Foundry agent prompt | Mock agent that returns a fixed JSON envelope, used to simulate a successful acknowledgement / status email for the demo. |

## How it fits the demo

This workflow set is the **email front door** of the Caldova Client Operations office — the digital side of Olivia's ONBOARDING desk:

1. A **member or adviser** emails `requests@caldova.example` (fictional) — for example an adviser's application pack for a new Caldova Super account and super consolidation, a pension application, a financial hardship application, a rollover request, or a family member's notification of a death.
2. `monitor-email-processing` fires on the new mail and an orchestrator agent decides which sub-flow to run: new requests (or new information for an existing `REQ-YYYYMMDD-XXXXXX` case) go to `member-request-processing`; acknowledgements and outbound status emails go to `return-email-processing`.
3. `member-request-processing` invokes the **Onboarding & Requests Officer** Foundry agent (`member-request-agent`). It reads the attachments through `document-int-mcp`, extracts the Member Case fields, runs the NIGO (not in good order) checklist — ID, TFN, signatures and witnesses, adviser fee consent (s99FA), nominations, investment selections, insurance elections — and flags scam / identity-takeover indicators (recent change of contact details, pressure to act fast, rollover to a new SMSF) for Financial Crime. It then uses the `caldova_ops_data_mcp` tools to look up the member and account and create or update the case, returning a JSON envelope (`case_number`, `member_number`, `request_type`, `priority`, `nigo_checklist`, `financial_crime_flags`, `route_to`, `processed_status`, `processing_note`, …).
4. Every step is appended to a per-run JSON log (`member_request_<timestamp>.json` or `return_email_<timestamp>.json`) in the `LH_Operations` Fabric Lakehouse for observability and audit (e.g. for the Team Leader's queue and SLA dashboard).
5. If the agent cannot complete the request (`processed_status=false`), the **Tool_HIL** branch posts an actionable card in Teams to the **Client Operations Team Leader** for manual review, and the reviewer's name, comments and time are logged back into the same Fabric file.

This gives the demo a realistic "member requests don't disappear into a chatbot — every email becomes a tracked, auditable Member Case the team can pick up" story. The agent captures, checks and routes; eligibility decisions, holds on suspected fraud and payments stay with the specialist teams and their human approvers.

## External resources referenced (to be provisioned)

The workflow definitions reference the following resources by name. Values that are demo-environment specific (subscription id, tenant) are kept as placeholders and need to be substituted at deploy time:

- **Foundry project** — `https://aif-cs.services.ai.azure.com/api/projects/aif-cs-project`
- **User-assigned managed identity** — `/subscriptions/<sub>/resourceGroups/rg-caldova-super/providers/Microsoft.ManagedIdentity/userAssignedIdentities/caldova-ops-logic-uid` (granted access to Foundry, OneLake, and Blob storage). `return-email-processing` calls Foundry with the Logic App's system-assigned identity, so grant that identity Foundry access too.
- **Fabric Lakehouse** — workspace `Caldova_Wealth_Demo`, lakehouse `LH_Operations.Lakehouse`
- **Blob container** — `email-attachment` on the Logic App's storage account
- **Mailboxes (fictional)** — `requests@caldova.example` (operations inbox watched through `conn-office365`) and `client-ops-team-leader@caldova.example` (Teams recipient of the HIL card)
- **MCP server (operations data)** — `caldova_ops_data_mcp` at `https://app-cs-backend.azurewebsites.net/api/mcp` (Foundry project connection `caldova-ops-data-mcp`) exposing `lookup_member`, `lookup_account`, `lookup_case`, `create_case`, `update_case`, `search_cases`. This is separate from the specialist-agent MCP tools the backend serves at `/mcp` (`caldova-ops-mcp`).
- **MCP server (document intelligence)** — `https://logic-dev.azurewebsites.net/api/mcpservers/document-int-mcp/mcp`
- **API connections** used by the workflows (must exist in the Logic App):
  - `conn-office365` — for the email trigger
  - `conn-teams` — for the human-in-the-loop card
  - `conn-azuread` — to resolve the responder identity
  - `conversionservice` / `conn-conversionservice` — html-to-text
  - `formrecognizer` — Document Intelligence (used by the Analyze workflow)
  - `agent` — Foundry agent model connection used by inline `Agent` actions
  - `AzureBlob` service provider — attachment upload / read

## Deploying

These files are workflow definitions only (no `host.json`, `connections.json`, or `parameters.json`). To run them, drop each `*.json` into a Logic App Standard project as `<workflow-name>/workflow.json` — the folder names must match the workflow names the files refer to (`member-request-processing`, `return-email-processing`, `fabric-file-log`, and `Analyze_Document_for_Prebuilt_or_Custom_models_v4_x_API` for the `document-int-mcp` tool) — define the connections listed above, and upload the two `*.yaml` agent prompts to the Foundry project as agents named `member-request-agent` and `return-email-agent`. `member-request-agent` is the email-channel counterpart of the backend's `onboarding-agent` (same Olivia role) and is kept as a separate Foundry agent so the two definitions don't overwrite each other.

## Provenance

Ported from `qkfang/tfn-processing/apps/logicapp-tfn` (commit `12d5673`) and adapted from the earlier insurance email-intake version of this demo (see git history; `member-request-agent.yaml` and `member-request-processing.json` were renamed from that version's files). The TFN-update domain logic was replaced with Caldova Wealth member-request logic (Member Case capture, NIGO checklist, financial crime flags); the Logic App orchestration, HIL pattern, and Fabric logging structure are preserved.
