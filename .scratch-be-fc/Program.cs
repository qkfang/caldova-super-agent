using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using CaldovaSuper.App.Api;
using CaldovaSuper.App.Services;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;

// Scratch harness (deleted after use): hosts ONLY the /fincrime/* endpoints and exercises them.
const string BackendDir = @"D:\repo\caldova-super-agent\src\backend";
var live = args.Contains("--live");
var cuFail = args.Contains("--cu-fail");

var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    ContentRootPath = BackendDir,
    WebRootPath = Path.Combine(BackendDir, "wwwroot"),
    EnvironmentName = "Development",
});
var serve = args.Contains("--serve");
builder.Logging.SetMinimumLevel(LogLevel.Warning);
builder.WebHost.UseUrls(serve ? "http://127.0.0.1:5398" : "http://127.0.0.1:0");
if (cuFail)
{
    builder.Configuration["AZURE_CONTENT_UNDERSTANDING_ENDPOINT"] = "http://127.0.0.1:9/";
    builder.Configuration["AZURE_CONTENT_UNDERSTANDING_KEY"] = "dummy";
}

builder.Services.AddSingleton(new CaldovaAgentOptions
{
    ProjectEndpoint = live ? builder.Configuration["AZURE_AI_PROJECT_ENDPOINT"] : null,
    ModelDeploymentName = builder.Configuration["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
    TenantId = builder.Configuration["AZURE_TENANT_ID"],
    SearchConnectionId = builder.Configuration["AZURE_AI_SEARCH_CONNECTION_ID"],
    SearchIndexName = builder.Configuration["AZURE_AI_SEARCH_INDEX_NAME"],
    BingConnectionId = builder.Configuration["AZURE_BING_CONNECTION_ID"],
});
builder.Services.AddSingleton<CaldovaAgentFactory>();
builder.Services.AddSingleton<CaseStore>();
builder.Services.AddSingleton<FinCrimeCaseDocumentStore>();
builder.Services.AddSingleton<FinCrimeDocumentVerifier>(sp => new FinCrimeDocumentVerifier(
    sp.GetRequiredService<FinCrimeCaseDocumentStore>(),
    sp.GetRequiredService<IConfiguration>(),
    sp.GetRequiredService<ILogger<FinCrimeDocumentVerifier>>()));

var app = builder.Build();
var store = app.Services.GetRequiredService<CaseStore>();
store.SeedDefaults();
app.MapFinancialCrimeEndpoints(
    store,
    app.Services.GetRequiredService<CaldovaAgentFactory>(),
    app.Services.GetRequiredService<FinCrimeCaseDocumentStore>(),
    app.Services.GetRequiredService<FinCrimeDocumentVerifier>(),
    app.Services.GetRequiredService<ILogger<Program>>());
if (serve)
{
    app.UseStaticFiles();
    app.MapGet("/fc-test.html", () =>
    {
        var razor = File.ReadAllLines(Path.Combine(BackendDir, "Components", "Pages", "Agents", "FinancialCrimeAgent.razor"))
            .Where(l => !l.StartsWith("@page") && !l.StartsWith("<PageTitle>"));
        var body = string.Join("\n", razor).Replace("@@", "@");
        var html = $$"""
            <!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><title>fincrime test</title>
            <link rel="stylesheet" href="/lib/bootstrap/dist/css/bootstrap.min.css" />
            <link rel="stylesheet" href="/app.css" /><link rel="stylesheet" href="/css/agent-page.css" />
            </head><body style="background:#0b1220;color:#e5e7eb;padding:1.5rem;"><main>{{body}}</main>
            <script src="/js/agent-md.js"></script><script src="/js/agent-stream.js"></script>
            <script src="/js/agent-tabs.js"></script><script src="/js/engage-tabs.js"></script>
            <script src="/js/fincrime-demo.js"></script></body></html>
            """;
        return Results.Content(html, "text/html");
    });
    Console.WriteLine("Serving http://127.0.0.1:5398/fc-test.html");
    await app.RunAsync();
    return 0;
}
await app.StartAsync();
var address = app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.First();
using var http = new HttpClient { BaseAddress = new Uri(address), Timeout = TimeSpan.FromMinutes(6) };
var failures = new List<string>();
void Expect(bool ok, string what) { if (!ok) failures.Add(what); Console.WriteLine($"  {(ok ? "PASS" : "FAIL")} {what}"); }

try
{
    var cases = await http.GetFromJsonAsync<JsonElement>("/fincrime/cases");
    Console.WriteLine($"GET /fincrime/cases → {cases.GetArrayLength()} cases");
    foreach (var c in cases.EnumerateArray())
        Console.WriteLine($"  {c.GetProperty("caseNumber")} {c.GetProperty("clientName")} · {c.GetProperty("requestType")} · docs={c.GetProperty("documentCount")}");

    var samples = await http.GetFromJsonAsync<JsonElement>("/fincrime/samples");
    Console.WriteLine($"GET /fincrime/samples → {samples.GetArrayLength()} samples: {string.Join(", ", samples.EnumerateArray().Select(s => s.GetProperty("id").GetString()))}");
    Expect(samples.GetArrayLength() == 12, "12 specimen samples in the manifest");

    var expected = new Dictionary<string, (string Level, int? Score, string[] Verdicts)>
    {
        ["REQ-20261103-DEMO01"] = ("Low", 8, ["legit"]),
        ["REQ-20261106-DEMO02"] = ("High", 92, ["fake", "suspicious", "suspicious"]),
        ["REQ-20261109-DEMO03"] = ("Low", 5, ["legit"]),
        ["REQ-20261111-DEMO04"] = ("Low", 9, ["legit", "legit"]),
        ["REQ-20261113-DEMO05"] = ("Low", 7, ["legit", "legit", "legit"]),
    };

    foreach (var (caseNumber, exp) in expected)
    {
        if (live && caseNumber != "REQ-20261106-DEMO02") continue;
        Console.WriteLine();
        Console.WriteLine($"=== {caseNumber} ===");
        var activity = await http.GetFromJsonAsync<JsonElement>($"/fincrime/cases/{caseNumber}/activity");
        Console.WriteLine($"  activity: {activity.GetProperty("timeline").GetArrayLength()} events, {activity.GetProperty("screening").GetArrayLength()} screening rows; trusted: {activity.GetProperty("verifiedContact")}");
        foreach (var e in activity.GetProperty("timeline").EnumerateArray())
            Console.WriteLine($"    [{e.GetProperty("flag")}] {e.GetProperty("when")} · {e.GetProperty("summary")}");

        var docs = await http.GetFromJsonAsync<JsonElement>($"/fincrime/cases/{caseNumber}/documents");
        var ids = docs.EnumerateArray().Select(d => d.GetProperty("id").GetString()!).ToList();
        Console.WriteLine($"  documents: {string.Join(", ", ids)}");

        var verifyRes = await http.PostAsJsonAsync("/fincrime/documents/verify", new { caseNumber, documentIds = ids });
        var verify = await verifyRes.Content.ReadFromJsonAsync<JsonElement>();
        var verdicts = verify.GetProperty("documents").EnumerateArray().Select(d => d.GetProperty("verdict").GetString()!).ToArray();
        foreach (var d in verify.GetProperty("documents").EnumerateArray())
        {
            Console.WriteLine($"    #{d.GetProperty("id")} → {d.GetProperty("verdict")} ({d.GetProperty("source")}): {d.GetProperty("summary")}");
            foreach (var chk in d.GetProperty("checks").EnumerateArray().Where(x => x.GetProperty("status").GetString() is "fail" or "warn"))
                Console.WriteLine($"       [{chk.GetProperty("status")}] {chk.GetProperty("name")} — {chk.GetProperty("detail")}");
        }
        Expect(verdicts.SequenceEqual(exp.Verdicts), $"{caseNumber} verdicts {string.Join("/", verdicts)} == {string.Join("/", exp.Verdicts)}");

        var processRes = await http.PostAsJsonAsync("/fincrime/process", new { caseNumber, documentIds = ids });
        var process = await processRes.Content.ReadFromJsonAsync<JsonElement>();
        var level = process.GetProperty("riskLevel").GetString();
        var score = process.GetProperty("riskScore").GetInt32();
        Console.WriteLine($"  RISK {level} {score}/100 — {process.GetProperty("riskSummary")}");
        foreach (var i in process.GetProperty("indicators").EnumerateArray())
            Console.WriteLine($"    +{i.GetProperty("points")} [{i.GetProperty("severity")}] {i.GetProperty("title")} — {i.GetProperty("evidence")} (src: {i.GetProperty("source")})");
        foreach (var a in process.GetProperty("actions").EnumerateArray())
            Console.WriteLine($"    ACTION{(a.GetProperty("requiresApproval").GetBoolean() ? " [approval]" : "")}: {a.GetProperty("action")} — {a.GetProperty("detail")}");
        foreach (var cl in process.GetProperty("checksClear").EnumerateArray())
            Console.WriteLine($"    CLEAR: {cl}");
        Console.WriteLine($"  APPROVAL: {process.GetProperty("approvalRequired")}");
        if (process.TryGetProperty("smrNote", out var smr) && smr.ValueKind == JsonValueKind.String) Console.WriteLine($"  SMR: {smr}");
        Console.WriteLine($"  agentConfigured={process.GetProperty("agentConfigured")} agentRiskLevel={process.GetProperty("agentRiskLevel")} agentRiskScore={process.GetProperty("agentRiskScore")} agentError={process.GetProperty("agentError")}");
        if (live && process.GetProperty("agentNotes").ValueKind == JsonValueKind.String)
        {
            var notes = process.GetProperty("agentNotes").GetString()!;
            Console.WriteLine("  ---- agent notes (first 1500 chars) ----");
            Console.WriteLine(notes.Length > 1500 ? notes[..1500] + "…" : notes);
        }
        Expect(level == exp.Level, $"{caseNumber} level {level} == {exp.Level}");
        if (exp.Score is { } s) Expect(score == s, $"{caseNumber} score {score} == {s}");
    }

    Console.WriteLine();
    Console.WriteLine("=== Edge cases ===");
    if (!live) {
    // Grace's genuine licence on file next to the tampered one.
    var grace = await (await http.PostAsJsonAsync("/fincrime/documents/verify", new { caseNumber = "REQ-20261106-DEMO02", documentIds = new[] { "dl-grace-genuine", "dl-grace-tampered" } })).Content.ReadFromJsonAsync<JsonElement>();
    Console.WriteLine("  Grace genuine vs tampered: " + string.Join(" / ", grace.GetProperty("documents").EnumerateArray().Select(d => $"{d.GetProperty("id")}={d.GetProperty("verdict")}")));
    Expect(grace.GetProperty("documents")[0].GetProperty("verdict").GetString() == "legit", "genuine licence on file is legit on Grace's case");

    // Photo-swap passport on Priya's case → fake, pushes the case to at least Medium.
    var priya = await (await http.PostAsJsonAsync("/fincrime/process", new { caseNumber = "REQ-20261103-DEMO01", documentIds = new[] { "dl-priya", "passport-priya-photo-swap" } })).Content.ReadFromJsonAsync<JsonElement>();
    var swap = priya.GetProperty("documents")[1];
    Console.WriteLine($"  Priya + photo swap → {priya.GetProperty("riskLevel")} {priya.GetProperty("riskScore")}; swap verdict {swap.GetProperty("verdict")}: {swap.GetProperty("summary")}");
    foreach (var chk in swap.GetProperty("checks").EnumerateArray().Where(x => x.GetProperty("status").GetString() is "fail" or "warn"))
        Console.WriteLine($"     [{chk.GetProperty("status")}] {chk.GetProperty("name")} — {chk.GetProperty("detail")}");
    Expect(swap.GetProperty("verdict").GetString() == "fake", "photo-swap passport is fake");
    Expect(priya.GetProperty("riskLevel").GetString() == "Medium", "altered document lifts a low case to Medium");

    // Grace's tampered licence attached to Tom's case → belongs to another member.
    var tom = await (await http.PostAsJsonAsync("/fincrime/documents/verify", new { caseNumber = "REQ-20261111-DEMO04", documentIds = new[] { "dl-grace-genuine" } })).Content.ReadFromJsonAsync<JsonElement>();
    var tomDoc = tom.GetProperty("documents")[0];
    Console.WriteLine($"  Grace's licence on Tom's case → {tomDoc.GetProperty("verdict")}: {tomDoc.GetProperty("summary")}");
    Expect(tomDoc.GetProperty("verdict").GetString() == "suspicious", "another member's licence is suspicious on Tom's case");

    // Empty selection → no documents reviewed.
    var none = await (await http.PostAsJsonAsync("/fincrime/process", new { caseNumber = "REQ-20261106-DEMO02", documentIds = Array.Empty<string>() })).Content.ReadFromJsonAsync<JsonElement>();
    Console.WriteLine($"  Grace without documents → {none.GetProperty("riskLevel")} {none.GetProperty("riskScore")}");
    Expect(none.GetProperty("riskLevel").GetString() == "High", "Grace stays High without documents");

    // Errors.
    var notFound = await http.GetAsync("/fincrime/cases/REQ-NOPE/activity");
    Expect((int)notFound.StatusCode == 404, "unknown case → 404");
    var bad = await http.PostAsJsonAsync("/fincrime/documents/verify", new { caseNumber = "" });
    Expect((int)bad.StatusCode == 400, "missing caseNumber → 400");

    }
    // SSE.
    var req = new HttpRequestMessage(HttpMethod.Post, "/fincrime/process")
    {
        Content = new StringContent(JsonSerializer.Serialize(new { caseNumber = "REQ-20261106-DEMO02" }), Encoding.UTF8, "application/json"),
    };
    req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("text/event-stream"));
    var sse = await http.SendAsync(req);
    var body = await sse.Content.ReadAsStringAsync();
    var deltas = body.Split("event: delta").Length - 1;
    Console.WriteLine($"  SSE: content-type={sse.Content.Headers.ContentType} length={body.Length} deltas={deltas} done={body.Contains("event: done")}");
    Expect(body.Contains("event: done") && body.Contains("\"riskScore\""), "SSE done event carries the envelope");
}
finally
{
    await app.StopAsync();
}

Console.WriteLine();
Console.WriteLine(failures.Count == 0 ? "ALL CHECKS PASSED" : $"{failures.Count} FAILURE(S):\n - " + string.Join("\n - ", failures));
return failures.Count == 0 ? 0 : 1;


