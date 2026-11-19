using System.Collections.Concurrent;
using System.Globalization;
using System.Text.RegularExpressions;

namespace CaldovaSuper.App.Services;

/// <summary>
/// Lifecycle of a payment prepared by the Payments Agent (Penny).
/// </summary>
public enum PaymentApprovalStatus
{
    /// <summary>Raised and waiting for the approver in Microsoft Teams.</summary>
    Pending,
    /// <summary>Approved by a human — the payment may now be released.</summary>
    Approved,
    /// <summary>Rejected by the approver — the payment is never released.</summary>
    Rejected,
    /// <summary>Released to the payment rail.</summary>
    Released,
    /// <summary>The case is blocked (financial crime, declined or not yet approved) — nothing can be approved or released.</summary>
    Blocked,
    /// <summary>Superseded by a newer approval raised for the same case.</summary>
    Cancelled
}

/// <summary>One payee on a payment approval (a death benefit can have several).</summary>
public class PaymentPayeeLine
{
    public string Name { get; init; } = string.Empty;

    /// <summary>Masked bank details, e.g. <c>BSB 033-*** ****5120</c>. Full numbers are never stored.</summary>
    public string MaskedAccount { get; init; } = string.Empty;

    public decimal SharePercent { get; init; } = 100m;
    public decimal GrossAmount { get; init; }
    public decimal TaxWithheld { get; init; }
    public decimal NetAmount { get; init; }
    public bool PayeeMatches { get; init; } = true;
    public string? PaymentReference { get; set; }
}

/// <summary>
/// In-memory record of a payment prepared for human approval. Created by the
/// Payments desk (<c>/payments/process</c>) or the <c>payments_requestApproval</c>
/// MCP tool, decided through the Microsoft Teams card (or the
/// <c>/payments/approvals/{id}/approve|reject</c> endpoints as the in-page
/// fallback), and finalised by <c>payments_releasePayment</c> /
/// <c>/payments/approvals/{id}/release</c> — only ever after a human approved it.
/// </summary>
public class PaymentApprovalRecord
{
    public string ApprovalId { get; init; } = string.Empty;
    public string CaseNumber { get; init; } = string.Empty;

    /// <summary>Client on the case (for a death benefit, the claimant).</summary>
    public string ClientName { get; init; } = string.Empty;

    public string MemberNumber { get; init; } = string.Empty;

    /// <summary>Member line shown on the Teams card, e.g. "Tom Bradley · CS-1030412".</summary>
    public string MemberDisplay { get; init; } = string.Empty;

    /// <summary>Payment type key (see <see cref="PaymentTypes"/>).</summary>
    public string PaymentType { get; init; } = PaymentTypes.LumpSum;

    public decimal GrossAmount { get; init; }
    public decimal TaxWithheld { get; init; }
    public decimal NetAmount { get; init; }
    public decimal? CommencementAmount { get; init; }

    /// <summary>Payee name(s) for display, e.g. "Robert Chen &amp; Lily Chen".</summary>
    public string PayeeName { get; init; } = string.Empty;

    /// <summary>Masked bank details for display.</summary>
    public string? PayeeAccount { get; init; }

    public IReadOnlyList<PaymentPayeeLine> Payees { get; init; } = Array.Empty<PaymentPayeeLine>();
    public string? PaymentDate { get; init; }

    /// <summary>Why approval is needed (or why the payment is blocked).</summary>
    public string? Reason { get; init; }

    public IReadOnlyList<string> ApprovalReasons { get; init; } = Array.Empty<string>();
    public string Approver { get; init; } = PaymentRules.TeamLeaderApprover;
    public string RaisedBy { get; init; } = PaymentRules.RaisedByDesk;

    /// <summary>Eligibility decision the payment was raised against (see <see cref="CaseApprovalStatuses"/>).</summary>
    public string? CaseApprovalStatus { get; init; }

    public decimal? ApprovedAmount { get; init; }

    /// <summary>Payment confirmation draft; <c>{{PAYMENT_REFERENCE}}</c> tokens are filled on release.</summary>
    public string? ConfirmationDraft { get; init; }

    public bool TeamsSent { get; set; }
    public string? TeamsChannel { get; set; }
    public string? TeamsMessage { get; set; }
    public string? ApprovalUrl { get; set; }
    public PaymentApprovalStatus Status { get; set; } = PaymentApprovalStatus.Pending;
    public string? Decision { get; set; }
    public string? DecidedBy { get; set; }
    public string? DecisionComment { get; set; }
    public string? PaymentReference { get; set; }
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? DecidedAt { get; set; }
    public DateTimeOffset? ReleasedAt { get; set; }

    /// <summary>
    /// Foundry response id captured at the end of the <c>/payments/process</c>
    /// run. The approval popup (<c>/payments/approvals/{id}/agent-approve</c>)
    /// resumes the same conversation with it so the human decision flows back
    /// to the Payments Agent, which then calls <c>payments_releasePayment</c>.
    /// </summary>
    public string? PreviousResponseId { get; set; }

    /// <summary>Agent narrative produced by the resume turn after approval.</summary>
    public string? AgentResumeNotes { get; set; }

    public string StatusKey => Status.ToString().ToLowerInvariant();
}

/// <summary>Outcome of an approve / reject / release transition.</summary>
public record PaymentTransitionResult(bool Ok, PaymentApprovalRecord? Record, string? Error, int StatusCode, string? Note = null)
{
    public static PaymentTransitionResult Success(PaymentApprovalRecord record, string? note = null) =>
        new(true, record, null, 200, note);

    public static PaymentTransitionResult NotFound(string approvalId) =>
        new(false, null, $"approval '{approvalId}' not found", 404);

    public static PaymentTransitionResult Conflict(PaymentApprovalRecord record, string error) =>
        new(false, record, error, 409);
}

/// <summary>
/// Singleton in-memory store of payment approvals prepared by the Payments
/// Agent. All state transitions go through <see cref="Approve"/>,
/// <see cref="Reject"/> and <see cref="Release"/> so the "never release
/// without approval" rule is enforced in one place for both the HTTP
/// endpoints and the MCP tools.
/// </summary>
public class PaymentApprovalStore
{
    private readonly ConcurrentDictionary<string, PaymentApprovalRecord> _records =
        new(StringComparer.OrdinalIgnoreCase);
    private readonly object _gate = new();

    public static string NewApprovalId() =>
        "PAY-" + Guid.NewGuid().ToString("N")[..10].ToUpperInvariant();

    public PaymentApprovalRecord Add(PaymentApprovalRecord record)
    {
        _records[record.ApprovalId] = record;
        return record;
    }

    public PaymentApprovalRecord? Get(string approvalId) =>
        !string.IsNullOrWhiteSpace(approvalId) && _records.TryGetValue(approvalId.Trim(), out var r) ? r : null;

    public IEnumerable<PaymentApprovalRecord> All() =>
        _records.Values.OrderByDescending(r => r.CreatedAt);

    public IEnumerable<PaymentApprovalRecord> ForCase(string caseNumber)
    {
        var key = (caseNumber ?? string.Empty).Trim();
        return _records.Values
            .Where(r => string.Equals(r.CaseNumber, key, StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(r => r.CreatedAt);
    }

    /// <summary>Latest approval for the case that is still live (pending, approved or blocked).</summary>
    public PaymentApprovalRecord? CurrentForCase(string caseNumber) =>
        ForCase(caseNumber).FirstOrDefault(r => r.Status is PaymentApprovalStatus.Pending
            or PaymentApprovalStatus.Approved
            or PaymentApprovalStatus.Blocked);

    /// <summary>
    /// Cancel every live approval for the case so only the newest run can be
    /// approved and released (one live payment approval per case).
    /// </summary>
    public int SupersedeOpenForCase(string caseNumber, string supersededBy)
    {
        var count = 0;
        lock (_gate)
        {
            foreach (var r in ForCase(caseNumber))
            {
                if (r.Status is PaymentApprovalStatus.Pending or PaymentApprovalStatus.Approved or PaymentApprovalStatus.Blocked)
                {
                    r.Status = PaymentApprovalStatus.Cancelled;
                    r.Decision = "superseded";
                    r.DecisionComment = $"Superseded by {supersededBy}.";
                    r.DecidedAt = DateTimeOffset.UtcNow;
                    count++;
                }
            }
        }
        return count;
    }

    public PaymentTransitionResult Approve(string approvalId, string? decidedBy, string? comment = null)
    {
        lock (_gate)
        {
            var r = Get(approvalId);
            if (r is null) return PaymentTransitionResult.NotFound(approvalId);
            switch (r.Status)
            {
                case PaymentApprovalStatus.Approved:
                    return PaymentTransitionResult.Success(r, "already approved");
                case PaymentApprovalStatus.Released:
                    return PaymentTransitionResult.Conflict(r, "payment already released");
                case PaymentApprovalStatus.Rejected:
                    return PaymentTransitionResult.Conflict(r, "payment already rejected");
                case PaymentApprovalStatus.Blocked:
                    return PaymentTransitionResult.Conflict(r, "payment is blocked — it can't be approved or released");
                case PaymentApprovalStatus.Cancelled:
                    return PaymentTransitionResult.Conflict(r, "approval was superseded by a newer request for this case");
            }

            r.Status = PaymentApprovalStatus.Approved;
            r.Decision = "approved";
            r.DecidedBy = string.IsNullOrWhiteSpace(decidedBy) ? r.Approver : decidedBy.Trim();
            r.DecisionComment = string.IsNullOrWhiteSpace(comment) ? null : comment.Trim();
            r.DecidedAt = DateTimeOffset.UtcNow;
            return PaymentTransitionResult.Success(r);
        }
    }

    public PaymentTransitionResult Reject(string approvalId, string? decidedBy, string? comment = null)
    {
        lock (_gate)
        {
            var r = Get(approvalId);
            if (r is null) return PaymentTransitionResult.NotFound(approvalId);
            switch (r.Status)
            {
                case PaymentApprovalStatus.Rejected:
                    return PaymentTransitionResult.Success(r, "already rejected");
                case PaymentApprovalStatus.Released:
                    return PaymentTransitionResult.Conflict(r, "payment already released");
                case PaymentApprovalStatus.Blocked:
                    return PaymentTransitionResult.Conflict(r, "payment is blocked — there is nothing to reject");
                case PaymentApprovalStatus.Cancelled:
                    return PaymentTransitionResult.Conflict(r, "approval was superseded by a newer request for this case");
            }

            r.Status = PaymentApprovalStatus.Rejected;
            r.Decision = "rejected";
            r.DecidedBy = string.IsNullOrWhiteSpace(decidedBy) ? r.Approver : decidedBy.Trim();
            r.DecisionComment = string.IsNullOrWhiteSpace(comment) ? null : comment.Trim();
            r.DecidedAt = DateTimeOffset.UtcNow;
            return PaymentTransitionResult.Success(r);
        }
    }

    /// <summary>
    /// Release an approved payment. Refuses unless the approval is in the
    /// <see cref="PaymentApprovalStatus.Approved"/> state.
    /// </summary>
    public PaymentTransitionResult Release(string approvalId)
    {
        lock (_gate)
        {
            var r = Get(approvalId);
            if (r is null) return PaymentTransitionResult.NotFound(approvalId);
            switch (r.Status)
            {
                case PaymentApprovalStatus.Released:
                    return PaymentTransitionResult.Success(r, "already released");
                case PaymentApprovalStatus.Pending:
                    return PaymentTransitionResult.Conflict(r, "payment is still awaiting approval in Microsoft Teams — it can't be released yet");
                case PaymentApprovalStatus.Rejected:
                    return PaymentTransitionResult.Conflict(r, "payment was rejected by the approver — it will not be released");
                case PaymentApprovalStatus.Blocked:
                    return PaymentTransitionResult.Conflict(r, "payment is blocked — no funds can leave the account");
                case PaymentApprovalStatus.Cancelled:
                    return PaymentTransitionResult.Conflict(r, "approval was superseded by a newer request for this case");
            }

            var suffix = r.ApprovalId.Length >= 6 ? r.ApprovalId[^6..] : r.ApprovalId;
            var reference = $"PMT-{DateTimeOffset.UtcNow:yyyyMMdd}-{suffix}";
            r.Status = PaymentApprovalStatus.Released;
            r.PaymentReference = reference;
            r.ReleasedAt = DateTimeOffset.UtcNow;
            for (var i = 0; i < r.Payees.Count; i++)
            {
                r.Payees[i].PaymentReference = r.Payees.Count > 1 ? $"{reference}-{i + 1}" : reference;
            }
            return PaymentTransitionResult.Success(r);
        }
    }
}

/// <summary>A key + display label pair for the payment input drop-downs.</summary>
public record PaymentOption(string Key, string Label);

/// <summary>Payment types handled by the Payments desk.</summary>
public static class PaymentTypes
{
    public const string Hardship = "hardship";
    public const string DeathBenefit = "death-benefit";
    public const string Pension = "pension";
    public const string RolloverOut = "rollover-out";
    public const string Inbound = "inbound";
    public const string LumpSum = "lump-sum";

    public static readonly IReadOnlyList<PaymentOption> All =
    [
        new(Hardship, "Financial hardship lump sum"),
        new(DeathBenefit, "Death benefit lump sum"),
        new(Pension, "Pension commencement & regular payment"),
        new(RolloverOut, "Rollover out"),
        new(Inbound, "Invest on arrival (inbound rollover)"),
        new(LumpSum, "Lump sum withdrawal"),
    ];

    public static string Label(string? key)
    {
        var k = Normalize(key);
        return All.First(o => o.Key == k).Label;
    }

    /// <summary>Accepts a key, a label or free text (as an agent might pass it).</summary>
    public static string Normalize(string? value)
    {
        var v = (value ?? string.Empty).Trim().ToLowerInvariant();
        if (v.Length == 0) return LumpSum;
        foreach (var o in All)
        {
            if (v == o.Key || v == o.Label.ToLowerInvariant()) return o.Key;
        }
        if (v.Contains("hardship")) return Hardship;
        if (v.Contains("death")) return DeathBenefit;
        if (v.Contains("pension")) return Pension;
        if (v.Contains("inbound") || v.Contains("arrival") || v.Contains("invest") || v.Contains("new account")) return Inbound;
        if (v.Contains("rollover") || v.Contains("smsf") || v.Contains("transfer")) return RolloverOut;
        return LumpSum;
    }
}

/// <summary>Tax status of the recipient, which drives PAYG withholding on the taxable component.</summary>
public static class PaymentTaxStatuses
{
    public const string Under60 = "under-60";
    public const string SixtyPlus = "60-plus";
    public const string DeathNonDependant = "death-non-dependant";
    public const string DeathDependant = "death-dependant";
    public const string Rollover = "rollover";
    public const string NotApplicable = "not-applicable";

    public static readonly IReadOnlyList<PaymentOption> All =
    [
        new(Under60, "Under 60 — taxed element withheld at 22%"),
        new(SixtyPlus, "60 or over — no tax withheld"),
        new(DeathNonDependant, "Death benefit to a non-dependant (for tax) — 17%"),
        new(DeathDependant, "Death benefit to a tax dependant — no tax withheld"),
        new(Rollover, "Rollover — no tax withheld (stays in super)"),
        new(NotApplicable, "Not applicable — inbound money"),
    ];

    public static string Label(string? key)
    {
        var k = Normalize(key);
        return All.First(o => o.Key == k).Label;
    }

    /// <summary>PAYG withholding rate on the taxable component (taxed element).</summary>
    public static decimal Rate(string? status) => Normalize(status) switch
    {
        Under60 => 0.22m,
        DeathNonDependant => 0.17m,
        _ => 0m,
    };

    public static string RateLabel(string? status) => Normalize(status) switch
    {
        Under60 => "22% (20% + 2% Medicare levy)",
        SixtyPlus => "nil — age 60 or over",
        DeathNonDependant => "17% (15% + 2% Medicare levy)",
        DeathDependant => "nil — paid to a death benefits dependant",
        Rollover => "nil — a rollover stays in super",
        _ => "n/a — inbound money",
    };

    /// <summary>Accepts a key, a label or free text (as an agent might pass it). Defaults to under 60.</summary>
    public static string Normalize(string? value)
    {
        var v = (value ?? string.Empty).Trim().ToLowerInvariant();
        foreach (var o in All)
        {
            if (v == o.Key || v == o.Label.ToLowerInvariant()) return o.Key;
        }
        if (v.Contains("non-dependant") || v.Contains("non dependant") || v.Contains("nondependant")
            || v.Contains("non-dependent") || v.Contains("non dependent")) return DeathNonDependant;
        if (v.Contains("dependant") || v.Contains("dependent")) return DeathDependant;
        if (v.Contains("rollover")) return Rollover;
        if (v.Contains("inbound") || v.Contains("not applicable") || v is "n/a" or "na") return NotApplicable;
        if (v.Contains("60+") || v.Contains("60 or over") || v.Contains("over 60") || v.Contains("60-plus")
            || v.Contains("60 plus") || v.Contains("aged 60")) return SixtyPlus;
        return Under60;
    }
}

/// <summary>Eligibility decision recorded on the case by Benefits &amp; Eligibility (or Financial Crime).</summary>
public static class CaseApprovalStatuses
{
    public const string Approved = "approved";
    public const string Partial = "partial";
    public const string Declined = "declined";
    public const string Blocked = "blocked";
    public const string Pending = "pending";
    public const string NotApplicable = "not-applicable";

    public static readonly IReadOnlyList<PaymentOption> All =
    [
        new(Approved, "Approved"),
        new(Partial, "Partially approved"),
        new(Declined, "Declined"),
        new(Blocked, "Blocked — Financial Crime"),
        new(Pending, "Pending assessment"),
        new(NotApplicable, "Not applicable — no payment out"),
    ];

    public static string Label(string? key)
    {
        var k = Normalize(key);
        return All.First(o => o.Key == k).Label;
    }

    public static bool IsPayable(string? status) => Normalize(status) is Approved or Partial;

    public static string Normalize(string? value)
    {
        var v = (value ?? string.Empty).Trim().ToLowerInvariant();
        foreach (var o in All)
        {
            if (v == o.Key || v == o.Label.ToLowerInvariant()) return o.Key;
        }
        if (v.Contains("partial")) return Partial;
        if (v.Contains("declin") || v.Contains("reject")) return Declined;
        if (v.Contains("block")) return Blocked;
        if (v.Contains("not applicable") || v is "n/a" or "na") return NotApplicable;
        if (v.Contains("approv") || v.Contains("complet")) return Approved;
        return Pending;
    }
}

/// <summary>Default payee for a case (bank details are already masked).</summary>
public record PaymentPayeeDefault(string Name, string Bsb, string Account, decimal SharePercent);

/// <summary>A person or account the trustee already holds on file and may pay.</summary>
public record PayeeOnFile(string Name, string? AccountLast4, string Relationship);

/// <summary>A label / value line shown under the payment calculation.</summary>
public record PaymentContextLine(string Label, string Value);

/// <summary>
/// Deterministic payment data for one Member Case, keyed off
/// <see cref="CaseRecord.SampleId"/> (the five canonical scenarios) with a
/// generic fallback for cases minted live by the Onboarding demo.
/// </summary>
public sealed record PaymentCaseProfile
{
    public string ProfileId { get; init; } = "generic";

    /// <summary>The member whose account pays (for a death benefit, the deceased member).</summary>
    public string MemberName { get; init; } = string.Empty;

    public string MemberDisplay { get; init; } = string.Empty;

    /// <summary>Caldova account the money is paid from (or invested into).</summary>
    public string AccountNumber { get; init; } = string.Empty;

    public string PaymentType { get; init; } = PaymentTypes.LumpSum;

    /// <summary>Gross amount: lump sum, total death benefit (split by share), monthly pension payment, rollover or inbound amount.</summary>
    public decimal GrossAmount { get; init; }

    public decimal? RequestedAmount { get; init; }
    public decimal? CommencementAmount { get; init; }
    public string? CommencementDate { get; init; }
    public decimal? MinimumDrawdown { get; init; }
    public decimal TaxFreePercent { get; init; }
    public int? MemberAge { get; init; }
    public string TaxStatus { get; init; } = PaymentTaxStatuses.Under60;
    public string CaseApprovalStatus { get; init; } = CaseApprovalStatuses.Approved;
    public decimal? ApprovedAmount { get; init; }
    public string CaseApprovalNote { get; init; } = string.Empty;
    public string CaseDecidedBy { get; init; } = "Benefits & Eligibility";
    public string CaseRuleCited { get; init; } = PaymentRules.TaxRuleTitle;
    public string PaymentDate { get; init; } = "Within 2 business days of approval";
    public decimal? BalanceBefore { get; init; }
    public IReadOnlyList<PaymentPayeeDefault> Payees { get; init; } = Array.Empty<PaymentPayeeDefault>();
    public IReadOnlyList<PayeeOnFile> PayeesOnFile { get; init; } = Array.Empty<PayeeOnFile>();
    public IReadOnlyList<PaymentContextLine> ExtraContext { get; init; } = Array.Empty<PaymentContextLine>();
    public string InputsHint { get; init; } = string.Empty;

    /// <summary>Closing paragraph for the payment confirmation draft.</summary>
    public string? LetterNote { get; init; }

    /// <summary>How the deceased member is referred to in a bereavement letter (e.g. "your mother, Mei").</summary>
    public string? DeceasedReference { get; init; }

    /// <summary>Why the benefit is paid this way, for a bereavement letter (e.g. "as Mei set out in her binding nomination").</summary>
    public string? PaymentBasis { get; init; }

    /// <summary>Where incoming money is invested (invest-on-arrival cases).</summary>
    public string? InvestmentOption { get; init; }

    /// <summary>Next step recorded when the payment is blocked.</summary>
    public string? BlockedNextStep { get; init; }
}

public record PayeeValidationResult(
    string PayeeName,
    string MaskedAccount,
    bool NameMatch,
    bool? AccountMatch,
    bool Match,
    string? MatchedOnFile,
    string? Relationship,
    string Note);

public record CaseApprovalCheckResult(
    string Status,
    string StatusLabel,
    decimal? ApprovedAmount,
    decimal AmountChecked,
    bool AmountWithinApproval,
    bool Payable,
    string DecidedBy,
    string RuleCited,
    string Note);

public record BenefitCalculation(
    decimal GrossAmount,
    decimal TaxFreePercent,
    decimal TaxFreeComponent,
    decimal TaxableComponent,
    string TaxStatus,
    string TaxStatusLabel,
    decimal WithholdingRate,
    string WithholdingRateLabel,
    decimal TaxWithheld,
    decimal NetAmount);

public record AuthorityCheckResult(
    bool Required,
    IReadOnlyList<string> Reasons,
    string Approver,
    string PaymentType,
    decimal LargestSinglePayment,
    decimal? CommencementAmount,
    string Note);

/// <summary>
/// Payment rules shared by the <c>/payments/*</c> endpoints and the
/// <c>payments_*</c> MCP tools: per-case deterministic data, payee
/// validation, the eligibility cross-check, component / PAYG withholding
/// maths and the authority (human approval) rules.
/// </summary>
public static class PaymentRules
{
    public const decimal SinglePaymentLimit = 250_000m;
    public const decimal PensionCommencementLimit = 1_000_000m;
    public const decimal HardshipMaximum = 10_000m;
    public const decimal CashAccountMinimumPercent = 1m;

    public const string TeamLeaderApprover = "Theo — Client Operations Team Leader";
    public const string PaymentsOfficerApprover = "Penny — Payments Officer (standard sign-off)";

    /// <summary>Approval raised by the Payments desk (the <c>/payments/process</c> run).</summary>
    public const string RaisedByDesk = "Payments desk";

    /// <summary>Approval raised directly by the agent through <c>payments_requestApproval</c>.</summary>
    public const string RaisedByAgent = "Payments Agent (MCP)";

    public const string TaxRuleTitle = "Super law rule summary — Tax on super benefits & PAYG withholding (FY2026-27)";
    public const string AuthorityRuleTitle = "Caldova authority & escalation matrix";
    public const string HardshipRuleTitle = "Super law rule summary — Severe financial hardship early release (Caldova hardship policy)";
    public const string DeathBenefitRuleTitle = "Caldova Superannuation Master Fund Trust Deed — Death benefits & nominations (rules extract)";
    public const string PensionRuleTitle = "Super law rule summary — Pension standards, minimum drawdowns & transfer balance cap (FY2026-27)";
    public const string RolloverRuleTitle = "Super law rule summary — SuperStream rollovers, insurance-loss warnings & SMSF verification (SVS)";
    public const string AdviserFeeRuleTitle = "Super law rule summary — Adviser fees from super (SIS s99FA) & ongoing fee arrangements";

    /// <summary>Placeholder in confirmation drafts, replaced by the payment reference on release.</summary>
    public const string ReferenceToken = "{{PAYMENT_REFERENCE}}";

    public static string ReferenceTokenFor(int payeeNumber) => "{{PAYMENT_REFERENCE:" + payeeNumber + "}}";

    private static readonly CultureInfo AuCulture = CultureInfo.GetCultureInfo("en-AU");
    private static readonly Regex AmountRegex = new(@"\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?", RegexOptions.Compiled);
    private static readonly Regex ReferenceTokenRegex = new(@"\{\{PAYMENT_REFERENCE(?::(\d+))?\}\}", RegexOptions.Compiled);

    // ── Per-case deterministic data ─────────────────────────────────────

    public static PaymentCaseProfile ProfileFor(CaseRecord record)
    {
        var profile = (record.SampleId ?? string.Empty).Trim().ToLowerInvariant() switch
        {
            "hardship-tom" => HardshipTom(),
            "death-benefit-robert" => DeathBenefitRobert(),
            "pension-george" => PensionGeorge(),
            "rollover-grace" => RolloverGrace(),
            "onboarding-priya" => OnboardingPriya(),
            _ => Generic(record),
        };

        // On a member's own request the client on the case is always a
        // recognised payee name (a death benefit is paid to beneficiaries).
        var client = (record.ClientName ?? string.Empty).Trim();
        if (profile.PaymentType != PaymentTypes.DeathBenefit && client.Length > 0
            && !profile.PayeesOnFile.Any(p => NormalizeName(p.Name) == NormalizeName(client)))
        {
            var last4 = profile.PayeesOnFile.FirstOrDefault()?.AccountLast4;
            profile = profile with { PayeesOnFile = [.. profile.PayeesOnFile, new PayeeOnFile(client, last4, "member")] };
        }
        return profile;
    }

    private static PaymentCaseProfile HardshipTom() => new()
    {
        ProfileId = "hardship-tom",
        MemberName = "Tom Bradley",
        MemberDisplay = "Tom Bradley · CS-1030412",
        AccountNumber = "CS-1030412",
        PaymentType = PaymentTypes.Hardship,
        RequestedAmount = 15_000m,
        GrossAmount = 10_000m,
        TaxFreePercent = 6m,
        MemberAge = 47,
        TaxStatus = PaymentTaxStatuses.Under60,
        CaseApprovalStatus = CaseApprovalStatuses.Partial,
        ApprovedAmount = 10_000m,
        CaseApprovalNote = "Partially approved — $10,000 gross, the most that can be released on severe financial hardship grounds in any 12-month period ($15,000 was requested). Criteria met: 31 continuous weeks of JobSeeker and still receiving it, Services Australia letter dated 09/11/2026 (within 21 days), no hardship release in the last 12 months.",
        CaseDecidedBy = "Ben — Benefits & Eligibility Assessor · partial approval confirmed by Theo (vulnerable member)",
        CaseRuleCited = HardshipRuleTitle,
        PaymentDate = "Fri 13/11/2026",
        BalanceBefore = 84_300m,
        Payees = [new("Thomas Bradley", "033-***", "****5120", 100m)],
        PayeesOnFile =
        [
            new("Thomas Bradley", "5120", "member (legal name on the nominated account)"),
            new("Tom Bradley", "5120", "member"),
        ],
        ExtraContext =
        [
            new("Redemption plan", "Cash Account first (above the 1% minimum), then Balanced units — Investment Solutions"),
        ],
        InputsHint = "Tom asked for $15,000. The hardship rules allow $1,000–$10,000 gross once in any 12-month period, so Benefits & Eligibility partially approved $10,000. He is 47, so the taxable component is withheld at 22%.",
        LetterNote = "If money is still tight, free and confidential help is available from the National Debt Helpline on 1800 007 007 and at moneysmart.gov.au.",
    };

    private static PaymentCaseProfile DeathBenefitRobert() => new()
    {
        ProfileId = "death-benefit-robert",
        MemberName = "Mei Chen",
        MemberDisplay = "Mei Chen (deceased) · CP-3019042 — claimant Robert Chen",
        AccountNumber = "CP-3019042",
        PaymentType = PaymentTypes.DeathBenefit,
        GrossAmount = 486_200m,
        TaxFreePercent = 38m,
        MemberAge = 81,
        TaxStatus = PaymentTaxStatuses.DeathNonDependant,
        CaseApprovalStatus = CaseApprovalStatuses.Approved,
        ApprovedAmount = 486_200m,
        CaseApprovalNote = "Approved — pay as nominated. Mei's binding death benefit nomination (signed 18/03/2024 before two adult witnesses who aren't beneficiaries, valid to 18/03/2027) splits the benefit Robert 50% / Lily 50%. Both are her children — SIS dependants — so the nomination binds the trustee. For tax, adult children who weren't financially dependent are non-dependants.",
        CaseDecidedBy = "Ben — Benefits & Eligibility Assessor · case owner Theo (compassionate oversight)",
        CaseRuleCited = DeathBenefitRuleTitle,
        PaymentDate = "On approval — once the pension's portfolio has been redeemed to cash",
        Payees =
        [
            new("Robert Chen", "083-***", "****9012", 50m),
            new("Lily Chen", "013-***", "****4477", 50m),
        ],
        PayeesOnFile =
        [
            new("Robert Chen", "9012", "nominated beneficiary (son, 50%)"),
            new("Lily Chen", "4477", "nominated beneficiary (daughter, 50%)"),
        ],
        ExtraContext =
        [
            new("Binding nomination", "Robert Chen 50% · Lily Chen 50% — valid to 18/03/2027"),
            new("Pension payments", "Stopped on notification of Mei's death (12/10/2026)"),
            new("Final amounts", "Depend on sale proceeds when the pension's portfolio is redeemed to cash"),
        ],
        InputsHint = "Mei Chen's Caldova Pension (CP-3019042, about $486,200) is paid as a lump sum, split 50/50 under her binding nomination. The gross amount is the total benefit; each payee's share is worked out from it.",
        DeceasedReference = "your mother, Mei",
        PaymentBasis = "as Mei set out in her binding nomination",
        LetterNote = "If you have any questions, please call us. If you're unhappy with how we've handled this, you can make a complaint through our internal dispute resolution process and then, if needed, to the Australian Financial Complaints Authority (AFCA).",
    };

    private static PaymentCaseProfile PensionGeorge() => new()
    {
        ProfileId = "pension-george",
        MemberName = "George Papadopoulos",
        MemberDisplay = "George Papadopoulos · CS-1077881 → pension CP-3077881",
        AccountNumber = "CP-3077881",
        PaymentType = PaymentTypes.Pension,
        GrossAmount = 6_500m,
        CommencementAmount = 1_250_000m,
        CommencementDate = "Mon 16/11/2026",
        MinimumDrawdown = 38_870m,
        TaxFreePercent = 0m,
        MemberAge = 66,
        TaxStatus = PaymentTaxStatuses.SixtyPlus,
        CaseApprovalStatus = CaseApprovalStatuses.Approved,
        ApprovedAmount = 1_250_000m,
        CaseApprovalNote = "Approved — George is 66, so the age 65 condition of release is met and his benefits are unrestricted non-preserved. The $1,250,000 credit is within the $2.1 million transfer balance cap ($850,000 of cap space remains); $78,000 a year is above the pro-rated 2026-27 minimum of $38,870; Helen (spouse) is accepted as reversionary beneficiary.",
        CaseDecidedBy = "Ben — Benefits & Eligibility Assessor",
        CaseRuleCited = PensionRuleTitle,
        PaymentDate = "First payment Tue 15/12/2026, then monthly",
        Payees = [new("G & H Papadopoulos", "063-***", "****2214", 100m)],
        PayeesOnFile =
        [
            new("George Papadopoulos", "2214", "member"),
            new("G & H Papadopoulos", "2214", "joint account of the member and his spouse (nominated on the pension application)"),
            new("George & Helen Papadopoulos", "2214", "joint account of the member and his spouse"),
        ],
        ExtraContext =
        [
            new("Left in accumulation", "$34,600 in CS-1077881"),
            new("Transfer balance cap", "$850,000 of the $2.1 million cap remains after the $1,250,000 credit"),
            new("Reversionary beneficiary", "Helen Papadopoulos (spouse)"),
            new("Income strategy", "Two years of payments ($156,000) in cash and term deposits, the rest in the Balanced model — Investment Solutions"),
        ],
        InputsHint = "George starts a Caldova Pension with $1,250,000 on 16/11/2026, paying $6,500 a month ($78,000 a year). He's 66, so no tax is withheld. The gross amount is the regular monthly payment; the commencement amount drives the approval rule.",
        LetterNote = "Helen is recorded as your reversionary beneficiary, so your pension can continue to her. Your minimum payment is recalculated every 1 July.",
    };

    private static PaymentCaseProfile RolloverGrace() => new()
    {
        ProfileId = "rollover-grace",
        MemberName = "Grace Williams",
        MemberDisplay = "Grace Williams · CS-1058220",
        AccountNumber = "CS-1058220",
        PaymentType = PaymentTypes.RolloverOut,
        GrossAmount = 612_400m,
        TaxFreePercent = 0m,
        MemberAge = 63,
        TaxStatus = PaymentTaxStatuses.Rollover,
        CaseApprovalStatus = CaseApprovalStatuses.Blocked,
        ApprovedAmount = 0m,
        CaseApprovalNote = "Blocked — do not process. The ATO SMSF verification service (SVS) failed: Grace's TFN isn't linked to 'GW Family Superannuation Fund' and the bank details and ESA don't match. Financial Crime rated the request HIGH risk (92/100) and the Team Leader approved the block.",
        CaseDecidedBy = "Felix — Financial Crime Investigator · block approved by Theo",
        CaseRuleCited = RolloverRuleTitle,
        PaymentDate = "None — outbound instruction cancelled",
        BalanceBefore = 612_400m,
        Payees = [new("G Williams Holdings Pty Ltd", "062-***", "****7781", 100m)],
        PayeesOnFile =
        [
            new("Grace Williams", "2207", "member (nominated account held before the 02/11/2026 change of details)"),
        ],
        ExtraContext =
        [
            new("Timeline", "Contact details changed by phone 02/11/2026 10:42 → new device in Sydney 03/11/2026 21:14 → rollover request Fri 06/11/2026 07:52 (about 93 hours after the change)"),
            new("Receiving fund on the request", "GW Family Superannuation Fund — SMSF ABN registered 28/10/2026"),
            new("SMSF verification (SVS)", "Registered SMSF, but Grace's TFN isn't linked and the bank details and ESA don't match"),
            new("Payment block", "In place until Grace re-verifies her identity on details we already trust"),
        ],
        InputsHint = "A whole-balance rollover ($612,400) to a newly registered SMSF was requested on Fri 06/11/2026 at 07:52 — about 93 hours after Grace's contact details were changed by phone. Financial Crime has blocked the case; Payments confirms no money leaves the account.",
        BlockedNextStep = "Client Communications contacts Grace on her pre-change verified number (0491 570 157) and email — never the details on the request.",
    };

    private static PaymentCaseProfile OnboardingPriya() => new()
    {
        ProfileId = "onboarding-priya",
        MemberName = "Priya Natarajan",
        MemberDisplay = "Priya Natarajan · CS-2049817 (new)",
        AccountNumber = "CS-2049817",
        PaymentType = PaymentTypes.Inbound,
        GrossAmount = 41_800m,
        TaxFreePercent = 0m,
        MemberAge = 34,
        TaxStatus = PaymentTaxStatuses.NotApplicable,
        CaseApprovalStatus = CaseApprovalStatuses.Approved,
        ApprovedAmount = null,
        CaseApprovalNote = "Account opened — invest on arrival in Caldova Managed Portfolio — Growth (Statement of Advice dated 28/10/2026). The adviser fee consent meets SIS s99FA. The death benefit nomination is treated as non-binding until re-signed — it doesn't affect payments.",
        CaseDecidedBy = "Ben — Benefits & Eligibility Assessor",
        CaseRuleCited = AdviserFeeRuleTitle,
        PaymentDate = "On receipt — the Harbourline rollover is due within 3 business days",
        Payees = Array.Empty<PaymentPayeeDefault>(),
        PayeesOnFile = [new("Priya Natarajan", null, "member")],
        ExtraContext =
        [
            new("Harbourline Retail Super (HRB0007AU)", "About $41,800 — requested via SuperStream, due within 3 business days"),
            new("Southern Cross Industry Super (SCI0001AU)", "About $96,400 — on hold: rolling it over would end $520,000 of Death & TPD cover, so the adviser confirms first"),
            new("Investment", "Caldova Managed Portfolio — Growth (80/20), per the Statement of Advice"),
            new("Adviser fee", "$3,300 a year incl. GST — $275 a month, deducted under the signed consent (s99FA)"),
        ],
        InputsHint = "Money is coming in, not going out. The Harbourline rollover (about $41,800) is invested on arrival in the Growth model, keeping 1% in the Caldova Cash Account. There's no payee and nothing to release.",
        InvestmentOption = "Caldova Managed Portfolio — Growth",
    };

    private static PaymentCaseProfile Generic(CaseRecord r)
    {
        var amount = ParseAmount(r.Amount) ?? 0m;
        var client = string.IsNullOrWhiteSpace(r.ClientName) ? "Member" : r.ClientName.Trim();
        var member = string.IsNullOrWhiteSpace(r.MemberNumber) ? "member number pending" : r.MemberNumber.Trim();
        var baseProfile = new PaymentCaseProfile
        {
            ProfileId = "generic",
            MemberName = client,
            MemberDisplay = $"{client} · {member}",
            AccountNumber = member,
            PaymentType = PaymentTypes.LumpSum,
            GrossAmount = amount,
            TaxFreePercent = 0m,
            TaxStatus = PaymentTaxStatuses.Under60,
            CaseApprovalStatus = CaseApprovalStatuses.Approved,
            ApprovedAmount = amount > 0 ? amount : null,
            CaseApprovalNote = "Approved by Benefits & Eligibility — confirm the decision on the case before release.",
            CaseDecidedBy = "Benefits & Eligibility",
            CaseRuleCited = TaxRuleTitle,
            Payees = [new(client, string.Empty, string.Empty, 100m)],
            PayeesOnFile = [new(client, null, "member")],
            InputsHint = "Defaults are worked out from the case. Confirm the tax-free percentage and tax status from the member's account before engaging the agent.",
        };

        switch (r.RequestType)
        {
            case RequestTypes.FinancialHardship:
            {
                var gross = amount > 0 ? Math.Min(amount, HardshipMaximum) : HardshipMaximum;
                var partial = amount > HardshipMaximum;
                return baseProfile with
                {
                    PaymentType = PaymentTypes.Hardship,
                    RequestedAmount = amount > 0 ? amount : null,
                    GrossAmount = gross,
                    CaseApprovalStatus = partial ? CaseApprovalStatuses.Partial : CaseApprovalStatuses.Approved,
                    ApprovedAmount = gross,
                    CaseApprovalNote = partial
                        ? $"Partially approved — {FormatMoney(gross)} gross, the most that can be released on severe financial hardship grounds in any 12-month period ({FormatMoney(amount)} was requested)."
                        : $"Approved — {FormatMoney(gross)} gross on severe financial hardship grounds.",
                    CaseRuleCited = HardshipRuleTitle,
                    InputsHint = "Severe financial hardship releases are $1,000–$10,000 gross, once in any 12-month period. Confirm the member's age and tax-free percentage.",
                };
            }
            case RequestTypes.DeathBenefit:
                return baseProfile with
                {
                    PaymentType = PaymentTypes.DeathBenefit,
                    MemberName = member,
                    MemberDisplay = $"{member} — claimant {client}",
                    TaxStatus = PaymentTaxStatuses.DeathNonDependant,
                    PayeesOnFile = [new(client, null, "claimant")],
                    CaseApprovalNote = "Approved by Benefits & Eligibility — confirm the nomination and each recipient's tax dependency before release.",
                    CaseRuleCited = DeathBenefitRuleTitle,
                    DeceasedReference = "the member",
                    PaymentBasis = "in line with the trustee's decision on the death benefit",
                    InputsHint = "Death benefits are paid as nominated (or as the trustee decides). Adult children who weren't financially dependent are non-dependants for tax (17% on the taxed element).",
                };
            case RequestTypes.PensionCommencement:
            {
                var monthly = amount > 0
                    ? Math.Round(amount * 0.05m / 12m / 10m, MidpointRounding.AwayFromZero) * 10m
                    : 0m;
                return baseProfile with
                {
                    PaymentType = PaymentTypes.Pension,
                    GrossAmount = monthly,
                    CommencementAmount = amount > 0 ? amount : null,
                    MemberAge = 65,
                    TaxStatus = PaymentTaxStatuses.SixtyPlus,
                    CaseRuleCited = PensionRuleTitle,
                    PaymentDate = "First payment one month after commencement",
                    InputsHint = "Default monthly payment uses the 5% minimum drawdown (age 65–74) — confirm the amount on the pension application.",
                };
            }
            case RequestTypes.RolloverOutSmsf:
                return baseProfile with
                {
                    PaymentType = PaymentTypes.RolloverOut,
                    TaxStatus = PaymentTaxStatuses.Rollover,
                    CaseApprovalStatus = CaseApprovalStatuses.Pending,
                    CaseApprovalNote = "Pending — a rollover to an SMSF can't be paid until the ATO SMSF verification service (SVS) has passed.",
                    CaseRuleCited = RolloverRuleTitle,
                    BalanceBefore = amount > 0 ? amount : null,
                    InputsHint = "Rollovers to an SMSF need a passed SVS check (registered SMSF, member's TFN linked, bank details and ESA match) before any payment is raised.",
                };
            case RequestTypes.NewAccount:
                return baseProfile with
                {
                    PaymentType = PaymentTypes.Inbound,
                    TaxStatus = PaymentTaxStatuses.NotApplicable,
                    ApprovedAmount = null,
                    CaseApprovalNote = "Account opened — incoming rollovers are invested on arrival under the member's investment instructions.",
                    CaseRuleCited = RolloverRuleTitle,
                    PaymentDate = "On receipt of each rollover",
                    Payees = Array.Empty<PaymentPayeeDefault>(),
                    InputsHint = "Money is coming in, not going out — it's invested on arrival, keeping 1% in the Caldova Cash Account.",
                };
            default:
                return baseProfile;
        }
    }

    // ── Payee validation ────────────────────────────────────────────────

    public static PayeeValidationResult ValidatePayee(PaymentCaseProfile profile, string? payeeName, string? bsb, string? account)
    {
        var name = (payeeName ?? string.Empty).Trim();
        var key = NormalizeName(name);
        var masked = MaskPayeeAccount(bsb, account);
        var onFile = key.Length == 0 ? null : profile.PayeesOnFile.FirstOrDefault(p => NormalizeName(p.Name) == key);
        var nameMatch = onFile is not null;

        bool? accountMatch = null;
        var last4 = Last4Digits(account);
        if (onFile?.AccountLast4 is { Length: > 0 } fileLast4 && last4 is not null)
            accountMatch = string.Equals(fileLast4, last4, StringComparison.Ordinal);

        var match = nameMatch && accountMatch != false;
        var namesOnFile = string.Join(", ", profile.PayeesOnFile.Select(p => p.Name).Distinct());
        string note;
        if (match)
        {
            note = $"Matches {onFile!.Name}, the {onFile.Relationship}"
                + (accountMatch == true ? "; bank details match the nominated account on file." : ".");
        }
        else if (!nameMatch)
        {
            note = $"Payee '{(name.Length == 0 ? "(blank)" : name)}' doesn't match the member or a nominated beneficiary on file ({namesOnFile}). Pay only to nominated accounts — Team Leader approval required.";
        }
        else
        {
            note = $"Payee name matches {onFile!.Name}, but the bank account doesn't match the nominated account on file — step-up verification and Team Leader approval required.";
        }

        return new PayeeValidationResult(name, masked, nameMatch, accountMatch, match, onFile?.Name, onFile?.Relationship, note);
    }

    // ── Eligibility cross-check ─────────────────────────────────────────

    public static CaseApprovalCheckResult CheckCaseApproval(
        PaymentCaseProfile profile,
        string? statusOverride,
        decimal? approvedOverride,
        decimal amountToCheck)
    {
        var status = CaseApprovalStatuses.Normalize(string.IsNullOrWhiteSpace(statusOverride) ? profile.CaseApprovalStatus : statusOverride);
        var approved = approvedOverride ?? profile.ApprovedAmount;
        var within = approved is null || amountToCheck <= approved.Value + 0.005m;
        var payableStatus = CaseApprovalStatuses.IsPayable(status);
        var unchanged = status == profile.CaseApprovalStatus && approved == profile.ApprovedAmount;

        string note;
        if (payableStatus && !within)
        {
            note = $"{FormatMoney(amountToCheck)} is more than the approved amount of {FormatMoney(approved!.Value)} — Payments can't pay more than Benefits & Eligibility approved.";
        }
        else if (unchanged && profile.CaseApprovalNote.Length > 0)
        {
            note = profile.CaseApprovalNote;
        }
        else
        {
            note = status switch
            {
                CaseApprovalStatuses.Approved => approved is null
                    ? "Approved by Benefits & Eligibility."
                    : $"Approved by Benefits & Eligibility — up to {FormatMoney(approved.Value)}.",
                CaseApprovalStatuses.Partial => approved is null
                    ? "Partially approved by Benefits & Eligibility."
                    : $"Partially approved by Benefits & Eligibility — {FormatMoney(approved.Value)}.",
                CaseApprovalStatuses.Declined => "Declined by Benefits & Eligibility — there is nothing to pay.",
                CaseApprovalStatuses.Blocked => "Blocked by Financial Crime — no payment can be raised or released.",
                CaseApprovalStatuses.Pending => "The eligibility decision is still pending — a payment can't be raised yet.",
                _ => "No payment out on this case.",
            };
        }

        return new CaseApprovalCheckResult(
            status,
            CaseApprovalStatuses.Label(status),
            approved,
            amountToCheck,
            within,
            payableStatus && within,
            profile.CaseDecidedBy,
            profile.CaseRuleCited,
            note);
    }

    // ── Components, PAYG withholding and net payment ────────────────────

    public static BenefitCalculation Calculate(decimal grossAmount, decimal taxFreePercent, string? taxStatus)
    {
        var gross = Round2(Math.Max(0m, grossAmount));
        var percent = Math.Clamp(taxFreePercent, 0m, 100m);
        var status = PaymentTaxStatuses.Normalize(taxStatus);
        var taxFree = Round2(gross * percent / 100m);
        var taxable = gross - taxFree;
        var rate = PaymentTaxStatuses.Rate(status);
        var withheld = Round2(taxable * rate);
        return new BenefitCalculation(
            gross,
            percent,
            taxFree,
            taxable,
            status,
            PaymentTaxStatuses.Label(status),
            rate,
            PaymentTaxStatuses.RateLabel(status),
            withheld,
            gross - withheld);
    }

    // ── Authority limits (when the Team Leader must approve) ────────────

    public static AuthorityCheckResult CheckAuthority(
        string? paymentType,
        decimal largestSinglePayment,
        decimal? commencementAmount,
        bool payeeMismatch,
        bool caseBlocked)
    {
        var type = PaymentTypes.Normalize(paymentType);
        var reasons = new List<string>();

        if (type == PaymentTypes.Inbound)
        {
            return new AuthorityCheckResult(false, reasons, PaymentsOfficerApprover, type, largestSinglePayment, commencementAmount,
                "Inbound money — invested under the member's standing instructions. No release approval is needed.");
        }

        if (caseBlocked)
            reasons.Add("The case is blocked by Financial Crime — no payment may be released.");
        if (payeeMismatch)
            reasons.Add("The payee doesn't match the member or a nominated beneficiary on file.");
        if (type == PaymentTypes.DeathBenefit)
            reasons.Add("Death benefit — every death benefit needs Team Leader approval.");
        if (type == PaymentTypes.Hardship)
            reasons.Add("Financial hardship release — a vulnerable member, so the Team Leader approves.");
        if (type == PaymentTypes.Pension && commencementAmount is { } commencement && commencement >= PensionCommencementLimit)
            reasons.Add($"Pension commencement of {FormatMoney(commencement)} — at or above {FormatMoney(PensionCommencementLimit)}.");
        if (largestSinglePayment >= SinglePaymentLimit)
            reasons.Add($"Single payment of {FormatMoney(largestSinglePayment)} — at or above the {FormatMoney(SinglePaymentLimit)} authority limit.");

        var required = reasons.Count > 0;
        return new AuthorityCheckResult(
            required,
            reasons,
            required ? TeamLeaderApprover : PaymentsOfficerApprover,
            type,
            largestSinglePayment,
            commencementAmount,
            required
                ? $"Team Leader approval required — {TeamLeaderApprover}."
                : "Within the Payments Officer's authority — standard sign-off before release.");
    }

    // ── Confirmation drafts ─────────────────────────────────────────────

    /// <summary>Fill the payment-reference tokens in a confirmation draft.</summary>
    public static string? RenderConfirmation(string? draft, PaymentApprovalRecord? record)
    {
        if (string.IsNullOrEmpty(draft)) return draft;
        const string notYet = "to be confirmed on release";
        return ReferenceTokenRegex.Replace(draft, m =>
        {
            if (record is null || record.Status != PaymentApprovalStatus.Released) return notYet;
            if (m.Groups[1].Success
                && int.TryParse(m.Groups[1].Value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var n)
                && n >= 1 && n <= record.Payees.Count)
            {
                return record.Payees[n - 1].PaymentReference ?? record.PaymentReference ?? notYet;
            }
            return record.PaymentReference ?? notYet;
        });
    }

    // ── Formatting, masking and parsing helpers ─────────────────────────

    public static decimal Round2(decimal value) => Math.Round(value, 2, MidpointRounding.AwayFromZero);

    /// <summary>AUD with cents only when there are cents: "$7,932", "$25,622.74".</summary>
    public static string FormatMoney(decimal amount)
    {
        var rounded = Round2(amount);
        return rounded == decimal.Truncate(rounded)
            ? rounded.ToString("C0", AuCulture)
            : rounded.ToString("C2", AuCulture);
    }

    public static string FormatPercent(decimal percent) =>
        percent.ToString("0.##", CultureInfo.InvariantCulture) + "%";

    public static string DigitsOnly(string? value) =>
        new((value ?? string.Empty).Where(char.IsDigit).ToArray());

    public static string? Last4Digits(string? account)
    {
        var digits = DigitsOnly(account);
        return digits.Length >= 4 ? digits[^4..] : null;
    }

    /// <summary>"033123" or "033-***" → "033-***".</summary>
    public static string MaskBsb(string? bsb)
    {
        var raw = (bsb ?? string.Empty).Trim();
        if (raw.Length == 0) return string.Empty;
        var digits = DigitsOnly(raw);
        return digits.Length >= 3 ? $"{digits[..3]}-***" : "***-***";
    }

    /// <summary>"12345120" or "****5120" → "****5120".</summary>
    public static string MaskAccount(string? account)
    {
        var raw = (account ?? string.Empty).Trim();
        if (raw.Length == 0) return string.Empty;
        var last4 = Last4Digits(raw);
        return last4 is null ? "****" : "****" + last4;
    }

    /// <summary>"BSB 033-*** ****5120" — never the full numbers.</summary>
    public static string MaskPayeeAccount(string? bsb, string? account)
    {
        var b = MaskBsb(bsb);
        var a = MaskAccount(account);
        if (b.Length == 0 && a.Length == 0) return "nominated account on file";
        return $"BSB {(b.Length == 0 ? "***-***" : b)} {(a.Length == 0 ? "****" : a)}";
    }

    /// <summary>Mask free-text bank details passed in by an agent; already-masked text passes through.</summary>
    public static string MaskAccountText(string? text)
    {
        var raw = (text ?? string.Empty).Trim();
        if (raw.Length == 0) return "(not provided)";
        if (raw.Contains('*') || !raw.Any(char.IsDigit)) return raw;
        var last4 = Last4Digits(raw);
        return last4 is null ? "****" : "****" + last4;
    }

    /// <summary>Lower-case letters and digits only, with "&amp;" read as "and".</summary>
    public static string NormalizeName(string? value)
    {
        var s = (value ?? string.Empty).ToLowerInvariant().Replace("&", " and ");
        return new string(s.Where(char.IsLetterOrDigit).ToArray());
    }

    /// <summary>First amount in a case's headline text, e.g. "AUD 15,000 requested" → 15000.</summary>
    public static decimal? ParseAmount(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        var match = AmountRegex.Match(text);
        if (!match.Success) return null;
        return decimal.TryParse(match.Value.Replace(",", string.Empty), NumberStyles.Number, CultureInfo.InvariantCulture, out var d)
            ? d
            : null;
    }
}
