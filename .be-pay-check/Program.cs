using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using CaldovaSuper.App.Api;
using CaldovaSuper.App.Mcp;
using CaldovaSuper.App.Services;

if (args.Contains("serve"))
{
    var sb = WebApplication.CreateBuilder(args);
    sb.WebHost.UseUrls("http://127.0.0.1:5197");
    sb.Logging.SetMinimumLevel(LogLevel.Warning);
    sb.Services.AddRazorComponents();
    var opts = new CaldovaAgentOptions();
    sb.Services.AddSingleton(opts);
    sb.Services.AddSingleton<CaldovaAgentFactory>();
    sb.Services.AddSingleton<CaseStore>();
    sb.Services.AddSingleton<PaymentApprovalStore>();
    sb.Services.AddSingleton<TeamsMcpTools>();
    sb.Services.AddSingleton<PaymentsMcpTools>();
    var web = sb.Build();
    var wwwroot = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "..", "..", "repo", "caldova-super-agent", "src", "backend", "wwwroot"));
    if (!Directory.Exists(wwwroot)) wwwroot = @"D:\repo\caldova-super-agent\src\backend\wwwroot";
    web.UseStaticFiles(new StaticFileOptions { FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(wwwroot) });
    web.UseAntiforgery();
    var cs = web.Services.GetRequiredService<CaseStore>();
    cs.SeedDefaults();
    web.MapMarkdownEndpoints();
    web.MapAgentMetadataEndpoints(opts);
    web.MapPaymentsEndpoints(cs, web.Services.GetRequiredService<CaldovaAgentFactory>(), web.Services.GetRequiredService<ILogger<CaseStore>>());
    web.MapRazorComponents<CaldovaSuper.App.TestApp>();
    await web.RunAsync();
    return;
}

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("http://127.0.0.1:0");
builder.Logging.SetMinimumLevel(LogLevel.Warning);
builder.Services.AddSingleton(new CaldovaAgentOptions());
builder.Services.AddSingleton<CaldovaAgentFactory>();
builder.Services.AddSingleton<CaseStore>();
builder.Services.AddSingleton<PaymentApprovalStore>();
builder.Services.AddSingleton<TeamsMcpTools>();
builder.Services.AddSingleton<PaymentsMcpTools>();
var app = builder.Build();
var store = app.Services.GetRequiredService<CaseStore>();
store.SeedDefaults();
app.MapPaymentsEndpoints(store, app.Services.GetRequiredService<CaldovaAgentFactory>(), app.Services.GetRequiredService<ILogger<CaseStore>>());
await app.StartAsync();
var http = new HttpClient { BaseAddress = new Uri(app.Urls.First()) };
var json = new JsonSerializerOptions { WriteIndented = true, Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping };
string Dump(JsonNode? n) => n?.ToJsonString(json) ?? "null";

var cases = await http.GetFromJsonAsync<JsonArray>("/payments/cases");
Console.WriteLine("CASES: " + string.Join(", ", cases!.Select(c => $"{c!["caseNumber"]}={c["sampleId"]}")));

foreach (var c in cases!)
{
    var caseNumber = c!["caseNumber"]!.GetValue<string>();
    var inputs = await http.GetFromJsonAsync<JsonObject>($"/payments/inputs/{caseNumber}");
    var resp = await http.PostAsJsonAsync("/payments/process", new { caseNumber });
    var body = await resp.Content.ReadFromJsonAsync<JsonObject>();
    Console.WriteLine($"\n===== {caseNumber} ({c["sampleId"]}) HTTP {(int)resp.StatusCode} flow={body!["flow"]} type={body["paymentType"]}");
    Console.WriteLine("inputs: gross=" + inputs!["grossAmount"] + " taxFree=" + inputs["taxFreePercent"] + " status=" + inputs["caseApprovalStatus"] + " payees=" + inputs["payees"]!.ToJsonString());
    var calc = body["calculation"]!;
    Console.WriteLine("calc: " + calc["title"] + " | cols=" + calc["columns"]!.ToJsonString());
    foreach (var row in calc["rows"]!.AsArray()) Console.WriteLine($"   {row!["label"]} [{row["kind"]}] {row["display"]!.ToJsonString()}");
    Console.WriteLine("net: " + calc["netLabel"] + " => " + calc["netDisplay"]);
    foreach (var row in body["contextRows"]!.AsArray()) Console.WriteLine($"   ctx {row!["label"]}: {row["value"]}");
    foreach (var chk in body["crossChecks"]!.AsArray()) Console.WriteLine($"   chk {chk!["key"]} {chk["status"]} {chk["value"]} :: {chk["detail"]}");
    Console.WriteLine("approvalRequired=" + body["humanApprovalRequired"] + " approver=" + body["approver"] + " releaseAllowed=" + body["releaseAllowed"] + " blockedReason=" + body["releaseBlockedReason"]);
    Console.WriteLine("reasons=" + body["humanApprovalReasons"]!.ToJsonString());
    var appr = body["paymentApproval"];
    Console.WriteLine("approval=" + (appr is null ? "null" : $"{appr["approvalId"]} {appr["status"]} teamsSent={appr["teamsSent"]} url={appr["approvalUrl"]} gross={appr["grossFormatted"]} tax={appr["taxWithheldFormatted"]} net={appr["netFormatted"]}"));
    Console.WriteLine("--- confirmation (" + body["confirmationTitle"] + ")\n" + body["paymentConfirmation"]);
    if (caseNumber.EndsWith("DEMO04"))
    {
        Console.WriteLine("--- narrative\n" + body["agentNotes"]);
        Console.WriteLine("--- raw toolCalls: " + string.Join(", ", body["agentRawOutput"]!["toolCalls"]!.AsArray().Select(t => t!["tool"]!.ToString())));
    }
    if (appr is not null)
    {
        var id = appr["approvalId"]!.ToString();
        var early = await http.PostAsync($"/payments/approvals/{id}/release", null);
        Console.WriteLine($"release-before-approve: HTTP {(int)early.StatusCode} {(await early.Content.ReadAsStringAsync())[..Math.Min(140, (await early.Content.ReadAsStringAsync()).Length)]}");
        var ap = await http.PostAsJsonAsync($"/payments/approvals/{id}/agent-approve", new { decidedBy = "Theo (test)" });
        var apBody = await ap.Content.ReadFromJsonAsync<JsonObject>();
        Console.WriteLine($"agent-approve: HTTP {(int)ap.StatusCode} status={(apBody!["approval"] ?? apBody)["status"]} error={apBody["error"]}");
        if (ap.IsSuccessStatusCode)
        {
            var rel = await http.PostAsync($"/payments/approvals/{id}/release", null);
            var relBody = await rel.Content.ReadFromJsonAsync<JsonObject>();
            Console.WriteLine($"release: HTTP {(int)rel.StatusCode} status={relBody!["status"]} ref={relBody["paymentReference"]} payeeRefs={relBody["payees"]!.AsArray().Select(p => p!["paymentReference"]?.ToString()).Aggregate((a, b) => a + "," + b)}");
            Console.WriteLine("--- confirmation after release\n" + relBody["confirmationDraft"]);
        }
    }
}

// MCP tool checks
var tools = app.Services.GetRequiredService<PaymentsMcpTools>();
Console.WriteLine("\n===== MCP");
Console.WriteLine(tools.ValidatePayee("REQ-20261111-DEMO04", "Thomas Bradley", "033-***", "****5120"));
Console.WriteLine(tools.ValidatePayee("REQ-20261106-DEMO02", "G Williams Holdings Pty Ltd", "062123", "12349907"));
Console.WriteLine(tools.CheckCaseApproval("REQ-20261111-DEMO04"));
Console.WriteLine(tools.CalculateBenefit(243100m, 38m, "death-non-dependant", "Robert Chen"));
Console.WriteLine(tools.CheckAuthorityLimit(243100m, "Death benefit lump sum", "REQ-20261113-DEMO05"));
Console.WriteLine(tools.CheckAuthorityLimit(6500m, "pension", "REQ-20261109-DEMO03"));
Console.WriteLine(await tools.RequestApproval("REQ-20261109-DEMO03", 6500m, 0m, 6500m, "G & H Papadopoulos", "BSB 063-*** ****6612"));
Console.WriteLine(await tools.RequestApproval("REQ-20261106-DEMO02", 612400m, 0m, 612400m, "G Williams Holdings Pty Ltd"));
var fresh = await http.PostAsJsonAsync("/payments/process", new { caseNumber = "REQ-20261111-DEMO04" });
var freshBody = await fresh.Content.ReadFromJsonAsync<JsonObject>();
var freshId = freshBody!["paymentApproval"]!["approvalId"]!.ToString();
Console.WriteLine("requestApproval (desk raised) => " + await tools.RequestApproval("REQ-20261111-DEMO04", 10000m, 2068m, 7932m, "Thomas Bradley", "****5120"));
Console.WriteLine("release pending => " + tools.ReleasePayment(freshId));
Console.WriteLine("status => " + tools.GetApprovalStatus(freshId));
var rej = await http.PostAsJsonAsync($"/payments/approvals/{freshId}/reject", new { decidedBy = "Theo" });
Console.WriteLine("reject => " + (int)rej.StatusCode);
Console.WriteLine("release rejected => " + tools.ReleasePayment(freshId));

// Edited inputs: hardship gross above approval -> blocked; payee mismatch -> approval reasons
var edited = await http.PostAsJsonAsync("/payments/process", new { caseNumber = "REQ-20261111-DEMO04", grossAmount = 15000, payees = new[] { new { name = "T Bradley Pty Ltd", bsb = "033-***", account = "****5120", sharePercent = 100 } } });
var editedBody = await edited.Content.ReadFromJsonAsync<JsonObject>();
Console.WriteLine($"\nedited: flow={editedBody!["flow"]} blocked={editedBody["releaseBlockedReason"]} reasons={editedBody["humanApprovalReasons"]!.ToJsonString()}");
var sse = new HttpRequestMessage(HttpMethod.Post, "/payments/process") { Content = JsonContent.Create(new { caseNumber = "REQ-20261113-DEMO05" }) };
sse.Headers.Accept.ParseAdd("text/event-stream");
var sseResp = await http.SendAsync(sse);
var sseText = await sseResp.Content.ReadAsStringAsync();
Console.WriteLine($"SSE: {(int)sseResp.StatusCode} {sseResp.Content.Headers.ContentType} starts='{sseText[..Math.Min(60, sseText.Length)].Replace("\n", "\\n")}' len={sseText.Length}");
await app.StopAsync();

