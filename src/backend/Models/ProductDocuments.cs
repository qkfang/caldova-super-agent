using CaldovaSuper.App.Services;

namespace CaldovaSuper.App.Models;

/// <summary>
/// One clause in a Caldova rule document — the unit the Benefits &amp;
/// Eligibility Agent cites in its eligibility checklist.
/// </summary>
/// <param name="ClauseId">
/// Clause id cited by checklist items. Prefixes: <c>PDS-</c> (Caldova Super
/// &amp; Pension PDS), <c>HS-</c> (PDS financial-hardship rules), <c>TD-</c>
/// (trust deed), <c>SIS-</c> (super law — SIS Act / Regulations),
/// <c>TAX-</c> (tax law and PAYG withholding) and <c>AUTH-</c> (Caldova
/// Client Operations authority matrix).
/// </param>
/// <param name="Title">Short clause heading.</param>
/// <param name="Text">Plain-English rule text.</param>
/// <param name="LegalReference">Underlying law or source (e.g. "SIS Regs reg 6.17A").</param>
public record RuleSection(string ClauseId, string Title, string Text, string LegalReference);

/// <summary>
/// A demo-grade extract of a Caldova product or rule document — PDS
/// extracts, trust-deed rules, super-law rule summaries and the operations
/// authority matrix. Shown on the Benefits &amp; Eligibility "Try it out" tab
/// so the user can see exactly which rules the agent applies, and included
/// in the agent prompt so the agent's checklist cites the same clause ids.
/// </summary>
/// <param name="Id">Stable document id (e.g. <c>pds-hardship</c>).</param>
/// <param name="Title">Document title as shown to the user.</param>
/// <param name="DocumentType">"PDS extract", "Trust deed extract", "Rule summary" or "Operations guide".</param>
/// <param name="Issuer">Who issues the document (trustee, operations).</param>
/// <param name="Product">Product(s) the rules apply to.</param>
/// <param name="EffectiveDate">Date the extract is effective from.</param>
/// <param name="KnowledgeBaseTitle">Title of the matching rule document in the <c>wealth_knowledge</c> index.</param>
/// <param name="Summary">One-line description of what the document covers.</param>
/// <param name="Sections">The clauses, each with a citable clause id.</param>
/// <param name="Requirements">What must be on file before the rules can be applied.</param>
/// <param name="Restrictions">Limits and things that can't be done under these rules.</param>
public record ProductRuleDocument(
    string Id,
    string Title,
    string DocumentType,
    string Issuer,
    string Product,
    string EffectiveDate,
    string KnowledgeBaseTitle,
    string Summary,
    IReadOnlyList<RuleSection> Sections,
    IReadOnlyList<string> Requirements,
    IReadOnlyList<string> Restrictions);

/// <summary>
/// Status of one line of the eligibility checklist. The UI shows
/// <c>Pass</c> as a green tick, <c>Fail</c> as a red cross and <c>Info</c>
/// as an amber note (a caution, a tax note or a human-approval step).
/// </summary>
public enum ChecklistStatus
{
    Pass,
    Fail,
    Info
}

/// <summary>
/// One rule check the Benefits &amp; Eligibility Agent works through for a
/// Member Case, citing the clause it relies on (e.g. "Amount within
/// $1,000–$10,000" → <c>HS-4</c>).
/// </summary>
public record EligibilityChecklistItem(
    string Id,
    string Label,
    ChecklistStatus Status,
    string Finding,
    string ClauseRef);

/// <summary>Overall eligibility recommendation for a Member Case.</summary>
public enum EligibilityRecommendation
{
    Approve,
    PartialApprove,
    Decline,
    NeedMoreInfo
}

/// <summary>
/// Deterministic eligibility report for one Member Case: the
/// recommendation, the per-rule checklist with clause references, the rule
/// documents applied, and the supporting working used for the offline demo
/// narrative. Mirrors the trailing JSON block the
/// <see cref="CaldovaSuper.Agents.BenefitsEligibilityAgent"/> emits.
/// </summary>
public record EligibilityReport(
    string CaseNumber,
    string SampleId,
    EligibilityRecommendation Recommendation,
    string RecommendationLabel,
    string RecommendationReason,
    string OutcomeSummary,
    IReadOnlyList<EligibilityChecklistItem> Items,
    IReadOnlyList<string> RuleDocumentIds,
    IReadOnlyList<string> Calculations,
    IReadOnlyList<string> MissingInformation,
    string PlainEnglishExplanation,
    string HumanApproval);

/// <summary>
/// Static catalogue of the Caldova rule documents (PDS extracts, trust-deed
/// rules, super-law and tax rule summaries, authority matrix) and the
/// per-case eligibility reports for the five canonical scenarios, keyed by
/// <see cref="CaseRecord.SampleId"/> so they stay stable for seeded cases and
/// for cases minted live by the Onboarding demo.
///
/// Outcomes are intentionally varied:
/// - Priya (<c>onboarding-priya</c>) — Approve: open the account; nomination
///   not binding until re-signed; Southern Cross rollover held.
/// - Grace (<c>rollover-grace</c>) — Decline: SMSF verification fails; refer
///   to Financial Crime.
/// - George (<c>pension-george</c>) — Approve: commence the pension.
/// - Tom (<c>hardship-tom</c>) — Partially approve: $10,000 gross.
/// - Robert (<c>death-benefit-robert</c>) — Approve: pay as nominated.
/// </summary>
public static class ProductDocumentCatalog
{
    private const string DocAccountOpening = "pds-account-opening";
    private const string DocFeeConsent = "fee-consent-rules";
    private const string DocNominations = "td-death-benefits";
    private const string DocConditionsOfRelease = "conditions-of-release";
    private const string DocPensionStandards = "pension-standards";
    private const string DocTax = "tax-benefits";
    private const string DocRollovers = "rollovers-smsf";
    private const string DocProtectingAccount = "pds-protecting-account";
    private const string DocHardship = "pds-hardship";
    private const string DocAuthority = "authority-matrix";

    private const string Trustee = "Caldova Superannuation Services Pty Ltd (trustee, RSE licensee)";
    private const string Fund = "Caldova Superannuation Master Fund (USI CDV0101AU)";

    public static IReadOnlyList<ProductRuleDocument> All { get; } = BuildDocuments();

    public static ProductRuleDocument? FindById(string id) =>
        All.FirstOrDefault(d => string.Equals(d.Id, id, StringComparison.OrdinalIgnoreCase));

    /// <summary>Find the document and section that define <paramref name="clauseId"/>.</summary>
    public static (ProductRuleDocument Document, RuleSection Section)? FindClause(string clauseId)
    {
        foreach (var doc in All)
        {
            var section = doc.Sections.FirstOrDefault(s =>
                string.Equals(s.ClauseId, clauseId, StringComparison.OrdinalIgnoreCase));
            if (section is not null) return (doc, section);
        }
        return null;
    }

    /// <summary>The rule documents applied to the case behind <paramref name="report"/>, in display order.</summary>
    public static IReadOnlyList<ProductRuleDocument> DocumentsFor(EligibilityReport report) =>
        report.RuleDocumentIds
            .Select(FindById)
            .Where(d => d is not null)
            .Select(d => d!)
            .ToList();

    /// <summary>Default badge text for a recommendation.</summary>
    public static string DefaultLabel(EligibilityRecommendation recommendation) => recommendation switch
    {
        EligibilityRecommendation.Approve => "Approve",
        EligibilityRecommendation.PartialApprove => "Partially approve",
        EligibilityRecommendation.Decline => "Decline",
        _ => "Need more info",
    };

    /// <summary>
    /// Returns the eligibility report for <paramref name="c"/>, keyed off its
    /// <see cref="CaseRecord.SampleId"/>. Falls back to a generic "need more
    /// info" report (with rule documents chosen by request type) for any case
    /// that isn't one of the five worked scenarios — including a scenario
    /// case whose request type was changed on the Onboarding form.
    /// </summary>
    public static EligibilityReport BuildReport(CaseRecord c)
    {
        var sample = RequestSampleCatalog.FindById(c.SampleId ?? string.Empty);
        if (sample is null || !string.Equals(sample.RequestType, c.RequestType, StringComparison.OrdinalIgnoreCase))
            return GenericReport(c);

        return sample.Id switch
        {
            "onboarding-priya" => PriyaReport(c),
            "rollover-grace" => GraceReport(c),
            "pension-george" => GeorgeReport(c),
            "hardship-tom" => TomReport(c),
            "death-benefit-robert" => RobertReport(c),
            _ => GenericReport(c),
        };
    }

    private static EligibilityChecklistItem Item(string id, string label, ChecklistStatus status, string finding, string clauseRef) =>
        new(id, label, status, finding, clauseRef);

    // ── Rule documents ─────────────────────────────────────────────────────

    private static IReadOnlyList<ProductRuleDocument> BuildDocuments() => new[]
    {
        new ProductRuleDocument(
            Id: DocAccountOpening,
            Title: "Caldova Super & Pension PDS — Opening an account & consolidating (extract)",
            DocumentType: "PDS extract",
            Issuer: Trustee,
            Product: "Caldova Super (Essential, Select, Private) — " + Fund,
            EffectiveDate: "1 July 2026",
            KnowledgeBaseTitle: "Caldova Super & Pension PDS extract",
            Summary:
                "What we need before we open a Caldova Super account, how investment choices and " +
                "adviser fees work, and what happens to insurance cover in funds you roll over.",
            Sections: new[]
            {
                new RuleSection("PDS-1", "Verifying your identity",
                    "Before we open your account we verify your identity — electronically (for example a " +
                    "driver licence checked through the Document Verification Service, DVS) by us or your " +
                    "adviser, or with certified copies. We also screen new members against politically " +
                    "exposed person (PEP) and sanctions lists.",
                    "AML/CTF Act 2006 — identity verification (KYC)"),
                new RuleSection("PDS-2", "Your tax file number (TFN)",
                    "Please give us your TFN. You don't have to, but without it we can't accept personal " +
                    "contributions, extra tax applies to employer contributions and it is harder to find " +
                    "your other super. We never show your full TFN on letters or statements.",
                    "SIS Act Part 25A"),
                new RuleSection("PDS-3", "Choosing your investments",
                    "Every tier is available direct or through an adviser. Essential offers a simple menu " +
                    "(Caldova Managed Portfolios and cash); Select offers the full menu, including term deposits " +
                    "and managed funds; Private adds direct ASX and international shares and private markets. " +
                    "We check your choice is on your tier's menu, that you're within the target market " +
                    "determination (TMD) for the product, and — if you're advised — that it is consistent with " +
                    "the risk profile in your Statement of Advice. At least 1% of your account is kept in the " +
                    "Caldova Cash Account for fees and payments.",
                    "Corporations Act Pt 7.8A (design & distribution obligations)"),
                new RuleSection("PDS-4", "Advice fees paid from your account",
                    "We only deduct a fee for personal advice you have received, and only with your written " +
                    "consent. The consent must state the amount, the services and the period it covers (no " +
                    "more than 12 months for an ongoing fee arrangement), and you can withdraw it at any time.",
                    "SIS Act s99FA"),
                new RuleSection("PDS-5", "Bringing your other super across",
                    "When you roll over your whole balance from another fund, that fund closes your account and " +
                    "any insurance cover it holds (for example death and TPD cover) usually ends. Before we " +
                    "request a rollover from a fund where you hold cover, you must confirm — on the application " +
                    "or in writing through your adviser — that you understand the cover will end, or that " +
                    "replacement cover is in place. Rollovers from funds without cover proceed straight away.",
                    "Caldova consolidation procedure"),
            },
            Requirements: new[]
            {
                "Application signed and dated by the member.",
                "Identity verified (DVS or certified copies) and PEP / sanctions screening clear.",
                "TFN supplied.",
                "Investment selection on the tier's menu and, for advised members, consistent with the Statement of Advice.",
                "Written adviser fee consent if advice fees will be deducted from the account.",
                "Signed insurance-loss acknowledgement for each fund being rolled over that holds cover.",
            },
            Restrictions: new[]
            {
                "Investments must be on the tier's menu — for example, term deposits need Select or Private.",
                "A minimum of 1% of the account is held in the Caldova Cash Account.",
                "A rollover from a fund that holds insurance cover is held until the acknowledgement is received.",
                "Caldova does not give personal financial advice — that is the adviser's role.",
            }),

        new ProductRuleDocument(
            Id: DocFeeConsent,
            Title: "Adviser fee consent (s99FA) & ongoing fee arrangements — rule summary",
            DocumentType: "Rule summary",
            Issuer: Trustee,
            Product: "Caldova Super & Pension — " + Fund,
            EffectiveDate: "1 July 2026",
            KnowledgeBaseTitle: "Adviser fee consent (s99FA) & ongoing fee arrangements",
            Summary: "When the trustee may pay a financial adviser's fee from a member's super account.",
            Sections: new[]
            {
                new RuleSection("SIS-1", "Paying advice fees from super",
                    "The trustee may only deduct a fee for financial product advice from a member's account " +
                    "if the advice is personal advice to that member, the member has given a written request " +
                    "or consent, and the trustee holds it. Caldova accepts a consent signed and dated by the " +
                    "member that states the adviser, the fee amount, the services and the period it applies to, and " +
                    "says the consent can be withdrawn at any time. The best-interests duty and the sole " +
                    "purpose test still apply.",
                    "SIS Act s99FA"),
                new RuleSection("SIS-2", "Ongoing fee arrangements — annual renewal",
                    "Ongoing fee consent lasts no more than 12 months. It must be renewed in writing each year: " +
                    "the renewal window opens 60 days before and closes 150 days after the reference day. If it " +
                    "isn't renewed, the arrangement ends and Caldova stops deducting the fee.",
                    "Corporations Act Pt 7.7A Div 3"),
            },
            Requirements: new[]
            {
                "Signed and dated written consent held by the trustee.",
                "Fee amount, services and term stated on the consent.",
                "Adviser authorised on the member's account.",
            },
            Restrictions: new[]
            {
                "No fee deduction without written consent — verbal consent is not accepted.",
                "Fees for general advice, or for advice to someone other than the member, can't be deducted.",
                "Deductions stop if an ongoing fee arrangement isn't renewed.",
            }),

        new ProductRuleDocument(
            Id: DocNominations,
            Title: "Caldova Superannuation Master Fund Trust Deed — Death benefits & nominations (extract)",
            DocumentType: "Trust deed extract",
            Issuer: Trustee,
            Product: "Caldova Super & Pension — " + Fund,
            EffectiveDate: "1 July 2026 (deed as amended)",
            KnowledgeBaseTitle: "Trust-deed rules on death benefits & nominations",
            Summary:
                "How members nominate who receives their super when they die, and how the trustee pays death benefits.",
            Sections: new[]
            {
                new RuleSection("TD-1", "Making a binding nomination",
                    "A binding death benefit nomination must be in writing, signed and dated by the member in " +
                    "the presence of two witnesses who are each at least 18 and are not named as beneficiaries. " +
                    "Both witnesses sign a declaration that the member signed in their presence.",
                    "SIS Regs reg 6.17A"),
                new RuleSection("TD-2", "Nominations lapse after three years",
                    "A binding nomination stays in force for three years from the date it was signed (or last " +
                    "confirmed) and then lapses unless the member renews it. Caldova does not offer non-lapsing nominations.",
                    "SIS Regs reg 6.17A"),
                new RuleSection("TD-3", "Who you can nominate",
                    "You can nominate your legal personal representative (your estate) and/or SIS dependants: " +
                    "your spouse (including a de facto partner), your children of any age, or anyone in an " +
                    "interdependency relationship with you. The shares must add up to 100%.",
                    "SIS Act s10(1)"),
                new RuleSection("TD-4", "Effect of a valid binding nomination",
                    "If a binding nomination is valid and in force when the member dies, the trustee must pay " +
                    "the death benefit to the nominated people in the nominated shares. The trustee has no discretion.",
                    "SIS Act s59(1A)"),
                new RuleSection("TD-5", "Nominations that are not binding",
                    "If a nomination doesn't meet clause TD-1, or has lapsed, the trustee treats it as a " +
                    "non-binding guide to the member's wishes and decides how to pay the benefit among the " +
                    "member's dependants and legal personal representative.",
                    "Caldova trust deed"),
                new RuleSection("TD-6", "Pensions on death",
                    "When we're told a pension member has died, pension payments stop. If a reversionary " +
                    "beneficiary was nominated, the pension continues to them; otherwise the balance is paid " +
                    "as a death benefit under these rules.",
                    "SIS Regs reg 6.21"),
            },
            Requirements: new[]
            {
                "Certified copy of the death certificate.",
                "Certified identification for each beneficiary.",
                "Death benefit claim form signed by each beneficiary.",
                "A bank account in each beneficiary's own name.",
            },
            Restrictions: new[]
            {
                "A binding nomination can only name the legal personal representative or SIS dependants.",
                "A nomination more than three years old has lapsed and is treated as non-binding.",
                "Every death benefit needs Team Leader approval before payment (AUTH-3).",
            }),

        new ProductRuleDocument(
            Id: DocConditionsOfRelease,
            Title: "Conditions of release & preservation — rule summary",
            DocumentType: "Rule summary",
            Issuer: Trustee,
            Product: "Caldova Super & Pension — " + Fund,
            EffectiveDate: "1 July 2026",
            KnowledgeBaseTitle: "Conditions of release & preservation",
            Summary: "When preserved super can be paid out as a lump sum or used to start a pension.",
            Sections: new[]
            {
                new RuleSection("SIS-3", "Preservation",
                    "Super is preserved — it can't be paid out — until the member meets a condition of release. " +
                    "Preservation age is 60 for anyone born after 30 June 1964. Once a condition of release with " +
                    "no cashing restriction is met (for example retirement after preservation age, or reaching " +
                    "65), the benefits become unrestricted non-preserved.",
                    "SIS Regs reg 6.01(2)"),
                new RuleSection("SIS-4", "Reaching age 65",
                    "From age 65 all of a member's super is unrestricted non-preserved and can be paid as a lump " +
                    "sum or used to start a pension, whether or not they have retired. No retirement declaration is needed.",
                    "SIS Regs Sch 1"),
                new RuleSection("SIS-5", "Severe financial hardship",
                    "A member who has received eligible Commonwealth income support continuously for 26 weeks, " +
                    "is still receiving it and can't meet reasonable and immediate family living expenses can " +
                    "apply to their fund for one lump sum of $1,000 to $10,000 (gross) in any 12-month period. " +
                    "Release on compassionate grounds is a separate condition approved by the ATO.",
                    "SIS Regs reg 6.01(5); Sch 1"),
            },
            Requirements: new[]
            {
                "Evidence of the condition of release — date of birth, retirement declaration, Services Australia letter or death certificate.",
            },
            Restrictions: new[]
            {
                "Preserved benefits can't be paid before a condition of release is met.",
                "Hardship releases are capped at $10,000 gross, once in any 12-month period.",
                "Illegal early access schemes — such as promoters urging a rollover to an SMSF to get money out — are refused and referred to Financial Crime.",
            }),

        new ProductRuleDocument(
            Id: DocPensionStandards,
            Title: "Pension standards — minimum drawdown, transfer balance cap & reversionary (rule summary)",
            DocumentType: "Rule summary",
            Issuer: Trustee,
            Product: "Caldova Pension (account-based pension) — " + Fund,
            EffectiveDate: "1 July 2026 (FY2026-27)",
            KnowledgeBaseTitle: "Pension standards (min drawdown table, TBC, reversionary)",
            Summary: "The rules every Caldova Pension must meet when it starts and in every year after.",
            Sections: new[]
            {
                new RuleSection("TAX-1", "Transfer balance cap",
                    "The general transfer balance cap is $2.1 million for 2026-27 (it was $2.0 million in " +
                    "2025-26). Starting a pension creates a credit in the member's transfer balance account equal " +
                    "to the amount used. Total credits can't go above the member's cap — any amount above it " +
                    "stays in accumulation.",
                    "ITAA 1997 Div 294"),
                new RuleSection("SIS-6", "Minimum annual payment",
                    "At least the minimum must be paid each financial year — a percentage of the account balance " +
                    "by age: under 65 4%; 65–74 5%; 75–79 6%; 80–84 7%; 85–89 9%; 90–94 11%; 95 and over 14%.",
                    "SIS Regs Sch 7"),
                new RuleSection("SIS-7", "The first year",
                    "In the year a pension starts, the minimum is pro-rated by the days from the start date to " +
                    "30 June (counting the start date) and rounded to the nearest $10. A pension that starts on " +
                    "or after 1 June has no minimum that year.",
                    "SIS Regs Sch 7"),
                new RuleSection("SIS-8", "Reversionary beneficiary",
                    "A member may nominate a reversionary beneficiary when the pension starts. The beneficiary " +
                    "must be a dependant who can receive a pension — for example a spouse. If the member dies, " +
                    "the pension continues to them.",
                    "SIS Regs reg 6.21; Caldova Pension terms"),
                new RuleSection("TAX-2", "Reporting to the ATO",
                    "Caldova reports each new pension to the ATO through transfer balance account reporting " +
                    "(TBAR), so the credit is recorded against the member's cap.",
                    "ATO transfer balance account reporting"),
            },
            Requirements: new[]
            {
                "Condition of release met.",
                "Declaration of any existing retirement-phase income streams.",
                "Payment amount and frequency at or above the minimum.",
                "Reversionary nomination (optional) with the beneficiary's details.",
            },
            Restrictions: new[]
            {
                "Pension credits can't exceed the transfer balance cap.",
                "If the minimum isn't paid in a year, the pension loses its tax-free earnings status for that year.",
                "Commencements of $1,000,000 or more need Team Leader approval (AUTH-2).",
            }),

        new ProductRuleDocument(
            Id: DocTax,
            Title: "Tax on super benefits & PAYG withholding — rule summary",
            DocumentType: "Rule summary",
            Issuer: Trustee,
            Product: "Caldova Super & Pension — " + Fund,
            EffectiveDate: "1 July 2026 (FY2026-27)",
            KnowledgeBaseTitle: "Tax on super benefits & PAYG withholding",
            Summary: "How much tax Caldova withholds from lump sums, pension payments and death benefits.",
            Sections: new[]
            {
                new RuleSection("TAX-3", "Tax-free and taxable components",
                    "Every payment is split into a tax-free and a taxable component in the same proportions as " +
                    "the member's account (the proportioning rule). Only the taxable component can be taxed.",
                    "ITAA 1997 s307-125"),
                new RuleSection("TAX-4", "Lump sums under age 60",
                    "For a member under 60, Caldova withholds 22% (20% plus the 2% Medicare levy) from the " +
                    "taxable component (taxed element) of a lump sum, or the member's marginal rate if lower. " +
                    "The tax-free component is paid in full.",
                    "Schedule 12 PAYG withholding tax table"),
                new RuleSection("TAX-5", "Age 60 and over",
                    "Lump sums and pension payments from a taxed source to a member aged 60 or over are " +
                    "tax-free, and earnings on retirement-phase pension assets aren't taxed.",
                    "ITAA 1997 Div 301"),
                new RuleSection("TAX-6", "Death benefits — who is a dependant for tax",
                    "For tax, a death benefits dependant is a spouse or former spouse, a child under 18, a person " +
                    "financially dependent on the deceased, or someone in an interdependency relationship. Adult " +
                    "children who weren't financially dependent are not tax dependants — even though they are SIS dependants.",
                    "ITAA 1997 s302-195"),
                new RuleSection("TAX-7", "Death benefits paid to non-dependants",
                    "Lump sums paid to a non-dependant (for tax) have 17% (15% plus the 2% Medicare levy) " +
                    "withheld from the taxable component (taxed element) and 32% from any untaxed element. The " +
                    "tax-free component is paid in full. Death benefits to non-dependants must be paid as lump " +
                    "sums — they can't be rolled over or paid as a pension.",
                    "ITAA 1997 Div 302; Schedule 12 tax table"),
            },
            Requirements: new[]
            {
                "TFN and date of birth for the member or beneficiary.",
                "Tax-free / taxable component split for the member's account.",
                "Tax-dependant status of each death benefit beneficiary.",
            },
            Restrictions: new[]
            {
                "Without a TFN, tax is withheld at the top marginal rate plus Medicare levy.",
                "Withholding is paid to the ATO; final tax is worked out in the recipient's tax return.",
            }),

        new ProductRuleDocument(
            Id: DocRollovers,
            Title: "SuperStream rollovers, insurance-loss warnings & SMSF verification — rule summary",
            DocumentType: "Rule summary",
            Issuer: Trustee,
            Product: "Caldova Super & Pension — " + Fund,
            EffectiveDate: "1 July 2026",
            KnowledgeBaseTitle: "SuperStream rollovers, insurance-loss warnings & SMSF verification",
            Summary: "What must be checked before money is rolled out of Caldova — especially to a self-managed super fund.",
            Sections: new[]
            {
                new RuleSection("SIS-9", "Verify the SMSF before any rollover",
                    "Before rolling over to a self-managed super fund (SMSF), the trustee must use the ATO SMSF " +
                    "verification service (SVS) to confirm the ABN belongs to a registered SMSF and to check its " +
                    "compliance status.",
                    "SIS Regs reg 6.33E"),
                new RuleSection("SIS-10", "Member must be linked to the SMSF",
                    "The SVS must confirm the member's TFN is linked to that SMSF as a member, the TFN isn't " +
                    "flagged as compromised, and no date of death is recorded.",
                    "SIS Regs reg 6.33E"),
                new RuleSection("SIS-11", "Bank account and ESA must match",
                    "The SMSF's bank account (BSB, account number and account name) and electronic service " +
                    "address (ESA) on the request must match the details the ATO holds for the fund. Money is " +
                    "only paid to the SMSF's own verified account.",
                    "SIS Regs reg 6.33E"),
                new RuleSection("SIS-12", "Rollover timeframe",
                    "A rollover must be completed within 3 business days of receiving all the information " +
                    "needed to process it. The clock doesn't start while information is missing or a " +
                    "verification has failed.",
                    "SIS Regs reg 6.34A"),
            },
            Requirements: new[]
            {
                "A passing SVS result — registered SMSF, member linked, bank details and ESA matched.",
                "Rollover request signed by the member, matching the specimen signature on file.",
                "Insurance-loss warning acknowledged where cover will end.",
            },
            Restrictions: new[]
            {
                "No rollover to an SMSF until the SVS checks pass.",
                "Never pay to an account that isn't in the SMSF's name.",
                "A failed check means the request isn't complete — the 3-business-day clock hasn't started.",
            }),

        new ProductRuleDocument(
            Id: DocProtectingAccount,
            Title: "Caldova Super & Pension PDS — Rollovers out & protecting your account (extract)",
            DocumentType: "PDS extract",
            Issuer: Trustee,
            Product: "Caldova Super & Pension — " + Fund,
            EffectiveDate: "1 July 2026",
            KnowledgeBaseTitle: "Caldova Super & Pension PDS extract",
            Summary: "The checks Caldova makes before money leaves your account, to protect you from fraud and scams.",
            Sections: new[]
            {
                new RuleSection("PDS-6", "Recent changes to your contact or bank details",
                    "If your contact or bank details changed recently, we may hold a withdrawal or rollover " +
                    "request and confirm it with you using the contact details we held before the change. We " +
                    "never confirm a request using contact details supplied in the request itself.",
                    "Caldova member-protection controls (APRA authentication expectations)"),
                new RuleSection("PDS-7", "Signatures and identity",
                    "Withdrawal and rollover requests must be signed by you, and the signature must match our " +
                    "records. We may ask for certified identification and check documents for alteration before we act.",
                    "AML/CTF Act 2006 — ongoing due diligence"),
                new RuleSection("PDS-8", "Paying to the right account",
                    "We only pay withdrawals to an account in your own name, and rollovers to the receiving " +
                    "fund's verified account.",
                    "Caldova payment controls"),
            },
            Requirements: new[]
            {
                "Request signed by the member and matching the specimen signature.",
                "Contact details unchanged — or the request confirmed with the member on the pre-change details.",
                "Payee account in the member's name, or the receiving fund's verified account.",
            },
            Restrictions: new[]
            {
                "Requests that fail these checks are held and referred to Financial Crime.",
                "Holding a request to protect a member isn't a finding against them — it's how we keep savings safe.",
            }),

        new ProductRuleDocument(
            Id: DocHardship,
            Title: "Caldova Super & Pension PDS — Withdrawals & hardship (extract)",
            DocumentType: "PDS extract",
            Issuer: Trustee,
            Product: "Caldova Super (accumulation) — " + Fund,
            EffectiveDate: "1 July 2026",
            KnowledgeBaseTitle: "Financial hardship",
            Summary:
                "How members under preservation age can apply for an early release of super on severe financial hardship grounds.",
            Sections: new[]
            {
                new RuleSection("HS-1", "Income support for 26 weeks",
                    "You must have received an eligible Commonwealth income support payment (such as JobSeeker) " +
                    "continuously for at least 26 weeks, and still be receiving it on the date you apply.",
                    "SIS Regs reg 6.01(5)(a)"),
                new RuleSection("HS-2", "Confirmation from Services Australia",
                    "Include a Services Australia letter confirming your income support. Caldova needs the " +
                    "letter to be dated no more than 21 days before we receive your application.",
                    "Caldova hardship procedure"),
                new RuleSection("HS-3", "Unable to meet living expenses",
                    "You must be unable to meet reasonable and immediate family living expenses — such as " +
                    "mortgage or rent, utilities, food or car costs. We ask for a statutory declaration and " +
                    "evidence such as overdue notices.",
                    "SIS Regs reg 6.01(5)(a)"),
                new RuleSection("HS-4", "How much can be released",
                    "We can release a single lump sum of at least $1,000 and no more than $10,000 (gross, " +
                    "before tax). If you ask for more than $10,000, we can only release $10,000.",
                    "SIS Regs Sch 1"),
                new RuleSection("HS-5", "Once in any 12 months",
                    "Only one hardship payment can be made in any 12-month period. We check your account " +
                    "history before we approve a release.",
                    "SIS Regs Sch 1"),
            },
            Requirements: new[]
            {
                "Signed hardship application.",
                "Services Australia confirmation letter dated within 21 days of the application.",
                "Statutory declaration and evidence of the expenses.",
                "Bank account in the member's own name.",
            },
            Restrictions: new[]
            {
                "Minimum $1,000 and maximum $10,000 gross per release.",
                "One release in any 12-month period.",
                "Tax is withheld from the taxable component (TAX-4).",
                "An early release reduces retirement savings. Free help: National Debt Helpline 1800 007 007 and Moneysmart.",
            }),

        new ProductRuleDocument(
            Id: DocAuthority,
            Title: "Caldova Client Operations — Authority & escalation matrix (extract)",
            DocumentType: "Operations guide",
            Issuer: "Caldova Client Operations",
            Product: "All Caldova products",
            EffectiveDate: "1 July 2026",
            KnowledgeBaseTitle: "Authority & escalation matrix",
            Summary: "Which decisions agents may recommend, and which always need a human approver.",
            Sections: new[]
            {
                new RuleSection("AUTH-1", "Declines, partial approvals and hardship releases",
                    "Any decline or partial approval, and every financial-hardship release, needs Team Leader " +
                    "approval. Hardship cases are handled as vulnerable-member cases.",
                    "Caldova authority matrix"),
                new RuleSection("AUTH-2", "Large pension commencements",
                    "Starting a pension of $1,000,000 or more needs Team Leader approval before the pension commences.",
                    "Caldova authority matrix"),
                new RuleSection("AUTH-3", "Death benefits and large payments",
                    "Every death benefit, and any single payment of $250,000 or more, needs Team Leader approval " +
                    "through a Microsoft Teams approval card before Payments releases it.",
                    "Caldova authority matrix"),
                new RuleSection("AUTH-4", "Financial-crime holds",
                    "Blocking a request on financial-crime grounds needs Team Leader approval. Whether to lodge " +
                    "a suspicious matter report (SMR) with AUSTRAC is a human decision, due within 3 business days.",
                    "Caldova authority matrix; AML/CTF Act 2006"),
            },
            Requirements: new[]
            {
                "Agent recommendation with every rule cited.",
                "Human approver recorded on the Member Case.",
            },
            Restrictions: new[]
            {
                "Agents never approve, decline or release money on their own.",
                "Complaints follow IDR timeframes: 30 days (45 for super trustee complaints, 90 for death benefit distribution complaints).",
            }),
    };

    // ── Per-case eligibility reports ───────────────────────────────────────

    private static EligibilityReport PriyaReport(CaseRecord c) => new(
        CaseNumber: c.CaseNumber,
        SampleId: c.SampleId,
        Recommendation: EligibilityRecommendation.Approve,
        RecommendationLabel: "Approve — open the account",
        RecommendationReason:
            "Every account-opening requirement is met: identity verified, TFN supplied, a valid s99FA adviser fee " +
            "consent and a Growth selection that matches the Statement of Advice and the Select target market. " +
            "Two items need follow-up but don't stop the account opening.",
        OutcomeSummary:
            "Open the account (member CS-2049817). The Harbourline rollover (~$41,800) can proceed now; hold the " +
            "Southern Cross rollover (~$96,400) until the insurance-loss acknowledgement is received; Priya re-signs " +
            "the nomination in front of two adult witnesses who aren't beneficiaries.",
        Items: new[]
        {
            Item("identity", "Identity verified (KYC)", ChecklistStatus.Pass,
                "Victorian driver licence verified electronically (DVS) by the adviser on 28/10/2026. PEP and sanctions screening: no match.",
                "PDS-1"),
            Item("tfn", "TFN supplied", ChecklistStatus.Pass,
                "TFN supplied and held securely (*** *** 418).",
                "PDS-2"),
            Item("fee-consent", "Adviser fee consent (s99FA)", ChecklistStatus.Pass,
                "Personal advice; written consent signed and dated by Priya on 30/10/2026 — $3,300 p.a. incl. GST, " +
                "services described, 12-month term, can be withdrawn at any time.",
                "SIS-1"),
            Item("bdbn-witnesses", "Binding nomination — two witnesses", ChecklistStatus.Fail,
                "Signed by Priya on 30/10/2026 but only ONE witness signed; two adult witnesses who aren't " +
                "beneficiaries are required. Not valid as binding — treat as non-binding until re-signed.",
                "TD-1"),
            Item("bdbn-beneficiary", "Nominated beneficiary is a SIS dependant", ChecklistStatus.Pass,
                "Arjun Mehta is Priya's de facto partner — a spouse for SIS purposes — so he can be nominated for " +
                "100% once the nomination is re-signed.",
                "TD-3"),
            Item("insurance-loss", "Insurance-loss acknowledgement — Southern Cross", ChecklistStatus.Info,
                "Southern Cross Industry Super holds $520,000 of Death & TPD cover that ends on rollover, and the " +
                "acknowledgement isn't ticked. Hold that rollover until Hannah and Priya confirm in writing (or " +
                "replacement cover is in place). Harbourline holds no insurance and can proceed.",
                "PDS-5"),
            Item("investment-fit", "Investment selection vs SoA & TMD", ChecklistStatus.Pass,
                "Caldova Managed Portfolio — Growth (80/20) is on the Select menu, matches the SoA dated 28/10/2026 " +
                "(risk profile: Growth), and Priya is within the Caldova Super target market.",
                "PDS-3"),
        },
        RuleDocumentIds: new[] { DocAccountOpening, DocFeeConsent, DocNominations },
        Calculations: new[]
        {
            "Rollovers in: Southern Cross ~$96,400 + Harbourline ~$41,800 = ~$138,200.",
            "Adviser fee: $3,300 p.a. incl. GST = $275 a month, under the s99FA consent (12-month term).",
            "Cash minimum: 1% of the balance stays in the Caldova Cash Account (~$1,382 on $138,200).",
        },
        MissingInformation: new[]
        {
            "Binding nomination re-signed in front of two adult witnesses who aren't beneficiaries, with witness declarations (TD-1).",
            "Written insurance-loss acknowledgement for Southern Cross Industry Super, or confirmation that replacement cover is in place (PDS-5).",
        },
        PlainEnglishExplanation:
            "Priya's new Caldova Super account can open now, invested in the Growth portfolio her adviser " +
            "recommended. Her Harbourline super can come across straight away. Before we move her Southern Cross " +
            "super, she needs to confirm she understands her $520,000 of death and TPD cover there will end. Her " +
            "nomination for Arjun needs a second witness before it can be binding — until then it's a guide to her wishes.",
        HumanApproval:
            "No Team Leader approval is needed to open the account. Ben confirms the findings; the Southern Cross " +
            "rollover waits for written confirmation from Hannah Lewis and Priya.");

    private static EligibilityReport GraceReport(CaseRecord c) => new(
        CaseNumber: c.CaseNumber,
        SampleId: c.SampleId,
        Recommendation: EligibilityRecommendation.Decline,
        RecommendationLabel: "Decline — do not process",
        RecommendationReason:
            "The rollover fails SMSF verification: Grace's TFN isn't linked to the GW Family Superannuation Fund, " +
            "and the bank details and ESA don't match the ATO's records. With a recent change of contact details " +
            "and a signature that doesn't match our records, the request can't proceed and is referred to Financial Crime.",
        OutcomeSummary:
            "Do not process the $612,400 rollover. Refer to Financial Crime today, keep the balance where it is, and " +
            "only contact Grace on the details held before 2 Nov 2026 (mobile 0491 570 157). The 3-business-day " +
            "rollover clock hasn't started.",
        Items: new[]
        {
            Item("svs-registered", "SVS — ABN is a registered SMSF", ChecklistStatus.Info,
                "ABN 98 765 432 109 is a registered SMSF — but only since 28/10/2026, nine days before the request.",
                "SIS-9"),
            Item("svs-member-linked", "SVS — member's TFN linked to the SMSF", ChecklistStatus.Fail,
                "Grace's TFN is not linked to GW Family Superannuation Fund as a member, so a rollover to this fund can't be made.",
                "SIS-10"),
            Item("svs-bank-esa", "SVS — bank details & ESA match", ChecklistStatus.Fail,
                "The bank account (name 'G Williams Holdings Pty Ltd') and the ESA on the request don't match the " +
                "details the ATO holds for the fund — and the account isn't in the SMSF's name.",
                "SIS-11"),
            Item("change-of-details", "Recent change of details before a full-balance rollover", ChecklistStatus.Fail,
                "Mobile and email were changed by phone on 02/11/2026 at 10:42 — about 93 hours (under 96) before " +
                "this full-balance request, which came from the new email at 07:52 on 06/11/2026. A travel notice " +
                "(Italy, from 18/10/2026) is on file. Confirm only on the pre-change verified number.",
                "PDS-6"),
            Item("signature", "Signature vs specimen", ChecklistStatus.Fail,
                "Signed 'G. Williams' on 05/11/2026 — it doesn't match the specimen signature on file. The attached " +
                "licence image also needs an authenticity check by Financial Crime.",
                "PDS-7"),
            Item("rollover-clock", "3-business-day rollover timeframe", ChecklistStatus.Info,
                "The request isn't complete while SMSF verification fails, so the SuperStream clock hasn't started — " +
                "holding it doesn't breach the timeframe.",
                "SIS-12"),
            Item("approval", "Human approval — financial-crime hold", ChecklistStatus.Info,
                "Blocking the request needs Team Leader approval; whether to lodge an SMR with AUSTRAC is a human decision.",
                "AUTH-4"),
        },
        RuleDocumentIds: new[] { DocRollovers, DocProtectingAccount, DocAuthority },
        Calculations: new[]
        {
            "Amount requested: whole balance ≈ $612,400.",
            "Change of details (02/11/2026 10:42) to rollover request email (06/11/2026 07:52): ~93 hours — under 96 hours.",
            "SMSF ABN registered (28/10/2026) to rollover request (06/11/2026): 9 days.",
        },
        MissingInformation: new[]
        {
            "A passing SVS result (member linked, bank details and ESA matched) — not possible on the current details (SIS-10, SIS-11).",
            "Confirmation from Grace, using the contact details held before 02/11/2026, that she made this request (PDS-6).",
            "Financial Crime's authenticity check of the licence image (PDS-7).",
        },
        PlainEnglishExplanation:
            "We can't roll Grace's super over to this SMSF. The ATO's checks show she isn't a member of that fund and " +
            "its bank details don't match, so the law doesn't allow the transfer. Her $612,400 stays safely with " +
            "Caldova while our Financial Crime team confirms the request with her on the details we held before they " +
            "were changed. This isn't a judgement about Grace — these checks exist to protect members' savings.",
        HumanApproval:
            "Yes — blocking a request on financial-crime grounds needs Team Leader approval, and any suspicious matter " +
            "report to AUSTRAC is a human decision, due within 3 business days (AUTH-4).");

    private static EligibilityReport GeorgeReport(CaseRecord c) => new(
        CaseNumber: c.CaseNumber,
        SampleId: c.SampleId,
        Recommendation: EligibilityRecommendation.Approve,
        RecommendationLabel: "Approve — commence the pension",
        RecommendationReason:
            "George is 66, so all his super is unrestricted non-preserved. The $1,250,000 commencement is within his " +
            "$2.1 million transfer balance cap, the $78,000 a year he asked for is above the minimum, and Helen can be " +
            "his reversionary beneficiary.",
        OutcomeSummary:
            "Commence Caldova Pension CP-3077881 with $1,250,000 on 16/11/2026, paying $6,500 a month ($78,000 p.a.) — " +
            "above the pro-rated FY2026-27 minimum of $38,870. Report the $1,250,000 transfer balance credit to the ATO " +
            "($850,000 cap space remains). Team Leader approval is needed before commencement.",
        Items: new[]
        {
            Item("release-age", "Condition of release — age 65", ChecklistStatus.Pass,
                "George was born on 03/04/1960 and is 66. Reaching 65 is a condition of release; no retirement declaration is needed.",
                "SIS-4"),
            Item("unrestricted", "Benefits unrestricted non-preserved", ChecklistStatus.Pass,
                "With the condition of release met, all of George's $1,284,600 is unrestricted non-preserved: " +
                "$1,250,000 starts the pension and $34,600 stays in accumulation.",
                "SIS-3"),
            Item("tbc", "Transfer balance cap", ChecklistStatus.Pass,
                "General cap $2.1 million (2026-27). No prior transfer balance account, so the $1,250,000 credit " +
                "leaves $850,000 of cap space. The credit is reported to the ATO.",
                "TAX-1"),
            Item("min-drawdown", "Minimum annual payment", ChecklistStatus.Pass,
                "Age 65–74: 5% × $1,250,000 = $62,500 p.a. The $78,000 p.a. requested is above the minimum.",
                "SIS-6"),
            Item("first-year", "First-year minimum (pro-rated)", ChecklistStatus.Pass,
                "Starting 16/11/2026 leaves 227 of 365 days in FY2026-27: $62,500 × 227 ÷ 365 = $38,870 (rounded to " +
                "the nearest $10). Seven monthly payments of $6,500 before 30 June total $45,500.",
                "SIS-7"),
            Item("reversionary", "Reversionary beneficiary", ChecklistStatus.Pass,
                "Helen Papadopoulos (spouse, DOB 21/09/1963) can be nominated — the pension continues to her if George dies first.",
                "SIS-8"),
            Item("tax", "Tax on pension payments", ChecklistStatus.Info,
                "George is over 60: pension payments are tax-free (no PAYG withheld) and earnings on the pension's assets aren't taxed.",
                "TAX-5"),
            Item("approval", "Team Leader approval (≥ $1,000,000)", ChecklistStatus.Info,
                "A $1,250,000 commencement is above the $1,000,000 authority limit — Team Leader approval is needed before the pension starts.",
                "AUTH-2"),
        },
        RuleDocumentIds: new[] { DocConditionsOfRelease, DocPensionStandards, DocTax, DocAuthority },
        Calculations: new[]
        {
            "Transfer balance cap: $2,100,000 − $1,250,000 = $850,000 cap space remaining.",
            "Minimum annual payment (age 65–74): 5% × $1,250,000 = $62,500.",
            "First-year minimum: $62,500 × 227 ÷ 365 = $38,869.86 → $38,870 (nearest $10).",
            "Requested: $78,000 p.a. = $6,500 a month; 7 payments (15 Dec 2026 – 15 Jun 2027) = $45,500 ≥ $38,870.",
            "Left in accumulation: $1,284,600 − $1,250,000 = $34,600.",
        },
        MissingInformation: Array.Empty<string>(),
        PlainEnglishExplanation:
            "George can start his Caldova Pension. At 66 he can access all of his super, the $1.25 million he's moving " +
            "is well within the $2.1 million cap, and the $6,500 a month he asked for is above the legal minimum. Helen " +
            "will keep receiving the pension if anything happens to George. Because the amount is over $1 million, a " +
            "Team Leader signs it off before it starts on 16 November.",
        HumanApproval:
            "Yes — pension commencements of $1,000,000 or more need Team Leader approval (AUTH-2).");

    private static EligibilityReport TomReport(CaseRecord c) => new(
        CaseNumber: c.CaseNumber,
        SampleId: c.SampleId,
        Recommendation: EligibilityRecommendation.PartialApprove,
        RecommendationLabel: "Partially approve — $10,000 gross",
        RecommendationReason:
            "Tom meets every severe-financial-hardship criterion, but $15,000 is more than the $10,000 maximum that " +
            "can be released in any 12-month period.",
        OutcomeSummary:
            "Release $10,000 gross — the legal maximum: tax-free $600, taxable $9,400, PAYG withheld $2,068, net " +
            "$7,932. The remaining $5,000 can't be released on hardship grounds. Team Leader approval is needed " +
            "(partial approval, vulnerable member).",
        Items: new[]
        {
            Item("income-support", "Income support for 26 continuous weeks", ChecklistStatus.Pass,
                "JobSeeker continuously since 06/04/2026 — 31 weeks at 09/11/2026.",
                "HS-1"),
            Item("still-receiving", "Still receiving income support", ChecklistStatus.Pass,
                "The Services Australia letter dated 09/11/2026 confirms Tom is still receiving JobSeeker.",
                "HS-1"),
            Item("letter-current", "Services Australia letter within 21 days", ChecklistStatus.Pass,
                "Letter dated 09/11/2026; application received 11/11/2026 — 2 days.",
                "HS-2"),
            Item("living-expenses", "Unable to meet reasonable & immediate family living expenses", ChecklistStatus.Pass,
                "Statutory declaration plus overdue notices: mortgage arrears $6,840, electricity $1,120 overdue, car registration due.",
                "HS-3"),
            Item("previous-release", "No hardship release in the last 12 months", ChecklistStatus.Pass,
                "Account history shows no hardship release in the last 12 months.",
                "HS-5"),
            Item("amount-limit", "Amount within $1,000–$10,000", ChecklistStatus.Fail,
                "$15,000 requested is above the $10,000 gross maximum — only $10,000 can be released.",
                "HS-4"),
            Item("tax", "Tax on the payment", ChecklistStatus.Info,
                "Tom is 47 (under 60): 22% (20% + 2% Medicare levy) is withheld from the taxable component. On " +
                "$10,000: tax-free $600, taxable $9,400, PAYG $2,068, net $7,932.",
                "TAX-4"),
            Item("approval", "Team Leader approval — partial release, vulnerable member", ChecklistStatus.Info,
                "Partial approvals and hardship releases always need Team Leader approval; Tom is flagged as a vulnerable member.",
                "AUTH-1"),
        },
        RuleDocumentIds: new[] { DocHardship, DocConditionsOfRelease, DocTax, DocAuthority },
        Calculations: new[]
        {
            "Payment limit: $15,000 requested → capped at $10,000 gross (HS-4).",
            "Components (6% tax-free): tax-free $600; taxable $9,400.",
            "PAYG withholding: 22% × $9,400 = $2,068.",
            "Net payment: $10,000 − $2,068 = $7,932.",
            "Balance after release: $84,300 − $10,000 ≈ $74,300 (before market movements).",
        },
        MissingInformation: Array.Empty<string>(),
        PlainEnglishExplanation:
            "Tom qualifies for an early release on financial hardship grounds, but the law caps it at $10,000 before " +
            "tax in any 12 months, so we can't release the full $15,000. After $2,068 tax he'll receive $7,932. Free, " +
            "confidential help is available from the National Debt Helpline on 1800 007 007 and on Moneysmart.",
        HumanApproval:
            "Yes — partial approvals and hardship releases need Team Leader approval, and Tom is a vulnerable member " +
            "who should get a human touch (AUTH-1).");

    private static EligibilityReport RobertReport(CaseRecord c) => new(
        CaseNumber: c.CaseNumber,
        SampleId: c.SampleId,
        Recommendation: EligibilityRecommendation.Approve,
        RecommendationLabel: "Approve — pay as nominated",
        RecommendationReason:
            "Mei Chen's binding nomination is valid and in force, and both nominated beneficiaries — her children " +
            "Robert and Lily — are SIS dependants. The trustee must pay as nominated: 50% each.",
        OutcomeSummary:
            "Pay Mei Chen's death benefit (≈ $486,200) as nominated — 50% to Robert and 50% to Lily, as lump sums. " +
            "Each share ≈ $243,100: tax-free $92,378, taxable $150,722, 17% withheld $25,622.74, net ≈ $217,477.26 " +
            "(final amounts depend on sale proceeds). Team Leader approval is needed (death benefit).",
        Items: new[]
        {
            Item("bdbn-formalities", "Binding nomination signed & witnessed", ChecklistStatus.Pass,
                "Signed and dated by Mei on 18/03/2024 in front of two adult witnesses who aren't beneficiaries, with witness declarations.",
                "TD-1"),
            Item("bdbn-in-force", "Nomination in force (not lapsed)", ChecklistStatus.Pass,
                "Lapsing three-year nomination valid to 18/03/2027; Mei died on 12/10/2026, so it was in force.",
                "TD-2"),
            Item("sis-dependants", "Beneficiaries are SIS dependants", ChecklistStatus.Pass,
                "Robert and Lily are Mei's children — a child of any age is a SIS dependant. Shares 50% + 50% = 100%.",
                "TD-3"),
            Item("binding-effect", "Binding — trustee must follow", ChecklistStatus.Info,
                "The nomination is valid and binding, so the trustee must pay as nominated, with no discretion. There's " +
                "no reversionary beneficiary (Mei's husband died before her).",
                "TD-4"),
            Item("tax-status", "Tax — beneficiaries are non-dependants", ChecklistStatus.Info,
                "Adult children who weren't financially dependent aren't death benefit dependants for tax: 17% " +
                "(15% + 2% Medicare levy) is withheld from the taxable component, and the benefit is paid as lump " +
                "sums (it can't be rolled over).",
                "TAX-7"),
            Item("approval", "Team Leader approval — death benefit", ChecklistStatus.Info,
                "Every death benefit needs Team Leader approval through a Teams approval card before Payments releases it.",
                "AUTH-3"),
        },
        RuleDocumentIds: new[] { DocNominations, DocTax, DocAuthority },
        Calculations: new[]
        {
            "Balance ≈ $486,200 → 50% each ≈ $243,100 gross.",
            "Components (38% tax-free / 62% taxable): tax-free $92,378; taxable $150,722 per share.",
            "Withholding: 17% × $150,722 = $25,622.74 per share.",
            "Net per share: $243,100 − $25,622.74 = $217,477.26.",
            "Final amounts depend on sale proceeds when the pension's portfolio is redeemed.",
        },
        MissingInformation: Array.Empty<string>(),
        PlainEnglishExplanation:
            "Mei's nomination was made correctly and was still current, so Caldova must pay her super exactly as she " +
            "asked — half to Robert and half to Lily. Because adult children aren't dependants for tax purposes, some " +
            "tax is withheld from the taxable part of each payment. The final amounts depend on what the investments " +
            "sell for, and a Team Leader signs off before anything is paid.",
        HumanApproval:
            "Yes — every death benefit needs Team Leader approval (AUTH-3), and every message to the family is " +
            "handled with care by a person.");

    private static EligibilityReport GenericReport(CaseRecord c)
    {
        var requestType = c.RequestType ?? string.Empty;
        var (docs, ruleClause, evidenceClause) = requestType switch
        {
            RequestTypes.NewAccount => (new[] { DocAccountOpening, DocFeeConsent, DocNominations, DocAuthority }, "PDS-3", "PDS-1"),
            RequestTypes.RolloverOutSmsf => (new[] { DocRollovers, DocProtectingAccount, DocAuthority }, "SIS-9", "PDS-7"),
            RequestTypes.PensionCommencement => (new[] { DocConditionsOfRelease, DocPensionStandards, DocTax, DocAuthority }, "SIS-3", "SIS-6"),
            RequestTypes.FinancialHardship => (new[] { DocHardship, DocConditionsOfRelease, DocTax, DocAuthority }, "HS-1", "HS-2"),
            RequestTypes.DeathBenefit => (new[] { DocNominations, DocTax, DocAuthority }, "TD-1", "TD-3"),
            _ => (new[] { DocAccountOpening, DocConditionsOfRelease, DocAuthority }, "SIS-3", "PDS-1"),
        };
        var typeLabel = string.IsNullOrWhiteSpace(requestType) ? "this request" : $"a '{requestType}' request";

        return new EligibilityReport(
            CaseNumber: c.CaseNumber,
            SampleId: c.SampleId,
            Recommendation: EligibilityRecommendation.NeedMoreInfo,
            RecommendationLabel: DefaultLabel(EligibilityRecommendation.NeedMoreInfo),
            RecommendationReason:
                $"Case {c.CaseNumber} is {typeLabel} without a worked rule check on file, so the member's records and " +
                "supporting documents are needed before the rules can be applied.",
            OutcomeSummary:
                "No decision yet — gather the missing information below, then run the eligibility check again.",
            Items: new[]
            {
                Item("rule-identified", "Applicable rule identified", ChecklistStatus.Info,
                    $"Confirm which PDS, trust-deed and super-law rules apply to {typeLabel} and the evidence each needs.",
                    ruleClause),
                Item("evidence", "Supporting evidence on file", ChecklistStatus.Info,
                    "Check the documents on the case against the NIGO checklist from Onboarding before assessing.",
                    evidenceClause),
                Item("approval", "Human review", ChecklistStatus.Info,
                    "Any decline or partial approval that follows needs Team Leader approval.",
                    "AUTH-1"),
            },
            RuleDocumentIds: docs,
            Calculations: Array.Empty<string>(),
            MissingInformation: new[]
            {
                "Member record and identity confirmation for the member number on the case.",
                "The supporting documents for the condition of release or product rule being relied on.",
            },
            PlainEnglishExplanation:
                $"We've received {typeLabel} for {c.ClientName} and need a few more details before we can confirm " +
                "eligibility. We'll let the member (and their adviser, if they have one) know exactly what's needed.",
            HumanApproval: "Not yet — no recommendation has been made. Any decline or partial approval will need Team Leader approval.");
    }
}
