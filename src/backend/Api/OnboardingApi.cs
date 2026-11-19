using System.Text;
using CaldovaSuper.Agents;
using CaldovaSuper.App.Models;
using CaldovaSuper.App.Services;

namespace CaldovaSuper.App.Api;

record OnboardingProcessRequest(string SampleId);

/// <summary>One NIGO checklist row as confirmed (and possibly edited) by Olivia.</summary>
record OnboardingNigoItem(string? Id, string? Label, string? Status, string? Note);

/// <summary>The Member Case form as confirmed (and possibly edited) by Olivia.</summary>
record OnboardingSubmitRequest(
    string SampleId,
    string? ClientName,
    string? ClientEmail,
    string? ClientPhone,
    string? MemberNumber,
    string? Product,
    string? RequestType,
    string? ReceivedDate,
    string? AdviserName,
    string? AdviserPractice,
    string? RequestSummary,
    string? Amount,
    string? PreferredContact,
    string? Priority,
    string? PriorityReason,
    IReadOnlyList<OnboardingNigoItem>? Nigo);

/// <summary>
/// One hand-off for a newly opened Member Case: the agent page route id
/// (e.g. <c>benefits-eligibility</c>), why the case goes there, and whether
/// that team picks it up next (<paramref name="Primary"/>) or is told in
/// parallel.
/// </summary>
public record OnboardingRoute(string AgentId, string Reason, bool Primary);

/// <summary>
/// HTTP endpoints behind the "Try it out" tab on the Onboarding agent page
/// (<c>/agents/onboarding</c>). They let the page:
///
/// 1. List the five sample inbound requests (adviser or member email plus the
///    attached form) from <see cref="RequestSampleCatalog"/>.
/// 2. Run a sample through the <see cref="OnboardingAgent"/> to produce the
///    Member Case fields, the NIGO checklist, the priority call and the
///    recommended hand-off.
/// 3. Open the case: mint a <c>REQ-YYYYMMDD-XXXXXX</c> case number in the
///    in-memory <see cref="CaseStore"/> and return where it is routed next,
///    so every downstream agent page can pick it up by case number.
/// </summary>
public static class OnboardingApi
{
    private static readonly string[] Priorities = ["Standard", "High", "Urgent"];

    public static void MapOnboardingEndpoints(
        this WebApplication app,
        CaseStore store,
        CaldovaAgentFactory factory,
        ILogger logger)
    {
        // Sample listing — email body and form text are only returned by the
        // per-sample GET below to keep this payload small.
        app.MapGet("/onboarding/samples", () =>
        {
            var samples = RequestSampleCatalog.All.Select(s => new
            {
                id = s.Id,
                label = s.Label,
                requestType = s.RequestType,
                clientName = s.ClientName,
                clientEmail = s.ClientEmail,
                memberNumber = s.MemberNumber,
                emailSubject = s.EmailSubject,
                emailFrom = s.EmailFrom,
                emailDate = s.EmailDate,
                formFileName = s.FormFileName
            });
            return Results.Ok(samples);
        });

        app.MapGet("/onboarding/samples/{id}", (string id) =>
        {
            var sample = RequestSampleCatalog.FindById(id);
            if (sample is null)
                return Results.NotFound(new { error = $"sample '{id}' not found" });

            return Results.Ok(new
            {
                id = sample.Id,
                label = sample.Label,
                requestType = sample.RequestType,
                clientName = sample.ClientName,
                clientEmail = sample.ClientEmail,
                memberNumber = sample.MemberNumber,
                emailSubject = sample.EmailSubject,
                emailFrom = sample.EmailFrom,
                emailDate = sample.EmailDate,
                emailBody = sample.EmailBody,
                formFileName = sample.FormFileName,
                formDocumentText = sample.FormDocumentText
            });
        });

        // Where a case of the given request type is routed after it opens.
        // Lets the page refresh the hand-off preview when Olivia changes the
        // request type on the Member Case form.
        app.MapGet("/onboarding/routing", (string? requestType) =>
            Results.Ok(new
            {
                requestType = CanonicalRequestType(requestType),
                routing = BuildRouting(requestType)
            }));

        // Engage the Onboarding Agent on a sample. The Member Case fields,
        // NIGO checklist and priority come from the catalogue entry so the
        // demo is reliable; when Foundry is configured the live agent's
        // streamed narrative is shown alongside them, otherwise a
        // deterministic narrative in the agent's output format is returned.
        // Send `Accept: text/event-stream` for a live SSE stream.
        app.MapPost("/onboarding/process", async (HttpContext httpContext, OnboardingProcessRequest request) =>
        {
            if (string.IsNullOrWhiteSpace(request.SampleId))
                return Results.BadRequest(new { error = "sampleId is required" });

            var sample = RequestSampleCatalog.FindById(request.SampleId);
            if (sample is null)
                return Results.NotFound(new { error = $"sample '{request.SampleId}' not found" });

            logger.LogInformation("Onboarding process: sampleId={SampleId}", Sanitize(sample.Id));

            var prompt = BuildPrompt(sample);
            var routing = BuildRouting(sample.RequestType);

            object BuildEnvelope(AgentTraceResult? trace, string? agentError)
            {
                var notes = trace?.Text;
                var narrativeSource = "agent";
                if (string.IsNullOrWhiteSpace(notes))
                {
                    notes = BuildFallbackNarrative(sample);
                    narrativeSource = "deterministic";
                }

                return new
                {
                    sampleId = sample.Id,
                    fields = sample.ExpectedFields,
                    nigo = sample.ExpectedNigo,
                    priority = sample.ExpectedPriority,
                    priorityReason = sample.ExpectedPriorityReason,
                    routing,
                    agentNotes = notes,
                    narrativeSource,
                    agentConfigured = factory.IsConfigured,
                    agentError,
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

            if (AgentSseStreaming.WantsEventStream(httpContext))
            {
                var (streamingAgent, createError) = TryCreateAgent(factory, logger);
                await AgentSseStreaming.StreamAsync(httpContext, streamingAgent, prompt,
                    (trace, error) => BuildEnvelope(trace, error ?? createError), logger, "Onboarding Agent");
                return Results.Empty;
            }

            AgentTraceResult? traceResult = null;
            string? agentInvocationError = null;
            if (factory.IsConfigured)
            {
                try
                {
                    var agent = factory.Create("onboarding");
                    traceResult = await agent.RunWithTraceAsync(prompt);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Onboarding Agent invocation failed; falling back to deterministic demo data");
                    agentInvocationError = ex.Message;
                }
            }

            return Results.Ok(BuildEnvelope(traceResult, agentInvocationError));
        });

        // Olivia confirms the (possibly edited) Member Case form: mint a
        // REQ-YYYYMMDD-XXXXXX case number, keep the case in memory for the
        // other agent pages, and return where it is routed next.
        app.MapPost("/onboarding/submit", (OnboardingSubmitRequest request) =>
        {
            if (string.IsNullOrWhiteSpace(request.SampleId))
                return Results.BadRequest(new { error = "sampleId is required" });

            var sample = RequestSampleCatalog.FindById(request.SampleId);
            if (sample is null)
                return Results.NotFound(new { error = $"sample '{request.SampleId}' not found" });

            if (string.IsNullOrWhiteSpace(request.ClientName))
                return Results.BadRequest(new { error = "clientName is required" });

            var expected = sample.ExpectedFields;
            var requestType = string.IsNullOrWhiteSpace(request.RequestType)
                ? sample.RequestType
                : CanonicalRequestType(request.RequestType);

            var fields = new RequestExtractedFields(
                ClientName: Clean(request.ClientName),
                ClientEmail: Clean(request.ClientEmail),
                ClientPhone: Clean(request.ClientPhone),
                MemberNumber: Clean(request.MemberNumber),
                Product: Clean(request.Product),
                RequestType: requestType,
                ReceivedDate: string.IsNullOrWhiteSpace(request.ReceivedDate) ? expected.ReceivedDate : Clean(request.ReceivedDate),
                AdviserName: Clean(request.AdviserName),
                AdviserPractice: Clean(request.AdviserPractice),
                RequestSummary: Clean(request.RequestSummary),
                Amount: Clean(request.Amount),
                PreferredContact: Clean(request.PreferredContact));

            var priority = NormalisePriority(request.Priority) ?? sample.ExpectedPriority;
            var priorityReason = string.IsNullOrWhiteSpace(request.PriorityReason)
                ? sample.ExpectedPriorityReason
                : Clean(request.PriorityReason);

            var record = store.Add(sample.Id, fields, priority, priorityReason);

            var nigo = (request.Nigo is { Count: > 0 }
                    ? request.Nigo.Take(MaxNigoItems).Select(n => new NigoCheck(
                        Clean(n.Id), Clean(n.Label), NormaliseNigoStatus(n.Status), Clean(n.Note)))
                    : sample.ExpectedNigo)
                .ToList();
            var outstanding = nigo
                .Where(n => n.Status == "action")
                .Select(n => new { id = n.Id, label = n.Label, note = n.Note })
                .ToArray();

            var routing = BuildRouting(requestType);

            logger.LogInformation("Onboarding submit: opened {CaseNumber} for sample {SampleId}",
                record.CaseNumber, Sanitize(sample.Id));

            return Results.Ok(new
            {
                caseNumber = record.CaseNumber,
                createdAt = record.CreatedAt,
                clientName = record.ClientName,
                memberNumber = record.MemberNumber,
                requestType = record.RequestType,
                priority = record.Priority,
                priorityReason = record.PriorityReason,
                nigoTotal = nigo.Count,
                nigoInGoodOrder = nigo.Count - outstanding.Length,
                outstandingNigo = outstanding,
                routing
            });
        });

        // Read-only view of one case (diagnostics / downstream pages).
        app.MapGet("/onboarding/cases/{caseNumber}", (string caseNumber) =>
        {
            var record = store.Get(caseNumber);
            return record is null
                ? Results.NotFound(new { error = $"case '{caseNumber}' not found" })
                : Results.Ok(record);
        });
    }

    private static string Sanitize(string value) =>
        value.Replace('\r', ' ').Replace('\n', ' ');

    /// <summary>
    /// Create the live agent when Foundry is configured. A creation failure
    /// is logged and returned as an error so the stream still completes with
    /// the deterministic extraction.
    /// </summary>
    private static (CaldovaAgent? Agent, string? Error) TryCreateAgent(CaldovaAgentFactory factory, ILogger logger)
    {
        if (!factory.IsConfigured) return (null, null);
        try
        {
            return (factory.Create("onboarding"), null);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Onboarding Agent could not be created; falling back to deterministic demo data");
            return (null, ex.Message);
        }
    }

    private const int MaxFieldLength = 2000;
    private const int MaxNigoItems = 30;

    private static string Clean(string? value)
    {
        var trimmed = (value ?? string.Empty).Trim();
        return trimmed.Length <= MaxFieldLength ? trimmed : trimmed[..MaxFieldLength];
    }

    private static string? NormalisePriority(string? value) =>
        Priorities.FirstOrDefault(p => string.Equals(p, value?.Trim(), StringComparison.OrdinalIgnoreCase));

    private static string NormaliseNigoStatus(string? value) =>
        string.Equals(value?.Trim(), "ok", StringComparison.OrdinalIgnoreCase) ? "ok" : "action";

    private static readonly string[] KnownRequestTypes =
    [
        RequestTypes.NewAccount,
        RequestTypes.RolloverOutSmsf,
        RequestTypes.PensionCommencement,
        RequestTypes.FinancialHardship,
        RequestTypes.DeathBenefit,
    ];

    /// <summary>Map a request type onto its canonical <see cref="RequestTypes"/> spelling (case-insensitive).</summary>
    private static string CanonicalRequestType(string? value)
    {
        var trimmed = Clean(value);
        return KnownRequestTypes.FirstOrDefault(t => string.Equals(t, trimmed, StringComparison.OrdinalIgnoreCase))
            ?? trimmed;
    }

    /// <summary>
    /// Hand-offs for a newly opened case, by request type, following the
    /// canonical scenario flows. Primary routes are the specialists who pick
    /// the case up next; the others are told about it in parallel.
    /// </summary>
    public static IReadOnlyList<OnboardingRoute> RoutesFor(string? requestType) =>
        CanonicalRequestType(requestType) switch
        {
            RequestTypes.NewAccount =>
            [
                new("financial-crime", "KYC/AML screening (PEP and sanctions) before any money moves.", true),
                new("benefits-eligibility", "Rules check — s99FA adviser fee consent, binding nomination and investment fit (TMD).", true),
                new("transfers-rollovers", "Consolidate the external funds by SuperStream — warn about insurance cover that ends on rollover.", false),
            ],
            RequestTypes.RolloverOutSmsf =>
            [
                new("financial-crime", "Urgent referral — account-takeover indicators. Contact the member only on the verified details held before any recent change.", true),
                new("benefits-eligibility", "SMSF rollover rules — the ATO SMSF verification service (SVS) must pass before any rollover.", true),
                new("transfers-rollovers", "Hold — don't dispatch the rollover until Financial Crime and Benefits & Eligibility clear it.", false),
            ],
            RequestTypes.PensionCommencement =>
            [
                new("benefits-eligibility", "Condition of release, transfer balance cap, minimum drawdown and reversionary nomination.", true),
                new("investment-analyst", "Income strategy — cash bucket and model portfolio for the adviser to discuss.", false),
                new("team-leader", "Commencement of $1,000,000 or more needs Team Leader approval before it starts.", false),
            ],
            RequestTypes.FinancialHardship =>
            [
                new("benefits-eligibility", "Severe financial hardship criteria and the $10,000 payment limit.", true),
                new("team-leader", "Vulnerable-member review — hardship releases always need human approval.", false),
            ],
            RequestTypes.DeathBenefit =>
            [
                new("team-leader", "Case owner — compassionate oversight; every death benefit needs Team Leader approval.", true),
                new("financial-crime", "Authenticity check of the certified death certificate and beneficiaries' ID.", false),
                new("benefits-eligibility", "Binding nomination validity, SIS dependants and tax status.", false),
                new("payments", "Stop pension payments on the deceased member's account now.", false),
            ],
            _ =>
            [
                new("benefits-eligibility", "Assess the request against the PDS, trust deed and super law.", true),
            ],
        };

    private static IReadOnlyList<object> BuildRouting(string? requestType) =>
        RoutesFor(requestType)
            .Select(r =>
            {
                var agent = AgentCatalog.FindById(r.AgentId);
                return (object)new
                {
                    agentId = r.AgentId,
                    agentName = agent?.Name ?? r.AgentId,
                    department = agent?.Department ?? r.AgentId,
                    persona = agent?.Persona ?? string.Empty,
                    icon = agent?.Icon ?? "•",
                    accent = agent?.Accent ?? "#0ea5e9",
                    url = $"/agents/{r.AgentId}",
                    reason = r.Reason,
                    primary = r.Primary
                };
            })
            .ToList();

    /// <summary>
    /// Prompt sent to the Onboarding Agent: the inbound email plus the
    /// already-text-extracted attached form, and the Member Case fields and
    /// request types it should use.
    /// </summary>
    private static string BuildPrompt(RequestSample sample) =>
        "INBOUND REQUEST — CALDOVA CLIENT OPERATIONS\n" +
        "===========================================\n" +
        $"From: {sample.EmailFrom}\n" +
        $"Date: {sample.EmailDate}\n" +
        $"Subject: {sample.EmailSubject}\n\n" +
        sample.EmailBody +
        $"\n\nATTACHED FORM ({sample.FormFileName})\n" +
        "===========================================\n" +
        sample.FormDocumentText +
        "\n\n" +
        "Process this inbound request as the Onboarding Agent. Identify the request type (one of: " +
        string.Join("; ", KnownRequestTypes) + "). Capture every Member Case field: client name, email, " +
        "phone, member number, product, request type, received date, adviser, practice, request summary, " +
        "amount and preferred contact. Run the NIGO checklist, set the priority (Standard / High / Urgent) " +
        "with a reason, flag any vulnerability, and recommend the hand-off — in your standard output format. " +
        "Mask any TFN or bank account number.";

    /// <summary>
    /// Offline narrative in the Onboarding Agent's output format, built from
    /// the catalogue entry so the page still tells the story when Foundry
    /// isn't configured or the call fails.
    /// </summary>
    private static string BuildFallbackNarrative(RequestSample sample)
    {
        var f = sample.ExpectedFields;
        var adviser = string.IsNullOrWhiteSpace(f.AdviserPractice)
            ? f.AdviserName
            : $"{f.AdviserName} ({f.AdviserPractice})";

        var sb = new StringBuilder();
        sb.AppendLine($"**1. Request Summary** — {f.RequestType} for {f.ClientName} ({f.Product}). " +
                      $"Sent by {sample.EmailFrom} on {sample.EmailDate}, with *{sample.FormFileName}* attached.");
        sb.AppendLine();
        sb.AppendLine("**2. Captured Fields**");
        sb.AppendLine($"- Client: {f.ClientName}");
        sb.AppendLine($"- Email / phone: {f.ClientEmail} · {f.ClientPhone}");
        sb.AppendLine($"- Member number: {f.MemberNumber}");
        sb.AppendLine($"- Product: {f.Product}");
        sb.AppendLine($"- Request type: {f.RequestType}");
        sb.AppendLine($"- Received: {f.ReceivedDate}");
        sb.AppendLine($"- Adviser: {adviser}");
        sb.AppendLine($"- Amount: {f.Amount}");
        sb.AppendLine($"- Preferred contact: {f.PreferredContact}");
        sb.AppendLine($"- Summary: {f.RequestSummary}");
        sb.AppendLine();
        sb.AppendLine("**3. NIGO Checklist**");
        foreach (var n in sample.ExpectedNigo)
        {
            var icon = n.Status == "ok" ? "✅" : "⚠️";
            sb.AppendLine($"- {icon} **{n.Label}** — {n.Note}");
        }
        sb.AppendLine();
        sb.AppendLine($"**4. Priority & Vulnerability Flags** — **{sample.ExpectedPriority}.** {sample.ExpectedPriorityReason}");
        sb.AppendLine();
        sb.AppendLine("**5. Next Step**");
        foreach (var route in RoutesFor(sample.RequestType))
        {
            var agent = AgentCatalog.FindById(route.AgentId);
            var name = agent is null ? route.AgentId : $"{agent.Icon} {agent.Department} ({agent.Persona})";
            sb.AppendLine($"- {name} — {route.Reason}");
        }
        var outstanding = sample.ExpectedNigo.Where(n => n.Status != "ok").Select(n => n.Label).ToList();
        sb.Append(outstanding.Count == 0
            ? "- Nothing outstanding — the request is in good order."
            : $"- Still to resolve: {string.Join("; ", outstanding)}.");
        return sb.ToString();
    }
}
