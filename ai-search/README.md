# Azure AI Search — Wealth Team in a Day

This folder provisions the Azure AI Search indexes behind the **Wealth Team in
a Day** demo for **Caldova Wealth** and seeds them with fictional knowledge, so
every staff-character agent — Onboarding, Benefits & Eligibility, Investment
Analyst, Financial Crime, Transfers & Rollovers, Payments, Client
Communications and Team Leader — can ground its answers in Caldova's product
rules and member case files and **cite each document by its title**.

The pattern mirrors the
[quant-agent ai-search](https://github.com/qkfang/quant-agent/tree/main/ai-search)
reference: each `CaldovaAgent` is wired up with the Foundry **Azure AI
Search** tool pointing at the project-level connection created in
`bicep/foundry.bicep`, querying the `wealth_knowledge` index.

## Indexes

| Index | Contents | Used by |
| --- | --- | --- |
| `wealth_knowledge` | Member case files and operational guides from `wealth_knowledge/`, **plus a copy of every product & rule document** from `wealth_rules/`, projected onto the knowledge schema. | Every Foundry agent (the index named in `AZURE_AI_SEARCH_INDEX_NAME`). |
| `wealth_rules` | The product & rule documents from `wealth_rules/` in their structured form (summary / rules / limits / evidence required). | Structured lookups. The agents don't query it directly. |

The agents' search tool is bound to a single index, so both scripts upload
each rules document twice: unchanged into `wealth_rules`, and into
`wealth_knowledge` with the same `id` and `title`, `category` = `Product &
Rules`, `requestType` = `All`, `severity` = `reference`, `department` = the
document owner, and a `content` field built from summary + rules + limits +
evidence required + product/version/owner.

Both indexes have a semantic configuration and a vector field (with an Azure
OpenAI vectorizer), so they are ready for hybrid retrieval. The agents use the
simple keyword query path by default (`AzureAISearchQueryType.Simple`).

## Documents

All people, advice practices, super funds, account numbers and figures are
fictional. Rules and thresholds are for FY2026-27 (from 1 July 2026).
Managed portfolio performance figures are illustrative.

### `wealth_rules/` — product & rule documents (11)

| File | Title |
| --- | --- |
| `pds-caldova-super-and-pension.json` | Caldova Super & Pension — Product Disclosure Statement (PDS extract) |
| `idps-guide-caldova-wrap.json` | Caldova Wrap — IDPS Guide (extract) |
| `trust-deed-death-benefits-and-nominations.json` | Caldova Superannuation Master Fund Trust Deed — Death benefits & nominations (rules extract) |
| `rules-conditions-of-release-and-preservation.json` | Super law rule summary — Conditions of release & preservation (FY2026-27) |
| `rules-financial-hardship-release.json` | Super law rule summary — Severe financial hardship early release (Caldova hardship policy) |
| `rules-pension-standards-and-tbc.json` | Super law rule summary — Pension standards, minimum drawdowns & transfer balance cap (FY2026-27) |
| `rules-tax-on-super-benefits-and-withholding.json` | Super law rule summary — Tax on super benefits & PAYG withholding (FY2026-27) |
| `rules-adviser-fees-s99fa-and-ongoing-fee-arrangements.json` | Super law rule summary — Adviser fees from super (SIS s99FA) & ongoing fee arrangements |
| `rules-superstream-rollovers-and-smsf-verification.json` | Super law rule summary — SuperStream rollovers, insurance-loss warnings & SMSF verification (SVS) |
| `fee-schedule-caldova-super.json` | Caldova Super & Pension — Fee schedule 2026-27 |
| `menu-caldova-managed-portfolios.json` | Caldova Managed Portfolios — Investment menu & model summary (illustrative) |

### `wealth_knowledge/` — case files & operational guides (23)

Case files are named `case-<case number>-<document>.json`, for example
`case-req-20261111-ops004-hardship-application.json`.

| Scenario | Case | Documents |
| --- | --- | --- |
| 1 · New client onboarding & consolidation — Priya Natarajan | `REQ-20261103-OPS001` (`CS-2049817`) | application pack, Statement of Advice extract, external fund statements, BDBN as lodged, adviser fee consent |
| 2 · Identity takeover & SMSF rollover blocked — Grace Williams | `REQ-20261106-OPS002` (`CS-1058220`) | account activity log, travel notice & verified contacts, rollover request & ID review, SVS result |
| 3 · Retirement: account-based pension — George Papadopoulos | `REQ-20261109-OPS003` (`CS-1077881` → `CP-3077881`) | pension application, transfer balance account, minimum drawdown calculation |
| 4 · Financial hardship early release — Tom Bradley | `REQ-20261111-OPS004` (`CS-1030412`) | hardship application, Services Australia letter, payment calculation |
| 5 · Death benefit under a binding nomination — Robert Chen (for Mei Chen) | `REQ-20261113-OPS005` (`CP-3019042`) | death notification, BDBN, death certificate & claimant IDs, benefit calculation |

Operational guides: `guide-financial-crime-red-flags-and-controls.json`,
`matrix-authority-approvals-and-escalation.json` (approvals, payment limits,
service levels, IDR clocks), `directory-external-super-funds.json` and
`guide-nigo-checklist.json`.

## Document schemas

Each file holds one JSON object, and its `id` must equal the file name without
`.json`. `contentVector` and `summaryVector` are index-only vector fields.

`wealth_knowledge`:

| Field | Notes |
| --- | --- |
| `id` | Document key. |
| `title` | Human-readable title — what the agents cite. |
| `category` | `Case File`, `Case Evidence`, `Operations Guide` or `Directory` (`Product & Rules` for projected rules documents). |
| `requestType` | `New account & consolidation`, `Rollover out to SMSF`, `Pension commencement`, `Financial hardship release`, `Death benefit claim`, or `All`. |
| `caseNumber` | e.g. `REQ-20261111-OPS004`; empty for guides. |
| `memberNumber` | e.g. `CS-1030412` or `CP-3019042`; empty for guides. |
| `content` | Body text. |
| `severity` | `low`, `medium` or `high` (`reference` for projected rules documents). |
| `department` | Owning department, e.g. `Financial Crime`. |
| `tags` | Keywords. |
| `lastUpdated` | ISO 8601 date-time in UTC. |

`wealth_rules`:

| Field | Notes |
| --- | --- |
| `id` | Document key. |
| `title` | Document title — what the agents cite. |
| `product` | e.g. `Caldova Super & Pension`. |
| `version` | Version and effective date. |
| `summary` | What the document covers. |
| `rules` | The rules, clauses, fees or model details. |
| `limits` | Limits and exceptions — what the rule does not allow. |
| `evidenceRequired` | Evidence the rule needs (list). |
| `owner` | Owning team. |
| `tags`, `lastUpdated` | As above. |

## Files

| File | What it does |
| --- | --- |
| `setup-index.ps1` | Creates / updates both indexes and uploads every document (including the rules copy in `wealth_knowledge`). Run once after `bicep/main.bicep` has provisioned the search service. |
| `ingest-documents.ps1` | Re-uploads the documents without recreating the index schemas. Validates each file first (JSON parse + required fields) and prints a per-index summary. Use after editing or adding a JSON file. It also deletes the case files filed under the scenario cases' old numbers (`REQ-…-DEMOnn`, now `REQ-…-OPSnnn`), so an index loaded before the renumbering doesn't keep both. |
| `wealth_knowledge/*.json` | Member case files and operational guides. |
| `wealth_rules/*.json` | Product & rule documents. |

## Prerequisites

* `az login` with an account that has the **Search Index Data Contributor**
  role on the search service, to upload documents (the `principals` array
  passed to `bicep/main.bicep` grants this). `setup-index.ps1` also creates
  index definitions, which needs **Search Service Contributor**.
* PowerShell 7+ (`pwsh`).
* Check the variables at the top of each script: `$SearchServiceName` must
  match the `aiSearchName` output of `main.bicep` (`search-<baseName>`, e.g.
  `search-caldovacs`), and `$FoundryEndpoint` in `setup-index.ps1` must match the
  `foundryAccountEndpoint` output.
* Index fields can't be removed or renamed in place. If an index with these
  names already exists with a different schema, delete it before running
  `setup-index.ps1`.

## Running

```pwsh
cd ai-search
./setup-index.ps1       # first run: create wealth_knowledge + wealth_rules and upload docs
./ingest-documents.ps1  # later runs: re-upload docs only
```

Once the indexes are populated, the backend Web App reads
`AZURE_AI_SEARCH_CONNECTION_ID` and `AZURE_AI_SEARCH_INDEX_NAME` (set it to
`wealth_knowledge`) from app settings (set by `bicep/appservice.bicep`) and
wires the connection into every Foundry agent created by
`CaldovaAgentFactory`.
