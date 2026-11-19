using System.Text;
using System.Text.Json;
using CaldovaSuper.Agents;
using CaldovaSuper.App.Models;
using CaldovaSuper.App.Services;

namespace CaldovaSuper.App.Api;

record BenefitsProcessRequest(string CaseNumber);

/// <summary>
/// HTTP endpoints behind the "Try it out" tab on the Benefits &amp;
/// Eligibility agent page (<c>/agents/benefits-eligibility</c>). They let
/// the page:
///
/// 1. List the Member Cases in the <see cref="CaseStore"/> (the five seeded
///    scenario cases plus any opened live by the Onboarding demo).
/// 2. Show one case and the rule documents (PDS, trust deed, super-law and
///    tax rule summaries, authority matrix) that apply to it.
/// 3. Engage the Foundry <see cref="BenefitsEligibilityAgent"/> on the case
///    and return its narrative plus the eligibility checklist parsed from
///    the trailing <c>```json</c> block it emits (recommendation,
///    recommendationLabel, recommendationReason, outcomeSummary, items).
///    When Foundry isn't configured, the call fails or the JSON block is
///    missing, the deterministic report from
///    <see cref="ProductDocumentCatalog"/> is returned instead.
/// </summary>
public static class BenefitsApi
{
    public static void MapBenefitsEndpoints(
        this WebApplication app,
        CaseStore store,
        CaldovaAgentFactory factory,
        ILogger logger)
    {
        // Dropdown source — every Member Case currently held in memory.
        app.MapGet("/benefits/cases", () =>
        {
            var cases = store.All().Select(r => new
            {
                caseNumber = r.CaseNumber,
                sampleId = r.SampleId,
                clientName = r.ClientName,
                memberNumber = r.MemberNumber,
                product = r.Product,
                requestType = r.RequestType,
                receivedDate = r.ReceivedDate,
                priority = r.Priority,
                createdAt = r.CreatedAt
            });
            return Results.Ok(cases);
        });

        // Full Member Case, rendered on the page before the agent is engaged.
        app.MapGet("/benefits/cases/{caseNumber}", (string caseNumber) =>
        {
            var record = store.Get(caseNumber);
            return record is null
                ? Results.NotFound(new { error = $"case '{caseNumber}' not found" })
                : Results.Ok(record);
        });

        // Every rule document in the catalogue (diagnostics / reference).
        app.MapGet("/benefits/rules", () => Results.Ok(ProductDocumentCatalog.All));

        // The rule documents applied to one case, plus the clause ids its
        // eligibility checklist tests, so the page can show exactly which
        // rules the agent is about to apply.
        app.MapGet("/benefits/rules/{caseNumber}", (string caseNumber) =>
        {
            var record = store.Get(caseNumber);
            if (record is null)
                return Results.NotFound(new { error = $"case '{caseNumber}' not found" });

            var report = ProductDocumentCatalog.BuildReport(record);
            return Results.Ok(new
            {
                caseNumber = record.CaseNumber,
                documents = ProductDocumentCatalog.DocumentsFor(report),
                checkedClauses = report.Items.Select(i => i.ClauseRef).Distinct().ToArray()
            });
        });

        // Deterministic eligibility report for a case — the same shape as the
        // agent's JSON block plus the working used for the offline narrative.
        app.MapGet("/benefits/checklist/{caseNumber}", (string caseNumber) =>
        {
            var record = store.Get(caseNumber);
            if (record is null)
                return Results.NotFound(new { error = $"case '{caseNumber}' not found" });

            var report = ProductDocumentCatalog.BuildReport(record);
            return Results.Ok(new
            {
                caseNumber = report.CaseNumber,
                recommendation = report.Recommendation.ToString(),
                recommendationLabel = report.RecommendationLabel,
                recommendationReason = report.RecommendationReason,
                outcomeSummary = report.OutcomeSummary,
                items = ProjectItems(report),
                source = "deterministic",
                ruleDocumentIds = report.RuleDocumentIds,
                calculations = report.Calculations,
                missingInformation = report.MissingInformation,
                plainEnglishExplanation = report.PlainEnglishExplanation,
                humanApproval = report.HumanApproval
            });
        });

        // Engage the Benefits & Eligibility Agent on the selected case. The
        // prompt carries the case, the applicable rule documents and the
        // checklist ids + clause refs so the agent's JSON lines up with the
        // UI. Send `Accept: text/event-stream` for a live SSE stream;
        // otherwise a single JSON envelope is returned.
        app.MapPost("/benefits/process", async (HttpContext httpContext, BenefitsProcessRequest request) =>
        {
            if (string.IsNullOrWhiteSpace(request.CaseNumber))
                return Results.BadRequest(new { error = "caseNumber is required" });

            var record = store.Get(request.CaseNumber);
            if (record is null)
                return Results.NotFound(new { error = $"case '{request.CaseNumber}' not found" });

            logger.LogInformation("Benefits process: caseNumber={CaseNumber}", Sanitize(record.CaseNumber));

            var report = ProductDocumentCatalog.BuildReport(record);
            var documents = ProductDocumentCatalog.DocumentsFor(report);
            var prompt = BuildPrompt(record, report, documents);

            object BuildEnvelope(AgentTraceResult? trace, string? agentError)
            {
                var rawText = trace?.Text;

                // Prefer the agent's own checklist; fall back to the
                // deterministic report when it is missing or unparseable.
                var checklist = TryExtractAgentChecklist(rawText, report)
                    ?? ProjectReport(report, "deterministic");

                // The narrative tab shows the prose only; the JSON block is
                // still available unmodified in agentRawOutput.text.
                var notes = StripTrailingJsonFence(rawText);
                var narrativeSource = "agent";
                if (string.IsNullOrWhiteSpace(notes))
                {
                    notes = BuildFallbackNarrative(report, documents);
                    narrativeSource = "deterministic";
                }

                return new
                {
                    caseNumber = record.CaseNumber,
                    agentNotes = notes,
                    narrativeSource,
                    agentConfigured = factory.IsConfigured,
                    agentError,
                    agentInput = trace?.Input,
                    agentChecklistReport = checklist,
                    ruleDocumentIds = report.RuleDocumentIds,
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
                var (streamingAgent, createError) = TryCreateAgent(factory, logger);
                await AgentSseStreaming.StreamAsync(httpContext, streamingAgent, prompt,
                    (trace, error) => BuildEnvelope(trace, error ?? createError), logger, "Benefits & Eligibility Agent");
                return Results.Empty;
            }

            AgentTraceResult? traceResult = null;
            string? agentInvocationError = null;
            if (factory.IsConfigured)
            {
                try
                {
                    var agent = factory.Create("benefits");
                    traceResult = await agent.RunWithTraceAsync(prompt);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Benefits & Eligibility Agent invocation failed; returning the deterministic eligibility report");
                    agentInvocationError = ex.Message;
                }
            }

            return Results.Ok(BuildEnvelope(traceResult, agentInvocationError));
        });
    }

    private static string Sanitize(string value) =>
        value.Replace('\r', ' ').Replace('\n', ' ');

    /// <summary>
    /// Create the live agent when Foundry is configured. A creation failure
    /// is logged and returned as an error so the stream still completes with
    /// the deterministic report.
    /// </summary>
    private static (CaldovaAgent? Agent, string? Error) TryCreateAgent(CaldovaAgentFactory factory, ILogger logger)
    {
        if (!factory.IsConfigured) return (null, null);
        try
        {
            return (factory.Create("benefits"), null);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Benefits & Eligibility Agent could not be created; returning the deterministic eligibility report");
            return (null, ex.Message);
        }
    }

    private static string StatusText(ChecklistStatus status) => status.ToString().ToLowerInvariant();

    private static object[] ProjectItems(EligibilityReport report) =>
        report.Items.Select(i => (object)new
        {
            id = i.Id,
            label = i.Label,
            status = StatusText(i.Status),
            finding = i.Finding,
            clauseRef = i.ClauseRef,
        }).ToArray();

    /// <summary>
    /// Project the deterministic <see cref="EligibilityReport"/> into the
    /// JSON shape the agent is asked to emit, so the page renders Step 4 from
    /// one field whichever source produced it.
    /// </summary>
    private static object ProjectReport(EligibilityReport report, string source) => new
    {
        caseNumber = report.CaseNumber,
        recommendation = report.Recommendation.ToString(),
        recommendationLabel = report.RecommendationLabel,
        recommendationReason = report.RecommendationReason,
        outcomeSummary = report.OutcomeSummary,
        items = ProjectItems(report),
        source,
    };

    /// <summary>
    /// Prompt sent to the Benefits &amp; Eligibility Agent: the Member Case,
    /// the full text of every applicable rule document with clause ids, the
    /// checklist (ids, clause refs and preliminary findings) and the figures
    /// on the case file. Contact details are left out — they aren't needed to
    /// apply the rules.
    /// </summary>
    private static string BuildPrompt(CaseRecord c, EligibilityReport report, IReadOnlyList<ProductRuleDocument> documents)
    {
        var sb = new StringBuilder();
        sb.AppendLine("MEMBER CASE FOR ELIGIBILITY ASSESSMENT");
        sb.AppendLine("======================================");
        sb.AppendLine($"Case number: {c.CaseNumber}");
        sb.AppendLine($"Client / member: {c.ClientName}");
        sb.AppendLine($"Member number: {c.MemberNumber}");
        sb.AppendLine($"Product: {c.Product}");
        sb.AppendLine($"Request type: {c.RequestType}");
        sb.AppendLine($"Received: {c.ReceivedDate}");
        sb.AppendLine($"Adviser: {AdviserText(c)}");
        sb.AppendLine($"Amount: {c.Amount}");
        sb.AppendLine($"Onboarding priority: {c.Priority} — {c.PriorityReason}");
        sb.AppendLine();
        sb.AppendLine("REQUEST SUMMARY");
        sb.AppendLine("---------------");
        sb.AppendLine(c.RequestSummary);
        sb.AppendLine();
        sb.AppendLine("RULE DOCUMENTS TO APPLY (cite the clause ids)");
        sb.AppendLine("---------------------------------------------");
        foreach (var doc in documents)
        {
            sb.AppendLine($"[{doc.Title}] — {doc.DocumentType}, effective {doc.EffectiveDate}; knowledge base title: \"{doc.KnowledgeBaseTitle}\"");
            foreach (var s in doc.Sections)
                sb.AppendLine($"  {s.ClauseId} — {s.Title}: {s.Text} ({s.LegalReference})");
            if (doc.Requirements.Count > 0)
                sb.AppendLine("  Requirements: " + string.Join(" ", doc.Requirements));
            if (doc.Restrictions.Count > 0)
                sb.AppendLine("  Restrictions: " + string.Join(" ", doc.Restrictions));
            sb.AppendLine();
        }
        sb.AppendLine("ELIGIBILITY CHECKLIST (one entry per rule check — keep every id and clauseRef)");
        sb.AppendLine("-------------------------------------------------------------------------------");
        foreach (var i in report.Items)
            sb.AppendLine($"- id={i.Id} | clauseRef={i.ClauseRef} | {i.Label} — preliminary status: {StatusText(i.Status)} — {i.Finding}");
        sb.AppendLine();
        if (report.Calculations.Count > 0)
        {
            sb.AppendLine("FIGURES ON THE CASE FILE");
            sb.AppendLine("------------------------");
            foreach (var line in report.Calculations)
                sb.AppendLine("- " + line);
            sb.AppendLine();
        }
        sb.Append(
            "Assess this Member Case as the Benefits & Eligibility Agent. Apply the rule documents above (use the " +
            "wealth_knowledge index for the full documents and the member's case files). For EVERY checklist item, " +
            "confirm pass, fail or info, say why, and cite its clause id. Show any caps, pro-rated minimums, tax " +
            "components or withholding step by step. Use your standard output format, including the \"Eligibility " +
            "Checklist Review\" section. Then, at the very end of your reply, emit the fenced ```json block described " +
            "in your instructions with recommendation, recommendationLabel, recommendationReason, outcomeSummary and " +
            "one entry in items for every checklist id above (keep each id and clauseRef). Recommend only — a human " +
            "approves. Never give personal financial advice and never show a full TFN.");
        return sb.ToString();
    }

    private static string AdviserText(CaseRecord c) =>
        string.IsNullOrWhiteSpace(c.AdviserPractice)
            ? c.AdviserName
            : $"{c.AdviserName} ({c.AdviserPractice})";

    /// <summary>
    /// Offline narrative in the agent's own output format, built from the
    /// deterministic report so the page still tells the full story when
    /// Foundry isn't configured or the call fails.
    /// </summary>
    private static string BuildFallbackNarrative(EligibilityReport r, IReadOnlyList<ProductRuleDocument> documents)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"**1. Eligibility Recommendation** — {r.RecommendationLabel}");
        sb.AppendLine();
        sb.AppendLine($"**2. Reasoning** — {r.RecommendationReason}");
        sb.AppendLine();
        sb.AppendLine("Rules applied:");
        var cited = r.Items.Select(i => i.ClauseRef).ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var doc in documents)
        {
            var clauses = doc.Sections.Where(s => cited.Contains(s.ClauseId)).Select(s => s.ClauseId).ToList();
            if (clauses.Count == 0) clauses = doc.Sections.Select(s => s.ClauseId).ToList();
            sb.AppendLine($"- *{doc.Title}* — {string.Join(", ", clauses)}");
        }
        sb.AppendLine();
        sb.AppendLine("**3. Calculations**");
        if (r.Calculations.Count == 0)
            sb.AppendLine("- None — no figures to calculate yet.");
        foreach (var line in r.Calculations)
            sb.AppendLine("- " + line);
        sb.AppendLine();
        sb.AppendLine("**4. Missing Information**");
        if (r.MissingInformation.Count == 0)
            sb.AppendLine("- None.");
        foreach (var line in r.MissingInformation)
            sb.AppendLine("- " + line);
        sb.AppendLine();
        sb.AppendLine("**5. Eligibility Checklist Review**");
        foreach (var i in r.Items)
        {
            var icon = i.Status switch
            {
                ChecklistStatus.Pass => "✅",
                ChecklistStatus.Fail => "❌",
                _ => "ℹ️",
            };
            sb.AppendLine($"- {icon} **{i.Label}** ({i.ClauseRef}) — {StatusText(i.Status)}: {i.Finding}");
        }
        sb.AppendLine();
        sb.AppendLine($"**6. Plain-English Explanation** — {r.PlainEnglishExplanation}");
        sb.AppendLine();
        sb.Append($"**7. Human Approval Required** — {r.HumanApproval}");
        return sb.ToString();
    }

    /// <summary>
    /// Locate the fenced <c>```json … ```</c> block in the agent's reply and
    /// parse it as the eligibility checklist. Takes the last block that
    /// parses, because the agent is told to put it at the very end.
    /// </summary>
    private static object? TryExtractAgentChecklist(string? agentText, EligibilityReport fallback)
    {
        if (string.IsNullOrWhiteSpace(agentText)) return null;

        const string fence = "```";
        object? parsed = null;
        var search = 0;
        while (search < agentText.Length)
        {
            var openIdx = agentText.IndexOf(fence, search, StringComparison.Ordinal);
            if (openIdx < 0) break;

            var langStart = openIdx + fence.Length;
            var langEnd = agentText.IndexOf('\n', langStart);
            if (langEnd < 0) break;

            var lang = agentText.Substring(langStart, langEnd - langStart).Trim();
            var bodyStart = langEnd + 1;
            var closeIdx = agentText.IndexOf(fence, bodyStart, StringComparison.Ordinal);
            if (closeIdx < 0) break;

            if (string.Equals(lang, "json", StringComparison.OrdinalIgnoreCase))
            {
                var body = agentText.Substring(bodyStart, closeIdx - bodyStart).Trim();
                var maybe = TryParseChecklistJson(body, fallback);
                if (maybe is not null) parsed = maybe;
            }

            search = closeIdx + fence.Length;
        }

        // Some models drop the fence — try the outermost braces instead.
        if (parsed is null)
        {
            var firstBrace = agentText.IndexOf('{');
            var lastBrace = agentText.LastIndexOf('}');
            if (firstBrace >= 0 && lastBrace > firstBrace)
                parsed = TryParseChecklistJson(agentText.Substring(firstBrace, lastBrace - firstBrace + 1), fallback);
        }

        return parsed;
    }

    /// <summary>
    /// Parse and normalise the agent's checklist JSON. Missing labels or
    /// clause refs are filled from the deterministic checklist item with the
    /// same id; statuses are coerced to pass / fail / info and the
    /// recommendation to one of the four enum names.
    /// </summary>
    private static object? TryParseChecklistJson(string body, EligibilityReport fallback)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return null;
            if (!root.TryGetProperty("items", out var itemsEl) || itemsEl.ValueKind != JsonValueKind.Array)
                return null;

            static string? Str(JsonElement el, string name) =>
                el.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

            var known = new Dictionary<string, EligibilityChecklistItem>(StringComparer.OrdinalIgnoreCase);
            foreach (var item in fallback.Items)
                known.TryAdd(item.Id, item);

            var items = new List<object>();
            foreach (var it in itemsEl.EnumerateArray())
            {
                if (it.ValueKind != JsonValueKind.Object) continue;
                var id = Str(it, "id") ?? string.Empty;
                known.TryGetValue(id, out var match);

                var label = Str(it, "label");
                if (string.IsNullOrWhiteSpace(label)) label = match?.Label ?? id;
                var clauseRef = Str(it, "clauseRef");
                if (string.IsNullOrWhiteSpace(clauseRef)) clauseRef = match?.ClauseRef ?? string.Empty;

                items.Add(new
                {
                    id,
                    label,
                    status = NormaliseStatus(Str(it, "status")),
                    finding = Str(it, "finding") ?? string.Empty,
                    clauseRef,
                });
            }
            if (items.Count == 0) return null;

            var recommendationLabel = Str(root, "recommendationLabel");
            var recommendation = NormaliseRecommendation(Str(root, "recommendation"))
                ?? NormaliseRecommendation(recommendationLabel)
                ?? EligibilityRecommendation.NeedMoreInfo;
            if (string.IsNullOrWhiteSpace(recommendationLabel))
                recommendationLabel = ProductDocumentCatalog.DefaultLabel(recommendation);

            return new
            {
                caseNumber = fallback.CaseNumber,
                recommendation = recommendation.ToString(),
                recommendationLabel,
                recommendationReason = Str(root, "recommendationReason") ?? string.Empty,
                outcomeSummary = Str(root, "outcomeSummary") ?? string.Empty,
                items = items.ToArray(),
                source = "agent",
            };
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string NormaliseStatus(string? status)
    {
        var s = (status ?? string.Empty).Trim().ToLowerInvariant();
        return s switch
        {
            "pass" or "passed" or "met" or "ok" or "yes" => "pass",
            "fail" or "failed" or "not met" or "no" => "fail",
            _ => "info",
        };
    }

    private static EligibilityRecommendation? NormaliseRecommendation(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var key = new string(value.Where(char.IsLetter).ToArray()).ToLowerInvariant();
        if (key.StartsWith("partial")) return EligibilityRecommendation.PartialApprove;
        if (key.StartsWith("approve") || key.StartsWith("approved")) return EligibilityRecommendation.Approve;
        if (key.StartsWith("decline")) return EligibilityRecommendation.Decline;
        if (key.StartsWith("need") || key.Contains("moreinfo")) return EligibilityRecommendation.NeedMoreInfo;
        return null;
    }

    /// <summary>
    /// Remove a trailing fenced <c>```json … ```</c> block from the agent's
    /// reply so the narrative tab shows only the prose write-up.
    /// </summary>
    private static string? StripTrailingJsonFence(string? agentText)
    {
        if (string.IsNullOrWhiteSpace(agentText)) return agentText;

        var trimmed = agentText.TrimEnd();
        if (!trimmed.EndsWith("```", StringComparison.Ordinal)) return agentText;

        var bodyEnd = trimmed.Length - 3;
        if (bodyEnd <= 0) return agentText;
        var openIdx = trimmed.LastIndexOf("```", bodyEnd - 1, StringComparison.Ordinal);
        if (openIdx < 0) return agentText;

        var langStart = openIdx + 3;
        var langEnd = trimmed.IndexOf('\n', langStart);
        if (langEnd < 0 || langEnd > bodyEnd) return agentText;
        var lang = trimmed.Substring(langStart, langEnd - langStart).Trim();
        if (!string.Equals(lang, "json", StringComparison.OrdinalIgnoreCase)) return agentText;

        return trimmed.Substring(0, openIdx).TrimEnd();
    }
}
