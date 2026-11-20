# Super & Wealth Operations Characters

> Part of **Wealth Team in a Day** — the AI operations office demo for **Caldova Wealth**.

## Overview

This document describes the people in **Caldova Client Operations**, the operations office featured in *Wealth Team in a Day*. They are split into **staff** and **clients**. You can use these characters for journey mapping, product demos, AI agent design, training scenarios, service design or role-play.

Each staff member is supported by one or two specialised AI agents. The agents take on repeatable day-to-day work, such as reading forms, checking rules, calculating and drafting. They report their findings, drafts and recommendations back to the human, who keeps final judgement and accountability. Agents never give personal financial advice; that is the adviser's job.

To make the cast easy to remember, each staff member's first name starts with the same letter as a keyword in their role:

| Name | Role keyword |
|---|---|
| **O**livia | **O**nboarding |
| **B**en | **B**enefits |
| **I**vy | **I**nvestments |
| **F**elix | **F**inancial crime |
| **R**ory | **R**ollovers |
| **P**enny | **P**ayments |
| **C**ara | **C**omms |
| **T**heo | **T**eam leader |

Each person's AI agents share their first name and are numbered. In the running demo, one Foundry agent delivers both of a staff member's assistants. For example, `onboarding-agent` covers Agent Olivia #1 and #2. Cara's Voice Assistant is a separate voice agent. See [foundry_agents.md](foundry_agents.md).

---

## Human–Agent Relationships

| Human (Staff) | Role | AI Agent(s) | Agent Focus |
|---|---|---|---|
| Olivia | Onboarding & Requests Officer | Agent Olivia #1: Application & NIGO Assistant | Reads adviser emails and forms, extracts every field, runs the NIGO checklist |
| Olivia | Onboarding & Requests Officer | Agent Olivia #2: Request Triage Assistant | Classifies the request, sets priority, flags vulnerable members, opens and routes the Member Case |
| Ben | Benefits & Eligibility Assessor | Agent Ben #1: Eligibility Rules Assistant | Conditions of release, hardship criteria, pension standards and the transfer balance cap, with cited clauses |
| Ben | Benefits & Eligibility Assessor | Agent Ben #2: Nominations & Consent Assistant | BDBN validity, SIS and tax dependants, adviser fee consent (s99FA), target market fit |
| Ivy | Investment Analyst | Agent Ivy #1: Portfolio Fit & Fees Assistant | Model fit against the risk profile and SoA; compares models on fees in dollars, returns and risk |
| Ivy | Investment Analyst | Agent Ivy #2: Income & Redemption Planner | Pension income and cash-bucket strategies, redemption plans, workbook and chart |
| Felix | Financial Crime Investigator | Agent Felix #1: Document & Identity Assistant | Document authenticity, KYC, and politically exposed person (PEP) and sanctions screening |
| Felix | Financial Crime Investigator | Agent Felix #2: Account Activity & Risk Assistant | Activity timelines, SMSF rollover red flags, explainable risk score, recommended holds and call-backs |
| Rory | Transfers & Rollovers Coordinator | Agent Rory #1: Rollover & Counterparty Assistant | Fund lookup by USI, SuperStream rollovers in and out, transfer requests, service-level tracking and chasing |
| Rory | Transfers & Rollovers Coordinator | Agent Rory #2: Verification & Warnings Assistant | SMSF verification (SVS), warnings about lost death and TPD cover, ATO transfer balance reporting |
| Penny | Payments Officer | Agent Penny #1: Benefit Calculation Assistant | Tax-free and taxable components, PAYG withholding, net amounts, investing incoming money |
| Penny | Payments Officer | Agent Penny #2: Payee & Approval Assistant | Payee validation, authority limits, Microsoft Teams approval cards, release only after approval |
| Cara | Client Communications Specialist | Agent Cara #1: Correspondence Assistant | Member letters, adviser updates and SMS, with tone-matching and a compliance check |
| Cara | Client Communications Specialist | Agent Cara #2: Voice Assistant | Takes calls as Cara (Voice Live) and explains case status in plain English |
| Theo | Client Operations Team Leader | Agent Theo #1: Floor & Clocks Assistant | Queues, service levels, IDR clocks, SMR deadlines, vulnerable members |
| Theo | Client Operations Team Leader | Agent Theo #2: Approvals, Quality & Group Chat Assistant | Approval briefs, quality sampling, escalations, and coordinating the other seven agents in group chat |

---

# Staff Characters

## 1. Olivia — Onboarding & Requests Officer

**Role:** The front door for every application and member request.

**What she does:**

- Receives new account applications, pension applications, withdrawals, rollover requests and death notifications from advisers, members and clients
- Checks that each request is in good order (NIGO) before it goes any further
- Opens the Member Case and routes it to the right department
- Tells the adviser or member exactly what is still needed
- Handles sensitive requests, such as death notifications, with care from the first contact

**Personality:** Calm, meticulous and welcoming.

**Typical line:**

> "I'll get this set up properly first time — let me check nothing's missing."

### Supporting AI Agents

- **Agent Olivia #1: Application & NIGO Assistant**
  - Reads adviser emails, application forms and attachments
  - Extracts every field into the Member Case, with TFNs masked
  - Runs the NIGO checklist: ID verified, TFN supplied, signatures and witnesses, fee consent, nominations, investment selections and insurance elections
  - Drafts the "what we still need" note for Olivia to approve

- **Agent Olivia #2: Request Triage Assistant**
  - Classifies the request: new account & consolidation, rollover out to SMSF, pension commencement, financial hardship release or death benefit claim
  - Sets the priority (Standard, High or Urgent) and gives a reason
  - Flags vulnerable members and sensitive cases for human handling
  - Opens the case (`REQ-YYYYMMDD-XXXXXX`), routes it, and reports back to Olivia

---

## 2. Ben — Benefits & Eligibility Assessor

**Role:** Applies the trust deed, PDS and super law to each request.

**What he does:**

- Checks conditions of release and preservation
- Assesses financial hardship applications
- Checks pension rules: the transfer balance cap, minimum payments and reversionary nominations
- Validates death benefit nominations and identifies dependants
- Checks adviser fee consent and product fit (TMD)
- Recommends approve, partially approve or decline, and cites the rule that applies

**Personality:** Analytical, fair and precise.

**Typical line:**

> "You're eligible — here's the rule that says so, and here's what we still need."

### Supporting AI Agents

- **Agent Ben #1: Eligibility Rules Assistant**
  - Maps each request to the conditions of release, hardship criteria, pension standards and transfer balance cap
  - Calculates caps, remaining cap space and pro-rated minimum payments
  - Builds an eligibility checklist showing each rule, a pass, fail or warn result, and the cited clause
  - Drafts a recommendation for Ben to decide on

- **Agent Ben #2: Nominations & Consent Assistant**
  - Checks BDBN formalities: two adult witnesses not named in it, signed and dated, and still in force
  - Identifies SIS dependants and tax dependants
  - Checks adviser fee consent against s99FA and the ongoing fee arrangement rules
  - Checks fit with the product's target market determination (TMD)

---

## 3. Ivy — Investment Analyst

**Role:** Works in the Investment Solutions team and owns the model portfolio menu.

**What she does:**

- Checks that a client's model portfolio fits their risk profile and Statement of Advice
- Compares model portfolios on fees, returns and risk, with fees in dollars as well as percentages
- Builds income strategies for pensions, such as a cash bucket
- Plans redemptions when money needs to be paid out
- Gives advisers clear numbers and leaves the advice to them

**Personality:** Curious, data-driven and plain-speaking.

**Typical line:**

> "Let's make sure the portfolio still fits the plan — and show the fees in dollars, not just percentages."

### Supporting AI Agents

- **Agent Ivy #1: Portfolio Fit & Fees Assistant**
  - Reads model portfolio fact sheets
  - Checks the selected model against the client's risk profile and SoA
  - Compares models on fees ($ per year), returns and risk
  - Reports the fit and trade-offs to Ivy, never a personal recommendation

- **Agent Ivy #2: Income & Redemption Planner**
  - Builds pension income and cash-bucket strategies
  - Plans which holdings to sell first while keeping the minimum cash balance
  - Notes the market-movement risk until a sale completes
  - Produces the Excel workbook and chart for the adviser

---

## 4. Felix — Financial Crime Investigator

**Role:** Protects members from fraud, scams and identity takeover, and looks after AML/CTF obligations.

**What he does:**

- Verifies identity and checks documents for tampering
- Reviews account activity for signs of takeover
- Investigates SMSF rollover red flags
- Runs KYC, politically exposed person (PEP) and sanctions screening
- Recommends holds, call-backs and referrals
- Prepares suspicious matter reports (SMRs) for a human decision

**Personality:** Observant, sceptical and discreet. Never accusatory.

**Typical line:**

> "Something doesn't add up — let's verify with the member on a number we already trust."

### Supporting AI Agents

- **Agent Felix #1: Document & Identity Assistant**
  - Uses Azure Content Understanding to check ID documents, bank statements, SMSF letters and death certificates for authenticity
  - Gives each document a verdict of legit, suspicious or fake, with the checks behind it
  - Runs KYC, PEP and sanctions screening
  - Reports results to Felix, citing each document by number

- **Agent Felix #2: Account Activity & Risk Assistant**
  - Builds the account-activity timeline: contact-detail changes, new devices and locations
  - Matches activity against AUSTRAC and ATO red flags, such as a recent change of details, a new SMSF, an SVS mismatch or a payee mismatch
  - Produces an explainable risk score
  - Recommends holds, call-backs on the verified number and IDCARE referrals
  - Drafts the facts for an SMR; the decision to lodge stays with people

---

## 5. Rory — Transfers & Rollovers Coordinator

**Role:** Moves money between Caldova and the outside world.

**What he does:**

- Rolls super in and out through SuperStream
- Handles SMSF rollovers and in-specie transfers from other platforms
- Works with counterparties: other super funds, SMSFs and the ATO
- Warns members and advisers before a rollover ends valuable cover
- Tracks service levels and chases counterparties

**Personality:** Organised, persistent and counterparty-savvy.

**Typical line:**

> "Your old funds have the request — the money should land within three business days."

### Supporting AI Agents

- **Agent Rory #1: Rollover & Counterparty Assistant**
  - Looks up external funds by USI
  - Generates transfer and rollover request documents
  - Tracks the 3-business-day rollover service level, which starts once all information is received
  - Drafts chasers for overdue counterparties and reports exceptions to Rory

- **Agent Rory #2: Verification & Warnings Assistant**
  - Verifies SMSFs through the ATO SMSF verification service: registered ABN, member TFN linked, and bank details and ESA matching
  - Warns when a rollover would end death or TPD cover held in the old fund
  - Prepares ATO transfer balance reporting for pension commencements
  - Holds a rollover when verification fails, and tells Rory why

---

## 6. Penny — Payments Officer

**Role:** Releases money correctly.

**What she does:**

- Pays lump sums, pension payments, death benefits, hardship payments and outbound rollovers
- Invests incoming money according to the client's selection
- Splits each payment into tax-free and taxable components and withholds tax
- Checks payee details and authority limits
- Makes sure any payment that needs approval is approved before release

**Personality:** Precise, transparent and unflappable.

**Typical line:**

> "Gross $10,000, tax withheld $2,068 — $7,932 lands in your account on Friday."

### Supporting AI Agents

- **Agent Penny #1: Benefit Calculation Assistant**
  - Calculates tax-free and taxable components, PAYG withholding and the net amount
  - Applies the right withholding rate, for example 22% for under-60s or 17% for death benefits to non-dependants
  - Invests incoming rollovers and keeps 1% in the cash account
  - Shows the calculation step by step for Penny to check

- **Agent Penny #2: Payee & Approval Assistant**
  - Validates the payee name and bank details against the verified account
  - Checks authority limits: single payments of $250,000 or more, any death benefit, and pension commencements of $1 million or more
  - Raises a Microsoft Teams approval card and tracks its status
  - Releases payment only after a human approves

---

## 7. Cara — Client Communications Specialist

**Role:** Talks to members and advisers.

**What she does:**

- Sends status updates, decision letters and adviser updates
- Explains decisions, tax and next steps in plain English
- Matches her tone to the situation, whether that is a celebration, hardship, a scam or a bereavement
- Keeps communications compliant: no personal advice, the required disclosures and complaint rights
- Takes calls from members and advisers

**Personality:** Warm, clear and empathetic.

**Typical line:**

> "I'll explain exactly what happens next — no jargon."

### Supporting AI Agents

- **Agent Cara #1: Correspondence Assistant**
  - Drafts member letters, adviser updates, SMS messages and call scripts from the Member Case
  - Matches tone for bereaved families, members in hardship and fraud victims
  - Checks compliance: no personal advice, the required disclosures, and IDR and AFCA rights
  - Sends drafts to Cara for review and sign-off

- **Agent Cara #2: Voice Assistant**
  - Takes calls in Cara's voice, using Voice Live
  - Explains case status and next steps in plain English
  - Hands over to a person for complaints, vulnerable callers or identity concerns

---

## 8. Theo — Client Operations Team Leader

**Role:** Runs the operations floor.

**What he does:**

- Manages workload, service levels and IDR clocks
- Approves high-value and sensitive decisions
- Looks after vulnerable members and sensitive cases
- Reviews quality and handles escalations and complaints
- Coordinates the team on complex cases

**Personality:** Decisive, supportive and commercially aware.

**Typical line:**

> "Let's get this right for the member — I'll take the approval."

### Supporting AI Agents

- **Agent Theo #1: Floor & Clocks Assistant**
  - Monitors queues, ageing cases and service levels, such as the 3-business-day rollover SLA
  - Tracks IDR clocks (30, 45 and 90 days) and SMR deadlines
  - Surfaces vulnerable members and cases at risk
  - Gives Theo a floor briefing

- **Agent Theo #2: Approvals, Quality & Group Chat Assistant**
  - Prepares one-page approval briefs
  - Samples completed cases for quality
  - Summarises escalations and complaints
  - Runs the group chat that coordinates the other seven agents on one case

---

# Business Owner

## Maya Ashworth — Managing Director (Business Owner)

**Role:** The business owner for both sides of Caldova Wealth: Wealth Management (Caldova Wrap and the managed portfolios) and Superannuation (Caldova Super and Caldova Pension). Maya appears on Level 3 of the Lakehouse storybook ([storybook.md](storybook.md)), next to her idea, "the brain". Her name follows the same rule as the staff: **M**aya, **M**anaging director.

**What she does:**

- Sets the goals both sides work to: clearer, faster and more consistent requests
- Holds the guardrails: when a person must approve, and what agents may never do
- Decides where to invest in the two teams, the agents and the platform
- Answers for the results that members, clients and advisers feel

**Personality:** Curious, practical and people-first.

**Typical line:**

> "If a member has to chase us, we've already let them down."

Maya isn't part of the day-to-day operations team and has no AI agent of her own. Her idea is the demo's product message for the agentic era: run each side with a small expert team, supported by one group of AI agents that are dedicated to a side where the work is specialised and shared where it isn't, with people approving every decision that matters.

---

# Front Desk Adviser

## Amelia — Financial Adviser (Front Desk)

**Role:** Caldova's own financial adviser. In the Lakehouse storybook she works out front at the front desk on the dock ([storybook.md](storybook.md#the-dock-and-the-front-desk)), and helps any customer get started on either side. Her name follows the same rule as the staff: **A**melia, **A**dviser.

**What she does:**

- Gives the advice, which agents never do
- Welcomes members, clients and their advisers as they arrive, and helps them sign their application, policy or death benefit claim
- Links each customer with the agents that get them started: Olivia's Onboarding Agent, Ben's Benefits & Eligibility Agent, Ivy's Investment Analyst Agent and Cara's Client Communications Agent
- Between visitors, reviews Statements of Advice, prepares welcome packs and checks fee consent forms

**Personality:** Warm, unhurried and clear.

**Typical line:**

> "Hi Priya! Hannah sent your pack ahead."

Amelia isn't one of the eight operations staff and has no AI agent of her own. She welcomes the clients of the two external advisers, Hannah Lewis and Marcus Tan, when they come to the desk.

---

# Client Characters

The five clients are fictional, and each one anchors a scenario. Two fictional advisers appear alongside them:

- **Hannah Lewis CFP®**, Yarra Private Wealth, Collins St (Priya's adviser)
- **Marcus Tan**, Bayside Financial Partners, Brighton (George's and Mei Chen's adviser)

## 9. Priya — New Client (Onboarding & Consolidation)

**Situation:** Priya is 34 and a product manager. She has just started a new job at a Docklands fintech and lives in a Southbank apartment with her de facto partner, Arjun Mehta. Her adviser, Hannah Lewis, is opening a Caldova Super (Select) account for her and bringing her old super funds across.

**Need:**

- One super account, set up properly and invested in line with her Statement of Advice
- Her old funds rolled over without fuss
- A valid nomination in favour of Arjun
- Everything done digitally

**Concern:**
She doesn't want to lose time to paperwork. She may not realise what she could lose by consolidating, such as the Death & TPD cover in one of her old funds.

**Personality:**
Busy, organised, and wants it done digitally.

**Typical line:**

> "I've got super scattered across old jobs — I just want one account, set up properly."

**Scenario:** [Scenario 1: New client onboarding & super consolidation](scenario-1-new-client-onboarding.md)

---

## 10. Grace — Member Targeted by Identity Takeover

**Situation:** Grace is 63, a retired school principal from Williamstown. She is a Caldova Super (Select) member with $612,400, and she is travelling through Italy. While she is away, someone impersonates her, changes her contact details and asks to roll her whole balance over to a newly created SMSF.

**Need:**

- Her savings protected
- Contact only through details she trusts
- Her account secured and her access restored

**Concern:**
Someone has stolen her identity, and she can't easily deal with it from overseas.

**Personality:**
Independent and careful. She is rattled when she hears.

**Typical line:**

> "I'm in Florence — I haven't asked anyone to move my super!"

**Scenario:** [Scenario 2: Identity takeover & fake SMSF rollover blocked](scenario-2-account-takeover.md)

---

## 11. George — Retiring Member (Account-Based Pension)

**Situation:** George is 66, a retired electrical contractor from Oakleigh, married to Helen (63). He has $1,284,600 in Caldova Super (Select). His adviser, Marcus Tan, is starting a Caldova Pension for him.

**Need:**

- A steady income of $78,000 a year, paid monthly
- Helen to keep receiving the income if he dies first (a reversionary pension)
- Clear numbers on how the plan holds up

**Concern:**
He worries about "running out", and about markets falling just as he retires.

**Personality:**
Proud and practical, and a little anxious about "running out".

**Typical line:**

> "Forty years on the tools — I just want a steady income and to stop worrying."

**Scenario:** [Scenario 3: Retirement: starting an account-based pension](scenario-3-retirement-pension.md)

---

## 12. Tom — Member in Financial Hardship

**Situation:** Tom is 47 and used to own a small café on Lygon Street, Carlton, which closed in mid-2025. He has received JobSeeker continuously since 6 Apr 2026 and is behind on his mortgage and utility bills. He is a direct member with no adviser, with $84,300 in Caldova Super (Essential).

**Need:**

- An early release of $15,000 to catch up on his bills
- A quick, clear decision
- To understand the tax and what it means for his retirement

**Concern:**
He is embarrassed to ask, unsure whether he qualifies, and worried about the long-term cost.

**Personality:**
Proud, embarrassed and stressed.

**Typical line:**

> "I never thought I'd need to touch my super — I just need to catch up on the bills."

**Scenario:** [Scenario 4: Financial hardship early release](scenario-4-financial-hardship.md)

---

## 13. Robert — Son Handling a Death Benefit

**Situation:** Robert is 52 and lives in Box Hill. His mother, Mei Chen (81), died on 12 Oct 2026, and he is acting for himself and his sister Lily (49). Mei had a Caldova Pension worth $486,200 and a binding nomination splitting it equally between her two children.

**Need:**

- A compassionate, simple process with one point of contact
- To know exactly which documents are needed
- To understand the tax and the timeline

**Concern:**
Paperwork during a time of grief, and doing right by his mother's wishes.

**Personality:**
Quiet and grieving, and the one organising things for the family.

**Typical line:**

> "Mum always said she'd sorted everything — I just want to do this right for her."

**Scenario:** [Scenario 5: Death benefit under a binding nomination](scenario-5-death-benefit.md)

---

# Summary

These characters represent a realistic super and wealth operations environment, with internal staff and external clients.

- **Staff** show the operational side of platform administration. Each is paired with one or two specialised AI agents that take on repeatable day-to-day work and report back to the human.
- **Clients** show the life events behind every request (a new job, an overseas trip, retirement, hardship and bereavement) and the practical, financial and emotional pressures that come with them.
