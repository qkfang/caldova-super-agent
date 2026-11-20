using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using CaldovaSuper.Agents;
using CaldovaSuper.App.Mcp;
using CaldovaSuper.App.Services;
using static CaldovaSuper.App.Mcp.InvestmentsMcpTools;

namespace CaldovaSuper.App.Api;

record InvestmentsProcessRequest(string CaseNumber);
record InvestmentsChatRequest(string? PreviousResponseId, string Message, string? CaseNumber);

/// <summary>
/// HTTP endpoints behind the "Try it out" tab on the Investment Analyst agent
/// page (<c>/agents/investment-analyst</c>, Ivy — Investment Solutions):
///
/// 1. <c>GET /investments/cases</c> and <c>GET /investments/cases/{caseNumber}</c>
///    — the Member Cases held in <see cref="CaseStore"/>, plus the investment
///    profile Ivy reviews (balance, current/selected model, risk profile/SoA,
///    request type, fact sheets).
/// 2. <c>POST /investments/process</c> — engages the Investment Analyst
///    agent. The analysis for the case (fee comparison, income strategy,
///    redemption plan or "no action") and the client workbook are always
///    computed in-process with the same code as the MCP tools, so the page
///    shows the comparison table, the Mermaid chart and the workbook link
///    even when Foundry isn't configured. With Foundry configured the
///    agent's streamed report is shown; with <c>APP_MCP_URL</c> set the
///    agent calls <c>analyzeFactSheet</c> / <c>compareModels</c> /
///    <c>generateClientWorkbook</c> itself, otherwise the tool results are
///    pre-resolved into its prompt.
/// 3. <c>POST /investments/chat</c> — follow-up questions in the same Foundry
///    conversation; answered from the deterministic analysis when the live
///    agent isn't available.
/// </summary>
public static class InvestmentsApi
{
    // Canon menu (fallback when a fact sheet can't be read).
    private static readonly (string File, string Name, string Code, decimal Icr, decimal Growth, string Style)[] ModelMenu =
    {
        ("model-conservative.json", "Conservative", "CMP-CON", 0.32m, 30m, "Active, multi-asset"),
        ("model-balanced.json", "Balanced", "CMP-BAL", 0.38m, 60m, "Active, multi-asset"),
        ("model-growth.json", "Growth", "CMP-GRO", 0.42m, 80m, "Active, multi-asset"),
        ("model-high-growth.json", "High Growth", "CMP-HGR", 0.45m, 95m, "Active, multi-asset"),
        ("model-index-balanced.json", "Index Balanced", "CMP-IXB", 0.18m, 60m, "Passive (index)"),
        ("model-sustainable-growth.json", "Sustainable Growth", "CMP-SUS", 0.49m, 80m, "Active, multi-asset with ESG screens"),
    };

    public static void MapInvestmentsEndpoints(
        this WebApplication app,
        CaseStore store,
        CaldovaAgentFactory factory,
        ILogger logger)
    {
        var agentOptions = app.Services.GetRequiredService<CaldovaAgentOptions>();
        var tools = ActivatorUtilities.CreateInstance<InvestmentsMcpTools>(app.Services);
        var mcpEnabled = !string.IsNullOrWhiteSpace(agentOptions.AppMcpUrl);

        // Cases available to Ivy — every Member Case in the shared store.
        app.MapGet("/investments/cases", () =>
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

        // One case plus the investment profile shown in the "Review" step.
        app.MapGet("/investments/cases/{caseNumber}", async (string caseNumber) =>
        {
            var record = store.Get(caseNumber);
            if (record is null)
                return Results.NotFound(new { error = $"case '{caseNumber}' not found" });

            var analysis = await AnalyseAsync(record, tools);
            return Results.Ok(new
            {
                caseNumber = record.CaseNumber,
                clientName = record.ClientName,
                memberNumber = record.MemberNumber,
                product = record.Product,
                requestType = record.RequestType,
                receivedDate = record.ReceivedDate,
                adviserName = record.AdviserName,
                adviserPractice = record.AdviserPractice,
                requestSummary = record.RequestSummary,
                amount = record.Amount,
                priority = record.Priority,
                priorityReason = record.PriorityReason,
                investment = ProfileView(analysis)
            });
        });

        // Engage the Investment Analyst agent. Clients can ask for a live SSE
        // stream with `Accept: text/event-stream`; otherwise one JSON envelope.
        app.MapPost("/investments/process", async (HttpContext httpContext, InvestmentsProcessRequest request) =>
        {
            if (string.IsNullOrWhiteSpace(request?.CaseNumber))
                return Results.BadRequest(new { error = "caseNumber is required" });

            var record = store.Get(request.CaseNumber);
            if (record is null)
                return Results.NotFound(new { error = $"case '{request.CaseNumber}' not found" });

            logger.LogInformation("Investments process: caseNumber={CaseNumber} sample={SampleId} mcp={Mcp}",
                Sanitize(record.CaseNumber), Sanitize(record.SampleId), mcpEnabled);

            var analysis = await AnalyseAsync(record, tools);

            // Run the tool logic in-process: these are exactly the outputs the
            // MCP tools return, so the page (and the agent prompt when MCP
            // isn't wired up) always has the table, chart and workbook.
            var factSheetResults = analysis.FactSheets
                .Select(fs => (Url: fs.Source, Json: Serialize(new { source = fs.Source, factSheet = fs })))
                .ToList();
            var modelsJson = BuildModelsJson(analysis);
            var compareJson = analysis.Comparison is null ? null : Serialize(analysis.Comparison);
            var caseSummaryJson = BuildCaseSummaryJson(record, analysis);
            var recommendationsJson = BuildRecommendationsJson(analysis);
            var workbookJson = tools.GenerateClientWorkbook(record.CaseNumber, caseSummaryJson, modelsJson, recommendationsJson);
            var workbook = ParseWorkbookResult(workbookJson);

            var prompt = BuildPrompt(record, analysis, mcpEnabled, factSheetResults, modelsJson, compareJson, caseSummaryJson, workbookJson);

            string? createError = null;

            object BuildEnvelope(AgentTraceResult? trace, string? agentError)
            {
                var error = agentError ?? createError;
                var notes = trace?.Text;
                if (string.IsNullOrWhiteSpace(notes))
                    notes = BuildFallbackNarrative(record, analysis, workbook, error, factory.IsConfigured);

                return new
                {
                    caseNumber = record.CaseNumber,
                    clientName = record.ClientName,
                    requestType = record.RequestType,
                    analysis = AnalysisView(analysis),
                    workbook = workbook.DownloadUrl is null ? null : new
                    {
                        fileName = workbook.FileName,
                        downloadUrl = workbook.DownloadUrl,
                        sheets = workbook.Sheets
                    },
                    workbookError = workbook.Error,
                    mcpEnabled,
                    agentNotes = notes,
                    agentError = error,
                    agentConfigured = factory.IsConfigured,
                    agentInput = trace?.Input,
                    // Lets the page chain follow-up chat turns into the same Foundry conversation.
                    previousResponseId = trace?.ResponseId,
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
                    agent = factory.Create("investments");
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Investment Analyst Agent could not be created; using the deterministic analysis");
                    createError = ex.Message;
                }
            }

            if (AgentSseStreaming.WantsEventStream(httpContext))
            {
                await AgentSseStreaming.StreamAsync(httpContext, agent, prompt, BuildEnvelope, logger, "Investment Analyst Agent");
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
                    logger.LogWarning(ex, "Investment Analyst Agent invocation failed; using the deterministic analysis");
                    invocationError = ex.Message;
                }
            }

            return Results.Ok(BuildEnvelope(traceResult, invocationError));
        });

        // Follow-up chat. Chains off previousResponseId when the live agent is
        // available; otherwise answers from the deterministic analysis of the
        // case so the demo still holds a conversation offline.
        app.MapPost("/investments/chat", async (HttpContext httpContext, InvestmentsChatRequest request) =>
        {
            if (string.IsNullOrWhiteSpace(request?.Message))
                return Results.BadRequest(new { error = "message is required" });

            var live = factory.IsConfigured && !string.IsNullOrWhiteSpace(request.PreviousResponseId);
            var record = string.IsNullOrWhiteSpace(request.CaseNumber) ? null : store.Get(request.CaseNumber);
            var analysis = record is null ? null : await AnalyseAsync(record, tools);

            logger.LogInformation("Investments chat: live={Live} caseNumber={CaseNumber}",
                live, Sanitize(request.CaseNumber ?? string.Empty));

            string? createError = null;
            CaldovaAgent? agent = null;
            if (live)
            {
                try
                {
                    agent = factory.Create("investments");
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Investment Analyst Agent could not be created for chat");
                    createError = ex.Message;
                }
            }

            object BuildChatEnvelope(AgentTraceResult? trace, string? agentError)
            {
                var error = agentError ?? createError;
                var notes = trace?.Text;
                var offline = string.IsNullOrWhiteSpace(notes);
                if (offline)
                {
                    var reason = !factory.IsConfigured
                        ? "the Foundry agent isn't configured in this environment"
                        : !string.IsNullOrWhiteSpace(error)
                            ? $"the live agent didn't reply ({error})"
                            : string.IsNullOrWhiteSpace(request.PreviousResponseId)
                                ? "there's no live conversation to continue"
                                : "the live agent returned no text";
                    notes = $"_Offline reply — {reason}, so Ivy is answering from the deterministic analysis of the case._\n\n" +
                            OfflineChatReply(record, analysis, request.Message);
                }

                return new
                {
                    agentNotes = notes,
                    agentError = error,
                    agentConfigured = factory.IsConfigured,
                    offline,
                    agentInput = trace?.Input,
                    previousResponseId = trace?.ResponseId ?? request.PreviousResponseId,
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

            if (AgentSseStreaming.WantsEventStream(httpContext))
            {
                await AgentSseStreaming.StreamChatAsync(
                    httpContext, agent, request.PreviousResponseId ?? string.Empty, request.Message,
                    BuildChatEnvelope, logger, "Investment Analyst Agent");
                return Results.Empty;
            }

            AgentTraceResult? chatTrace = null;
            string? chatError = null;
            if (agent is not null)
            {
                try
                {
                    chatTrace = await agent.ChatWithTraceAsync(request.PreviousResponseId!, request.Message);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Investment Analyst Agent chat invocation failed");
                    chatError = ex.Message;
                }
            }

            return Results.Ok(BuildChatEnvelope(chatTrace, chatError));
        });
    }

    // ─────────────────────────────────────────────────────────────────────
    // Scenario analysis (deterministic, canon numbers)
    // ─────────────────────────────────────────────────────────────────────

    internal static async Task<InvestmentCaseAnalysis> AnalyseAsync(CaseRecord c, InvestmentsMcpTools tools)
    {
        var files = c.SampleId switch
        {
            "onboarding-priya" => new[] { "model-growth.json", "model-balanced.json", "model-index-balanced.json" },
            "rollover-grace" => new[] { "model-balanced.json" },
            "pension-george" => new[] { "model-balanced.json", "model-conservative.json" },
            "hardship-tom" => new[] { "model-balanced.json" },
            "death-benefit-robert" => new[] { "model-conservative.json" },
            _ => new[] { "model-balanced.json", "model-growth.json", "model-index-balanced.json" }
        };

        var sheets = new List<FactSheet>();
        foreach (var file in files)
        {
            var sheet = await tools.LoadFactSheetAsync(SamplesUrlPrefix + file);
            if (sheet is not null) sheets.Add(sheet);
        }

        return c.SampleId switch
        {
            "onboarding-priya" => Priya(sheets),
            "rollover-grace" => Grace(sheets),
            "pension-george" => George(sheets),
            "hardship-tom" => Tom(sheets),
            "death-benefit-robert" => MeiChen(sheets),
            _ => Generic(c, sheets)
        };
    }

    private static InvestmentCaseAnalysis Priya(IReadOnlyList<FactSheet> sheets)
    {
        const decimal balance = 138_200m;
        var options = new[]
        {
            ModelFor("Growth", sheets, selected: true, note: "Selected in the SoA dated 28 Oct 2026"),
            ModelFor("Balanced", sheets),
            ModelFor("Index Balanced", sheets),
        };
        var comparison = Compare(options, balance);

        var profile = new InvestmentProfile(
            Scenario: "fee-comparison",
            AnalysisTitle: "Model fit & fee comparison",
            AnalysisSummary: "Check Growth against the SoA risk profile and compare Growth, Balanced and Index Balanced on $138,200 — fees in dollars.",
            Balance: balance,
            BalanceLabel: "Consolidated balance (est.)",
            BalanceNote: "Southern Cross Industry Super ≈ $96,400 + Harbourline Retail Super ≈ $41,800, rolling in",
            CurrentModel: "Caldova Managed Portfolio — Growth (80/20), 100% — selected in the SoA (1% kept in the Caldova Cash Account)",
            RiskProfile: "Growth",
            Soa: "SoA dated 28 Oct 2026 — Hannah Lewis CFP®, Yarra Private Wealth",
            Holdings: Array.Empty<InvestmentHolding>());

        return new InvestmentCaseAnalysis(
            Profile: profile,
            FactSheets: sheets,
            Options: options,
            Comparison: comparison,
            Chart: ChartFromComparison(comparison),
            Plan: null,
            PortfolioFit:
                "Consistent. The Growth model (80/20 growth/defensive, standard risk measure 6 — High, minimum suggested " +
                "timeframe 7 years) matches the \"Growth\" risk profile in Hannah Lewis's SoA dated 28 Oct 2026 and is " +
                "available on the Select tier. Priya's super is preserved until at least age 60 — far longer than the " +
                "7-year minimum timeframe.",
            CaseFacts: new[]
            {
                "New Caldova Super (Select) account CS-2049817. Incoming rollovers: Harbourline Retail Super about $41,800 (requested now) and Southern Cross Industry Super about $96,400 (held until the adviser and member confirm in writing that $520,000 Death & TPD cover will end). Estimated consolidated balance $138,200.",
                "SoA dated 28 Oct 2026 (Hannah Lewis CFP®, Yarra Private Wealth): risk profile Growth; investment 100% Caldova Managed Portfolio — Growth, with 1% kept in the Caldova Cash Account.",
                $"Caldova admin fee on $138,200: {AdminFeeWorking(balance)}, plus the $180 p.a. account-keeping fee.",
                "The ongoing adviser fee ($3,300 p.a. incl. GST) is charged separately and is excluded from the comparison.",
                "Compare Growth (selected) with Balanced and Index Balanced. Do not recommend a change — the investment choice is the adviser's advice.",
            },
            Observations: WithExtras(comparison.Observations,
                "The comparison uses the estimated consolidated balance. Until the Southern Cross rollover goes ahead, Priya's Caldova balance will be about $41,800 (Harbourline only)."),
            ActionNote: null,
            NextSteps: new[]
            {
                "Send the workbook to Hannah Lewis with the note: \"Growth is consistent with the SoA. Fees are in dollars so Priya can see the trade-offs.\"",
                "No change recommended — the investment choice is Hannah's advice. Payments invests each rollover into Growth on receipt, keeping 1% in cash.",
                "Re-run the comparison on the actual balance once both rollover benefit statements arrive.",
            },
            HumanApprovalRequired: false,
            HumanApprovalReason: "No — the selected model matches the SoA risk profile and no change is being made. Hannah Lewis reviews the workbook with Priya.",
            AgentTask:
                "Confirm the Growth model fits the SoA risk profile, then compare Growth (selected), Balanced and Index Balanced on $138,200 with total annual Caldova fees in dollars. Produce the client workbook for the adviser.");
    }

    private static InvestmentCaseAnalysis Grace(IReadOnlyList<FactSheet> sheets)
    {
        const decimal balance = 612_400m;
        var holdings = new[]
        {
            new InvestmentHolding("Caldova Cash Account", 12_248m, 2.0m),
            new InvestmentHolding("Caldova Managed Portfolio — Balanced", 600_152m, 98.0m),
        };
        var plan = new InvestmentPlan("investmentHold", "Investment hold — what happens while the account is frozen", new[]
        {
            new InvestmentPlanRow("1", "Member-initiated switches and model changes", null, "On hold",
                "Only actioned after Grace is verified on her pre-change number (0491 570 157)."),
            new InvestmentPlanRow("2", "Redemptions, withdrawals and rollovers out", null, "On hold",
                "The SMSF rollover is held by Transfers & Rollovers — no units are sold."),
            new InvestmentPlanRow("3", "Existing investments", 612_400m, "Unchanged",
                "The balance stays invested as Grace chose. Moving it to cash without her instruction would itself be an unauthorised change; the portfolio manager's normal rebalancing continues."),
            new InvestmentPlanRow("4", "Holdings snapshot", 612_400m, "Recorded 6 Nov 2026",
                "Baseline for confirming nothing moved while the contact details were compromised."),
        }, "No investment instruction is actioned until Financial Crime and the Team Leader release the hold.");

        var profile = new InvestmentProfile(
            Scenario: "no-action",
            AnalysisTitle: "No investment action — account on hold",
            AnalysisSummary: "The account is frozen while Financial Crime reviews a suspected identity takeover — no switches, redemptions or rollovers are actioned.",
            Balance: balance,
            BalanceLabel: "Account balance (protected)",
            BalanceNote: "Full-balance SMSF rollover request held — no money has left the account",
            CurrentModel: "Caldova Managed Portfolio — Balanced (98%) + Caldova Cash Account (2%)",
            RiskProfile: "Balanced — Grace's own investment choice",
            Soa: "No SoA — direct Select member with no adviser",
            Holdings: holdings);

        return new InvestmentCaseAnalysis(
            Profile: profile,
            FactSheets: sheets,
            Options: Array.Empty<ModelOption>(),
            Comparison: null,
            Chart: null,
            Plan: plan,
            PortfolioFit:
                "No review needed — there is no investment request on this case. Grace's existing Balanced investment is left exactly as she chose it.",
            CaseFacts: new[]
            {
                "Caldova Super (Select) CS-1058220, balance $612,400; direct member, no adviser. A travel notice is on file (Italy, from 18 Oct 2026).",
                "Mobile and email were changed by phone on 2 Nov 2026 at 10:42; a request to roll the full balance to a newly registered SMSF arrived on 6 Nov 2026 at 07:52 — about 93 hours later.",
                "The rollover is held: the ATO SMSF verification failed (TFN not linked; bank details and ESA don't match). Financial Crime is reviewing; Grace is treated as the likely victim.",
                "Indicative holdings: Caldova Cash Account $12,248 (2%), Caldova Managed Portfolio — Balanced $600,152 (98%).",
                "Do not compare models or plan any redemption. Record the holdings snapshot and confirm the investment-instruction hold.",
            },
            Observations: new[]
            {
                "No investment action is taken while the Financial Crime hold is in place.",
                "Grace's $612,400 stays invested in Balanced, so normal market movements still apply during the hold.",
                "Instructions received through the changed contact details (mobile 0491 570 158, email grace.w.super@mailbox.example) must not be actioned.",
                "Once Grace is verified on her pre-change number and confirms her wishes, nothing needs to be unwound — nothing was sold or switched.",
            },
            ActionNote:
                "No investment action — account frozen pending the Financial Crime review. The $612,400 balance stays invested; no switches, redemptions or rollovers are processed until Grace is verified on her pre-change number (0491 570 157).",
            NextSteps: new[]
            {
                "Keep the investment-instruction hold until Financial Crime and the Team Leader release it.",
                "Attach the workbook (holdings snapshot at 6 Nov 2026) to the case file.",
                "Re-check the account once Grace confirms her instructions on her verified contact details.",
            },
            HumanApprovalRequired: true,
            HumanApprovalReason: "Yes — any investment instruction on this account needs Financial Crime and Team Leader sign-off while the hold is in place.",
            AgentTask:
                "No investment action is required: the account is frozen pending the Financial Crime review. Confirm the hold, note that the balance stays invested, and record the holdings snapshot in the client workbook. Do not compare models.");
    }

    private static InvestmentCaseAnalysis George(IReadOnlyList<FactSheet> sheets)
    {
        const decimal balance = 1_250_000m;
        var balanced = ModelFor("Balanced", sheets);
        var conservative = ModelFor("Conservative", sheets);
        var balancedIcr = balanced.IcrPercent ?? 0.38m;
        var conservativeIcr = conservative.IcrPercent ?? 0.32m;
        const string cashBucket = "Cash bucket (Caldova Cash Account & term deposits)";

        var options = new[]
        {
            new ModelOption("Cash bucket + Balanced", null, true, null, null, null, null,
                "Adviser instruction — two years of payments in cash, the rest in Balanced", null,
                new[]
                {
                    new ModelComponent(cashBucket, 156_000m, 0m, 0m),
                    new ModelComponent("Balanced", 1_094_000m, balancedIcr, balanced.GrowthPercent ?? 60m),
                }, null),
            new ModelOption("Balanced only", balanced.Code, false, null, null, null, balanced.Style,
                "Everything invested; payments come from selling units", null,
                new[] { new ModelComponent("Balanced", 1_250_000m, balancedIcr, balanced.GrowthPercent ?? 60m) }, null),
            new ModelOption("Cash bucket + Conservative", null, false, null, null, null, null,
                "Lower-risk alternative for comparison", null,
                new[]
                {
                    new ModelComponent(cashBucket, 156_000m, 0m, 0m),
                    new ModelComponent("Conservative", 1_094_000m, conservativeIcr, conservative.GrowthPercent ?? 30m),
                }, null),
        };
        var comparison = Compare(options, balance, "Total Caldova fees per year on the $1,250,000 pension");

        var plan = new InvestmentPlan("incomePlan", "Income structure — cash bucket + Balanced", new[]
        {
            new InvestmentPlanRow("1", "Cash bucket — Caldova Cash Account & term deposits", 156_000m, "On commencement, 16 Nov 2026",
                "Two years of payments: 24 × $6,500 (2 × $78,000)"),
            new InvestmentPlanRow("2", "Caldova Managed Portfolio — Balanced", 1_094_000m, "On commencement, 16 Nov 2026",
                "Long-term growth that refills the cash bucket"),
            new InvestmentPlanRow("3", "Monthly pension payment", 6_500m, "From 15 Dec 2026, on the 15th",
                "$78,000 p.a.; tax-free because George is over 60"),
            new InvestmentPlanRow("4", "FY2026-27 minimum payment (pro-rated)", 38_870m, "By 30 Jun 2027",
                "5% × $1,250,000 × 227/365 = $38,869.86, rounded to $38,870; seven payments ($45,500) meet it"),
            new InvestmentPlanRow("5", "Refill the cash bucket", null, "At each annual review",
                "Top up from Balanced when markets allow — the adviser's decision"),
        }, "Amounts are on commencement; market movements change the Balanced value over time.");

        var profile = new InvestmentProfile(
            Scenario: "income-strategy",
            AnalysisTitle: "Pension income strategy — cash bucket",
            AnalysisSummary: "Two-year cash bucket ($156,000) + $1,094,000 in Balanced for $78,000 p.a. paid monthly, compared with Balanced only and cash bucket + Conservative.",
            Balance: balance,
            BalanceLabel: "Pension commencement amount",
            BalanceNote: "From accumulation CS-1077881 ($1,284,600) into Caldova Pension CP-3077881 — $34,600 stays in accumulation",
            CurrentModel: "Instructed for the pension: Caldova Managed Portfolio — Balanced, with two years of payments ($156,000) in the Caldova Cash Account and term deposits",
            RiskProfile: "Balanced (adviser instruction)",
            Soa: "Retirement advice — Marcus Tan, Bayside Financial Partners (pension application signed 6 Nov 2026)",
            Holdings: Array.Empty<InvestmentHolding>());

        return new InvestmentCaseAnalysis(
            Profile: profile,
            FactSheets: sheets,
            Options: options,
            Comparison: comparison,
            Chart: ChartFromComparison(comparison),
            Plan: plan,
            PortfolioFit:
                "Consistent with the adviser's instruction. Balanced (60/40, standard risk measure 5 — Medium to high, minimum " +
                "suggested timeframe 5 years) plus a two-year cash bucket gives about 52.5% growth / 47.5% defensive overall, " +
                "matching the investment strategy on the pension application Marcus Tan submitted.",
            CaseFacts: new[]
            {
                "Commence a Caldova Pension (account-based) with $1,250,000 from accumulation CS-1077881 (balance $1,284,600; $34,600 stays in accumulation) into new pension account CP-3077881 on 16 Nov 2026. George is 66.",
                "Income $78,000 p.a. paid monthly ($6,500 on the 15th, first payment 15 Dec 2026); tax-free from age 60. Reversionary beneficiary: Helen (spouse).",
                "Minimum payment 5% (age 65–74) = $62,500 p.a.; FY2026-27 pro-rated minimum $38,870 (227 of 365 days).",
                "Adviser's instructed strategy: two years of payments (2 × $78,000 = $156,000) in the Caldova Cash Account and term deposits (available on the Select tier); the remaining $1,094,000 in Balanced.",
                "Compare three structures on $1,250,000: cash bucket + Balanced (instructed), Balanced only, cash bucket + Conservative. Cash and term deposits carry no investment fee.",
                $"Caldova admin fee on $1,250,000: {AdminFeeWorking(balance)}, plus the $180 p.a. account-keeping fee.",
            },
            Observations: WithExtras(comparison.Observations,
                "The cash bucket covers 24 monthly payments of $6,500, so income can continue for two years through a market fall without selling Balanced units.",
                "$78,000 p.a. is 6.24% of $1,250,000 — above the 5% minimum ($62,500 p.a.). This year's pro-rated minimum is $38,870; seven payments before 30 Jun 2027 total $45,500.",
                "Balanced only keeps every dollar invested, but each payment relies on selling units — including during a downturn (sequencing risk).",
                "Cash bucket + Conservative has the lowest fees but only about 26% growth assets overall, so it may not keep pace with a $78,000 income over a long retirement. Marcus and George decide — this is not advice.",
                "Cash and term deposits usually earn less than growth assets over time, so the bucket is refilled from Balanced at reviews."),
            ActionNote: null,
            NextSteps: new[]
            {
                "Send the three-way comparison workbook to Marcus Tan for his review with George.",
                "On commencement (16 Nov 2026): $156,000 to the Caldova Cash Account and term deposits; invest $1,094,000 in Balanced.",
                "Payments raises the Team Leader approval (commencement of $1,000,000 or more) before the internal transfer runs.",
            },
            HumanApprovalRequired: true,
            HumanApprovalReason: "Yes — a pension commencement of $1,000,000 or more needs Team Leader approval (raised by Payments). The income strategy itself is Marcus Tan's recommendation.",
            AgentTask:
                "Build the pension income strategy: a two-year cash bucket ($156,000) plus $1,094,000 in Balanced, and compare it with Balanced only and cash bucket + Conservative on $1,250,000 — fees in dollars, sequencing risk in plain English. Produce the three-way workbook for the adviser.");
    }

    private static InvestmentCaseAnalysis Tom(IReadOnlyList<FactSheet> sheets)
    {
        const decimal balance = 84_300m;
        const decimal gross = 10_000m;
        const decimal cash = 1_686m;
        const decimal units = 82_614m;
        var spreadPercent = sheets.FirstOrDefault()?.BuySellSpreadPercent ?? DefaultBuySellSpreadPercent;

        var minimumCash = Round2((balance - gross) * 0.01m);               // 1% of the balance after the release
        var fromCash = cash - minimumCash;                                    // $943.00
        var netFromUnits = gross - fromCash;                                  // $9,057.00
        var unitsSold = Round2(netFromUnits / (1m - spreadPercent / 100m));   // $9,066.07
        var spreadCost = unitsSold - netFromUnits;                            // $9.07
        var after = minimumCash + (units - unitsSold);                        // $74,290.93

        var plan = new InvestmentPlan("redemptionPlan", "Redemption plan — $10,000 gross hardship release", new[]
        {
            new InvestmentPlanRow("1", "Caldova Cash Account — cash above the 1% minimum", fromCash, "Draw first",
                $"Cash {MoneySmart(cash)} less the 1% minimum ({MoneySmart(minimumCash)}) kept for fees"),
            new InvestmentPlanRow("2", "Sell Caldova Managed Portfolio — Balanced units", unitsSold, "After Team Leader approval",
                $"Raises {Money(netFromUnits)} after the {FormatPercent(spreadPercent)} sell spread ({Money(spreadCost)})"),
            new InvestmentPlanRow("3", "Gross hardship release to Payments", gross, "Paid Fri 13 Nov 2026",
                "Payments calculates the tax withheld and the net payment"),
            new InvestmentPlanRow("4", "Estimated balance after the release", after, "Before market movements",
                $"Cash {MoneySmart(minimumCash)} + Balanced about {MoneySmart(Math.Round(units - unitsSold))} — about $74,300"),
        }, "Indicative — unit prices on the sale date set the final figures.");

        var chart = new InvestmentChart(
            "Tom's balance before and after the $10,000 release",
            "AUD",
            new[] { new InvestmentChartBar("Before release", balance, false), new InvestmentChartBar("After release (est.)", after, true) },
            BuildBarChartMermaid("Tom's balance before and after the $10,000 release",
                new List<(string, decimal)> { ("Before release", balance), ("After release (est.)", after) }, "AUD"));

        var profile = new InvestmentProfile(
            Scenario: "redemption",
            AnalysisTitle: "Redemption plan — $10,000 hardship release",
            AnalysisSummary: "Fund the partially approved $10,000 gross release: cash first, then Balanced units — the balance falls from $84,300 to about $74,300.",
            Balance: balance,
            BalanceLabel: "Account balance",
            BalanceNote: "Partially approved: $10,000 gross of the $15,000 requested",
            CurrentModel: "Caldova Managed Portfolio — Balanced (98%) + Caldova Cash Account (2%)",
            RiskProfile: "Balanced — Tom's own investment choice",
            Soa: "No SoA — direct Essential member with no adviser",
            Holdings: new[]
            {
                new InvestmentHolding("Caldova Cash Account", cash, 2.0m),
                new InvestmentHolding("Caldova Managed Portfolio — Balanced", units, 98.0m),
            });

        return new InvestmentCaseAnalysis(
            Profile: profile,
            FactSheets: sheets,
            Options: Array.Empty<ModelOption>(),
            Comparison: null,
            Chart: chart,
            Plan: plan,
            PortfolioFit:
                "No change — Tom keeps his existing Balanced investment. Only the units needed to fund the release are sold.",
            CaseFacts: new[]
            {
                "Severe financial hardship release partially approved: $10,000 gross — the legal maximum in any 12 months; $15,000 was requested.",
                "Caldova Super (Essential) CS-1030412, balance $84,300. Indicative holdings at 11 Nov 2026: Caldova Cash Account $1,686 (2%), Caldova Managed Portfolio — Balanced $82,614 (98%).",
                "Plan the redemption: cash above the 1% minimum first, then Balanced units. The 0.10% sell spread applies to units sold.",
                "Payments pays the release on Fri 13 Nov 2026 and calculates the tax withheld and the net amount.",
                "Vulnerable member — keep it plain and kind; no investment changes beyond funding the release.",
            },
            Observations: new[]
            {
                $"Drawing cash first keeps the units sold — and the sell-spread cost (about {Money(spreadCost)}) — as small as possible.",
                $"The 1% minimum ({MoneySmart(minimumCash)}) stays in the Caldova Cash Account for fees.",
                "Tom's balance falls from $84,300 to about $74,300 before market movements; the rest stays invested in Balanced as he chose.",
                "The release permanently reduces Tom's retirement savings — Client Communications explains this in plain English, with free financial counselling details.",
            },
            ActionNote: null,
            NextSteps: new[]
            {
                $"Place the sell order for about {MoneySmart(Math.Round(unitsSold))} of Balanced units once the Team Leader's approval of the partial release is on file.",
                "Confirm $10,000 of cleared cash to Payments ahead of the Fri 13 Nov 2026 payment.",
                "Attach the workbook (holdings and redemption plan) to the case file.",
            },
            HumanApprovalRequired: true,
            HumanApprovalReason: "Yes — the partial release ($10,000 of the $15,000 requested) and vulnerable-member handling need Team Leader approval before any units are sold.",
            AgentTask:
                "Plan the redemption that funds the $10,000 gross hardship release: draw cash above the 1% minimum first, then sell Balanced units, and show the balance before and after. Produce the workbook for the case file.");
    }

    private static InvestmentCaseAnalysis MeiChen(IReadOnlyList<FactSheet> sheets)
    {
        const decimal balance = 486_200m;
        const decimal cash = 12_155m;
        const decimal units = 474_045m;
        var spreadPercent = sheets.FirstOrDefault()?.BuySellSpreadPercent ?? DefaultBuySellSpreadPercent;
        var spreadCost = Round2(units * spreadPercent / 100m);               // $474.05
        var available = units - spreadCost + cash;                           // $485,725.95

        var plan = new InvestmentPlan("redemptionPlan", "Redemption plan — Mei Chen's pension portfolio to cash", new[]
        {
            new InvestmentPlanRow("1", "Sell all Caldova Managed Portfolio — Conservative units", units, "Once the binding nomination is confirmed",
                "Sold at the prices on the sale date — the value can move until then"),
            new InvestmentPlanRow("2", $"Less {FormatPercent(spreadPercent)} sell spread (est.)", -spreadCost, "At sale", "One-off transaction cost"),
            new InvestmentPlanRow("3", "Cash already in the Caldova Cash Account", cash, "Held",
                "Pension payments stopped on notification (13 Nov 2026)"),
            new InvestmentPlanRow("4", "Estimated cash for the death benefit", available, "Before market movements",
                "Payments uses the actual proceeds — 50% to Robert, 50% to Lily"),
        }, "Final amounts depend on the sale proceeds.");

        var chart = new InvestmentChart(
            "Mei Chen's pension: value at notification vs estimated cash after sale",
            "AUD",
            new[] { new InvestmentChartBar("At notification", balance, false), new InvestmentChartBar("Est. cash after sale", available, true) },
            BuildBarChartMermaid("Mei Chen's pension: value at notification vs estimated cash after sale",
                new List<(string, decimal)> { ("At notification", balance), ("Est. cash after sale", available) }, "AUD"));

        var profile = new InvestmentProfile(
            Scenario: "redemption",
            AnalysisTitle: "Redemption plan — death benefit",
            AnalysisSummary: "Redeem Mei Chen's pension portfolio (about $486,200) to cash so the death benefit can be paid 50/50 to Robert and Lily as nominated.",
            Balance: balance,
            BalanceLabel: "Pension balance at notification (indicative)",
            BalanceNote: "Caldova Pension CP-3019042 — pension payments stopped on notification",
            CurrentModel: "Caldova Managed Portfolio — Conservative (97.5%) + Caldova Cash Account (2.5%)",
            RiskProfile: "Conservative (Mei Chen's pension, adviser Marcus Tan)",
            Soa: "Pension strategy — Marcus Tan, Bayside Financial Partners",
            Holdings: new[]
            {
                new InvestmentHolding("Caldova Cash Account", cash, 2.5m),
                new InvestmentHolding("Caldova Managed Portfolio — Conservative", units, 97.5m),
            });

        return new InvestmentCaseAnalysis(
            Profile: profile,
            FactSheets: sheets,
            Options: Array.Empty<ModelOption>(),
            Comparison: null,
            Chart: chart,
            Plan: plan,
            PortfolioFit:
                "Not applicable — Mei's pension ceased on her death. The portfolio is redeemed to cash so the benefit can be paid as nominated.",
            CaseFacts: new[]
            {
                "Mei Chen died on 12 Oct 2026. Caldova Pension CP-3019042, balance about $486,200 at notification on 13 Nov 2026; pension payments stopped on notification.",
                "Binding death benefit nomination (signed 18 Mar 2024, valid to 18 Mar 2027): Robert 50%, Lily 50% — the trustee must pay as nominated.",
                "Indicative holdings: Caldova Cash Account $12,155 (2.5%), Caldova Managed Portfolio — Conservative $474,045 (97.5%).",
                "Death benefits to adult children who were not financially dependent are paid as cash lump sums — they can't be rolled over.",
                "Redeem the whole portfolio to cash and note that the final amounts depend on the sale proceeds. Bereaved family — gentle, plain language.",
            },
            Observations: new[]
            {
                "Until the units are sold the account stays invested, so its value can rise or fall — the final amounts depend on the sale proceeds.",
                $"Selling the whole portfolio costs an estimated {Money(spreadCost)} in sell spread ({FormatPercent(spreadPercent)}).",
                "The $243,100 per beneficiary on the case is indicative (50% of $486,200); Payments works out each share from the actual proceeds.",
                "Bereaved family — Client Communications is the family's single point of contact, so updates stay gentle and plain.",
            },
            ActionNote: null,
            NextSteps: new[]
            {
                "Place the sell order for all Conservative units once Benefits & Eligibility confirms the binding nomination.",
                "Pass the actual cash proceeds to Payments for each beneficiary's tax components and withholding.",
                "Every death benefit needs Team Leader approval before payment — Payments raises it.",
            },
            HumanApprovalRequired: true,
            HumanApprovalReason: "Yes — every death benefit needs Team Leader approval before payment. The redemption itself follows the trustee's duty to pay as nominated.",
            AgentTask:
                "Plan the redemption of Mei Chen's pension portfolio to cash so the death benefit can be paid as nominated (50/50 to Robert and Lily), and note that market movements until the sale change the final amounts. Produce the workbook for the case file.");
    }

    private static InvestmentCaseAnalysis Generic(CaseRecord c, IReadOnlyList<FactSheet> sheets)
    {
        var parsed = Regex.Match(c.Amount ?? string.Empty, @"\d[\d,]*(?:\.\d+)?");
        var balance = parsed.Success && decimal.TryParse(parsed.Value.Replace(",", string.Empty), NumberStyles.Number, CultureInfo.InvariantCulture, out var amt) && amt > 0
            ? amt
            : 100_000m;
        var options = new[] { ModelFor("Balanced", sheets), ModelFor("Growth", sheets), ModelFor("Index Balanced", sheets) };
        var comparison = Compare(options, balance);

        var profile = new InvestmentProfile(
            Scenario: "fee-comparison",
            AnalysisTitle: "Model fee comparison",
            AnalysisSummary: $"Compare Balanced, Growth and Index Balanced on {MoneySmart(balance)} — fees in dollars.",
            Balance: balance,
            BalanceLabel: parsed.Success ? "Amount on the case" : "Illustrative balance",
            BalanceNote: string.IsNullOrWhiteSpace(c.Amount) ? "No amount on the case — $100,000 used for illustration" : c.Amount,
            CurrentModel: "Not recorded on the case — confirm with the adviser or member",
            RiskProfile: "Not recorded on the case",
            Soa: string.IsNullOrWhiteSpace(c.AdviserPractice) ? "No SoA on file" : $"Adviser: {c.AdviserName} ({c.AdviserPractice})",
            Holdings: Array.Empty<InvestmentHolding>());

        return new InvestmentCaseAnalysis(
            Profile: profile,
            FactSheets: sheets,
            Options: options,
            Comparison: comparison,
            Chart: ChartFromComparison(comparison),
            Plan: null,
            PortfolioFit: "Needs adviser review — the case doesn't record the current model or a risk profile, so fit can't be confirmed yet.",
            CaseFacts: new[]
            {
                $"Request: {c.RequestType}. {c.RequestSummary}",
                $"Balance used for the comparison: {MoneySmart(balance)}.",
                "Compare Balanced, Growth and Index Balanced with total annual Caldova fees in dollars. Flag that the current model and risk profile need confirming.",
            },
            Observations: comparison.Observations,
            ActionNote: null,
            NextSteps: new[]
            {
                "Confirm the client's current model and risk profile with the adviser (or the member, for direct members).",
                "Share the workbook so the fee trade-offs are visible in dollars.",
            },
            HumanApprovalRequired: true,
            HumanApprovalReason: "Yes — the current investment and risk profile aren't recorded on the case; confirm them before any change.",
            AgentTask:
                "Compare Balanced, Growth and Index Balanced on the case amount with fees in dollars, and flag that the client's current model and risk profile must be confirmed.");
    }

    private static ModelOption ModelFor(string name, IReadOnlyList<FactSheet> sheets, bool selected = false, string? note = null)
    {
        var sheet = sheets.FirstOrDefault(s => string.Equals(s.ShortName, name, StringComparison.OrdinalIgnoreCase));
        if (sheet is not null)
            return OptionFromFactSheet(sheet, selected, note);

        var m = ModelMenu.First(x => string.Equals(x.Name, name, StringComparison.OrdinalIgnoreCase));
        return new ModelOption(m.Name, m.Code, selected, m.Growth, 100m - m.Growth, m.Icr, m.Style, note, null,
            Array.Empty<ModelComponent>(), null);
    }

    private static InvestmentChart ChartFromComparison(ModelComparison comparison) => new(
        $"Total Caldova fees per year on {MoneySmart(comparison.Balance)}",
        "AUD per year",
        comparison.Rows.Select(r => new InvestmentChartBar(r.Selected ? $"{r.Name} (selected)" : r.Name, r.TotalFee, r.Selected)).ToList(),
        comparison.ChartMermaid);

    private static IReadOnlyList<string> WithExtras(IReadOnlyList<string> observations, params string[] extras)
    {
        var list = observations.ToList();
        var warningIndex = list.FindIndex(o => o == PastPerformanceWarning);
        if (warningIndex >= 0) list.InsertRange(warningIndex, extras);
        else list.AddRange(extras);
        return list;
    }

    // ─────────────────────────────────────────────────────────────────────
    // Tool inputs (same JSON the agent would send to the MCP tools)
    // ─────────────────────────────────────────────────────────────────────

    private static string BuildModelsJson(InvestmentCaseAnalysis a) => Serialize(new
    {
        balance = a.Profile.Balance,
        options = a.Options.Select(OptionPayload),
        factSheets = a.FactSheets
    });

    private static object OptionPayload(ModelOption o) => new
    {
        name = o.Name,
        code = o.Code,
        selected = o.Selected,
        growthPercent = o.GrowthPercent,
        icrPercent = o.Components.Count > 0 ? null : o.IcrPercent,
        style = o.Style,
        note = o.Note,
        components = o.Components.Count == 0 ? null : o.Components.Select(c => new
        {
            label = c.Label,
            amount = c.Amount,
            icrPercent = c.IcrPercent,
            growthPercent = c.GrowthPercent
        })
    };

    private static string BuildCaseSummaryJson(CaseRecord c, InvestmentCaseAnalysis a) => Serialize(new
    {
        client = c.ClientName,
        memberNumber = c.MemberNumber,
        product = c.Product,
        requestType = c.RequestType,
        received = c.ReceivedDate,
        adviser = AdviserText(c),
        riskProfile = a.Profile.RiskProfile,
        statementOfAdvice = a.Profile.Soa,
        currentOrSelectedModel = a.Profile.CurrentModel,
        balance = a.Profile.Balance,
        balanceBasis = $"{a.Profile.BalanceLabel} — {a.Profile.BalanceNote}",
        analysis = $"{a.Profile.AnalysisTitle}: {a.Profile.AnalysisSummary}",
        holdings = a.Profile.Holdings.Count == 0
            ? null
            : a.Profile.Holdings.Select(h => new { holding = h.Holding, value = h.Value, sharePercent = h.Percent })
    });

    private static string BuildRecommendationsJson(InvestmentCaseAnalysis a)
    {
        var fields = new Dictionary<string, object?>
        {
            ["portfolioFit"] = a.PortfolioFit,
            ["investmentAction"] = a.ActionNote ?? a.Profile.AnalysisTitle,
            ["observations"] = a.Observations,
            ["nextSteps"] = a.NextSteps,
            ["humanApprovalRequired"] = a.HumanApprovalReason
        };
        if (a.Plan is not null)
        {
            fields[a.Plan.Key] = a.Plan.Rows.Select(r => new
            {
                step = r.Step,
                item = r.Item,
                amount = r.Amount,
                timing = r.Timing,
                note = r.Note
            });
        }
        return Serialize(fields);
    }

    private static InvestmentWorkbookInfo ParseWorkbookResult(string json)
    {
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (root.TryGetProperty("error", out var err))
                return new InvestmentWorkbookInfo(null, null, Array.Empty<string>(), err.GetString());

            var sheets = root.TryGetProperty("sheets", out var s) && s.ValueKind == System.Text.Json.JsonValueKind.Array
                ? s.EnumerateArray().Select(x => x.GetString() ?? string.Empty).ToArray()
                : Array.Empty<string>();
            return new InvestmentWorkbookInfo(
                root.GetProperty("fileName").GetString(),
                root.GetProperty("downloadUrl").GetString(),
                sheets,
                null);
        }
        catch (Exception ex)
        {
            return new InvestmentWorkbookInfo(null, null, Array.Empty<string>(), ex.Message);
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Prompt
    // ─────────────────────────────────────────────────────────────────────

    private static string BuildPrompt(
        CaseRecord c,
        InvestmentCaseAnalysis a,
        bool mcpEnabled,
        IReadOnlyList<(string Url, string Json)> factSheetResults,
        string modelsJson,
        string? compareJson,
        string caseSummaryJson,
        string workbookJson)
    {
        var p = a.Profile;
        var sb = new StringBuilder();
        sb.AppendLine("MEMBER CASE FOR INVESTMENT REVIEW");
        sb.AppendLine("=================================");
        sb.AppendLine($"Case number   : {c.CaseNumber}");
        sb.AppendLine($"Client        : {c.ClientName}");
        sb.AppendLine($"Member number : {c.MemberNumber}");
        sb.AppendLine($"Product       : {c.Product}");
        sb.AppendLine($"Request type  : {c.RequestType}");
        sb.AppendLine($"Received      : {c.ReceivedDate}");
        sb.AppendLine($"Adviser       : {AdviserText(c)}");
        sb.AppendLine($"Priority      : {c.Priority} — {c.PriorityReason}");
        sb.AppendLine();
        sb.AppendLine("REQUEST SUMMARY");
        sb.AppendLine("---------------");
        sb.AppendLine(c.RequestSummary);
        sb.AppendLine();
        sb.AppendLine("INVESTMENT PROFILE");
        sb.AppendLine("------------------");
        sb.AppendLine($"Balance for analysis : {MoneySmart(p.Balance)} — {p.BalanceLabel} ({p.BalanceNote})");
        sb.AppendLine($"Current / selected   : {p.CurrentModel}");
        sb.AppendLine($"Risk profile         : {p.RiskProfile}");
        sb.AppendLine($"Statement of Advice  : {p.Soa}");
        sb.AppendLine($"Analysis required    : {p.AnalysisTitle}");
        sb.AppendLine();
        sb.AppendLine("CASE FACTS");
        sb.AppendLine("----------");
        foreach (var fact in a.CaseFacts) sb.AppendLine($"- {fact}");
        sb.AppendLine();
        sb.AppendLine("ANALYSIS TASK");
        sb.AppendLine("-------------");
        sb.AppendLine(a.AgentTask);
        sb.AppendLine();

        if (factSheetResults.Count > 0)
        {
            sb.AppendLine("FACT SHEETS");
            sb.AppendLine("-----------");
            foreach (var (url, _) in factSheetResults) sb.AppendLine($"- {url}");
            sb.AppendLine();
        }

        if (a.Options.Count > 0)
        {
            sb.AppendLine($"OPTIONS TO COMPARE (modelsJson for compareModels; balance = {p.Balance.ToString(CultureInfo.InvariantCulture)})");
            sb.AppendLine("----------------------------------------------------------------------");
            sb.AppendLine(Serialize(a.Options.Select(OptionPayload)));
            sb.AppendLine();
        }

        var plainSections = BuildPlanAndChartMarkdown(a);

        if (mcpEnabled)
        {
            sb.AppendLine("TASK (use your MCP tools)");
            sb.AppendLine("-------------------------");
            sb.AppendLine("1. Call analyzeFactSheet for each fact sheet listed above.");
            if (a.Options.Count > 0)
            {
                sb.AppendLine($"2. Call compareModels with the OPTIONS JSON above as modelsJson and balance {p.Balance.ToString(CultureInfo.InvariantCulture)}.");
                sb.AppendLine("   Embed the returned comparisonMarkdown table and the chartMermaid ```mermaid``` block verbatim in your");
                sb.AppendLine("   \"Model Comparison\" section.");
            }
            else
            {
                sb.AppendLine("2. Do NOT call compareModels — no model comparison is needed for this case. In \"Model Comparison\" say so");
                sb.AppendLine("   and embed the holdings table and the ```mermaid``` chart below (if any) verbatim.");
            }
            sb.AppendLine("3. Call generateClientWorkbook with caseNumber, the CASE SUMMARY JSON below as caseSummaryJson, the same");
            sb.AppendLine("   modelsJson (or [] when there is nothing to compare) and a recommendationsJson that includes your plan");
            sb.AppendLine("   as an array of rows. Put the returned downloadUrl in \"Next Steps\" as a markdown link.");
            sb.AppendLine("4. Write your report in the required output format.");
            sb.AppendLine();
            sb.AppendLine("CASE SUMMARY JSON (caseSummaryJson for generateClientWorkbook)");
            sb.AppendLine("-------------------------------------------------------------");
            sb.AppendLine(caseSummaryJson);
            sb.AppendLine();
            if (plainSections.Length > 0)
            {
                sb.AppendLine("PRE-COMPUTED PLAN / HOLDINGS / CHART (embed verbatim where relevant)");
                sb.AppendLine("-------------------------------------------------------------------");
                sb.AppendLine(plainSections);
                sb.AppendLine();
            }
        }
        else
        {
            sb.AppendLine("MCP TOOL RESULTS (pre-resolved for you in this session)");
            sb.AppendLine("=======================================================");
            sb.AppendLine("The Investment Solutions service has already run these tools on your behalf — do NOT call them");
            sb.AppendLine("again. Use the results directly.");
            sb.AppendLine();
            foreach (var (url, json) in factSheetResults)
            {
                sb.AppendLine($"▶ analyzeFactSheet(\"{url}\") result:");
                sb.AppendLine(json);
                sb.AppendLine();
            }
            if (compareJson is not null)
            {
                sb.AppendLine($"▶ compareModels(modelsJson, {p.Balance.ToString(CultureInfo.InvariantCulture)}) result:");
                sb.AppendLine(compareJson);
                sb.AppendLine();
            }
            if (plainSections.Length > 0)
            {
                sb.AppendLine("▶ Pre-computed plan, holdings and chart (markdown):");
                sb.AppendLine(plainSections);
                sb.AppendLine();
            }
            sb.AppendLine("▶ generateClientWorkbook(caseNumber, caseSummaryJson, modelsJson, recommendationsJson) result:");
            sb.AppendLine(workbookJson);
            sb.AppendLine();
            sb.AppendLine("TASK");
            sb.AppendLine("----");
            if (compareJson is not null)
                sb.AppendLine("1. In \"Model Comparison\", embed compareModels.comparisonMarkdown and compareModels.chartMermaid verbatim.");
            else
                sb.AppendLine("1. In \"Model Comparison\", say that no comparison is needed and embed the holdings table and chart above (if any) verbatim.");
            sb.AppendLine("2. Use the pre-computed plan for \"Income / Redemption Plan\" where one is provided.");
            sb.AppendLine("3. In \"Next Steps\", include the workbook downloadUrl as a markdown link: [Download the client workbook](<downloadUrl>).");
            sb.AppendLine("4. Write your report in the required output format.");
            sb.AppendLine();
        }

        sb.AppendLine("Remember: facts and comparisons only — no personal financial advice (the adviser recommends and the client");
        sb.AppendLine("instructs). Include the past-performance warning whenever returns are mentioned. Cite the fact sheets and");
        sb.AppendLine("Caldova rule documents you rely on (e.g. \"Caldova Managed Portfolios menu\", \"Caldova fee schedule\").");
        return sb.ToString();
    }

    private static string BuildPlanAndChartMarkdown(InvestmentCaseAnalysis a)
    {
        var sb = new StringBuilder();
        if (a.Profile.Holdings.Count > 0)
        {
            sb.AppendLine("Holdings:");
            sb.AppendLine(HoldingsMarkdown(a.Profile.Holdings));
            sb.AppendLine();
        }
        if (a.Plan is not null)
        {
            sb.AppendLine($"{a.Plan.Title}:");
            sb.AppendLine(PlanMarkdown(a.Plan));
            sb.AppendLine();
        }
        if (a.Comparison is null && a.Chart is not null)
        {
            sb.AppendLine(a.Chart.MermaidBlock);
        }
        return sb.ToString().TrimEnd();
    }

    // ─────────────────────────────────────────────────────────────────────
    // Deterministic narrative (used when the live agent isn't available)
    // ─────────────────────────────────────────────────────────────────────

    private static string BuildFallbackNarrative(
        CaseRecord c, InvestmentCaseAnalysis a, InvestmentWorkbookInfo workbook, string? agentError, bool agentConfigured)
    {
        var preface = !agentConfigured
            ? "_Foundry agent is not configured in this environment, so this is Ivy's deterministic analysis — the same calculations the MCP tools run on the case and the fact sheets._"
            : !string.IsNullOrWhiteSpace(agentError)
                ? $"_The Investment Analyst Agent did not return a report ({agentError}). Showing Ivy's deterministic analysis instead._"
                : "_The Investment Analyst Agent finished without narrative text (it may only have called tools). Showing Ivy's deterministic analysis instead._";

        var sb = new StringBuilder();
        sb.AppendLine(preface);
        sb.AppendLine();
        sb.AppendLine($"### Investment review — {c.CaseNumber} · {c.ClientName}");
        sb.AppendLine();
        sb.AppendLine($"**{a.Profile.AnalysisTitle}.** {a.Profile.AnalysisSummary}");
        sb.AppendLine();

        sb.AppendLine("#### 1. Portfolio Fit");
        sb.AppendLine(a.PortfolioFit);
        if (a.ActionNote is not null)
        {
            sb.AppendLine();
            sb.AppendLine($"> **{a.ActionNote}**");
        }
        sb.AppendLine();

        sb.AppendLine("#### 2. Model Comparison");
        if (a.Comparison is not null)
        {
            sb.AppendLine("Total annual Caldova fees in dollars:");
            sb.AppendLine();
            sb.AppendLine(a.Comparison.ComparisonMarkdown);
            sb.AppendLine();
            sb.AppendLine(a.Comparison.ChartMermaid);
        }
        else
        {
            sb.AppendLine(a.Profile.Scenario == "no-action"
                ? "No model comparison — no investment action is taken while the account is on hold. Holdings at the time of the hold:"
                : "No model comparison is needed — the existing investment stays as it is. Holdings today:");
            if (a.Profile.Holdings.Count > 0)
            {
                sb.AppendLine();
                sb.AppendLine(HoldingsMarkdown(a.Profile.Holdings));
            }
            if (a.Chart is not null)
            {
                sb.AppendLine();
                sb.AppendLine(a.Chart.MermaidBlock);
            }
        }
        sb.AppendLine();

        sb.AppendLine("#### 3. Income / Redemption Plan");
        if (a.Plan is not null)
        {
            sb.AppendLine($"**{a.Plan.Title}**");
            sb.AppendLine();
            sb.AppendLine(PlanMarkdown(a.Plan));
            if (!string.IsNullOrWhiteSpace(a.Plan.Note))
            {
                sb.AppendLine();
                sb.AppendLine($"_{a.Plan.Note}_");
            }
        }
        else
        {
            sb.AppendLine("No income or redemption plan is needed for this case.");
        }
        sb.AppendLine();

        sb.AppendLine("#### 4. Observations & Risks");
        foreach (var o in a.Observations) sb.AppendLine($"- {o}");
        sb.AppendLine();

        sb.AppendLine("#### 5. Next Steps");
        foreach (var step in a.NextSteps) sb.AppendLine($"- {step}");
        if (workbook.DownloadUrl is not null)
            sb.AppendLine($"- [Download the client workbook (.xlsx)]({workbook.DownloadUrl}) — {string.Join(", ", workbook.Sheets)}.");
        else if (workbook.Error is not null)
            sb.AppendLine($"- The client workbook could not be generated ({workbook.Error}).");
        sb.AppendLine();

        sb.AppendLine("#### 6. Human Approval Required");
        sb.AppendLine(a.HumanApprovalReason);
        sb.AppendLine();
        sb.Append("_Sources: Caldova Managed Portfolios menu and fact sheets; Caldova fee schedule. General information only — not personal financial advice._");
        return sb.ToString();
    }

    private static string HoldingsMarkdown(IReadOnlyList<InvestmentHolding> holdings)
    {
        var sb = new StringBuilder();
        sb.AppendLine("| Holding | Value | Share |");
        sb.AppendLine("|---|--:|--:|");
        foreach (var h in holdings)
            sb.AppendLine($"| {EscapeMd(h.Holding)} | {MoneySmart(h.Value)} | {h.Percent.ToString("0.0", CultureInfo.InvariantCulture)}% |");
        sb.Append($"| **Total** | **{MoneySmart(holdings.Sum(h => h.Value))}** | 100% |");
        return sb.ToString();
    }

    private static string PlanMarkdown(InvestmentPlan plan)
    {
        var sb = new StringBuilder();
        sb.AppendLine("| Step | Item | Amount | Timing / status | Note |");
        sb.AppendLine("|:-:|---|--:|---|---|");
        foreach (var r in plan.Rows)
        {
            sb.AppendLine($"| {r.Step} | {EscapeMd(r.Item)} | {(r.Amount is decimal amt ? MoneySmart(amt) : "—")} | " +
                          $"{EscapeMd(r.Timing)} | {EscapeMd(r.Note)} |");
        }
        return sb.ToString().TrimEnd();
    }

    // ─────────────────────────────────────────────────────────────────────
    // Offline chat
    // ─────────────────────────────────────────────────────────────────────

    private static string OfflineChatReply(CaseRecord? c, InvestmentCaseAnalysis? a, string message)
    {
        if (c is null || a is null)
        {
            return "I can answer questions about a specific Member Case once one is selected — pick a case in step 1 and engage me in step 3 first.";
        }

        var q = message.ToLowerInvariant();
        // Word-start matching, so "fit" matches "fits" but not "benefit".
        bool Has(params string[] words) => words.Any(w => Regex.IsMatch(q, @"\b" + Regex.Escape(w)));

        if (Has("should", "recommend", "switch", "change model", "better", "advice", "advise"))
        {
            var facts = a.Comparison is null
                ? a.PortfolioFit
                : $"{a.PortfolioFit} The lowest-cost option compared is {a.Comparison.Summary.LowestCostOption} at {Money(a.Comparison.Summary.LowestTotal)} p.a.";
            return "I can't give personal financial advice — choosing or changing an investment is a decision for the adviser and " +
                   $"the client. Here are the facts I can share.\n\n{facts}";
        }

        if (Has("hold", "frozen", "freeze", "scam", "fraud", "takeover", "suspicious"))
        {
            return a.ActionNote ?? "There's no investment hold on this case. " + a.Profile.AnalysisSummary;
        }

        if (Has("plan", "bucket", "income", "sequenc", "drawdown", "redeem", "redemption", "sell", "unit", "raise",
                "fund the", "withdraw", "proceeds", "spread"))
        {
            if (a.Plan is null)
                return "No income or redemption plan is needed on this case. " + a.Profile.AnalysisSummary;

            var rows = a.Plan.Rows.Select(r => $"- **{r.Step}. {r.Item}**{(r.Amount is decimal amt ? $" — {MoneySmart(amt)}" : string.Empty)} ({r.Timing}). {r.Note}");
            var reply = $"**{a.Plan.Title}**\n\n{string.Join("\n", rows)}" +
                        (string.IsNullOrWhiteSpace(a.Plan.Note) ? string.Empty : $"\n\n_{a.Plan.Note}_");
            if (a.Profile.Scenario == "income-strategy")
            {
                reply += "\n\nIf markets fall, the cash bucket keeps the $6,500 monthly payments flowing for up to two years without " +
                         "selling Balanced units at low prices (sequencing risk). The bucket is refilled from Balanced at reviews — the adviser's call.";
            }
            return reply;
        }

        if (Has("fee", "cost", "cheap", "expens", "dollar", "price", "icr"))
        {
            if (a.Comparison is null)
                return $"This case doesn't need a fee comparison. {a.Profile.AnalysisSummary} For reference, the Caldova admin fee is tiered " +
                       "(0.30% on the first $250,000, 0.15% to $1,000,000, 0.05% to $2,000,000, nil above) plus $180 p.a., and the " +
                       "0.10% buy/sell spread applies to any units sold.";
            var lines = a.Comparison.Rows.Select(r =>
                $"- **{r.Name}{(r.Selected ? " (selected)" : string.Empty)}** — {Money(r.TotalFee)} p.a. " +
                $"(investment fee {Money(r.InvestmentFee)} + admin and account-keeping {Money(r.AdminAndAccountKeepingFee)})");
            return $"Total annual Caldova fees on {MoneySmart(a.Comparison.Balance)}:\n\n{string.Join("\n", lines)}\n\n" +
                   $"Admin fee working: {a.Comparison.FeeBasis.AdminFeeWorking}, plus the $180 account-keeping fee. These figures " +
                   "exclude any adviser fee and the 0.10% buy/sell spread.";
        }

        if (Has("return", "perform", "past"))
        {
            var lines = a.FactSheets
                .Where(fs => fs.Returns is not null)
                .Select(fs => $"- **{fs.ShortName}** — 1 year {Pct(fs.Returns!.OneYearPercent)}, 3 years {Pct(fs.Returns.ThreeYearPercentPa)} p.a., " +
                              $"5 years {Pct(fs.Returns.FiveYearPercentPa)} p.a. (to {FormatDate(fs.Returns.PeriodEnding ?? fs.AsAt)})");
            return "Illustrative model returns, net of investment fees and before admin fees and tax:\n\n" +
                   string.Join("\n", lines) + $"\n\n{PastPerformanceWarning}";
        }

        if (Has("risk", "fit", "profile", "soa", "suitab", "timeframe"))
        {
            var sheet = a.FactSheets.FirstOrDefault();
            var risk = sheet is null
                ? string.Empty
                : $"\n\n{sheet.ShortName}: growth/defensive {sheet.GrowthDefensive}, standard risk measure {sheet.RiskBand} — {sheet.RiskLabel} " +
                  $"({sheet.NegativeYearsIn20} negative years in 20), minimum suggested timeframe {sheet.MinimumTimeframeYears} years.";
            return $"{a.PortfolioFit}{risk}\n\nRecorded risk profile: {a.Profile.RiskProfile}. {a.Profile.Soa}.";
        }

        if (Has("workbook", "excel", "xlsx", "spreadsheet", "download"))
        {
            return "The client workbook was generated when you engaged me — use the **Download workbook** link in step 3. It has the case " +
                   "summary, the comparison or plan, fact-sheet details and asset allocation, and my recommendations for adviser review.";
        }

        if (Has("approv", "human", "sign off", "sign-off"))
        {
            return a.HumanApprovalReason;
        }

        return $"Here's where this case stands: {a.Profile.AnalysisSummary} {a.PortfolioFit}\n\n" +
               "You can ask me about the **fees** in dollars, the **returns** shown on the fact sheets, **risk** and fit with the SoA, " +
               "the **income** or **redemption** plan, the **workbook**, or what needs **approval**.";
    }

    private static string Pct(decimal? v) => v is decimal d ? d.ToString("0.0", CultureInfo.InvariantCulture) + "%" : "n/a";

    // ─────────────────────────────────────────────────────────────────────
    // JSON views for the page
    // ─────────────────────────────────────────────────────────────────────

    private static object ProfileView(InvestmentCaseAnalysis a)
    {
        var p = a.Profile;
        return new
        {
            scenario = p.Scenario,
            analysisTitle = p.AnalysisTitle,
            analysisSummary = p.AnalysisSummary,
            balance = p.Balance,
            balanceDisplay = MoneySmart(p.Balance),
            balanceLabel = p.BalanceLabel,
            balanceNote = p.BalanceNote,
            currentModel = p.CurrentModel,
            riskProfile = p.RiskProfile,
            soa = p.Soa,
            holdings = HoldingsView(p.Holdings),
            factSheets = a.FactSheets.Select(FactSheetView)
        };
    }

    private static object AnalysisView(InvestmentCaseAnalysis a) => new
    {
        kind = a.Profile.Scenario,
        title = a.Profile.AnalysisTitle,
        summary = a.Profile.AnalysisSummary,
        balance = a.Profile.Balance,
        balanceDisplay = MoneySmart(a.Profile.Balance),
        balanceLabel = a.Profile.BalanceLabel,
        portfolioFit = a.PortfolioFit,
        actionNote = a.ActionNote,
        comparison = a.Comparison is null ? null : new
        {
            balance = a.Comparison.Balance,
            feeBasis = a.Comparison.FeeBasis,
            summary = a.Comparison.Summary,
            markdown = a.Comparison.ComparisonMarkdown,
            rows = a.Comparison.Rows.Select(r => new
            {
                name = r.Name,
                code = r.Code,
                selected = r.Selected,
                growthDefensive = r.GrowthDefensive,
                icrLabel = r.IcrLabel,
                investmentFee = r.InvestmentFee,
                investmentFeeDisplay = Money(r.InvestmentFee),
                adminAndAccountKeepingFee = r.AdminAndAccountKeepingFee,
                adminAndAccountKeepingFeeDisplay = Money(r.AdminAndAccountKeepingFee),
                totalFee = r.TotalFee,
                totalFeeDisplay = Money(r.TotalFee),
                totalFeePercent = r.TotalFeePercent,
                differenceVsLowest = r.DifferenceVsLowest,
                differenceVsLowestDisplay = Money(r.DifferenceVsLowest),
                components = r.Components,
                note = r.Note
            })
        },
        chart = a.Chart is null ? null : new
        {
            title = a.Chart.Title,
            yAxis = a.Chart.YAxis,
            // Fee charts show cents ($6,930.00); balance charts show whole dollars.
            bars = a.Chart.Bars.Select(b => new
            {
                label = b.Label,
                value = b.Value,
                display = a.Comparison is not null ? Money(b.Value) : MoneySmart(b.Value),
                highlight = b.Highlight
            }),
            mermaid = StripMermaidFence(a.Chart.MermaidBlock)
        },
        plan = a.Plan is null ? null : new
        {
            title = a.Plan.Title,
            note = a.Plan.Note,
            rows = a.Plan.Rows.Select(r => new
            {
                step = r.Step,
                item = r.Item,
                amount = r.Amount,
                amountDisplay = r.Amount is decimal amt ? MoneySmart(amt) : "—",
                timing = r.Timing,
                note = r.Note
            })
        },
        holdings = HoldingsView(a.Profile.Holdings),
        observations = a.Observations,
        nextSteps = a.NextSteps,
        humanApprovalRequired = a.HumanApprovalRequired,
        humanApprovalReason = a.HumanApprovalReason
    };

    private static object HoldingsView(IReadOnlyList<InvestmentHolding> holdings) => holdings.Select(h => new
    {
        holding = h.Holding,
        value = h.Value,
        valueDisplay = MoneySmart(h.Value),
        percent = h.Percent
    });

    private static object FactSheetView(FactSheet fs) => new
    {
        name = fs.Name,
        shortName = fs.ShortName,
        code = fs.Code,
        url = fs.Source,
        icrPercent = fs.InvestmentFeePercent,
        growthDefensive = fs.GrowthDefensive,
        riskBand = fs.RiskBand,
        riskLabel = fs.RiskLabel,
        timeframeYears = fs.MinimumTimeframeYears,
        preview = BuildFactSheetPreview(fs)
    };

    /// <summary>Plain-text summary of a fact sheet for the hover popovers.</summary>
    internal static string BuildFactSheetPreview(FactSheet fs)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"Growth / defensive {fs.GrowthDefensive} · {fs.Style ?? "Multi-asset"}");
        sb.AppendLine($"Investment fee (ICR) {(fs.InvestmentFeePercent is decimal icr ? FormatPercent(icr) : "n/a")} p.a. · " +
                      $"buy/sell spread {(fs.BuySellSpreadPercent is decimal s ? FormatPercent(s) : "n/a")}");
        if (fs.RiskBand is int band)
            sb.AppendLine($"Standard risk measure {band} — {fs.RiskLabel} ({fs.NegativeYearsIn20} negative years in 20)");
        if (fs.MinimumTimeframeYears is int years)
            sb.AppendLine($"Minimum suggested timeframe {years} years");
        if (fs.AssetAllocation.Count > 0)
        {
            sb.AppendLine();
            sb.AppendLine("Target allocation");
            foreach (var a in fs.AssetAllocation)
                sb.AppendLine($"  {a.AssetClass} {a.TargetPercent.ToString("0.#", CultureInfo.InvariantCulture)}%");
        }
        if (fs.Returns is { } r)
        {
            sb.AppendLine();
            sb.AppendLine($"Returns to {FormatDate(r.PeriodEnding ?? fs.AsAt)} (illustrative)");
            sb.AppendLine($"  1 yr {Pct(r.OneYearPercent)} · 3 yrs {Pct(r.ThreeYearPercentPa)} p.a. · 5 yrs {Pct(r.FiveYearPercentPa)} p.a.");
            sb.Append(r.Warning);
        }
        return sb.ToString().TrimEnd();
    }

    private static string FormatDate(string? iso) =>
        DateTime.TryParse(iso, CultureInfo.InvariantCulture, DateTimeStyles.None, out var d)
            ? d.ToString("d MMM yyyy", AuCulture)
            : iso ?? "n/a";

    private static string StripMermaidFence(string block) =>
        block.Replace("```mermaid", string.Empty).Replace("```", string.Empty).Trim();

    private static string AdviserText(CaseRecord c) =>
        string.IsNullOrWhiteSpace(c.AdviserPractice) ? c.AdviserName : $"{c.AdviserName} ({c.AdviserPractice})";

    private static string Sanitize(string value) => value.Replace('\r', ' ').Replace('\n', ' ');
}

// ─────────────────────────────────────────────────────────────────────────
// Investment case shapes
// ─────────────────────────────────────────────────────────────────────────

internal sealed record InvestmentHolding(string Holding, decimal Value, decimal Percent);

internal sealed record InvestmentPlanRow(string Step, string Item, decimal? Amount, string Timing, string Note);

internal sealed record InvestmentPlan(string Key, string Title, IReadOnlyList<InvestmentPlanRow> Rows, string? Note);

internal sealed record InvestmentChartBar(string Label, decimal Value, bool Highlight);

internal sealed record InvestmentChart(string Title, string YAxis, IReadOnlyList<InvestmentChartBar> Bars, string MermaidBlock);

internal sealed record InvestmentWorkbookInfo(string? FileName, string? DownloadUrl, IReadOnlyList<string> Sheets, string? Error);

/// <summary>What Ivy reviews before engaging: balance, model, risk profile and SoA.</summary>
internal sealed record InvestmentProfile(
    string Scenario,
    string AnalysisTitle,
    string AnalysisSummary,
    decimal Balance,
    string BalanceLabel,
    string BalanceNote,
    string CurrentModel,
    string RiskProfile,
    string Soa,
    IReadOnlyList<InvestmentHolding> Holdings);

/// <summary>The full deterministic analysis of one Member Case.</summary>
internal sealed record InvestmentCaseAnalysis(
    InvestmentProfile Profile,
    IReadOnlyList<FactSheet> FactSheets,
    IReadOnlyList<ModelOption> Options,
    ModelComparison? Comparison,
    InvestmentChart? Chart,
    InvestmentPlan? Plan,
    string PortfolioFit,
    IReadOnlyList<string> CaseFacts,
    IReadOnlyList<string> Observations,
    string? ActionNote,
    IReadOnlyList<string> NextSteps,
    bool HumanApprovalRequired,
    string HumanApprovalReason,
    string AgentTask);
