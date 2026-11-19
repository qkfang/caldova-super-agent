using System.Globalization;
using System.Text.RegularExpressions;

namespace CaldovaSuper.App.Services;

/// <summary>One money movement on a case — a rollover in or out, an internal transfer, or an ATO report.</summary>
/// <param name="Status">"Dispatched", "Held", "Scheduled" or "Reported".</param>
/// <param name="StatusTone">"ok", "warn", "blocked" or "info" — drives the page's pill colour.</param>
public record TransferLeg(
    string Id,
    string Counterparty,
    string? CounterpartyId,
    string CounterpartyType,
    string Direction,
    string TransferType,
    string From,
    string To,
    decimal? Amount,
    string AmountLabel,
    string Status,
    string StatusTone,
    string Reason,
    string? Reference,
    string Due);

/// <summary>Insurance cover that would end if a rollover went ahead.</summary>
public record InsuranceWarning(string Fund, string Cover, decimal Amount, string Message, string Action, string Status);

/// <summary>One line of the SLA tracker.</summary>
public record SlaItem(string Item, string Counterparty, string Start, string Due, string Status, string Tone, string Note);

/// <summary>The details on a request to roll over to an SMSF, as passed to the SMSF verification.</summary>
public record SmsfRequestDetails(string Abn, string MemberName, string Bsb, string AccountName, string Esa);

/// <summary>A drafted update for the member or adviser.</summary>
public record TransferUpdate(string Audience, string Channel, string Body, string? Note);

/// <summary>
/// Deterministic transfer plan for a Member Case — what Rory's agent
/// produces: every counterparty, what was dispatched / held / scheduled,
/// insurance-loss warnings, the SMSF verification, the SLA tracker and
/// drafted updates. Returned by <see cref="FundCatalog.Build"/> so the Try it
/// out page works with or without a Foundry connection.
/// </summary>
public record TransferPlan(
    string CaseNumber,
    string AsAt,
    string AsAtLabel,
    string OverallStatus,
    string StatusTone,
    string Headline,
    string RequestStatus,
    IReadOnlyList<TransferLeg> Legs,
    IReadOnlyList<FundDirectoryEntry> Counterparties,
    string CounterpartyQuery,
    IReadOnlyList<InsuranceWarning> InsuranceWarnings,
    SmsfRequestDetails? SmsfRequest,
    SvsResult? Svs,
    IReadOnlyList<SlaItem> Sla,
    IReadOnlyList<string> Notes,
    IReadOnlyList<TransferUpdate> Updates,
    bool HumanApprovalRequired,
    string HumanApprovalReason);

/// <summary>
/// Builds the deterministic transfer plan for each Member Case, keyed on the
/// case's sample id (the five canonical scenarios) with a generic fallback
/// for any other case. Numbers and dates follow the scenario canon.
/// </summary>
public static class FundCatalog
{
    /// <summary>Business days allowed to complete a rollover once all required information is received (SIS reg 6.34A).</summary>
    public const int RolloverSlaBusinessDays = 3;

    // Victorian and national public holidays that fall inside the demo window.
    private static readonly HashSet<DateOnly> PublicHolidays = new()
    {
        new DateOnly(2026, 11, 3),   // Melbourne Cup Day (VIC)
        new DateOnly(2026, 12, 25),  // Christmas Day
        new DateOnly(2026, 12, 28),  // Boxing Day (observed)
        new DateOnly(2027, 1, 1),    // New Year's Day
        new DateOnly(2027, 1, 26),   // Australia Day
        new DateOnly(2027, 3, 8),    // Labour Day (VIC)
        new DateOnly(2027, 3, 26),   // Good Friday
        new DateOnly(2027, 3, 29),   // Easter Monday
    };

    public static TransferPlan Build(CaseRecord c) => c.SampleId switch
    {
        "onboarding-priya" => Priya(c),
        "rollover-grace" => Grace(c),
        "pension-george" => George(c),
        "hardship-tom" => Tom(c),
        "death-benefit-robert" => Robert(c),
        _ => Generic(c)
    };

    /// <summary>Add business days, skipping weekends and the public holidays above.</summary>
    public static DateOnly AddBusinessDays(DateOnly start, int days)
    {
        var d = start;
        var added = 0;
        while (added < days)
        {
            d = d.AddDays(1);
            if (IsBusinessDay(d)) added++;
        }
        return d;
    }

    public static bool IsBusinessDay(DateOnly d) =>
        d.DayOfWeek is not DayOfWeek.Saturday and not DayOfWeek.Sunday && !PublicHolidays.Contains(d);

    /// <summary>"Fri 6 Nov 2026".</summary>
    public static string Label(DateOnly d) => d.ToString("ddd d MMM yyyy", CultureInfo.InvariantCulture);

    private static DateOnly CaseDate(CaseRecord c) =>
        DateOnly.TryParseExact(c.ReceivedDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d)
            ? d
            : DateOnly.FromDateTime(DateTime.Today);

    private static string Money(decimal v) =>
        v == decimal.Truncate(v)
            ? v.ToString("C0", CultureInfo.GetCultureInfo("en-AU"))
            : v.ToString("C2", CultureInfo.GetCultureInfo("en-AU"));

    // ── Scenario 1 — Priya: Harbourline now, Southern Cross held ──────────
    private static TransferPlan Priya(CaseRecord c)
    {
        var asAt = CaseDate(c);
        var due = AddBusinessDays(asAt, RolloverSlaBusinessDays);
        const string caldovaAccount = "Caldova Super CS-2049817 (new)";

        var legs = new[]
        {
            new TransferLeg(
                Id: "TR-1",
                Counterparty: FundDirectory.Harbourline.Name,
                CounterpartyId: FundDirectory.Harbourline.Usi,
                CounterpartyType: FundDirectory.Harbourline.Type,
                Direction: "Rollover in",
                TransferType: "SuperStream rollover — full balance",
                From: "Harbourline Retail Super, member HR-4471902",
                To: caldovaAccount,
                Amount: 41_800m,
                AmountLabel: "≈ $41,800",
                Status: "Dispatched",
                StatusTone: "ok",
                Reason: $"No insurance held. Rollover request sent through SuperStream on {Label(asAt)}.",
                Reference: $"RTR-{asAt:yyyyMMdd}-HR4471902",
                Due: Label(due)),
            new TransferLeg(
                Id: "TR-2",
                Counterparty: FundDirectory.SouthernCross.Name,
                CounterpartyId: FundDirectory.SouthernCross.Usi,
                CounterpartyType: FundDirectory.SouthernCross.Type,
                Direction: "Rollover in",
                TransferType: "SuperStream rollover — full balance",
                From: "Southern Cross Industry Super, member 88213045",
                To: caldovaAccount,
                Amount: 96_400m,
                AmountLabel: "≈ $96,400",
                Status: "Held",
                StatusTone: "warn",
                Reason: "Insurance-loss warning: closing this account ends $520,000 of Death & TPD cover. Not requested until Hannah Lewis and Priya confirm in writing, or replacement cover is in place.",
                Reference: null,
                Due: "Clock not started"),
        };

        var warnings = new[]
        {
            new InsuranceWarning(
                Fund: FundDirectory.SouthernCross.Name,
                Cover: "Death & TPD",
                Amount: 520_000m,
                Message: "Rolling over the full balance closes Priya's Southern Cross account, and her $520,000 Death & TPD cover ends with it. The insurance-loss acknowledgement on the application isn't ticked.",
                Action: "Hold the rollover. Ask Hannah Lewis to confirm in writing that Priya understands the cover will end — or to arrange replacement cover first.",
                Status: "Awaiting written confirmation"),
        };

        var sla = new[]
        {
            new SlaItem("Harbourline rollover (≈ $41,800)", FundDirectory.Harbourline.Name, Label(asAt), Label(due),
                "On track", "ok", $"Harbourline must pay within {RolloverSlaBusinessDays} business days of a complete request (SIS reg 6.34A). Chase on {Label(AddBusinessDays(due, 1))} if it hasn't arrived."),
            new SlaItem("Southern Cross rollover (≈ $96,400)", FundDirectory.SouthernCross.Name, "Not started",
                $"{RolloverSlaBusinessDays} business days after the request is sent", "On hold — insurance decision", "warn",
                "The clock starts only once the request is sent with all required information."),
        };

        return new TransferPlan(
            CaseNumber: c.CaseNumber,
            AsAt: asAt.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            AsAtLabel: Label(asAt),
            OverallStatus: "Partially dispatched",
            StatusTone: "warn",
            Headline: "Harbourline rollover requested; Southern Cross held until the insurance decision is confirmed in writing.",
            RequestStatus: "DISPATCHED (1) · HELD (1)",
            Legs: legs,
            Counterparties: new[] { FundDirectory.Harbourline, FundDirectory.SouthernCross, FundDirectory.KestrelLife },
            CounterpartyQuery: "SCI0001AU HRB0007AU",
            InsuranceWarnings: warnings,
            SmsfRequest: null,
            Svs: null,
            Sla: sla,
            Notes: new[]
            {
                "Both funds were found by USI in the fund directory.",
                "Nothing is sent to Southern Cross Industry Super until the insurance decision is confirmed — the adviser update asks for it.",
                "Payments invests each rollover into the Growth model on receipt, keeping 1% in the Caldova Cash Account.",
            },
            Updates: new[]
            {
                new TransferUpdate("Adviser — Hannah Lewis CFP® (Yarra Private Wealth)", "Email",
                    $"Hi Hannah — Priya's Harbourline Retail Super rollover (USI HRB0007AU, member HR-4471902, about $41,800) went out through SuperStream on {Label(asAt)}; Harbourline has three business days to pay it (by {Label(due)}).\n\n" +
                    "We're holding the Southern Cross Industry Super rollover (USI SCI0001AU, member 88213045, about $96,400) because closing that account would end Priya's $520,000 Death & TPD cover. Please send us written confirmation that Priya understands the cover will end — or let us know once replacement cover is in place — and we'll request it the same day.",
                    null),
                new TransferUpdate("Member — Priya Natarajan", "Email",
                    "Hi Priya — we've asked Harbourline Retail Super to move your balance (about $41,800) into your new Caldova Super account, CS-2049817. It should arrive within three business days.\n\n" +
                    "We haven't requested your Southern Cross Industry Super balance yet. That account includes $520,000 of death and TPD insurance, which would end when the account closes. Once you and Hannah confirm in writing — or replacement cover is in place — we'll request it straight away.",
                    "Sent via Client Communications once the adviser has seen it."),
            },
            HumanApprovalRequired: true,
            HumanApprovalReason: "Yes — the Southern Cross rollover stays on hold until the adviser and member confirm the insurance decision in writing. Releasing a hold over an insurance-loss warning is a human decision.");
    }

    // ── Scenario 2 — Grace: SVS fails, rollover held, nothing sent ────────
    private static TransferPlan Grace(CaseRecord c)
    {
        var asAt = CaseDate(c);
        var request = new SmsfRequestDetails(
            Abn: "98 765 432 109",
            MemberName: "Grace Williams",
            Bsb: "062-***",
            AccountName: "G Williams Holdings Pty Ltd",
            Esa: "smsfmsg-gwfsf");
        var svs = FundDirectory.VerifySmsf(request.Abn, request.MemberName, request.Bsb, request.AccountName, request.Esa, asAt);
        var smrDue = AddBusinessDays(asAt, 3);

        var legs = new[]
        {
            new TransferLeg(
                Id: "TR-1",
                Counterparty: FundDirectory.GwFamilySmsf.Name,
                CounterpartyId: FundDirectory.GwFamilySmsf.Abn,
                CounterpartyType: FundDirectory.GwFamilySmsf.Type,
                Direction: "Rollover out",
                TransferType: "Rollover to an SMSF — full balance",
                From: "Caldova Super CS-1058220 (Grace Williams)",
                To: "GW Family Superannuation Fund (ABN 98 765 432 109)",
                Amount: 612_400m,
                AmountLabel: "$612,400",
                Status: "Held",
                StatusTone: "blocked",
                Reason: "SMSF verification failed — Grace's TFN isn't linked to the SMSF and the bank details and ESA don't match the ATO's records. Referred to Financial Crime. Nothing sent to the receiving fund.",
                Reference: null,
                Due: "Clock not running"),
        };

        var sla = new[]
        {
            new SlaItem("SMSF rollover (full balance)", FundDirectory.GwFamilySmsf.Name, "Not started", "—",
                "Clock not running", "blocked",
                "The 3-business-day clock (SIS reg 6.34A) only runs once all required information is received — a failed SMSF verification means it hasn't been."),
            new SlaItem("Suspicious matter report decision", "AUSTRAC (via Financial Crime)", Label(asAt), Label(smrDue),
                "With Financial Crime", "warn",
                "If a suspicion is formed, an SMR is due within 3 business days — lodging it is a human decision."),
        };

        return new TransferPlan(
            CaseNumber: c.CaseNumber,
            AsAt: asAt.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            AsAtLabel: Label(asAt),
            OverallStatus: "Held — referred to Financial Crime",
            StatusTone: "blocked",
            Headline: "Rollover held: the SMSF verification failed. Nothing has been sent to the receiving fund and no money has left Grace's account.",
            RequestStatus: "HELD — NOT SENT",
            Legs: legs,
            Counterparties: new[] { FundDirectory.GwFamilySmsf, FundDirectory.Ato },
            CounterpartyQuery: "98 765 432 109",
            InsuranceWarnings: Array.Empty<InsuranceWarning>(),
            SmsfRequest: request,
            Svs: svs,
            Sla: sla,
            Notes: new[]
            {
                "Nothing has been sent to the receiving fund — no rollover message and no money.",
                "The request is cancelled on the case and referred to Financial Crime: hold, lock online access, call back on the pre-change verified number (0491 570 157) only.",
                "Grace's mobile and email were changed by phone on 2 Nov 2026 at 10:42 — about 93 hours before the request arrived (6 Nov 2026, 07:52).",
                "The SMSF's ABN was registered on 28 Oct 2026, 9 days before the request; the bank account is in the name \"G Williams Holdings Pty Ltd\".",
            },
            Updates: new[]
            {
                new TransferUpdate("Member — Grace Williams", "Phone call, then letter",
                    "Hi Grace — we received a request to move your super to another fund and we've paused it to keep your account safe. Your balance hasn't moved. We'll call you on the number we've had on file for you, or you can call us on the number on our website, so we can confirm what you'd like to do.",
                    "Draft for Client Communications — contact Grace only on her pre-change verified details (0491 570 157 · grace.williams@example.com), never the changed ones."),
            },
            HumanApprovalRequired: true,
            HumanApprovalReason: "Yes — holding a rollover on financial-crime grounds and any rollover to an SMSF need human approval. The Team Leader approves the block; an SMR to AUSTRAC is a human decision.");
    }

    // ── Scenario 3 — George: internal transfer + ATO transfer balance credit ─
    private static TransferPlan George(CaseRecord c)
    {
        var asAt = CaseDate(c);
        var commencement = new DateOnly(2026, 11, 16);

        var legs = new[]
        {
            new TransferLeg(
                Id: "TR-1",
                Counterparty: FundDirectory.CaldovaPension.Name,
                CounterpartyId: FundDirectory.CaldovaPension.Usi,
                CounterpartyType: FundDirectory.CaldovaPension.Type,
                Direction: "Internal transfer",
                TransferType: "Accumulation to account-based pension",
                From: "Caldova Super CS-1077881 (accumulation)",
                To: "Caldova Pension CP-3077881 (new)",
                Amount: 1_250_000m,
                AmountLabel: "$1,250,000",
                Status: "Scheduled",
                StatusTone: "info",
                Reason: $"Runs on {Label(commencement)} once the Team Leader approves the commencement ($1,000,000 or more — raised by Payments). $34,600 stays in accumulation.",
                Reference: $"INT-{commencement:yyyyMMdd}-CP3077881",
                Due: Label(commencement)),
            new TransferLeg(
                Id: "TR-2",
                Counterparty: FundDirectory.Ato.Name,
                CounterpartyId: null,
                CounterpartyType: FundDirectory.Ato.Type,
                Direction: "Report to ATO",
                TransferType: "Transfer balance account report — credit",
                From: "Caldova Pension CP-3077881",
                To: "George's transfer balance account (ATO)",
                Amount: 1_250_000m,
                AmountLabel: "$1,250,000 credit",
                Status: "Scheduled",
                StatusTone: "info",
                Reason: "Reported when the pension starts. General transfer balance cap $2.1 million (2026-27); George has no earlier retirement-phase income streams, so $850,000 of cap space remains.",
                Reference: null,
                Due: $"After commencement ({Label(commencement)})"),
        };

        var sla = new[]
        {
            new SlaItem("Internal transfer to pension", FundDirectory.CaldovaPension.Name, Label(asAt), Label(commencement),
                "Scheduled — awaiting Team Leader approval", "info",
                "Requested start date on the pension application; no external counterparty is involved."),
            new SlaItem("Transfer balance credit report", FundDirectory.Ato.Name, Label(commencement), "After commencement",
                "Scheduled", "info",
                "$1,250,000 credit; $850,000 of the $2.1 million general cap remains."),
        };

        return new TransferPlan(
            CaseNumber: c.CaseNumber,
            AsAt: asAt.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            AsAtLabel: Label(asAt),
            OverallStatus: "Scheduled",
            StatusTone: "info",
            Headline: $"Internal transfer of $1,250,000 scheduled for {Label(commencement)}; the transfer balance credit is reported to the ATO when the pension starts.",
            RequestStatus: "SCHEDULED — 16 NOV 2026",
            Legs: legs,
            Counterparties: new[] { FundDirectory.CaldovaPension, FundDirectory.Ato },
            CounterpartyQuery: "Caldova Pension ATO",
            InsuranceWarnings: Array.Empty<InsuranceWarning>(),
            SmsfRequest: null,
            Svs: null,
            Sla: sla,
            Notes: new[]
            {
                "Internal transfer — no SuperStream message and no external fund involved.",
                "$34,600 stays in accumulation account CS-1077881, so any insurance on that account continues.",
                "The first pension payment of $6,500 is due on 15 Dec 2026 (Payments).",
            },
            Updates: new[]
            {
                new TransferUpdate("Adviser — Marcus Tan (Bayside Financial Partners)", "Email",
                    $"Hi Marcus — George's internal transfer of $1,250,000 from his super account (CS-1077881) to his new Caldova Pension (CP-3077881) is scheduled for {Label(commencement)}, once the commencement is approved. $34,600 stays in his super account. We'll report the $1,250,000 transfer balance credit to the ATO, leaving $850,000 of George's $2.1 million cap.",
                    null),
                new TransferUpdate("Member — George Papadopoulos", "Email",
                    "Hi George — we're getting your pension ready. On Monday 16 November we'll move $1,250,000 from your super account into your new Caldova Pension account (CP-3077881), and $34,600 stays in your super account. We'll also let the ATO know, as the law requires. Your first payment of $6,500 is due on 15 December.",
                    "Sent via Client Communications with the \"welcome to retirement\" letter."),
            },
            HumanApprovalRequired: true,
            HumanApprovalReason: "Yes — a pension commencement of $1,000,000 or more needs Team Leader approval before the internal transfer runs (Payments raises it in Microsoft Teams).");
    }

    // ── Scenario 4 — Tom: a payment, not a transfer ────────────────────────
    private static TransferPlan Tom(CaseRecord c)
    {
        var asAt = CaseDate(c);
        return new TransferPlan(
            CaseNumber: c.CaseNumber,
            AsAt: asAt.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            AsAtLabel: Label(asAt),
            OverallStatus: "No transfer required",
            StatusTone: "info",
            Headline: "No external transfer — the hardship release is a payment to Tom's own bank account, not a rollover.",
            RequestStatus: "NO TRANSFER REQUIRED",
            Legs: Array.Empty<TransferLeg>(),
            Counterparties: Array.Empty<FundDirectoryEntry>(),
            CounterpartyQuery: string.Empty,
            InsuranceWarnings: Array.Empty<InsuranceWarning>(),
            SmsfRequest: null,
            Svs: null,
            Sla: new[]
            {
                new SlaItem("Rollover clock", "—", "—", "—", "Not applicable", "info",
                    "Nothing moves to another fund, so no SuperStream rollover clock applies."),
            },
            Notes: new[]
            {
                "No external transfer or rollover: the $10,000 gross hardship release (partially approved) is paid by Payments to Tom's verified bank account on Fri 13 Nov 2026.",
                "No other fund is involved. The tax withheld is sent to the ATO by Payments as part of the payment.",
            },
            Updates: new[]
            {
                new TransferUpdate("Internal note", "Case file",
                    "No message needed from Transfers & Rollovers — Payments and Client Communications will update Tom about his payment.",
                    null),
            },
            HumanApprovalRequired: false,
            HumanApprovalReason: "No — there's nothing to transfer. The partial release itself is approved by the Team Leader before Payments releases it.");
    }

    // ── Scenario 5 — Robert/Mei: death benefit can't be rolled over ───────
    private static TransferPlan Robert(CaseRecord c)
    {
        var asAt = CaseDate(c);
        return new TransferPlan(
            CaseNumber: c.CaseNumber,
            AsAt: asAt.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            AsAtLabel: Label(asAt),
            OverallStatus: "No transfer required",
            StatusTone: "info",
            Headline: "No rollover is possible — Mei Chen's death benefit is paid to Robert and Lily as cash lump sums.",
            RequestStatus: "NO TRANSFER REQUIRED",
            Legs: Array.Empty<TransferLeg>(),
            Counterparties: Array.Empty<FundDirectoryEntry>(),
            CounterpartyQuery: string.Empty,
            InsuranceWarnings: Array.Empty<InsuranceWarning>(),
            SmsfRequest: null,
            Svs: null,
            Sla: new[]
            {
                new SlaItem("Rollover clock", "—", "—", "—", "Not applicable", "info",
                    "Death benefits to non-dependants can't be rolled over, so no SuperStream rollover is raised."),
            },
            Notes: new[]
            {
                "No rollover possible: Robert and Lily are adult children who weren't financially dependent on Mei, so they're not death-benefit dependants for tax. Their benefit must be paid as a cash lump sum — it can't be rolled over into their own super funds.",
                "Investment Solutions redeems Mei's pension portfolio (about $486,200) to cash; Payments pays 50% to each beneficiary after Team Leader approval — every death benefit needs Team Leader approval.",
                "Mei's pension payments stopped on notification (13 Nov 2026).",
            },
            Updates: new[]
            {
                new TransferUpdate("Family — Robert Chen (for Robert and Lily)", "Email",
                    "Robert, because your mother's benefit is being paid to you and Lily as her adult children, the law requires it to be paid as a cash lump sum — it can't be transferred into your own super funds. There's nothing you need to do for this part. Our Payments team will be in touch once the payment is ready.",
                    "Draft for Client Communications — any message to a bereaved family is approved by a person before it's sent."),
                new TransferUpdate("Adviser — Marcus Tan (Bayside Financial Partners)", "Email",
                    "Hi Marcus — for Mei Chen's death benefit (CP-3019042), no rollover is possible: Robert and Lily aren't death-benefit dependants for tax, so the benefit is paid as cash lump sums once the portfolio is redeemed and the Team Leader approves.",
                    null),
            },
            HumanApprovalRequired: false,
            HumanApprovalReason: "No — there's nothing to transfer. Every death benefit needs Team Leader approval before Payments pays it.");
    }

    // ── Any other case ────────────────────────────────────────────────────
    private static TransferPlan Generic(CaseRecord c)
    {
        var asAt = CaseDate(c);
        var isRollover = c.RequestType.Contains("rollover", StringComparison.OrdinalIgnoreCase)
            || c.RequestType.Contains("consolidation", StringComparison.OrdinalIgnoreCase);
        var amount = ParseAmount(c.Amount);

        if (!isRollover)
        {
            return new TransferPlan(
                CaseNumber: c.CaseNumber,
                AsAt: asAt.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                AsAtLabel: Label(asAt),
                OverallStatus: "No transfer required",
                StatusTone: "info",
                Headline: $"No rollover or transfer is needed for a \"{c.RequestType}\" request.",
                RequestStatus: "NO TRANSFER REQUIRED",
                Legs: Array.Empty<TransferLeg>(),
                Counterparties: Array.Empty<FundDirectoryEntry>(),
                CounterpartyQuery: string.Empty,
                InsuranceWarnings: Array.Empty<InsuranceWarning>(),
                SmsfRequest: null,
                Svs: null,
                Sla: Array.Empty<SlaItem>(),
                Notes: new[] { "No counterparty is involved in this request." },
                Updates: Array.Empty<TransferUpdate>(),
                HumanApprovalRequired: false,
                HumanApprovalReason: "No — there's nothing to transfer.");
        }

        var leg = new TransferLeg(
            Id: "TR-1",
            Counterparty: "Receiving or transferring fund to be confirmed",
            CounterpartyId: null,
            CounterpartyType: "To be confirmed with the fund directory",
            Direction: c.RequestType.Contains("out", StringComparison.OrdinalIgnoreCase) ? "Rollover out" : "Rollover in",
            TransferType: "SuperStream rollover",
            From: c.MemberNumber,
            To: "To be confirmed",
            Amount: amount,
            AmountLabel: amount is decimal a ? Money(a) : "To be confirmed",
            Status: "Held",
            StatusTone: "warn",
            Reason: "Counterparty details (USI or SMSF ABN, ESA and bank details) aren't on the case yet — request them before anything is sent.",
            Reference: null,
            Due: "Clock not started");

        return new TransferPlan(
            CaseNumber: c.CaseNumber,
            AsAt: asAt.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            AsAtLabel: Label(asAt),
            OverallStatus: "Held — information needed",
            StatusTone: "warn",
            Headline: "Rollover held until the counterparty details are confirmed.",
            RequestStatus: "HELD — NOT SENT",
            Legs: new[] { leg },
            Counterparties: Array.Empty<FundDirectoryEntry>(),
            CounterpartyQuery: c.RequestSummary,
            InsuranceWarnings: Array.Empty<InsuranceWarning>(),
            SmsfRequest: null,
            Svs: null,
            Sla: new[]
            {
                new SlaItem("Rollover", "To be confirmed", "Not started", $"{RolloverSlaBusinessDays} business days after a complete request",
                    "Waiting for information", "warn", "The clock starts once all required information is received."),
            },
            Notes: new[]
            {
                "Check for insurance cover that would end, and run the SMSF verification before any rollover to an SMSF.",
            },
            Updates: Array.Empty<TransferUpdate>(),
            HumanApprovalRequired: true,
            HumanApprovalReason: "Yes — the counterparty must be confirmed before anything is sent; rollovers to an SMSF always need human approval.");
    }

    private static decimal? ParseAmount(string? s)
    {
        var m = Regex.Match(s ?? string.Empty, @"\d[\d,]*(?:\.\d+)?");
        return m.Success && decimal.TryParse(m.Value.Replace(",", string.Empty), NumberStyles.Number, CultureInfo.InvariantCulture, out var v)
            ? v
            : null;
    }
}
