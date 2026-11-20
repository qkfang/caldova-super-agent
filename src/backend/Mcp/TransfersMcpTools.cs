using System.ComponentModel;
using System.Globalization;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using ModelContextProtocol.Server;
using CaldovaSuper.App.Services;

namespace CaldovaSuper.App.Mcp;

/// <summary>
/// MCP tools that back the Transfers &amp; Rollovers agent (Rory). Exposes
/// the counterparty directory (<c>lookupFunds</c>), the SMSF verification
/// check required before any rollover to an SMSF (<c>verifySmsf</c>) and the
/// branded transfer / rollover request PDF (<c>generateTransferRequestPdf</c>,
/// downloaded from <c>/transfers/request/{id}.pdf</c>). Served under
/// <c>/mcp</c> so the Foundry agent can call them over the MCP transport.
/// </summary>
[McpServerToolType]
public class TransfersMcpTools
{
    internal static readonly JsonSerializerOptions JsonOpts = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    private readonly TransferRequestPdfService _pdfService;
    private readonly CaseStore _caseStore;
    private readonly IConfiguration _configuration;

    public TransfersMcpTools(TransferRequestPdfService pdfService, CaseStore caseStore, IConfiguration configuration)
    {
        _pdfService = pdfService;
        _caseStore = caseStore;
        _configuration = configuration;
    }

    [McpServerTool(Name = "lookupFunds"),
     Description("Look up Caldova's directory of counterparties for transfers and rollovers — external super funds by USI, self-managed super funds (SMSFs) by ABN, the ATO, other platforms, group insurers and Caldova Pension. Returns each match's USI/ABN, type, SuperStream or ESA channel, contact, typical turnaround, any insurance cover known to be held for a Caldova member, and notes. Call it first to identify every counterparty on a case.")]
    public string LookupFunds(
        [Description("Fund name, USI (e.g. SCI0001AU), ABN, or a keyword such as 'smsf', 'ATO', 'industry', 'retail', 'platform', 'insurer' or 'pension'. Several terms can be combined, e.g. 'SCI0001AU HRB0007AU'. Leave empty to list the whole directory.")]
        string query) => Serialize(LookupFundsResult(query));

    internal static object LookupFundsResult(string? query)
    {
        var funds = FundDirectory.Lookup(query);
        return new
        {
            query = query ?? string.Empty,
            count = funds.Count,
            funds = funds.Select(FundDirectory.ToView)
        };
    }

    [McpServerTool(Name = "verifySmsf"),
     Description("Run the SMSF verification check (the ATO SMSF verification service, SIS reg 6.33E) that is required before ANY rollover to a self-managed super fund: is the ABN a registered SMSF (and when was it registered), is the member's TFN linked to it, and do the bank details and electronic service address (ESA) on the request match the ATO's records. Returns pass/fail per check with a recommendation. If it fails, hold the rollover, send nothing to the receiving fund and refer the case to Financial Crime.")]
    public string VerifySmsf(
        [Description("ABN of the receiving SMSF, e.g. '98 765 432 109'.")] string abn,
        [Description("Full name of the Caldova member who is rolling over.")] string memberName,
        [Description("BSB of the SMSF bank account on the request (masked digits are fine, e.g. '062-***').")] string bsb,
        [Description("Bank account name on the request.")] string accountName,
        [Description("Electronic service address (ESA) on the request.")] string esa) =>
        Serialize(FundDirectory.VerifySmsf(abn, memberName, bsb, accountName, esa));

    [McpServerTool(Name = "generateTransferRequestPdf"),
     Description("Generate the branded Caldova Wealth rollover / transfer request PDF for a case once the transfer plan is settled. Each transfer is printed with its counterparty, direction, amount and status (DISPATCHED, HELD, SCHEDULED), plus insurance-loss warnings, the SMSF verification result and the 3-business-day service level. Returns JSON with a downloadUrl the operator can click.")]
    public string GenerateTransferRequestPdf(
        [Description("Case number, e.g. REQ-20261103-OPS001.")] string caseNumber,
        [Description("Member's full name (for a death benefit, the deceased member).")] string memberName,
        [Description("Caldova member or account number, e.g. CS-2049817.")] string memberNumber,
        [Description("JSON array of transfers: [{ \"counterparty\": \"Harbourline Retail Super\", \"counterpartyId\": \"HRB0007AU\", \"direction\": \"Rollover in\", \"transferType\": \"SuperStream rollover — full balance\", \"amount\": 41800, \"status\": \"Dispatched\", \"detail\": \"No insurance held\" }]. Use [] when no transfer is required.")]
        string transfersJson,
        [Description("Optional overall status for the banner, e.g. 'DISPATCHED (1) · HELD (1)', 'HELD — NOT SENT', 'SCHEDULED', 'NO TRANSFER REQUIRED'. Derived from the transfers when omitted.")]
        string? requestStatus = null,
        [Description("Optional insurance-loss warnings, one per line.")] string? insuranceWarnings = null,
        [Description("Optional one-paragraph summary of the SMSF verification result.")] string? svsSummary = null,
        [Description("Optional notes for the case file or the counterparty, one per line.")] string? notes = null)
    {
        List<TransferRequestPdfLeg> legs;
        try
        {
            legs = ParseLegs(transfersJson);
        }
        catch (Exception ex)
        {
            return Serialize(new { error = $"Could not parse transfersJson: {ex.Message}" });
        }

        var record = _caseStore.Get(caseNumber ?? string.Empty);
        var input = new TransferRequestPdfInput(
            CaseNumber: caseNumber ?? string.Empty,
            MemberName: memberName ?? string.Empty,
            MemberNumber: memberNumber ?? string.Empty,
            Product: record?.Product ?? "Caldova Super",
            RequestType: record?.RequestType ?? "Transfer / rollover",
            Adviser: record is null ? "—" : AdviserText(record),
            AsAt: record is null ? FundCatalog.Label(DateOnly.FromDateTime(DateTime.Today)) : AsAtLabel(record),
            RequestStatus: string.IsNullOrWhiteSpace(requestStatus) ? DeriveStatus(legs) : requestStatus!,
            Legs: legs,
            InsuranceWarnings: SplitLines(insuranceWarnings),
            SvsSummary: string.IsNullOrWhiteSpace(svsSummary) ? null : svsSummary,
            SvsChecks: Array.Empty<TransferRequestPdfCheck>(),
            SlaLines: legs.Where(l => l.Status.StartsWith("Dispatch", StringComparison.OrdinalIgnoreCase))
                .Select(l => $"{l.Counterparty}: complete within 3 business days of the request.")
                .ToList(),
            Notes: SplitLines(notes));

        var pdf = _pdfService.Generate(input);
        return Serialize(DownloadPayload(pdf, BaseUrl(_configuration)));
    }

    /// <summary>JSON payload describing a generated PDF (shared with the /transfers/process flow).</summary>
    internal static object DownloadPayload(TransferRequestPdfRecord pdf, string baseUrl)
    {
        var relative = $"/transfers/request/{pdf.Id}.pdf";
        return new
        {
            id = pdf.Id,
            fileName = pdf.FileName,
            byteLength = pdf.Content.Length,
            createdAt = pdf.CreatedAt,
            downloadUrl = $"{baseUrl}{relative}",
            relativeUrl = relative
        };
    }

    internal static string BaseUrl(IConfiguration configuration)
    {
        var configured = new[] { configuration["APP_BASE_URL"], configuration["APP_MCP_URL"] }
            .FirstOrDefault(v => !string.IsNullOrWhiteSpace(v));
        return (configured ?? "http://localhost:5212").Trim().TrimEnd('/');
    }

    internal static string Serialize(object value) => JsonSerializer.Serialize(value, JsonOpts);

    internal static string AdviserText(CaseRecord c) =>
        string.IsNullOrWhiteSpace(c.AdviserPractice) ? c.AdviserName : $"{c.AdviserName} ({c.AdviserPractice})";

    internal static string AsAtLabel(CaseRecord c) =>
        DateOnly.TryParseExact(c.ReceivedDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d)
            ? FundCatalog.Label(d)
            : c.ReceivedDate;

    private static List<TransferRequestPdfLeg> ParseLegs(string? json)
    {
        var legs = new List<TransferRequestPdfLeg>();
        if (string.IsNullOrWhiteSpace(json)) return legs;

        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        var items = root.ValueKind == JsonValueKind.Array
            ? root.EnumerateArray().ToList()
            : root.ValueKind == JsonValueKind.Object && root.TryGetProperty("transfers", out var arr) && arr.ValueKind == JsonValueKind.Array
                ? arr.EnumerateArray().ToList()
                : root.ValueKind == JsonValueKind.Object ? new List<JsonElement> { root } : new List<JsonElement>();

        foreach (var el in items.Where(e => e.ValueKind == JsonValueKind.Object))
        {
            legs.Add(new TransferRequestPdfLeg(
                Counterparty: Str(el, "counterparty") ?? Str(el, "fund") ?? Str(el, "name") ?? "Counterparty",
                CounterpartyId: Str(el, "counterpartyId") ?? Str(el, "usi") ?? Str(el, "abn") ?? string.Empty,
                Direction: Str(el, "direction") ?? "Transfer",
                TransferType: Str(el, "transferType") ?? Str(el, "type") ?? string.Empty,
                Amount: AmountText(el),
                Status: Str(el, "status") ?? "Held",
                Detail: Str(el, "detail") ?? Str(el, "reason") ?? Str(el, "note") ?? string.Empty));
        }
        return legs;
    }

    private static string AmountText(JsonElement el)
    {
        if (!el.TryGetProperty("amount", out var v)) return Str(el, "amountLabel") ?? "—";
        if (v.ValueKind == JsonValueKind.Number && v.TryGetDecimal(out var d))
            return d.ToString(d == decimal.Truncate(d) ? "C0" : "C2", CultureInfo.GetCultureInfo("en-AU"));
        return v.ValueKind == JsonValueKind.String ? v.GetString() ?? "—" : "—";
    }

    private static string DeriveStatus(IReadOnlyList<TransferRequestPdfLeg> legs)
    {
        if (legs.Count == 0) return "NO TRANSFER REQUIRED";
        var dispatched = legs.Count(l => l.Status.StartsWith("Dispatch", StringComparison.OrdinalIgnoreCase));
        var held = legs.Count(l => l.Status.StartsWith("Held", StringComparison.OrdinalIgnoreCase)
                                   || l.Status.StartsWith("Block", StringComparison.OrdinalIgnoreCase));
        var scheduled = legs.Count(l => l.Status.StartsWith("Schedul", StringComparison.OrdinalIgnoreCase));
        if (held > 0 && dispatched == 0 && scheduled == 0) return "HELD — NOT SENT";
        if (dispatched == legs.Count) return "DISPATCHED";
        if (scheduled == legs.Count) return "SCHEDULED";
        var parts = new List<string>();
        if (dispatched > 0) parts.Add($"DISPATCHED ({dispatched})");
        if (scheduled > 0) parts.Add($"SCHEDULED ({scheduled})");
        if (held > 0) parts.Add($"HELD ({held})");
        return parts.Count > 0 ? string.Join(" · ", parts) : legs[0].Status.ToUpperInvariant();
    }

    private static IReadOnlyList<string> SplitLines(string? text) =>
        string.IsNullOrWhiteSpace(text)
            ? Array.Empty<string>()
            : text.Split(new[] { '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(l => l.TrimStart('-', '•', '*', ' '))
                .Where(l => l.Length > 0)
                .ToList();

    private static string? Str(JsonElement el, string name) =>
        el.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
}
