using CaldovaSuper.App.Services;

namespace CaldovaSuper.App.Models;

/// <summary>
/// One sample inbound request — an email plus its attached form — for the
/// Onboarding demo (the "Try it out" tab on <c>/agents/onboarding</c>).
/// Each sample is one of the five canonical scenarios in
/// <c>docs/scenario-1..5</c>, and also seeds the matching Member Case in
/// <see cref="CaseStore.SeedDefaults"/> so every downstream agent page has a
/// case to work on.
/// </summary>
public record RequestSample(
    string Id,
    string Label,
    string RequestType,
    string ClientName,
    string ClientEmail,
    string MemberNumber,
    string EmailSubject,
    string EmailFrom,
    string EmailDate,
    string EmailBody,
    string FormFileName,
    string FormDocumentText,
    RequestExtractedFields ExpectedFields,
    IReadOnlyList<NigoCheck> ExpectedNigo,
    string ExpectedPriority,
    string ExpectedPriorityReason);

/// <summary>
/// Canonical fields the Onboarding Agent maps from the email + form onto the
/// Member Case. Mirrors the "Captured Fields" section of the
/// <see cref="CaldovaSuper.Agents.OnboardingAgent"/> instructions.
/// </summary>
public record RequestExtractedFields(
    string ClientName,
    string ClientEmail,
    string ClientPhone,
    string MemberNumber,
    string Product,
    string RequestType,
    string ReceivedDate,
    string AdviserName,
    string AdviserPractice,
    string RequestSummary,
    string Amount,
    string PreferredContact);

/// <summary>
/// One line of the NIGO ("not in good order") checklist. <c>Status</c> is
/// <c>"ok"</c> (in good order) or <c>"action"</c> (needs follow-up).
/// </summary>
public record NigoCheck(string Id, string Label, string Status, string Note);

/// <summary>
/// Static catalogue of the five sample requests, in canonical scenario order:
/// Priya (new account &amp; consolidation), Grace (rollover out to an SMSF —
/// identity takeover), George (pension commencement), Tom (financial
/// hardship) and Robert (death benefit). Kept server-side so a single C#
/// definition drives the listing API, the deterministic fallback extraction
/// and the seeded cases.
/// </summary>
public static class RequestSampleCatalog
{
    public static IReadOnlyList<RequestSample> All { get; } = Build();

    public static RequestSample? FindById(string id) =>
        All.FirstOrDefault(s => string.Equals(s.Id, id, StringComparison.OrdinalIgnoreCase));

    private static IReadOnlyList<RequestSample> Build() => new[]
    {
        // ── 1. Priya Natarajan — adviser-led new account & consolidation ─────
        new RequestSample(
            Id: "onboarding-priya",
            Label: "New account & consolidation — Priya Natarajan (via Yarra Private Wealth)",
            RequestType: RequestTypes.NewAccount,
            ClientName: "Priya Natarajan",
            ClientEmail: "priya.natarajan@example.com",
            MemberNumber: "CS-2049817",
            EmailSubject: "New client application — Priya Natarajan — Caldova Super (Select) + consolidation",
            EmailFrom: "Hannah Lewis <hannah.lewis@yarraprivate.example.com.au>",
            EmailDate: "Tue, 3 Nov 2026 09:12",
            EmailBody:
                "Hi Caldova New Business team,\n\n" +
                "Please find attached the application pack for my new client, Priya " +
                "Natarajan (DOB 14/02/1992), who has just started a new role at a " +
                "Docklands fintech.\n\n" +
                "Priya would like to:\n" +
                "• Open a Caldova Super (Select) account, invested 100% in the Caldova " +
                "Managed Portfolio — Growth (per my SoA dated 28 October 2026, risk " +
                "profile: Growth).\n" +
                "• Consolidate her two existing super accounts — Southern Cross Industry " +
                "Super (member 88213045) and Harbourline Retail Super (member HR-4471902).\n" +
                "• Nominate her partner, Arjun Mehta, as binding death benefit " +
                "beneficiary (100%).\n" +
                "• Have my ongoing advice fee of $3,300 p.a. (incl. GST) deducted from " +
                "her super — the signed fee consent is attached.\n\n" +
                "Her new employer will start paying SG once the member number is " +
                "confirmed. ID was verified in our office (driver licence, checked " +
                "via DVS).\n\n" +
                "Kind regards,\n" +
                "Hannah Lewis CFP®\n" +
                "Senior Financial Adviser | Yarra Private Wealth\n" +
                "Collins Street, Melbourne VIC 3000 | Adviser code ADV-10442\n\n" +
                "Attachments: Caldova-Super-Application-Natarajan.pdf; " +
                "BDBN-Natarajan.pdf; Fee-Consent-Natarajan.pdf",
            FormFileName: "Caldova-Super-Application-Natarajan.pdf",
            FormDocumentText:
                "CALDOVA SUPER — APPLICATION FOR MEMBERSHIP (ADVISED)\n" +
                "====================================================\n\n" +
                "Section A — Member details\n" +
                "Name: Priya Natarajan            Date of birth: 14/02/1992\n" +
                "Address: Southbank VIC 3006\n" +
                "Email: priya.natarajan@example.com    Mobile: 0491 570 156\n" +
                "Tax file number: *** *** 418 (supplied)\n" +
                "Identity verification: Victorian driver licence — verified " +
                "electronically (DVS) by adviser on 28/10/2026\n" +
                "Product: Caldova Super — Select tier\n\n" +
                "Section B — Investment selection\n" +
                "Caldova Managed Portfolio — Growth (80/20) ............ 100%\n" +
                "(Caldova Cash Account minimum of 1% retained automatically)\n\n" +
                "Section C — Rollovers to consolidate (whole balance)\n" +
                "1. Southern Cross Industry Super — USI SCI0001AU — member 88213045 — approx. $96,400\n" +
                "   Insurance currently held: Death & TPD cover $520,000\n" +
                "   I understand my insurance in this fund will end on rollover: [ ] (not ticked)\n" +
                "2. Harbourline Retail Super — USI HRB0007AU — member HR-4471902 — approx. $41,800\n" +
                "   Insurance currently held: none\n\n" +
                "Section D — Death benefit nomination\n" +
                "Type: Binding (lapsing — 3 years)\n" +
                "Beneficiary: Arjun Mehta — de facto partner — 100%\n" +
                "Signed by member: Priya Natarajan, 30/10/2026\n" +
                "Witness 1: Daniel Ross (aged 18+, not a beneficiary), 30/10/2026\n" +
                "Witness 2: (blank)\n\n" +
                "Section E — Adviser details and fees\n" +
                "Adviser: Hannah Lewis CFP®, Yarra Private Wealth, adviser code ADV-10442\n" +
                "Ongoing advice fee: $3,300 p.a. incl. GST, deducted monthly from the member's account\n" +
                "Ongoing fee arrangement consent: signed by member 30/10/2026; services — " +
                "annual review, investment monitoring, super and insurance strategy; " +
                "term 12 months; consent can be withdrawn at any time\n\n" +
                "Section F — Declaration\n" +
                "Signed: Priya Natarajan        Date: 30/10/2026",
            ExpectedFields: new RequestExtractedFields(
                ClientName: "Priya Natarajan",
                ClientEmail: "priya.natarajan@example.com",
                ClientPhone: "0491 570 156",
                MemberNumber: "CS-2049817 (new)",
                Product: "Caldova Super — Select",
                RequestType: RequestTypes.NewAccount,
                ReceivedDate: "2026-11-03",
                AdviserName: "Hannah Lewis CFP®",
                AdviserPractice: "Yarra Private Wealth",
                RequestSummary:
                    "New advised Caldova Super (Select) account invested 100% in the Growth " +
                    "managed portfolio; consolidate Southern Cross Industry Super (~$96,400, " +
                    "holds $520,000 Death & TPD cover) and Harbourline Retail Super (~$41,800); " +
                    "binding nomination to de facto partner Arjun Mehta; ongoing adviser fee " +
                    "$3,300 p.a. deducted from super.",
                Amount: "AUD 138,200 rolling in (approx.)",
                PreferredContact: "Email (via adviser)"),
            ExpectedNigo: new[]
            {
                new NigoCheck("id", "Identity verified", "ok", "Victorian driver licence verified via DVS by the adviser on 28/10/2026."),
                new NigoCheck("tfn", "TFN supplied", "ok", "TFN supplied (*** *** 418)."),
                new NigoCheck("signature", "Application signed & dated", "ok", "Signed and dated by the member on 30/10/2026."),
                new NigoCheck("fee-consent", "Adviser fee consent (s99FA)", "ok", "Written consent signed by the member: amount, services and 12-month term stated; can be withdrawn."),
                new NigoCheck("investment", "Investment selection", "ok", "Growth model is available on the Select tier and matches the SoA risk profile (Growth)."),
                new NigoCheck("bdbn", "Binding nomination witnesses", "action", "Only ONE witness — not valid as binding. Re-sign in front of two adult witnesses who are not beneficiaries; treat as non-binding until then."),
                new NigoCheck("insurance", "Insurance-loss acknowledgement", "action", "Southern Cross holds $520,000 Death & TPD cover and the acknowledgement isn't ticked — hold that rollover until the adviser/member confirms."),
            },
            ExpectedPriority: "Standard",
            ExpectedPriorityReason:
                "Complete apart from two NIGO items (binding nomination witness, insurance-loss " +
                "acknowledgement). No vulnerability indicators. The Harbourline rollover can proceed now."),

        // ── 2. Grace Williams — rollover out to a new SMSF (identity takeover) ─
        new RequestSample(
            Id: "rollover-grace",
            Label: "Rollover out to SMSF — Grace Williams (sent from a newly changed email)",
            RequestType: RequestTypes.RolloverOutSmsf,
            ClientName: "Grace Williams",
            ClientEmail: "grace.williams@example.com",
            MemberNumber: "CS-1058220",
            EmailSubject: "URGENT - rollover my super to my SMSF",
            EmailFrom: "Grace Williams <grace.w.super@mailbox.example>",
            EmailDate: "Fri, 6 Nov 2026 07:52",
            EmailBody:
                "Hello,\n\n" +
                "I need to roll over my whole super balance to my new self managed super " +
                "fund, GW Family Superannuation Fund. Please process this as urgently as " +
                "possible as I have an investment opportunity that closes next week.\n\n" +
                "I am overseas at the moment so please do not call my old number — I can " +
                "only be contacted on my new mobile 0491 570 158 or this email.\n\n" +
                "The completed rollover form, my SMSF details and a copy of my drivers " +
                "licence are attached.\n\n" +
                "Thank you\n" +
                "Grace Williams\n" +
                "Member CS-1058220\n\n" +
                "Attachments: Rollover-Request-CS1058220.pdf; SMSF-Details-GWFSF.pdf; " +
                "Licence-GWilliams.jpg",
            FormFileName: "Rollover-Request-CS1058220.pdf",
            FormDocumentText:
                "CALDOVA SUPER — REQUEST TO ROLL OVER TO A SELF-MANAGED SUPER FUND\n" +
                "=================================================================\n\n" +
                "Member: Grace Williams        DOB: 22/07/1963        Member no.: CS-1058220\n" +
                "Contact details (updated 02/11/2026): mobile 0491 570 158, " +
                "email grace.w.super@mailbox.example\n" +
                "Amount: Whole balance (approx. $612,400)\n\n" +
                "Receiving SMSF\n" +
                "Fund name: GW Family Superannuation Fund\n" +
                "ABN: 98 765 432 109 (registered 28/10/2026)\n" +
                "Electronic service address (ESA): smsfmsg-gwfsf\n" +
                "Bank: BSB 062-***, account ****7781, account name \"G Williams Holdings Pty Ltd\"\n" +
                "Member / trustee of the SMSF: Grace Williams (as stated)\n\n" +
                "Declaration\n" +
                "I request the trustee to roll over my whole balance to the SMSF above.\n" +
                "Signed: G. Williams        Date: 05/11/2026\n" +
                "Identity document attached: Victorian driver licence (image)",
            ExpectedFields: new RequestExtractedFields(
                ClientName: "Grace Williams",
                ClientEmail: "grace.williams@example.com",
                ClientPhone: "0491 570 157",
                MemberNumber: "CS-1058220",
                Product: "Caldova Super — Select",
                RequestType: RequestTypes.RolloverOutSmsf,
                ReceivedDate: "2026-11-06",
                AdviserName: "None (direct member)",
                AdviserPractice: "",
                RequestSummary:
                    "Request, sent from a newly changed email address, to roll over the whole " +
                    "balance (~$612,400) to 'GW Family Superannuation Fund' — an SMSF " +
                    "registered on 28/10/2026 — paying an account named 'G Williams Holdings " +
                    "Pty Ltd'. Mobile and email were changed by phone on 02/11/2026; a travel " +
                    "notice (Italy, from 18/10/2026) is on file. Verified contacts shown are " +
                    "the pre-change details.",
                Amount: "AUD 612,400 (whole balance)",
                PreferredContact: "Phone — verified pre-change number 0491 570 157 only"),
            ExpectedNigo: new[]
            {
                new NigoCheck("contact-change", "Recent change of details", "action", "Mobile and email changed by phone on 02/11/2026; this request came from the NEW email. Only call back on the pre-change verified number."),
                new NigoCheck("svs", "SMSF verification (SVS)", "action", "A rollover to an SMSF needs a passing ATO SVS check (member's TFN linked, bank details and ESA match) — not yet run."),
                new NigoCheck("payee", "Payee name", "action", "Bank account name 'G Williams Holdings Pty Ltd' is not the SMSF's name."),
                new NigoCheck("id", "Identity document", "action", "Licence image supplied — appears altered; refer to Financial Crime for an authenticity check."),
                new NigoCheck("signature", "Signature", "action", "Signed 'G. Williams' — differs from the specimen signature on file."),
                new NigoCheck("pressure", "Urgency / pressure", "action", "Pressure to act fast ('investment opportunity closes next week') and 'don't call my old number' — common scam indicators."),
            },
            ExpectedPriority: "Urgent",
            ExpectedPriorityReason:
                "Multiple account-takeover indicators: contact details changed four days before a " +
                "full-balance rollover, newly registered SMSF, payee name mismatch, member " +
                "travelling overseas. Refer to Financial Crime before any processing; do not " +
                "contact the requester on the new details."),

        // ── 3. George Papadopoulos — account-based pension commencement ──────
        new RequestSample(
            Id: "pension-george",
            Label: "Pension commencement — George Papadopoulos (via Bayside Financial Partners)",
            RequestType: RequestTypes.PensionCommencement,
            ClientName: "George Papadopoulos",
            ClientEmail: "georgep@example.com",
            MemberNumber: "CS-1077881",
            EmailSubject: "Pension commencement — George Papadopoulos (CS-1077881)",
            EmailFrom: "Marcus Tan <marcus.tan@baysidefp.example.com.au>",
            EmailDate: "Mon, 9 Nov 2026 11:05",
            EmailBody:
                "Good morning Caldova Pensions team,\n\n" +
                "My client George Papadopoulos (66) retired from his electrical contracting " +
                "business last month and would like to start an account-based pension.\n\n" +
                "• Transfer $1,250,000 from his Caldova Super (Select) accumulation account " +
                "CS-1077881 into a new Caldova Pension account, leaving the balance " +
                "(approx. $34,600) in accumulation.\n" +
                "• Income: $78,000 p.a., paid monthly ($6,500) on the 15th, to his " +
                "nominated account.\n" +
                "• Reversionary beneficiary: his wife, Helen Papadopoulos.\n" +
                "• Investment: Balanced model, with two years of payments held in cash.\n\n" +
                "George has no existing retirement-phase income streams. The signed pension " +
                "application and reversionary nomination are attached. Please commence on " +
                "Monday 16 November if possible.\n\n" +
                "Regards,\n" +
                "Marcus Tan\n" +
                "Financial Adviser | Bayside Financial Partners, Brighton VIC | Adviser code ADV-20871\n\n" +
                "Attachment: Caldova-Pension-Application-Papadopoulos.pdf",
            FormFileName: "Caldova-Pension-Application-Papadopoulos.pdf",
            FormDocumentText:
                "CALDOVA PENSION — ACCOUNT-BASED PENSION APPLICATION\n" +
                "==================================================\n\n" +
                "Member: George Papadopoulos     DOB: 03/04/1960 (age 66)     Member no.: CS-1077881\n" +
                "Address: Oakleigh VIC 3166     Email: georgep@example.com     Mobile: 0491 570 159\n" +
                "Condition of release: Age 65 or over (unrestricted non-preserved benefits)\n" +
                "Existing retirement-phase income streams: None\n\n" +
                "Amount to commence pension: $1,250,000 (transfer from accumulation CS-1077881)\n" +
                "Requested commencement date: 16/11/2026\n" +
                "Pension payments: $78,000 per year, paid monthly ($6,500) on the 15th\n" +
                "Nominated bank account: BSB 063-***, account ****2214, account name G & H Papadopoulos\n" +
                "Reversionary beneficiary: Helen Papadopoulos — spouse — DOB 21/09/1963\n" +
                "Investment strategy: Caldova Managed Portfolio — Balanced, with two years of " +
                "payments ($156,000) held in cash and term deposits\n\n" +
                "Declaration: Signed George Papadopoulos 06/11/2026\n" +
                "Adviser: Marcus Tan, Bayside Financial Partners (ADV-20871)",
            ExpectedFields: new RequestExtractedFields(
                ClientName: "George Papadopoulos",
                ClientEmail: "georgep@example.com",
                ClientPhone: "0491 570 159",
                MemberNumber: "CS-1077881 → new pension CP-3077881",
                Product: "Caldova Super — Select → Caldova Pension",
                RequestType: RequestTypes.PensionCommencement,
                ReceivedDate: "2026-11-09",
                AdviserName: "Marcus Tan",
                AdviserPractice: "Bayside Financial Partners",
                RequestSummary:
                    "Commence an account-based pension with $1,250,000 from accumulation " +
                    "(leaving ~$34,600), paying $78,000 p.a. monthly ($6,500 on the 15th), " +
                    "spouse Helen as reversionary beneficiary, Balanced model with a two-year " +
                    "cash bucket ($156,000). Requested start 16/11/2026.",
                Amount: "AUD 1,250,000 to pension",
                PreferredContact: "Email (via adviser)"),
            ExpectedNigo: new[]
            {
                new NigoCheck("signature", "Application signed & dated", "ok", "Signed by the member on 06/11/2026; adviser details complete."),
                new NigoCheck("release", "Condition of release", "ok", "Member is 66 — age 65 condition of release met."),
                new NigoCheck("tbc", "Transfer balance cap declaration", "ok", "No existing retirement-phase income streams declared."),
                new NigoCheck("reversionary", "Reversionary beneficiary", "ok", "Spouse nominated — an eligible reversionary beneficiary."),
                new NigoCheck("bank", "Payment account", "ok", "Joint account in the member's name (G & H Papadopoulos)."),
                new NigoCheck("approval", "Authority limit", "action", "Commencement of $1,000,000 or more needs Team Leader approval before the pension starts."),
            },
            ExpectedPriority: "High",
            ExpectedPriorityReason:
                "Pension commencement of $1,000,000 or more needs Team Leader approval, and the " +
                "requested start date (16/11/2026) is one week away."),

        // ── 4. Tom Bradley — severe financial hardship release ──────────────
        new RequestSample(
            Id: "hardship-tom",
            Label: "Financial hardship release — Tom Bradley (direct member)",
            RequestType: RequestTypes.FinancialHardship,
            ClientName: "Tom Bradley",
            ClientEmail: "tom.bradley@example.com",
            MemberNumber: "CS-1030412",
            EmailSubject: "Financial hardship application — CS-1030412",
            EmailFrom: "Tom Bradley <tom.bradley@example.com>",
            EmailDate: "Wed, 11 Nov 2026 22:47",
            EmailBody:
                "Hi,\n\n" +
                "I'm applying for early release of some of my super on financial hardship " +
                "grounds. I closed my café on Lygon Street last year and I've been on " +
                "JobSeeker since April. I'm now behind on my mortgage and the power bill " +
                "and I'm really struggling to keep up.\n\n" +
                "I'd like to withdraw $15,000 if that's possible. My Centrelink letter, the " +
                "application form and a couple of the overdue notices are attached.\n\n" +
                "I've never had to do anything like this before, so please let me know if " +
                "I've missed something.\n\n" +
                "Thanks,\n" +
                "Tom Bradley\n" +
                "0491 570 110\n\n" +
                "Attachments: Hardship-Application-Bradley.pdf; " +
                "Centrelink-Confirmation-09Nov2026.pdf; Overdue-notices.pdf",
            FormFileName: "Hardship-Application-Bradley.pdf",
            FormDocumentText:
                "CALDOVA SUPER — APPLICATION FOR EARLY RELEASE: SEVERE FINANCIAL HARDSHIP\n" +
                "=========================================================================\n\n" +
                "Member: Tom Bradley       DOB: 19/08/1979 (age 47)       Member no.: CS-1030412\n" +
                "Address: Coburg VIC 3058       Email: tom.bradley@example.com       Mobile: 0491 570 110\n" +
                "Product: Caldova Super — Essential (direct member, no adviser)\n\n" +
                "Amount requested (gross): $15,000\n" +
                "Reason: Unable to meet reasonable and immediate family living expenses — " +
                "mortgage arrears ($6,840), electricity ($1,120 overdue), car registration due\n" +
                "Income support: JobSeeker Payment, continuously since 06/04/2026 (31 weeks)\n" +
                "Supporting evidence: Services Australia Confirmation of Income Support letter " +
                "dated 09/11/2026; overdue notices; statutory declaration\n" +
                "Previous hardship release in the last 12 months: No\n" +
                "Payment to: BSB 033-***, account ****5120, account name Thomas Bradley\n\n" +
                "Declaration: Signed Tom Bradley 11/11/2026",
            ExpectedFields: new RequestExtractedFields(
                ClientName: "Tom Bradley",
                ClientEmail: "tom.bradley@example.com",
                ClientPhone: "0491 570 110",
                MemberNumber: "CS-1030412",
                Product: "Caldova Super — Essential",
                RequestType: RequestTypes.FinancialHardship,
                ReceivedDate: "2026-11-11",
                AdviserName: "None (direct member)",
                AdviserPractice: "",
                RequestSummary:
                    "Early release on severe financial hardship grounds; $15,000 gross " +
                    "requested. On JobSeeker continuously for 31 weeks (Services Australia " +
                    "letter dated 09/11/2026); behind on mortgage and utilities. No hardship " +
                    "release in the last 12 months. Balance $84,300.",
                Amount: "AUD 15,000 requested",
                PreferredContact: "Email or mobile"),
            ExpectedNigo: new[]
            {
                new NigoCheck("signature", "Application signed & dated", "ok", "Signed by the member on 11/11/2026."),
                new NigoCheck("income-support", "26 weeks of income support", "ok", "JobSeeker continuously since 06/04/2026 — 31 weeks."),
                new NigoCheck("letter", "Services Australia letter", "ok", "Confirmation of Income Support dated 09/11/2026 — within 21 days of the application."),
                new NigoCheck("evidence", "Hardship evidence", "ok", "Statutory declaration and overdue notices supplied."),
                new NigoCheck("bank", "Payment account", "ok", "Account name 'Thomas Bradley' matches the member's legal name on file."),
                new NigoCheck("amount", "Amount requested", "action", "$15,000 exceeds the $10,000 maximum hardship release in any 12 months — a partial release is likely."),
            },
            ExpectedPriority: "High",
            ExpectedPriorityReason:
                "Vulnerable member — financial hardship and visible distress (late-night email). " +
                "Needs a human touch, and the amount requested exceeds the $10,000 hardship maximum."),

        // ── 5. Robert Chen — death benefit under a binding nomination ───────
        new RequestSample(
            Id: "death-benefit-robert",
            Label: "Death benefit claim — Robert Chen for Mei Chen (deceased)",
            RequestType: RequestTypes.DeathBenefit,
            ClientName: "Robert Chen",
            ClientEmail: "robert.chen@example.com",
            MemberNumber: "CP-3019042",
            EmailSubject: "Notification of death — Mei Chen (CP-3019042)",
            EmailFrom: "Robert Chen <robert.chen@example.com>",
            EmailDate: "Fri, 13 Nov 2026 09:18",
            EmailBody:
                "Dear Caldova team,\n\n" +
                "I'm writing to let you know that my mother, Mei Chen, passed away on " +
                "12 October 2026. She had a pension account with you (CP-3019042), and her " +
                "adviser Marcus Tan suggested I contact you directly.\n\n" +
                "Mum told us she had a binding nomination in place for my sister Lily and " +
                "me. I've attached a certified copy of the death certificate, the death " +
                "benefit claim form, and certified ID for Lily and myself.\n\n" +
                "I'm handling this for the family, so please contact me if you need " +
                "anything else. We'd appreciate knowing roughly how long this will take.\n\n" +
                "Kind regards,\n" +
                "Robert Chen\n" +
                "Box Hill VIC\n" +
                "0491 570 006\n\n" +
                "Attachments: Death-Certificate-Mei-Chen-certified.pdf; " +
                "Death-Benefit-Claim-Form.pdf; ID-Robert-Chen.pdf; ID-Lily-Chen.pdf",
            FormFileName: "Death-Benefit-Claim-Form.pdf",
            FormDocumentText:
                "CALDOVA SUPER & PENSION — DEATH BENEFIT CLAIM FORM\n" +
                "=================================================\n\n" +
                "Deceased member: Mei Chen      DOB: 05/06/1945      Date of death: 12/10/2026\n" +
                "Account: Caldova Pension CP-3019042 (account-based pension), approx. balance $486,200\n" +
                "Adviser on the account: Marcus Tan, Bayside Financial Partners (ADV-20871)\n\n" +
                "Claimant 1: Robert Chen — son — DOB 30/01/1974 — Box Hill VIC 3128 — " +
                "robert.chen@example.com — 0491 570 006\n" +
                "Claimant 2: Lily Chen — daughter — DOB 11/05/1977 — Doncaster VIC 3108 — " +
                "lily.chen@example.com\n" +
                "Relationship to the deceased: adult children; neither was financially " +
                "dependent on the deceased\n" +
                "Death benefit nomination (per claimants): Binding, signed 18/03/2024 — " +
                "Robert 50%, Lily 50%\n" +
                "Reversionary beneficiary: None (spouse predeceased)\n\n" +
                "Documents provided: certified death certificate (Births, Deaths and " +
                "Marriages Victoria, registration 2026/031874); certified ID for both claimants\n" +
                "Payment instructions: Robert Chen — BSB 083-***, ****9012, account name " +
                "Robert Chen; Lily Chen — BSB 013-***, ****4477, account name Lily Chen\n\n" +
                "Declaration: Signed Robert Chen 12/11/2026; Lily Chen 12/11/2026",
            ExpectedFields: new RequestExtractedFields(
                ClientName: "Robert Chen",
                ClientEmail: "robert.chen@example.com",
                ClientPhone: "0491 570 006",
                MemberNumber: "CP-3019042 (Mei Chen, deceased)",
                Product: "Caldova Pension",
                RequestType: RequestTypes.DeathBenefit,
                ReceivedDate: "2026-11-13",
                AdviserName: "Marcus Tan",
                AdviserPractice: "Bayside Financial Partners",
                RequestSummary:
                    "Death benefit claim for Mei Chen (died 12/10/2026), Caldova Pension " +
                    "CP-3019042 (~$486,200). Binding nomination signed 18/03/2024 names her " +
                    "adult children Robert and Lily 50/50. Certified death certificate and " +
                    "claimant IDs provided; Robert is the family's contact.",
                Amount: "AUD 486,200 (approx. balance)",
                PreferredContact: "Email or phone (Robert, for the family)"),
            ExpectedNigo: new[]
            {
                new NigoCheck("death-certificate", "Certified death certificate", "ok", "Certified copy provided (BDM Victoria, registration 2026/031874)."),
                new NigoCheck("claimant-id", "Claimant identification", "ok", "Certified ID provided for Robert and Lily."),
                new NigoCheck("claim-form", "Claim form signed", "ok", "Signed by both claimants on 12/11/2026."),
                new NigoCheck("nomination", "Death benefit nomination on file", "ok", "Binding nomination signed 18/03/2024 on file — validity to be confirmed by Benefits & Eligibility."),
                new NigoCheck("bank", "Payment accounts", "ok", "Each account is in the claimant's own name."),
                new NigoCheck("pension-stop", "Stop pension payments", "action", "Stop pension payments on Mei Chen's account immediately."),
            },
            ExpectedPriority: "High",
            ExpectedPriorityReason:
                "Bereavement — compassionate, human-led handling. Death benefits always need " +
                "Team Leader approval, and the pension must be stopped."),
    };
}
