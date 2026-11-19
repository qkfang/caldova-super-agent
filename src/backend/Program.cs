using System.Text.Json;
using CaldovaSuper.App.Api;
using CaldovaSuper.App.Components;
using CaldovaSuper.App.Mcp;
using CaldovaSuper.App.Models;
using CaldovaSuper.App.Services;

// Wealth Team in a Day — Caldova Wealth client operations web app.
// Hosts one page per Foundry agent (/agents/{id}), the five scenario pages
// (/scenarios/{id}), the Try-it-out demo endpoints for each agent, and the
// in-process MCP server the Foundry agents call back into.

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();

// ChatService backs the Account page's "Ask AI" chatbot (/api/chat/ask).
builder.Services.AddHttpClient<ChatService>();

// Bind Foundry configuration (project endpoint, model deployment, search /
// Bing connections) and register a singleton factory that the web app uses
// to invoke agents from the referenced `agent` library — the same agents the
// CLI host in `src/agent` exposes.
var agentOptions = new CaldovaAgentOptions
{
    ProjectEndpoint = builder.Configuration["AZURE_AI_PROJECT_ENDPOINT"],
    ModelDeploymentName = builder.Configuration["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
    TenantId = builder.Configuration["AZURE_TENANT_ID"],
    SearchConnectionId = builder.Configuration["AZURE_AI_SEARCH_CONNECTION_ID"],
    SearchIndexName = builder.Configuration["AZURE_AI_SEARCH_INDEX_NAME"],
    BingConnectionId = builder.Configuration["AZURE_BING_CONNECTION_ID"],
    // APP_MCP_URL must be a publicly reachable URL (e.g. a dev tunnel) because
    // the Foundry Responses API enumerates MCP tools from the cloud — it
    // cannot reach http://localhost on the developer's machine. When unset,
    // agents are created without the MCP tool surface so the demo runs out
    // of the box; set it to enable the investments / transfers / payments
    // MCP tools.
    AppMcpUrl = builder.Configuration["APP_MCP_URL"],
};
builder.Services.AddSingleton(agentOptions);
builder.Services.AddSingleton<CaldovaAgentFactory>();

// HttpClient factory for MCP tools (e.g. fetching fact sheets from URLs).
builder.Services.AddHttpClient();

// MCP server for the in-process tool surface used by Foundry agents:
//   - InvestmentsMcpTools (analyzeFactSheet / compareModels / generateClientWorkbook)
//   - TransfersMcpTools   (lookupFunds / verifySmsf / generateTransferRequestPdf)
//   - PaymentsMcpTools    (payments_* — payee validation, case approval,
//     benefit calculation, authority check, Teams approval request, gated release)
//   - TeamsMcpTools       (teams_sendApprovalCard — Microsoft Teams Adaptive Card delivery)
builder.Services.AddMcpServer()
    .WithHttpTransport(options => { options.Stateless = true; })
    .WithTools<InvestmentsMcpTools>()
    .WithTools<TransfersMcpTools>()
    .WithTools<PaymentsMcpTools>()
    .WithTools<TeamsMcpTools>();
builder.Services.AddCors();

// In-memory Member Case store, seeded with the five scenario cases and
// extended by the Onboarding demo's "Try it out" tab.
builder.Services.AddSingleton<CaseStore>();
builder.Services.AddSingleton<TeamLeaderGroupChatService>();

// Payments flow services. PaymentsMcpTools and the /payments/* endpoints
// depend on these; TeamsMcpTools is also invoked in-process for the
// deterministic demo fallback path.
builder.Services.AddSingleton<PaymentApprovalStore>();
builder.Services.AddSingleton<TeamsMcpTools>();

// Financial Crime document-authenticity demo: loads the static sample
// manifest from wwwroot/fincrime/samples/manifest.json and tracks per-case
// document attachments. Falls back to manifest expectations when Content
// Understanding isn't configured.
builder.Services.AddSingleton<FinCrimeCaseDocumentStore>();
builder.Services.AddSingleton<FinCrimeDocumentVerifier>(sp => new FinCrimeDocumentVerifier(
    sp.GetRequiredService<FinCrimeCaseDocumentStore>(),
    sp.GetRequiredService<IConfiguration>(),
    sp.GetRequiredService<ILogger<FinCrimeDocumentVerifier>>()));

// Transfer / rollover request PDF generator used by both the deterministic
// /transfers/process flow and the TransfersMcpTools MCP tool surface.
builder.Services.AddSingleton<TransferRequestPdfService>();

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error", createScopeForErrors: true);
}
app.UseStatusCodePagesWithReExecute("/not-found", createScopeForStatusCodePages: true);
app.UseAntiforgery();

// CORS + MCP Accept-header normalisation are always enabled because the MCP
// server hosts the investments, transfers and payments tool surfaces.
app.UseCors(policy => policy
    .AllowAnyOrigin()
    .AllowAnyMethod()
    .AllowAnyHeader());

// Normalise the Accept header for MCP requests so Foundry agent / browser
// clients negotiate against the streaming + JSON content type the
// ModelContextProtocol server expects.
app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/mcp"))
    {
        var accept = context.Request.Headers.Accept.ToString();
        if (string.IsNullOrEmpty(accept) || !accept.Contains("text/event-stream"))
        {
            context.Request.Headers.Accept = "application/json, text/event-stream";
        }
    }
    await next();
});

app.MapMcp("/mcp");

// In Development, force browsers to never cache static assets or pages so
// stale JS / HTML / CSS is never served while iterating locally.
if (app.Environment.IsDevelopment())
{
    app.Use(async (context, next) =>
    {
        context.Response.OnStarting(() =>
        {
            var headers = context.Response.Headers;
            headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0";
            headers["Pragma"] = "no-cache";
            headers["Expires"] = "0";
            return Task.CompletedTask;
        });
        await next();
    });
}

// Serves dynamically-generated files (e.g. workbooks written by the
// generateClientWorkbook MCP tool to wwwroot/investments/output/).
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        if (ctx.Context.RequestServices.GetRequiredService<IWebHostEnvironment>().IsDevelopment())
        {
            var headers = ctx.Context.Response.Headers;
            headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0";
            headers["Pragma"] = "no-cache";
            headers["Expires"] = "0";
        }
    }
});

app.MapStaticAssets();
app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();

// WebSocket support for the Voice Live proxy behind Cara's voice chat tab.
app.UseWebSockets();

// ── Markdown rendering endpoint (used by agent pages to format agent output) ──
app.MapMarkdownEndpoints();

// ── "Ask AI" chatbot endpoint (Account page) ────────────────────────────────
app.MapPost("/api/chat/ask", async (HttpContext ctx, ChatService chatService) =>
{
    using var reader = new StreamReader(ctx.Request.Body);
    var body = await reader.ReadToEndAsync();
    using var doc = JsonDocument.Parse(body);
    var root = doc.RootElement;

    var message = root.TryGetProperty("message", out var m) ? m.GetString() ?? "" : "";
    var temperature = root.TryGetProperty("temperature", out var t) ? t.GetDouble() : 0.7;

    var agentResponse = await chatService.SendMessageWithOptionsAsync(message, temperature);

    // References: surface the relevant Caldova operations agents from the
    // AgentCatalog using simple keyword matching against the question.
    var keywords = (message ?? string.Empty).ToLowerInvariant()
        .Split(' ', StringSplitOptions.RemoveEmptyEntries)
        .Where(w => w.Length > 3)
        .ToHashSet();

    var references = AgentCatalog.All
        .Select(a => new
        {
            Agent = a,
            Searchable = ($"{a.Name} {a.Department} {a.Tagline} {a.Purpose} " +
                          string.Join(" ", a.Responsibilities)).ToLowerInvariant()
        })
        .Where(x => keywords.Count == 0 || keywords.Any(k => x.Searchable.Contains(k)))
        .Take(5)
        .Select(x => new
        {
            Id = x.Agent.Id,
            Title = x.Agent.Name,
            Summary = x.Agent.Tagline,
            Category = x.Agent.Department,
            Sentiment = "Neutral",
            Author = x.Agent.Persona,
            PublishedDate = "Caldova client operations",
            Url = $"/agents/{x.Agent.Id}"
        })
        .ToList();

    return Results.Ok(new { response = agentResponse, references });
});

// ── Try-it-out endpoints, one group per agent ───────────────────────────────
{
    var logger = app.Services.GetRequiredService<ILogger<Program>>();
    var loggerFactory = app.Services.GetRequiredService<ILoggerFactory>();
    var caseStore = app.Services.GetRequiredService<CaseStore>();
    var factory = app.Services.GetRequiredService<CaldovaAgentFactory>();

    // Pre-populate the case store with the five scenario cases so every
    // agent page has cases to pick from straight away.
    caseStore.SeedDefaults();

    app.MapOnboardingEndpoints(caseStore, factory, logger);              // /onboarding/*
    app.MapBenefitsEndpoints(caseStore, factory, logger);                // /benefits/*
    app.MapInvestmentsEndpoints(caseStore, factory, logger);             // /investments/*
    app.MapFinancialCrimeEndpoints(                                      // /fincrime/*
        caseStore,
        factory,
        app.Services.GetRequiredService<FinCrimeCaseDocumentStore>(),
        app.Services.GetRequiredService<FinCrimeDocumentVerifier>(),
        logger);
    app.MapTransfersEndpoints(caseStore, factory, logger);               // /transfers/*
    app.MapPaymentsEndpoints(caseStore, factory, logger);                // /payments/*
    app.MapCommunicationsEndpoints(caseStore, factory, logger);          // /communications/*
    app.MapCommunicationsVoiceLiveEndpoints(agentOptions, factory, loggerFactory);
    app.MapTeamLeaderEndpoints(caseStore, factory, logger);              // /team-leader/*
    app.MapTeamLeaderGroupChatEndpoints(
        app.Services.GetRequiredService<TeamLeaderGroupChatService>(), logger);

    // Agent metadata — powers the "Agent Prompt & Tools" sub-tab on every
    // agent page; static, so it works without Foundry configured.
    app.MapAgentMetadataEndpoints(agentOptions);
}

// ── Investment workbook download ────────────────────────────────────────────
//    Streams .xlsx files written by the generateClientWorkbook MCP tool.
app.MapGet("/investments/download/{fileName}", (string fileName, IWebHostEnvironment env) =>
{
    if (string.IsNullOrWhiteSpace(fileName) ||
        fileName.Contains("..") ||
        fileName.Contains('/') ||
        fileName.Contains('\\'))
    {
        return Results.BadRequest(new { error = "Invalid file name." });
    }

    var dir = Path.Combine(env.WebRootPath ?? "wwwroot", "investments", "output");
    var path = Path.Combine(dir, fileName);
    var fullDir = Path.GetFullPath(dir);
    var fullPath = Path.GetFullPath(path);
    if (!fullPath.StartsWith(fullDir + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) &&
        !fullPath.Equals(fullDir, StringComparison.OrdinalIgnoreCase))
    {
        return Results.BadRequest(new { error = "Invalid file path." });
    }
    if (!File.Exists(fullPath)) return Results.NotFound();

    return Results.File(
        fullPath,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        fileName);
});

app.Run();
