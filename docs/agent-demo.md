# Presenter Click-Path

> Part of **Wealth Team in a Day** — the AI operations office demo for **Caldova Wealth**.

This is a practical guide to running the demo live. It covers a **10-minute golden path**, a case cheat sheet, and a click path for each of the eight agent pages. For the full stories, see the `scenario-*.md` files. For the industry context and presenter notes, see [background.md](background.md).

---

## Before You Start

| Check | Detail |
|---|---|
| Backend running | <http://localhost:5212>, or the deployed `app-caldovacs-backend` |
| Frontend running | <http://localhost:5173>, or the deployed `app-caldovacs-frontend` |
| Azure | Signed in (`az login`) with access to the Foundry project (`aif-caldovacs`), and the `wealth_knowledge` index built |
| Microsoft Teams | Open in the channel where Penny's approval cards arrive |
| Microphone | Browser microphone permission allowed, for Cara's voice chat |
| Tabs | One browser tab on the Lakehouse storybook (frontend), one on the backend console |

Every **engage** step on an agent page shows five tabs:

> **Agent Narrative · Reference · Agent Prompt & Tools · Agent Input · Raw Output**

After each run, open **Reference** to show the citations from `wealth_knowledge`, and **Agent Prompt & Tools** to show the instructions and MCP tool calls. That is where the Foundry story is.

---

## Case Cheat Sheet

The table includes the backend's scenario pages (`/scenarios/{id}`). Each lists the case's steps, and every step's **Run this step** link opens that agent's page for the case.

| # | Case | Member | Onboarding sample | Scenario page | Best for showing |
|---|---|---|---|---|---|
| 1 | `REQ-20261103-OPS001` | Priya Natarajan | `onboarding-priya` | `/scenarios/new-client-onboarding` | NIGO, the BDBN with one witness, the insurance-loss warning, fees in dollars |
| 2 | `REQ-20261106-OPS002` | Grace Williams | `rollover-grace` | `/scenarios/account-takeover-blocked` | Financial crime, Content Understanding, SMSF verification |
| 3 | `REQ-20261109-OPS003` | George Papadopoulos | `pension-george` | `/scenarios/retirement-pension` | Rules with real numbers, the income strategy, Teams approval |
| 4 | `REQ-20261111-OPS004` | Tom Bradley | `hardship-tom` | `/scenarios/financial-hardship` | Partial approval, the tax calculation, a kind letter |
| 5 | `REQ-20261113-OPS005` | Robert Chen | `death-benefit-robert` | `/scenarios/death-benefit` | BDBN validity, death benefit tax, gentle communication |

---

## The 10-Minute Golden Path

This path follows **George's retirement** (scenario 3) from the front desk to the team leader, then finishes with **Grace** (scenario 2) for financial crime.

| Time | Where | Click | What to show | What to say |
|---|---|---|---|---|
| 0:00–1:00 | **The Lakehouse** (frontend) | Press **End** for the finale (George is the default member). Use **x2** or **Next step** to keep to time | George arrives by water taxi and signs at the front desk, where Amelia links him with the Onboarding Agent. The house pulls apart and his request travels person → agent → engine room and back up at each step: Olivia → Ben → Ivy → Rory → Penny → Cara. The result rises to Maya's idea on Level 3 | "Requests come in at the front desk. People make the decisions, with an AI agent under every desk and one engine room underneath." |
| 1:00–2:00 | **Onboarding Agent** | Pick `pension-george` (Marcus Tan's email and pension application) → **Engage agent** | The auto-filled Member Case form, the NIGO checklist with nothing missing, the priority, and a case opened and routed | "Olivia's agent reads the adviser's email and form, so Olivia checks the work instead of keying it in." |
| 2:00–3:00 | **Benefits & Eligibility** | Pick `REQ-20261109-OPS003` → review → **Engage** | Age 65 condition of release ✓. TBC $2.1m with $850,000 left ✓. Minimum $62,500, pro-rated to $38,870 ✓. $78,000 requested ✓. Reversionary ✓. Recommendation: approve. Then open the **Reference** tab | "Every line cites the rule it relies on. There are no invented numbers." |
| 3:00–4:30 | **Investment Analyst** | `REQ-20261109-OPS003` → **Engage** → then ask in chat: "How long does the cash bucket last?" | A $156,000 cash bucket plus $1,094,000 in Balanced. The comparison table, Mermaid chart and Excel workbook. In **Agent Prompt & Tools**, the `analyzeFactSheet`, `compareModels` and `generateClientWorkbook` calls. The answer: 24 months of payments | "Ivy doesn't give advice. She gives Marcus the numbers, in dollars." |
| 4:30–6:00 | **Payments** | `REQ-20261109-OPS003` → confirm the inputs → **Engage** → approve the card in **Teams** → return to the page | The authority-limit check finds the $1,250,000 commencement is $1m or more. The adaptive card appears in Teams. After approval, the release goes through, with $6,500 a month, tax-free | "The agent can't release money on its own. Theo approves in Teams, where he already works." |
| 6:00–7:00 | **Client Communications** | `REQ-20261109-OPS003` → **Engage** → **Voice chat with Cara** → ask "When's my first pension payment?" | Cara's case summary. The welcome letter, the adviser update and the SMS. A spoken answer: 15 December, $6,500, tax-free | "Same facts, three audiences, and a voice when members want to talk." |
| 7:00–8:00 | **Team Leader** | `REQ-20261109-OPS003` → **Engage** → open **Group chat** | Theo orchestrates the seven specialists on one case and ends with a consolidated plan | "This isn't one chatbot. It's a team, with a team leader." |
| 8:00–10:00 | **Financial Crime** (Grace) | Optional: in the Lakehouse finale, pick **Grace**. Then go to the Financial Crime page → pick `REQ-20261106-OPS002` → scan documents → **Engage** | The tampered licence is flagged. The timeline runs from the details change to the Sydney login to the full-balance SMSF rollover. The SMSF verification mismatches and the risk is **HIGH**. The agent recommends a hold, a call-back on 0491 570 157 and an IDCARE referral. The SMR is a human decision | "$612,400 protected, and Grace is treated as the victim, not a suspect." |

The Onboarding demo creates a fresh `REQ-…` number. For the rest of the golden path, pick the seeded case `REQ-20261109-OPS003`.

---

## Agent-by-Agent Click Path

### 1. Onboarding Agent (Olivia) · `/agents/onboarding`

| | |
|---|---|
| **Try it out** | 1. Pick a sample inbound email and attached form. 2. **Engage agent**. 3. Review the auto-filled Member Case form, NIGO checklist and priority. 4. The case is opened (`REQ-…`) and routed |
| **Pick** | `onboarding-priya` (Hannah Lewis's application pack) for the best NIGO story. Use `pension-george` on the golden path |
| **Look for** | Fields pulled from the email and form. The NIGO items: a BDBN with only one witness, and Death & TPD cover in the Southern Cross account. A new case number |
| **Foundry on show** | A declarative agent (`Azure.AI.Projects`) doing structured extraction, with Azure AI Search grounding over `wealth_knowledge` |
| **Talking point** | "NIGO is where cash sits and advisers get chased. The agent gets it right the first time, and Olivia confirms." |

### 2. Benefits & Eligibility Agent (Ben) · `/agents/benefits-eligibility`

| | |
|---|---|
| **Try it out** | 1. Pick a case. 2. Review the case. 3. **Engage agent**. 4. See the eligibility checklist (each rule, a pass, fail or warn result, and the cited clause) and the recommendation (approve, partial or decline) |
| **Pick** | `REQ-20261111-OPS004` (Tom) for a **partial** approval: $15,000 requested against a $10,000 maximum. Use `REQ-20261109-OPS003` (George) for the pension numbers, or `REQ-20261113-OPS005` (Robert) for BDBN validity |
| **Look for** | Each rule with its cited document. The recommendation "partially approve $10,000 gross". The human-approval flag |
| **Foundry on show** | Azure AI Search grounding with citations, shown in the **Reference** tab |
| **Talking point** | "Ben's agent shows its working and cites the rule. Partial approvals still go to a person." |

### 3. Investment Analyst Agent (Ivy) · `/agents/investment-analyst`

| | |
|---|---|
| **Try it out** | 1. Pick a case. 2. Review. 3. **Engage agent**: the MCP tools turn fact sheets into a comparison table, a Mermaid chart and an Excel workbook. 4. Chat with the agent |
| **Pick** | `REQ-20261109-OPS003` (George) for the cash-bucket income strategy. Or `REQ-20261103-OPS001` (Priya) for Growth vs Balanced vs Index Balanced on $138,200. The expected dollar figures are in [scenario 1](scenario-1-new-client-onboarding.md) |
| **Look for** | Fees in dollars per year, the workbook download and the chart |
| **Foundry on show** | MCP tools `analyzeFactSheet`, `compareModels` and `generateClientWorkbook`, served by the backend (`caldova-ops-mcp`) |
| **Talking point** | "Fees in dollars, not just percentages. The advice stays with the adviser." |

### 4. Financial Crime Agent (Felix) · `/agents/financial-crime`

| | |
|---|---|
| **Try it out** | 1. Pick a case. 2. Review. 3. Scan the documents on the case (Content Understanding checks the ID documents, bank statement, SMSF letter and death certificate). 4. **Engage agent**. 5. See the risk summary and recommended actions |
| **Pick** | `REQ-20261106-OPS002` (Grace) for a tampered licence and an SMSF verification mismatch. For contrast, use `REQ-20261113-OPS005` (Robert): a genuine death certificate and low risk |
| **Look for** | A verdict for each document (legit, suspicious or fake) with the failed checks. The activity timeline: the 2 Nov 10:42 details change, the 3 Nov 21:14 login from Sydney, and the 6 Nov 07:52 full-balance rollover request, about 93 hours after the change. A HIGH rating, with a hold, a call-back on the pre-change number and an IDCARE referral recommended |
| **Foundry on show** | Azure Content Understanding, plus Azure AI Search over the financial-crime red flags guide |
| **Talking point** | "It's explainable, not a black box, and it never accuses the member. The SMR is a human decision." |

### 5. Transfers & Rollovers Agent (Rory) · `/agents/transfers-rollovers`

| | |
|---|---|
| **Try it out** | 1. Pick a case. 2. **Engage agent**: the MCP tools look up the fund directory, verify the SMSF and create the transfer request PDF. 3. Review the counterparties, insurance warnings and SLA. 4. The rollover request is dispatched or held |
| **Pick** | `REQ-20261103-OPS001` (Priya): Harbourline is dispatched, and Southern Cross is held for the $520,000 Death & TPD cover. Or `REQ-20261106-OPS002` (Grace): SMSF verification fails and the rollover is held |
| **Look for** | The `lookupFunds` result by USI, the `verifySmsf` result, the generated PDF (`/transfers/request/{id}.pdf`) and the 3-business-day service level |
| **Foundry on show** | MCP tools `lookupFunds`, `verifySmsf` and `generateTransferRequestPdf` |
| **Talking point** | "Rory's agent stops the two rollovers you'd regret: the one that loses cover, and the one heading to a fraudster." |

### 6. Payments Agent (Penny) · `/agents/payments`

| | |
|---|---|
| **Try it out** | 1. Pick a case. 2. Confirm the payment inputs (gross, components, tax status, payee). 3. **Engage agent**: the MCP payment tools run, a Teams approval card is sent, and the payment is released only after approval |
| **Pick** | `REQ-20261109-OPS003` (George): a commencement of $1m or more goes to Teams. `REQ-20261111-OPS004` (Tom): $10,000 gross, $2,068 PAYG and $7,932 net. `REQ-20261113-OPS005` (Robert): two death benefit payments of $217,477.26 net each |
| **Look for** | The tool sequence in **Agent Prompt & Tools**: `payments_validatePayee` → `payments_checkCaseApproval` → `payments_calculateBenefit` → `payments_checkAuthorityLimit` → `payments_requestApproval` → `payments_getApprovalStatus` → `payments_releasePayment`. Then the adaptive card in Teams |
| **Foundry on show** | MCP tools plus a Microsoft Teams adaptive-card approval (human in the loop) |
| **Talking point** | "`payments_releasePayment` simply refuses until a person approves." |

### 7. Client Communications Agent (Cara) · `/agents/client-communications`

| | |
|---|---|
| **Try it out** | 1. Select a case. 2. **Engage agent**. 3. Read Cara's case summary. 4. Review the drafts (member letter, adviser update, SMS). Then open the **Voice chat** tab |
| **Pick** | `REQ-20261113-OPS005` (Robert) for tone. `REQ-20261109-OPS003` (George) for the voice question. `REQ-20261111-OPS004` (Tom) for the hardship letter with free help: the National Debt Helpline (1800 007 007) and Moneysmart |
| **Look for** | A different tone for each audience. The compliance points: no advice, and IDR and AFCA rights. Voice answers grounded in the case |
| **Foundry on show** | A declarative agent plus Voice Live (`client-communications-voice-agent`) |
| **Talking point** | "The hardest conversations get the most care, and a person signs off every one." |

### 8. Team Leader Agent (Theo) · `/agents/team-leader`

| | |
|---|---|
| **Try it out** | 1. Pick a case. 2. **Engage agent** to see the floor dashboard, SLA and IDR clocks, and approvals. Then open **Group chat**, where Theo orchestrates the seven specialists on one case |
| **Pick** | `REQ-20261106-OPS002` (Grace) for the block and the SMR deadline. Or `REQ-20261109-OPS003` (George) for a calm, complete walkthrough |
| **Look for** | The 3-business-day rollover SLA, the IDR clocks (30, 45 and 90 days), the SMR deadline, the approvals queue, and a turn from each specialist in the group chat |
| **Foundry on show** | Multi-agent group chat orchestration |
| **Talking point** | "Not one chatbot, but a team with a team leader." |

---

## Talking Points to Have Ready

- **No advice.** Agents never give personal financial advice. They check, calculate, draft and recommend.
- **Humans approve:**
  - declines and partial approvals
  - financial-crime blocks and SMRs
  - single payments of $250,000 or more, and every death benefit
  - pension commencements of $1 million or more
  - hardship releases
  - complaint responses
  - communications to fraud victims and bereaved families
- **Fictional people, real rules.** All people, practices and funds are fictional. The rules and numbers are real FY2026-27 settings (see [background.md](background.md)).
- **Grounded answers.** Every answer is grounded and cited. Show the **Reference** tab.

## If Something Goes Wrong

- **Voice isn't working:** show the drafts and the **Agent Prompt & Tools** tab, and describe Voice Live.
- **The Teams card doesn't arrive:** show the `payments_requestApproval` call and the pending status. The point is that release is refused until a person approves.
- **A run is slow:** open **Agent Prompt & Tools** or **Agent Input** while it streams, and narrate what the agent was given.
