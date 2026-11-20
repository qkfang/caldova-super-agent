using System.ComponentModel;
using System.Text.Encodings.Web;
using System.Text.Json;
using ModelContextProtocol.Server;
using CaldovaSuper.App.Services;

namespace CaldovaSuper.App.Mcp;

/// <summary>
/// MCP tool surface for the Payments Agent (Penny, Payments Officer). Exposes
/// the payment-flow primitives: validating the payee, confirming the
/// eligibility decision on the Member Case, splitting tax-free / taxable
/// components and calculating PAYG withholding and the net payment, checking
/// authority limits, raising an approval request that is posted to Microsoft
/// Teams, polling it, and finally releasing the payment once — and only once
/// — a human has approved it.
///
/// Every tool is deterministic and side-effect free except
/// <see cref="RequestApproval"/> (creates an approval and posts the Teams
/// card) and <see cref="ReleasePayment"/> (moves an approved payment to
/// released). The static <c>*Payload</c> builders are shared with
/// <c>PaymentsApi</c> so the deterministic demo path reports exactly what the
/// tools return.
/// </summary>
[McpServerToolType]
public class PaymentsMcpTools
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = false,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    private readonly CaseStore _cases;
    private readonly PaymentApprovalStore _payments;
    private readonly TeamsMcpTools _teams;
    private readonly ILogger<PaymentsMcpTools> _logger;

    public PaymentsMcpTools(
        CaseStore cases,
        PaymentApprovalStore payments,
        TeamsMcpTools teams,
        ILogger<PaymentsMcpTools> logger)
    {
        _cases = cases;
        _payments = payments;
        _teams = teams;
        _logger = logger;
    }

    [McpServerTool(Name = "payments_validatePayee"),
     Description("Check that the payee name and bank details match the member or a nominated beneficiary held on file for the Member Case. A mismatch needs Team Leader approval — pay only to nominated accounts. Call once per payee, before requesting approval.")]
    public string ValidatePayee(
        [Description("Member Case number, e.g. REQ-20261111-OPS004.")] string caseNumber,
        [Description("Name on the bank account the money will be paid to.")] string payeeName,
        [Description("BSB — masked is fine (e.g. '033-***').")] string? bsb = null,
        [Description("Account number — masked is fine (e.g. '****5120').")] string? accountNumber = null)
    {
        if (string.IsNullOrWhiteSpace(caseNumber)) return Error("caseNumber is required.");
        if (string.IsNullOrWhiteSpace(payeeName)) return Error("payeeName is required.");

        var record = _cases.Get(caseNumber.Trim());
        if (record is null) return Error($"case '{caseNumber}' not found.");

        var profile = PaymentRules.ProfileFor(record);
        var result = PaymentRules.ValidatePayee(profile, payeeName, bsb, accountNumber);
        return ToJson(ValidatePayeePayload(record.CaseNumber, profile.MemberDisplay, result));
    }

    [McpServerTool(Name = "payments_checkCaseApproval"),
     Description("Confirm the eligibility decision recorded on the Member Case (approved, partially approved, declined, blocked by Financial Crime or pending), the approved amount, who decided and the rule cited — and whether the amount to pay is within it. Payments never pays more than was approved.")]
    public string CheckCaseApproval(
        [Description("Member Case number.")] string caseNumber,
        [Description("Gross amount you intend to pay in AUD (total across payees; for a pension commencement, the commencement amount). Optional — defaults to the amount on the case.")] decimal? grossAmount = null)
    {
        if (string.IsNullOrWhiteSpace(caseNumber)) return Error("caseNumber is required.");

        var record = _cases.Get(caseNumber.Trim());
        if (record is null) return Error($"case '{caseNumber}' not found.");

        var profile = PaymentRules.ProfileFor(record);
        var current = _payments.CurrentForCase(record.CaseNumber);
        var status = current?.CaseApprovalStatus ?? profile.CaseApprovalStatus;
        var approved = current is not null ? current.ApprovedAmount : profile.ApprovedAmount;
        var amount = grossAmount
            ?? current?.CommencementAmount
            ?? current?.GrossAmount
            ?? (profile.PaymentType == PaymentTypes.Pension ? profile.CommencementAmount ?? profile.GrossAmount : profile.GrossAmount);

        var check = PaymentRules.CheckCaseApproval(profile, status, approved, amount);
        return ToJson(CheckCaseApprovalPayload(record, check));
    }

    [McpServerTool(Name = "payments_calculateBenefit"),
     Description("Calculate a benefit payment transparently: gross amount → tax-free component → taxable component (taxed element) → PAYG withholding → net payment. Withholding on the taxed element: under 60 = 22% (20% + 2% Medicare levy); 60 or over = nil; death benefit to a non-dependant for tax = 17% (15% + 2% Medicare levy); death benefit to a tax dependant = nil; rollover = nil. Call once per payee.")]
    public string CalculateBenefit(
        [Description("Gross amount for this payee in AUD.")] decimal grossAmount,
        [Description("Tax-free component as a percentage of the account, e.g. 6 for 6%.")] decimal taxFreePercent,
        [Description("Recipient tax status: under-60, 60-plus, death-non-dependant, death-dependant or rollover.")] string taxStatus,
        [Description("Payee name (optional, for the record).")] string? payeeName = null)
    {
        if (grossAmount <= 0m) return Error("grossAmount must be greater than zero.");
        if (taxFreePercent < 0m || taxFreePercent > 100m) return Error("taxFreePercent must be between 0 and 100.");

        var calculation = PaymentRules.Calculate(grossAmount, taxFreePercent, taxStatus);
        return ToJson(CalculateBenefitPayload(calculation, payeeName));
    }

    [McpServerTool(Name = "payments_checkAuthorityLimit"),
     Description("Check whether the payment needs Team Leader approval. Triggers: any single payment of $250,000 or more, any death benefit, any financial hardship release, a pension commencement of $1,000,000 or more, and any blocked case or payee that doesn't match the member or a nominated beneficiary. Every other release still needs the Payments Officer's sign-off.")]
    public string CheckAuthorityLimit(
        [Description("Largest single payment in AUD (for a death benefit, the largest beneficiary's gross share).")] decimal grossAmount,
        [Description("Payment type: hardship, death-benefit, pension, rollover-out, inbound or lump-sum (labels are accepted).")] string paymentType,
        [Description("Member Case number (optional) — adds the case's blocked status to the check.")] string? caseNumber = null,
        [Description("Pension commencement amount in AUD (pension commencements only).")] decimal? commencementAmount = null,
        [Description("True when payments_validatePayee reported a mismatch.")] bool payeeMismatch = false)
    {
        if (grossAmount < 0m) return Error("grossAmount can't be negative.");

        var caseBlocked = false;
        if (!string.IsNullOrWhiteSpace(caseNumber))
        {
            var record = _cases.Get(caseNumber.Trim());
            if (record is null) return Error($"case '{caseNumber}' not found.");

            var profile = PaymentRules.ProfileFor(record);
            var current = _payments.CurrentForCase(record.CaseNumber);
            var status = CaseApprovalStatuses.Normalize(current?.CaseApprovalStatus ?? profile.CaseApprovalStatus);
            caseBlocked = status == CaseApprovalStatuses.Blocked || current?.Status == PaymentApprovalStatus.Blocked;
            if (commencementAmount is null && PaymentTypes.Normalize(paymentType) == PaymentTypes.Pension)
                commencementAmount = current?.CommencementAmount ?? profile.CommencementAmount;
        }

        var check = PaymentRules.CheckAuthority(paymentType, grossAmount, commencementAmount, payeeMismatch, caseBlocked);
        return ToJson(CheckAuthorityPayload(check));
    }

    [McpServerTool(Name = "payments_requestApproval"),
     Description("Raise the payment approval request and post the 'Caldova Wealth — Payment approval' Adaptive Card to Microsoft Teams (via teams_sendApprovalCard). Returns the approvalId. There is one live approval per case: if the Payments desk has already raised it, that approvalId is returned instead of a duplicate. Refuses (no card) for blocked or unapproved cases. MUST be called before payments_releasePayment.")]
    public async Task<string> RequestApproval(
        [Description("Member Case number.")] string caseNumber,
        [Description("Gross amount in AUD.")] decimal grossAmount,
        [Description("PAYG tax withheld in AUD.")] decimal taxWithheld,
        [Description("Net payment in AUD.")] decimal netAmount,
        [Description("Payee name(s).")] string payeeName,
        [Description("Masked bank details, e.g. 'BSB 033-*** ****5120'.")] string? payeeAccount = null,
        [Description("Payment type (optional — defaults to the case's payment type).")] string? paymentType = null,
        [Description("Why approval is needed — the authority rules triggered (optional).")] string? reason = null)
    {
        if (string.IsNullOrWhiteSpace(caseNumber)) return Error("caseNumber is required.");
        if (grossAmount <= 0m) return Error("grossAmount must be greater than zero.");
        if (string.IsNullOrWhiteSpace(payeeName)) return Error("payeeName is required.");

        var record = _cases.Get(caseNumber.Trim());
        if (record is null) return Error($"case '{caseNumber}' not found.");

        var profile = PaymentRules.ProfileFor(record);
        var payeeKey = PaymentRules.NormalizeName(payeeName);
        var existing = _payments.ForCase(record.CaseNumber)
            .Where(r => r.Status is PaymentApprovalStatus.Pending or PaymentApprovalStatus.Approved or PaymentApprovalStatus.Blocked)
            .FirstOrDefault(r => r.RaisedBy == PaymentRules.RaisedByDesk
                || r.Status == PaymentApprovalStatus.Blocked
                || PaymentRules.NormalizeName(r.PayeeName) == payeeKey
                || r.Payees.Any(p => PaymentRules.NormalizeName(p.Name) == payeeKey));
        if (existing is not null)
            return ToJson(RequestApprovalPayload(existing, null, alreadyRaised: true));

        var type = PaymentTypes.Normalize(string.IsNullOrWhiteSpace(paymentType) ? profile.PaymentType : paymentType);
        var amountToCheck = type == PaymentTypes.Pension ? profile.CommencementAmount ?? grossAmount : grossAmount;
        var caseCheck = PaymentRules.CheckCaseApproval(profile, null, null, amountToCheck);
        var maskedAccount = PaymentRules.MaskAccountText(payeeAccount);

        if (!caseCheck.Payable)
        {
            // Audit trail only: a blocked request never gets a Teams card.
            var blocked = _payments.Add(new PaymentApprovalRecord
            {
                ApprovalId = PaymentApprovalStore.NewApprovalId(),
                CaseNumber = record.CaseNumber,
                ClientName = record.ClientName,
                MemberNumber = record.MemberNumber,
                MemberDisplay = profile.MemberDisplay,
                PaymentType = type,
                GrossAmount = grossAmount,
                PayeeName = payeeName.Trim(),
                PayeeAccount = maskedAccount,
                Reason = caseCheck.Note,
                ApprovalReasons = [caseCheck.Note],
                RaisedBy = PaymentRules.RaisedByAgent,
                CaseApprovalStatus = caseCheck.Status,
                ApprovedAmount = caseCheck.ApprovedAmount,
                Status = PaymentApprovalStatus.Blocked,
                Decision = "blocked",
                DecidedBy = profile.CaseDecidedBy,
                DecidedAt = DateTimeOffset.UtcNow,
                TeamsMessage = "No approval card raised — the case is blocked, so there is nothing to approve or release."
            });
            _logger.LogInformation("payments_requestApproval refused for blocked case {CaseNumber}: {ApprovalId}",
                Sanitize(record.CaseNumber), Sanitize(blocked.ApprovalId));
            return ToJson(RequestApprovalPayload(blocked, null, alreadyRaised: false));
        }

        var validation = PaymentRules.ValidatePayee(profile, payeeName, null, payeeAccount);
        var commencement = type == PaymentTypes.Pension ? profile.CommencementAmount : null;
        var authority = PaymentRules.CheckAuthority(type, grossAmount, commencement, !validation.Match, caseBlocked: false);
        var reasonText = !string.IsNullOrWhiteSpace(reason)
            ? reason.Trim()
            : authority.Reasons.Count > 0 ? string.Join(" ", authority.Reasons) : authority.Note;

        var approval = _payments.Add(new PaymentApprovalRecord
        {
            ApprovalId = PaymentApprovalStore.NewApprovalId(),
            CaseNumber = record.CaseNumber,
            ClientName = record.ClientName,
            MemberNumber = record.MemberNumber,
            MemberDisplay = profile.MemberDisplay,
            PaymentType = type,
            GrossAmount = grossAmount,
            TaxWithheld = taxWithheld,
            NetAmount = netAmount,
            CommencementAmount = commencement,
            PayeeName = payeeName.Trim(),
            PayeeAccount = maskedAccount,
            Payees =
            [
                new PaymentPayeeLine
                {
                    Name = payeeName.Trim(),
                    MaskedAccount = maskedAccount,
                    SharePercent = 100m,
                    GrossAmount = grossAmount,
                    TaxWithheld = taxWithheld,
                    NetAmount = netAmount,
                    PayeeMatches = validation.Match
                }
            ],
            PaymentDate = profile.PaymentDate,
            Reason = reasonText,
            ApprovalReasons = authority.Reasons,
            Approver = authority.Approver,
            RaisedBy = PaymentRules.RaisedByAgent,
            CaseApprovalStatus = caseCheck.Status,
            ApprovedAmount = caseCheck.ApprovedAmount,
            Status = PaymentApprovalStatus.Pending
        });

        var teamsResult = await _teams.SendApprovalCardCoreAsync(new TeamsApprovalCardRequest(
            ApprovalId: approval.ApprovalId,
            CaseNumber: approval.CaseNumber,
            MemberName: approval.MemberDisplay,
            PaymentType: PaymentTypes.Label(approval.PaymentType),
            GrossAmount: approval.GrossAmount,
            TaxWithheld: approval.TaxWithheld,
            NetAmount: approval.NetAmount,
            PayeeName: approval.PayeeName,
            PayeeAccount: approval.PayeeAccount,
            Reason: approval.Reason,
            PaymentDate: approval.PaymentDate));

        approval.TeamsSent = teamsResult.Sent;
        approval.TeamsChannel = teamsResult.Channel;
        approval.TeamsMessage = teamsResult.Message;
        approval.ApprovalUrl = teamsResult.ApprovalUrl;

        _logger.LogInformation(
            "Payment approval requested via MCP: id={ApprovalId} case={CaseNumber} gross={Gross} teamsSent={TeamsSent}",
            Sanitize(approval.ApprovalId), Sanitize(approval.CaseNumber), approval.GrossAmount, teamsResult.Sent);

        return ToJson(RequestApprovalPayload(approval, teamsResult, alreadyRaised: false));
    }

    [McpServerTool(Name = "payments_getApprovalStatus"),
     Description("Look up the current status of a payment approval: pending, approved, rejected, released, blocked or cancelled (superseded).")]
    public string GetApprovalStatus(
        [Description("Approval id returned by payments_requestApproval.")] string approvalId)
    {
        if (string.IsNullOrWhiteSpace(approvalId)) return Error("approvalId is required.");
        var record = _payments.Get(approvalId);
        if (record is null) return Error($"approval '{approvalId}' not found.");
        return ToJson(ApprovalStatusPayload(record));
    }

    [McpServerTool(Name = "payments_releasePayment"),
     Description("Release a payment that a human has approved. Refuses unless the approval is in the approved state — never call this without prior human approval in Microsoft Teams.")]
    public string ReleasePayment(
        [Description("Approval id returned by payments_requestApproval.")] string approvalId)
    {
        if (string.IsNullOrWhiteSpace(approvalId)) return Error("approvalId is required.");
        var result = _payments.Release(approvalId);
        if (result.Record is null) return Error(result.Error ?? $"approval '{approvalId}' not found.");

        if (result.Ok)
        {
            _logger.LogInformation("Payment released via MCP: id={ApprovalId} ref={Reference}",
                Sanitize(result.Record.ApprovalId), Sanitize(result.Record.PaymentReference ?? string.Empty));
        }
        return ToJson(ReleasePayload(result));
    }

    // ── Payload builders shared with PaymentsApi ───────────────────────

    internal static object ValidatePayeePayload(string caseNumber, string member, PayeeValidationResult v) => new
    {
        tool = "payments_validatePayee",
        caseNumber,
        member,
        payeeName = v.PayeeName,
        payeeAccount = v.MaskedAccount,
        nameMatch = v.NameMatch,
        accountMatch = v.AccountMatch,
        match = v.Match,
        matchedOnFile = v.MatchedOnFile,
        relationship = v.Relationship,
        humanApprovalRequired = !v.Match,
        note = v.Note
    };

    internal static object CheckCaseApprovalPayload(CaseRecord record, CaseApprovalCheckResult c) => new
    {
        tool = "payments_checkCaseApproval",
        caseNumber = record.CaseNumber,
        requestType = record.RequestType,
        status = c.Status,
        statusLabel = c.StatusLabel,
        approvedAmount = c.ApprovedAmount,
        amountChecked = c.AmountChecked,
        amountWithinApproval = c.AmountWithinApproval,
        payable = c.Payable,
        decidedBy = c.DecidedBy,
        ruleCited = c.RuleCited,
        note = c.Note
    };

    internal static object CalculateBenefitPayload(BenefitCalculation c, string? payeeName) => new
    {
        tool = "payments_calculateBenefit",
        payeeName,
        inputs = new
        {
            grossAmount = c.GrossAmount,
            taxFreePercent = c.TaxFreePercent,
            taxStatus = c.TaxStatus
        },
        steps = new object[]
        {
            new { label = "Gross amount", amount = c.GrossAmount },
            new { label = $"Tax-free component ({PaymentRules.FormatPercent(c.TaxFreePercent)})", amount = c.TaxFreeComponent },
            new { label = "Taxable component (taxed element)", amount = c.TaxableComponent },
            new { label = $"PAYG withholding ({c.WithholdingRateLabel})", amount = -c.TaxWithheld },
            new { label = "Net payment", amount = c.NetAmount }
        },
        taxFreeComponent = c.TaxFreeComponent,
        taxableComponent = c.TaxableComponent,
        withholdingRate = c.WithholdingRate,
        withholdingRateLabel = c.WithholdingRateLabel,
        taxWithheld = c.TaxWithheld,
        netAmount = c.NetAmount,
        netAmountFormatted = PaymentRules.FormatMoney(c.NetAmount),
        ruleCited = PaymentRules.TaxRuleTitle
    };

    internal static object CheckAuthorityPayload(AuthorityCheckResult a) => new
    {
        tool = "payments_checkAuthorityLimit",
        paymentType = a.PaymentType,
        paymentTypeLabel = PaymentTypes.Label(a.PaymentType),
        largestSinglePayment = a.LargestSinglePayment,
        commencementAmount = a.CommencementAmount,
        limits = new
        {
            singlePayment = PaymentRules.SinglePaymentLimit,
            pensionCommencement = PaymentRules.PensionCommencementLimit,
            deathBenefit = "always",
            hardshipRelease = "always",
            blockedOrMismatchedPayee = "always"
        },
        humanApprovalRequired = a.Required,
        approver = a.Approver,
        reasons = a.Reasons,
        note = a.Note,
        ruleCited = PaymentRules.AuthorityRuleTitle
    };

    internal static object RequestApprovalPayload(PaymentApprovalRecord r, TeamsCardSendResult? teams, bool alreadyRaised)
    {
        var blocked = r.Status == PaymentApprovalStatus.Blocked;
        var note = blocked
            ? "The case is blocked — no approval card was raised and no payment can be released. Confirm the funds stay in the account."
            : alreadyRaised
                ? "An approval for this case is already with the approver in Microsoft Teams — use this approvalId. Call payments_releasePayment only after it has been approved."
                : "Awaiting human approval in Microsoft Teams. Call payments_releasePayment with this approvalId only after approval has been granted.";
        return new
        {
            tool = "payments_requestApproval",
            approvalId = r.ApprovalId,
            caseNumber = r.CaseNumber,
            status = r.StatusKey,
            raised = !blocked,
            alreadyRaised = alreadyRaised && !blocked,
            paymentType = PaymentTypes.Label(r.PaymentType),
            grossAmount = r.GrossAmount,
            taxWithheld = r.TaxWithheld,
            netAmount = r.NetAmount,
            payeeName = r.PayeeName,
            payeeAccount = r.PayeeAccount,
            approver = r.Approver,
            reasons = r.ApprovalReasons,
            teams = new
            {
                sent = teams?.Sent ?? r.TeamsSent,
                channel = teams?.Channel ?? r.TeamsChannel,
                approvalUrl = teams?.ApprovalUrl ?? r.ApprovalUrl,
                message = teams?.Message ?? r.TeamsMessage
            },
            note
        };
    }

    internal static object ApprovalStatusPayload(PaymentApprovalRecord r) => new
    {
        tool = "payments_getApprovalStatus",
        approvalId = r.ApprovalId,
        caseNumber = r.CaseNumber,
        status = r.StatusKey,
        decision = r.Decision,
        decidedBy = r.DecidedBy,
        decidedAt = r.DecidedAt,
        decisionComment = r.DecisionComment,
        grossAmount = r.GrossAmount,
        netAmount = r.NetAmount,
        paymentReference = r.PaymentReference,
        releasedAt = r.ReleasedAt,
        canRelease = r.Status == PaymentApprovalStatus.Approved
    };

    internal static object ReleasePayload(PaymentTransitionResult result)
    {
        var r = result.Record!;
        var released = result.Ok && r.Status == PaymentApprovalStatus.Released;
        string note;
        if (!result.Ok)
            note = $"Not released: {result.Error}.";
        else if (result.Note == "already released")
            note = "Payment had already been released.";
        else
            note = r.TaxWithheld > 0m
                ? $"Payment released to the payment rail. PAYG withheld ({PaymentRules.FormatMoney(r.TaxWithheld)}) is remitted to the ATO."
                : "Payment released to the payment rail.";
        return new
        {
            tool = "payments_releasePayment",
            approvalId = r.ApprovalId,
            released,
            status = r.StatusKey,
            paymentReference = r.PaymentReference,
            payees = r.Payees.Select(p => new
            {
                name = p.Name,
                account = p.MaskedAccount,
                netAmount = p.NetAmount,
                paymentReference = p.PaymentReference
            }),
            netAmount = r.NetAmount,
            taxWithheld = r.TaxWithheld,
            note
        };
    }

    internal static string ToJson(object payload) => JsonSerializer.Serialize(payload, JsonOptions);

    private static string Error(string message) => ToJson(new { error = message });

    private static string Sanitize(string value) =>
        (value ?? string.Empty).Replace('\r', ' ').Replace('\n', ' ');
}
