# Super & Wealth Platform Background

> Part of **Wealth Team in a Day** — the AI operations office demo for **Caldova Wealth**.

This primer explains the industry behind the demo. Caldova Wealth and all the people, practices and funds in the demo are fictional. The rules and numbers are real Australian settings for **FY2026-27** (1 July 2026 – 30 June 2027), and their sources are linked.

---

## 1. What Super & Wealth Platforms Do

A **platform**, often called a *wrap*, is the administration engine behind a client's investments. A financial adviser chooses the platform for their clients. The platform then:

- holds the assets
- processes every transaction
- works out tax and reporting
- for super, operates under a trustee that must act in members' best financial interests

| Offer | What it is | Caldova example (fictional) |
|---|---|---|
| Superannuation (accumulation) | Tax-advantaged retirement savings. It covers employer and personal contributions, rollovers from other funds and investment choice, and often includes death and TPD cover | **Caldova Super**, in the Caldova Superannuation Master Fund (USI `CDV0101AU`). Three tiers, each available direct or through an adviser: **Essential** (simple menu: managed portfolios and cash), **Select** (full menu, including term deposits and managed funds) and **Private** (everything in Select plus direct ASX and international equities, and private markets) |
| Pension (retirement phase) | An account-based pension that pays a regular income, with a legislated minimum each year. Earnings and payments are tax-free from age 60 | **Caldova Pension** |
| IDPS ("wrap") | An investor-directed portfolio service for non-super investing by individuals, joint holders, trusts and companies, with one consolidated view and tax report | **Caldova Wrap** |
| Managed accounts | Model portfolios that an investment manager runs and rebalances inside the client's own account | **Caldova Managed Portfolios**: Conservative, Balanced, Growth, High Growth, Index Balanced and Sustainable Growth |
| Cash hub | A cash account inside every account. It pays fees, receives money and funds payments | **Caldova Cash Account** (at least 1% retained) |

**Advisers are the main channel.** Most requests come from an adviser acting for a client, such as a new account, a switch or a pension start, backed by a Statement of Advice (SoA). Direct members deal with the platform themselves. So operations has two audiences for every request: the member or client, and their adviser.

**Who's who.**

- The **trustee** (RSE licensee) runs the super fund. For Caldova, that is Caldova Superannuation Services Pty Ltd.
- The **responsible entity** runs the IDPS. For Caldova, that is Caldova Investments Limited.
- Around them are **advisers** and their licensees, **investment managers**, and **counterparties**: other super funds, SMSFs, other platforms and the ATO.

---

## 2. The Member & Client Lifecycle

> **Join → Contribute & consolidate → Invest → Change → Access & retire → Death benefit**

| Stage | What happens | Typical requests | Caldova departments | Demo scenario |
|---|---|---|---|---|
| **Join** | An adviser or member opens an account: identity and KYC, TFN, investment selection, nominations and adviser fee consent | New account application | Onboarding & Requests, Financial Crime, Benefits & Eligibility | [1: Priya](scenario-1-new-client-onboarding.md) |
| **Contribute & consolidate** | Employer Super Guarantee arrives under Payday Super, personal contributions are made within the caps, and old funds are rolled in | Rollover in, contribution queries | Transfers & Rollovers, Payments | [1: Priya](scenario-1-new-client-onboarding.md) |
| **Invest** | A model portfolio is selected or changed, plus rebalancing and cash management | Switches, model changes, fee comparisons | Investment Solutions | [1: Priya](scenario-1-new-client-onboarding.md), [3: George](scenario-3-retirement-pension.md) |
| **Change** | Contact and bank details, adviser changes, fee renewals and nominations | Change of details, fee consent renewal, new BDBN | Onboarding & Requests, Benefits & Eligibility, Financial Crime | [2: Grace](scenario-2-account-takeover.md) |
| **Access & retire** | A condition of release is met, such as retirement, turning 65 or severe financial hardship | Pension commencement, lump sum, hardship release, rollover out | Benefits & Eligibility, Investment Solutions, Transfers & Rollovers, Payments | [3: George](scenario-3-retirement-pension.md), [4: Tom](scenario-4-financial-hardship.md) |
| **Death benefit** | The member dies, and the benefit goes to dependants or the estate under a valid nomination or the trustee's decision | Death notification, death benefit claim | Every department, overseen by the Team Leader Office | [5: Robert](scenario-5-death-benefit.md) |

Fraud can appear at any stage. It most often shows up as a **Change** (new contact or bank details) quickly followed by **Access** (a withdrawal or rollover), as in Grace's scenario.

---

## 3. The Request Lifecycle Inside Operations

Every request moves through the same five steps, shown on the "Our Process" board in the Caldova office. A request might be an application, a withdrawal, a rollover, a pension commencement or a death notification.

| Step | Question it answers | Caldova departments | Typical checks and controls |
|---|---|---|---|
| **1. Request** | What is being asked, by whom, and for which account? | Onboarding & Requests | Capture every field into the Member Case, classify the request, set its priority and flag vulnerable members |
| **2. Verify** | Is it in good order, and is it really from the member or their authorised adviser? | Onboarding & Requests, Financial Crime | NIGO checklist, ID and KYC, MFA, a call-back on the verified number on file, and document authenticity |
| **3. Assess** | Is it allowed, and exactly what should happen? | Benefits & Eligibility, Investment Solutions | Conditions of release, caps, nominations, adviser fee consent, target market fit, portfolio fit, and income and redemption plans |
| **4. Action** | Is the money moved or paid correctly? | Transfers & Rollovers, Payments | SuperStream, SMSF verification, tax components and PAYG withholding, authority limits and human approval |
| **5. Confirm** | Does everyone know what happened and what comes next? | Client Communications | Plain-English letters and adviser updates, required disclosures and complaint rights |

The **Team Leader Office** oversees all five steps: queues and service levels, complaint (IDR) clocks, approvals, quality sampling and vulnerable members.

**Why NIGO matters.** A request is *not in good order* (NIGO) when something is missing or wrong, such as a signature, a witness, a TFN, a form or an investment selection. A NIGO request can't proceed: money may wait in a holding account while the adviser is chased. Getting requests right the first time is one of the biggest levers in platform operations, and it is where AI extraction and checklists help most.

---

## 4. Key Rules & Numbers (FY2026-27)

These are the settings the agents use. All amounts are in Australian dollars.

### Contributions and caps

| Topic | Rule or number | Source |
|---|---|---|
| Super Guarantee | 12% (from 1 Jul 2025). Maximum contribution base $270,830 (2026-27) | [ATO](https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds/super-guarantee) |
| Payday Super | From 1 Jul 2026, SG must reach the fund within **7 business days** of payday. Funds have **3 business days** to allocate or return contributions | [ATO](https://www.ato.gov.au/businesses-and-organisations/super-for-employers/about-payday-super) |
| Concessional cap | **$32,500** (it was $30,000 in 2024-25 and 2025-26) | [ATO](https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds/contributions-caps) |
| Non-concessional cap | **$130,000**. The bring-forward rule allows up to $390,000 over three years if the total super balance is under $1.84 million | [ATO](https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds/contributions-caps) |
| CGT cap | $1,935,000 | [ATO](https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds/contributions-caps) |
| Division 293 | An extra 15% tax on concessional contributions for people whose income and contributions exceed $250,000 | [ATO](https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds/division-293-tax) |
| Division 296 | Law from 1 Jul 2026. An extra 15% on earnings for balances above $3 million, and a further 10% above $10 million | [ATO](https://www.ato.gov.au/individuals-and-families/super-for-individuals-and-families/super/growing-and-keeping-track-of-your-super/caps-limits-and-tax-on-super-contributions/division-296-tax/division-296-tax-on-large-super-balances) |

### Retirement and access

| Topic | Rule or number | Source |
|---|---|---|
| Transfer balance cap | **$2.1 million** for 2026-27 ($2.0 million in 2025-26). This is the most that can move into the tax-free retirement phase | [ATO](https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds/transfer-balance-cap) |
| Preservation age | **60** for anyone born after 30 Jun 1964 | [ATO](https://www.ato.gov.au/tax-rates-and-codes/schedule-12-tax-table-for-superannuation-lump-sums) |
| Conditions of release | Retirement after preservation age; leaving a job on or after age 60; reaching age 65; transition to retirement (at most 10% a year); death; permanent or temporary incapacity; terminal medical condition | [ATO](https://www.ato.gov.au/tax-and-super-professionals/for-superannuation-professionals/apra-regulated-funds/paying-benefits/releasing-benefits/conditions-of-release) |
| Terminal medical condition | Two registered medical practitioners, at least one of them a specialist, certify that death is likely within 24 months. The lump sum is tax-free | [ATO](https://www.ato.gov.au/individuals-and-families/super-for-individuals-and-families/super/withdrawing-and-using-your-super/early-access-to-super/access-due-to-a-terminal-medical-condition) |
| Severe financial hardship | **26 continuous weeks** of Commonwealth income support. One lump sum of **$1,000 to $10,000** (gross) in any 12 months. The member applies through the fund | [ATO](https://www.ato.gov.au/individuals-and-families/super-for-individuals-and-families/super/withdrawing-and-using-your-super/early-access-to-super/access-due-to-severe-financial-hardship) |
| Compassionate grounds | For example medical treatment, palliative care, funeral costs or preventing foreclosure. The member applies through the ATO | [ATO](https://www.ato.gov.au/individuals-and-families/super-for-individuals-and-families/super/withdrawing-and-using-your-super/early-access-to-super/access-on-compassionate-grounds/access-on-compassionate-grounds-what-you-need-to-know) |
| Account-based pension minimums (by age) | Under 65: 4% · 65–74: **5%** · 75–79: 6% · 80–84: 7% · 85–89: 9% · 90–94: 11% · 95+: 14% of the balance each year. Pro-rated in the first year and rounded to the nearest $10 | [ATO](https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds/payments-from-super) |

### Tax on benefits

| Topic | Rule or number | Source |
|---|---|---|
| Lump sums | Under 60, the taxable component (taxed element) is withheld at **22%** (20% plus 2% Medicare levy). At 60 and over, the taxed element is tax-free | [ATO](https://www.ato.gov.au/tax-rates-and-codes/schedule-12-tax-table-for-superannuation-lump-sums) |
| Death benefits | To a death benefits dependant (for tax): tax-free. To a non-dependant: the taxable component's taxed element is withheld at **17%** (15% plus Medicare levy) and the untaxed element at 32%. It is paid as a lump sum only and can't be rolled over | [ATO](https://www.ato.gov.au/individuals-and-families/super-for-individuals-and-families/super/withdrawing-and-using-your-super/superannuation-death-benefits) |
| Who is a dependant | **SIS dependant:** spouse or de facto, a child of any age, or someone in an interdependency relationship. **Tax dependant:** spouse or former spouse, a child under 18, a financial dependant, or someone in an interdependency relationship | [ATO](https://www.ato.gov.au/individuals-and-families/super-for-individuals-and-families/super/withdrawing-and-using-your-super/superannuation-death-benefits) |

### Nominations, rollovers and adviser fees

| Topic | Rule or number | Source |
|---|---|---|
| Binding death benefit nomination (BDBN) | SIS reg 6.17A. It must be written, signed and dated by the member in front of **two witnesses aged 18 or over who are not named in it**, with witness declarations. It can only name the legal personal representative or SIS dependants. It lapses after **3 years** unless the trust deed allows non-lapsing nominations. (Caldova's are lapsing, 3 years) | [SIS Regulations](https://www.legislation.gov.au/F1996B00580/latest/text) |
| Rollover timing | Complete within **3 business days** of receiving all required information (SIS reg 6.34A) | [ATO](https://www.ato.gov.au/businesses-and-organisations/super-for-employers/managing-superstream/in-detail/rollovers/superstream-rollover-v3-supporting-information) |
| SMSF verification service (SVS) | Required before any rollover to an SMSF (SIS reg 6.33E). It checks that the ABN is a registered SMSF and its compliance status, that the member's TFN is linked and not compromised, that there is no date of death, and that the bank details and electronic service address (ESA) match | [ATO](https://www.ato.gov.au/businesses-and-organisations/super-for-employers/managing-superstream/in-detail/rollovers/smsf-verification-service) |
| Adviser fees from super | SIS s99FA. Only for personal advice, and only with the member's **written** request or consent, held by the trustee. The best-interests duty and the sole purpose test still apply | [SIS Act](https://www.legislation.gov.au/C2004A04633/latest/text) |
| Ongoing fee arrangements | Written consent is needed to enter, renew and deduct. The renewal window runs from **60 days before to 150 days after** the reference day. The arrangement ends if it isn't renewed | [ASIC](https://asic.gov.au/regulatory-resources/financial-services/giving-financial-product-advice/fees/faqs-ongoing-fee-arrangements-and-consents) |

### Complaints, financial crime and prudential standards

| Topic | Rule or number | Source |
|---|---|---|
| Internal dispute resolution (IDR) | ASIC RG 271 sets three timeframes. **30** calendar days is the standard. **45** days applies to super trustee complaints. **90** days applies to death-benefit distribution complaints, counted from the end of the 28-day objection period. After IDR, the complaint can go to **AFCA** | [ASIC RG 271](https://download.asic.gov.au/media/3olo5aq5/rg271-published-2-september-2021.pdf) |
| AML/CTF reforms | Reformed obligations for existing reporting entities from **31 Mar 2026** | [AUSTRAC](https://www.austrac.gov.au/news-and-media/article/changes-amlctf-obligations-what-you-need-do) |
| Suspicious matter reports (SMRs) | Due within **3 business days** (24 hours for terrorism financing) | [AUSTRAC](https://www.austrac.gov.au/industry-and-business/obligations-and-guidance/your-amlctf-program/reporting-us/suspicious-matter-reports) |
| Strong authentication | APRA expects MFA, or equivalent, for changes of member details, withdrawals, rollovers and investment switches | [APRA](https://www.apra.gov.au/news-and-publications/action-information-security-obligations-and-critical-authentication-controls) |
| Prudential standards | CPS 230 operational risk management (from 1 Jul 2025). SPS 515 strategic planning and member outcomes. The Retirement Income Covenant (from 1 Jul 2022) | [CPS 230](https://www.apra.gov.au/standards/cps-230) · [SPS 515](https://www.apra.gov.au/standards/sps-515) · [Retirement Income Covenant](https://handbook.apra.gov.au/faq/651/retirement-income-covenant-0) |
| Performance test | Your Future, Your Super performance test, 2026: 12 of 547 products failed | [APRA](https://www.apra.gov.au/news-and-publications/apra-releases-2026-superannuation-performance-test-and-product-insights) |

### Financial crime patterns and controls

Patterns that regulators warn super funds about:

- **Account takeover.** Third parties access an account, change the contact and payment details, then withdraw or roll over the money. ([AUSTRAC indicators](https://www.austrac.gov.au/industry-and-business/education-and-resources/publications-and-resources/indicators-suspicious-activity-superannuation-sector))
- **New SMSFs set up to receive stolen benefits.** The ATO sends members SMSF rollover alerts and change-of-details alerts. ([ATO SMSF alerts](https://www.ato.gov.au/individuals-and-families/super-for-individuals-and-families/self-managed-super-funds-smsf/smsf-administration-and-reporting/notify-us-of-changes-to-your-smsf/smsf-alerts))
- **Hardship fraud.** Fake hardship documents, or a failed hardship application followed by an SMSF rollover from a member who knows little about SMSFs. ([AUSTRAC indicators](https://www.austrac.gov.au/industry-and-business/education-and-resources/publications-and-resources/indicators-suspicious-activity-superannuation-sector))
- **Illegal early release promoters.** ([ATO](https://www.ato.gov.au/individuals-and-families/super-for-individuals-and-families/super/withdrawing-and-using-your-super/early-access-to-super/illegal-early-access-to-super))
- **Pushy super-switching lead generators**, such as a "free super health check". ([ASIC](https://asic.gov.au/about-asic/news-centre/find-a-media-release/2025-releases/25-120mr-consumer-alert-asic-warns-about-pushy-sales-tactics-urging-people-to-make-quick-superannuation-switches))
- **Elder financial abuse.** Someone impersonates an older member, or coerces them into rolling over to an SMSF the perpetrator controls. ([AFCA](https://www.afca.org.au/media/2344/download))

Controls used in the demo:

- call back on the **verified number on file**, never the number in the request
- hold requests after a recent change of details
- dual approval for new payees
- pay only to nominated or linked accounts
- SVS and ESA checks before any SMSF rollover
- step-up verification (an SMS code) for payments
- lodge SMRs within 3 business days

The hold and call-back controls are industry practice rather than regulator text. A hold must still respect the 3-business-day rollover rule, which only starts once all required information has been received.

---

## 5. Regulators and Bodies

| Body | Role | Where it shows up in the demo |
|---|---|---|
| **APRA** (Australian Prudential Regulation Authority) | Prudential regulator of super trustees (RSE licensees). Sets standards such as CPS 230 and SPS 515, runs the annual performance test, and sets authentication expectations | Theo's oversight; Felix's controls |
| **ASIC** (Australian Securities & Investments Commission) | Conduct and disclosure regulator. Covers licensing, PDS and design and distribution obligations (TMDs), advice fees and ongoing fee arrangements, and IDR standards (RG 271) | Ben's fee-consent and TMD checks; Cara's disclosures; Theo's IDR clocks |
| **ATO** (Australian Taxation Office) | Super tax rules and caps, SMSF regulation, SuperStream, the SMSF verification service, transfer balance reporting, PAYG withholding and compassionate release | Rory's SVS checks and transfer balance reporting; Penny's withholding; Ben's caps |
| **AUSTRAC** (Australian Transaction Reports and Analysis Centre) | AML/CTF regulator and financial intelligence unit. Sets KYC obligations and receives suspicious matter reports | Felix |
| **AFCA** (Australian Financial Complaints Authority) | External dispute resolution, once IDR is complete or the IDR timeframe has passed | Cara's letters; Theo's complaint clocks |

Services Australia (Centrelink) is not a regulator. Its income-support confirmation letters are the key evidence for hardship releases, as in Tom's scenario.

---

## 6. Presenter Notes — Why This Matters for Netwealth

> **For presenters only.** This is the only place in the demo where a real company is named. The demo itself always uses the fictional **Caldova Wealth**. Never use Netwealth's name, logo, products or address in the UI. Keep any mention factual and neutral.

### Who they are

- A Melbourne-based wrap platform, super trustee and administrator. Head office is Level 6, 180 Flinders Street, opposite Flinders Street Station. ([ASX announcement](https://company-announcements.afr.com/asx/nwl/d468dede-7989-11f1-b916-36992b3febfd.pdf), [building](https://www.coworkinghub.com/au_melbourne/en/building/180-flinders-street/19310))
- FY26 results (year to 30 Jun 2026) ([FY26 results announcement](https://announcements.asx.com.au/asxpdf/20260826/pdf/0737548x65k5gr.pdf)):
  - funds under administration (FUA) of **$135.7B**, up 20.3%
  - **182,276** accounts
  - **4,205** intermediaries
  - net flows of **$15.4B**
- About **7th by FUA** but **2nd by 12-month net flows**, based on Plan For Life data. The net-flow ranking was read from a partly image-based slide, so treat it as indicative. ([FY26 ASX release, p.9](https://announcements.asx.com.au/asxpdf/20260826/pdf/073763hc7b8jtn.pdf), [Plan For Life, June 2026](https://www.pflresearch.com/news/2026/10/12/platforms-funds-under-management-rose-1194bn-over-year-to-june-2026))
- Products: Wealth Accelerator (IDPS), Super Accelerator (super and pension, with Core and Plus tiers), Managed Account Service and Netwealth Private. ([trustee report](https://www.netwealth.com.au/web/media/emfcoech/20251219-annual-trustee-report-2025-final.pdf), [Accelerator Core](https://www.netwealth.com.au/web/personal/accelerator-core/), [FY26 ASX release, p.38](https://announcements.asx.com.au/asxpdf/20260826/pdf/073763hc7b8jtn.pdf), [FY26 ASX release, p.9](https://announcements.asx.com.au/asxpdf/20260826/pdf/07374n490bdt7q.pdf))
- The trustee is Netwealth Superannuation Services Pty Ltd, with about **115,000** super member accounts. ([APRA](https://www.apra.gov.au/news-and-publications/apra-accepts-court-enforceable-undertaking-netwealth))
- Ranked **#1 for service** in Investment Trends' 2025 platform benchmarking. Service quality is part of the brand, and much of it is delivered by operations. ([Adviser Voice](https://www.adviservoice.com.au/2026/02/platforms-lift-the-bar-as-adviser-expectations-surge-hub24-retains-leadership/))

### Their AI journey

- **NOVA** (Netwealth Online Virtual Assistant) is their first client-facing generative AI assistant. It answers how-to questions from approved Knowledge Centre content and hands over to a person with the full history. By August 2026 it handled about **50%** of external how-to queries. ([LinkedIn](https://www.linkedin.com/posts/netwealth-investments-limited_say-hello-to-nova-our-new-ai-assistant-activity-7458000068743380992-Wdtj), [FY26 ASX release, p.20](https://announcements.asx.com.au/asxpdf/20260826/pdf/073763hc7b8jtn.pdf))
- Other AI and data work: enterprise Copilot for every employee, GitHub Copilot, a first AI Governance Policy, a Snowflake migration and the Netwealth Unify data platform. ([FY26 ASX release, pp.17 and 41](https://announcements.asx.com.au/asxpdf/20260826/pdf/07374n490bdt7q.pdf))
- FY26 automation themes: digital IDPS account opening, automated super-to-pension transfers, enhanced AML/KYC and workflow automation. ([FY26 results announcement, p.7](https://announcements.asx.com.au/asxpdf/20260826/pdf/0737548x65k5gr.pdf))

**How to position the demo.** NOVA answers "how do I…?" questions at the front door. *Wealth Team in a Day* shows one possible next step: specialist agents working **inside** operations on the case itself, with a person approving every material decision. The scenarios line up with their stated themes:

| Scenario | Their theme |
|---|---|
| Scenario 1 (Priya) | Digital account opening |
| Scenario 2 (Grace) | Enhanced AML/KYC |
| Scenario 3 (George) | Super-to-pension automation |

### Operations pain points the demo speaks to

| Pain point | What the public record shows | Where the demo shows it |
|---|---|---|
| NIGO applications | Money from incomplete super applications can be held for up to 30 days ([fund information guide](https://netwealth.zendesk.com/hc/en-us/articles/16477745931663-Netwealth-Superannuation-Master-Fund-Information-Guide-1a)) | Scenario 1: Olivia's NIGO checklist |
| Claims & estates | The team leader role for this area covers deceased accounts (Wrap and Super), permanent incapacity, terminal illness and hardship ([job ad](https://jobs.ashbyhq.com/netwealth/4c53da0d-4f93-41bb-941e-266a56103dc2)). The hard parts are BDBN validity, dependants, probate and insurer back-and-forth | Scenario 5: Ben's BDBN and dependant checks. Scenario 4: hardship |
| Account security vs friction | A new bank account needs approval from a second adviser administrator. Withdrawals above $5,000 need a client SMS plus a six-digit code ([withdrawal guide](https://netwealth.zendesk.com/hc/en-us/articles/8622670609039-How-do-I-process-a-withdrawal-for-a-client)) | Scenario 2: Felix stops a takeover without adding friction for genuine members |
| Super-to-pension transfers | An FY26 automation theme | Scenario 3: George |
| Payday Super | Funds have 3 business days to allocate or return contributions ([ATO](https://www.ato.gov.au/businesses-and-organisations/super-for-employers/about-payday-super)) | Rory and Penny: timing of money in |
| Rollover service levels | 3 business days once all information is received ([ATO](https://www.ato.gov.au/businesses-and-organisations/super-for-employers/managing-superstream/in-detail/rollovers/superstream-rollover-v3-supporting-information)) | Scenarios 1 and 2: Rory |
| Adviser fee renewals | The renewal window opens 60 days before the reference date and closes 150 days after. Pending consents last 60 days ([advice fee guide](https://netwealth.zendesk.com/hc/en-us/articles/18352656999567-How-do-I-add-change-or-renew-an-advice-fee)) | Scenario 1: Ben's s99FA check |
| Complaint clocks | IDR timeframes of 30, 45 and 90 days ([ASIC RG 271](https://download.asic.gov.au/media/3olo5aq5/rg271-published-2-september-2021.pdf)) | Theo's dashboard |
| AML/CTF reforms | Reformed obligations from 31 Mar 2026 ([AUSTRAC](https://www.austrac.gov.au/news-and-media/article/changes-amlctf-obligations-what-you-need-do)) | Scenario 2: Felix |

### Governance context: handle with care

**Program RISE** is Netwealth's governance uplift program, which covers investment-menu due diligence and monitoring. It follows the 2024 failures of high-risk investment options on its super menu, and an APRA court-enforceable undertaking accepted in December 2025. ([APRA undertaking](https://www.apra.gov.au/system/files/2026-01/Enforceable%20Undertaking%20-%20Netwealth%20Superannuation%20Services%20Pty%20Ltd.pdf), [ASIC](https://asic.gov.au/about-asic/news-centre/find-a-media-release/2026-releases/26-197mr-federal-court-declares-netwealth-contravened-the-corporations-act-in-relation-to-first-guardian))

Don't build the story around this. If it comes up, the respectful link is governance. Ivy's knowledge of the model menu and Theo's oversight show how agents can assemble evidence and check product fit, while people make the investment-menu decisions.

### Don't overstate

- **That Netwealth uses Azure.** This hasn't been publicly confirmed; it appears only in a vendor case study.
- **That Caldova copies Netwealth's structure.** Netwealth's internal structure isn't public. Caldova's departments are a plausible model of platform operations, not a copy.
- **A "default fund" storyline.** Netwealth's super fund has no MySuper authorisation, so it doesn't receive default employer contributions. ([trustee report](https://www.netwealth.com.au/web/media/emfcoech/20251219-annual-trustee-report-2025-final.pdf))
