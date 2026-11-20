# Mapping Operations Staff into Foundry Agents

> Part of **Wealth Team in a Day** — the AI operations office demo for **Caldova Wealth**.

## Core Design Idea

Each staff character at **Caldova Wealth** becomes a specialised **Microsoft Foundry** agent.

*Wealth Team in a Day* doesn't build one generic "super chatbot". It models a digital operations department, **Caldova Client Operations**, where every agent owns a specific part of the request lifecycle:

> **Request → Verify → Assess → Action → Confirm**

All agents read from and write to one shared object, the **Member Case**.

**How it's built**

- The agents are declarative Foundry agents created from code with `Azure.AI.Projects`.
- They share a `CaldovaAgent` base class, which wires up two grounding sources:
  - **Azure AI Search** over the `wealth_knowledge` index
  - **Bing**
- Agents that act on systems call **MCP tools** served by the backend at `/mcp` (server label `caldova-ops-mcp`).
- Every agent has its own page in the backend console at `/agents/{route id}`.

---

## Shared Member Case Object

All agents read from and write to a common case record. The example column shows George's pension case ([scenario 3](scenario-3-retirement-pension.md)).

| Field | Description | Example: `REQ-20261109-OPS003` |
|---|---|---|
| `case_number` | Case reference, `REQ-YYYYMMDD-XXXXXX` | `REQ-20261109-OPS003` |
| `member_number` | Account number: `CS-…` for super, `CP-…` for pension | `CS-1077881`, and the new pension `CP-3077881` |
| `client_name` | Member or client name | George Papadopoulos |
| `product` | Product and tier | Caldova Super (Select), moving to Caldova Pension |
| `request_type` | New account & consolidation · Rollover out to SMSF · Pension commencement · Financial hardship release · Death benefit claim | Pension commencement |
| `adviser` | Adviser, practice and adviser code | Marcus Tan, Bayside Financial Partners (ADV-20871) |
| `received_date` | Date the request arrived | 2026-11-09 |
| `priority` | Standard, High or Urgent, with a reason | High |
| `documents_received` | Forms, IDs, statements and certificates on the case | Pension application, SoA extract, transfer balance account history |
| `nigo_items` | Outstanding "not in good order" items | None |
| `eligibility_status` | Eligible, partially eligible or not eligible, with the recommendation | Eligible: approve |
| `cited_rules` | Titles of the rule documents relied on | Pension standards; Conditions of release & preservation; Tax on super benefits & PAYG withholding |
| `fincrime_risk_score` | Low, medium or high, with indicators | Not required (no indicators) |
| `transfer_status` | Rollover or transfer status and service-level clock | $1,250,000 internal transfer to `CP-3077881` on 16 Nov 2026; TBAR prepared |
| `payment_gross` / `payment_tax` / `payment_net` | Payment amounts | $6,500 / $0 / $6,500 a month from 15 Dec 2026 |
| `approvals` | Approvals requested and given | Pension commencement of $1m or more: approved by Theo in Microsoft Teams |
| `communications` | Letters, updates, SMS and calls | Welcome-to-retirement letter (George); confirmation (Marcus) |
| `assigned_agent` | Agent currently working the case | `payments-agent` |
| `next_action` | What happens next | Pay the first pension payment on 15 Dec 2026 |
| `human_approval_required` | Whether a person must sign off | `true` |

In the backend, the case header is the `CaseRecord` held by `CaseStore`, which has these fields:

`CaseNumber`, `SampleId`, `ClientName`, `ClientEmail`, `ClientPhone`, `MemberNumber`, `Product`, `RequestType`, `ReceivedDate`, `AdviserName`, `AdviserPractice`, `RequestSummary`, `Amount`, `PreferredContact`, `Priority`, `PriorityReason`, `CreatedAt`.

The store is seeded with the five scenario cases. The Onboarding demo creates new `REQ-…` numbers.

---

# Agent Mapping

## 1. Onboarding Agent

**Based on:** Onboarding & Requests Officer (Olivia)

**Foundry agent:** `onboarding-agent`

**Page:** `/agents/onboarding`

### Purpose

Capture every request accurately, check it is in good order, open the Member Case and route it.

### Inputs

- Inbound adviser or member email
- Application or request form and attachments: ID, SoA extract, fee consent, nominations, rollover details, death certificate
- Existing member records
- Contact details and preferences

### Tools

- Azure AI Search over `wealth_knowledge`: the Caldova Super & Pension PDS extract, the Caldova Wrap IDPS guide extract, and the case files
- Bing grounding
- Structured field extraction into the Member Case
- Backend `/onboarding/*` endpoints, which open the case in `CaseStore` and route it

### Outputs

- Member Case with every extracted field, with TFNs masked
- NIGO checklist, showing each item as passed, missing or warning
- Request type and priority, with a reason
- Vulnerable-member and sensitive-case flags
- Routing decision and next action
- Draft "what we still need" note

### Example Instruction

> You are the Onboarding Agent for Caldova Wealth, supporting Olivia, the Onboarding & Requests Officer. Read the inbound email and attachments, extract every field into the Member Case, run the NIGO checklist for this request type, classify the request, set a priority with a reason, and route the case. Mask TFNs. Flag vulnerable members and sensitive cases such as death notifications. Do not make eligibility decisions and never give financial advice.

### Human Approval

Usually not required, unless:

- A vulnerable member or sensitive case is detected
- Identity can't be verified
- The request may not come from the member or their authorised adviser
- The instructions conflict, for example the application and the SoA don't match

---

## 2. Benefits & Eligibility Agent

**Based on:** Benefits & Eligibility Assessor (Ben)

**Foundry agent:** `benefits-eligibility-agent`

**Page:** `/agents/benefits-eligibility`

### Purpose

Apply the PDS, trust deed and super law to the request, cite every rule, and recommend approve, partial or decline.

### Inputs

- The Member Case
- The member's date of birth, balance and account history, including prior releases and transfer balance account history
- The request type and amount
- The evidence: Services Australia letter, statutory declaration, BDBN, death certificate, SVS result, fee consent and SoA

### Tools

- Azure AI Search over `wealth_knowledge`, using these rule documents:
  - *Conditions of release & preservation*
  - *Financial hardship*
  - *Pension standards (minimum drawdown table, TBC, reversionary)*
  - *Trust-deed rules on death benefits & nominations*
  - *Tax on super benefits & PAYG withholding*
  - *Adviser fee consent (s99FA) & ongoing fee arrangements*
  - *SuperStream rollovers, insurance-loss warnings & SMSF verification*
  - *Caldova Super & Pension PDS extract*
- Product and rule document texts used for citations (`ProductDocuments`)
- Bing grounding

### Outputs

- Eligibility checklist, showing each rule, a pass, fail or warn result, and the cited clause
- Calculations: cap space, pro-rated minimums and payment limits
- Recommendation of approve, partial or decline, with reasoning
- List of missing information
- Plain-English explanation for Client Communications

### Example Instruction

> You are the Benefits & Eligibility Agent for Caldova Wealth, supporting Ben. Check the request against the PDS, trust deed and super law. For every rule, show pass, fail or warn, your working, and the title of the document you relied on. Recommend approve, partial or decline. Never invent figures or rules. Do not issue a final decision: declines and partial approvals need human approval.

### Human Approval

Required for:

- Declines and partial approvals
- Hardship releases
- Death benefit decisions
- Pension commencements of $1,000,000 or more
- Ambiguous rules or trust-deed interpretation

---

## 3. Investment Analyst Agent

**Based on:** Investment Analyst (Ivy), Investment Solutions

**Foundry agent:** `investment-analyst-agent`

**Page:** `/agents/investment-analyst`

### Purpose

Check that portfolios fit the plan, compare models with fees in dollars, build income strategies and plan redemptions.

### Inputs

- The Member Case: balance, product and request
- The risk profile and Statement of Advice extract
- Model portfolio fact sheets
- The Caldova fee schedule and the Caldova Managed Portfolios menu
- Income or payment requirements

### Tools

- MCP tools (`caldova-ops-mcp`):
  - `analyzeFactSheet(documentUrl)`
  - `compareModels(modelsJson, balance)`
  - `generateClientWorkbook(caseNumber, caseSummaryJson, modelsJson, recommendationsJson)`
- Azure AI Search over *Caldova Managed Portfolios menu* and *Caldova fee schedule*
- Mermaid chart output in the agent response

### Outputs

- Fit check against the risk profile and SoA
- Comparison table covering allocation, fees in dollars per year, returns and risk
- Income strategy (such as a cash bucket) or a redemption plan
- Excel workbook, downloadable from `/investments/download/{fileName}`, and a chart
- Notes for the adviser

### Example Instruction

> You are the Investment Analyst Agent for Caldova Wealth, supporting Ivy in Investment Solutions. Check that the selected model portfolio fits the client's risk profile and Statement of Advice. Use the fact sheets to compare models on fees in dollars per year, returns and risk. For pensions, build an income strategy; for payments, plan the redemption. Produce the client workbook. Never make a personal recommendation: present the facts and trade-offs for the adviser.

### Human Approval

Required before:

- Any investment switch that the member or their adviser hasn't instructed
- Sharing comparisons directly with a client (they go through the adviser)
- Redemption plans for death benefits and hardship releases

---

## 4. Financial Crime Agent

**Based on:** Financial Crime Investigator (Felix)

**Foundry agent:** `financial-crime-agent`

**Page:** `/agents/financial-crime`

### Purpose

Detect fraud, scams and identity takeover, support AML/CTF obligations, and recommend controls.

### Inputs

- The Member Case and request
- The account-activity log: contact-detail changes, devices, IP locations and MFA events
- Documents on the case: ID, bank statements, SMSF and ESA letters, death certificates
- The SMSF verification service (SVS) result
- Travel notices and case notes
- KYC, politically exposed person (PEP) and sanctions screening results

### Tools

- **Azure Content Understanding**, using a shared authenticity field schema: document type, issuer, holder name, document number, issue and expiry dates, tamper indicators, security features, and a consistency summary
- A deterministic checks layer that turns the extracted fields into a verdict: legit, suspicious or fake
- Azure AI Search over the *Financial-crime red flags & controls* guide and the case files
- Bing grounding
- Backend `/fincrime/*` endpoints, with sample documents listed in `wwwroot/fincrime/samples/manifest.json`

### Outputs

- An explainable risk score (low, medium or high) with its indicators
- The account-activity timeline
- A verdict for each document, with the checks behind it and the reasons
- Recommended actions: hold, lock online access, call back on the verified number, IDCARE referral
- A fact summary for an SMR, for a human decision

### Example Instruction

> You are the Financial Crime Agent for Caldova Wealth, supporting Felix. Review the account activity, documents and request for signs of fraud, scams, identity takeover or AML/CTF risk. Explain every risk indicator in plain language and link it to a known pattern. Recommend controls such as a hold, or a call-back on the verified number on file. Never accuse the member, who may be the victim. Decisions to block a request or lodge an SMR belong to people.

### Human Approval

Always required before:

- Blocking a request on financial-crime grounds
- Lodging an SMR with AUSTRAC
- Contacting a suspected fraud victim
- Closing an alert as a false positive

### Document authenticity (Try it out)

The demo on `/agents/financial-crime` checks each document attached to a case:

1. **Scan.** Each document goes through Azure Content Understanding with the shared authenticity schema.
2. **Verdict.** A small deterministic rules layer gives it a verdict of *legit*, *suspicious* or *fake*.
3. **Findings.** The demo lists every check performed and the reasons any check failed.
4. **Risk narrative.** The findings feed into Felix's risk narrative, so document red flags are cited by document number.

The sample documents come in genuine and tampered pairs: a driver licence, a passport, a bank statement, a death certificate, and an SMSF/ESA letter. Every sample is visibly marked **"SPECIMEN — DEMO ONLY"**. See [`src/backend/README.md`](../src/backend/README.md) for the full flow and endpoint list.

---

## 5. Transfers & Rollovers Agent

**Based on:** Transfers & Rollovers Coordinator (Rory)

**Foundry agent:** `transfers-rollovers-agent`

**Page:** `/agents/transfers-rollovers`

### Purpose

Move money between Caldova and other super funds, SMSFs and the ATO, correctly and within service levels.

### Inputs

- The Member Case and its eligibility outcome
- External fund details: name, USI and member number
- SMSF details: ABN, ESA and bank details
- Any death or TPD cover held in the outgoing fund
- Rollover benefit statements

### Tools

- MCP tools (`caldova-ops-mcp`):
  - `lookupFunds(query)`
  - `verifySmsf(abn, memberName, bsb, accountName, esa)`
  - `generateTransferRequestPdf(...)`, with the PDF served from `/transfers/request/{id}.pdf`
- Azure AI Search over *SuperStream rollovers, insurance-loss warnings & SMSF verification*
- Bing grounding

### Outputs

- Counterparty list with the status of each
- Lost-cover warnings
- SMSF verification result
- Transfer request PDF
- Service-level tracker and chasers
- Whether the rollover was dispatched or held, and why

### Example Instruction

> You are the Transfers & Rollovers Agent for Caldova Wealth, supporting Rory. Identify every counterparty and look up external funds by USI. Warn when a rollover would end death or TPD cover. Verify any SMSF through the SMSF verification service before a rollover. Generate the transfer request and track the 3-business-day service level. Hold any rollover that fails verification and explain why. Never release a held rollover without human approval.

### Human Approval

Required for:

- Releasing a rollover held on financial-crime grounds
- Going ahead with a rollover that ends cover, without written confirmation
- Any SMSF rollover where verification fails (it stays blocked)
- Cancelling a rollover request with a counterparty

---

## 6. Payments Agent

**Based on:** Payments Officer (Penny)

**Foundry agent:** `payments-agent`

**Page:** `/agents/payments`

### Purpose

Calculate and release payments correctly, and only after the right approval.

### Inputs

- The approved Member Case
- The gross amount and payment type: lump sum, pension payment, death benefit, hardship payment or rollover
- The member's age and tax status, and the tax components
- Payee and bank details
- The authority and escalation matrix

### Tools

- MCP tools (`caldova-ops-mcp`):
  - `payments_validatePayee`
  - `payments_checkCaseApproval`
  - `payments_calculateBenefit`: tax components, PAYG withholding and net amount
  - `payments_checkAuthorityLimit`
  - `payments_requestApproval`: posts a Microsoft Teams adaptive card through `teams_sendApprovalCard`
  - `payments_getApprovalStatus`
  - `payments_releasePayment`: refuses unless the payment is approved
- Azure AI Search over *Tax on super benefits & PAYG withholding* and the authority and escalation matrix

### Outputs

- Benefit calculation: gross, tax-free, taxable, PAYG withheld and net
- Payee validation result
- Authority-limit check
- Teams approval request and its status
- Release confirmation and audit trail

### Example Instruction

> You are the Payments Agent for Caldova Wealth, supporting Penny. Validate the payee and confirm the case decision is approved. Calculate the tax-free and taxable components, PAYG withholding and net amount, and check authority limits. When approval is needed, request it through Microsoft Teams and wait. Show the calculation clearly. Never release a payment without the required approval.

### Human Approval

Required for:

- Single payments of $250,000 or more
- Any death benefit
- Pension commencements of $1,000,000 or more
- Hardship releases
- Payee mismatches and new payees
- Manual overrides

---

## 7. Client Communications Agent

**Based on:** Client Communications Specialist (Cara)

**Foundry agent:** `client-communications-agent`

**Page:** `/agents/client-communications`

### Purpose

Draft clear, empathetic and compliant communications for members, clients, families and advisers.

### Inputs

- The Member Case and decision
- The eligibility outcome and cited rules
- Payment details
- The audience (member, adviser or family) and the situation (celebration, hardship, scam or bereavement)
- Contact preferences

### Tools

- The drafting service (`ClientCommunicationsDrafter`)
- Azure AI Search over the case files and rule documents, for facts and required disclosures
- A compliance check: no personal advice, the required disclosures, and IDR and AFCA rights
- Bing grounding

### Outputs

- Case summary
- Member letter
- Adviser update
- SMS
- Call script

### Example Instruction

> You are the Client Communications Agent for Caldova Wealth, supporting Cara. Explain the case outcome in clear, warm, plain English for the member, and in concise professional terms for the adviser. Match the tone to the situation. Include the required disclosures and complaint rights. Never give personal financial advice, invent facts, or promise outcomes that haven't been approved.

### Human Approval

Required for:

- Declines and partial approvals
- Complaint responses
- Any communication to a fraud victim or a bereaved family
- Letters to members in hardship

---

## 7a. Client Communications Voice Agent

**Based on:** Client Communications Specialist (Cara)

**Foundry agent:** `client-communications-voice-agent` (class `ClientCommunicationsVoiceAgent`, factory key `communications-voice`)

**Page:** the **Voice chat with Cara** panel on `/agents/client-communications`

### Purpose

Let members and advisers talk to Cara by voice about a case.

### Inputs

- The selected Member Case
- The caller's spoken questions

### Tools

- **Voice Live**, for real-time speech in and out, through the backend's Voice Live proxy (`CommunicationsVoiceLiveProxy`)
- The same `wealth_knowledge` grounding as the other agents

### Outputs

- Spoken answers about case status, timing and next steps
- An offer of a call-back from a person when needed

### Example Instruction

> You are Cara's voice assistant at Caldova Wealth. Speak warmly and simply. Explain case status and next steps using only facts from the Member Case. Don't make decisions, give financial advice, or confirm anything that hasn't been approved. For complaints, vulnerable callers or identity concerns, offer a call-back from a person.

### Human Approval

Not required to explain status that has already been approved. Hand over to a person for:

- complaints
- hardship
- bereavement
- identity verification

---

## 8. Team Leader Agent

**Based on:** Client Operations Team Leader (Theo)

**Foundry agent:** `team-leader-agent`

**Page:** `/agents/team-leader`

### Purpose

Run the floor: monitor work, service levels and IDR clocks, prepare approvals, and orchestrate the team on a case.

### Inputs

- All open cases
- Agent outputs and recommendations
- Service-level, IDR and SMR clock status
- Approval requests
- Complaints and escalations
- The authority and escalation matrix

### Tools

- Azure AI Search over the *Authority & escalation matrix (including IDR timeframes)* and the case files
- The floor dashboard, through `/team-leader/*`
- A multi-agent group chat (`TeamLeaderGroupChatApi`), in which Theo's agent coordinates the seven specialist agents
- Bing grounding

### Outputs

- Floor dashboard summary
- Alerts for service levels, IDR clocks and SMR deadlines
- Approval briefs and recommendations
- Quality findings
- Group chat transcript with a consolidated case plan

### Example Instruction

> You are the Team Leader Agent for Caldova Wealth, supporting Theo. Monitor the operations floor and identify cases at risk of missing service levels, IDR timeframes or SMR deadlines. Summarise the items that need approval and recommend priorities. In group chat, coordinate the specialist agents on one case and produce a consolidated plan. Never approve on Theo's behalf and never override authority limits.

### Human Approval

Theo, the human team leader, approves:

- Declines and partial approvals
- Financial-crime blocks and SMR referrals
- Payments above authority limits, and every death benefit
- Pension commencements of $1,000,000 or more
- Hardship releases
- Complaint responses
- Communications to fraud victims and bereaved families

---

# Suggested Multi-Agent Workflow

## Workflow: Request to Confirmation

1. `onboarding-agent` (**Request**)
   - Captures the request and runs the NIGO checklist.
   - Opens the Member Case and routes it.

2. `financial-crime-agent` (**Verify**)
   - Screens every new client (KYC and AML).
   - Runs whenever risk indicators appear.
   - Produces a risk summary and recommended controls.

3. `benefits-eligibility-agent` (**Assess**)
   - Checks the rules.
   - Recommends approve, partial or decline, with citations.

4. `investment-analyst-agent` (**Assess**)
   - Checks portfolio fit and compares fees in dollars.
   - Plans income or redemptions.

5. `transfers-rollovers-agent` (**Action**)
   - Moves money to and from other funds, SMSFs and the ATO.
   - Holds anything that fails verification.

6. `payments-agent` (**Action**)
   - Calculates the payment and requests approval in Microsoft Teams.
   - Releases the payment only after approval.

7. `client-communications-agent` and `client-communications-voice-agent` (**Confirm**)
   - Keep the member and adviser informed throughout.
   - Draft the final letters.

8. `team-leader-agent` (all stages)
   - Monitors the workflow and takes approvals.
   - Orchestrates the group chat on complex cases.

---

# Recommended Agent Architecture

## Option A: One Agent per Department

Use this when the demo needs to match the lakehouse, where every person has an agent of their own. This is how the demo is built: each department page engages its own agent.

| Department | Foundry agent id |
|---|---|
| Onboarding & Requests | `onboarding-agent` |
| Benefits & Eligibility | `benefits-eligibility-agent` |
| Investment Solutions | `investment-analyst-agent` |
| Financial Crime | `financial-crime-agent` |
| Transfers & Rollovers | `transfers-rollovers-agent` |
| Payments | `payments-agent` |
| Client Communications | `client-communications-agent`, plus the voice agent `client-communications-voice-agent` |
| Team Leader Office | `team-leader-agent` |

Best for:

- Demo storytelling
- A visual department layout
- Clear responsibilities
- Agent-to-agent handoffs

---

## Option B: Orchestrator plus Specialist Agents

Use this when the demo needs stronger workflow control.

- **Orchestrator:** `team-leader-agent` decides which specialist works next and when a human approval gate is reached.
- **Specialists:** `onboarding-agent`, `benefits-eligibility-agent`, `investment-analyst-agent`, `financial-crime-agent`, `transfers-rollovers-agent`, `payments-agent` and `client-communications-agent`.

Theo's **group chat** on the Team Leader page shows this pattern on a single case.

Best for:

- A more realistic enterprise workflow
- Complex branching
- Human approval gates
- Easier observability

---

# Suggested Foundry Objects

| Object | Used by | Notes |
|---|---|---|
| **Member Case** | All agents | The central operational object |
| **Member / Client** | Onboarding, Communications | Identity, contact preferences, vulnerability flags |
| **Adviser** | Onboarding, Benefits & Eligibility, Communications | Practice, adviser code, fee consent, SoA |
| **Account** | All agents | Member number, product, tier, balance and cash account |
| **Document** | Onboarding, Financial Crime, Benefits & Eligibility | Forms, IDs, statements, certificates, nominations |
| **Rule** | Benefits & Eligibility, Payments | PDS, trust deed and super law documents in `wealth_knowledge` |
| **Model Portfolio** | Investment Analyst | Fact sheets, allocation and fees |
| **Counterparty** | Transfers & Rollovers | Other super funds, SMSFs, other platforms, the ATO |
| **Payment** | Payments | Components, withholding and payee |
| **Approval** | Payments, Team Leader | Microsoft Teams adaptive cards and decisions |
| **Communication** | Client Communications | Letters, adviser updates, SMS, calls |
| **Task** | Team Leader, orchestration | Next actions and owners |
| **Escalation / Complaint** | Team Leader | IDR clocks (30, 45 or 90 days) and AFCA |

---

# Suggested Agent Handoff Rules

## Onboarding to Benefits & Eligibility

Trigger when:

- The Member Case is opened
- The request type is identified
- The NIGO checklist is complete, or only non-blocking items remain

## Onboarding to Financial Crime

Trigger when:

- A new client or account is opened (KYC and AML screening)
- Contact or bank details were changed recently
- A rollover to an SMSF is requested
- A death notification or a third-party request arrives and documents need checking

## Benefits & Eligibility to Financial Crime

Trigger when:

- SMSF verification fails
- Documents or evidence are inconsistent
- A failed hardship application is followed by an SMSF rollover request

## Benefits & Eligibility to Investment Solutions

Trigger when:

- A pension is starting and needs an income strategy
- A payment requires investments to be sold
- A new account's investment selection needs a fit check

## Benefits & Eligibility to Transfers & Rollovers

Trigger when:

- A rollover in or out is eligible
- A transfer from accumulation to pension is approved

## Transfers & Rollovers or Investment Solutions to Payments

Trigger when:

- Rollover money arrives and needs investing
- A redemption completes and cash is available
- An outbound payment or rollover is ready to release

## Payments to Client Communications

Trigger when:

- A payment is released, held or cancelled
- A decision is approved and needs explaining

## Any Agent to Team Leader

Trigger when:

- Human approval is required
- A vulnerable member or a sensitive case is identified
- A complaint is received, which starts the IDR clock
- A service level or SMR deadline is at risk
- A financial-crime concern is raised
- A rule exception or trust-deed question arises

---

# Human-in-the-Loop Design

Super and wealth operations need repeatable orchestration with firm approval gates. Agents recommend, draft, summarise, check and calculate. People approve, override and finalise.

Human approval is **always** required for:

- Declines and partial approvals
- Blocking a request on financial-crime grounds
- Suspicious matter reports (SMRs)
- A single payment of $250,000 or more, and any death benefit
- Pension commencements of $1,000,000 or more
- Hardship releases (vulnerable members)
- Complaint responses
- Any communication to a fraud victim or a bereaved family

How the demo makes the human role visible:

- **Payments** won't release money until a person approves. `payments_requestApproval` posts a Microsoft Teams adaptive card, and `payments_releasePayment` refuses until the card is approved.
- **Team Leader** turns every approval into a one-page brief. The group chat ends with a plan for Theo to sign off.
- **Every engage step** shows five tabs: Agent Narrative, Reference, Agent Prompt & Tools, Agent Input and Raw Output. Viewers can see what the agent was told, which tools it used, what it cited and what it produced.

---

# Demo-Friendly Interaction Model

This walk-through follows George's retirement ([scenario 3](scenario-3-retirement-pension.md)). It is the golden path in [agent-demo.md](agent-demo.md).

## Step 1: The adviser submits a request

Marcus Tan emails Caldova on 9 Nov 2026:

> George Papadopoulos (CS-1077881) would like to start a Caldova Pension with $1,250,000, paying $78,000 a year monthly, with his wife Helen as reversionary beneficiary. Application attached.

The `onboarding-agent` extracts the fields, finds no NIGO items, and opens `REQ-20261109-OPS003`.

## Step 2: The eligibility check

The `benefits-eligibility-agent` says:

> George is 66, so his super is unrestricted. A $1,250,000 credit is within the $2.1 million transfer balance cap and leaves $850,000 of cap space. His minimum is 5%, or $62,500 a year, pro-rated to $38,870 for 2026-27 (227 of 365 days from 16 November). $78,000 a year is above the minimum, and Helen can be the reversionary beneficiary. I recommend approval.

## Step 3: The income strategy

The `investment-analyst-agent` says:

> I suggest a cash bucket of two years' payments ($156,000) in the cash account and term deposits, with the remaining $1,094,000 in the Balanced model. The workbook compares three strategies for Marcus. The bucket covers 24 monthly payments of $6,500 without selling growth assets.

## Step 4: The internal transfer

The `transfers-rollovers-agent` says:

> The internal transfer of $1,250,000 from CS-1077881 to the new pension account CP-3077881 is scheduled for 16 Nov 2026. $34,600 stays in accumulation. The transfer balance account report (TBAR) for the ATO is ready.

## Step 5: Approval and payments

The `payments-agent` says:

> This pension commencement of $1,250,000 is at or above the $1,000,000 limit, so I've sent Theo a Teams approval card.

Theo approves in Microsoft Teams. The pension commences on 16 Nov 2026. Payments of $6,500 a month start on 15 Dec 2026. They are tax-free because George is over 60, so PAYG withholding is nil.

## Step 6: Client communication

The `client-communications-agent` drafts:

> Congratulations on your retirement, George. Your Caldova Pension has started. From 15 December you'll receive $6,500 each month, tax-free, and Helen is set up to continue receiving your pension if anything happens to you. The legal minimum for this financial year is $38,870, and your payments are well above it.

A confirmation goes to Marcus. If George calls, Cara's voice agent can answer questions such as "When's my first payment?". The answer is Tuesday 15 December: $6,500, tax-free.

## Step 7: The team leader dashboard

The `team-leader-agent` shows the floor for the five demo cases:

| Case | Member | Status |
|---|---|---|
| `REQ-20261103-OPS001` | Priya Natarajan | ✅ Account opened. Waiting for the BDBN re-sign and the insurance confirmation from the adviser |
| `REQ-20261106-OPS002` | Grace Williams | 🛡️ Blocked. SMR referral approved, and no funds left the account |
| `REQ-20261109-OPS003` | George Papadopoulos | ✅ Pension started. Commencement approved in Teams; first payment 15 Dec 2026 |
| `REQ-20261111-OPS004` | Tom Bradley | 🟡 Partially approved. $7,932 net paid on 13 Nov 2026 |
| `REQ-20261113-OPS005` | Robert Chen (for Mei Chen) | ✅ Benefit paid to Robert and Lily after Teams approval |

---

# UI Mapping to the Lakehouse

In the Lakehouse storybook ([storybook.md](storybook.md)), every person's card on Level 2 and every agent's, assistant's and voice agent's card on Level 1 has an **Open the agent page ↗** link that opens that agent's page (`/agents/{route id}`) in a new tab. On Level 1 it sits right under the name.

| Agent page | Shows |
|---|---|
| Onboarding (Olivia) | New requests, the extracted Member Case and the NIGO checklist |
| Benefits & Eligibility (Ben) | The eligibility checklist with cited rules, and the recommendation |
| Investment Analyst (Ivy) | Model comparisons, fees in dollars, income strategies and the workbook |
| Financial Crime (Felix) | Risk indicators, the account-activity timeline and document verdicts |
| Transfers & Rollovers (Rory) | Counterparties, rollovers in flight, service-level timers and lost-cover warnings |
| Payments (Penny) | The benefit calculation and the Teams approval status |
| Client Communications (Cara) | The message drafts and the voice chat with Cara |
| Team Leader (Theo) | The floor dashboard, service-level and IDR clocks, approvals, and the multi-agent group chat on one case |

Elsewhere in the house:

- **The front desk on the dock** is where requests come in. Amelia's card links to the onboarding scenario (`/scenarios/new-client-onboarding`).
- **The engine room** shows what the agents run on. Foundry IQ holds the `wealth_knowledge` index: the records and rules the agents cite.

---

# Best Demo Framing

The strongest framing is:

> Each staff member in Caldova Client Operations becomes a Foundry agent with a specialised role, governed tools, cited rules and human approval points. Together, they operate as a coordinated digital operations team, and people stay in charge of every decision that matters.

This makes the demo feel enterprise-ready. It shows AI supporting super and wealth operations professionals rather than replacing them, and the agents never give financial advice.
