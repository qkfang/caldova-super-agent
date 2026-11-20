# Scenario 4: Financial Hardship Early Release

> Part of **Wealth Team in a Day** — the AI operations office demo for **Caldova Wealth**.

## Scenario Summary

A member under financial stress asks for early access to his super. The scenario shows:

- precise checks against the severe financial hardship rules
- a **partial approval** at the legal maximum
- vulnerable-member oversight by the Team Leader
- a transparent tax calculation
- a kind, plain-English letter that points to free help

The agents handle the rules; the humans handle the person.

## At a Glance

| Item | Detail |
|---|---|
| Case number | `REQ-20261111-OPS004` |
| Request type | Financial hardship release |
| Received | Wed 11 Nov 2026, direct from the member |
| Priority | High |
| Member | Tom Bradley (DOB 19/08/1979, age 47). Caldova Super (Essential) `CS-1030412`. Direct member, no adviser |
| Balance | $84,300 |
| Requested | $15,000 |
| Approved | **$10,000 gross**, paid as **$7,932 net** on Fri 13 Nov 2026 |
| Outcome | 🟡 **Partially approved** (simulation outcome `partial`) |
| Neighbourhood zone | Lygon St — Café Closed (Tom) 🤝 |

---

## Member

**Tom Bradley** is a former café owner from Lygon Street, Carlton.

- He is 47. His small café closed in mid-2025.
- He has received **JobSeeker** continuously since Mon 6 Apr 2026, which is **31 weeks** by 9 Nov 2026.
- He is behind on his mortgage and utility bills.
- Contact: tom.bradley@example.com · 0491 570 110.
- He is proud, embarrassed and stressed.

> "I never thought I'd need to touch my super — I just need to catch up on the bills."

## Life Event

Tom's café on Lygon Street closed in mid-2025, and he has been on income support since April 2026. With the mortgage and utility bills overdue, he applies to Caldova on 11 Nov 2026 for an early release of **$15,000** on severe financial hardship grounds. He attaches:

- a Services Australia confirmation letter dated **Mon 9 Nov 2026**
- a statutory declaration
- copies of his overdue notices

---

## Request Journey

### 1. Request Received — Onboarding Agent (Olivia)

- The **Onboarding Agent** extracts the application and the Services Australia (Centrelink) letter: the payment type is JobSeeker, it has been continuous since 6 Apr 2026, and the letter is dated 9 Nov 2026.
- NIGO checklist: identity ✓, statutory declaration ✓, overdue notices ✓, bank details ✓.
- It flags Tom as a **vulnerable member** (financial hardship) for human handling, and sets the priority to **High**.
- It opens case `REQ-20261111-OPS004` and routes it to Benefits & Eligibility.

---

### 2. Eligibility — Benefits & Eligibility Agent (Ben)

The **Benefits & Eligibility Agent** checks each criterion:

| Rule | Evidence | Result |
|---|---|---|
| Commonwealth income support received continuously for **26 weeks** | JobSeeker since 6 Apr 2026, which is 31 weeks by 9 Nov 2026 | ✓ |
| Still receiving income support | Services Australia letter dated 9 Nov 2026 | ✓ |
| Confirmation letter is current (within 21 days) | Letter 9 Nov, application 11 Nov: 2 days | ✓ |
| Unable to meet reasonable and immediate family living expenses | Statutory declaration and overdue mortgage and utility notices | ✓ |
| No hardship release in the last 12 months | Account history | ✓ |
| Payment limits: one lump sum of **$1,000 to $10,000 (gross)**, once in any 12-month period | $15,000 requested is more than the $10,000 maximum | ⚠ Capped |

**Recommendation:** **partially approve $10,000 gross**, the legal maximum. The remaining $5,000 can't be released on hardship grounds. Cited sources: *Financial hardship*, *Conditions of release & preservation*.

---

### 3. Vulnerable-Member Review — Team Leader Agent (Theo)

- Partial approvals and hardship releases always need human approval. The **Team Leader Agent** prepares a short brief: Tom's circumstances, the rule checks, why $10,000 is the cap, and tone guidance for the letter.
- **Theo approves the partial release** and asks for the free financial counselling details to be included in the letter.

---

### 4. Redemption — Investment Analyst Agent (Ivy)

- The **Investment Analyst Agent** plans the sale. It draws from cash first and then sells **Balanced** model units to fund the $10,000 gross, keeping the 1% minimum in the Caldova Cash Account.
- It notes the impact: Tom's balance falls from $84,300 to about **$74,300**, before market movements.

---

### 5. Payment — Payments Agent (Penny)

- `payments_checkCaseApproval`: the partial approval from Theo is on file ✓.
- `payments_validatePayee`: the payee name and BSB match Tom's verified bank account ✓.
- `payments_calculateBenefit`: Tom is under 60 and under his preservation age, so the taxable component (taxed element) is withheld at **22%** (20% + 2% Medicare levy).

| Component | Amount |
|---|---|
| Gross payment | $10,000.00 |
| Tax-free component (6%) | $600.00 |
| Taxable component, taxed element (94%) | $9,400.00 |
| PAYG withholding (22% × $9,400) | $2,068.00 |
| **Net payment to Tom** | **$7,932.00** |

- `payments_releasePayment`: **$7,932** is paid to Tom on **Fri 13 Nov 2026**, and **$2,068** is remitted to the ATO.

> Penny: "Gross $10,000, tax withheld $2,068 — $7,932 lands in your account on Friday."

---

### 6. Letter — Client Communications Agent (Cara)

- The **Client Communications Agent** drafts a kind, plain-English letter that explains:
  - what has been approved, and why **$10,000 is the legal maximum** for a hardship release
  - the **tax** and the net amount he will receive
  - the **impact on his retirement savings**
  - **free help**: the National Debt Helpline (**1800 007 007**) and Moneysmart
  - his right to complain (internal dispute resolution, then AFCA), because part of his request couldn't be met
- The letter avoids any hint of judgement and gives no personal financial advice.
- A human reviews it before it is sent (vulnerable member).

> Cara softens one paragraph, adds a direct phone number, and sends it.

---

## Outcome

🟡 **Partially approved** (simulation outcome `partial`).

- $10,000 gross was released and $7,932 net reached Tom on Fri 13 Nov 2026.
- $2,068 was remitted to the ATO.
- The $5,000 above the legal cap was not released.
- Tom has a clear explanation and two free sources of help.

## AI Agents Featured

1. Onboarding Agent: application and Services Australia letter extraction, vulnerable-member flag
2. Benefits & Eligibility Agent: hardship criteria and the $10,000 cap
3. Team Leader Agent: vulnerable-member review and approval of the partial release
4. Investment Analyst Agent: redemption plan (cash first, then Balanced units)
5. Payments Agent: payee check, tax components, PAYG withholding and release
6. Client Communications Agent: plain-English letter with free help

## Demo Highlight

Shows AI applying hardship rules exactly, including the legal $10,000 cap and the 22% withholding, while people stay in charge of the human side: Theo's review, Cara's tone, and a letter that explains the outcome without jargon and points Tom to free, independent help.
