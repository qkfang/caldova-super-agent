using CaldovaSuper.App.Services;

namespace CaldovaSuper.App.Api;

/// <summary>
/// Deterministic draft generator for the Client Communications "Try it out"
/// demo (Cara). The five seeded scenario cases (switching on
/// <see cref="CaseRecord.SampleId"/>) are shown at the point Cara writes the
/// outcome, with her case summary (sentiment, what happened, what's next)
/// and ready-to-review drafts for both audiences of an adviser-led platform —
/// the member (letter or email), the adviser (only when the account has one)
/// and an SMS. Cases opened live by the Onboarding demo get a type-aware
/// "request received" acknowledgement instead. Every draft carries tone
/// notes and a compliance check: no personal advice, next steps, timeframes,
/// contact details and complaint rights (Caldova's internal dispute
/// resolution first, then AFCA), plus the hardship, fraud-victim and
/// bereavement specifics. The demo therefore always has realistic output,
/// even when the live Foundry agent is not configured; when it is, the
/// agent's streamed narrative is shown alongside these drafts.
/// </summary>
internal static class ClientCommunicationsDrafter
{
    /// <summary>One line of a draft's compliance check. <c>Status</c> is <c>pass</c>, <c>warn</c> or <c>n/a</c>.</summary>
    internal record ComplianceCheck(string Label, string Status, string Note);

    /// <summary>
    /// One ready-to-review communication. <c>Audience</c> is <c>member</c>,
    /// <c>adviser</c> or <c>sms</c> (used by the page to group the cards).
    /// </summary>
    internal record Draft(
        string Id,
        string Audience,
        string AudienceLabel,
        string Channel,
        string Recipient,
        string? Subject,
        string Body,
        string Tone,
        IReadOnlyList<ComplianceCheck> Compliance,
        bool ApprovalRequired,
        string ApprovalReason);

    /// <summary>Cara's plain-English read of the case before she writes anything.</summary>
    internal record CaseSummary(
        string SentimentLabel,
        string Sentiment,
        string WhatHappened,
        IReadOnlyList<string> WhatsNext);

    internal record DraftBundle(
        string Stage,
        string Outcome,
        CaseSummary Summary,
        IReadOnlyList<string> VulnerabilityFlags,
        bool HumanApprovalRequired,
        string HumanApprovalReason,
        IReadOnlyList<Draft> Drafts,
        string? AdviserNote);

    // Fictional Caldova contact number — from the ACMA range reserved for
    // creative works, so it can never reach a real business.
    private const string CaldovaPhone = "1300 975 707";
    private const string ServiceHours = "8:30am–6:00pm Melbourne time, Monday to Friday";
    private const string AfcaContact = "1800 931 678 · www.afca.org.au · info@afca.org.au · GPO Box 3, Melbourne VIC 3001";
    private const string Signature =
        "Cara\nClient Communications Specialist\nCaldova Wealth · Caldova House, Flinders Lane, Melbourne VIC 3000";

    private const string SpotCheckReason =
        "Spot-check — routine communication with no decline, partial approval or vulnerability.";

    internal static DraftBundle Build(CaseRecord r) => !IsScenarioCase(r)
        ? Generic(r)
        : (r.SampleId ?? string.Empty).ToLowerInvariant() switch
        {
            "onboarding-priya" => Priya(r),
            "rollover-grace" => Grace(r),
            "pension-george" => George(r),
            "hardship-tom" => Tom(r),
            "death-benefit-robert" => Robert(r),
            _ => Generic(r)
        };

    // ── 1. Priya — welcome + adviser update (BDBN witness, insurance) ──────────
    private static DraftBundle Priya(CaseRecord r)
    {
        var summary = new CaseSummary(
            SentimentLabel: "Positive · busy",
            Sentiment:
                "Priya has just started a new job and wants it done digitally and properly: \"I've got super scattered across old jobs — I just want one account, set up properly.\" " +
                "Low anxiety, high expectations — she'll appreciate short sections and two clear actions. " +
                "Hannah (her adviser) wants a clean onboarding and a precise list of what's still needed.",
            WhatHappened:
                "Hannah Lewis CFP® (Yarra Private Wealth) sent Priya's application pack on 3 November 2026. " +
                "Priya's Caldova Super (Select) account CS-2049817 is open and invested in the Caldova Managed Portfolio — Growth, " +
                "with her $3,300 p.a. ongoing advice fee set up under a signed consent that meets SIS s99FA. " +
                "The Harbourline Retail Super rollover (about $41,800) has been requested through SuperStream. " +
                "The Southern Cross Industry Super rollover (about $96,400) is on hold because it would end her $520,000 Death & TPD cover, " +
                "and her nomination for Arjun has only one witness, so it's treated as non-binding until she re-signs it.",
            WhatsNext:
            [
                "Harbourline rollover (~$41,800): due within 3 business days of Harbourline having all required information; invested in Growth on arrival with 1% kept in the Caldova Cash Account.",
                "Southern Cross rollover (~$96,400): on hold until Hannah and Priya confirm in writing that ending the $520,000 Death & TPD cover is intended, or replacement cover is in place.",
                "Nomination: Priya re-signs in front of two adult witnesses who aren't beneficiaries — until then the trustee treats it as non-binding.",
                "Priya gives her new employer Caldova's details (USI CDV0101AU, member number CS-2049817) so her Super Guarantee lands in the new account.",
            ]);

        var memberEmail = new Draft(
            Id: "member-welcome",
            Audience: "member",
            AudienceLabel: "Member email — welcome",
            Channel: "Email",
            Recipient: $"{r.ClientName} <{r.ClientEmail}> · cc Hannah Lewis CFP® (Yarra Private Wealth)",
            Subject: "Welcome to Caldova Super, Priya — your member number is CS-2049817",
            Body: $"""
                Hi Priya,

                Welcome to Caldova Super — and congratulations on the new role. Your account is open and ready to go.

                **Your account at a glance**
                - Member number: **CS-2049817**
                - Product: Caldova Super (Select)
                - Investment: Caldova Managed Portfolio — Growth, as set out in Hannah's Statement of Advice (1% stays in your Caldova Cash Account to cover fees)
                - Adviser: Hannah Lewis CFP®, Yarra Private Wealth

                **Bringing your old super across**
                - **Harbourline Retail Super (about $41,800):** we've requested this rollover. Funds have 3 business days to send it once they have everything they need, and we'll invest it as soon as it arrives.
                - **Southern Cross Industry Super (about $96,400):** we've put this one on hold for now. Your Southern Cross account includes **$520,000 of Death & TPD insurance cover, and that cover ends if the account is rolled over.** Hannah will talk it through with you — we'll only go ahead once you've confirmed in writing that you're happy for the cover to end, or that replacement cover is in place.

                **Two quick things for you**
                1. **Give your new employer our details** so your super goes straight to your new account: Caldova Superannuation Master Fund · USI CDV0101AU · ABN 11 222 333 444 · member number CS-2049817.
                2. **Re-sign your death benefit nomination.** Your nomination for Arjun has one witness signature, and the law needs two adult witnesses who aren't named as beneficiaries. Until it's re-signed we'll treat it as non-binding. Hannah has a fresh form for you.

                **What happens next**
                We'll email you when each rollover arrives and is invested. You can follow progress at any time in your Caldova online account (case reference {r.CaseNumber}).

                **Questions?**
                Reply to this email, speak with Hannah, or call us on {CaldovaPhone} ({ServiceHours}).

                {SuperComplaints("reply to this email")}

                Warm regards,
                {Signature}
                """,
            Tone:
                "Warm and congratulatory, then crisp and practical for a busy professional: short sections, two numbered actions, " +
                "and 'BDBN' explained as a 'death benefit nomination'. The insurance warning is stated plainly and the decision is left with Priya and Hannah.",
            Compliance:
            [
                Pass("No personal advice", "The insurance decision and investment choice stay with Priya and her adviser."),
                Pass("Insurance-loss warning", "States that $520,000 Death & TPD cover ends if Southern Cross is rolled over — before it proceeds."),
                Pass("Next steps & timeframes", "Two actions for Priya; rollovers due within 3 business days of the old fund having all information."),
                Pass("Contact details", $"{CaldovaPhone}, reply-to email and her adviser."),
                Pass("Complaint rights", "Caldova IDR (45 days for super) first, then AFCA with full contact details."),
                Pass("Privacy", "No TFN or bank details in the email."),
            ],
            ApprovalRequired: false,
            ApprovalReason: SpotCheckReason);

        var adviserEmail = new Draft(
            Id: "adviser-update",
            Audience: "adviser",
            AudienceLabel: "Adviser update",
            Channel: "Email",
            Recipient: "Hannah Lewis CFP® <hannah.lewis@yarraprivate.example.com.au> · Yarra Private Wealth (ADV-10442)",
            Subject: "Priya Natarajan (CS-2049817) — account open; 2 actions needed: nomination re-sign & insurance confirmation",
            Body: $"""
                Hi Hannah,

                Thanks for Priya Natarajan's application pack (received 3 November 2026). Here's where case {r.CaseNumber} stands.

                **Done**
                - Caldova Super (Select) account **CS-2049817** opened. Identity (DVS) and TFN confirmed; KYC/AML screening clear.
                - Investment: 100% Caldova Managed Portfolio — Growth, consistent with your SoA dated 28 October 2026 (risk profile: Growth); 1% retained in the Caldova Cash Account.
                - Ongoing advice fee: $3,300 p.a. incl. GST ($275 a month) set up under Priya's signed consent — meets SIS s99FA (written, signed and dated, amount, services, 12-month term, can be withdrawn). It will need Priya's written renewal each year.
                - **Harbourline Retail Super** (USI HRB0007AU, member HR-4471902, ~$41,800): rollover requested via SuperStream — due within 3 business days of Harbourline having all required information.

                **Action needed from you (2 items)**
                1. **Binding death benefit nomination.** The nomination for Arjun Mehta (100%) has only one witness. SIS reg 6.17A needs two witnesses aged 18 or over who aren't named in the notice. Please have Priya re-sign; until then the trustee will treat it as non-binding.
                2. **Insurance confirmation — Southern Cross Industry Super** (USI SCI0001AU, member 88213045, ~$96,400). This account holds $520,000 Death & TPD cover, which ends on rollover, and the insurance-loss acknowledgement on the application wasn't ticked. We're holding this rollover until you and Priya confirm in writing that she understands the cover will end, or that replacement cover is in place.

                **For your file**
                - Our Investment Analyst's workbook compares Growth, Balanced and Index Balanced on $138,200 with fees in dollars (about $1,175, $1,120 and $843 a year in Caldova fees). It's attached to the case.
                - We've emailed Priya a welcome with her member number, our fund details for her employer (USI CDV0101AU) and a note about re-signing her nomination.

                Any questions, reply here or call the Adviser Desk on {CaldovaPhone}.

                Kind regards,
                {Signature}
                """,
            Tone:
                "Professional and concise — adviser language with the rule cited for each action, numbered so nothing is missed. " +
                "States facts and what we need; the advice (insurance, investment) stays with Hannah.",
            Compliance:
            [
                Pass("No personal advice", "Facts and rule citations only — the insurance and investment decisions are the adviser's."),
                Pass("Authority to share", "Hannah is the adviser of record on the account (ADV-10442)."),
                Pass("Next steps & timeframes", "Two numbered adviser actions; Harbourline due within 3 business days of having all information."),
                Pass("Rules cited", "SIS s99FA (fee consent) and SIS reg 6.17A (binding nomination witnesses)."),
                Pass("Privacy", "TFN and bank details not repeated."),
            ],
            ApprovalRequired: false,
            ApprovalReason: SpotCheckReason);

        var sms = new Draft(
            Id: "sms",
            Audience: "sms",
            AudienceLabel: "SMS",
            Channel: "SMS",
            Recipient: $"{r.ClientName} · {r.ClientPhone}",
            Subject: null,
            Body: $"Caldova: Welcome Priya! Your super account CS-2049817 is open. Check your email for your employer details and 2 quick next steps. Questions? {CaldovaPhone}",
            Tone: "Short and friendly; points to the email for the detail.",
            Compliance:
            [
                Pass("Non-sensitive", "Member number only — no balances, TFN or bank details."),
                Pass("Points to the full message", "The welcome email carries next steps and complaint rights."),
                Pass("Contact details", CaldovaPhone),
            ],
            ApprovalRequired: false,
            ApprovalReason: SpotCheckReason);

        return new DraftBundle(
            Stage: "Account opened — consolidation in progress",
            Outcome: "Completed",
            Summary: summary,
            VulnerabilityFlags: [],
            HumanApprovalRequired: false,
            HumanApprovalReason: "No vulnerability or adverse decision — drafts can be spot-checked before sending.",
            Drafts: [memberEmail, adviserEmail, sms],
            AdviserNote: null);
    }

    // ── 2. Grace — reassurance to a fraud victim (verified details only) ───────
    private static DraftBundle Grace(CaseRecord r)
    {
        var summary = new CaseSummary(
            SentimentLabel: "Anxious · scam victim",
            Sentiment:
                "Grace is shaken: \"I'm in Florence — I haven't asked anyone to move my super!\" She is independent and careful, " +
                "so she'll want certainty that her money is safe, a calm account of what happened and simple next steps — no jargon, no blame.",
            WhatHappened:
                "A request on 6 November 2026 asked to roll Grace's whole balance ($612,400) to a newly registered SMSF, " +
                "'GW Family Superannuation Fund'. It followed a phone call on 2 November that changed her mobile and email, and online access " +
                "set up from a new device in Sydney on 3 November — while Grace is travelling in Italy. SMSF verification failed, the licence " +
                "image was tampered with and the payee name didn't match. Theo approved the block; the rollover was cancelled and no money left " +
                "the account. Cara reached Grace on her pre-change verified details and she confirmed she never made the request. Her previous " +
                "details are restored and her online access has been reset.",
            WhatsNext:
            [
                "Send the reassurance email only to grace.williams@example.com (pre-change verified email) — after human approval.",
                "A specialist calls Grace on 0491 570 157 at a time that suits her in Italy to set up new online access; the payment and rollover block stays until she re-verifies.",
                "Offer IDCARE's free identity support (1800 595 160).",
                "Internal only: the SMR decision sits with the AML/CTF compliance officer (due within 3 business days). Never mention it to Grace or anyone outside the team.",
            ]);

        var memberEmail = new Draft(
            Id: "member-reassurance",
            Audience: "member",
            AudienceLabel: "Member letter — reassurance",
            Channel: "Email (pre-change verified address only)",
            Recipient: $"{r.ClientName} <grace.williams@example.com> — never grace.w.super@mailbox.example",
            Subject: "Your Caldova Super account is safe — what happened and what we've done",
            Body: $"""
                Dear Grace,

                Thank you for speaking with us — we know this has been unsettling news to receive while you're away. The most important thing first: **your super is safe.** All **$612,400** is still in your Caldova Super account, and no money has left it.

                **What happened**
                On 2 November 2026 someone contacted us pretending to be you and changed the mobile number and email address on your account. On 6 November we received a request, sent from that new email address, to move your whole balance to another super fund. Our checks showed the request didn't come from you, so we stopped it before anything was processed — and you confirmed this when we spoke.

                **What we've done**
                - Stopped and cancelled the request — no money has moved.
                - Restored your previous contact details (this email address and 0491 570 157) and removed the ones that were added.
                - Locked online access to your account and reset your login.
                - Added extra protection: we won't process any withdrawal or rollover until we've confirmed your identity with you directly.

                **What happens next**
                - One of our specialists will call you on 0491 570 157, at a time that suits you in Italy, to set up your new online access.
                - You don't need to do anything else with your account right now.

                **Free support**
                IDCARE, Australia's national identity and cyber support service, can help you check whether your personal information is being misused elsewhere and what to do about it. It's free: call 1800 595 160 or visit www.idcare.org.

                **Keeping you safe**
                We will never ask for your password or a one-time code by phone, email or SMS, and this email contains no links. If anyone contacts you about moving your super, please call us first.

                **Questions?**
                Call us on {CaldovaPhone} ({ServiceHours}). If you're calling from overseas, just reply to this email and we'll call you back on 0491 570 157.

                {SuperComplaints("reply to this email")}

                Kind regards,
                {Signature}
                """,
            Tone:
                "Calm and reassuring. Leads with 'your super is safe', explains what happened in plain words without blame or technical detail, " +
                "and makes the next step (a call on her verified number) feel easy. Never hints at any report to authorities.",
            Compliance:
            [
                Pass("Verified channel only", "Sent to the pre-change verified email; the changed details are never used."),
                Pass("No mention of SMR / investigation detail", "Avoids tipping-off: no AUSTRAC, SMR or 'suspicious matter' wording."),
                Pass("Reassurance", "States the balance ($612,400) is intact and no money moved."),
                Pass("IDCARE referral", "Free identity support — 1800 595 160, www.idcare.org."),
                Pass("No links or code requests", "Reminds Grace we never ask for passwords or one-time codes."),
                Pass("Next steps, contact & complaint rights", "Call-back on 0491 570 157; Caldova IDR (45 days) then AFCA."),
            ],
            ApprovalRequired: true,
            ApprovalReason: "Communication to a fraud victim — must be approved by a human before it is sent.");

        var sms = new Draft(
            Id: "sms",
            Audience: "sms",
            AudienceLabel: "SMS",
            Channel: "SMS (pre-change verified mobile only)",
            Recipient: $"{r.ClientName} · 0491 570 157 — never 0491 570 158",
            Subject: null,
            Body: $"Caldova: Hi Grace, as discussed, your super is safe and no money has moved. Details are in your usual email. We never ask for codes or passwords. {CaldovaPhone}",
            Tone: "Brief and reassuring; no links.",
            Compliance:
            [
                Pass("Verified channel only", "Pre-change verified mobile; never the number added on 2 November."),
                Pass("No mention of SMR", "Says only what Grace needs to know."),
                Pass("No links", "Scam-safe wording; points to the email."),
            ],
            ApprovalRequired: true,
            ApprovalReason: "Communication to a fraud victim — must be approved by a human before it is sent.");

        return new DraftBundle(
            Stage: "Rollover blocked — account secured",
            Outcome: "Blocked",
            Summary: summary,
            VulnerabilityFlags:
            [
                "Scam / identity-takeover victim — contact only on the pre-change verified details (grace.williams@example.com, 0491 570 157).",
                "Member is travelling overseas (Italy) — call at a time that suits her; be calm and unhurried.",
                "Never mention any report to authorities (SMR) — tipping-off risk.",
            ],
            HumanApprovalRequired: true,
            HumanApprovalReason: "Every communication to a fraud victim is reviewed and approved by a human before it is sent.",
            Drafts: [memberEmail, sms],
            AdviserNote: "Grace is a direct member — no adviser on the account, so no adviser update is needed.");
    }

    // ── 3. George — welcome to retirement + confirmation to Marcus ─────────────
    private static DraftBundle George(CaseRecord r)
    {
        var summary = new CaseSummary(
            SentimentLabel: "Positive · a little anxious",
            Sentiment:
                "George is proud and practical, and a little anxious about \"running out\": \"Forty years on the tools — I just want a steady income and to stop worrying.\" " +
                "Celebrate the milestone and give him certainty — exact dates and amounts, no jargon, no advice.",
            WhatHappened:
                "Marcus Tan (Bayside Financial Partners) asked on 9 November 2026 to start an account-based pension for George with $1,250,000 from his accumulation account. " +
                "Ben confirmed the age-65 condition of release, the transfer balance cap ($850,000 of cap space left under the $2.1 million cap) and this year's pro-rated minimum ($38,870). " +
                "Theo approved the commencement in Teams (commencements of $1,000,000 or more). Caldova Pension CP-3077881 started on 16 November 2026 with Helen as reversionary beneficiary; " +
                "$34,600 stays in his super account. Payments of $6,500 a month start on 15 December 2026, tax-free.",
            WhatsNext:
            [
                "First payment of $6,500 on Tuesday 15 December 2026, then on the 15th of each month — tax-free, no PAYG withheld.",
                "Seven payments before 30 June 2027 total $45,500 — above the $38,870 minimum for 2026-27. The minimum is recalculated every 1 July.",
                "Transfer balance credit of $1,250,000 reported to the ATO — $850,000 of cap space remains.",
                "Investments as instructed: two years of payments ($156,000) in cash and term deposits, the remaining $1,094,000 in the Balanced model.",
            ]);

        var memberLetter = new Draft(
            Id: "member-welcome-retirement",
            Audience: "member",
            AudienceLabel: "Member letter — welcome to retirement",
            Channel: "Letter (by email)",
            Recipient: $"{r.ClientName} <{r.ClientEmail}> · copy to Marcus Tan (Bayside Financial Partners)",
            Subject: "Welcome to retirement, George — your Caldova Pension has started",
            Body: $"""
                Dear George,

                Congratulations on your retirement — after forty years on the tools, it's well earned. Your Caldova Pension started on **Monday 16 November 2026**, and we wanted to set out exactly what to expect.

                **Your pension at a glance**
                - Pension account: **CP-3077881**
                - Amount moved into your pension: $1,250,000 from your super account CS-1077881
                - Still in your super account: $34,600
                - Reversionary beneficiary: **Helen** — if you pass away, your pension will continue to be paid to her

                **Your payment schedule**

                | Payment | Details |
                |---|---|
                | Regular payment | **$6,500 a month** ($78,000 a year) |
                | First payment | **Tuesday 15 December 2026** |
                | Then | On the 15th of each month (or the next business day) |
                | Paid to | Your nominated account ending 2214 |
                | Tax | None — payments are tax-free because you're over 60 |
                | Payments before 30 June 2027 | 7 payments, $45,500 in total |

                **The yearly minimum**
                The law sets a minimum amount that must be paid from your pension each financial year. Because your pension started part-way through the year, your minimum for 2026-27 is **$38,870** — your payments are comfortably above it. We'll recalculate the minimum every 1 July and let you know.

                **Your transfer balance cap**
                There's a limit on how much can be moved into retirement pensions over your lifetime — $2.1 million in 2026-27. Your pension uses $1,250,000 of it, leaving **$850,000**. We've reported the transfer to the ATO for you.

                **Want to change something?**
                You can change your payment amount or how often you're paid (as long as it stays above the minimum), or update your bank details, at any time. For decisions about how your pension is invested, Marcus is your first port of call.

                **Questions?**
                Call us on {CaldovaPhone} ({ServiceHours}) or speak with Marcus.

                {SuperComplaints("call us")}

                Enjoy your retirement, George.

                Warm regards,
                {Signature}
                """,
            Tone:
                "Warm and celebratory, then reassuringly precise: one table with every date and amount for a member who worries about running out. " +
                "The minimum and the cap are explained in plain English; investment questions go to Marcus.",
            Compliance:
            [
                Pass("No personal advice", "Investment and income decisions are referred to his adviser."),
                Pass("Amounts, dates & tax treatment", "$6,500 monthly from 15 Dec 2026; tax-free (PAYG nil); minimum $38,870 for 2026-27."),
                Pass("Rules explained plainly", "Minimum drawdown and transfer balance cap ($850,000 remaining)."),
                Pass("Reversionary beneficiary confirmed", "Helen (spouse)."),
                Pass("Contact & complaint rights", "Caldova IDR (45 days) then AFCA."),
                Pass("Privacy", "Bank account masked (ending 2214)."),
            ],
            ApprovalRequired: false,
            ApprovalReason: "Spot-check — the $1,250,000 commencement itself was approved by Theo in Teams.");

        var adviserEmail = new Draft(
            Id: "adviser-update",
            Audience: "adviser",
            AudienceLabel: "Adviser confirmation",
            Channel: "Email",
            Recipient: "Marcus Tan <marcus.tan@baysidefp.example.com.au> · Bayside Financial Partners (ADV-20871)",
            Subject: "George Papadopoulos — Caldova Pension CP-3077881 commenced 16/11/2026",
            Body: $"""
                Hi Marcus,

                Confirming George Papadopoulos's pension commencement (case {r.CaseNumber}).

                **Commencement**
                - Caldova Pension **CP-3077881** commenced 16 November 2026 with $1,250,000 transferred from accumulation CS-1077881; $34,600 remains in accumulation.
                - Approved by our Team Leader (commencements of $1,000,000 or more need approval).
                - Reversionary beneficiary: Helen Papadopoulos (spouse) — recorded.

                **Payments**
                - $78,000 p.a. paid monthly — $6,500 on the 15th, first payment **15 December 2026**, to the nominated joint account (ending 2214).
                - George is over 60, so payments are tax-free (PAYG withholding nil).

                **Rules check**
                - Condition of release: age 65 — met (unrestricted non-preserved).
                - Transfer balance cap: $2.1 million general cap (2026-27); no prior transfer balance account; the $1,250,000 credit leaves **$850,000** of cap space. Credit reported to the ATO.
                - Minimum drawdown: 5% (age 65–74) = $62,500 p.a.; pro-rated 227/365 days for 2026-27 = **$38,870** (rounded to the nearest $10). Scheduled payments before 30 June 2027: $45,500.

                **Investments**
                Implemented per the application: two years of payments ($156,000) in cash and term deposits, with the remaining $1,094,000 in the Caldova Managed Portfolio — Balanced. Our Investment Analyst's workbook comparing three income structures is on the case for your review with George.

                We've sent George a "welcome to retirement" letter with his payment schedule, this year's minimum and how to make changes, plus a short congratulatory SMS.

                Kind regards,
                {Signature}
                Adviser Desk: {CaldovaPhone}
                """,
            Tone: "Adviser language with the full working for the file — every rule, number and date in one place.",
            Compliance:
            [
                Pass("No personal advice", "Workbook offered for the adviser's review; no recommendation to the member."),
                Pass("Authority to share", "Marcus is the adviser of record (ADV-20871)."),
                Pass("Rules cited", "Condition of release, transfer balance cap, minimum drawdown, reversionary nomination."),
                Pass("Privacy", "Bank account masked."),
            ],
            ApprovalRequired: false,
            ApprovalReason: SpotCheckReason);

        var sms = new Draft(
            Id: "sms",
            Audience: "sms",
            AudienceLabel: "SMS",
            Channel: "SMS",
            Recipient: $"{r.ClientName} · {r.ClientPhone}",
            Subject: null,
            Body: $"Caldova: Congratulations on your retirement, George! Your pension has started and your first $6,500 payment arrives 15 Dec. Letter to follow. {CaldovaPhone}",
            Tone: "Short, warm and celebratory.",
            Compliance:
            [
                Pass("Non-sensitive", "No bank details; amount and date only."),
                Pass("Points to the full letter", "The letter carries the schedule and complaint rights."),
                Pass("Contact details", CaldovaPhone),
            ],
            ApprovalRequired: false,
            ApprovalReason: SpotCheckReason);

        return new DraftBundle(
            Stage: "Pension commenced 16 Nov 2026",
            Outcome: "Completed",
            Summary: summary,
            VulnerabilityFlags: [],
            HumanApprovalRequired: false,
            HumanApprovalReason: "Positive outcome already approved by Theo — drafts can be spot-checked before sending.",
            Drafts: [memberLetter, adviserEmail, sms],
            AdviserNote: null);
    }

    // ── 4. Tom — kind partial-approval letter (hardship) ──────────────────────
    private static DraftBundle Tom(CaseRecord r)
    {
        var summary = new CaseSummary(
            SentimentLabel: "Distressed · vulnerable",
            Sentiment:
                "Tom is stressed, proud and a little embarrassed — he applied late at night: \"I never thought I'd need to touch my super — I just need to catch up on the bills.\" " +
                "He needs kindness without judgement, a clear reason why it's $10,000 and not $15,000, and somewhere to turn for free help.",
            WhatHappened:
                "Tom applied on 11 November 2026 to release $15,000 on severe financial hardship grounds. He meets every criterion — 31 weeks of JobSeeker (26 needed), " +
                "still receiving it, a Services Australia letter dated 9 November 2026, unable to meet reasonable living expenses, and no release in the last 12 months — " +
                "but the law caps a hardship release at $10,000 before tax in any 12 months. After a vulnerable-member review, Theo approved a partial release of $10,000. " +
                "Tax: $600 tax-free, $9,400 taxable, $2,068 withheld (22%), so $7,932 will be paid to him on Friday 13 November 2026.",
            WhatsNext:
            [
                "$7,932 paid to Tom's account ending 5120 on Friday 13 November 2026; $2,068 sent to the ATO as tax withheld.",
                "His balance goes from $84,300 to about $74,300 before market movements.",
                "Another hardship release can't be paid for 12 months.",
                "Letter needs human approval before sending (partial approval, vulnerable member); Cara offers Tom a call.",
            ]);

        var memberLetter = new Draft(
            Id: "member-decision",
            Audience: "member",
            AudienceLabel: "Member letter — hardship decision",
            Channel: "Letter (by email)",
            Recipient: $"{r.ClientName} <{r.ClientEmail}>",
            Subject: "Your financial hardship application — $10,000 approved",
            Body: $"""
                Dear Tom,

                Thank you for your application, and for being so open with us about what's been happening. We know it isn't easy to ask for help, and we've looked at your application carefully.

                **Our decision**
                We've approved an early release of **$10,000** from your super on severe financial hardship grounds. You asked for $15,000, and we're sorry we can't release the full amount: the law allows a hardship release of no more than $10,000 (before tax) in any 12-month period, so $10,000 is the most we're able to pay. You met every other requirement.

                **What you'll receive**

                | | Amount |
                |---|---|
                | Amount released (before tax) | $10,000.00 |
                | Tax-free part | $600.00 |
                | Taxable part | $9,400.00 |
                | Tax withheld (22% of the taxable part) | $2,068.00 |
                | **Paid to you** | **$7,932.00** |

                We'll pay **$7,932** into your bank account ending 5120 on **Friday 13 November 2026**.

                **Why tax is taken out**
                Because you're under 60, part of a super withdrawal is taxed. We send the $2,068 to the ATO on your behalf, and it will appear on your income statement for your 2026-27 tax return. The amount withheld isn't necessarily your final tax — that's worked out when you lodge your return, and the ATO or a registered tax agent can help with any questions.

                **What this means for your super**
                Your super balance will go from about $84,300 to about $74,300 (before any market movements). We mention this only so you have the full picture — the rest of your super stays invested for your retirement.

                **Free, confidential help**
                - **National Debt Helpline** — free financial counselling: **1800 007 007** (www.ndh.org.au). A counsellor can talk with your lender and energy provider about hardship arrangements.
                - **Moneysmart** — free tools and guidance from ASIC: www.moneysmart.gov.au

                **What happens next**
                You don't need to do anything else. Please keep in mind that a hardship release can only be paid once in any 12-month period.

                If you'd like to talk any of this through, I'm very happy to call you — just reply to this email or call us on {CaldovaPhone} ({ServiceHours}) and ask for Cara.

                **If you're not happy with our decision**
                You can make a complaint. Please tell us first and our Complaints team will give you a written response within 45 days. If you're still not satisfied, or we haven't responded in time, you can contact the Australian Financial Complaints Authority (AFCA), a free and independent service: {AfcaContact}.

                Take care,
                {Signature}
                """,
            Tone:
                "Kind, respectful and non-judgemental. Acknowledges how hard it is to ask, leads with what we can do, explains the $10,000 cap in one sentence, " +
                "shows the tax in a simple table and mentions the effect on his super gently. Offers a personal call.",
            Compliance:
            [
                Pass("Partial approval explained", "The rule: $1,000–$10,000 before tax, once in any 12 months."),
                Pass("Tax shown clearly", "$600 tax-free, $9,400 taxable, $2,068 withheld (22%), $7,932 net."),
                Pass("Free help", "National Debt Helpline 1800 007 007 and Moneysmart."),
                Pass("No personal financial or tax advice", "Refers tax questions to the ATO or a registered tax agent."),
                Pass("Complaint rights", "Part of the request couldn't be met — Caldova IDR (45 days) then AFCA."),
                Pass("Privacy", "Bank account masked (ending 5120)."),
            ],
            ApprovalRequired: true,
            ApprovalReason: "Partial approval to a vulnerable member — must be approved by a human before it is sent.");

        var sms = new Draft(
            Id: "sms",
            Audience: "sms",
            AudienceLabel: "SMS",
            Channel: "SMS",
            Recipient: $"{r.ClientName} · {r.ClientPhone}",
            Subject: null,
            Body: "Caldova: Hi Tom, we've approved $10,000 (before tax) from your super. $7,932 will reach your account on Fri 13 Nov. Details by email. Free help: 1800 007 007",
            Tone: "Plain and kind; leads with the good news.",
            Compliance:
            [
                Pass("Non-sensitive", "No bank or TFN details."),
                Pass("Points to the full letter", "The letter explains the cap, the tax and complaint rights."),
                Pass("Free help", "National Debt Helpline 1800 007 007."),
            ],
            ApprovalRequired: true,
            ApprovalReason: "Hardship decision to a vulnerable member — human approval required.");

        return new DraftBundle(
            Stage: "Partially approved — $10,000 releasing Fri 13 Nov 2026",
            Outcome: "Partially approved",
            Summary: summary,
            VulnerabilityFlags:
            [
                "Financial hardship — vulnerable member, visible distress (late-night application).",
                "Partial approval: $15,000 requested, $10,000 approved — decision letters need human approval and complaint rights.",
                "Include free financial counselling: National Debt Helpline 1800 007 007 and Moneysmart.",
            ],
            HumanApprovalRequired: true,
            HumanApprovalReason: "Partial approvals and hardship communications are always reviewed by a human before sending.",
            Drafts: [memberLetter, sms],
            AdviserNote: "Tom is a direct member — no adviser on the account, so no adviser update is needed.");
    }

    // ── 5. Robert & Lily — condolence letters (binding nomination) ─────────────
    private static DraftBundle Robert(CaseRecord r)
    {
        var summary = new CaseSummary(
            SentimentLabel: "Grieving · bereaved family",
            Sentiment:
                "Robert is quiet, grieving and organised for the family: \"Mum always said she'd sorted everything — I just want to do this right for her.\" " +
                "He and Lily need gentleness, one consistent contact, clear timing and a simple explanation of the tax.",
            WhatHappened:
                "Robert told us on 13 November 2026 that his mother, Mei Chen, died on 12 October 2026. Pension payments on her Caldova Pension CP-3019042 " +
                "(about $486,200) stopped on notification. The certified death certificate and both IDs are genuine. Mei's binding nomination (signed 18 March 2024 " +
                "before two adult witnesses who aren't beneficiaries, valid to 18 March 2027) names Robert 50% and Lily 50%; as her children they are SIS dependants, " +
                "so the trustee must pay as nominated. As adult non-dependants for tax, 17% is withheld from the taxable part. The portfolio was redeemed and Theo " +
                "approved both payments: each child receives $243,100 gross, $25,622.74 withheld, $217,477.26 net.",
            WhatsNext:
            [
                "Cara calls Robert first, then sends separate condolence letters to Robert and Lily — after human approval.",
                "Update Marcus Tan only with the family's consent.",
                "Close Mei's pension account and send a final statement; each beneficiary receives a statement of the payment and tax withheld for their 2026-27 tax return.",
                "Complaint clock: up to 90 days for a death benefit complaint if one is made — none open.",
            ]);

        Draft CondolenceLetter(string id, string first, string recipient, string accountEnding, string sibling) => new(
            Id: id,
            Audience: "member",
            AudienceLabel: $"Condolence letter — {first}",
            Channel: "Letter (by email)",
            Recipient: recipient,
            Subject: "Your mother's Caldova Pension — with our sympathy",
            Body: $"""
                Dear {first},

                I'm so sorry for the loss of your mother, Mei. Thank you for letting us know, and for gathering what we needed at such a hard time. We've done our best to keep this as simple as we can.

                **Your mother's wishes**
                Your mother made a binding death benefit nomination on 18 March 2024, asking for her pension to be shared equally between you and {sibling}. We've confirmed the nomination is valid, so we've paid it exactly as she asked — half to you and half to {sibling}.

                **Your payment**
                We've paid your share into your nominated account ending {accountEnding}. It should appear within one to two business days.

                | | Your share |
                |---|---|
                | Your 50% share (before tax) | $243,100.00 |
                | Tax-free part (38%) | $92,378.00 |
                | Taxable part (62%) | $150,722.00 |
                | Tax withheld (17% of the taxable part) | $25,622.74 |
                | **Paid to you** | **$217,477.26** |

                **Why some tax was taken out**
                Part of your mother's pension is tax-free and part is taxable. For tax purposes, adult children who weren't financially dependent on their parent are treated as non-dependants, so the law requires us to withhold 17% (15% plus the 2% Medicare levy) from the taxable part. Nothing is taken from the tax-free part. We'll send you a statement of the payment and the tax withheld for your 2026-27 tax return — the ATO or a registered tax agent can help with any questions about it.

                **What happens next**
                There's nothing more you need to do. We'll close your mother's pension account and send you a final statement in the coming weeks.

                **Who to contact**
                I'll be your contact for anything you need. Please call me on {CaldovaPhone} ({ServiceHours}) and ask for Cara, or simply reply to this email.

                {DeathBenefitComplaints("your mother's account")}

                With our deepest sympathy,
                {Signature}
                """,
            Tone:
                "Gentle and unhurried: condolences first, the mother's wishes in her own terms, one table for the money, one short paragraph on the tax, " +
                "one name and one number to call. No process jargon.",
            Compliance:
            [
                Pass("Condolences first", "Opens with sympathy before any detail."),
                Pass("Paid as nominated", "Binding nomination — no trustee discretion; 50/50 as Mei asked."),
                Pass("Tax explained plainly", "38% tax-free / 62% taxable; 17% withheld from the taxable part; $217,477.26 net."),
                Pass("One named contact", $"Cara on {CaldovaPhone}."),
                Pass("Complaint rights", "Caldova IDR (up to 90 days for death benefit complaints) then AFCA."),
                Pass("Privacy", $"Bank account masked (ending {accountEnding}); each beneficiary sees only their own payment."),
            ],
            ApprovalRequired: true,
            ApprovalReason: "Communication to a bereaved family — every word is reviewed by a human before it is sent.");

        var robertLetter = CondolenceLetter(
            "member-condolence-robert", "Robert",
            $"{r.ClientName} <{r.ClientEmail}> — the family's contact", "9012", "Lily");
        var lilyLetter = CondolenceLetter(
            "member-condolence-lily", "Lily",
            "Lily Chen <lily.chen@example.com>", "4477", "Robert");

        var adviserEmail = new Draft(
            Id: "adviser-update",
            Audience: "adviser",
            AudienceLabel: "Adviser update (with the family's consent)",
            Channel: "Email",
            Recipient: "Marcus Tan <marcus.tan@baysidefp.example.com.au> · Bayside Financial Partners (ADV-20871)",
            Subject: "The late Mei Chen (CP-3019042) — death benefit paid to Robert and Lily Chen",
            Body: $"""
                Hi Marcus,

                With the Chen family's consent, an update on your late client Mei Chen's Caldova Pension **CP-3019042** (case {r.CaseNumber}). Thank you for pointing Robert to us.

                - Notification received 13 November 2026 (date of death 12 October 2026); pension payments stopped on notification.
                - Certified death certificate and both beneficiaries' identification verified.
                - Binding death benefit nomination dated 18 March 2024 confirmed valid (two adult witnesses not named in it; lapsing, in force to 18 March 2027): Robert Chen 50%, Lily Chen 50%. Both are SIS dependants (children), so the trustee paid as nominated — no discretion.
                - Tax: adult children who weren't financially dependent are non-dependants for tax — the taxable component (taxed element) was withheld at 17%. Components: 38% tax-free / 62% taxable.
                - Portfolio redeemed to cash; payments approved by our Team Leader (every death benefit needs approval) and paid as lump sums.
                - Each beneficiary: gross $243,100.00 → tax-free $92,378.00, taxable $150,722.00, withheld $25,622.74, **net $217,477.26**.

                We've written to Robert and Lily separately. If either of them asks you about the tax, we're happy to share their payment statements with their permission.

                Kind regards,
                {Signature}
                """,
            Tone: "Respectful and factual — adviser language, with no more personal detail than Marcus needs.",
            Compliance:
            [
                Pass("Family consent", "Send only once Robert confirms the family is happy for Marcus to be updated."),
                Pass("No personal advice", "Facts of the payment only."),
                Pass("Rules cited", "Binding nomination (SIS reg 6.17A), SIS vs tax dependants, 17% withholding."),
                Pass("Privacy", "No bank details or beneficiaries' contact details."),
            ],
            ApprovalRequired: true,
            ApprovalReason: "Concerns a bereaved family and needs their consent — human approval required.");

        var sms = new Draft(
            Id: "sms",
            Audience: "sms",
            AudienceLabel: "SMS",
            Channel: "SMS",
            Recipient: $"{r.ClientName} · {r.ClientPhone}",
            Subject: null,
            Body: $"Caldova: Robert, we're so sorry for your loss. Your mother's pension has been paid as she wished; details are in your email. Call Cara on {CaldovaPhone} anytime.",
            Tone: "Gentle; sent after Cara's call, never instead of it.",
            Compliance:
            [
                Pass("Non-sensitive", "No amounts or bank details by SMS."),
                Pass("Points to the full letter", "The letter carries the payment, tax and complaint rights."),
                Pass("One named contact", $"Cara on {CaldovaPhone}."),
            ],
            ApprovalRequired: true,
            ApprovalReason: "Communication to a bereaved family — human approval required.");

        return new DraftBundle(
            Stage: "Death benefit paid — 50/50 as nominated",
            Outcome: "Completed",
            Summary: summary,
            VulnerabilityFlags:
            [
                "Bereavement — the family is grieving; condolences first and no process jargon.",
                "Two beneficiaries — write to Robert and Lily separately; Robert is the family's contact.",
                "Adviser update to Marcus Tan only with the family's consent.",
            ],
            HumanApprovalRequired: true,
            HumanApprovalReason: "Every communication to a bereaved family is reviewed and approved by a human before it is sent.",
            Drafts: [robertLetter, lilyLetter, adviserEmail, sms],
            AdviserNote: null);
    }

    // ── Request received — cases opened live by the Onboarding demo ──────────
    // (The seeded scenario cases above are shown at the stage where Cara
    // writes the outcome; a freshly opened case gets a type-aware
    // acknowledgement instead.)
    private static DraftBundle Generic(CaseRecord r)
    {
        var first = FirstName(r.ClientName);
        var type = string.IsNullOrWhiteSpace(r.RequestType) ? "request" : r.RequestType;
        var typeLower = type.ToLowerInvariant().Replace("smsf", "SMSF").Replace("death benefit claim", "death benefit request");
        var kind = KindOf(type);
        var hasAdviser = HasAdviser(r);
        var adviserFirst = FirstName(r.AdviserName);
        var nextTeam = NextTeam(type);

        var flags = new List<string>();
        if (kind == "hardship")
            flags.Add("Financial hardship — vulnerable member; kind tone, human review and free financial counselling (National Debt Helpline 1800 007 007, Moneysmart).");
        if (kind == "death")
            flags.Add("Bereavement — condolences first; one named contact; human-approved letters only.");
        if (kind == "rollover")
            flags.Add("Rollover out — write only to the verified contact details on file, invite the member to call if they didn't make the request, and never discuss any suspicion with the requester.");
        if (string.Equals(r.Priority, "Urgent", StringComparison.OrdinalIgnoreCase))
            flags.Add($"Urgent case — {r.PriorityReason}");

        var approvalRequired = flags.Count > 0;

        var opener = kind switch
        {
            "death" => $"Dear {first},\n\nWe're so sorry for your loss. Thank you for letting us know — we'll take care of this with you, one step at a time.",
            "hardship" => $"Dear {first},\n\nThank you for your application. We know it isn't easy to ask for help, and we'll look at it carefully and as quickly as we can.",
            "rollover" => $"Dear {first},\n\nWe've received a request to roll over your super out of Caldova. Before any money moves to another fund — especially a self-managed super fund — we verify the request with the ATO and with you.",
            "pension" => $"Hi {first},\n\nThanks for your pension application — it's a big milestone, and we'll make sure it's set up properly.",
            "account" => $"Hi {first},\n\nThanks for choosing Caldova — your application is with us and we're setting things up.",
            _ => $"Hi {first},\n\nThanks for your request — it's with us and we're on it."
        };

        string[] steps = kind switch
        {
            "death" =>
            [
                "We'll check the documents we have — a certified death certificate and identification for each person receiving a benefit — and let you know straight away if we need anything else.",
                "We'll confirm any death benefit nomination and who can receive the benefit under super law and the trust deed.",
                "We'll explain the amounts and any tax in plain English before anything is paid.",
            ],
            "hardship" =>
            [
                "Our Benefits & Eligibility team will check your application against the severe financial hardship rules — including 26 weeks in a row of Centrelink income support, and a limit of $1,000 to $10,000 (before tax) once in any 12 months.",
                "If we need anything else, we'll ask you once, clearly.",
                "We'll write to you with the decision, the amount and any tax, in plain English.",
            ],
            "rollover" =>
            [
                "We'll verify the request, including checking the receiving fund's details with the ATO's SMSF verification service where an SMSF is involved.",
                "We may call you on the number we already hold to confirm it's really you.",
                "Once the request is verified and we have everything we need, rollovers are completed within 3 business days.",
            ],
            "pension" =>
            [
                "Our Benefits & Eligibility team will confirm your condition of release, your transfer balance cap and this year's minimum payment.",
                "Once everything checks out — and any approval is in place — we'll start your pension and confirm your payment schedule in writing.",
                hasAdviser ? $"We'll keep {r.AdviserName} updated at each step." : "If anything is missing, we'll ask you once, clearly.",
            ],
            "account" =>
            [
                "We'll confirm your member number and our fund details to give your employer.",
                hasAdviser
                    ? $"If anything is missing from your application, we'll let you and {r.AdviserName} know straight away."
                    : "If anything is missing from your application, we'll let you know straight away.",
                "If you've asked us to bring super across from other funds, we'll request it for you — and we'll check first whether you'd lose any insurance cover.",
            ],
            _ =>
            [
                $"Our {nextTeam} team will review your request against your product's rules and the law.",
                "If we need anything else, we'll ask you once, clearly, and explain why.",
                "We'll let you know the outcome and what it means for you, in plain English.",
            ]
        };
        var stepsText = string.Join("\n", steps.Select((s, i) => $"{i + 1}. {s}"));

        var extra = kind switch
        {
            "hardship" =>
                "\n\n**Free, confidential help**\n" +
                "- National Debt Helpline — free financial counselling: 1800 007 007 (www.ndh.org.au)\n" +
                "- Moneysmart — free tools and guidance from ASIC: www.moneysmart.gov.au",
            "rollover" =>
                "\n\n**Didn't make this request?**\n" +
                $"Call us straight away on {CaldovaPhone}. We will never ask for your password or a one-time code by phone, email or SMS.",
            _ => string.Empty
        };

        var summary = new CaseSummary(
            SentimentLabel: kind switch
            {
                "death" => "Grieving",
                "hardship" => "Possibly distressed",
                "rollover" => "Unknown — verify first",
                "pension" or "account" => "Positive",
                _ => "Neutral"
            },
            Sentiment: kind switch
            {
                "death" => "A bereaved family member — be gentle, keep it simple and give one contact.",
                "hardship" => "A member under financial pressure — be kind, clear and practical, and point to free help.",
                "rollover" => "We can't yet be sure the member made this request — write only to verified details and keep it factual and protective.",
                "pension" => "A member reaching a milestone — warm, and clear about what happens next.",
                "account" => "A new member — welcoming, practical and quick to read.",
                _ => "First contact on this request — keep it clear and set expectations."
            },
            WhatHappened: $"{r.ClientName}'s {typeLower} ({r.CaseNumber}) was received on {r.ReceivedDate} and opened by Olivia. {r.RequestSummary}",
            WhatsNext:
            [
                $"{nextTeam} reviews the request against the PDS, trust deed and super law.",
                $"Cara acknowledges the request today by {(string.IsNullOrWhiteSpace(r.PreferredContact) ? "email" : r.PreferredContact)}" +
                    (hasAdviser ? $" and updates {r.AdviserName}." : "."),
                "If anything is missing, we ask once — clearly and with a reason.",
            ]);

        var drafts = new List<Draft>
        {
            new(
                Id: "member-acknowledgement",
                Audience: "member",
                AudienceLabel: "Member email — request received",
                Channel: "Email",
                Recipient: kind == "rollover"
                    ? $"{r.ClientName} <{r.ClientEmail}> — verified details on file"
                    : $"{r.ClientName} <{r.ClientEmail}>",
                Subject: $"We've received your request — {r.CaseNumber}",
                Body: $"""
                    {opener}

                    **Your request**
                    - Reference: {r.CaseNumber}
                    - Type: {type}
                    - Account: {r.MemberNumber}

                    **What happens next**
                    {stepsText}{extra}

                    **Questions?**
                    Reply to this email or call us on {CaldovaPhone} ({ServiceHours}).

                    {(kind == "death" ? DeathBenefitComplaints("your loved one's account") : SuperComplaints("reply to this email"))}

                    Kind regards,
                    {Signature}
                    """,
                Tone: kind switch
                {
                    "death" => "Gentle and simple, with condolences first and one named contact.",
                    "hardship" => "Kind and practical; no judgement; free help up front.",
                    "rollover" => "Calm, factual and protective — no detail the requester could misuse.",
                    _ => "Clear and friendly; sets expectations."
                },
                Compliance: GenericCompliance(kind),
                ApprovalRequired: approvalRequired,
                ApprovalReason: approvalRequired
                    ? "Sensitive case — a human reviews the message before it is sent."
                    : SpotCheckReason),
        };

        if (hasAdviser)
        {
            drafts.Add(new Draft(
                Id: "adviser-update",
                Audience: "adviser",
                AudienceLabel: "Adviser update",
                Channel: "Email",
                Recipient: $"{r.AdviserName}{(string.IsNullOrWhiteSpace(r.AdviserPractice) ? string.Empty : " · " + r.AdviserPractice)}",
                Subject: $"{r.ClientName} — {type} received ({r.CaseNumber})",
                Body: $"""
                    Hi {adviserFirst},

                    We've received {r.ClientName}'s {typeLower} (case {r.CaseNumber}, received {r.ReceivedDate}).

                    - Summary: {r.RequestSummary}
                    - Amount: {r.Amount}
                    - Next: with our {nextTeam} team for review.

                    We'll come back to you straight away if anything is missing, and confirm the outcome to you and your client.

                    Kind regards,
                    {Signature}
                    Adviser Desk: {CaldovaPhone}
                    """,
                Tone: kind == "death"
                    ? "Respectful and brief — adviser language, shared only with the family's consent."
                    : "Concise adviser language.",
                Compliance:
                [
                    Pass("No personal advice", "Status only."),
                    kind == "death"
                        ? Pass("Family consent", "Send only once the family confirms they're happy for the adviser to be updated.")
                        : Pass("Authority to share", "Adviser of record on the account."),
                    Pass("Next steps", "Who has the case and when the adviser will hear back."),
                ],
                ApprovalRequired: kind == "death",
                ApprovalReason: kind == "death"
                    ? "Concerns a bereaved family and needs their consent — human approval required."
                    : SpotCheckReason));
        }

        var smsBody = kind switch
        {
            "death" => $"Caldova: {first}, we're so sorry for your loss. We've received your message ({r.CaseNumber}) and emailed you what happens next. {CaldovaPhone}",
            "rollover" => $"Caldova: We've received a request to roll over your super ({r.CaseNumber}). If this wasn't you, call us now on {CaldovaPhone}.",
            _ => $"Caldova: Hi {first}, we've received your request ({r.CaseNumber}) and we're on it. Details are in your email. Questions? {CaldovaPhone}"
        };

        drafts.Add(new Draft(
            Id: "sms",
            Audience: "sms",
            AudienceLabel: "SMS",
            Channel: "SMS",
            Recipient: $"{r.ClientName} · {r.ClientPhone}",
            Subject: null,
            Body: smsBody,
            Tone: kind == "rollover" ? "Short and protective — invites a call if the member didn't make the request." : "Short acknowledgement.",
            Compliance:
            [
                Pass("Non-sensitive", "Reference number only."),
                Pass("Points to the full message", "The email carries next steps and complaint rights."),
            ],
            ApprovalRequired: approvalRequired,
            ApprovalReason: approvalRequired ? "Sensitive case — human review before sending." : SpotCheckReason));

        return new DraftBundle(
            Stage: $"Request received — with {nextTeam}",
            Outcome: "In progress",
            Summary: summary,
            VulnerabilityFlags: flags,
            HumanApprovalRequired: approvalRequired,
            HumanApprovalReason: approvalRequired
                ? "Sensitive case — these drafts must be reviewed by a human before anything is sent."
                : "Routine acknowledgement — drafts can be spot-checked before sending.",
            Drafts: drafts,
            AdviserNote: hasAdviser ? null : "No adviser on this account — no adviser update is needed.");
    }

    private static IReadOnlyList<ComplianceCheck> GenericCompliance(string kind)
    {
        var checks = new List<ComplianceCheck>
        {
            Pass("No personal advice", "Explains the process only."),
            Pass("Next steps", "What happens next, in order."),
            kind == "rollover"
                ? Pass("Timeframes", "States the 3-business-day rollover standard once the request is verified.")
                : Warn("Timeframes", "No firm date yet — confirm once the assessment is complete."),
            Pass("Contact details", CaldovaPhone),
            Pass("Complaint rights", kind == "death"
                ? "Caldova IDR (up to 90 days for death benefits) then AFCA."
                : "Caldova IDR (45 days) then AFCA."),
        };
        if (kind == "hardship")
            checks.Add(Pass("Free help", "National Debt Helpline 1800 007 007 and Moneysmart."));
        if (kind == "rollover")
            checks.Add(Pass("Verified channel only", "Sent to the details on file; invites the member to call if they didn't make the request."));
        return checks;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /// <summary>
    /// True for the five seeded scenario cases (<c>REQ-yyyyMMdd-OPSnnn</c>),
    /// which are shown at the point Cara writes the outcome. Cases opened
    /// live with the Onboarding Agent are freshly received.
    /// </summary>
    internal static bool IsScenarioCase(CaseRecord r) =>
        CaseStore.IsScenarioCaseNumber(r.CaseNumber);

    private static string SuperComplaints(string howToTellUs) =>
        "**If you're unhappy**\n" +
        $"Please tell us first — {howToTellUs} and our Complaints team will look into it and give you a written response within 45 days. " +
        "If you're not satisfied with our response, or we haven't responded in time, you can contact the Australian Financial Complaints Authority (AFCA), " +
        $"a free and independent service: {AfcaContact}.";

    private static string DeathBenefitComplaints(string whoseAccount) =>
        "**If you're unhappy**\n" +
        $"If you're unhappy with anything about how we've handled {whoseAccount}, please tell us first and we'll do our best to put it right. " +
        "We'll respond in writing within the time that applies — up to 90 days for a complaint about how a death benefit is paid. " +
        $"If you're still not satisfied, you can contact the Australian Financial Complaints Authority (AFCA), a free and independent service: {AfcaContact}.";

    private static ComplianceCheck Pass(string label, string note) => new(label, "pass", note);
    private static ComplianceCheck Warn(string label, string note) => new(label, "warn", note);

    internal static bool HasAdviser(CaseRecord r) =>
        !string.IsNullOrWhiteSpace(r.AdviserName) &&
        !r.AdviserName.TrimStart().StartsWith("None", StringComparison.OrdinalIgnoreCase);

    private static string KindOf(string requestType)
    {
        var t = (requestType ?? string.Empty).ToLowerInvariant();
        if (t.Contains("death")) return "death";
        if (t.Contains("hardship")) return "hardship";
        if (t.Contains("smsf") || t.Contains("rollover")) return "rollover";
        if (t.Contains("pension")) return "pension";
        if (t.Contains("account")) return "account";
        return "general";
    }

    private static string NextTeam(string requestType) => KindOf(requestType) switch
    {
        "death" => "Benefits & Eligibility",
        "hardship" => "Benefits & Eligibility",
        "pension" => "Benefits & Eligibility",
        "rollover" => "Transfers & Rollovers",
        "account" => "Onboarding & Requests",
        _ => "Client Operations"
    };

    internal static string FirstName(string? fullName)
    {
        if (string.IsNullOrWhiteSpace(fullName)) return "there";
        var first = fullName.Trim().Split(' ', 2)[0];
        return string.IsNullOrWhiteSpace(first) ? "there" : first;
    }
}
