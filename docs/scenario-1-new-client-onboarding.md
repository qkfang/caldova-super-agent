# Scenario 1: New Client Onboarding & Super Consolidation

> Part of **Wealth Team in a Day** — the AI operations office demo for **Caldova Wealth**.

## Scenario Summary

An adviser-led new account. A busy professional's adviser sends Caldova an application pack to open a Caldova Super account and bring two old super funds across. The scenario shows the work that usually causes "not in good order" (NIGO) delays, done right the first time: field extraction, the NIGO checklist, KYC/AML screening, adviser fee consent, a binding nomination that isn't actually binding, an insurance-loss warning before a rollover, and fees shown in dollars.

## At a Glance

| Item | Detail |
|---|---|
| Case number | `REQ-20261103-OPS001` |
| Request type | New account & consolidation |
| Received | Tue 3 Nov 2026, by email from the adviser |
| Priority | Standard |
| Member | Priya Natarajan (DOB 14/02/1992, age 34). New member no. `CS-2049817` |
| Product | Caldova Super (Select) |
| Adviser | Hannah Lewis CFP® (ADV-10442), Yarra Private Wealth, Collins St, Melbourne |
| Investment | Caldova Managed Portfolio — Growth (per Statement of Advice dated 28 Oct 2026, risk profile "Growth") |
| Rollovers in | Southern Cross Industry Super (USI `SCI0001AU`, member 88213045), about $96,400. Harbourline Retail Super (USI `HRB0007AU`, member HR-4471902), about $41,800. Total about $138,200 |
| Adviser fee | Ongoing fee of $3,300 p.a. incl. GST, deducted from super |
| Nomination | Binding death benefit nomination (BDBN): Arjun Mehta (de facto partner) 100% |
| Outcome | ✅ **Completed**: account opened, with two follow-ups for the adviser |
| Neighbourhood zone | Docklands — New Job (Priya) 💼 |

---

## Member

**Priya Natarajan** is a new Caldova Super member.

- She is 34 and a product manager. She has just started a new job at a Docklands fintech and lives in a Southbank apartment.
- Her de facto partner is Arjun Mehta.
- Contact: priya.natarajan@example.com · 0491 570 156.
- She is busy and organised, and wants everything done digitally.

> "I've got super scattered across old jobs — I just want one account, set up properly."

## Life Event

Priya has started a new job. She and her adviser, Hannah Lewis, have agreed to bring her super into one place and invest it in line with her Statement of Advice (SoA).

On 3 Nov 2026 Hannah emails Caldova an application pack with:

- a new Caldova Super (Select) account
- an investment selection
- rollover requests for two external funds
- an ongoing adviser fee consent
- a binding death benefit nomination in favour of Arjun

---

## Request Journey

### 1. Request Received — Onboarding Agent (Olivia)

- The **Onboarding Agent** reads Hannah's email and the attached application form, SoA extract and fee consent form.
- It extracts every field into the Member Case:
  - personal details, with the TFN masked
  - product and tier
  - investment selection
  - adviser details and fee
  - the nomination
  - the rollover details for both external funds
- It runs the NIGO checklist:

| NIGO check | Result |
|---|---|
| Identity verified (electronic verification) | ✓ |
| TFN supplied | ✓ |
| Member signature and date | ✓ |
| Adviser fee consent form attached | ✓ Sent to Benefits & Eligibility for the s99FA check |
| Investment selection matches the SoA | ✓ Growth |
| Death benefit nomination | ⚠ Only **one** witness signature. Sent to Benefits & Eligibility |
| Existing cover in funds being rolled over | ⚠ Southern Cross account holds Death & TPD cover. Sent to Transfers & Rollovers |

- It sets the priority to **Standard**: a new account and consolidation with nothing time-critical.
- It opens case `REQ-20261103-OPS001`, prepares new member number `CS-2049817`, and routes the case to Financial Crime for screening and to Benefits & Eligibility.

> Olivia checks the extraction against the form, confirms the two flagged items and releases the case.

---

### 2. KYC/AML Screening — Financial Crime Agent (Felix)

- The **Financial Crime Agent** confirms that the electronic ID verification passed.
- It screens Priya against politically exposed person (PEP) and sanctions lists. There is no match.
- There are no account-activity red flags, which is expected for a brand-new member.
- Result: **clear**.

> Felix accepts the clear result. No further checks are needed.

---

### 3. Rules Check — Benefits & Eligibility Agent (Ben)

The **Benefits & Eligibility Agent** checks the request against the PDS, the trust deed and super law, and cites each rule:

| Rule | Finding | Result | Cited source |
|---|---|---|---|
| Adviser fee consent (SIS s99FA) | Personal advice. Written consent held by the trustee: signed and dated by Priya, amount $3,300 p.a. incl. GST, services described, 12-month term, can be withdrawn | ✓ Pass | Adviser fee consent (s99FA) & ongoing fee arrangements |
| Product fit (target market determination) | Priya's objectives and her managed portfolio selection fit the Caldova Super (Select) target market | ✓ Pass | Caldova Super & Pension PDS extract |
| BDBN formalities (SIS reg 6.17A) | Needs two adult witnesses who are not named in the nomination. Only one witness signed | ✗ Fail. Not valid as binding | Trust-deed rules on death benefits & nominations |
| Nominated person is a SIS dependant | Arjun is Priya's de facto partner | ✓ Pass | Trust-deed rules on death benefits & nominations |

**Recommendation:** open the account now. Treat the nomination as **non-binding** until Priya re-signs it in front of two adult witnesses who are not beneficiaries.

> Ben agrees. The account can open now, and the nomination goes back to Hannah to be re-signed.

---

### 4. Rollovers — Transfers & Rollovers Agent (Rory)

- The **Transfers & Rollovers Agent** looks up both funds by USI (`lookupFunds`).
- **Harbourline Retail Super** (about $41,800, no insurance): it starts the SuperStream rollover now and generates the transfer request PDF (`generateTransferRequestPdf`).
- **Southern Cross Industry Super** (about $96,400): it raises an **insurance-loss warning**. Rolling this account over will end Priya's **$520,000 Death & TPD cover**. The rollover is **held** until Hannah and Priya confirm in writing that they understand this, or until replacement cover is in place.
- It tracks the SuperStream service level. A rollover must be completed within **3 business days** of receiving all required information.

> Rory keeps the Southern Cross rollover on hold and adds the insurance question to Cara's adviser update.

---

### 5. Investment Check — Investment Analyst Agent (Ivy)

- The **Investment Analyst Agent** confirms that the Growth model (80/20 growth/defensive) matches the "Growth" risk profile in the SoA dated 28 Oct 2026.
- It reads the model fact sheets (`analyzeFactSheet`) and compares three models on the consolidated $138,200 (`compareModels`). Fees are shown in dollars, not just percentages:

| Model | Growth / defensive | Investment fee (ICR) | Investment fee p.a. | Admin + account-keeping fee p.a. | Total Caldova fees p.a. |
|---|---|---|---|---|---|
| **Growth** (selected in SoA) | 80/20 | 0.42% | $580.44 | $594.60 | **$1,175.04** |
| Balanced | 60/40 | 0.38% | $525.16 | $594.60 | **$1,119.76** |
| Index Balanced | 60/40 (passive) | 0.18% | $248.76 | $594.60 | **$843.36** |

*Admin fee: 0.30% of $138,200 = $414.60, plus the $180 p.a. account-keeping fee. The table excludes the adviser fee and the 0.10% buy/sell spread.*

- It produces the client workbook and chart for Hannah (`generateClientWorkbook`).
- It doesn't recommend a change. The investment choice is Hannah's advice, and the agent's job is to confirm the fit and make the trade-offs visible.

> Ivy sends the workbook to Hannah with a note: "Growth is consistent with the SoA. Fees are in dollars so Priya can see the trade-offs."

---

### 6. Investing the Money — Payments Agent (Penny)

- When each rollover arrives, the **Payments Agent** checks the amount against the rollover benefit statement. It keeps 1% in the Caldova Cash Account and invests the rest in the Growth model.

| Rollover | Amount | Kept in cash (1%) | Invested in Growth |
|---|---|---|---|
| Harbourline Retail Super | $41,800 | $418 | $41,382 |
| Southern Cross Industry Super (after confirmation) | $96,400 | $964 | $95,436 |
| **Total** | **$138,200** | **$1,382** | **$136,818** |

*Amounts are approximate until the final rollover benefit statements arrive.*

---

### 7. Keeping Everyone Informed — Client Communications Agent (Cara)

- The **Client Communications Agent** drafts a **welcome email to Priya**. In plain English, it includes:
  - her member number, `CS-2049817`
  - what is happening with each old fund
  - the fund details (USI `CDV0101AU`) to give her new employer
  - how to re-sign her nomination
- It drafts an **adviser update to Hannah** with two action items:
  1. **Re-sign the BDBN** with two adult witnesses who are not beneficiaries. Until then it is treated as non-binding.
  2. **Confirm the insurance decision**: rolling over Southern Cross ends $520,000 of Death & TPD cover. Confirm in writing, or arrange replacement cover, before that rollover proceeds.
- It runs a compliance check: no personal advice and the required disclosures are included.

> Cara reviews both drafts and sends them.

---

## Outcome

✅ **Account opened** (completed).

- The Harbourline rollover is under way.
- The Southern Cross rollover is held until the insurance decision is confirmed.
- The nomination is treated as non-binding until it is re-signed.
- Both issues were caught **before** any money moved.

## AI Agents Featured

1. Onboarding Agent: extraction, NIGO checklist, opening the case
2. Financial Crime Agent: KYC/AML screening
3. Benefits & Eligibility Agent: s99FA fee consent, BDBN validity, target market fit
4. Transfers & Rollovers Agent: fund lookup, SuperStream rollover, insurance-loss warning
5. Investment Analyst Agent: model fit, fees in dollars, client workbook
6. Payments Agent: investing incoming rollovers and keeping 1% in cash
7. Client Communications Agent: welcome email and adviser update

## Demo Highlight

Shows **NIGO done right the first time**. The agents catch an invalid nomination witness and insurance cover that would be lost on rollover. These are the problems that usually surface weeks later, after money has moved or a family needs the nomination. The adviser gets one clear list of what is still needed.
