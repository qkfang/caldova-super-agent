using System.Globalization;
using System.Text.RegularExpressions;

namespace CaldovaSuper.App.Services;

/// <summary>
/// One counterparty Caldova moves money to or from: another super fund (by
/// USI), a self-managed super fund (by ABN and ESA), the ATO, another
/// platform, a group insurer, or Caldova's own pension division.
/// </summary>
/// <param name="Name">Counterparty name.</param>
/// <param name="Usi">Unique superannuation identifier, when the counterparty is an APRA fund.</param>
/// <param name="Abn">Australian business number (fictional).</param>
/// <param name="Type">Plain-English counterparty type.</param>
/// <param name="Channel">How requests are exchanged (SuperStream, internal, ATO online services…).</param>
/// <param name="Contact">Operational contact for chasing.</param>
/// <param name="Esa">Electronic service address (SMSFs).</param>
/// <param name="TypicalTurnaroundDays">Typical business days to complete once a request is complete.</param>
/// <param name="TurnaroundNote">How the turnaround is measured.</param>
/// <param name="InsuranceHeld">Insurance cover known to be held in this fund for a Caldova member (ends on a full rollover).</param>
/// <param name="Notes">Counterparty notes for the Transfers &amp; Rollovers team.</param>
public record FundDirectoryEntry(
    string Name,
    string? Usi,
    string? Abn,
    string Type,
    string Channel,
    string Contact,
    string? Esa,
    int TypicalTurnaroundDays,
    string TurnaroundNote,
    string? InsuranceHeld,
    string Notes,
    IReadOnlyList<string> Keywords);

/// <summary>
/// The fictional ATO record for a registered SMSF, used to simulate the ATO
/// SMSF verification service (SVS). Bank details are held masked, as the
/// demo never needs full numbers.
/// </summary>
public record SmsfRegistryRecord(
    string FundName,
    string Abn,
    DateOnly RegisteredOn,
    string ComplianceStatus,
    IReadOnlyList<string> LinkedMembers,
    string BankBsbPrefix,
    string BankAccountName,
    string Esa);

/// <summary>One line of an SMSF verification result.</summary>
public record SvsCheck(string Check, bool Passed, string Detail);

/// <summary>Result of an SMSF verification (ATO SVS) check before a rollover to an SMSF.</summary>
public record SvsResult(
    string Abn,
    string? FundName,
    bool Registered,
    string? RegisteredOn,
    int? DaysSinceRegistration,
    string? ComplianceStatus,
    IReadOnlyList<SvsCheck> Checks,
    bool Passed,
    string Outcome,
    string Recommendation);

/// <summary>
/// Deterministic, in-memory directory of the counterparties used by the
/// Transfers &amp; Rollovers agent (Rory) — external funds by USI, SMSFs, the
/// ATO, another platform, a group insurer and Caldova Pension. Backs the
/// <c>lookupFunds</c> and <c>verifySmsf</c> MCP tools and the deterministic
/// <c>/transfers/process</c> flow. All names, USIs and ABNs are fictional.
/// </summary>
public static class FundDirectory
{
    public const string CaldovaUsi = "CDV0101AU";
    public const string CaldovaAbn = "11 222 333 444";
    public const string CaldovaFundName = "Caldova Superannuation Master Fund";

    public static readonly FundDirectoryEntry SouthernCross = new(
        Name: "Southern Cross Industry Super",
        Usi: "SCI0001AU",
        Abn: "21 345 678 901",
        Type: "Industry fund (APRA-regulated)",
        Channel: "SuperStream rollover — requested by USI through the SuperStream gateway",
        Contact: "Rollovers team · rollovers@southerncrosssuper.example.com.au",
        Esa: null,
        TypicalTurnaroundDays: 3,
        TurnaroundNote: "Must pay within 3 business days of receiving a complete request (SIS reg 6.34A); usually 2–3 days.",
        InsuranceHeld: "Death & TPD cover of $520,000 for Priya Natarajan (member 88213045) — ends when the account closes on a full rollover",
        Notes: "Default group cover is insured by Kestrel Group Life. Get written confirmation from the member or adviser (or replacement cover) before requesting a full rollover from a member who holds cover.",
        Keywords: new[] { "industry", "southern cross", "sci", "insurance", "tpd" });

    public static readonly FundDirectoryEntry Harbourline = new(
        Name: "Harbourline Retail Super",
        Usi: "HRB0007AU",
        Abn: "32 456 789 012",
        Type: "Retail fund (APRA-regulated)",
        Channel: "SuperStream rollover — requested by USI through the SuperStream gateway",
        Contact: "Transfers desk · transfers@harbourlinesuper.example.com.au",
        Esa: null,
        TypicalTurnaroundDays: 2,
        TurnaroundNote: "Must pay within 3 business days of receiving a complete request (SIS reg 6.34A); usually 2 days.",
        InsuranceHeld: null,
        Notes: "No insurance on Priya Natarajan's account (member HR-4471902). Accepts electronic rollover requests; sends the rollover benefit statement with the payment.",
        Keywords: new[] { "retail", "harbourline", "hrb" });

    public static readonly FundDirectoryEntry Ato = new(
        Name: "Australian Taxation Office (ATO)",
        Usi: null,
        Abn: null,
        Type: "Regulator",
        Channel: "SuperStream gateway · SMSF verification service (SVS) · transfer balance account reporting",
        Contact: "ATO online services for super funds",
        Esa: null,
        TypicalTurnaroundDays: 1,
        TurnaroundNote: "SVS answers in real time; transfer balance account reports are lodged electronically.",
        InsuranceHeld: null,
        Notes: "Before any rollover to an SMSF, run the SVS (SIS reg 6.33E): registered SMSF ABN and status, member's TFN linked, bank details and ESA match. A transfer balance credit is reported when a retirement-phase pension starts. The ATO also sends members SMSF rollover and change-of-details alerts.",
        Keywords: new[] { "ato", "tax", "regulator", "svs", "tbar", "transfer balance", "superstream", "smsf verification" });

    public static readonly FundDirectoryEntry GwFamilySmsf = new(
        Name: "GW Family Superannuation Fund",
        Usi: null,
        Abn: "98 765 432 109",
        Type: "Self-managed super fund (SMSF)",
        Channel: "SuperStream rollover to the SMSF's electronic service address (ESA)",
        Contact: "As stated on the request: mobile 0491 570 158 · grace.w.super@mailbox.example (changed 2 Nov 2026 — not verified)",
        Esa: "smsfmsg-gwfsf (as stated on the request)",
        TypicalTurnaroundDays: 3,
        TurnaroundNote: "The 3-business-day clock only starts once the SMSF verification passes and all required information is received.",
        InsuranceHeld: null,
        Notes: "ABN registered on 28 Oct 2026. Bank account on the request is in the name \"G Williams Holdings Pty Ltd\" (BSB 062-***, account ****7781). SVS: the member's TFN isn't linked and the bank details and ESA don't match the ATO's records.",
        Keywords: new[] { "smsf", "self-managed", "self managed", "gw family", "grace williams" });

    public static readonly FundDirectoryEntry CaldovaPension = new(
        Name: "Caldova Pension (internal)",
        Usi: CaldovaUsi,
        Abn: CaldovaAbn,
        Type: $"Internal — {CaldovaFundName}",
        Channel: "Internal transfer from Caldova Super (accumulation) to Caldova Pension — no SuperStream message",
        Contact: "Caldova Pensions team · pensions@caldova.example.com.au",
        Esa: null,
        TypicalTurnaroundDays: 0,
        TurnaroundNote: "Runs on the pension commencement date.",
        InsuranceHeld: null,
        Notes: "Accumulation-to-pension transfers stay inside the fund. Pension commencements of $1,000,000 or more need Team Leader approval first. A transfer balance credit is reported to the ATO when the pension starts.",
        Keywords: new[] { "caldova", "pension", "internal", "account-based", "cdv" });

    public static readonly FundDirectoryEntry Bluegum = new(
        Name: "Bluegum Public Sector Super",
        Usi: "BPS0003AU",
        Abn: "43 567 890 123",
        Type: "Public sector fund (APRA-regulated)",
        Channel: "SuperStream rollover — requested by USI through the SuperStream gateway",
        Contact: "Member exits · exits@bluegumsuper.example.com.au",
        Esa: null,
        TypicalTurnaroundDays: 3,
        TurnaroundNote: "3 business days for accumulation interests once the request is complete.",
        InsuranceHeld: null,
        Notes: "Defined benefit members need an exit benefit statement before a rollover can be requested; accumulation members roll over through SuperStream as normal.",
        Keywords: new[] { "public sector", "government", "defined benefit", "bluegum" });

    public static readonly FundDirectoryEntry MurrayRiver = new(
        Name: "Murray River Mutual Super",
        Usi: "MRM0012AU",
        Abn: "54 678 901 234",
        Type: "Industry fund (APRA-regulated)",
        Channel: "SuperStream rollover — requested by USI through the SuperStream gateway",
        Contact: "Rollovers · rollovers@murrayriversuper.example.com.au",
        Esa: null,
        TypicalTurnaroundDays: 3,
        TurnaroundNote: "Must pay within 3 business days of receiving a complete request (SIS reg 6.34A).",
        InsuranceHeld: null,
        Notes: "Most members hold default death, TPD and income protection cover — always check for cover that would end before requesting a full rollover.",
        Keywords: new[] { "industry", "murray", "income protection", "insurance" });

    public static readonly FundDirectoryEntry Kingfisher = new(
        Name: "Kingfisher Wrap",
        Usi: "KFW0004AU",
        Abn: "65 789 012 345",
        Type: "Wrap platform (in-specie transfers)",
        Channel: "In-specie transfer — off-market share transfers and managed fund re-registration, plus a rollover benefit statement",
        Contact: "Platform transitions · transitions@kingfisherwrap.example.com.au",
        Esa: null,
        TypicalTurnaroundDays: 15,
        TurnaroundNote: "Australian listed shares usually take 3–4 business days once forms are complete; managed funds 2–4 weeks; international shares can take up to 3 months.",
        InsuranceHeld: null,
        Notes: "In-specie transfers need a rollover benefit statement (RBS) and signed transfer forms. Pension in-specie transfers move through a temporary accumulation account.",
        Keywords: new[] { "platform", "wrap", "in-specie", "in specie", "shares", "kingfisher" });

    public static readonly FundDirectoryEntry KestrelLife = new(
        Name: "Kestrel Group Life",
        Usi: null,
        Abn: "76 890 123 456",
        Type: "Group life insurer",
        Channel: "Insurer notifications and cover enquiries — email and secure portal",
        Contact: "Group cover team · groupcover@kestrellife.example.com.au",
        Esa: null,
        TypicalTurnaroundDays: 5,
        TurnaroundNote: "Cover confirmations usually within 5 business days.",
        InsuranceHeld: null,
        Notes: "Insures Southern Cross Industry Super members' default Death & TPD cover. Replacement cover inside Caldova Super would need new underwriting — the adviser arranges it before the old cover ends.",
        Keywords: new[] { "insurer", "insurance", "life", "tpd", "kestrel", "group cover" });

    public static readonly FundDirectoryEntry NguyenSmsf = new(
        Name: "Nguyen Family Superannuation Fund",
        Usi: null,
        Abn: "87 654 321 098",
        Type: "Self-managed super fund (SMSF)",
        Channel: "SuperStream rollover to the SMSF's electronic service address (ESA)",
        Contact: "Trustees: Linh and Bao Nguyen (via their SMSF administrator)",
        Esa: "ledgerlink-smsf",
        TypicalTurnaroundDays: 3,
        TurnaroundNote: "3 business days once the SMSF verification passes and all required information is received.",
        InsuranceHeld: null,
        Notes: "Established SMSF (registered 14 Mar 2019, complying). Example of a clean SMSF verification.",
        Keywords: new[] { "smsf", "self-managed", "self managed", "nguyen" });

    private static readonly IReadOnlyList<FundDirectoryEntry> _all = new[]
    {
        SouthernCross, Harbourline, Ato, GwFamilySmsf, CaldovaPension,
        Bluegum, MurrayRiver, Kingfisher, KestrelLife, NguyenSmsf
    };

    // Fictional ATO SMSF register used by the SVS simulation.
    private static readonly IReadOnlyList<SmsfRegistryRecord> _smsfRegister = new[]
    {
        new SmsfRegistryRecord(
            FundName: "GW Family Superannuation Fund",
            Abn: "98765432109",
            RegisteredOn: new DateOnly(2026, 10, 28),
            ComplianceStatus: "Registered — status not determined",
            LinkedMembers: Array.Empty<string>(),
            BankBsbPrefix: "013",
            BankAccountName: "GW Family Superannuation Fund",
            Esa: "quickledger-smsf"),
        new SmsfRegistryRecord(
            FundName: "Nguyen Family Superannuation Fund",
            Abn: "87654321098",
            RegisteredOn: new DateOnly(2019, 3, 14),
            ComplianceStatus: "Complying",
            LinkedMembers: new[] { "Linh Nguyen", "Bao Nguyen" },
            BankBsbPrefix: "083",
            BankAccountName: "Nguyen Family Superannuation Fund",
            Esa: "ledgerlink-smsf"),
    };

    public static IReadOnlyList<FundDirectoryEntry> All => _all;

    /// <summary>
    /// Search the directory by name, USI, ABN or keyword (e.g. "smsf", "ATO",
    /// "insurer"). Several terms can be combined ("SCI0001AU HRB0007AU").
    /// An empty query returns the whole directory.
    /// </summary>
    public static IReadOnlyList<FundDirectoryEntry> Lookup(string? query)
    {
        if (string.IsNullOrWhiteSpace(query))
            return _all;

        var q = query.Trim().ToLowerInvariant();
        var digits = Digits(q);
        var tokens = Regex.Split(q, @"[\s,;|/]+")
            .Where(t => t.Length >= 2 && t is not "and" and not "the" and not "fund" and not "super")
            .ToList();

        var scored = _all.Select(e =>
        {
            var score = 0;
            var name = e.Name.ToLowerInvariant();
            if (name.Contains(q)) score += 10;
            if (e.Usi is not null && q.Contains(e.Usi.ToLowerInvariant())) score += 10;
            if (e.Abn is not null && digits.Length >= 9 && digits.Contains(Digits(e.Abn))) score += 10;
            foreach (var t in tokens)
            {
                if (name.Contains(t)) score += 3;
                if (e.Usi is not null && e.Usi.Equals(t, StringComparison.OrdinalIgnoreCase)) score += 10;
                if (e.Type.Contains(t, StringComparison.OrdinalIgnoreCase)) score += 2;
                if (e.Keywords.Any(k => k.Contains(t) || t.Contains(k))) score += 2;
            }
            return (Entry: e, Score: score);
        });

        return scored.Where(s => s.Score > 0)
            .OrderByDescending(s => s.Score)
            .Select(s => s.Entry)
            .ToList();
    }

    /// <summary>Find a counterparty by its exact USI or ABN.</summary>
    public static FundDirectoryEntry? FindById(string? usiOrAbn)
    {
        if (string.IsNullOrWhiteSpace(usiOrAbn)) return null;
        var digits = Digits(usiOrAbn);
        return _all.FirstOrDefault(e =>
            (e.Usi is not null && e.Usi.Equals(usiOrAbn.Trim(), StringComparison.OrdinalIgnoreCase)) ||
            (e.Abn is not null && digits.Length >= 9 && Digits(e.Abn) == digits));
    }

    /// <summary>
    /// Simulate the ATO SMSF verification service (SIS reg 6.33E) for a
    /// rollover to an SMSF: is the ABN a registered SMSF, is the member's TFN
    /// linked to it, and do the bank details and ESA on the request match the
    /// ATO's records. Like the real service, it reports match / no match and
    /// never reveals the ATO-held details.
    /// </summary>
    /// <param name="asAt">Date of the rollover request (defaults to today) — used to flag newly registered SMSFs.</param>
    public static SvsResult VerifySmsf(
        string? abn, string? memberName, string? bsb, string? accountName, string? esa, DateOnly? asAt = null)
    {
        var abnDigits = Digits(abn ?? string.Empty);
        var displayAbn = abnDigits.Length == 11
            ? $"{abnDigits[..2]} {abnDigits[2..5]} {abnDigits[5..8]} {abnDigits[8..]}"
            : (abn ?? string.Empty).Trim();
        var record = _smsfRegister.FirstOrDefault(r => r.Abn == abnDigits);
        var date = asAt ?? DateOnly.FromDateTime(DateTime.Today);

        if (record is null)
        {
            return new SvsResult(
                Abn: displayAbn,
                FundName: null,
                Registered: false,
                RegisteredOn: null,
                DaysSinceRegistration: null,
                ComplianceStatus: null,
                Checks: new[]
                {
                    new SvsCheck("ABN is a registered SMSF", false, "No SMSF is registered with this ABN."),
                },
                Passed: false,
                Outcome: "FAIL — not a registered SMSF",
                Recommendation: "Do not roll over. Hold the request, send nothing to the receiving fund and refer it to Financial Crime.");
        }

        var days = date.DayNumber - record.RegisteredOn.DayNumber;
        var newlyRegistered = days is >= 0 and < 90;
        var registeredDetail = $"Registered on {record.RegisteredOn.ToString("d MMM yyyy", CultureInfo.InvariantCulture)}" +
            (newlyRegistered ? $" — only {days} day{(days == 1 ? string.Empty : "s")} before this request" : string.Empty) +
            $". ATO status: {record.ComplianceStatus}.";

        var member = Normalise(memberName);
        var linked = member.Length > 0 && record.LinkedMembers.Any(m => Normalise(m) == member);
        var bsbPrefix = Digits(bsb ?? string.Empty);
        var bankMatch = bsbPrefix.Length >= 3
            && bsbPrefix[..3] == record.BankBsbPrefix
            && Normalise(accountName) == Normalise(record.BankAccountName);
        var esaMatch = !string.IsNullOrWhiteSpace(esa)
            && string.Equals(Regex.Replace(esa, @"\s*\(.*\)\s*$", string.Empty).Trim(), record.Esa, StringComparison.OrdinalIgnoreCase);

        var checks = new[]
        {
            new SvsCheck("ABN is a registered SMSF", true, registeredDetail),
            new SvsCheck("Member's TFN is linked to the SMSF", linked,
                linked ? $"{memberName} is a member of this SMSF." : $"{(string.IsNullOrWhiteSpace(memberName) ? "The member" : memberName)}'s TFN is not linked to this SMSF."),
            new SvsCheck("Bank details match the ATO's records", bankMatch,
                bankMatch
                    ? "BSB and account name match."
                    : $"The account on the request (BSB {MaskBsb(bsb)}, \"{accountName}\") doesn't match the account the ATO holds for this SMSF."),
            new SvsCheck("Electronic service address (ESA) matches", esaMatch,
                esaMatch ? "ESA matches." : $"The ESA on the request (\"{esa}\") doesn't match the ESA registered with the ATO."),
            new SvsCheck("No date of death recorded for the member", true, "None recorded."),
        };

        var failed = checks.Count(c => !c.Passed);
        var passed = failed == 0;
        return new SvsResult(
            Abn: displayAbn,
            FundName: record.FundName,
            Registered: true,
            RegisteredOn: record.RegisteredOn.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            DaysSinceRegistration: days,
            ComplianceStatus: record.ComplianceStatus,
            Checks: checks,
            Passed: passed,
            Outcome: passed ? "PASS — SMSF verified" : $"FAIL — {failed} of {checks.Length} checks failed",
            Recommendation: passed
                ? "The SMSF details verify. The rollover can proceed once the usual identity and financial-crime checks are complete — rollovers to an SMSF still need human approval."
                : "Do not roll over. Hold the request, send nothing to the receiving fund and refer it to Financial Crime. The 3-business-day clock doesn't start until all required information is verified.");
    }

    /// <summary>JSON-friendly view of a directory entry (used by lookupFunds and the page).</summary>
    public static object ToView(FundDirectoryEntry e) => new
    {
        name = e.Name,
        usi = e.Usi,
        abn = e.Abn,
        type = e.Type,
        channel = e.Channel,
        contact = e.Contact,
        esa = e.Esa,
        typicalTurnaroundDays = e.TypicalTurnaroundDays,
        turnaroundNote = e.TurnaroundNote,
        insuranceHeld = e.InsuranceHeld,
        notes = e.Notes
    };

    private static string Digits(string s) => new(s.Where(char.IsAsciiDigit).ToArray());

    private static string Normalise(string? s) =>
        Regex.Replace((s ?? string.Empty).ToLowerInvariant(), @"[^a-z0-9]+", " ").Trim();

    private static string MaskBsb(string? bsb)
    {
        var d = Digits(bsb ?? string.Empty);
        return d.Length >= 3 ? $"{d[..3]}-***" : "not supplied";
    }
}
