using System.Collections.Concurrent;
using CaldovaSuper.App.Models;

namespace CaldovaSuper.App.Services;

/// <summary>
/// One Member Case — the shared record every agent in the Caldova client
/// operations office reads from. Minted by the Onboarding demo (or seeded at
/// start-up) and looked up by case number on every other agent page.
/// </summary>
/// <param name="CaseNumber">Case number, <c>REQ-YYYYMMDD-XXXXXX</c>.</param>
/// <param name="SampleId">Id of the <see cref="RequestSample"/> the case came from.</param>
/// <param name="ClientName">Member / client name (for a death benefit, the claimant).</param>
/// <param name="MemberNumber">Caldova member or account number (e.g. <c>CS-1058220</c>, <c>CP-3019042</c>).</param>
/// <param name="Product">Product and tier (e.g. "Caldova Super — Select").</param>
/// <param name="RequestType">One of the canonical request types (see <see cref="RequestTypes"/>).</param>
/// <param name="ReceivedDate">Date the request was received (<c>yyyy-MM-dd</c>).</param>
/// <param name="AdviserName">Financial adviser on the account, or "None (direct member)".</param>
/// <param name="AdviserPractice">Advice practice, or empty for direct members.</param>
/// <param name="RequestSummary">One-paragraph plain-English summary of the request.</param>
/// <param name="Amount">Headline amount in AUD, formatted (e.g. "AUD 15,000 requested").</param>
/// <param name="Priority">"Standard", "High" or "Urgent".</param>
public record CaseRecord(
    string CaseNumber,
    string SampleId,
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
    string PreferredContact,
    string Priority,
    string PriorityReason,
    DateTimeOffset CreatedAt);

/// <summary>Canonical request types used across the demo.</summary>
public static class RequestTypes
{
    public const string NewAccount = "New account & consolidation";
    public const string RolloverOutSmsf = "Rollover out to SMSF";
    public const string PensionCommencement = "Pension commencement";
    public const string FinancialHardship = "Financial hardship release";
    public const string DeathBenefit = "Death benefit claim";
}

/// <summary>
/// In-memory store of Member Cases. The Onboarding demo mints a fresh case
/// number on every <see cref="Add"/> call; later agents look the case up by
/// case number.
/// </summary>
public class CaseStore
{
    /// <summary>
    /// Suffix tag of the five seeded scenario cases (<c>REQ-yyyyMMdd-OPSnnn</c>).
    /// Live case numbers never contain an "O" (see <see cref="GenerateCaseNumber"/>),
    /// so the tag can't clash with a case opened live.
    /// </summary>
    private const string ScenarioTag = "OPS";

    /// <summary>True for the five seeded scenario cases, false for cases opened live.</summary>
    public static bool IsScenarioCaseNumber(string caseNumber) =>
        caseNumber.Contains($"-{ScenarioTag}", StringComparison.OrdinalIgnoreCase);

    private readonly ConcurrentDictionary<string, CaseRecord> _records =
        new(StringComparer.OrdinalIgnoreCase);

    /// <summary>
    /// Mint a fresh case number, persist the supplied details, and return
    /// the resulting <see cref="CaseRecord"/>.
    /// </summary>
    public CaseRecord Add(
        string sampleId,
        RequestExtractedFields fields,
        string priority,
        string priorityReason)
    {
        var caseNumber = GenerateCaseNumber();
        var record = FromFields(caseNumber, sampleId, fields, priority, priorityReason, DateTimeOffset.UtcNow);
        _records[caseNumber] = record;
        return record;
    }

    public CaseRecord? Get(string caseNumber) =>
        !string.IsNullOrWhiteSpace(caseNumber) && _records.TryGetValue(caseNumber, out var r)
            ? r : null;

    public IReadOnlyList<CaseRecord> All() =>
        _records.Values.OrderByDescending(r => r.CreatedAt).ToList();

    /// <summary>
    /// Pre-populate the store with one case per sample in
    /// <see cref="RequestSampleCatalog"/> (the five canonical scenarios) so
    /// every downstream agent page has cases to pick from the moment the app
    /// starts. Case numbers are deterministic —
    /// <c>REQ-{received yyyyMMdd}-OPS{nnn}</c> — and match the case ids used by
    /// the 3D frontend scenario scripts (e.g. <c>REQ-20261103-OPS001</c>).
    /// No-op if the store already contains records.
    /// </summary>
    public void SeedDefaults()
    {
        if (!_records.IsEmpty) return;

        var now = DateTimeOffset.UtcNow;
        var index = 0;

        foreach (var sample in RequestSampleCatalog.All)
        {
            index++;
            var stamp = sample.ExpectedFields.ReceivedDate.Replace("-", string.Empty);
            if (stamp.Length != 8)
            {
                stamp = now.ToString("yyyyMMdd");
            }
            var caseNumber = $"REQ-{stamp}-{ScenarioTag}{index:000}";

            // Stagger CreatedAt so All() lists scenario 1 (Priya) first.
            _records[caseNumber] = FromFields(
                caseNumber,
                sample.Id,
                sample.ExpectedFields,
                sample.ExpectedPriority,
                sample.ExpectedPriorityReason,
                now.AddMinutes(-index));
        }
    }

    private static CaseRecord FromFields(
        string caseNumber,
        string sampleId,
        RequestExtractedFields f,
        string priority,
        string priorityReason,
        DateTimeOffset createdAt) =>
        new(
            CaseNumber: caseNumber,
            SampleId: sampleId,
            ClientName: f.ClientName,
            ClientEmail: f.ClientEmail,
            ClientPhone: f.ClientPhone,
            MemberNumber: f.MemberNumber,
            Product: f.Product,
            RequestType: f.RequestType,
            ReceivedDate: f.ReceivedDate,
            AdviserName: f.AdviserName,
            AdviserPractice: f.AdviserPractice,
            RequestSummary: f.RequestSummary,
            Amount: f.Amount,
            PreferredContact: f.PreferredContact,
            Priority: priority,
            PriorityReason: priorityReason,
            CreatedAt: createdAt);

    /// <summary>
    /// Generate a case number of the form <c>REQ-YYYYMMDD-XXXXXX</c>. The
    /// 6-character suffix uses cryptographically-strong randomness so two
    /// near-simultaneous submissions cannot collide.
    /// </summary>
    private static string GenerateCaseNumber()
    {
        const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1
        Span<byte> buf = stackalloc byte[6];
        System.Security.Cryptography.RandomNumberGenerator.Fill(buf);
        Span<char> chars = stackalloc char[6];
        for (int i = 0; i < buf.Length; i++)
        {
            chars[i] = alphabet[buf[i] % alphabet.Length];
        }
        var stamp = DateTimeOffset.UtcNow.ToString("yyyyMMdd");
        return $"REQ-{stamp}-{new string(chars)}";
    }
}
