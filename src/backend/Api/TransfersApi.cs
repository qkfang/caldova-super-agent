using System.Globalization;
using System.Text;
using CaldovaSuper.Agents;
using CaldovaSuper.App.Mcp;
using CaldovaSuper.App.Services;

namespace CaldovaSuper.App.Api;

record TransfersProcessRequest(string CaseNumber);

/// <summary>
/// HTTP endpoints behind the "Try it out" tab on the Transfers &amp; Rollovers
/// agent page (<c>/agents/transfers-rollovers</c>, Rory):
///
/// 1. <c>GET /transfers/cases</c> and <c>GET /transfers/cases/{caseNumber}</c>
///    — the Member Cases held in <see cref="CaseStore"/>.
/// 2. <c>POST /transfers/process</c> — engages the Transfers &amp; Rollovers
///    agent. The transfer plan (counterparties, insurance-loss warnings, SMSF
///    verification, SLA tracker, drafted updates) and the rollover / transfer
///    request PDF are always produced deterministically by
///    <see cref="FundCatalog"/>, <see cref="FundDirectory"/> and
///    <see cref="TransferRequestPdfService"/>, so the page completes without a
///    Foundry connection; when Foundry is configured the agent's streamed
///    narrative is shown alongside.
/// 3. <c>GET /transfers/request/{id}.pdf</c> — download the generated PDF
///    (from <c>/transfers/process</c> or the <c>generateTransferRequestPdf</c>
///    MCP tool).
/// </summary>
public static class TransfersApi
{
    public static void MapTransfersEndpoints(
        this WebApplication app,
        CaseStore store,
        CaldovaAgentFactory factory,
        ILogger logger)
    {
        var pdfService = app.Services.GetRequiredService<TransferRequestPdfService>();
        var agentOptions = app.Services.GetRequiredService<CaldovaAgentOptions>();
        var mcpEnabled = !string.IsNullOrWhiteSpace(agentOptions.AppMcpUrl);

        // Cases available to Rory — every Member Case in the shared store.
        app.MapGet("/transfers/cases", () =>
            Results.Ok(store.All().Select(c => new
            {
                caseNumber = c.CaseNumber,
                clientName = c.ClientName,
                memberNumber = c.MemberNumber,
                product = c.Product,
                requestType = c.RequestType,
                receivedDate = c.ReceivedDate,
                amount = c.Amount,
                priority = c.Priority,
                createdAt = c.CreatedAt
            })));

        // Single-case lookup for the summary card shown before engaging the agent.
        app.MapGet("/transfers/cases/{caseNumber}", (string caseNumber) =>
        {
            var record = store.Get(caseNumber);
            return record is null
                ? Results.NotFound(new { error = $"case '{caseNumber}' not found" })
                : Results.Ok(record);
        });

        // Engage the Transfers & Rollovers agent on a case. A deterministic plan
        // and PDF are always returned; with Foundry configured the live agent's
        // narrative is streamed (`Accept: text/event-stream`) or returned in
        // `agentNotes`.
        app.MapPost("/transfers/process", async (HttpContext httpContext, TransfersProcessRequest request) =>
        {
            if (string.IsNullOrWhiteSpace(request?.CaseNumber))
                return Results.BadRequest(new { error = "caseNumber is required" });

            var record = store.Get(request.CaseNumber);
            if (record is null)
                return Results.NotFound(new { error = $"case '{request.CaseNumber}' not found" });

            logger.LogInformation("Transfers process: caseNumber={CaseNumber} sample={SampleId} mcp={Mcp}",
                Sanitize(record.CaseNumber), Sanitize(record.SampleId), mcpEnabled);

            var plan = FundCatalog.Build(record);
            var pdf = pdfService.Generate(ToPdfInput(record, plan));
            var pdfUrl = $"/transfers/request/{pdf.Id}.pdf";

            // Pre-resolve the MCP tool calls in-process so the prompt can carry
            // their results when APP_MCP_URL isn't set (no MCP transport wired
            // up). They are identical to what the TransfersMcpTools return.
            var baseUrl = TransfersMcpTools.BaseUrl(app.Configuration);
            var lookupJson = TransfersMcpTools.Serialize(TransfersMcpTools.LookupFundsResult(plan.CounterpartyQuery));
            var svsJson = plan.Svs is null ? null : TransfersMcpTools.Serialize(plan.Svs);
            var pdfJson = TransfersMcpTools.Serialize(TransfersMcpTools.DownloadPayload(pdf, baseUrl));
            var prompt = BuildPrompt(record, plan, mcpEnabled, lookupJson, svsJson, pdfJson, pdf, pdfUrl);

            string? createError = null;

            object BuildEnvelope(AgentTraceResult? trace, string? agentError)
            {
                var error = agentError ?? createError;
                var notes = trace?.Text;
                if (string.IsNullOrWhiteSpace(notes))
                    notes = BuildFallbackNarrative(record, plan, pdfUrl, pdf.FileName, error, factory.IsConfigured);

                return new
                {
                    caseNumber = record.CaseNumber,
                    clientName = record.ClientName,
                    memberNumber = record.MemberNumber,
                    requestType = record.RequestType,
                    plan = PlanView(plan),
                    transferRequestPdfUrl = pdfUrl,
                    transferRequestPdfFileName = pdf.FileName,
                    mcpEnabled,
                    agentNotes = notes,
                    agentConfigured = factory.IsConfigured,
                    agentError = error,
                    agentInput = trace?.Input,
                    agentRawOutput = trace is null ? null : new
                    {
                        text = trace.Text,
                        citations = trace.Citations,
                        outputItems = trace.OutputItems,
                        responseId = trace.ResponseId,
                        durationMs = trace.DurationMs
                    }
                };
            }

            CaldovaAgent? agent = null;
            if (factory.IsConfigured)
            {
                try
                {
                    agent = factory.Create("transfers");
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Transfers & Rollovers Agent could not be created; using the deterministic plan");
                    createError = ex.Message;
                }
            }

            if (AgentSseStreaming.WantsEventStream(httpContext))
            {
                await AgentSseStreaming.StreamAsync(httpContext, agent, prompt, BuildEnvelope, logger, "Transfers & Rollovers Agent");
                return Results.Empty;
            }

            AgentTraceResult? traceResult = null;
            string? invocationError = null;
            if (agent is not null)
            {
                try
                {
                    traceResult = await agent.RunWithTraceAsync(prompt);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Transfers & Rollovers Agent invocation failed; using the deterministic plan");
                    invocationError = ex.Message;
                }
            }

            return Results.Ok(BuildEnvelope(traceResult, invocationError));
        });

        // Download the transfer request PDF generated by /transfers/process or
        // by the generateTransferRequestPdf MCP tool.
        app.MapGet("/transfers/request/{id}.pdf", (string id) =>
        {
            var pdf = pdfService.Get(id);
            return pdf is null
                ? Results.NotFound(new { error = $"transfer request '{id}' not found" })
                : Results.File(pdf.Content, "application/pdf", pdf.FileName);
        });
    }

    private static TransferRequestPdfInput ToPdfInput(CaseRecord c, TransferPlan plan) => new(
        CaseNumber: c.CaseNumber,
        MemberName: c.RequestType == RequestTypes.DeathBenefit ? $"{c.ClientName} (claimant)" : c.ClientName,
        MemberNumber: c.MemberNumber,
        Product: c.Product,
        RequestType: c.RequestType,
        Adviser: TransfersMcpTools.AdviserText(c),
        AsAt: plan.AsAtLabel,
        RequestStatus: plan.RequestStatus,
        Legs: plan.Legs.Select(l => new TransferRequestPdfLeg(
            Counterparty: l.Counterparty,
            CounterpartyId: l.CounterpartyId ?? string.Empty,
            Direction: l.Direction,
            TransferType: l.TransferType,
            Amount: l.AmountLabel,
            Status: l.Status,
            Detail: $"{l.Reason}{(l.Reference is null ? string.Empty : $" Ref {l.Reference}.")} Due: {l.Due}.")).ToList(),
        InsuranceWarnings: plan.InsuranceWarnings.Select(w => $"{w.Fund} — {w.Message} {w.Action}").ToList(),
        SvsSummary: plan.Svs is null
            ? null
            : $"{plan.Svs.FundName ?? "SMSF"} (ABN {plan.Svs.Abn}) — {plan.Svs.Outcome}. {plan.Svs.Recommendation}",
        SvsChecks: plan.Svs is null
            ? Array.Empty<TransferRequestPdfCheck>()
            : plan.Svs.Checks.Select(ch => new TransferRequestPdfCheck(ch.Check, ch.Passed, ch.Detail)).ToList(),
        SlaLines: plan.Sla.Select(s => $"{s.Item}: {s.Status}{(s.Due is "—" ? string.Empty : $" (due {s.Due})")}. {s.Note}").ToList(),
        Notes: plan.Notes);

    // ─────────────────────────────────────────────────────────────────────
    // Prompt
    // ─────────────────────────────────────────────────────────────────────

    private static string BuildPrompt(
        CaseRecord c, TransferPlan plan, bool mcpEnabled, string lookupJson, string? svsJson, string pdfJson,
        TransferRequestPdfRecord pdf, string pdfRelativeUrl)
    {
        var sb = new StringBuilder();
        sb.AppendLine("MEMBER CASE FOR TRANSFERS & ROLLOVERS");
        sb.AppendLine("=====================================");
        sb.AppendLine($"Case number      : {c.CaseNumber}");
        sb.AppendLine($"Client           : {c.ClientName} ({c.ClientEmail}, {c.ClientPhone})");
        sb.AppendLine($"Member number    : {c.MemberNumber}");
        sb.AppendLine($"Product          : {c.Product}");
        sb.AppendLine($"Request type     : {c.RequestType}");
        sb.AppendLine($"Received         : {c.ReceivedDate}");
        sb.AppendLine($"Adviser          : {TransfersMcpTools.AdviserText(c)}");
        sb.AppendLine($"Amount           : {c.Amount}");
        sb.AppendLine($"Priority         : {c.Priority} — {c.PriorityReason}");
        sb.AppendLine($"Preferred contact: {c.PreferredContact}");
        sb.AppendLine();
        sb.AppendLine("REQUEST SUMMARY");
        sb.AppendLine("---------------");
        sb.AppendLine(c.RequestSummary);
        sb.AppendLine();
        sb.AppendLine($"WORKING PLAN PREPARED BY THE TRANSFERS SERVICE (as at {plan.AsAtLabel}) — verify it and explain it");
        sb.AppendLine("------------------------------------------------------------------------------------------");
        sb.AppendLine($"Overall: {plan.OverallStatus} — {plan.Headline}");
        if (plan.Legs.Count == 0)
            sb.AppendLine("Transfers: none.");
        foreach (var l in plan.Legs)
        {
            sb.AppendLine($"- {l.Id} {l.Direction}: {l.Counterparty}{(l.CounterpartyId is null ? string.Empty : $" ({l.CounterpartyId})")} — " +
                          $"{l.AmountLabel} — {l.TransferType} — status {l.Status.ToUpperInvariant()}. {l.Reason} Due: {l.Due}.");
        }
        foreach (var w in plan.InsuranceWarnings)
            sb.AppendLine($"- Insurance-loss warning — {w.Fund}: {w.Cover} cover of ${w.Amount.ToString("N0", CultureInfo.InvariantCulture)}. {w.Message} {w.Action}");
        if (plan.SmsfRequest is { } smsf)
            sb.AppendLine($"- SMSF details on the request: ABN {smsf.Abn}, member {smsf.MemberName}, BSB {smsf.Bsb}, account name \"{smsf.AccountName}\", ESA \"{smsf.Esa}\".");
        foreach (var n in plan.Notes)
            sb.AppendLine($"- {n}");
        sb.AppendLine($"- Human approval: {plan.HumanApprovalReason}");
        sb.AppendLine();

        if (mcpEnabled)
        {
            sb.AppendLine("TASK (use your MCP tools)");
            sb.AppendLine("-------------------------");
            var step = 1;
            if (!string.IsNullOrWhiteSpace(plan.CounterpartyQuery))
                sb.AppendLine($"{step++}. Call lookupFunds(\"{plan.CounterpartyQuery}\") to identify the counterparties and any insurance held.");
            if (plan.SmsfRequest is { } s)
                sb.AppendLine($"{step++}. Call verifySmsf(abn: \"{s.Abn}\", memberName: \"{s.MemberName}\", bsb: \"{s.Bsb}\", accountName: \"{s.AccountName}\", esa: \"{s.Esa}\") before deciding anything about the SMSF rollover.");
            sb.AppendLine($"{step++}. Call generateTransferRequestPdf for this case with the transfers you settle on (use [] if none) and include the returned downloadUrl in section 3.");
            sb.AppendLine($"{step}. Write your report in the required output format.");
            sb.AppendLine();
            sb.AppendLine($"The service has already generated a request PDF for this app's case file ({pdf.FileName}, link {pdfRelativeUrl}).");
            sb.AppendLine("Use the downloadUrl returned by your own generateTransferRequestPdf call in section 3.");
        }
        else
        {
            sb.AppendLine("MCP TOOL RESULTS (pre-resolved for you in this session)");
            sb.AppendLine("=======================================================");
            sb.AppendLine("The Transfers & Rollovers service has already run these tools on your behalf — do NOT call them again.");
            sb.AppendLine();
            if (!string.IsNullOrWhiteSpace(plan.CounterpartyQuery))
            {
                sb.AppendLine($"▶ lookupFunds(\"{plan.CounterpartyQuery}\") result:");
                sb.AppendLine(lookupJson);
                sb.AppendLine();
            }
            if (svsJson is not null && plan.SmsfRequest is { } s)
            {
                sb.AppendLine($"▶ verifySmsf(\"{s.Abn}\", \"{s.MemberName}\", \"{s.Bsb}\", \"{s.AccountName}\", \"{s.Esa}\") result:");
                sb.AppendLine(svsJson);
                sb.AppendLine();
            }
            sb.AppendLine("▶ generateTransferRequestPdf(...) result:");
            sb.AppendLine(pdfJson);
            sb.AppendLine();
            sb.AppendLine("TASK");
            sb.AppendLine("----");
            sb.AppendLine("Using the working plan and the tool results above, write your report in the required output format.");
            sb.AppendLine("Put the PDF's relativeUrl in section 3 as a markdown link: [Download the transfer request PDF](<relativeUrl>).");
        }

        sb.AppendLine();
        sb.AppendLine("Reminders: never release funds yourself (Payments does, after approval); never contact a member on changed or");
        sb.AppendLine("unverified details; never accuse a member of fraud; plain English; cite \"SuperStream rollovers, insurance-loss");
        sb.AppendLine("warnings & SMSF verification\" where relevant.");
        return sb.ToString();
    }

    // ─────────────────────────────────────────────────────────────────────
    // Deterministic narrative (used when the live agent isn't available)
    // ─────────────────────────────────────────────────────────────────────

    private static string BuildFallbackNarrative(
        CaseRecord c, TransferPlan plan, string pdfUrl, string pdfFileName, string? agentError, bool agentConfigured)
    {
        var preface = !agentConfigured
            ? "_Foundry agent is not configured in this environment, so this is Rory's deterministic transfer plan — the same fund directory, SMSF verification and PDF the MCP tools use._"
            : !string.IsNullOrWhiteSpace(agentError)
                ? $"_The Transfers & Rollovers Agent did not return a report ({agentError}). Showing Rory's deterministic transfer plan instead._"
                : "_The Transfers & Rollovers Agent finished without narrative text (it may only have called tools). Showing Rory's deterministic transfer plan instead._";

        var sb = new StringBuilder();
        sb.AppendLine(preface);
        sb.AppendLine();
        sb.AppendLine($"### Transfers & rollovers — {c.CaseNumber} · {c.ClientName}");
        sb.AppendLine();
        sb.AppendLine($"**{plan.OverallStatus}.** {plan.Headline}");
        sb.AppendLine();

        sb.AppendLine("#### 1. Transfer Plan");
        if (plan.Legs.Count == 0)
        {
            sb.AppendLine("No transfer or rollover is required for this case.");
        }
        else
        {
            sb.AppendLine("| Counterparty | Direction | Amount | Status | Why |");
            sb.AppendLine("|---|---|--:|---|---|");
            foreach (var l in plan.Legs)
            {
                sb.AppendLine($"| {Md(l.Counterparty)}{(l.CounterpartyId is null ? string.Empty : $" ({Md(l.CounterpartyId)})")} | {Md(l.Direction)} | " +
                              $"{Md(l.AmountLabel)} | **{Md(l.Status)}** | {Md(l.Reason)} |");
            }
        }
        sb.AppendLine();

        sb.AppendLine("#### 2. Counterparty Checks");
        if (plan.Counterparties.Count == 0)
        {
            sb.AppendLine("- No counterparty to look up — nothing moves to or from another fund.");
        }
        foreach (var cp in plan.Counterparties)
        {
            var id = cp.Usi is not null ? $"USI {cp.Usi}" : cp.Abn is not null ? $"ABN {cp.Abn}" : cp.Type;
            sb.AppendLine($"- **{cp.Name}** ({id}) — {cp.Type}. {cp.TurnaroundNote}" +
                          (cp.InsuranceHeld is null ? string.Empty : $" Insurance held: {cp.InsuranceHeld}."));
        }
        foreach (var w in plan.InsuranceWarnings)
            sb.AppendLine($"- ⚠️ **Insurance-loss warning — {w.Fund}:** {w.Message} {w.Action}");
        if (plan.Svs is { } svs)
        {
            sb.AppendLine();
            sb.AppendLine($"**SMSF verification — {svs.FundName ?? "SMSF"} (ABN {svs.Abn}): {svs.Outcome}**");
            sb.AppendLine();
            sb.AppendLine("| Check | Result | Detail |");
            sb.AppendLine("|---|:-:|---|");
            foreach (var ch in svs.Checks)
                sb.AppendLine($"| {Md(ch.Check)} | {(ch.Passed ? "✅ Pass" : "❌ Fail")} | {Md(ch.Detail)} |");
            sb.AppendLine();
            sb.AppendLine(svs.Recommendation);
        }
        foreach (var n in plan.Notes)
            sb.AppendLine($"- {n}");
        sb.AppendLine();

        sb.AppendLine("#### 3. Transfer Request PDF");
        sb.AppendLine($"[Download the transfer request PDF]({pdfUrl}) — `{pdfFileName}` · status **{plan.RequestStatus}**.");
        sb.AppendLine();

        sb.AppendLine("#### 4. SLA Tracker");
        if (plan.Sla.Count == 0)
        {
            sb.AppendLine("No service-level clock applies.");
        }
        else
        {
            sb.AppendLine("| Item | Started | Due | Status |");
            sb.AppendLine("|---|---|---|---|");
            foreach (var s in plan.Sla)
                sb.AppendLine($"| {Md(s.Item)} | {Md(s.Start)} | {Md(s.Due)} | {Md(s.Status)} |");
            sb.AppendLine();
            sb.AppendLine("_Rollovers must be completed within 3 business days of receiving all required information (SIS reg 6.34A)._");
        }
        sb.AppendLine();

        sb.AppendLine("#### 5. Member / Adviser Update Draft");
        if (plan.Updates.Count == 0)
            sb.AppendLine("No update is needed from Transfers & Rollovers.");
        foreach (var u in plan.Updates)
        {
            sb.AppendLine($"**{u.Audience}** ({u.Channel}){(u.Note is null ? string.Empty : $" — _{u.Note}_")}");
            sb.AppendLine();
            foreach (var line in u.Body.Split('\n'))
                sb.AppendLine(string.IsNullOrWhiteSpace(line) ? ">" : $"> {line}");
            sb.AppendLine();
        }

        sb.AppendLine("#### 6. Human Approval Required");
        sb.AppendLine(plan.HumanApprovalReason);
        sb.AppendLine();
        sb.Append("_Source: SuperStream rollovers, insurance-loss warnings & SMSF verification; Caldova fund directory._");
        return sb.ToString();
    }

    private static object PlanView(TransferPlan plan) => new
    {
        asAt = plan.AsAt,
        asAtLabel = plan.AsAtLabel,
        overallStatus = plan.OverallStatus,
        statusTone = plan.StatusTone,
        headline = plan.Headline,
        requestStatus = plan.RequestStatus,
        legs = plan.Legs,
        counterparties = plan.Counterparties.Select(FundDirectory.ToView),
        insuranceWarnings = plan.InsuranceWarnings,
        smsfRequest = plan.SmsfRequest,
        svs = plan.Svs,
        sla = plan.Sla,
        notes = plan.Notes,
        updates = plan.Updates,
        humanApprovalRequired = plan.HumanApprovalRequired,
        humanApprovalReason = plan.HumanApprovalReason
    };

    private static string Md(string s) => s.Replace("|", "\\|").Replace("\n", " ");

    private static string Sanitize(string value) => value.Replace('\r', ' ').Replace('\n', ' ');
}
