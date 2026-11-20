# Scenario 5: Death Benefit Under a Binding Nomination

> Part of **Wealth Team in a Day** — the AI operations office demo for **Caldova Wealth**.

## Scenario Summary

A quiet, careful scenario. A son, acting for himself and his sister, tells Caldova that their mother has died. The scenario shows:

- a compassionate process with a single point of contact
- low-friction document authenticity checks
- validation of a binding death benefit nomination (BDBN)
- death benefit tax for adult children
- a Microsoft Teams approval before each payment
- gentle letters to the family

The agents step back and slow down. Humans approve every payment and every word sent to the family.

## At a Glance

| Item | Detail |
|---|---|
| Case number | `REQ-20261113-OPS005` |
| Request type | Death benefit claim |
| Received | Fri 13 Nov 2026 |
| Priority | High |
| Deceased member | Mei Chen (DOB 05/06/1945), who died on Mon 12 Oct 2026 aged 81. Caldova Pension `CP-3019042` |
| Balance | $486,200 |
| Adviser | Marcus Tan (ADV-20871), Bayside Financial Partners |
| Family contact | Robert Chen (DOB 30/01/1974, age 52), Box Hill, acting for himself and his sister Lily Chen (DOB 11/05/1977, age 49) |
| Nomination | Binding, lapsing. Signed 18 Mar 2024 and valid to 18 Mar 2027. Robert 50%, Lily 50% |
| Reversionary beneficiary | None (Mei's husband died before her) |
| Outcome | ✅ **Completed**: benefit paid to Robert and Lily |
| Neighbourhood zone | Box Hill — Family Home (Robert) ♥ |

---

## Family

**Robert Chen** is the son of the late Mei Chen. He lives in Box Hill.

- He is 52 and is acting for himself and his sister Lily (49).
- Contact: robert.chen@example.com · 0491 570 006.
- He is quiet and grieving, and is the one organising things for the family.

> "Mum always said she'd sorted everything — I just want to do this right for her."

## Life Event

Mei Chen died on 12 Oct 2026, aged 81. She had a Caldova Pension. In March 2024 she made a binding death benefit nomination splitting her super equally between her two children.

On 13 Nov 2026 Robert emails Caldova to let us know. He attaches a certified copy of the death certificate and identification for himself and Lily.

---

## Request Journey

### 1. Notification Received — Onboarding Agent (Olivia)

- The **Onboarding Agent** recognises a **death notification** and marks the case as **sensitive (bereaved family)**:
  - one point of contact
  - no routine surveys or marketing
  - gentle language throughout
- It extracts the deceased member's details, the date of death, the certified death certificate, the beneficiaries' identification and Robert's contact preferences.
- **Pension payments stop** on notification.
- It sets the priority to **High** (bereaved family).
- It opens case `REQ-20261113-OPS005` and routes it to the Team Leader as case owner.

---

### 2. Compassionate Oversight — Team Leader Agent (Theo)

- **Theo takes ownership** of the case. The **Team Leader Agent** keeps the case's progress and any complaint clocks in view, so the family never has to chase.
- Cara is named as the family's single point of contact.

---

### 3. Document Authenticity — Financial Crime Agent (Felix)

- The **Financial Crime Agent** checks the certified death certificate and Robert's and Lily's identification with **Azure Content Understanding**.
- All documents are **genuine** ✓. The risk is low.
- No call-back or extra checks are needed, so the family isn't asked for anything more.

---

### 4. Nomination & Tax Status — Benefits & Eligibility Agent (Ben)

| Rule | Check | Result |
|---|---|---|
| BDBN formalities (SIS reg 6.17A, trust deed) | Signed and dated by Mei on 18 Mar 2024 in front of two adult witnesses who are not named in the nomination, with witness declarations | ✓ |
| Nomination in force | Lapsing nomination, valid for 3 years to 18 Mar 2027. Mei died on 12 Oct 2026 | ✓ |
| Beneficiaries are SIS dependants | Robert and Lily are Mei's children. A child of any age is a SIS dependant | ✓ |
| Proportions | 50% + 50% = 100% | ✓ |
| Trustee discretion | The nomination is binding, so the trustee must pay as nominated | ✓ No discretion |
| Reversionary beneficiary | None. Mei's husband died before her | ℹ |
| Tax dependant status | Adult children who were not financially dependent and had no interdependency relationship are **not** death benefits dependants for tax | ℹ 17% applies to the taxable component |
| Form of payment | Death benefits to non-dependants (for tax) are paid as lump sums. They can't be rolled over | ℹ |

**Recommendation:** pay as nominated, 50% each to Robert and Lily. Cited sources: *Trust-deed rules on death benefits & nominations*, *Tax on super benefits & PAYG withholding*.

---

### 5. Redemption — Investment Analyst Agent (Ivy)

- The **Investment Analyst Agent** redeems the pension's portfolio to cash.
- It notes that market values can move until the sale is complete, so the **final amounts depend on the sale proceeds**.

---

### 6. Payments — Payments Agent (Penny)

`payments_calculateBenefit` splits each share into its tax components. Mei's components are 38% tax-free and 62% taxable. The taxable component (taxed element) is withheld at **17%** (15% + 2% Medicare levy):

| | Robert (50%) | Lily (50%) |
|---|---|---|
| Gross | $243,100.00 | $243,100.00 |
| Tax-free component (38%) | $92,378.00 | $92,378.00 |
| Taxable component, taxed element (62%) | $150,722.00 | $150,722.00 |
| PAYG withholding (17% × $150,722) | $25,622.74 | $25,622.74 |
| **Net payment** | **$217,477.26** | **$217,477.26** |

*Totals: gross $486,200.00; withheld $51,245.48; net $434,954.52. These figures are based on the $486,200 balance. Final amounts depend on the sale proceeds.*

- `payments_validatePayee`: each payment goes to an account in the beneficiary's own name ✓.
- `payments_checkAuthorityLimit`: **every death benefit needs Team Leader approval**.
- `payments_requestApproval`: one Microsoft Teams adaptive card per payment goes to Theo.
- **Theo approves both** in Teams. `payments_releasePayment` then pays Robert and Lily.

---

### 7. Letters — Client Communications Agent (Cara)

- The **Client Communications Agent** drafts gentle **condolence letters** to Robert and Lily. Each letter covers:
  - confirmation of the payment and the date
  - a plain-English explanation of the tax: why 17% applies to the taxable part of the benefit for adult children
  - what happens next and when
  - one name and one phone number to contact
  - their complaint rights: internal dispute resolution first, then AFCA
- Every word sent to a bereaved family is reviewed by a human.

> Cara reviews each letter herself, then calls Robert to let him know the payments are on their way.

---

## Outcome

✅ **Benefit paid** (completed).

- Mei's nomination was honoured exactly: 50% to Robert and 50% to Lily.
- Tax was withheld correctly and explained plainly.
- The family dealt with one person from start to finish.

## AI Agents Featured

1. Onboarding Agent: death notification, sensitive-case handling, stopping pension payments
2. Team Leader Agent: compassionate case ownership and payment approvals
3. Financial Crime Agent: low-friction authenticity check of the death certificate and the beneficiaries' identification
4. Benefits & Eligibility Agent: BDBN validity, SIS dependants and tax status
5. Investment Analyst Agent: redeeming the pension portfolio
6. Payments Agent: tax components for each beneficiary, Teams approval and release
7. Client Communications Agent: condolence letters with a plain-English tax explanation

## Demo Highlight

Shows that AI in operations is not only about speed but about appropriate care. The same agents that move quickly elsewhere here work quietly in the background: they validate the nomination against the rules, get the tax right to the cent, and keep the family's experience simple. People approve every payment and every letter.
