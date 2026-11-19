namespace CaldovaSuper.App.Models;

/// <summary>
/// One step in a scripted member-case scenario. Each step is owned by a
/// specific AI agent in the operations office and lists the actions that
/// agent carries out at that stage of the journey.
/// </summary>
public record ScenarioStep(
    int Number,
    string Title,
    string AgentName,
    string AgentIcon,
    string Summary,
    IReadOnlyList<string> Actions);

/// <summary>
/// Metadata and walkthrough for one of the five scripted Caldova Wealth demo
/// scenarios. Rendered by <c>Components/Pages/Scenarios/Scenario.razor</c>
/// and listed in the NavMenu and on the home page.
/// </summary>
public record ScenarioDefinition(
    string Id,
    string Number,
    string Title,
    string ShortTitle,
    string Customer,
    string Persona,
    string Tagline,
    string Flavor,
    string LifeEvent,
    string CaseNumber,
    string Outcome,
    IReadOnlyList<string> AgentsFeatured,
    string DemoHighlight,
    IReadOnlyList<ScenarioStep> Steps,
    string Icon,
    string Accent);

/// <summary>
/// Static catalog of the five Caldova Wealth demo scenarios. Mirrors the
/// scripts in <c>docs/scenario-1..5</c>, the seeded cases in
/// <c>CaseStore.SeedDefaults</c> and the 3D frontend scenario files.
/// </summary>
public static class ScenarioCatalog
{
    private const string Onboarding = "Onboarding Agent";
    private const string Benefits = "Benefits & Eligibility Agent";
    private const string Investments = "Investment Analyst Agent";
    private const string FinCrime = "Financial Crime Agent";
    private const string Transfers = "Transfers & Rollovers Agent";
    private const string Payments = "Payments Agent";
    private const string Comms = "Client Communications Agent";
    private const string Leader = "Team Leader Agent";

    public static IReadOnlyList<ScenarioDefinition> All { get; } = new[]
    {
        // ── 1. Priya — new client onboarding & consolidation ────────────────
        new ScenarioDefinition(
            Id: "new-client-onboarding",
            Number: "1",
            Title: "New Client Onboarding & Super Consolidation",
            ShortTitle: "New client onboarding",
            Customer: "Priya Natarajan",
            Persona: "Priya Natarajan — new advised client (via Yarra Private Wealth)",
            Tagline: "An adviser's application pack becomes a clean, compliant account in one pass.",
            Flavor: "Adviser-led onboarding onto Caldova Super with two external funds to consolidate. Showcases document extraction, the NIGO checklist, KYC screening, rule checks with citations, an insurance-loss warning before a rollover, a fee comparison in dollars and coordinated member + adviser communications.",
            LifeEvent: "Priya, 34, has just started a new job at a Docklands fintech. Her adviser, Hannah Lewis of Yarra Private Wealth, sends Caldova an application pack: a new Caldova Super (Select) account invested in the Growth model, consolidation of Southern Cross Industry Super (~$96,400, holding $520,000 of Death & TPD cover) and Harbourline Retail Super (~$41,800), a binding nomination for her partner Arjun, and a $3,300 p.a. ongoing advice fee from super.",
            CaseNumber: "REQ-20261103-DEMO01",
            Outcome: "Account opened ✅",
            AgentsFeatured: new[] { Onboarding, FinCrime, Benefits, Transfers, Investments, Payments, Comms },
            DemoHighlight: "Shows agents catching the two NIGO issues that usually cost days of back-and-forth — a one-witness nomination and an un-ticked insurance acknowledgement — and protecting Priya from losing $520,000 of insurance cover by accident.",
            Steps: new[]
            {
                new ScenarioStep(1, "Application received", Onboarding, "📥",
                    "Hannah Lewis emails Priya's application pack to Caldova New Business.",
                    new[]
                    {
                        "Read the adviser email plus the application, nomination and fee-consent forms.",
                        "Extract Priya's details, Select tier, Growth model, two external funds and the $3,300 p.a. adviser fee.",
                        "Confirm ID was verified via DVS and the TFN is supplied (masked *** *** 418).",
                        "Flag two NIGO items: the binding nomination has only one witness, and the Southern Cross insurance-loss acknowledgement isn't ticked.",
                        "Open member CS-2049817 and case REQ-20261103-DEMO01; route to Financial Crime and Benefits & Eligibility.",
                    }),
                new ScenarioStep(2, "KYC & AML screening", FinCrime, "🛡️",
                    "Screen the new member before any money moves.",
                    new[]
                    {
                        "Run PEP and sanctions screening — no matches.",
                        "Confirm the identity verification method (DVS) meets Caldova's KYC standard.",
                        "Record a Low risk rating, with reasons, on the case.",
                    }),
                new ScenarioStep(3, "Rules check", Benefits, "📋",
                    "Check the application against the PDS, trust deed and super law.",
                    new[]
                    {
                        "Adviser fee consent meets SIS s99FA — written, signed, amount, services and a 12-month term.",
                        "Binding nomination fails SIS reg 6.17A — it needs two adult witnesses who are not beneficiaries; treat it as non-binding until re-signed.",
                        "Growth model is consistent with the SoA risk profile and the product's target market.",
                        "Recommend: open the account and request a re-signed nomination.",
                    }),
                new ScenarioStep(4, "Consolidation", Transfers, "🔁",
                    "Bring Priya's old super across — without losing cover by accident.",
                    new[]
                    {
                        "Look up Southern Cross Industry Super (SCI0001AU) and Harbourline Retail Super (HRB0007AU) in the fund directory.",
                        "Request the Harbourline rollover (~$41,800) via SuperStream now — due within 3 business days.",
                        "Hold the Southern Cross rollover (~$96,400): it would end $520,000 of Death & TPD cover, so the adviser must confirm or arrange replacement cover first.",
                        "Generate the transfer request PDF for the file.",
                    }),
                new ScenarioStep(5, "Portfolio fit & fees", Investments, "📈",
                    "Confirm the Growth model and show the fees in dollars.",
                    new[]
                    {
                        "Confirm Growth (80/20) matches the SoA's Growth risk profile.",
                        "Compare total annual cost on $138,200: Growth ≈ $1,175, Balanced ≈ $1,120, Index Balanced ≈ $843 (admin + investment fees).",
                        "Generate the client workbook with the comparison table and chart for Hannah.",
                    }),
                new ScenarioStep(6, "Invest on arrival", Payments, "💳",
                    "Invest incoming money as it lands.",
                    new[]
                    {
                        "Match each rollover receipt to the case.",
                        "Invest into the Growth model, keeping 1% in the Caldova Cash Account for fees.",
                        "Set up the $275 monthly adviser-fee deduction under the signed consent.",
                    }),
                new ScenarioStep(7, "Welcome & adviser update", Comms, "✉️",
                    "Tell Priya and Hannah exactly where things stand.",
                    new[]
                    {
                        "Send Priya a welcome email with her member number and what happens next.",
                        "Send Hannah an update: Harbourline requested; Southern Cross on hold pending insurance confirmation; nomination needs a second witness.",
                        "Plain English, no advice, contact details and complaint rights included.",
                    }),
            },
            Icon: "💼",
            Accent: "#0ea5e9"),

        // ── 2. Grace — identity takeover & fake SMSF rollover blocked ───────
        new ScenarioDefinition(
            Id: "account-takeover-blocked",
            Number: "2",
            Title: "Identity Takeover & Fake SMSF Rollover — Blocked",
            ShortTitle: "Account takeover blocked",
            Customer: "Grace Williams",
            Persona: "Grace Williams — member travelling overseas",
            Tagline: "A full-balance rollover to a nine-day-old SMSF is stopped before a cent leaves.",
            Flavor: "Financial-crime scenario where the member is the victim. Showcases timeline reconstruction, ID-document authenticity checks, ATO SMSF verification (SVS), an explainable risk score, human approval of the block and a call-back on the verified number.",
            LifeEvent: "Grace, 63, a retired school principal from Williamstown, is travelling through Italy. While she's away, a caller impersonating her changes her mobile and email by phone (2 November), sets up online access from a new device in Sydney (3 November), then requests a rollover of her entire $612,400 balance to 'GW Family Superannuation Fund' — an SMSF registered nine days earlier, paying an account in another name.",
            CaseNumber: "REQ-20261106-DEMO02",
            Outcome: "Request blocked 🛡️",
            AgentsFeatured: new[] { Onboarding, Benefits, FinCrime, Transfers, Leader, Payments, Comms },
            DemoHighlight: "Shows agents joining the dots in minutes — a phone change, a new device, a brand-new SMSF and a doctored licence — while humans make the call and Grace's $612,400 stays exactly where it is.",
            Steps: new[]
            {
                new ScenarioStep(1, "Rollover request received", Onboarding, "📥",
                    "An 'urgent' email asks to roll Grace's whole balance to an SMSF.",
                    new[]
                    {
                        "Read the email and rollover form — full balance (~$612,400) to 'GW Family Superannuation Fund'.",
                        "Notice it came from an email address changed on 02/11/2026, and asks not to use the 'old' number.",
                        "Flag NIGO: SVS not run, payee name mismatch, signature differs from the specimen, pressure to act urgently.",
                        "Set priority Urgent and route to Benefits & Eligibility and Financial Crime — no processing.",
                    }),
                new ScenarioStep(2, "Rollover rules", Benefits, "📋",
                    "Check the rules for a rollover to an SMSF.",
                    new[]
                    {
                        "A rollover to an SMSF must pass the ATO SMSF verification service (SVS) first.",
                        "SVS result: the ABN is a registered SMSF, but Grace's TFN is not linked to it and the bank details and ESA don't match.",
                        "Recommendation: do not process — refer to Financial Crime.",
                    }),
                new ScenarioStep(3, "Account-takeover investigation", FinCrime, "🛡️",
                    "Join up the timeline and the documents.",
                    new[]
                    {
                        "Timeline: phone call changes mobile and email (02/11, 10:42) → new device in Sydney (03/11, 21:14) → full-balance rollover request (06/11).",
                        "Compare with the travel notice on file: Grace is in Italy.",
                        "Licence image: altered date-of-birth font and missing hologram — verdict fake.",
                        "Risk HIGH (92/100), every indicator explained without accusing anyone.",
                        "Recommend: hold, lock online access, call back on the pre-change verified number, IDCARE referral; consider an SMR to AUSTRAC within 3 business days.",
                    }),
                new ScenarioStep(4, "Hold the rollover", Transfers, "🔁",
                    "Stop the money leaving while the request is verified.",
                    new[]
                    {
                        "Place the outbound SuperStream rollover on hold — the 3-business-day clock only runs once all required information is received and verified.",
                        "Record the SVS failure and the hold reason on the case; nothing is sent to the receiving fund.",
                    }),
                new ScenarioStep(5, "Approve the block", Leader, "🧭",
                    "A human decides.",
                    new[]
                    {
                        "Review Felix's evidence pack and approve the block.",
                        "Approve SMR lodgement by the AML/CTF compliance officer (kept confidential).",
                        "Restore Grace's pre-change contact details and assign Cara to reach her.",
                    }),
                new ScenarioStep(6, "Funds protected", Payments, "💳",
                    "Make sure no money moves.",
                    new[]
                    {
                        "Confirm no funds left the account — $612,400 remains invested.",
                        "Cancel the pending payment instruction to 'G Williams Holdings Pty Ltd'.",
                        "Add a payment block until Grace re-verifies her identity.",
                    }),
                new ScenarioStep(7, "Contact Grace", Comms, "✉️",
                    "Reach the real Grace on details we already trust.",
                    new[]
                    {
                        "Email and call Grace on her pre-change verified details — never the new ones.",
                        "Grace confirms from Florence that she never asked to move her super.",
                        "Explain calmly: account secured, details restored, credentials reset, IDCARE support offered.",
                        "No mention of any SMR — it stays confidential.",
                    }),
            },
            Icon: "🛡️",
            Accent: "#ef4444"),

        // ── 3. George — retirement: account-based pension ───────────────────
        new ScenarioDefinition(
            Id: "retirement-pension",
            Number: "3",
            Title: "Retirement — Starting an Account-Based Pension",
            ShortTitle: "Retirement pension",
            Customer: "George Papadopoulos",
            Persona: "George Papadopoulos — retiring member (via Bayside Financial Partners)",
            Tagline: "From forty years on the tools to a steady, tax-free income.",
            Flavor: "Retirement scenario showcasing the rules engine: condition of release, the 2026-27 transfer balance cap, pro-rated minimum drawdowns, reversionary nominations, a cash-bucket income strategy and a Teams approval before a $1.25 million pension starts.",
            LifeEvent: "George, 66, has retired from his electrical contracting business in Oakleigh. His adviser, Marcus Tan, asks Caldova to move $1,250,000 into an account-based pension paying $78,000 a year monthly, with his wife Helen as reversionary beneficiary, leaving about $34,600 in accumulation.",
            CaseNumber: "REQ-20261109-DEMO03",
            Outcome: "Pension started ✅",
            AgentsFeatured: new[] { Onboarding, Benefits, Investments, Transfers, Payments, Leader, Comms },
            DemoHighlight: "Shows the calculations people usually do by hand — condition of release, $850,000 of cap space left under the $2.1m cap, a $38,870 pro-rated minimum, a two-year cash bucket — all cited, checked and approved in one sitting.",
            Steps: new[]
            {
                new ScenarioStep(1, "Pension application received", Onboarding, "📥",
                    "Marcus Tan emails George's signed pension application.",
                    new[]
                    {
                        "Extract: $1,250,000 to pension from CS-1077881, $78,000 p.a. paid monthly, Helen as reversionary beneficiary, start 16/11/2026.",
                        "Confirm no existing retirement-phase income streams are declared.",
                        "Open case REQ-20261109-DEMO03 and flag that Team Leader approval is needed (≥ $1,000,000).",
                    }),
                new ScenarioStep(2, "Eligibility & caps", Benefits, "📋",
                    "Apply the pension rules — and cite them.",
                    new[]
                    {
                        "Condition of release: George is 66 — age 65 met; his benefits are unrestricted non-preserved.",
                        "Transfer balance cap: a $1,250,000 credit is within the $2.1 million general cap for 2026-27 — $850,000 of cap space remains.",
                        "Minimum drawdown: 5% at age 66 = $62,500 a year; pro-rated for 227 days from 16 November = $38,870 for 2026-27. $78,000 a year is well above it.",
                        "Reversionary beneficiary: Helen is his spouse — eligible.",
                        "Tax: pension payments are tax-free from age 60, and retirement-phase earnings are tax-free.",
                    }),
                new ScenarioStep(3, "Income strategy", Investments, "📈",
                    "Make the income dependable.",
                    new[]
                    {
                        "Hold two years of payments ($156,000) in cash and term deposits.",
                        "Invest the remaining $1,094,000 in the Balanced model.",
                        "Compare three income structures and explain sequencing risk in plain English.",
                        "Generate the workbook for Marcus.",
                    }),
                new ScenarioStep(4, "Pension transfer", Transfers, "🔁",
                    "Move the money into the pension phase.",
                    new[]
                    {
                        "Transfer $1,250,000 from accumulation CS-1077881 to pension CP-3077881 on 16/11/2026.",
                        "Leave $34,600 in accumulation.",
                        "Report the transfer balance credit to the ATO.",
                    }),
                new ScenarioStep(5, "Approve, commence & pay", Payments, "💳",
                    "Start the pension — after a human says yes.",
                    new[]
                    {
                        "Validate the payee — a joint account in George's name.",
                        "Raise a Microsoft Teams approval (commencement ≥ $1,000,000); Theo approves.",
                        "Commence the pension on 16/11/2026; first payment of $6,500 on 15/12/2026, no tax withheld.",
                    }),
                new ScenarioStep(6, "Welcome to retirement", Comms, "✉️",
                    "Celebrate the milestone, clearly.",
                    new[]
                    {
                        "Send George a warm 'welcome to retirement' letter with his payment schedule.",
                        "Send Marcus a confirmation with the minimum drawdown and remaining cap space.",
                        "Explain that the minimum is recalculated every 1 July.",
                    }),
            },
            Icon: "🎉",
            Accent: "#f59e0b"),

        // ── 4. Tom — financial hardship early release ───────────────────────
        new ScenarioDefinition(
            Id: "financial-hardship",
            Number: "4",
            Title: "Financial Hardship — Early Release of Super",
            ShortTitle: "Financial hardship",
            Customer: "Tom Bradley",
            Persona: "Tom Bradley — member in financial hardship (direct)",
            Tagline: "Every hardship rule applied — with precision and kindness.",
            Flavor: "Vulnerable-member scenario showcasing hardship criteria, the $10,000 statutory cap (partial approval), tax-component and PAYG calculations, a human review and a genuinely kind letter with free support options.",
            LifeEvent: "Tom, 47, closed his Lygon Street café last year and has been on JobSeeker since April. Behind on his mortgage and power bill, he applies late at night to withdraw $15,000 from his $84,300 super balance on severe financial hardship grounds.",
            CaseNumber: "REQ-20261111-DEMO04",
            Outcome: "Partially approved — $10,000 🟡",
            AgentsFeatured: new[] { Onboarding, Benefits, Leader, Investments, Payments, Comms },
            DemoHighlight: "Shows agents getting the hard parts exactly right — 26-week test, 21-day letter, the $10,000 cap, $2,068 withheld, $7,932 paid — and a letter Tom will actually understand.",
            Steps: new[]
            {
                new ScenarioStep(1, "Hardship application received", Onboarding, "📥",
                    "Tom's late-night email arrives with his Centrelink letter.",
                    new[]
                    {
                        "Extract: $15,000 requested, JobSeeker since 06/04/2026, Services Australia letter dated 09/11/2026, balance $84,300.",
                        "Flag vulnerability (financial stress) and that $15,000 exceeds the $10,000 maximum.",
                        "Open case REQ-20261111-DEMO04 with High priority.",
                    }),
                new ScenarioStep(2, "Hardship criteria", Benefits, "📋",
                    "Apply the severe financial hardship rules.",
                    new[]
                    {
                        "26 continuous weeks of Commonwealth income support — met (31 weeks).",
                        "Still receiving JobSeeker when he applied — met.",
                        "Services Australia letter dated within 21 days — met (09/11/2026).",
                        "No hardship release in the last 12 months — met.",
                        "Amount: $1,000–$10,000 gross once in any 12 months → recommend partial approval of $10,000.",
                    }),
                new ScenarioStep(3, "Human review", Leader, "🧭",
                    "A vulnerable member gets a human touch.",
                    new[]
                    {
                        "Review the vulnerability flag and approve the $10,000 partial release.",
                        "Ask Cara to include free financial counselling details.",
                    }),
                new ScenarioStep(4, "Redemption plan", Investments, "📈",
                    "Decide what to sell.",
                    new[]
                    {
                        "Draw from Tom's Cash Account first, then sell Balanced units for the rest.",
                        "Show the impact on his balance: $84,300 → about $74,300.",
                    }),
                new ScenarioStep(5, "Calculate & pay", Payments, "💳",
                    "Get the tax right, then pay.",
                    new[]
                    {
                        "Payee check: the account is in Tom's legal name — match.",
                        "Components: 6% tax-free → $600 tax-free and $9,400 taxable.",
                        "PAYG withholding at 22% on the taxable component → $2,068.",
                        "Pay $7,932 on Friday 13/11/2026 and remit $2,068 to the ATO.",
                    }),
                new ScenarioStep(6, "A kind explanation", Comms, "✉️",
                    "Explain the outcome without jargon or judgement.",
                    new[]
                    {
                        "Explain why $10,000 is the legal maximum and how the tax works.",
                        "Mention the impact on retirement savings — gently, without lecturing.",
                        "Include the National Debt Helpline (1800 007 007) and Moneysmart.",
                        "Human-approved before sending.",
                    }),
            },
            Icon: "🤝",
            Accent: "#10b981"),

        // ── 5. Robert — death benefit under a binding nomination ────────────
        new ScenarioDefinition(
            Id: "death-benefit",
            Number: "5",
            Title: "Death Benefit — Binding Nomination",
            ShortTitle: "Death benefit",
            Customer: "Robert Chen",
            Persona: "Robert Chen — son of the late Mei Chen",
            Tagline: "Taking the paperwork weight off a grieving family.",
            Flavor: "Bereavement scenario showcasing document authenticity, binding-nomination validation, SIS vs tax dependants, per-beneficiary tax components, a Teams approval for the death benefit and compassionate letters.",
            LifeEvent: "Mei Chen, 81, died on 12 October 2026. Her son Robert, from Box Hill, writes to Caldova on behalf of himself and his sister Lily: their mother held a Caldova Pension (~$486,200) and, they believe, a binding nomination splitting it between them.",
            CaseNumber: "REQ-20261113-DEMO05",
            Outcome: "Benefit paid ✅",
            AgentsFeatured: new[] { Onboarding, Leader, FinCrime, Benefits, Investments, Payments, Comms },
            DemoHighlight: "Shows agents validating the nomination, getting the tax right to the cent and drafting letters with real care — while a human leads every conversation with the family.",
            Steps: new[]
            {
                new ScenarioStep(1, "Death notification", Onboarding, "📥",
                    "Robert's email arrives with the claim form and certified documents.",
                    new[]
                    {
                        "Extract: Mei Chen (died 12/10/2026), pension CP-3019042 (~$486,200), binding nomination Robert 50% / Lily 50%.",
                        "Stop pension payments on Mei's account.",
                        "Open case REQ-20261113-DEMO05 and flag bereavement for compassionate handling.",
                    }),
                new ScenarioStep(2, "Compassionate oversight", Leader, "🧭",
                    "A senior human owns the case.",
                    new[]
                    {
                        "Take ownership and set clear expectations for the family.",
                        "Make sure one consistent contact (Cara) speaks with Robert.",
                    }),
                new ScenarioStep(3, "Document checks", FinCrime, "🛡️",
                    "Verify the documents quietly in the background.",
                    new[]
                    {
                        "Certified death certificate (Births, Deaths and Marriages Victoria) — genuine.",
                        "Robert's and Lily's identity documents — genuine.",
                        "Low risk — no further action.",
                    }),
                new ScenarioStep(4, "Nomination & dependants", Benefits, "📋",
                    "Confirm who must be paid — and how they're taxed.",
                    new[]
                    {
                        "Nomination signed 18/03/2024 before two adult witnesses who aren't beneficiaries — valid until 18/03/2027.",
                        "Robert and Lily are Mei's children — SIS dependants — so the nomination is binding.",
                        "For tax, adult children who weren't financially dependent are non-dependants: the taxable component is taxed at 17%.",
                        "Recommendation: pay 50/50 as nominated.",
                    }),
                new ScenarioStep(5, "Redeem the portfolio", Investments, "📈",
                    "Turn the pension's investments into cash.",
                    new[]
                    {
                        "Sell the pension's portfolio to cash.",
                        "Explain that the final amount depends on the sale prices.",
                    }),
                new ScenarioStep(6, "Calculate & pay", Payments, "💳",
                    "Per-beneficiary components and tax, then approval.",
                    new[]
                    {
                        "Each child: $243,100 gross → $92,378 tax-free and $150,722 taxable (38% / 62%).",
                        "PAYG withholding at 17% on the taxable component → $25,622.74 each.",
                        "Raise a Microsoft Teams approval (death benefit); Theo approves.",
                        "Pay $217,477.26 to each of Robert and Lily.",
                    }),
                new ScenarioStep(7, "Gentle letters", Comms, "✉️",
                    "Write the letters the family will keep.",
                    new[]
                    {
                        "Condolence letters to Robert and Lily with the amounts and a simple tax explanation.",
                        "Explain timing and who to call.",
                        "Include complaint rights — Caldova's internal dispute resolution, then AFCA.",
                        "Copy Marcus Tan with the family's consent.",
                    }),
            },
            Icon: "🤍",
            Accent: "#a855f7"),
    };

    public static ScenarioDefinition? FindById(string id) =>
        All.FirstOrDefault(s => string.Equals(s.Id, id, StringComparison.OrdinalIgnoreCase));
}
