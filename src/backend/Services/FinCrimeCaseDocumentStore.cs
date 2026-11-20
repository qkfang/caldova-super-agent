using System.Collections.Concurrent;
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using CaldovaSuper.App.Models;

namespace CaldovaSuper.App.Services;

/// <summary>
/// One specimen document available to the Financial Crime "Try it out" tab.
/// Mirrors an entry in <c>wwwroot/fincrime/samples/manifest.json</c> (generated
/// by <c>tools/generate_fincrime_samples.py</c>). The optional fields carry the
/// "case file" view of the document so the deterministic checks layer can run
/// when Azure Content Understanding isn't configured.
/// </summary>
public record FinCrimeSampleDocument(
    string Id,
    string Label,
    string Kind,
    string Src,
    string Expected,
    string Description,
    string? ExpectedHolderName = null,
    string? DocumentNumber = null,
    string? Issuer = null,
    decimal? ExpectedTotal = null,
    string? ExpectedIssueDate = null,
    string? ExpectedExpiryDate = null,
    string? ExpectedDateOfBirth = null,
    string? RegistrationDate = null,
    string? DateOfDeath = null,
    string? AccountOpenedDate = null,
    string? IncomeSupportSince = null,
    string? Mrz = null,
    string? SecurityFeatures = null,
    string? TamperIndicators = null,
    string? ElectronicVerification = null);

/// <summary>A document attached to a Member Case (points at a manifest entry).</summary>
public record FinCrimeCaseDocumentRef(string Id, string Label, string Kind, string Src);

/// <summary>
/// A person or entity connected to a case — the member, an applicant, a
/// claimant, a deceased member or a reversionary beneficiary.
/// </summary>
public record FinCrimeCaseParty(
    string Name,
    string Role,
    string? DateOfBirth = null,
    IReadOnlyList<string>? Aliases = null);

/// <summary>
/// One entry on the account-activity timeline. <c>Type</c> drives the risk
/// rules (<c>travel-notice</c>, <c>contact-change</c>, <c>alert</c>,
/// <c>new-device</c>, <c>mfa</c>, <c>request</c>, <c>smsf-registered</c>,
/// <c>kyc</c>, <c>document</c>, <c>check</c>, <c>info</c>); <c>Flag</c> is
/// <c>red</c>, <c>amber</c>, <c>ok</c> or <c>info</c>.
/// </summary>
public record FinCrimeActivityEvent(
    DateTime At,
    bool HasTime,
    string Type,
    string Channel,
    string Summary,
    string Detail,
    string Flag,
    string? Location = null)
{
    /// <summary>Display timestamp, e.g. "Mon 02 Nov 2026, 10:42".</summary>
    public string When => HasTime
        ? At.ToString("ddd dd MMM yyyy, HH:mm", CultureInfo.InvariantCulture)
        : At.ToString("ddd dd MMM yyyy", CultureInfo.InvariantCulture);
}

/// <summary>
/// One screening or verification result held on the case (ATO SVS, DVS,
/// PEP / sanctions, income support). <c>Status</c> is <c>pass</c>,
/// <c>fail</c>, <c>warn</c> or <c>info</c>.
/// </summary>
public record FinCrimeScreeningResult(string Check, string Result, string Status);

/// <summary>The SMSF named on a rollover-out request and its ATO SVS result.</summary>
public record FinCrimeSmsfDetails(
    string FundName,
    string Abn,
    string RegisteredOn,
    string Esa,
    bool AbnIsRegisteredSmsf,
    bool MemberTfnLinked,
    bool BankDetailsMatch,
    bool EsaMatches);

/// <summary>
/// Financial-crime view of a Member Case: who is on it, which payee names are
/// acceptable, the SMSF (if any), the account-activity timeline and the
/// screening results. Scenario cases are keyed by <see cref="CaseRecord.SampleId"/>;
/// cases minted live by the Onboarding demo for an unknown sample get a
/// generic profile built from the case record.
/// </summary>
public record FinCrimeCaseProfile(
    string SampleId,
    bool IsScenario,
    bool MoneyOut,
    IReadOnlyList<FinCrimeCaseParty> Parties,
    IReadOnlyList<string> AcceptedAccountNames,
    IReadOnlyList<string> RequestedPayees,
    FinCrimeSmsfDetails? ReceivingSmsf,
    string VerifiedContact,
    IReadOnlyList<FinCrimeActivityEvent> Timeline,
    IReadOnlyList<FinCrimeScreeningResult> Screening);

/// <summary>
/// Loads the specimen document manifest shipped under
/// <c>wwwroot/fincrime/samples/manifest.json</c>, attaches the scenario
/// documents to each Member Case (keyed by <see cref="CaseRecord.SampleId"/>)
/// and holds the financial-crime case profiles used by the Financial Crime
/// "Try it out" tab.
/// </summary>
public class FinCrimeCaseDocumentStore
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
    };

    // Documents attached to each scenario case by default.
    private static readonly IReadOnlyDictionary<string, string[]> SeedsBySampleId =
        new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
        {
            ["onboarding-priya"] = ["dl-priya"],
            ["rollover-grace"] = ["dl-grace-tampered", "bank-gw-holdings", "smsf-gwfsf"],
            ["pension-george"] = ["dl-george"],
            ["hardship-tom"] = ["bank-tom-bradley", "income-support-tom"],
            ["death-benefit-robert"] = ["death-cert-mei-chen", "passport-robert-chen", "dl-lily-chen"],
        };

    // Documents held on a member's file but not attached to the request by default.
    private static readonly IReadOnlyDictionary<string, string> OnFileOwners =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["dl-grace-genuine"] = "rollover-grace",
        };

    private readonly string _webRoot;
    private readonly IReadOnlyDictionary<string, FinCrimeSampleDocument> _samples;
    private readonly IReadOnlyList<FinCrimeSampleDocument> _orderedSamples;
    private readonly ConcurrentDictionary<string, List<string>> _caseDocs =
        new(StringComparer.OrdinalIgnoreCase);

    public FinCrimeCaseDocumentStore(IWebHostEnvironment env, ILogger<FinCrimeCaseDocumentStore> logger)
    {
        _webRoot = env.WebRootPath ?? Path.Combine(AppContext.BaseDirectory, "wwwroot");
        _orderedSamples = LoadManifest(_webRoot, logger);
        _samples = _orderedSamples.ToDictionary(s => s.Id, StringComparer.OrdinalIgnoreCase);
    }

    /// <summary>All specimen documents declared in the manifest, in manifest order.</summary>
    public IReadOnlyList<FinCrimeSampleDocument> AllSamples() => _orderedSamples;

    public FinCrimeSampleDocument? FindSample(string id) =>
        !string.IsNullOrWhiteSpace(id) && _samples.TryGetValue(id, out var s) ? s : null;

    /// <summary>
    /// Resolve sample ids to manifest entries, preserving the requested order
    /// and skipping unknown or duplicate ids.
    /// </summary>
    public IReadOnlyList<FinCrimeSampleDocument> ResolveSamples(IEnumerable<string>? ids)
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var resolved = new List<FinCrimeSampleDocument>();
        foreach (var id in ids ?? Enumerable.Empty<string>())
        {
            var sample = FindSample(id);
            if (sample is not null && seen.Add(sample.Id)) resolved.Add(sample);
        }
        return resolved;
    }

    /// <summary>Attach the scenario documents to a case the first time it is seen.</summary>
    public void EnsureCaseAttachments(string caseNumber, string sampleId)
    {
        if (string.IsNullOrWhiteSpace(caseNumber)) return;
        _caseDocs.GetOrAdd(caseNumber, _ =>
            SeedsBySampleId.TryGetValue(sampleId ?? string.Empty, out var seeds)
                ? seeds.Where(_samples.ContainsKey).ToList()
                : new List<string>());
    }

    /// <summary>Documents attached to the given case (empty when none were seeded).</summary>
    public IReadOnlyList<FinCrimeCaseDocumentRef> DocumentsForCase(string caseNumber)
    {
        if (string.IsNullOrWhiteSpace(caseNumber) || !_caseDocs.TryGetValue(caseNumber, out var ids))
            return Array.Empty<FinCrimeCaseDocumentRef>();
        return ids
            .Select(FindSample)
            .Where(s => s is not null)
            .Select(s => new FinCrimeCaseDocumentRef(s!.Id, s.Label, s.Kind, s.Src))
            .ToList();
    }

    /// <summary>
    /// Sample ids of the scenario cases a document belongs to (attached to the
    /// request or held on the member's file). Used by the "document not used on
    /// another case" check.
    /// </summary>
    public IReadOnlyList<string> OwnerSampleIds(string documentId)
    {
        var owners = SeedsBySampleId
            .Where(kv => kv.Value.Contains(documentId, StringComparer.OrdinalIgnoreCase))
            .Select(kv => kv.Key)
            .ToList();
        if (OnFileOwners.TryGetValue(documentId, out var owner) &&
            !owners.Contains(owner, StringComparer.OrdinalIgnoreCase))
        {
            owners.Add(owner);
        }
        return owners;
    }

    /// <summary>
    /// Physical path of a specimen image under <c>wwwroot</c>, or null when the
    /// src is not a file inside the web root.
    /// </summary>
    public string? ResolvePhysicalPath(FinCrimeSampleDocument sample)
    {
        if (string.IsNullOrWhiteSpace(sample.Src)) return null;
        var relative = sample.Src.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
        var root = Path.GetFullPath(_webRoot);
        var full = Path.GetFullPath(Path.Combine(root, relative));
        if (!full.StartsWith(root.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar,
                StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }
        return File.Exists(full) ? full : null;
    }

    /// <summary>Financial-crime profile for a case (scenario data or a generic fallback).</summary>
    public FinCrimeCaseProfile ProfileFor(CaseRecord record) =>
        (record.SampleId ?? string.Empty).ToLowerInvariant() switch
        {
            "onboarding-priya" => PriyaProfile(),
            "rollover-grace" => GraceProfile(),
            "pension-george" => GeorgeProfile(),
            "hardship-tom" => TomProfile(),
            "death-benefit-robert" => RobertProfile(),
            _ => GenericProfile(record),
        };

    private static IReadOnlyList<FinCrimeSampleDocument> LoadManifest(string webRoot, ILogger logger)
    {
        var path = Path.Combine(webRoot, "fincrime", "samples", "manifest.json");
        if (!File.Exists(path))
        {
            logger.LogWarning("Financial crime sample manifest not found at {Path} — the document demo will be empty", path);
            return Array.Empty<FinCrimeSampleDocument>();
        }

        try
        {
            using var stream = File.OpenRead(path);
            var doc = JsonSerializer.Deserialize<ManifestRoot>(stream, JsonOptions);
            return (doc?.Samples ?? new List<FinCrimeSampleDocument>())
                .Where(s => !string.IsNullOrWhiteSpace(s.Id))
                .GroupBy(s => s.Id, StringComparer.OrdinalIgnoreCase)
                .Select(g => g.First())
                .ToList();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to load the financial crime sample manifest from {Path}", path);
            return Array.Empty<FinCrimeSampleDocument>();
        }
    }

    private sealed record ManifestRoot(List<FinCrimeSampleDocument> Samples);

    // ── Scenario profiles (canon: docs/scenario-1..5) ───────────────────────

    private static DateTime On(int month, int day, int year = 2026) => new(year, month, day);
    private static DateTime At(int month, int day, int hour, int minute) => new(2026, month, day, hour, minute, 0);

    private static FinCrimeCaseProfile PriyaProfile() => new(
        SampleId: "onboarding-priya",
        IsScenario: true,
        MoneyOut: false,
        Parties: [new("Priya Natarajan", "Applicant (new member)", "1992-02-14")],
        AcceptedAccountNames: ["Priya Natarajan"],
        RequestedPayees: [],
        ReceivingSmsf: null,
        VerifiedContact: "Via her adviser, Hannah Lewis (Yarra Private Wealth) · 0491 570 156 · priya.natarajan@example.com",
        Timeline:
        [
            new(On(10, 28), false, "kyc", "Adviser · electronic ID check",
                "Identity verified electronically (DVS)",
                "Victorian driver licence verified through the Document Verification Service by adviser Hannah Lewis (Yarra Private Wealth).",
                "ok"),
            new(On(10, 30), false, "info", "Paper forms",
                "Application, fee consent and nomination signed",
                "Signed and dated by Priya Natarajan.",
                "info"),
            new(At(11, 3, 9, 12), true, "request", "Email · adviser",
                "Application pack received from the adviser",
                "From Hannah Lewis CFP® (ADV-10442): new Caldova Super (Select) account; consolidate Southern Cross Industry Super and Harbourline Retail Super (about $138,200).",
                "info"),
            new(On(11, 3), false, "kyc", "AML/CTF screening",
                "PEP and sanctions screening — no match",
                "Screened against politically exposed person and sanctions lists; no match.",
                "ok"),
            new(On(11, 3), false, "info", "Account history",
                "New member — no prior account activity",
                "No contact-detail changes, devices or payment requests on record yet.",
                "info"),
        ],
        Screening:
        [
            new("Electronic ID verification (DVS)", "Match — Victorian driver licence, 28/10/2026", "pass"),
            new("Politically exposed person (PEP) screening", "No match", "pass"),
            new("Sanctions screening (DFAT Consolidated List)", "No match", "pass"),
        ]);

    private static FinCrimeCaseProfile GraceProfile() => new(
        SampleId: "rollover-grace",
        IsScenario: true,
        MoneyOut: true,
        Parties: [new("Grace Williams", "Member", "1963-07-22")],
        AcceptedAccountNames: ["Grace Williams", "GW Family Superannuation Fund"],
        RequestedPayees: ["G Williams Holdings Pty Ltd"],
        ReceivingSmsf: new(
            FundName: "GW Family Superannuation Fund",
            Abn: "98 765 432 109",
            RegisteredOn: "2026-10-28",
            Esa: "smsfmsg-gwfsf",
            AbnIsRegisteredSmsf: true,
            MemberTfnLinked: false,
            BankDetailsMatch: false,
            EsaMatches: false),
        VerifiedContact: "0491 570 157 · grace.williams@example.com (the details on file before the 02/11/2026 change)",
        Timeline:
        [
            new(On(10, 18), false, "travel-notice", "Member · travel notice",
                "Travel notice on file — in Italy from 18 Oct 2026",
                "Grace left Melbourne Airport for a long-planned trip through Italy.",
                "info", "Italy"),
            new(On(10, 28), false, "smsf-registered", "Business register (per the request)",
                "ABN registered for 'GW Family Superannuation Fund'",
                "ABN 98 765 432 109 — nine days before the rollover request.",
                "amber"),
            new(At(11, 2, 10, 42), true, "contact-change", "Phone · contact centre",
                "Mobile and email changed by phone",
                "A caller identified as Grace passed knowledge-based questions and said she had 'lost her phone overseas'. Mobile 0491 570 157 → 0491 570 158; email grace.williams@example.com → grace.w.super@mailbox.example.",
                "red"),
            new(At(11, 2, 10, 42), true, "alert", "Email · change-of-details alert",
                "Change-of-details alert sent to the previous email",
                "Sent to grace.williams@example.com — not opened while Grace is travelling.",
                "amber"),
            new(At(11, 3, 21, 14), true, "new-device", "Online · new device",
                "Online access registered from a new device",
                "IP address geolocated to Sydney, NSW — the travel notice says Grace is in Italy.",
                "red", "Sydney, NSW"),
            new(At(11, 3, 21, 14), true, "mfa", "Online · MFA",
                "MFA code sent to the changed mobile",
                "One-time code sent to 0491 570 158 — the number changed the day before.",
                "red"),
            new(At(11, 6, 7, 52), true, "request", "Email · from the changed address",
                "Request to roll over the whole balance ($612,400) to an SMSF",
                "From grace.w.super@mailbox.example: roll over to 'GW Family Superannuation Fund' (ABN 98 765 432 109), paying an account named 'G Williams Holdings Pty Ltd'; licence image attached; 'please do not call my old number'.",
                "red"),
            new(On(11, 6), false, "check", "ATO SMSF verification service (SVS)",
                "SVS: member not linked; bank details and ESA don't match",
                "The ABN is a registered SMSF (since 28/10/2026), but Grace's TFN is not linked to it and the bank details and ESA do not match.",
                "red"),
        ],
        Screening:
        [
            new("SVS — ABN is a registered SMSF", "Yes — registered 28/10/2026, nine days before the request", "warn"),
            new("SVS — member's TFN linked to the SMSF", "Not linked", "fail"),
            new("SVS — bank details match", "Do not match ('G Williams Holdings Pty Ltd')", "fail"),
            new("SVS — electronic service address (ESA) matches", "Does not match (smsfmsg-gwfsf)", "fail"),
            new("Travel notice", "On file — Italy from 18/10/2026", "info"),
        ]);

    private static FinCrimeCaseProfile GeorgeProfile() => new(
        SampleId: "pension-george",
        IsScenario: true,
        MoneyOut: true,
        Parties:
        [
            new("George Papadopoulos", "Member", "1960-04-03"),
            new("Helen Papadopoulos", "Reversionary beneficiary (spouse)", "1963-09-21"),
        ],
        AcceptedAccountNames: ["George Papadopoulos", "G & H Papadopoulos"],
        RequestedPayees: ["G & H Papadopoulos"],
        ReceivingSmsf: null,
        VerifiedContact: "0491 570 159 · georgep@example.com (or via his adviser, Marcus Tan)",
        Timeline:
        [
            new(On(11, 6), false, "info", "Paper forms",
                "Pension application signed by the member",
                "Signed by George Papadopoulos; reversionary nomination of his wife, Helen.",
                "info"),
            new(At(11, 9, 11, 5), true, "request", "Email · adviser",
                "Pension application received from the adviser",
                "From Marcus Tan (ADV-20871): commence a $1,250,000 account-based pension paying $78,000 p.a. monthly to the nominated joint account.",
                "info"),
            new(On(11, 9), false, "check", "Account monitoring",
                "No recent contact-detail, bank-account or device changes",
                "Nominated account G & H Papadopoulos (BSB 063-***, ****2214) and contact details unchanged in the 90 days before the request.",
                "ok"),
        ],
        Screening:
        [
            new("Nominated bank account", "G & H Papadopoulos — in the member's name, unchanged", "pass"),
            new("Contact-detail changes (last 90 days)", "None", "pass"),
        ]);

    private static FinCrimeCaseProfile TomProfile() => new(
        SampleId: "hardship-tom",
        IsScenario: true,
        MoneyOut: true,
        Parties: [new("Tom Bradley", "Member", "1979-08-19", ["Thomas Bradley"])],
        AcceptedAccountNames: ["Thomas Bradley", "Tom Bradley"],
        RequestedPayees: ["Thomas Bradley"],
        ReceivingSmsf: null,
        VerifiedContact: "0491 570 110 · tom.bradley@example.com",
        Timeline:
        [
            new(On(4, 6), false, "info", "Services Australia",
                "JobSeeker Payment commenced",
                "Received continuously since 06/04/2026, per the confirmation letter.",
                "info"),
            new(On(11, 9), false, "document", "Services Australia letter",
                "Confirmation of income support issued",
                "Letter dated 09/11/2026: 31 continuous weeks of JobSeeker Payment, still receiving.",
                "ok"),
            new(At(11, 11, 22, 47), true, "request", "Email · member",
                "Hardship application emailed",
                "From the email on file (tom.bradley@example.com): $15,000 requested on severe financial hardship grounds; Centrelink letter, statutory declaration and overdue notices attached.",
                "info"),
            new(On(11, 11), false, "check", "Account monitoring",
                "No recent changes and no SMSF rollover requests",
                "No contact-detail, bank-account or device changes; no hardship release in the last 12 months; no request to roll over to an SMSF.",
                "ok"),
        ],
        Screening:
        [
            new("Income support confirmation", "JobSeeker, 31 continuous weeks — letter dated 09/11/2026", "pass"),
            new("Payee account name", "Thomas Bradley — matches the member's legal name", "pass"),
            new("Hardship release in the last 12 months", "None", "pass"),
            new("SMSF rollover after a hardship request (AUSTRAC indicator)", "None on file", "pass"),
        ]);

    private static FinCrimeCaseProfile RobertProfile() => new(
        SampleId: "death-benefit-robert",
        IsScenario: true,
        MoneyOut: true,
        Parties:
        [
            new("Mei Chen", "Deceased member", "1945-06-05"),
            new("Robert Chen", "Claimant (son)", "1974-01-30"),
            new("Lily Chen", "Claimant (daughter)", "1977-05-11"),
        ],
        AcceptedAccountNames: ["Robert Chen", "Lily Chen"],
        RequestedPayees: ["Robert Chen", "Lily Chen"],
        ReceivingSmsf: null,
        VerifiedContact: "Robert Chen, for the family · 0491 570 006 · robert.chen@example.com",
        Timeline:
        [
            new(On(10, 12), false, "info", "Death certificate",
                "Mei Chen died",
                "Date of death per the certified death certificate (registration 2026/031874).",
                "info"),
            new(On(10, 19), false, "info", "Births, Deaths and Marriages Victoria",
                "Death registered",
                "Registration 2026/031874.",
                "info"),
            new(At(11, 13, 9, 18), true, "request", "Email · claimant",
                "Death notification received from Robert Chen (son)",
                "Email with the certified death certificate, the death benefit claim form and certified ID for Robert and Lily.",
                "info"),
            new(On(11, 13), false, "check", "Pension payments",
                "Pension payments stopped on notification",
                "Caldova Pension CP-3019042.",
                "ok"),
            new(On(11, 13), false, "check", "Account monitoring",
                "No changes or withdrawal attempts on Mei's account",
                "No contact-detail or bank-account changes and no withdrawal requests before or after the date of death.",
                "ok"),
        ],
        Screening:
        [
            new("Claimant screening — Robert Chen", "No PEP or sanctions match", "pass"),
            new("Claimant screening — Lily Chen", "No PEP or sanctions match", "pass"),
            new("Payee accounts", "Each account is in the claimant's own name", "pass"),
        ]);

    private static FinCrimeCaseProfile GenericProfile(CaseRecord r)
    {
        var received = DateTime.TryParseExact(r.ReceivedDate, "yyyy-MM-dd", CultureInfo.InvariantCulture,
            DateTimeStyles.None, out var d)
            ? d
            : r.CreatedAt.LocalDateTime.Date;
        var moneyOut = !string.Equals(r.RequestType, RequestTypes.NewAccount, StringComparison.OrdinalIgnoreCase);
        var contact = string.Join(" · ", new[] { r.ClientPhone, r.ClientEmail }.Where(s => !string.IsNullOrWhiteSpace(s)));
        return new FinCrimeCaseProfile(
            SampleId: r.SampleId ?? string.Empty,
            IsScenario: false,
            MoneyOut: moneyOut,
            Parties: [new(r.ClientName, "Member")],
            AcceptedAccountNames: [r.ClientName],
            RequestedPayees: [],
            ReceivingSmsf: null,
            VerifiedContact: string.IsNullOrWhiteSpace(contact) ? "Contact details on the member file" : contact,
            Timeline:
            [
                new(received, false, "request", "Request",
                    $"Request received — {r.RequestType}",
                    string.IsNullOrWhiteSpace(r.RequestSummary) ? "Captured by the Onboarding Agent." : r.RequestSummary,
                    "info"),
                new(received, false, "info", "Account history",
                    "No other account activity recorded",
                    "This case was opened live with the Onboarding Agent, so there is no further account history in the scenario data.",
                    "info"),
            ],
            Screening:
            [
                new("PEP and sanctions screening", "Not yet run for this case in the scenario data", "info"),
            ]);
    }

    /// <summary>Display name of the member on a scenario case, for messages.</summary>
    public static string OwnerName(string sampleId) =>
        RequestSampleCatalog.FindById(sampleId)?.ClientName ?? sampleId;
}
