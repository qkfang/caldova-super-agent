using System.Text;
using OpenAI.Responses;
using CaldovaSuper.Agents;
using CaldovaSuper.App.Mcp;
using CaldovaSuper.App.Services;

namespace CaldovaSuper.App.Api;

/// <summary>Payment inputs confirmed on step 2 of the Payments "Try it out" tab. Any field left null falls back to the case defaults.</summary>
record PaymentsProcessRequest(
    string CaseNumber,
    string? PaymentType,
    decimal? GrossAmount,
    decimal? RequestedAmount,
    decimal? CommencementAmount,
    decimal? TaxFreePercent,
    int? MemberAge,
    string? TaxStatus,
    string? CaseApprovalStatus,
    decimal? ApprovedAmount,
    string? PaymentDate,
    List<PaymentsPayeeInput>? Payees);

/// <summary>One payee row (bank details arrive masked and are re-masked server-side).</summary>
record PaymentsPayeeInput(string? Name, string? Bsb, string? Account, decimal? SharePercent);

record PaymentsDecisionRequest(string? DecidedBy, string? Comment);

/// <summary>
/// HTTP endpoints behind the "Try it out" tab on the Payments Agent page
/// (<c>/agents/payments</c>, Penny — Payments Officer):
///
/// 1. List the Member Cases held in the in-memory <see cref="CaseStore"/> and
///    return the deterministic payment inputs for a case.
/// 2. Engage the Foundry <c>PaymentsAgent</c> (streamed over SSE) after the
///    Payments desk has run the payment maths and cross-checks and raised the
///    Microsoft Teams approval — so the page always has a result, even when
///    Foundry isn't configured.
/// 3. Approve / reject (the in-page stand-in for the Teams card), resume the
///    agent after approval, poll the approval and release the payment — the
///    release refuses unless a human has approved it.
/// </summary>
public static class PaymentsApi
{
    private const string FlowOutbound = "outbound";
    private const string FlowBlocked = "blocked";
    private const string FlowInbound = "inbound";

    public static void MapPaymentsEndpoints(
        this WebApplication app,
        CaseStore store,
        CaldovaAgentFactory factory,
        ILogger logger)
    {
        // Always registered: TeamsMcpTools simulates delivery so the demo
        // flow works end to end without external infrastructure.
        var paymentStore = app.Services.GetRequiredService<PaymentApprovalStore>();
        var teamsService = app.Services.GetRequiredService<TeamsMcpTools>();

        // MCP tool descriptor pointing the Payments Agent at the payments_*
        // tools served from /mcp on this app. APP_MCP_URL must be publicly
        // reachable (dev tunnel) because the Foundry Responses API enumerates
        // MCP tools from the cloud. When unset, the agent runs without the
        // tool surface and is handed the desk's pre-executed tool results.
        var configuredMcpUrl = app.Configuration["APP_MCP_URL"];
        ResponseTool? paymentsMcpTool = null;
        if (!string.IsNullOrWhiteSpace(configuredMcpUrl))
        {
            try
            {
                paymentsMcpTool = ResponseTool.CreateMcpTool(
                    serverLabel: CaldovaAgent.DefaultMcpServerLabel,
                    serverUri: new Uri($"{configuredMcpUrl.TrimEnd('/')}/mcp"),
                    toolCallApprovalPolicy: new McpToolCallApprovalPolicy(GlobalMcpToolCallApprovalPolicy.AlwaysRequireApproval));
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to construct the payments MCP tool descriptor; the Payments Agent will run without it.");
            }
        }
        else
        {
            logger.LogWarning("APP_MCP_URL is not configured; the Payments Agent will run without the payments_* MCP tool surface. Set APP_MCP_URL to a publicly reachable tunnel URL to enable it.");
        }

        List<ResponseTool>? BuildExtraTools() =>
            paymentsMcpTool is null ? null : new List<ResponseTool> { paymentsMcpTool };

        CaldovaAgent? TryCreateAgent(out string? error)
        {
            error = null;
            if (!factory.IsConfigured) return null;
            try
            {
                return factory.Create("payments", BuildExtraTools());
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Payments Agent could not be created; falling back to the deterministic demo result");
                error = ex.Message;
                return null;
            }
        }

        // ── Cases and default inputs ────────────────────────────────────

        app.MapGet("/payments/cases", () => Results.Ok(store.All().Select(r => new
        {
            caseNumber = r.CaseNumber,
            clientName = r.ClientName,
            requestType = r.RequestType,
            memberNumber = r.MemberNumber,
            product = r.Product,
            amount = r.Amount,
            sampleId = r.SampleId,
            priority = r.Priority,
            createdAt = r.CreatedAt
        })));

        app.MapGet("/payments/cases/{caseNumber}", (string caseNumber) =>
        {
            var record = store.Get(caseNumber);
            return record is null
                ? Results.NotFound(new { error = $"case '{caseNumber}' not found" })
                : Results.Ok(record);
        });

        // Deterministic, editable payment inputs for the case (step 2).
        app.MapGet("/payments/inputs/{caseNumber}", (string caseNumber) =>
        {
            var record = store.Get(caseNumber);
            if (record is null)
                return Results.NotFound(new { error = $"case '{caseNumber}' not found" });

            var profile = PaymentRules.ProfileFor(record);
            var current = paymentStore.CurrentForCase(record.CaseNumber);
            return Results.Ok(new
            {
                caseNumber = record.CaseNumber,
                sampleId = record.SampleId,
                profileId = profile.ProfileId,
                memberDisplay = profile.MemberDisplay,
                accountNumber = profile.AccountNumber,
                paymentType = profile.PaymentType,
                paymentTypes = Options(PaymentTypes.All),
                grossAmount = profile.GrossAmount,
                requestedAmount = profile.RequestedAmount,
                commencementAmount = profile.CommencementAmount,
                commencementDate = profile.CommencementDate,
                taxFreePercent = profile.TaxFreePercent,
                memberAge = profile.MemberAge,
                taxStatus = profile.TaxStatus,
                taxStatuses = Options(PaymentTaxStatuses.All),
                caseApprovalStatus = profile.CaseApprovalStatus,
                caseApprovalStatuses = Options(CaseApprovalStatuses.All),
                approvedAmount = profile.ApprovedAmount,
                caseApprovalNote = profile.CaseApprovalNote,
                caseDecidedBy = profile.CaseDecidedBy,
                caseRuleCited = profile.CaseRuleCited,
                paymentDate = profile.PaymentDate,
                payees = profile.Payees.Select(p => new
                {
                    name = p.Name,
                    bsb = p.Bsb,
                    account = p.Account,
                    sharePercent = p.SharePercent
                }),
                payeesOnFile = profile.PayeesOnFile.Select(p => new
                {
                    name = p.Name,
                    relationship = p.Relationship,
                    account = p.AccountLast4 is null ? null : "****" + p.AccountLast4
                }),
                hint = profile.InputsHint,
                currentApproval = current is null ? null : SerializeApproval(current, teamsService.IsConfigured, factory.IsConfigured)
            });
        });

        // ── Engage the Payments Agent ───────────────────────────────────
        //
        // The desk runs the deterministic maths and cross-checks and raises
        // the approval (posting the Teams card) BEFORE the agent runs, so the
        // panel always has a result and payments_requestApproval returns the
        // same approval id (one live approval per case). Send
        // `Accept: text/event-stream` to stream the agent's reply.
        app.MapPost("/payments/process", async (HttpContext httpContext, PaymentsProcessRequest request) =>
        {
            if (string.IsNullOrWhiteSpace(request.CaseNumber))
                return Results.BadRequest(new { error = "caseNumber is required" });

            var record = store.Get(request.CaseNumber.Trim());
            if (record is null)
                return Results.NotFound(new { error = $"case '{request.CaseNumber}' not found" });

            var run = BuildRun(record, request);
            var confirmationDraft = BuildConfirmationDraft(run);

            PaymentApprovalRecord? approval = null;
            TeamsCardSendResult? teamsResult = null;
            if (run.Flow == FlowInbound)
            {
                paymentStore.SupersedeOpenForCase(record.CaseNumber, "an invest-on-arrival instruction (no payment out)");
            }
            else
            {
                var approvalId = PaymentApprovalStore.NewApprovalId();
                paymentStore.SupersedeOpenForCase(record.CaseNumber, approvalId);
                approval = paymentStore.Add(CreateApprovalRecord(run, approvalId, confirmationDraft));
                if (run.Flow == FlowOutbound)
                {
                    teamsResult = await teamsService.SendApprovalCardCoreAsync(BuildTeamsRequest(run, approval));
                    approval.TeamsSent = teamsResult.Sent;
                    approval.TeamsChannel = teamsResult.Channel;
                    approval.TeamsMessage = teamsResult.Message;
                    approval.ApprovalUrl = teamsResult.ApprovalUrl;
                }
            }

            var mockMode = paymentsMcpTool is null;
            var deskToolCalls = BuildDeskToolCalls(run, approval, teamsResult);
            var prompt = BuildPrompt(run, approval, mockMode ? deskToolCalls : null);

            logger.LogInformation(
                "Payments process: case={CaseNumber} flow={Flow} gross={Gross} net={Net} approvalId={ApprovalId}",
                Sanitize(record.CaseNumber), run.Flow, run.TotalGross, run.TotalNet, Sanitize(approval?.ApprovalId ?? "-"));

            string? createError = null;

            object BuildEnvelope(AgentTraceResult? trace, string? agentError)
            {
                var error = agentError ?? createError;

                // Capture the response id so the approval popup can resume
                // this conversation and let the agent release the payment.
                if (approval is not null && trace?.ResponseId is { Length: > 0 } responseId)
                    approval.PreviousResponseId = responseId;

                var liveText = trace?.Text;
                var deterministic = string.IsNullOrWhiteSpace(liveText);
                return new
                {
                    caseNumber = record.CaseNumber,
                    clientName = record.ClientName,
                    memberNumber = record.MemberNumber,
                    memberDisplay = run.Profile.MemberDisplay,
                    accountNumber = run.Profile.AccountNumber,
                    product = record.Product,
                    requestType = record.RequestType,
                    sampleId = record.SampleId,
                    flow = run.Flow,
                    paymentType = run.PaymentType,
                    paymentTypeLabel = PaymentTypes.Label(run.PaymentType),
                    inputs = BuildInputsView(run),
                    calculation = BuildCalculationView(run),
                    contextRows = BuildContextRows(run),
                    crossChecks = BuildCrossChecks(run),
                    totals = new
                    {
                        gross = run.TotalGross,
                        taxFree = run.TotalTaxFree,
                        taxable = run.TotalTaxable,
                        taxWithheld = run.TotalWithheld,
                        net = run.TotalNet,
                        grossFormatted = Fmt(run.TotalGross),
                        taxWithheldFormatted = Fmt(run.TotalWithheld),
                        netFormatted = Fmt(run.TotalNet)
                    },
                    humanApprovalRequired = run.Flow != FlowInbound && (run.Authority.Required || run.Flow == FlowBlocked),
                    humanApprovalReasons = ApprovalReasons(run),
                    humanApprovalReason = ApprovalReasonText(run),
                    approver = run.Flow == FlowInbound ? null : run.Authority.Approver,
                    releaseAllowed = run.Flow == FlowOutbound,
                    releaseBlockedReason = ReleaseBlockedReason(run),
                    confirmationTitle = run.Flow switch
                    {
                        FlowBlocked => "Internal confirmation — funds protected",
                        FlowInbound => "Investment confirmation draft",
                        _ => "Payment confirmation draft"
                    },
                    paymentConfirmation = PaymentRules.RenderConfirmation(confirmationDraft, approval),
                    agentNotes = deterministic ? BuildDeterministicNarrative(run, approval, teamsResult, factory.IsConfigured, error) : liveText,
                    narrativeSource = deterministic ? "deterministic" : "agent",
                    agentConfigured = factory.IsConfigured,
                    agentError = error,
                    agentInput = trace?.Input,
                    agentRawOutput = BuildRawOutput(trace, mockMode, deskToolCalls),
                    paymentApproval = approval is null ? null : SerializeApproval(approval, teamsService.IsConfigured, factory.IsConfigured),
                    mcpConfigured = paymentsMcpTool is not null
                };
            }

            if (AgentSseStreaming.WantsEventStream(httpContext))
            {
                var streamingAgent = TryCreateAgent(out createError);
                await AgentSseStreaming.StreamAsync(httpContext, streamingAgent, prompt, BuildEnvelope, logger, "Payments Agent");
                return Results.Empty;
            }

            AgentTraceResult? traceResult = null;
            string? invocationError = null;
            var agent = TryCreateAgent(out createError);
            if (agent is not null)
            {
                try
                {
                    traceResult = await agent.RunWithTraceAsync(prompt);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Payments Agent invocation failed; falling back to the deterministic demo result");
                    invocationError = ex.Message;
                }
            }

            return Results.Ok(BuildEnvelope(traceResult, invocationError));
        });

        // ── Payment approvals (status, Teams fallback, release) ─────────

        app.MapGet("/payments/approvals", (string? caseNumber) =>
        {
            var records = string.IsNullOrWhiteSpace(caseNumber)
                ? paymentStore.All()
                : paymentStore.ForCase(caseNumber);
            return Results.Ok(records.Select(r => SerializeApproval(r, teamsService.IsConfigured, factory.IsConfigured)));
        });

        app.MapGet("/payments/approvals/{approvalId}", (string approvalId) =>
        {
            var record = paymentStore.Get(approvalId);
            return record is null
                ? Results.NotFound(new { error = $"approval '{approvalId}' not found" })
                : Results.Ok(SerializeApproval(record, teamsService.IsConfigured, factory.IsConfigured));
        });

        // In-page stand-in for the Approve / Reject buttons on the Teams card.
        app.MapPost("/payments/approvals/{approvalId}/approve", (string approvalId, PaymentsDecisionRequest? body) =>
        {
            var result = paymentStore.Approve(approvalId, body?.DecidedBy, body?.Comment);
            if (result.Ok)
            {
                logger.LogInformation("Payment approval granted: {ApprovalId} by {By}",
                    Sanitize(approvalId), Sanitize(result.Record!.DecidedBy ?? string.Empty));
            }
            return ToResult(result, teamsService.IsConfigured, factory.IsConfigured);
        });

        app.MapPost("/payments/approvals/{approvalId}/reject", (string approvalId, PaymentsDecisionRequest? body) =>
        {
            var result = paymentStore.Reject(approvalId, body?.DecidedBy, body?.Comment);
            if (result.Ok)
            {
                logger.LogInformation("Payment approval rejected: {ApprovalId} by {By}",
                    Sanitize(approvalId), Sanitize(result.Record!.DecidedBy ?? string.Empty));
            }
            return ToResult(result, teamsService.IsConfigured, factory.IsConfigured);
        });

        // Release — refuses unless the approval is Approved.
        app.MapPost("/payments/approvals/{approvalId}/release", (string approvalId) =>
        {
            var result = paymentStore.Release(approvalId);
            if (result.Ok)
            {
                logger.LogInformation("Payment released: {ApprovalId} ref={Reference}",
                    Sanitize(approvalId), Sanitize(result.Record!.PaymentReference ?? string.Empty));
            }
            return ToResult(result, teamsService.IsConfigured, factory.IsConfigured);
        });

        // Approval popup: record the approval, then resume the same Payments
        // Agent conversation (response id captured by /payments/process) so
        // the agent calls payments_releasePayment over MCP. Without the MCP
        // surface the desk releases first and hands the agent the tool result.
        app.MapPost("/payments/approvals/{approvalId}/agent-approve", async (string approvalId, PaymentsDecisionRequest? body) =>
        {
            var decision = paymentStore.Approve(approvalId, body?.DecidedBy, body?.Comment);
            if (!decision.Ok)
                return ToResult(decision, teamsService.IsConfigured, factory.IsConfigured);

            var record = decision.Record!;
            logger.LogInformation("Payment popup approval granted: {ApprovalId} by {By}",
                Sanitize(record.ApprovalId), Sanitize(record.DecidedBy ?? string.Empty));

            string? agentNarrative = null;
            string? agentError = null;
            string? agentResponseId = null;
            var resumeAttempted = !string.IsNullOrWhiteSpace(record.PreviousResponseId) && factory.IsConfigured;

            if (resumeAttempted)
            {
                try
                {
                    var agent = factory.Create("payments", BuildExtraTools());

                    string? mockReleaseBlock = null;
                    if (paymentsMcpTool is null)
                    {
                        var released = paymentStore.Release(record.ApprovalId);
                        logger.LogInformation("Payment released by the desk for the agent (no MCP surface): {ApprovalId}",
                            Sanitize(record.ApprovalId));
                        mockReleaseBlock =
                            "MOCK MCP TOOL RESULT\n" +
                            "====================\n" +
                            "Note: APP_MCP_URL is not configured. payments_releasePayment has been executed locally by the " +
                            "Payments desk with the following result; treat it as authoritative.\n\n" +
                            "payments_releasePayment →\n" +
                            PaymentsMcpTools.ToJson(PaymentsMcpTools.ReleasePayload(released)) + "\n\n";
                    }

                    var releaseInstruction = mockReleaseBlock is null
                        ? $"Please now call the payments_releasePayment MCP tool with approvalId='{record.ApprovalId}' to release the payment, " +
                          "then briefly summarise the outcome: release status, payment reference(s), tax remitted to the ATO and what the member will see next."
                        : "payments_releasePayment has ALREADY been executed for this run (see the MOCK MCP TOOL RESULT above) — do NOT call it " +
                          "again and do NOT say the tool is unavailable. Treat the result as authoritative and briefly summarise the outcome: " +
                          "release status, payment reference(s), tax remitted to the ATO and what the member will see next.";

                    var resumeMessage =
                        "HUMAN APPROVAL DECISION\n" +
                        "=======================\n" +
                        "The approver has APPROVED the payment release in Microsoft Teams.\n" +
                        $"Approval id: {record.ApprovalId}\n" +
                        $"Approved by: {record.DecidedBy}\n" +
                        $"Approved at: {record.DecidedAt:O}\n" +
                        (string.IsNullOrWhiteSpace(record.DecisionComment) ? string.Empty : $"Approver comment: {record.DecisionComment}\n") +
                        $"Case: {record.CaseNumber} — {record.MemberDisplay}\n" +
                        $"Payment: {PaymentTypes.Label(record.PaymentType)} — gross {Fmt(record.GrossAmount)}, tax withheld {Fmt(record.TaxWithheld)}, net {Fmt(record.NetAmount)}\n" +
                        $"Payee(s): {string.Join("; ", record.Payees.Select(p => $"{p.Name} ({p.MaskedAccount}) {Fmt(p.NetAmount)} net"))}\n\n" +
                        (mockReleaseBlock ?? string.Empty) +
                        releaseInstruction;

                    var trace = await agent.ChatWithTraceAsync(record.PreviousResponseId!, resumeMessage);
                    agentNarrative = trace.Text;
                    agentResponseId = trace.ResponseId;
                    record.AgentResumeNotes = trace.Text;
                    if (!string.IsNullOrEmpty(trace.ResponseId))
                        record.PreviousResponseId = trace.ResponseId;
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Payments Agent resume after approval failed for {ApprovalId}", Sanitize(record.ApprovalId));
                    agentError = ex.Message;
                }
            }

            // Re-read: the agent's MCP call may have released the payment.
            var refreshed = paymentStore.Get(approvalId) ?? record;
            return Results.Ok(new
            {
                approval = SerializeApproval(refreshed, teamsService.IsConfigured, factory.IsConfigured),
                agentConfigured = factory.IsConfigured,
                agentResumeAttempted = resumeAttempted,
                agentNarrative,
                agentResponseId,
                agentError
            });
        });
    }

    // ── The payment run: effective inputs + deterministic results ──────

    private sealed record PayeeRun(
        string Name,
        string Bsb,
        string Account,
        string MaskedAccount,
        decimal SharePercent,
        BenefitCalculation Calc,
        PayeeValidationResult Validation);

    private sealed class PaymentRun
    {
        public required CaseRecord Case { get; init; }
        public required PaymentCaseProfile Profile { get; init; }
        public required string PaymentType { get; init; }
        public required decimal GrossAmount { get; init; }
        public decimal? RequestedAmount { get; init; }
        public decimal? CommencementAmount { get; init; }
        public required decimal TaxFreePercent { get; init; }
        public int? MemberAge { get; init; }
        public required string TaxStatus { get; init; }
        public required string PaymentDate { get; init; }
        public required IReadOnlyList<PayeeRun> Payees { get; init; }
        public required CaseApprovalCheckResult CaseCheck { get; init; }
        public required AuthorityCheckResult Authority { get; init; }
        public required string Flow { get; init; }

        public decimal TotalGross => Payees.Count == 0 ? GrossAmount : Payees.Sum(p => p.Calc.GrossAmount);
        public decimal TotalTaxFree => Payees.Sum(p => p.Calc.TaxFreeComponent);
        public decimal TotalTaxable => Payees.Sum(p => p.Calc.TaxableComponent);
        public decimal TotalWithheld => Payees.Sum(p => p.Calc.TaxWithheld);
        public decimal TotalNet => Payees.Count == 0 ? GrossAmount : Payees.Sum(p => p.Calc.NetAmount);
        public bool AllPayeesMatch => Payees.All(p => p.Validation.Match);
        public decimal LargestPayment => Payees.Count == 0 ? GrossAmount : Payees.Max(p => p.Calc.GrossAmount);
    }

    private static PaymentRun BuildRun(CaseRecord record, PaymentsProcessRequest? request)
    {
        var profile = PaymentRules.ProfileFor(record);
        var type = PaymentTypes.Normalize(string.IsNullOrWhiteSpace(request?.PaymentType) ? profile.PaymentType : request.PaymentType);
        var gross = PaymentRules.Round2(Math.Max(0m, request?.GrossAmount ?? profile.GrossAmount));
        var requested = request?.RequestedAmount ?? profile.RequestedAmount;
        var commencement = type == PaymentTypes.Pension ? request?.CommencementAmount ?? profile.CommencementAmount : null;
        var taxFreePercent = Math.Clamp(request?.TaxFreePercent ?? profile.TaxFreePercent, 0m, 100m);
        var taxStatus = type == PaymentTypes.Inbound
            ? PaymentTaxStatuses.NotApplicable
            : PaymentTaxStatuses.Normalize(string.IsNullOrWhiteSpace(request?.TaxStatus) ? profile.TaxStatus : request.TaxStatus);
        var caseStatus = string.IsNullOrWhiteSpace(request?.CaseApprovalStatus) ? profile.CaseApprovalStatus : request.CaseApprovalStatus;
        var approved = request?.ApprovedAmount ?? profile.ApprovedAmount;
        var paymentDate = string.IsNullOrWhiteSpace(request?.PaymentDate) ? profile.PaymentDate : request.PaymentDate.Trim();

        // Payees: the confirmed rows, or the case defaults. Inbound money has none.
        var payeeInputs = new List<(string Name, string Bsb, string Account, decimal? Share)>();
        if (type != PaymentTypes.Inbound)
        {
            if (request?.Payees is { } rows)
            {
                payeeInputs.AddRange(rows
                    .Where(p => !string.IsNullOrWhiteSpace(p.Name))
                    .Select(p => (p.Name!.Trim(), p.Bsb ?? string.Empty, p.Account ?? string.Empty, p.SharePercent)));
            }
            if (payeeInputs.Count == 0)
            {
                payeeInputs.AddRange(profile.Payees.Select(p => (p.Name, p.Bsb, p.Account, (decimal?)p.SharePercent)));
            }
            if (payeeInputs.Count == 0)
            {
                payeeInputs.Add((record.ClientName, string.Empty, string.Empty, 100m));
            }
        }

        var shares = NormalizeShares(payeeInputs.Select(p => p.Share).ToList());
        var payees = new List<PayeeRun>();
        var allocated = 0m;
        for (var i = 0; i < payeeInputs.Count; i++)
        {
            var input = payeeInputs[i];
            var payeeGross = i == payeeInputs.Count - 1
                ? gross - allocated
                : PaymentRules.Round2(gross * shares[i] / 100m);
            allocated += payeeGross;
            var calc = PaymentRules.Calculate(payeeGross, taxFreePercent, taxStatus);
            var validation = PaymentRules.ValidatePayee(profile, input.Name, input.Bsb, input.Account);
            payees.Add(new PayeeRun(input.Name, input.Bsb, input.Account, validation.MaskedAccount, PaymentRules.Round2(shares[i]), calc, validation));
        }

        var amountToCheck = type == PaymentTypes.Pension ? commencement ?? gross : gross;
        var caseCheck = PaymentRules.CheckCaseApproval(profile, caseStatus, approved, amountToCheck);
        var largest = payees.Count == 0 ? gross : payees.Max(p => p.Calc.GrossAmount);
        var authority = PaymentRules.CheckAuthority(
            type,
            largest,
            commencement,
            payeeMismatch: payees.Any(p => !p.Validation.Match),
            caseBlocked: caseCheck.Status == CaseApprovalStatuses.Blocked);

        var flow = type == PaymentTypes.Inbound
            ? FlowInbound
            : caseCheck.Payable ? FlowOutbound : FlowBlocked;

        return new PaymentRun
        {
            Case = record,
            Profile = profile,
            PaymentType = type,
            GrossAmount = gross,
            RequestedAmount = requested,
            CommencementAmount = commencement,
            TaxFreePercent = taxFreePercent,
            MemberAge = request?.MemberAge ?? profile.MemberAge,
            TaxStatus = taxStatus,
            PaymentDate = paymentDate,
            Payees = payees,
            CaseCheck = caseCheck,
            Authority = authority,
            Flow = flow
        };
    }

    private static List<decimal> NormalizeShares(IReadOnlyList<decimal?> raw)
    {
        if (raw.Count == 0) return new List<decimal>();
        if (raw.Count == 1) return new List<decimal> { 100m };
        var values = raw.Select(v => Math.Max(0m, v ?? 0m)).ToList();
        var sum = values.Sum();
        return sum <= 0m
            ? Enumerable.Repeat(100m / raw.Count, raw.Count).ToList()
            : values.Select(v => v * 100m / sum).ToList();
    }

    // ── Views for the page ──────────────────────────────────────────────

    private static object BuildInputsView(PaymentRun run) => new
    {
        paymentType = run.PaymentType,
        paymentTypeLabel = PaymentTypes.Label(run.PaymentType),
        grossAmount = run.GrossAmount,
        requestedAmount = run.RequestedAmount,
        commencementAmount = run.CommencementAmount,
        taxFreePercent = run.TaxFreePercent,
        memberAge = run.MemberAge,
        taxStatus = run.TaxStatus,
        taxStatusLabel = PaymentTaxStatuses.Label(run.TaxStatus),
        withholdingRateLabel = PaymentTaxStatuses.RateLabel(run.TaxStatus),
        caseApprovalStatus = run.CaseCheck.Status,
        caseApprovalStatusLabel = run.CaseCheck.StatusLabel,
        approvedAmount = run.CaseCheck.ApprovedAmount,
        paymentDate = run.PaymentDate,
        payees = run.Payees.Select(p => new
        {
            name = p.Name,
            account = p.MaskedAccount,
            sharePercent = p.SharePercent
        })
    };

    private static object CalcRow(string label, string kind, IEnumerable<decimal> values)
    {
        var list = values.ToArray();
        return new { label, kind, values = list, display = list.Select(Fmt).ToArray() };
    }

    private static object BuildCalculationView(PaymentRun run)
    {
        var p = run.Profile;
        if (run.Flow == FlowInbound)
        {
            var (cash, invest) = InboundSplit(run.GrossAmount);
            var option = p.InvestmentOption ?? "the member's chosen investment option";
            return new
            {
                mode = "inbound",
                title = "Invest on arrival",
                columns = new[] { "Amount" },
                rows = new[]
                {
                    CalcRow("Rollover expected (approx.)", "gross", [run.GrossAmount]),
                    CalcRow($"Kept in the Caldova Cash Account ({Pct(PaymentRules.CashAccountMinimumPercent)})", "hold", [cash]),
                    CalcRow($"Invested in {option}", "total", [invest])
                },
                netLabel = "Invested on arrival",
                netDisplay = $"{Fmt(invest)} into {option}",
                ruleCited = p.CaseRuleCited
            };
        }

        if (run.Flow == FlowBlocked)
        {
            var protectedFunds = run.CaseCheck.Status == CaseApprovalStatuses.Blocked;
            return new
            {
                mode = "protected",
                title = protectedFunds ? "Funds protected — no payment released" : "No payment released",
                columns = new[] { "Amount" },
                rows = new[]
                {
                    CalcRow($"{PaymentTypes.Label(run.PaymentType)} requested", "gross", [run.TotalGross]),
                    CalcRow("Released", "deduct", [0m]),
                    CalcRow($"Stays in {p.AccountNumber}", "total", [run.TotalGross])
                },
                netLabel = protectedFunds ? "Funds protected" : "Nothing released",
                netDisplay = $"{Fmt(run.TotalGross)} stays in {p.AccountNumber}",
                ruleCited = run.CaseCheck.RuleCited
            };
        }

        var isPension = run.PaymentType == PaymentTypes.Pension;
        var multi = run.Payees.Count > 1;
        var nets = run.Payees.Select(x => x.Calc.NetAmount).ToList();
        var netDisplay = nets.Count switch
        {
            0 => Fmt(0m),
            1 => Fmt(nets[0]) + (isPension ? " a month" : string.Empty),
            _ => nets.Distinct().Count() == 1
                ? $"{Fmt(nets[0])} each ({Fmt(nets.Sum())} in total)"
                : string.Join(" · ", run.Payees.Select(x => $"{x.Name} {Fmt(x.Calc.NetAmount)}"))
        };

        return new
        {
            mode = "payment",
            title = "Payment calculation",
            columns = run.Payees.Select(x => x.Name).ToArray(),
            rows = new[]
            {
                CalcRow(isPension ? "Gross payment (monthly)" : multi ? "Gross amount (share)" : "Gross amount", "gross",
                    run.Payees.Select(x => x.Calc.GrossAmount)),
                CalcRow($"Tax-free component ({Pct(run.TaxFreePercent)})", "component",
                    run.Payees.Select(x => x.Calc.TaxFreeComponent)),
                CalcRow("Taxable component (taxed element)", "component",
                    run.Payees.Select(x => x.Calc.TaxableComponent)),
                CalcRow($"PAYG withholding — {PaymentTaxStatuses.RateLabel(run.TaxStatus)}", "deduct",
                    run.Payees.Select(x => x.Calc.TaxWithheld)),
                CalcRow(isPension ? "Net payment (monthly)" : "Net payment", "total",
                    run.Payees.Select(x => x.Calc.NetAmount))
            },
            netLabel = multi ? "Net payment to each payee" : isPension ? "Net pension payment" : "Net payment",
            netDisplay,
            ruleCited = PaymentRules.TaxRuleTitle
        };
    }

    private static List<object> BuildContextRows(PaymentRun run)
    {
        var p = run.Profile;
        var rows = new List<object>();
        void Add(string label, string value) => rows.Add(new { label, value });

        switch (run.Flow)
        {
            case FlowOutbound:
                if (run.RequestedAmount is { } requested && requested != run.GrossAmount
                    && run.PaymentType is PaymentTypes.Hardship or PaymentTypes.LumpSum)
                {
                    Add("Amount requested", run.PaymentType == PaymentTypes.Hardship && requested > PaymentRules.HardshipMaximum && run.GrossAmount >= PaymentRules.HardshipMaximum
                        ? $"{Fmt(requested)} — {Fmt(run.GrossAmount)} approved (the hardship maximum in any 12 months)"
                        : $"{Fmt(requested)} — {Fmt(run.GrossAmount)} approved");
                }
                if (run.PaymentType == PaymentTypes.DeathBenefit)
                {
                    Add("Total benefit", $"{Fmt(run.TotalGross)} from {p.AccountNumber}, split " +
                        string.Join(" / ", run.Payees.Select(x => $"{x.Name} {Pct(x.SharePercent)}")));
                }
                if (run.PaymentType == PaymentTypes.Pension)
                {
                    if (run.CommencementAmount is { } commencement)
                        Add("Pension commencement", $"{Fmt(commencement)} into {p.AccountNumber}" + (p.CommencementDate is { } date ? $" on {date}" : string.Empty));
                    var annual = run.GrossAmount * 12m;
                    Add("Income", $"{Fmt(run.GrossAmount)} a month ({Fmt(annual)} a year)");
                    if (p.MinimumDrawdown is { } minimum)
                    {
                        Add("Minimum drawdown 2026-27 (pro-rated)", annual >= minimum
                            ? $"{Fmt(minimum)} — {Fmt(annual)} a year is above it ✓"
                            : $"{Fmt(minimum)} — {Fmt(annual)} a year is below it ✗ (increase the payment)");
                    }
                }
                if (run.TotalWithheld > 0m)
                    Add("PAYG withheld — remitted to the ATO", Fmt(run.TotalWithheld));
                if (run.Payees.Count > 1)
                    Add("Total paid to the payees", Fmt(run.TotalNet));
                Add("Payment date", run.PaymentDate);
                if (p.BalanceBefore is { } balance && run.PaymentType is PaymentTypes.Hardship or PaymentTypes.LumpSum)
                    Add("Balance after payment", $"about {Fmt(Math.Max(0m, balance - run.TotalGross))} (from {Fmt(balance)})");
                break;

            case FlowBlocked:
                Add("Request", $"{PaymentTypes.Label(run.PaymentType)} of {Fmt(run.TotalGross)} to {PayeeNames(run)}");
                Add("Released", "$0 — the outbound instruction is cancelled");
                Add("Stays in the account", $"{Fmt(run.TotalGross)} in {p.AccountNumber}");
                break;

            case FlowInbound:
                Add("Timing", run.PaymentDate);
                break;
        }

        if (run.PaymentType == p.PaymentType)
        {
            foreach (var line in p.ExtraContext)
                Add(line.Label, line.Value);
        }
        return rows;
    }

    private static List<object> BuildCrossChecks(PaymentRun run)
    {
        var checks = new List<object>();

        if (run.Flow == FlowInbound)
        {
            checks.Add(new
            {
                key = "payee",
                label = "Payee match",
                status = "na",
                value = "Not applicable",
                detail = "No payee — the money is coming into the member's own Caldova account.",
                source = (string?)null
            });
        }
        else
        {
            checks.Add(new
            {
                key = "payee",
                label = "Payee match",
                status = run.AllPayeesMatch ? "pass" : "fail",
                value = run.AllPayeesMatch ? "Match" : "Mismatch",
                detail = string.Join(" ", run.Payees.Select(x => run.Payees.Count > 1 ? $"{x.Name}: {x.Validation.Note}" : x.Validation.Note)),
                source = (string?)"payments_validatePayee"
            });
        }

        var approvedText = run.CaseCheck.ApprovedAmount is { } approved && run.CaseCheck.Status is CaseApprovalStatuses.Approved or CaseApprovalStatuses.Partial
            ? $" — {Fmt(approved)}"
            : string.Empty;
        checks.Add(new
        {
            key = "case",
            label = "Case approval (Benefits & Eligibility)",
            status = run.CaseCheck.Payable ? "pass" : "fail",
            value = run.CaseCheck.StatusLabel + approvedText,
            detail = run.CaseCheck.Note,
            source = (string?)$"{run.CaseCheck.DecidedBy} · {run.CaseCheck.RuleCited}"
        });

        checks.Add(new
        {
            key = "authority",
            label = "Authority limit",
            status = run.Flow == FlowInbound || !run.Authority.Required ? "pass" : "warn",
            value = run.Flow == FlowInbound
                ? "No approval needed"
                : run.Authority.Required ? "Team Leader approval required" : "Within Payments Officer authority",
            detail = run.Authority.Required ? string.Join(" ", run.Authority.Reasons) : run.Authority.Note,
            source = (string?)PaymentRules.AuthorityRuleTitle
        });

        return checks;
    }

    private static IReadOnlyList<string> ApprovalReasons(PaymentRun run) => run.Flow switch
    {
        FlowInbound => Array.Empty<string>(),
        FlowBlocked when run.CaseCheck.Status == CaseApprovalStatuses.Blocked => run.Authority.Reasons,
        FlowBlocked => new[] { run.CaseCheck.Note }.Concat(run.Authority.Reasons).Distinct().ToList(),
        _ => run.Authority.Reasons
    };

    private static string ApprovalReasonText(PaymentRun run) => run.Flow switch
    {
        FlowInbound => "No release approval needed — no money leaves Caldova. Incoming money is invested under the member's standing instructions.",
        FlowBlocked => $"No payment can be released. {run.CaseCheck.Note}",
        _ => run.Authority.Required
            ? string.Join(" ", run.Authority.Reasons)
            : "Within the Payments Officer's authority — Penny signs off before release."
    };

    private static string? ReleaseBlockedReason(PaymentRun run)
    {
        if (run.Flow == FlowInbound)
            return "Nothing to release — no money leaves Caldova on this case.";
        if (run.Flow != FlowBlocked)
            return null;

        var why = run.CaseCheck.Status switch
        {
            CaseApprovalStatuses.Blocked => "the case is blocked by Financial Crime",
            CaseApprovalStatuses.Declined => "the request was declined",
            CaseApprovalStatuses.Pending => "the eligibility decision is still pending",
            CaseApprovalStatuses.NotApplicable => "there is no payment out on this case",
            _ => "the amount is more than Benefits & Eligibility approved"
        };
        if (!run.AllPayeesMatch)
            why += " and the payee doesn't match the member or a nominated beneficiary";
        return run.CaseCheck.Status == CaseApprovalStatuses.Blocked
            ? $"Release disabled — {why}. {Fmt(run.TotalGross)} stays in {run.Profile.AccountNumber}."
            : $"Release disabled — {why}. Nothing leaves {run.Profile.AccountNumber} until this is resolved.";
    }

    private static (decimal Cash, decimal Invest) InboundSplit(decimal gross)
    {
        var cash = PaymentRules.Round2(gross * PaymentRules.CashAccountMinimumPercent / 100m);
        return (cash, gross - cash);
    }

    private static string PayeeNames(PaymentRun run) =>
        run.Payees.Count switch
        {
            0 => "no payee",
            1 => run.Payees[0].Name,
            _ => string.Join(" & ", run.Payees.Select(p => p.Name))
        };

    // ── Approval record + Teams card ────────────────────────────────────

    private static PaymentApprovalRecord CreateApprovalRecord(PaymentRun run, string approvalId, string confirmationDraft)
    {
        var blocked = run.Flow == FlowBlocked;
        return new PaymentApprovalRecord
        {
            ApprovalId = approvalId,
            CaseNumber = run.Case.CaseNumber,
            ClientName = run.Case.ClientName,
            MemberNumber = run.Case.MemberNumber,
            MemberDisplay = run.Profile.MemberDisplay,
            PaymentType = run.PaymentType,
            GrossAmount = run.TotalGross,
            TaxWithheld = run.TotalWithheld,
            NetAmount = run.TotalNet,
            CommencementAmount = run.CommencementAmount,
            PayeeName = PayeeNames(run),
            PayeeAccount = string.Join("; ", run.Payees.Select(p => run.Payees.Count > 1 ? $"{p.Name} {p.MaskedAccount}" : p.MaskedAccount)),
            Payees = run.Payees.Select(p => new PaymentPayeeLine
            {
                Name = p.Name,
                MaskedAccount = p.MaskedAccount,
                SharePercent = p.SharePercent,
                GrossAmount = p.Calc.GrossAmount,
                TaxWithheld = p.Calc.TaxWithheld,
                NetAmount = p.Calc.NetAmount,
                PayeeMatches = p.Validation.Match
            }).ToList(),
            PaymentDate = run.PaymentDate,
            Reason = ApprovalReasonText(run),
            ApprovalReasons = ApprovalReasons(run),
            Approver = run.Authority.Approver,
            RaisedBy = PaymentRules.RaisedByDesk,
            CaseApprovalStatus = run.CaseCheck.Status,
            ApprovedAmount = run.CaseCheck.ApprovedAmount,
            ConfirmationDraft = confirmationDraft,
            Status = blocked ? PaymentApprovalStatus.Blocked : PaymentApprovalStatus.Pending,
            Decision = blocked ? "blocked" : null,
            DecidedBy = blocked ? run.CaseCheck.DecidedBy : null,
            DecidedAt = blocked ? DateTimeOffset.UtcNow : null,
            TeamsMessage = blocked
                ? "No approval card raised — the case is blocked, so there is nothing to approve or release."
                : null
        };
    }

    private static TeamsApprovalCardRequest BuildTeamsRequest(PaymentRun run, PaymentApprovalRecord approval)
    {
        var multi = run.Payees.Count > 1;
        var paymentType = PaymentTypes.Label(run.PaymentType);
        if (run.PaymentType == PaymentTypes.Pension && run.CommencementAmount is { } commencement)
        {
            paymentType = $"Pension commencement — {Fmt(commencement)} into {run.Profile.AccountNumber}"
                + (run.Profile.CommencementDate is { } date ? $" on {date}" : string.Empty)
                + $"; regular payment {Fmt(run.GrossAmount)} a month";
        }
        else if (multi)
        {
            paymentType += $" — {run.Payees.Count} payees";
        }

        return new TeamsApprovalCardRequest(
            ApprovalId: approval.ApprovalId,
            CaseNumber: approval.CaseNumber,
            MemberName: approval.MemberDisplay,
            PaymentType: paymentType,
            GrossAmount: approval.GrossAmount,
            TaxWithheld: approval.TaxWithheld,
            NetAmount: approval.NetAmount,
            PayeeName: multi
                ? string.Join(" · ", run.Payees.Select(p => $"{p.Name} ({p.MaskedAccount}) {Fmt(p.Calc.NetAmount)} net"))
                : approval.PayeeName,
            PayeeAccount: multi ? null : approval.PayeeAccount,
            Reason: approval.Reason,
            PaymentDate: approval.PaymentDate);
    }

    private static object SerializeApproval(PaymentApprovalRecord r, bool teamsConfigured, bool agentConfigured) => new
    {
        approvalId = r.ApprovalId,
        caseNumber = r.CaseNumber,
        clientName = r.ClientName,
        memberNumber = r.MemberNumber,
        memberDisplay = r.MemberDisplay,
        paymentType = r.PaymentType,
        paymentTypeLabel = PaymentTypes.Label(r.PaymentType),
        grossAmount = r.GrossAmount,
        taxWithheld = r.TaxWithheld,
        netAmount = r.NetAmount,
        commencementAmount = r.CommencementAmount,
        grossFormatted = Fmt(r.GrossAmount),
        taxWithheldFormatted = Fmt(r.TaxWithheld),
        netFormatted = Fmt(r.NetAmount),
        commencementFormatted = r.CommencementAmount is { } c ? Fmt(c) : null,
        payeeName = r.PayeeName,
        payeeAccount = r.PayeeAccount,
        payees = r.Payees.Select(p => new
        {
            name = p.Name,
            account = p.MaskedAccount,
            sharePercent = p.SharePercent,
            grossAmount = p.GrossAmount,
            taxWithheld = p.TaxWithheld,
            netAmount = p.NetAmount,
            grossFormatted = Fmt(p.GrossAmount),
            taxWithheldFormatted = Fmt(p.TaxWithheld),
            netFormatted = Fmt(p.NetAmount),
            payeeMatches = p.PayeeMatches,
            paymentReference = p.PaymentReference
        }),
        paymentDate = r.PaymentDate,
        reason = r.Reason,
        approvalReasons = r.ApprovalReasons,
        approver = r.Approver,
        raisedBy = r.RaisedBy,
        caseApprovalStatus = r.CaseApprovalStatus,
        status = r.StatusKey,
        decision = r.Decision,
        decidedBy = r.DecidedBy,
        decidedAt = r.DecidedAt,
        decisionComment = r.DecisionComment,
        paymentReference = r.PaymentReference,
        releasedAt = r.ReleasedAt,
        canRelease = r.Status == PaymentApprovalStatus.Approved,
        teamsSent = r.TeamsSent,
        teamsChannel = r.TeamsChannel,
        teamsMessage = r.TeamsMessage,
        teamsConfigured,
        approvalUrl = r.ApprovalUrl,
        confirmationDraft = PaymentRules.RenderConfirmation(r.ConfirmationDraft, r),
        previousResponseId = r.PreviousResponseId,
        agentResumeAvailable = agentConfigured && !string.IsNullOrWhiteSpace(r.PreviousResponseId),
        agentResumeNotes = r.AgentResumeNotes,
        createdAt = r.CreatedAt
    };

    private static IResult ToResult(PaymentTransitionResult result, bool teamsConfigured, bool agentConfigured)
    {
        if (result.Ok)
            return Results.Ok(SerializeApproval(result.Record!, teamsConfigured, agentConfigured));
        if (result.Record is null)
            return Results.NotFound(new { error = result.Error });
        return Results.Conflict(new
        {
            error = result.Error,
            approval = SerializeApproval(result.Record, teamsConfigured, agentConfigured)
        });
    }

    private static IEnumerable<object> Options(IEnumerable<PaymentOption> options) =>
        options.Select(o => new { key = o.Key, label = o.Label });

    // ── Desk tool calls (the payments_* MCP tools run deterministically) ─

    private sealed record DeskToolCall(string Tool, object Arguments, object Result, object? AdaptiveCard = null);

    private static List<DeskToolCall> BuildDeskToolCalls(PaymentRun run, PaymentApprovalRecord? approval, TeamsCardSendResult? teamsResult)
    {
        var c = run.Case;
        var calls = new List<DeskToolCall>();

        foreach (var payee in run.Payees)
        {
            calls.Add(new DeskToolCall(
                "payments_validatePayee",
                new { caseNumber = c.CaseNumber, payeeName = payee.Name, bsb = PaymentRules.MaskBsb(payee.Bsb), accountNumber = PaymentRules.MaskAccount(payee.Account) },
                PaymentsMcpTools.ValidatePayeePayload(c.CaseNumber, run.Profile.MemberDisplay, payee.Validation)));
        }

        calls.Add(new DeskToolCall(
            "payments_checkCaseApproval",
            new { caseNumber = c.CaseNumber, grossAmount = run.CaseCheck.AmountChecked },
            PaymentsMcpTools.CheckCaseApprovalPayload(c, run.CaseCheck)));

        if (run.Flow == FlowOutbound)
        {
            foreach (var payee in run.Payees)
            {
                calls.Add(new DeskToolCall(
                    "payments_calculateBenefit",
                    new { grossAmount = payee.Calc.GrossAmount, taxFreePercent = run.TaxFreePercent, taxStatus = run.TaxStatus, payeeName = payee.Name },
                    PaymentsMcpTools.CalculateBenefitPayload(payee.Calc, payee.Name)));
            }
        }

        calls.Add(new DeskToolCall(
            "payments_checkAuthorityLimit",
            new
            {
                grossAmount = run.LargestPayment,
                paymentType = run.PaymentType,
                caseNumber = c.CaseNumber,
                commencementAmount = run.CommencementAmount,
                payeeMismatch = run.Flow != FlowInbound && !run.AllPayeesMatch
            },
            PaymentsMcpTools.CheckAuthorityPayload(run.Authority)));

        if (approval is not null)
        {
            calls.Add(new DeskToolCall(
                "payments_requestApproval",
                new
                {
                    caseNumber = c.CaseNumber,
                    grossAmount = approval.GrossAmount,
                    taxWithheld = approval.TaxWithheld,
                    netAmount = approval.NetAmount,
                    payeeName = approval.PayeeName,
                    payeeAccount = approval.PayeeAccount,
                    paymentType = run.PaymentType
                },
                PaymentsMcpTools.RequestApprovalPayload(approval, teamsResult, alreadyRaised: false)));
        }

        if (approval is not null && teamsResult is not null)
        {
            var card = BuildTeamsRequest(run, approval);
            calls.Add(new DeskToolCall(
                "teams_sendApprovalCard",
                new
                {
                    approvalId = card.ApprovalId,
                    caseNumber = card.CaseNumber,
                    memberName = card.MemberName,
                    paymentType = card.PaymentType,
                    grossAmount = card.GrossAmount,
                    taxWithheld = card.TaxWithheld,
                    netAmount = card.NetAmount,
                    payeeName = card.PayeeName,
                    payeeAccount = card.PayeeAccount,
                    reason = card.Reason,
                    paymentDate = card.PaymentDate
                },
                new
                {
                    tool = "teams_sendApprovalCard",
                    calledBy = "payments_requestApproval",
                    approvalId = approval.ApprovalId,
                    caseNumber = approval.CaseNumber,
                    sent = teamsResult.Sent,
                    channel = teamsResult.Channel,
                    approvalUrl = teamsResult.ApprovalUrl,
                    message = teamsResult.Message
                },
                teamsResult.Card));
        }

        return calls;
    }

    private static object BuildRawOutput(AgentTraceResult? trace, bool mockMode, IReadOnlyList<DeskToolCall> deskToolCalls)
    {
        var toolCalls = deskToolCalls.Select(call => call.AdaptiveCard is null
            ? (object)new { tool = call.Tool, arguments = call.Arguments, result = call.Result }
            : new { tool = call.Tool, arguments = call.Arguments, result = call.Result, adaptiveCard = call.AdaptiveCard }).ToList();

        if (trace is not null)
        {
            return new
            {
                text = trace.Text,
                citations = trace.Citations,
                outputItems = trace.OutputItems,
                responseId = trace.ResponseId,
                durationMs = trace.DurationMs,
                preExecutedToolCalls = mockMode ? toolCalls : null
            };
        }

        return new
        {
            mode = "offline",
            note = "The Foundry agent was not invoked, so the Payments desk ran the payments_* MCP tools locally. These are the tool calls and results behind the panel.",
            toolCalls
        };
    }

    // ── Agent prompt ────────────────────────────────────────────────────

    private static string BuildPrompt(PaymentRun run, PaymentApprovalRecord? approval, IReadOnlyList<DeskToolCall>? preExecuted)
    {
        var c = run.Case;
        var p = run.Profile;
        var sb = new StringBuilder();

        sb.AppendLine("MEMBER CASE");
        sb.AppendLine("===========");
        sb.AppendLine($"Case number: {c.CaseNumber}");
        sb.AppendLine($"Member: {p.MemberDisplay}");
        sb.AppendLine($"Client on the case: {c.ClientName}");
        sb.AppendLine($"Product: {c.Product}");
        sb.AppendLine($"Request type: {c.RequestType}");
        sb.AppendLine($"Received: {c.ReceivedDate}");
        sb.AppendLine($"Adviser: {AdviserLine(c) ?? "None (direct member)"}");
        sb.AppendLine($"Request summary: {c.RequestSummary}");
        sb.AppendLine($"Priority: {c.Priority} — {c.PriorityReason}");
        sb.AppendLine();

        sb.AppendLine("PAYMENT INPUTS (confirmed by the Payments Officer)");
        sb.AppendLine("==================================================");
        sb.AppendLine($"Payment type: {PaymentTypes.Label(run.PaymentType)}");
        if (run.RequestedAmount is { } requested)
            sb.AppendLine($"Amount requested: {Fmt(requested)}");
        var grossNote = run.Payees.Count > 1
            ? " (total benefit — split between the payees by share)"
            : run.PaymentType == PaymentTypes.Pension ? " (regular monthly payment)" : string.Empty;
        sb.AppendLine($"Gross amount: {Fmt(run.GrossAmount)}{grossNote}");
        if (run.CommencementAmount is { } commencement)
        {
            sb.AppendLine($"Pension commencement amount: {Fmt(commencement)} into {p.AccountNumber}"
                + (p.CommencementDate is { } date ? $" on {date}" : string.Empty));
        }
        if (run.PaymentType != PaymentTypes.Inbound)
            sb.AppendLine($"Tax-free component: {Pct(run.TaxFreePercent)} of the account");
        if (run.MemberAge is { } age)
            sb.AppendLine($"Member age: {age}");
        sb.AppendLine($"Tax status: {PaymentTaxStatuses.Label(run.TaxStatus)} — withholding {PaymentTaxStatuses.RateLabel(run.TaxStatus)}");
        if (run.Payees.Count == 0)
        {
            sb.AppendLine("Payee: none — money is coming in, not going out");
        }
        else
        {
            sb.AppendLine("Payee(s):");
            foreach (var payee in run.Payees)
                sb.AppendLine($"- {payee.Name} — {payee.MaskedAccount} — {Pct(payee.SharePercent)}");
        }
        sb.AppendLine($"Case approval: {run.CaseCheck.StatusLabel}"
            + (run.CaseCheck.ApprovedAmount is { } approvedAmount ? $" (approved amount {Fmt(approvedAmount)})" : string.Empty)
            + $" — decided by {run.CaseCheck.DecidedBy}. {run.CaseCheck.Note}");
        sb.AppendLine($"Payment date: {run.PaymentDate}");
        sb.AppendLine();

        var mockBlock = preExecuted is null ? null : BuildMockToolResultsBlock(preExecuted);
        var toolNote = mockBlock is null
            ? null
            : "The payments_* MCP tools have ALREADY BEEN INVOKED for this run by the Payments desk — their results are in the MOCK MCP TOOL RESULTS section above. " +
              "Treat those JSON payloads as authoritative tool outputs. Do NOT say the tools are unavailable, do NOT ask for them to be enabled and do NOT try to call them again.";

        switch (run.Flow)
        {
            case FlowOutbound:
                sb.AppendLine("PAYMENTS DESK");
                sb.AppendLine("=============");
                if (approval is not null)
                {
                    sb.AppendLine($"Approval {approval.ApprovalId} has been raised for this case (approver: {approval.Approver}) and the " +
                        $"\"Caldova Wealth — Payment approval\" Adaptive Card has been posted to Microsoft Teams ({approval.TeamsChannel}). " +
                        $"Approval link: {approval.ApprovalUrl}");
                }
                sb.AppendLine();
                if (mockBlock is not null)
                {
                    sb.Append(mockBlock);
                    sb.AppendLine(toolNote);
                    sb.AppendLine("Do NOT release the payment in this run — stop after surfacing the approvalId and asking the approver to approve in Microsoft Teams.");
                }
                else
                {
                    sb.AppendLine("Use the payments_* MCP tools in this order: payments_validatePayee (once per payee), payments_checkCaseApproval, " +
                        "payments_calculateBenefit (once per payee), payments_checkAuthorityLimit, then payments_requestApproval — it returns the " +
                        $"approval the desk has already raised for this case{(approval is null ? string.Empty : $" ({approval.ApprovalId})")} rather than a duplicate. " +
                        "Do NOT call payments_releasePayment in this run: stop and ask the approver to approve in Microsoft Teams.");
                }
                sb.AppendLine();
                sb.AppendLine("Then produce the standard Payments output (Payment Calculation, Cross-checks, Payment Approval Request, " +
                    "Payment Confirmation Draft, Human Approval Required). Cite the rule documents by title — e.g. " +
                    $"\"{PaymentRules.TaxRuleTitle}\" and \"{run.CaseCheck.RuleCited}\". Mask bank details. Plain English; no personal financial advice.");
                break;

            case FlowBlocked:
                sb.AppendLine("THIS PAYMENT MUST NOT BE RAISED OR RELEASED");
                sb.AppendLine("===========================================");
                sb.AppendLine($"Reason: {run.CaseCheck.Note}");
                if (approval is not null)
                {
                    sb.AppendLine($"The desk has recorded approval {approval.ApprovalId} in the BLOCKED state — no Teams card was posted and " +
                        "payments_releasePayment will refuse it.");
                }
                sb.AppendLine();
                if (mockBlock is not null)
                {
                    sb.Append(mockBlock);
                    sb.AppendLine(toolNote);
                }
                else
                {
                    sb.AppendLine("Use payments_validatePayee, payments_checkCaseApproval and payments_checkAuthorityLimit to evidence why the payment can't be " +
                        "released. Do NOT call payments_requestApproval or payments_releasePayment.");
                }
                sb.AppendLine();
                sb.AppendLine("Produce this output instead of the standard one:");
                sb.AppendLine($"1. **Funds Protected** — confirm no money leaves the account: {Fmt(run.TotalGross)} stays in {p.AccountNumber}; " +
                    $"the outbound instruction to {PayeeNames(run)} is cancelled and a payment block stays in place until {FirstName(p.MemberName)} " +
                    "re-verifies on details we already trust.");
                sb.AppendLine("2. **Cross-checks** — payee match, case approval, authority limit.");
                sb.AppendLine("3. **Why Release Is Blocked** — plain English and factual. Never accuse the member — they may be the victim. Don't mention any suspicious matter report.");
                sb.AppendLine($"4. **Internal Confirmation** — a short note for the Team Leader and Client Communications. Next step: {BlockedNextStep(run)}");
                sb.AppendLine("5. **Human Approval Required** — Yes: the block is a human decision and no release is possible.");
                break;

            case FlowInbound:
            {
                var (cash, invest) = InboundSplit(run.GrossAmount);
                var option = p.InvestmentOption ?? "the member's chosen investment option";
                sb.AppendLine("NO MONEY LEAVES CALDOVA ON THIS CASE");
                sb.AppendLine("====================================");
                sb.AppendLine("This is an invest-on-arrival instruction, not a payment out:");
                sb.AppendLine($"- When the rollover of about {Fmt(run.GrossAmount)} arrives, keep 1% ({Fmt(cash)}) in the Caldova Cash Account and invest {Fmt(invest)} in {option}.");
                if (run.PaymentType == p.PaymentType)
                {
                    foreach (var line in p.ExtraContext)
                        sb.AppendLine($"- {line.Label}: {line.Value}");
                }
                sb.AppendLine();
                if (mockBlock is not null)
                {
                    sb.Append(mockBlock);
                    sb.AppendLine(toolNote);
                }
                else
                {
                    sb.AppendLine("You may call payments_checkCaseApproval and payments_checkAuthorityLimit. Do NOT call payments_requestApproval or payments_releasePayment.");
                }
                sb.AppendLine();
                sb.AppendLine("Produce this output instead of the standard one:");
                sb.AppendLine("1. **Investment Instruction** — the amounts and where they go.");
                sb.AppendLine($"2. **Checks** — case approval and adviser fee consent (cite \"{run.CaseCheck.RuleCited}\").");
                sb.AppendLine("3. **Why No Release Approval Is Needed** — no money leaves Caldova.");
                sb.AppendLine("4. **Confirmation Draft** — a short, plain-English note for the member (and adviser). No personal financial advice.");
                break;
            }
        }

        sb.AppendLine();
        sb.AppendLine("Keep the response under 700 words.");
        return sb.ToString();
    }

    private static string BuildMockToolResultsBlock(IReadOnlyList<DeskToolCall> calls)
    {
        var sb = new StringBuilder();
        sb.AppendLine("MOCK MCP TOOL RESULTS");
        sb.AppendLine("=====================");
        sb.AppendLine("Note: APP_MCP_URL is not configured, so the payments_* MCP tool surface has been pre-executed locally by the " +
            "Payments desk. The JSON below is what each tool returned and MUST be treated as authoritative for this run.");
        sb.AppendLine();
        foreach (var call in calls)
        {
            sb.AppendLine($"{call.Tool} →");
            sb.AppendLine(PaymentsMcpTools.ToJson(call.Result));
            sb.AppendLine();
        }
        return sb.ToString();
    }

    // ── Deterministic narrative (no Foundry, or the agent call failed) ──

    private static string BuildDeterministicNarrative(
        PaymentRun run,
        PaymentApprovalRecord? approval,
        TeamsCardSendResult? teamsResult,
        bool agentConfigured,
        string? agentError)
    {
        var p = run.Profile;
        var sb = new StringBuilder();
        var why = !agentConfigured
            ? "the Foundry agent isn't configured"
            : $"the Foundry agent call didn't complete ({Shorten(agentError ?? "no reply", 160)})";
        sb.AppendLine($"> Offline run — {why}. The Payments desk ran the payments_* MCP tools locally; see Raw Output for every call.");
        sb.AppendLine();

        switch (run.Flow)
        {
            case FlowOutbound:
            {
                sb.AppendLine("**1. Payment Calculation**");
                sb.AppendLine();
                sb.AppendLine("| | " + string.Join(" | ", run.Payees.Select(x => Md(x.Name))) + " |");
                sb.AppendLine("|---|" + string.Concat(run.Payees.Select(_ => "---:|")));
                sb.AppendLine($"| Gross amount{(run.PaymentType == PaymentTypes.Pension ? " (monthly)" : string.Empty)} | " + string.Join(" | ", run.Payees.Select(x => Fmt(x.Calc.GrossAmount))) + " |");
                sb.AppendLine($"| Tax-free component ({Pct(run.TaxFreePercent)}) | " + string.Join(" | ", run.Payees.Select(x => Fmt(x.Calc.TaxFreeComponent))) + " |");
                sb.AppendLine("| Taxable component (taxed element) | " + string.Join(" | ", run.Payees.Select(x => Fmt(x.Calc.TaxableComponent))) + " |");
                sb.AppendLine($"| PAYG withholding — {PaymentTaxStatuses.RateLabel(run.TaxStatus)} | " + string.Join(" | ", run.Payees.Select(x => "−" + Fmt(x.Calc.TaxWithheld))) + " |");
                sb.AppendLine("| **Net payment** | " + string.Join(" | ", run.Payees.Select(x => $"**{Fmt(x.Calc.NetAmount)}**")) + " |");
                sb.AppendLine();
                sb.AppendLine($"_Rule: {PaymentRules.TaxRuleTitle}._");
                sb.AppendLine();
                AppendChecks(sb, run);
                sb.AppendLine("**3. Payment Approval Request**");
                sb.AppendLine();
                if (approval is not null)
                {
                    sb.AppendLine($"- Approval id **{approval.ApprovalId}** — {approval.StatusKey}, with {approval.Approver}");
                    sb.AppendLine(teamsResult is { Sent: true }
                        ? $"- Microsoft Teams: \"Caldova Wealth — Payment approval\" card posted to {teamsResult.Channel} via teams_sendApprovalCard"
                        : "- Microsoft Teams: card not sent — use the approval link");
                    sb.AppendLine($"- Approval link: {approval.ApprovalUrl}");
                }
                sb.AppendLine();
                sb.AppendLine("**4. Payment Confirmation Draft**");
                sb.AppendLine();
                sb.AppendLine($"Drafted below for Client Communications — {Fmt(run.TotalNet)} net to {Md(PayeeNames(run))}, {run.PaymentDate}.");
                sb.AppendLine();
                sb.AppendLine("**5. Human Approval Required**");
                sb.AppendLine();
                sb.AppendLine(run.Authority.Required
                    ? $"**Yes** — {string.Join(" ", run.Authority.Reasons)} Penny releases the payment only after {run.Authority.Approver} approves in Microsoft Teams."
                    : $"**Yes — standard sign-off.** {run.Authority.Note} Nothing is released until it's approved.");
                break;
            }

            case FlowBlocked:
            {
                sb.AppendLine("**1. Funds Protected**");
                sb.AppendLine();
                sb.AppendLine($"No money leaves the account: **{Fmt(run.TotalGross)} stays in {p.AccountNumber}**. The outbound instruction to " +
                    $"{Md(string.Join(" & ", run.Payees.Select(x => $"{x.Name} ({x.MaskedAccount})")))} is cancelled and a payment block stays in place " +
                    $"until {FirstName(p.MemberName)} re-verifies on details we already trust.");
                sb.AppendLine();
                AppendChecks(sb, run);
                sb.AppendLine("**3. Why Release Is Blocked**");
                sb.AppendLine();
                sb.AppendLine(Md(run.CaseCheck.Note));
                sb.AppendLine();
                sb.AppendLine("**4. Internal Confirmation**");
                sb.AppendLine();
                sb.AppendLine((approval is null ? string.Empty : $"Recorded as approval {approval.ApprovalId} (blocked) — no Teams card raised. ") +
                    $"Next step: {BlockedNextStep(run)}");
                sb.AppendLine();
                sb.AppendLine("**5. Human Approval Required**");
                sb.AppendLine();
                sb.AppendLine($"**Yes** — the block is a human decision ({run.CaseCheck.DecidedBy}); release stays disabled.");
                break;
            }

            case FlowInbound:
            {
                var (cash, invest) = InboundSplit(run.GrossAmount);
                var option = p.InvestmentOption ?? "the member's chosen investment option";
                sb.AppendLine("**1. Investment Instruction**");
                sb.AppendLine();
                sb.AppendLine("| | Amount |");
                sb.AppendLine("|---|---:|");
                sb.AppendLine($"| Rollover expected (approx.) | {Fmt(run.GrossAmount)} |");
                sb.AppendLine($"| Kept in the Caldova Cash Account (1%) | {Fmt(cash)} |");
                sb.AppendLine($"| **Invested in {option}** | **{Fmt(invest)}** |");
                sb.AppendLine();
                if (run.PaymentType == p.PaymentType)
                {
                    foreach (var line in p.ExtraContext)
                        sb.AppendLine($"- **{line.Label}:** {Md(line.Value)}");
                    sb.AppendLine();
                }
                sb.AppendLine("**2. Checks**");
                sb.AppendLine();
                sb.AppendLine($"- ✅ **Case approval** — {Md(run.CaseCheck.Note)}");
                sb.AppendLine($"- ✅ **Authority** — {Md(run.Authority.Note)}");
                sb.AppendLine();
                sb.AppendLine("**3. Why No Release Approval Is Needed**");
                sb.AppendLine();
                sb.AppendLine("No money leaves Caldova — incoming rollovers are invested under the member's standing instructions, and the adviser fee is deducted under the member's signed consent.");
                sb.AppendLine();
                sb.AppendLine("**4. Confirmation Draft**");
                sb.AppendLine();
                sb.AppendLine("Drafted below for the member and their adviser.");
                break;
            }
        }

        return sb.ToString();
    }

    private static void AppendChecks(StringBuilder sb, PaymentRun run)
    {
        sb.AppendLine("**2. Cross-checks**");
        sb.AppendLine();
        var payeeIcon = run.AllPayeesMatch ? "✅" : "❌";
        foreach (var payee in run.Payees)
            sb.AppendLine($"- {payeeIcon} **Payee match{(run.Payees.Count > 1 ? $" — {Md(payee.Name)}" : string.Empty)}** — {Md(payee.Validation.Note)}");
        var caseText = run.CaseCheck.Note.StartsWith(run.CaseCheck.StatusLabel, StringComparison.OrdinalIgnoreCase)
            ? run.CaseCheck.Note
            : $"{run.CaseCheck.StatusLabel}: {run.CaseCheck.Note}";
        sb.AppendLine($"- {(run.CaseCheck.Payable ? "✅" : "❌")} **Case approval** — {Md(caseText)}");
        sb.AppendLine(run.Authority.Required
            ? $"- ⚠️ **Authority limit** — Team Leader approval required: {Md(string.Join(" ", run.Authority.Reasons))}"
            : $"- ✅ **Authority limit** — {Md(run.Authority.Note)}");
        sb.AppendLine();
    }

    private static string BlockedNextStep(PaymentRun run) =>
        run.CaseCheck.Status == CaseApprovalStatuses.Blocked && run.Profile.BlockedNextStep is { } next
            ? next
            : "Benefits & Eligibility completes the decision; Payments re-runs the payment once the case is approved.";

    // ── Payment confirmation drafts (Markdown; references filled on release) ─

    private static string BuildConfirmationDraft(PaymentRun run) => run.Flow switch
    {
        FlowInbound => InboundDraft(run),
        FlowBlocked => BlockedDraft(run),
        _ => run.PaymentType switch
        {
            PaymentTypes.DeathBenefit => DeathBenefitDraft(run),
            PaymentTypes.Pension => PensionDraft(run),
            PaymentTypes.Hardship => HardshipDraft(run),
            _ => LumpSumDraft(run)
        }
    };

    private static string HardshipDraft(PaymentRun run)
    {
        var c = run.Case;
        var p = run.Profile;
        var payee = run.Payees[0];
        var calc = payee.Calc;
        var sb = new StringBuilder();
        sb.AppendLine($"**To:** {c.ClientName} · **Re:** Your financial hardship payment — case {c.CaseNumber}");
        sb.AppendLine();
        sb.AppendLine($"Dear {FirstName(c.ClientName)},");
        sb.AppendLine();
        sb.AppendLine("We've approved the early release of some of your super on financial hardship grounds. Here's exactly what you'll receive, and why.");
        sb.AppendLine();
        var amountLine = $"- **Amount released (before tax):** {Fmt(calc.GrossAmount)}";
        if (run.RequestedAmount is { } requested && requested > calc.GrossAmount)
        {
            amountLine += calc.GrossAmount >= PaymentRules.HardshipMaximum
                ? $". You asked for {Fmt(requested)}, but the law allows a maximum of {Fmt(PaymentRules.HardshipMaximum)} in any 12-month period on financial hardship grounds."
                : $". You asked for {Fmt(requested)}; {Fmt(calc.GrossAmount)} has been approved.";
        }
        sb.AppendLine(amountLine);
        AppendComponentsAndTax(sb, calc, "paid to the ATO on your behalf. Your final tax is worked out when you lodge your tax return.");
        sb.AppendLine($"- **Paid to you:** **{Fmt(calc.NetAmount)}** into {Md(payee.MaskedAccount)} — {run.PaymentDate}");
        sb.AppendLine($"- **Payment reference:** {PaymentRules.ReferenceToken}");
        sb.AppendLine();
        if (p.BalanceBefore is { } balance)
        {
            sb.AppendLine($"Your super balance after this payment will be about {Fmt(Math.Max(0m, balance - calc.GrossAmount))}.");
            sb.AppendLine();
        }
        AppendSignOff(sb, p.LetterNote, "_Draft — Client Communications sends this once the payment is released._");
        return sb.ToString();
    }

    private static string DeathBenefitDraft(PaymentRun run)
    {
        var p = run.Profile;
        var sb = new StringBuilder();
        var deceased = p.DeceasedReference ?? "the member";
        var deceasedName = p.ProfileId == "generic" ? "the member" : FirstName(p.MemberName);
        for (var i = 0; i < run.Payees.Count; i++)
        {
            var payee = run.Payees[i];
            var calc = payee.Calc;
            sb.AppendLine($"#### To {Md(payee.Name)}");
            sb.AppendLine();
            sb.AppendLine($"Dear {FirstName(payee.Name)},");
            sb.AppendLine();
            sb.AppendLine($"We're very sorry for the loss of {deceased}. This letter confirms the payment of your share of the death benefit from {p.AccountNumber}, " +
                $"paid {p.PaymentBasis ?? "in line with the trustee's decision"}.");
            sb.AppendLine();
            sb.AppendLine($"- **Your share ({Pct(payee.SharePercent)}):** {Fmt(calc.GrossAmount)} before tax");
            sb.AppendLine($"- **Tax-free part:** {Fmt(calc.TaxFreeComponent)} · **Taxable part:** {Fmt(calc.TaxableComponent)}");
            sb.AppendLine(calc.TaxWithheld > 0m
                ? $"- **Tax withheld:** {Fmt(calc.TaxWithheld)} ({Pct(calc.WithholdingRate * 100m)} of the taxable part), paid to the ATO. Because you weren't financially dependent on {deceasedName}, you're treated as a non-dependant for tax: the taxable part has tax withheld and the tax-free part doesn't."
                : "- **Tax withheld:** none — death benefits paid to a dependant for tax purposes are tax-free.");
            sb.AppendLine($"- **Paid to you:** **{Fmt(calc.NetAmount)}** into {Md(payee.MaskedAccount)}");
            sb.AppendLine($"- **Payment reference:** {PaymentRules.ReferenceTokenFor(i + 1)}");
            sb.AppendLine();
            if (p.ExtraContext.Any(l => l.Label == "Final amounts"))
            {
                sb.AppendLine("The final amount reflects the sale prices when the pension's investments were sold to cash.");
                sb.AppendLine();
            }
            AppendSignOff(sb, p.LetterNote, null);
            sb.AppendLine();
        }
        sb.AppendLine("_Drafts — Client Communications sends these with the condolence letters once the payments are released._");
        return sb.ToString();
    }

    private static string PensionDraft(PaymentRun run)
    {
        var c = run.Case;
        var p = run.Profile;
        var payee = run.Payees[0];
        var calc = payee.Calc;
        var annual = calc.GrossAmount * 12m;
        var sb = new StringBuilder();
        var cc = AdviserLine(c);
        sb.AppendLine($"**To:** {c.ClientName}" + (cc is null ? string.Empty : $" · **cc:** {cc}") + $" · **Re:** Your Caldova Pension is ready — case {c.CaseNumber}");
        sb.AppendLine();
        sb.AppendLine($"Dear {FirstName(c.ClientName)},");
        sb.AppendLine();
        sb.AppendLine("Congratulations on your retirement. Your Caldova Pension is set up and your income is ready to start.");
        sb.AppendLine();
        if (run.CommencementAmount is { } commencement)
        {
            sb.AppendLine($"- **Pension account:** {p.AccountNumber}, starting" + (p.CommencementDate is { } date ? $" {date}" : string.Empty) + $" with {Fmt(commencement)}");
        }
        sb.AppendLine($"- **Your income:** {Fmt(calc.GrossAmount)} a month ({Fmt(annual)} a year), paid into {Md(payee.MaskedAccount)}");
        sb.AppendLine($"- **Payment schedule:** {run.PaymentDate}");
        sb.AppendLine(calc.TaxWithheld > 0m
            ? $"- **Tax:** {Fmt(calc.TaxWithheld)} withheld from each payment"
            : "- **Tax:** none withheld — pension payments are tax-free from age 60");
        if (p.MinimumDrawdown is { } minimum && annual >= minimum)
            sb.AppendLine($"- **Minimum for 2026-27:** {Fmt(minimum)} (pro-rated) — your income is above it");
        sb.AppendLine($"- **Reference:** {PaymentRules.ReferenceToken}");
        sb.AppendLine();
        AppendSignOff(sb, p.LetterNote, "_Draft — Client Communications sends this with the \"welcome to retirement\" letter once the pension starts._");
        return sb.ToString();
    }

    private static string LumpSumDraft(PaymentRun run)
    {
        var c = run.Case;
        var p = run.Profile;
        var sb = new StringBuilder();
        var rollover = run.PaymentType == PaymentTypes.RolloverOut;
        sb.AppendLine($"**To:** {c.ClientName} · **Re:** Your {PaymentTypes.Label(run.PaymentType).ToLowerInvariant()} — case {c.CaseNumber}");
        sb.AppendLine();
        sb.AppendLine($"Dear {FirstName(c.ClientName)},");
        sb.AppendLine();
        sb.AppendLine(rollover
            ? $"This confirms the rollover from your Caldova account {p.AccountNumber}."
            : $"This confirms the payment from your Caldova account {p.AccountNumber}.");
        sb.AppendLine();
        for (var i = 0; i < run.Payees.Count; i++)
        {
            var payee = run.Payees[i];
            var calc = payee.Calc;
            sb.AppendLine($"- **Amount (before tax):** {Fmt(calc.GrossAmount)}");
            AppendComponentsAndTax(sb, calc, "paid to the ATO on your behalf.");
            sb.AppendLine(rollover
                ? $"- **Rolled over:** **{Fmt(calc.NetAmount)}** to {Md(payee.Name)} ({Md(payee.MaskedAccount)})"
                : $"- **Paid:** **{Fmt(calc.NetAmount)}** into {Md(payee.MaskedAccount)}");
            sb.AppendLine($"- **Payment reference:** {(run.Payees.Count > 1 ? PaymentRules.ReferenceTokenFor(i + 1) : PaymentRules.ReferenceToken)}");
        }
        sb.AppendLine($"- **Payment date:** {run.PaymentDate}");
        sb.AppendLine();
        AppendSignOff(sb, p.LetterNote, "_Draft — Client Communications sends this once the payment is released._");
        return sb.ToString();
    }

    private static string BlockedDraft(PaymentRun run)
    {
        var c = run.Case;
        var p = run.Profile;
        var sb = new StringBuilder();
        sb.AppendLine($"**Internal confirmation — funds protected** · case {c.CaseNumber} · not for sending to the requester");
        sb.AppendLine();
        sb.AppendLine($"- **Request:** {PaymentTypes.Label(run.PaymentType).ToLowerInvariant()} of {Fmt(run.TotalGross)} to " +
            Md(string.Join(" & ", run.Payees.Select(x => $"{x.Name} ({x.MaskedAccount})"))) + ".");
        var outcome = run.CaseCheck.Status switch
        {
            CaseApprovalStatuses.Blocked => $"no payment released. The outbound instruction is cancelled and a payment block stays in place until {FirstName(p.MemberName)} re-verifies on details we already trust.",
            CaseApprovalStatuses.Declined => "no payment released — the request was declined.",
            CaseApprovalStatuses.Pending => "no payment released — nothing is paid until Benefits & Eligibility approves the request.",
            _ => "no payment released — the amount is more than was approved."
        };
        sb.AppendLine($"- **Outcome:** {outcome}");
        sb.AppendLine($"- **Balance:** {Fmt(run.TotalGross)} stays in {p.AccountNumber}.");
        sb.AppendLine($"- **Why:** {Md(run.CaseCheck.Note)}");
        sb.AppendLine($"- **Next step:** {BlockedNextStep(run)}");
        sb.AppendLine();
        sb.AppendLine("Penny — Payments Officer, Caldova Wealth");
        return sb.ToString();
    }

    private static string InboundDraft(PaymentRun run)
    {
        var c = run.Case;
        var p = run.Profile;
        var (cash, invest) = InboundSplit(run.GrossAmount);
        var option = p.InvestmentOption ?? "your chosen investment option";
        var cc = AdviserLine(c);
        var sb = new StringBuilder();
        sb.AppendLine($"**To:** {c.ClientName}" + (cc is null ? string.Empty : $" · **cc:** {cc}") + $" · **Re:** Your super is on its way in — case {c.CaseNumber}");
        sb.AppendLine();

        if (p.ProfileId == "onboarding-priya")
        {
            sb.AppendLine($"Hi {FirstName(c.ClientName)},");
            sb.AppendLine();
            sb.AppendLine($"Welcome to Caldova Super. Here's what happens to your money as it arrives in your new account ({p.AccountNumber}):");
            sb.AppendLine();
            sb.AppendLine($"- **Harbourline Retail Super (about {Fmt(run.GrossAmount)}):** requested now. When it lands we'll keep 1% (about {Fmt(cash)}) " +
                $"in your Caldova Cash Account for fees and invest about {Fmt(invest)} in the {option}, as set out in your Statement of Advice.");
            sb.AppendLine("- **Southern Cross Industry Super (about $96,400):** not moved yet. Rolling it over would end your $520,000 Death & TPD cover, " +
                "so Hannah will confirm your insurance arrangements with you first.");
            sb.AppendLine("- **Adviser fee:** $3,300 a year (incl. GST), deducted as $275 a month under the consent you signed.");
        }
        else
        {
            sb.AppendLine($"Dear {FirstName(c.ClientName)},");
            sb.AppendLine();
            sb.AppendLine($"When your rollover of about {Fmt(run.GrossAmount)} arrives in {p.AccountNumber}, we'll keep 1% (about {Fmt(cash)}) in your " +
                $"Caldova Cash Account for fees and invest about {Fmt(invest)} in {option}.");
        }
        sb.AppendLine();
        sb.AppendLine("Nothing leaves your account, so there's no payment for anyone to approve.");
        sb.AppendLine();
        AppendSignOff(sb, null, "_Draft — Client Communications includes this in the welcome email and the adviser update._");
        return sb.ToString();
    }

    private static void AppendComponentsAndTax(StringBuilder sb, BenefitCalculation calc, string withheldSuffix)
    {
        sb.AppendLine($"- **Tax-free part:** {Fmt(calc.TaxFreeComponent)} · **Taxable part:** {Fmt(calc.TaxableComponent)}");
        sb.AppendLine(calc.TaxWithheld > 0m
            ? $"- **Tax withheld:** {Fmt(calc.TaxWithheld)} ({Pct(calc.WithholdingRate * 100m)} of the taxable part), {withheldSuffix}"
            : $"- **Tax withheld:** none — {calc.WithholdingRateLabel}");
    }

    private static void AppendSignOff(StringBuilder sb, string? letterNote, string? footer)
    {
        if (!string.IsNullOrWhiteSpace(letterNote))
        {
            sb.AppendLine(letterNote);
            sb.AppendLine();
        }
        sb.AppendLine("Kind regards,");
        sb.AppendLine("Penny — Payments Officer, Caldova Wealth");
        if (footer is not null)
        {
            sb.AppendLine();
            sb.AppendLine(footer);
        }
    }

    // ── Small helpers ───────────────────────────────────────────────────

    private static string Fmt(decimal amount) => PaymentRules.FormatMoney(amount);

    private static string Pct(decimal percent) => PaymentRules.FormatPercent(percent);

    private static string FirstName(string? name)
    {
        var trimmed = (name ?? string.Empty).Trim();
        if (trimmed.Length == 0) return "there";
        var space = trimmed.IndexOf(' ');
        return space > 0 ? trimmed[..space] : trimmed;
    }

    private static string? AdviserLine(CaseRecord c)
    {
        if (string.IsNullOrWhiteSpace(c.AdviserName) || c.AdviserName.StartsWith("None", StringComparison.OrdinalIgnoreCase))
            return null;
        return string.IsNullOrWhiteSpace(c.AdviserPractice) ? c.AdviserName : $"{c.AdviserName}, {c.AdviserPractice}";
    }

    /// <summary>Escape Markdown control characters in masked bank details and names.</summary>
    private static string Md(string? value) =>
        (value ?? string.Empty)
            .Replace("\\", "\\\\")
            .Replace("*", "\\*")
            .Replace("_", "\\_")
            .Replace("|", "\\|");

    private static string Shorten(string value, int max) =>
        value.Length > max ? value[..(max - 1)] + "…" : value;

    private static string Sanitize(string value) =>
        (value ?? string.Empty).Replace('\r', ' ').Replace('\n', ' ');
}
