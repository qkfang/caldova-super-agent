# Scenario 3: Retirement — Starting an Account-Based Pension

> Part of **Wealth Team in a Day** — the AI operations office demo for **Caldova Wealth**.

## Scenario Summary

A happy one. A retiring tradesperson's adviser asks Caldova to move most of his super into an account-based pension. The scenario shows:

- rules checks with real numbers: the transfer balance cap, the pro-rated minimum drawdown and the reversionary nomination
- an income strategy with a cash bucket
- an internal transfer with ATO reporting
- a **Microsoft Teams** approval, because the pension commencement is $1 million or more

This is the **golden-path** scenario for the demo (see [agent-demo.md](agent-demo.md)).

## At a Glance

| Item | Detail |
|---|---|
| Case number | `REQ-20261109-OPS003` |
| Request type | Pension commencement |
| Received | Mon 9 Nov 2026, from the adviser |
| Priority | High |
| Member | George Papadopoulos (DOB 03/04/1960, age 66). Caldova Super (Select) `CS-1077881` |
| Spouse | Helen, George's wife (63) |
| Adviser | Marcus Tan (ADV-20871), Bayside Financial Partners, Brighton |
| Balance | $1,284,600 |
| Request | Start a Caldova Pension with **$1,250,000** (new pension account `CP-3077881`). Leave **$34,600** in accumulation. Income **$78,000 p.a.**, paid monthly (**$6,500**). Helen as **reversionary beneficiary** |
| Pension start | Mon 16 Nov 2026 |
| First payment | Tue 15 Dec 2026 |
| Outcome | ✅ **Completed**: pension started |
| Neighbourhood zone | Oakleigh — Retirement (George) 🎉 |

---

## Member

**George Papadopoulos** is a retired electrical contractor from Oakleigh.

- He is 66. His wife, Helen, is 63.
- Contact: georgep@example.com · 0491 570 159.
- He is proud and practical, and a little anxious about "running out".

> "Forty years on the tools — I just want a steady income and to stop worrying."

## Life Event

After forty years as an electrical contractor, George has put down the tools. With his adviser, Marcus Tan, he has decided to turn most of his super into a regular income and keep a small amount in his accumulation account. On 9 Nov 2026 Marcus sends Caldova a pension application.

---

## Request Journey

### 1. Request Received — Onboarding Agent (Olivia)

- The **Onboarding Agent** reads the pension application from Marcus and extracts:
  - the amount to transfer ($1,250,000)
  - the income ($78,000 p.a., monthly)
  - the reversionary nomination (Helen, spouse)
  - the investment instructions
  - the nominated bank account for payments
- NIGO checklist: nothing is missing.
- It sets the priority to **High**: a pension commencement of $1 million or more, due to start on 16 Nov.
- It opens case `REQ-20261109-OPS003` and routes it to Benefits & Eligibility.

---

### 2. Eligibility — Benefits & Eligibility Agent (Ben)

The **Benefits & Eligibility Agent** checks every rule and shows its working:

| Rule | Working | Result |
|---|---|---|
| Condition of release | George is 66. At age 65 his super is unrestricted non-preserved, so no retirement declaration is needed | ✓ Met |
| Transfer balance cap (TBC) | General TBC is **$2.1 million** for 2026-27 (it was $2.0 million in 2025-26). George has no prior transfer balance account, so the $1,250,000 credit leaves **$850,000** of cap space | ✓ Within cap |
| Minimum annual payment | Age 65–74: **5%** × $1,250,000 = **$62,500 p.a.** | ✓ |
| First-year pro-rating | Commencing 16 Nov 2026 leaves 227 of 365 days in FY2026-27: $62,500 × 227 ÷ 365 = $38,869.86, rounded to the nearest $10 = **$38,870** | ✓ |
| Requested income | $78,000 p.a. is above the minimum. Seven monthly payments of $6,500 (15 Dec to 15 Jun) = **$45,500** before 30 Jun 2027, which is above $38,870 | ✓ |
| Reversionary beneficiary | Helen is George's spouse, so a reversionary nomination is permitted | ✓ |
| Tax | George is over 60, so pension payments and retirement-phase earnings are tax-free | ℹ PAYG nil |
| Reporting | The transfer balance credit must be reported to the ATO | ℹ Sent to Transfers & Rollovers |

**Recommendation:** approve. Cited sources: *Pension standards (minimum drawdown table, TBC, reversionary)*, *Conditions of release & preservation*, *Tax on super benefits & PAYG withholding*.

> Ben confirms the working and marks the case eligible.

---

### 3. Income Strategy — Investment Analyst Agent (Ivy)

- The **Investment Analyst Agent** builds an income strategy for Marcus to discuss with George:
  - a **cash bucket** of two years of payments: 2 × $78,000 = **$156,000**, held in the Caldova Cash Account and term deposits
  - the remaining **$1,094,000** in the **Balanced** model portfolio (60/40)
- It compares three income strategies side by side in an Excel workbook with a chart (`compareModels`, `generateClientWorkbook`). For example: cash bucket + Balanced, Balanced only, and cash bucket + Conservative.
- It shows fees in dollars, and how long the cash bucket would keep payments going through a market fall without selling growth assets.
- It doesn't give personal advice. Marcus and George decide; Ivy supplies the numbers.

---

### 4. Internal Transfer & ATO Reporting — Transfers & Rollovers Agent (Rory)

- The **Transfers & Rollovers Agent** prepares the internal transfer of $1,250,000 from accumulation account `CS-1077881` to the new pension account `CP-3077881`. It is scheduled for 16 Nov 2026, once the commencement is approved.
- **$34,600** stays in George's accumulation account.
- It prepares the **transfer balance account report (TBAR)** to tell the ATO about the $1,250,000 transfer balance credit.

---

### 5. Commencement & Payments — Payments Agent (Penny)

1. `payments_checkAuthorityLimit`: a pension commencement of **$1,000,000 or more** needs human approval.
2. `payments_requestApproval`: posts a **Microsoft Teams adaptive card** (`teams_sendApprovalCard`) to Theo, the Team Leader. The card shows George's details, the $1,250,000 amount, the rule checks passed, the income, the reversionary nomination and the first payment date.
3. **Theo approves in Teams.** `payments_getApprovalStatus` returns *approved*.
4. The pension commences on **16 Nov 2026**, and Rory's internal transfer runs.
5. `payments_validatePayee`: George's nominated bank account matches his verified details ✓.
6. `payments_calculateBenefit`: each $6,500 payment is tax-free, so PAYG withholding is nil.
7. Monthly payments of **$6,500** are set up from **15 Dec 2026**.

---

### 6. Confirmation — Client Communications Agent (Cara)

- The **Client Communications Agent** drafts a warm **"welcome to retirement" letter** to George that covers:
  - his pension account `CP-3077881`
  - $6,500 a month from 15 Dec 2026, tax-free
  - Helen as his reversionary beneficiary
  - $34,600 still in his super account
  - this year's minimum of $38,870
  - how to change his payments
- It sends a confirmation to Marcus with the same facts in adviser language.
- It runs a compliance check: plain English, the required disclosures and no personal advice.

> Cara sends both and adds a short congratulatory SMS to George.

---

## Outcome

✅ **Pension started** (completed).

- $1,250,000 moved into Caldova Pension `CP-3077881` on 16 Nov 2026.
- The first payment of $6,500 is due on 15 Dec 2026.
- $850,000 of transfer balance cap space remains.
- The commencement was approved by Theo in Microsoft Teams.

## AI Agents Featured

1. Onboarding Agent: pension application extraction
2. Benefits & Eligibility Agent: condition of release, TBC, pro-rated minimum, reversionary nomination
3. Investment Analyst Agent: cash-bucket income strategy and three-way comparison workbook
4. Transfers & Rollovers Agent: internal transfer and TBAR reporting to the ATO
5. Payments Agent: authority limit, Teams approval, commencement and payment set-up
6. Client Communications Agent: welcome-to-retirement letter and adviser confirmation
7. Team Leader Agent: Theo's approval in Teams

## Demo Highlight

Shows rules-heavy work done in seconds with every number explained and cited: cap space, pro-rated minimums and tax. A human approves in Microsoft Teams before a $1.25 million pension starts. George gets a steady income and a clear letter, and Marcus gets the numbers he needs.
