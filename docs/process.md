# Super & Wealth Operations AI Agent Characters

> Part of **Wealth Team in a Day** — the AI operations office demo for **Caldova Wealth**.

## Overview

This document describes the staff-based AI agents in **Caldova Client Operations**, the operations team in *Wealth Team in a Day*. Each agent is based on a real platform operations role. The agents are designed to:

- support human staff
- improve the experience for members, clients and advisers
- reduce manual effort and rework (especially NIGO)
- make operations more consistent and auditable

Every agent follows the same guardrails:

- It works in plain English.
- It never gives personal financial advice.
- It never invents figures or rules; it cites the PDS, trust deed or rule document.
- It never accuses a member of fraud.
- It masks TFNs.
- It flags vulnerable members for human handling.
- Humans approve every decision that matters.

The examples below use the five demo scenarios. See [characters.md](characters.md) and the `scenario-*.md` files.

---

# 1. Onboarding Agent

**Based on:** Onboarding & Requests Officer (Olivia)

**Purpose:** Capture every request accurately, check it is in good order, and open the Member Case.

## What the agent can do

| Capability | Description |
|---|---|
| Inbox and form reading | Reads adviser emails, application forms and attachments, and extracts every field into the Member Case. |
| NIGO checklist | Checks that ID is verified, the TFN is supplied, signatures and witnesses are present, and fee consent, nominations, investment selections and insurance elections are complete. |
| Request classification | Identifies the request type: new account & consolidation, rollover out to SMSF, pension commencement, financial hardship release, or death benefit claim. |
| Member matching | Links the request to an existing member number (`CS-…` or `CP-…`), or prepares a new account. |
| Priority and vulnerability triage | Sets the priority (Standard, High or Urgent) with a reason, and flags vulnerable members and sensitive cases. |
| Follow-up drafts | Drafts a clear "what we still need" note to the adviser or member, for a human to send. |
| Case opening and routing | Opens the case (`REQ-YYYYMMDD-XXXXXX`) and routes it to the right department. |

## Example AI agent behaviour

> "Thanks, Olivia. I've extracted Hannah Lewis's application pack for Priya Natarajan. It's a Caldova Super (Select) account in the Growth managed portfolio, per the SoA dated 28 Oct 2026, with rollovers from Southern Cross Industry Super and Harbourline Retail Super (about $138,200 in total) and a $3,300 a year adviser fee. ID is verified and the TFN is supplied. Two items need attention: the binding nomination has only one witness signature, and the Southern Cross account holds Death & TPD cover. I've opened REQ-20261103-OPS001 and routed it to Financial Crime for screening and to Benefits & Eligibility."

---

# 2. Benefits & Eligibility Agent

**Based on:** Benefits & Eligibility Assessor (Ben)

**Purpose:** Apply the trust deed, PDS and super law to each request, citing every rule.

## What the agent can do

| Capability | Description |
|---|---|
| Conditions of release | Checks preservation age, retirement, age 65, transition to retirement, incapacity, terminal medical condition and death. |
| Financial hardship | Checks for 26 continuous weeks of income support, a current Services Australia letter, inability to meet living expenses, the $1,000–$10,000 limit and one release in 12 months. |
| Pension standards | Checks the transfer balance cap, works out the minimum drawdown (pro-rated in the first year) and validates reversionary beneficiaries. |
| Death benefit nominations | Checks BDBN formalities under SIS reg 6.17A, whether the nomination is still in force, SIS dependants and tax dependants. |
| Adviser fee consent | Checks the s99FA written consent and the ongoing fee arrangement renewal rules. |
| Product fit | Checks fit with the target market determination (TMD) for the product and tier. |
| SMSF rollover rules | Confirms the ATO SMSF verification service result before any rollover to an SMSF. |
| Cited recommendation | Produces a checklist (each rule, its result and the cited clause) and recommends approve, partial or decline. |

## Example AI agent behaviour

> "Ben, Tom meets every severe financial hardship criterion. He has 31 continuous weeks of JobSeeker (26 are needed), a Services Australia letter dated 9 Nov 2026, a statutory declaration with overdue notices, and no release in the last 12 months. But he has asked for $15,000, and the maximum is $10,000 gross, once in any 12 months. I recommend a partial approval of $10,000, citing the *Financial hardship* rule. Because this is a partial approval for a vulnerable member, it needs Theo's sign-off."

---

# 3. Investment Analyst Agent

**Based on:** Investment Analyst (Ivy), Investment Solutions

**Purpose:** Make sure portfolios fit the plan, make fees visible in dollars, and plan income and redemptions.

## What the agent can do

| Capability | Description |
|---|---|
| Model fit check | Confirms that the selected model portfolio matches the client's risk profile and Statement of Advice. |
| Fact sheet analysis | Reads model portfolio fact sheets: asset allocation, fees, returns and risk. |
| Fees in dollars | Compares models on dollar fees per year for the client's actual balance, not just percentages. |
| Income strategies | Builds pension income plans, such as a cash bucket that covers two years of payments. |
| Redemption planning | Decides which holdings to sell (cash first), keeps the 1% minimum cash, and notes market movement until the sale. |
| Workbook and chart | Produces an Excel workbook and a chart the adviser can share. |
| Menu knowledge | Answers questions about the Caldova Managed Portfolios menu and its fees from the menu document. |

## Example AI agent behaviour

> "Marcus's instruction is a $1,250,000 pension paying $78,000 a year. I've modelled a cash bucket of two years' payments ($156,000) with the remaining $1,094,000 in the Balanced model, and compared it with two alternatives in the workbook. The bucket would cover George's $6,500 monthly payments for 24 months without selling growth assets in a downturn. The choice is Marcus and George's; the workbook is ready to share."

---

# 4. Financial Crime Agent

**Based on:** Financial Crime Investigator (Felix)

**Purpose:** Protect members from fraud, scams and identity takeover, and support AML/CTF obligations.

## What the agent can do

| Capability | Description |
|---|---|
| Document authenticity | Uses Azure Content Understanding to check ID documents, bank statements, SMSF and ESA letters, and death certificates. Each gets a verdict of legit, suspicious or fake, with the reasons. |
| Account-activity timeline | Builds one timeline of contact-detail changes, new devices, locations, MFA events and requests. |
| SMSF rollover red flags | Flags a newly registered SMSF, an SVS mismatch, a payee name mismatch or a full-balance request soon after a change of details. |
| KYC and screening | Checks identity verification results and screens for politically exposed persons (PEPs) and sanctions. |
| Explainable risk score | Gives a low, medium or high rating, with each indicator mapped to AUSTRAC and ATO patterns. It is never a black-box score. |
| Recommended controls | Recommends a hold, locked online access, a call-back on the pre-change verified number, and an IDCARE referral. |
| SMR preparation | Drafts the facts for a suspicious matter report. The decision to lodge is human, within 3 business days. |

## Example AI agent behaviour

> "Felix, I've rated REQ-20261106-OPS002 as high risk. Grace's mobile and email were changed by phone on 2 Nov at 10:42, about 93 hours before the 6 Nov 07:52 request to roll over her full $612,400 to an SMSF registered 9 days earlier. A new device logged in from Sydney while her travel notice says she is in Italy. The SMSF verification shows her TFN isn't linked, and the licence image appears tampered. I recommend holding the rollover, locking online access and calling Grace on 0491 570 157, the number on file before the change. An SMR decision is due within 3 business days."

---

# 5. Transfers & Rollovers Agent

**Based on:** Transfers & Rollovers Coordinator (Rory)

**Purpose:** Move money between Caldova and the outside world, correctly and on time.

## What the agent can do

| Capability | Description |
|---|---|
| Fund lookup | Finds external super funds by USI or name. |
| SuperStream rollovers | Starts and tracks rollovers in and out. The 3-business-day service level runs once all required information is received. |
| Lost-cover warnings | Warns before a rollover would end valuable death or TPD cover in the old fund, and holds the rollover until it is confirmed. |
| SMSF verification | Uses the ATO SMSF verification service to check the registered ABN, that the member's TFN is linked, and that the bank details and ESA match. |
| Transfer requests | Generates the transfer or rollover request PDF. |
| In-specie and internal transfers | Handles transfers from other platforms and moves from accumulation to pension. |
| ATO reporting | Prepares transfer balance account reports (TBAR) for pension commencements. |
| Counterparty chasing | Tracks overdue counterparties and drafts chasers. |

## Example AI agent behaviour

> "I've started the Harbourline Retail Super rollover (USI HRB0007AU, about $41,800) through SuperStream. I'm holding Southern Cross Industry Super (USI SCI0001AU, about $96,400), because rolling it over would end Priya's $520,000 Death & TPD cover. I've asked Hannah to confirm in writing before we proceed. The transfer request PDF is on the case."

---

# 6. Payments Agent

**Based on:** Payments Officer (Penny)

**Purpose:** Release money correctly, transparently and only with the right approval.

## What the agent can do

| Capability | Description |
|---|---|
| Payee validation | Checks that the payee name and bank details match the verified account. It pays only to nominated or linked accounts. |
| Benefit calculation | Splits each payment into tax-free and taxable components and calculates PAYG withholding and the net amount. |
| Approval check | Confirms the case decision is approved before any payment. |
| Authority limits | Flags single payments of $250,000 or more, any death benefit, and pension commencements of $1 million or more. |
| Teams approval | Posts a Microsoft Teams adaptive card to the approver and tracks its status. |
| Controlled release | Releases payment only after human approval, and remits withholding to the ATO. |
| Investing incoming money | Invests rollovers and contributions according to the client's selection, keeping 1% in cash. |
| Audit trail | Records every input, calculation and approval. |

## Example AI agent behaviour

> "Two death benefit payments are ready: $243,100 gross each to Robert and Lily Chen. Each splits into $92,378 tax-free and $150,722 taxable. Withholding at 17% is $25,622.74, leaving $217,477.26 net. Both payees match. Every death benefit needs Team Leader approval, so I've sent Theo a Teams card for each, and I'll release them only once both are approved."

---

# 7. Client Communications Agent

**Based on:** Client Communications Specialist (Cara)

**Purpose:** Keep members and advisers informed with clear, empathetic and compliant communication.

## What the agent can do

| Capability | Description |
|---|---|
| Member letters | Drafts welcome, decision, partial-approval, reassurance and condolence letters. |
| Adviser updates | Sends advisers action lists, such as NIGO items, and status updates in adviser language. |
| Multi-channel drafts | Drafts emails, SMS messages, portal messages and call scripts. |
| Tone matching | Adjusts tone for celebration, hardship, scams and bereavement. |
| Plain-English explanations | Explains caps, tax components and rules without jargon. |
| Compliance check | Checks for no personal advice, the required disclosures, and IDR and AFCA rights. |
| Voice | Cara's voice agent (Voice Live) takes calls and explains case status. |

## Example AI agent behaviour

> "I've drafted condolence letters to Robert and Lily. They confirm the payment, explain in two sentences why 17% tax applies to part of the benefit, set out what happens next, and include their complaint rights. Because this is a bereaved family, both letters are waiting for your review before they go."

---

# 8. Team Leader Agent

**Based on:** Client Operations Team Leader (Theo)

**Purpose:** Run the floor: workload, service levels, complaint clocks, approvals, quality and vulnerable members.

## What the agent can do

| Capability | Description |
|---|---|
| Queue and SLA dashboard | Tracks open cases by age, type, priority and owner, including the 3-business-day rollover service level. |
| Regulatory clocks | Tracks IDR clocks (30, 45 and 90 days) and SMR deadlines (3 business days). |
| Approval briefs | Writes a one-page summary for each approval: facts, rule checks, risk and recommendation. |
| Vulnerable-member oversight | Surfaces hardship, bereavement, scam and other vulnerable-member cases for human attention. |
| Quality assurance | Samples completed cases for missing reasoning, unclear decisions or communication issues. |
| Escalations and complaints | Summarises complaint history and the options for responding. |
| Group chat orchestration | Coordinates the seven specialist agents on a single case in a multi-agent group chat. |

## Example AI agent behaviour

> "Theo, four cases need you today. REQ-20261106-OPS002 (Grace): the block and the SMR referral need your approval, and the SMR clock is running. REQ-20261109-OPS003 (George): a $1,250,000 pension commencement is waiting in Teams. REQ-20261111-OPS004 (Tom): a partial hardship release for a vulnerable member. REQ-20261113-OPS005 (Robert and Lily): two death benefit payments. All rollovers are within their service level."

---

# Suggested AI Agent Ecosystem

A realistic AI setup for super and wealth operations could look like this:

1. The **Onboarding Agent** captures the request, runs the NIGO checklist and opens the Member Case.
2. The **Financial Crime Agent** screens new clients and checks identity, documents and account activity whenever risk indicators appear.
3. The **Benefits & Eligibility Agent** checks the rules and recommends a decision with citations.
4. The **Investment Analyst Agent** checks portfolio fit, shows fees in dollars and plans income or redemptions.
5. The **Transfers & Rollovers Agent** moves money to and from other funds, SMSFs and the ATO.
6. The **Payments Agent** calculates, gets approval for and releases payments.
7. The **Client Communications Agent** keeps the member and adviser informed. Its voice agent takes calls.
8. The **Team Leader Agent** monitors the floor, prepares approvals and coordinates all seven agents in group chat.

The stages follow the request lifecycle: **Request → Verify → Assess → Action → Confirm**.

---

# Summary

Together, these AI agents form a realistic digital operations department. Each agent has a specific role, clear responsibilities and governed tools. Each supports a named human rather than replacing the whole process with one generic chatbot. The agents do the reading, checking, calculating and drafting, and people make the decisions that matter.
