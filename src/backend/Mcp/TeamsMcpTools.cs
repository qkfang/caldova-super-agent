using System.ComponentModel;
using System.Text.Json;
using ModelContextProtocol.Server;
using CaldovaSuper.App.Services;

namespace CaldovaSuper.App.Mcp;

/// <summary>
/// MCP tool surface that owns Microsoft Teams notifications for the Payments
/// approval flow. The Payments Agent (or any in-process caller) invokes
/// <c>teams_sendApprovalCard</c> and gets back a deterministic result
/// describing where the "Caldova Wealth — Payment approval" Adaptive Card was
/// delivered.
///
/// For the demo this is a simulated delivery — the Adaptive Card payload is
/// built and logged, and the tool returns a synthetic <c>sent=true</c>
/// envelope so the UI flow always works end-to-end without external infra.
/// Swapping in a real Teams sender later just means replacing the body of
/// <see cref="SendApprovalCardCoreAsync"/>.
/// </summary>
[McpServerToolType]
public class TeamsMcpTools
{
    private const string DemoChannel = "caldova-payment-approvals";
    private const string ApprovalPagePath = "/agents/payments";
    private const string CardTitle = "Caldova Wealth — Payment approval";

    private readonly ILogger<TeamsMcpTools> _logger;

    public TeamsMcpTools(ILogger<TeamsMcpTools> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Whether the Teams sender is considered configured. The simulated
    /// demo implementation always reports configured so the UI surfaces
    /// a successful delivery rather than a configuration warning.
    /// </summary>
    public bool IsConfigured => true;

    [McpServerTool(Name = "teams_sendApprovalCard"),
     Description("Post the Microsoft Teams Adaptive Card 'Caldova Wealth — Payment approval' asking the approver to approve or reject a payment release. The card shows the case number, member, payment type, gross amount, tax withheld, net payment, the payee with masked bank details and why approval is needed, with Approve / Reject actions. Returns the channel and the approval link. payments_requestApproval calls this for you after minting an approvalId.")]
    public async Task<string> SendApprovalCard(
        [Description("Approval id minted by payments_requestApproval (e.g. PAY-XXXXXXXXXX).")] string approvalId,
        [Description("Member Case number (e.g. REQ-20261111-OPS004).")] string caseNumber,
        [Description("Member (and member number) the payment is for.")] string memberName,
        [Description("Payment type, e.g. 'Financial hardship lump sum', 'Death benefit lump sum', 'Pension commencement & regular payment'.")] string paymentType,
        [Description("Gross amount in AUD.")] decimal grossAmount,
        [Description("PAYG tax withheld in AUD.")] decimal taxWithheld,
        [Description("Net payment in AUD.")] decimal netAmount,
        [Description("Payee name(s).")] string payeeName,
        [Description("Bank details, masked (e.g. 'BSB 033-*** ****5120'). Unmasked numbers are masked automatically.")] string? payeeAccount = null,
        [Description("Why approval is needed (the authority rules that were triggered).")] string? reason = null,
        [Description("Payment date shown on the card (optional).")] string? paymentDate = null)
    {
        if (string.IsNullOrWhiteSpace(approvalId)) return Error("approvalId is required.");
        if (string.IsNullOrWhiteSpace(caseNumber)) return Error("caseNumber is required.");
        if (string.IsNullOrWhiteSpace(payeeName)) return Error("payeeName is required.");
        if (grossAmount <= 0m) return Error("grossAmount must be greater than zero.");

        var result = await SendApprovalCardCoreAsync(new TeamsApprovalCardRequest(
            ApprovalId: approvalId.Trim(),
            CaseNumber: caseNumber.Trim(),
            MemberName: memberName ?? string.Empty,
            PaymentType: paymentType ?? string.Empty,
            GrossAmount: grossAmount,
            TaxWithheld: taxWithheld,
            NetAmount: netAmount,
            PayeeName: payeeName.Trim(),
            PayeeAccount: payeeAccount,
            Reason: reason,
            PaymentDate: paymentDate));

        return Json(new
        {
            tool = "teams_sendApprovalCard",
            approvalId,
            caseNumber,
            sent = result.Sent,
            channel = result.Channel,
            approvalUrl = result.ApprovalUrl,
            message = result.Message
        });
    }

    /// <summary>
    /// In-process entry point used by <c>PaymentsMcpTools</c> and the
    /// <c>PaymentsApi</c> HTTP layer to drive the same logic the MCP tool
    /// exposes. Keeps the Adaptive Card construction in one place and lets
    /// non-MCP callers (e.g. the deterministic demo path) share the result
    /// shape.
    /// </summary>
    public Task<TeamsCardSendResult> SendApprovalCardCoreAsync(
        TeamsApprovalCardRequest request,
        CancellationToken cancellationToken = default)
    {
        var approvalUrl = BuildApprovalUrl(request.ApprovalId);
        var card = BuildAdaptiveCard(request, approvalUrl);

        // Demo behaviour: log the Adaptive Card payload and report a
        // synthetic successful delivery to the demo Teams channel so the
        // page UI shows "Adaptive Card posted" rather than a configuration
        // warning. A real implementation would post `card` to Teams here.
        _logger.LogInformation(
            "teams_sendApprovalCard: simulated delivery. approvalId={ApprovalId} case={CaseNumber} gross={Gross} net={Net} channel={Channel}",
            Sanitize(request.ApprovalId), Sanitize(request.CaseNumber), request.GrossAmount, request.NetAmount, DemoChannel);

        if (_logger.IsEnabled(LogLevel.Debug))
        {
            _logger.LogDebug(
                "teams_sendApprovalCard payload for {ApprovalId}: {Payload}",
                Sanitize(request.ApprovalId),
                JsonSerializer.Serialize(card));
        }

        return Task.FromResult(new TeamsCardSendResult(
            Sent: true,
            Channel: DemoChannel,
            ApprovalUrl: approvalUrl,
            Message: $"Adaptive Card \"{CardTitle}\" posted to {DemoChannel} for approval {request.ApprovalId}.",
            Card: card));
    }

    /// <summary>
    /// Deep link back to the Payments page. <paramref name="decision"/>
    /// ("approve" / "reject") pre-selects the action in the approval popup;
    /// the human still confirms it there.
    /// </summary>
    public static string BuildApprovalUrl(string approvalId, string? decision = null)
    {
        var url = $"{ApprovalPagePath}?approvalId={Uri.EscapeDataString(approvalId ?? string.Empty)}";
        return string.IsNullOrWhiteSpace(decision) ? url : $"{url}&decision={Uri.EscapeDataString(decision)}";
    }

    private static Dictionary<string, object?> BuildAdaptiveCard(TeamsApprovalCardRequest request, string approvalUrl)
    {
        var payee = string.IsNullOrWhiteSpace(request.PayeeAccount)
            ? request.PayeeName
            : $"{request.PayeeName} — {PaymentRules.MaskAccountText(request.PayeeAccount)}";

        var facts = new List<object>
        {
            new { title = "Case number", value = request.CaseNumber },
            new { title = "Member", value = request.MemberName },
            new { title = "Payment type", value = request.PaymentType },
            new { title = "Gross amount", value = PaymentRules.FormatMoney(request.GrossAmount) },
            new { title = "Tax withheld", value = PaymentRules.FormatMoney(request.TaxWithheld) },
            new { title = "Net payment", value = PaymentRules.FormatMoney(request.NetAmount) },
            new { title = "Payee", value = payee },
        };
        if (!string.IsNullOrWhiteSpace(request.PaymentDate))
            facts.Add(new { title = "Payment date", value = request.PaymentDate });

        // Incoming-webhook cards can't carry Action.Submit, so Approve /
        // Reject deep-link to the approval popup on the Payments page.
        var content = new Dictionary<string, object?>
        {
            ["$schema"] = "http://adaptivecards.io/schemas/adaptive-card.json",
            ["type"] = "AdaptiveCard",
            ["version"] = "1.4",
            ["msteams"] = new { width = "Full" },
            ["body"] = new object[]
            {
                new
                {
                    type = "TextBlock",
                    size = "Large",
                    weight = "Bolder",
                    wrap = true,
                    text = $"💳 {CardTitle}"
                },
                new
                {
                    type = "TextBlock",
                    spacing = "None",
                    isSubtle = true,
                    wrap = true,
                    text = $"Payments Agent (Penny) · {request.CaseNumber} · Approval id {request.ApprovalId}"
                },
                new
                {
                    type = "FactSet",
                    facts
                },
                new
                {
                    type = "TextBlock",
                    weight = "Bolder",
                    spacing = "Medium",
                    wrap = true,
                    text = "Why approval is needed"
                },
                new
                {
                    type = "TextBlock",
                    wrap = true,
                    text = string.IsNullOrWhiteSpace(request.Reason)
                        ? "Cross-checks completed by the Payments Agent. Please review and approve before the payment is released."
                        : request.Reason
                },
                new
                {
                    type = "TextBlock",
                    size = "Small",
                    isSubtle = true,
                    wrap = true,
                    text = "Penny's agent releases this payment only after it is approved. Bank details are masked."
                }
            },
            ["actions"] = new object[]
            {
                new
                {
                    type = "Action.OpenUrl",
                    title = "Approve",
                    style = "positive",
                    url = BuildApprovalUrl(request.ApprovalId, "approve")
                },
                new
                {
                    type = "Action.OpenUrl",
                    title = "Reject",
                    style = "destructive",
                    url = BuildApprovalUrl(request.ApprovalId, "reject")
                },
                new
                {
                    type = "Action.OpenUrl",
                    title = "Open case in Caldova",
                    url = approvalUrl
                }
            }
        };

        return new Dictionary<string, object?>
        {
            ["type"] = "message",
            ["attachments"] = new object[]
            {
                new Dictionary<string, object?>
                {
                    ["contentType"] = "application/vnd.microsoft.card.adaptive",
                    ["contentUrl"] = null,
                    ["content"] = content
                }
            }
        };
    }

    private static string Json(object payload) =>
        JsonSerializer.Serialize(payload, new JsonSerializerOptions { WriteIndented = false });

    private static string Error(string message) =>
        Json(new { error = message });

    private static string Sanitize(string value) =>
        (value ?? string.Empty).Replace('\r', ' ').Replace('\n', ' ');
}

/// <summary>Input record for <see cref="TeamsMcpTools.SendApprovalCardCoreAsync"/>.</summary>
public record TeamsApprovalCardRequest(
    string ApprovalId,
    string CaseNumber,
    string MemberName,
    string PaymentType,
    decimal GrossAmount,
    decimal TaxWithheld,
    decimal NetAmount,
    string PayeeName,
    string? PayeeAccount,
    string? Reason,
    string? PaymentDate = null);

/// <summary>Result envelope returned by <see cref="TeamsMcpTools.SendApprovalCardCoreAsync"/>.</summary>
public record TeamsCardSendResult(bool Sent, string Channel, string ApprovalUrl, string Message, object? Card = null);
