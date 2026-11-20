using System.ComponentModel;
using System.Globalization;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using ClosedXML.Excel;
using Microsoft.Extensions.Logging;
using ModelContextProtocol.Server;

namespace CaldovaSuper.App.Mcp;

/// <summary>
/// MCP tools surfaced to the Investment Analyst Foundry agent (Ivy,
/// Investment Solutions). They give the agent concrete, deterministic skills
/// it can decide to call when reviewing a Member Case:
///
/// - <c>analyzeFactSheet</c>       — fetch a Caldova Managed Portfolio fact
///   sheet (JSON, markdown or plain text) and return the parsed model: split,
///   asset allocation, investment fee (ICR), spread, risk band, timeframe,
///   illustrative returns, holdings and notes.
/// - <c>compareModels</c>          — total annual Caldova fees in dollars for
///   each model (or income structure) on the client's balance, as a markdown
///   table, a Mermaid bar chart and plain-English observations.
/// - <c>generateClientWorkbook</c> — write the case's .xlsx workbook (case
///   summary, comparison, fact sheets, plans, recommendations) to
///   <c>wwwroot/investments/output/</c> and return its download URL
///   (<c>/investments/download/{fileName}</c>, served by Program.cs).
///
/// The same internals back the deterministic <c>/investments/process</c>
/// flow in <see cref="CaldovaSuper.App.Api.InvestmentsApi"/>, so the page
/// shows identical numbers whether or not the Foundry agent is configured.
/// </summary>
[McpServerToolType]
public class InvestmentsMcpTools
{
    /// <summary>App-relative URL prefix of the sample fact sheets in wwwroot.</summary>
    internal const string SamplesUrlPrefix = "/investments/samples/";

    /// <summary>App-relative URL prefix of the workbook download endpoint (Program.cs).</summary>
    internal const string DownloadUrlPrefix = "/investments/download/";

    /// <summary>Caldova Super &amp; Pension account-keeping fee, $ p.a.</summary>
    internal const decimal AccountKeepingFee = 180m;

    /// <summary>Buy/sell spread on every Caldova Managed Portfolio, % of the amount transacted.</summary>
    internal const decimal DefaultBuySellSpreadPercent = 0.10m;

    private const int MaxWorkbooksKept = 100;

    internal static readonly CultureInfo AuCulture = CultureInfo.GetCultureInfo("en-AU");

    // Relaxed escaping keeps "—", "×" and "$" readable when tool output is
    // embedded in an agent prompt. The output is never written into HTML.
    internal static readonly JsonSerializerOptions JsonOpts = new()
    {
        WriteIndented = false,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    private readonly IWebHostEnvironment _environment;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<InvestmentsMcpTools> _logger;

    public InvestmentsMcpTools(
        IWebHostEnvironment environment,
        IHttpClientFactory httpClientFactory,
        ILogger<InvestmentsMcpTools> logger)
    {
        _environment = environment;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    private string WebRoot => _environment.WebRootPath ?? "wwwroot";

    /// <summary>Folder the workbooks are written to (served by /investments/download/{fileName}).</summary>
    internal string OutputDirectory => Path.Combine(WebRoot, "investments", "output");

    // ─────────────────────────────────────────────────────────────────────
    // analyzeFactSheet
    // ─────────────────────────────────────────────────────────────────────

    [McpServerTool(Name = "analyzeFactSheet"),
     Description("Fetch a Caldova Managed Portfolio fact sheet (JSON, markdown or plain text — an app path under /investments/samples/ or an http(s) URL) and return the parsed model as JSON: name, code, growth/defensive split, asset allocation, investment fee (ICR), buy/sell spread, standard risk measure, minimum suggested timeframe, illustrative 1/3/5-year returns with the past-performance warning, top holdings and sector notes. Call it once for each fact sheet in the brief before comparing models.")]
    public async Task<string> AnalyzeFactSheet(
        [Description("URL or app path of the fact sheet. Paths starting with '/' are resolved against the app's wwwroot (e.g. /investments/samples/model-growth.json); public http(s) URLs are fetched over HTTP.")]
        string documentUrl)
    {
        if (string.IsNullOrWhiteSpace(documentUrl))
            return JsonError("documentUrl is required.");

        try
        {
            var sheet = await LoadFactSheetAsync(documentUrl);
            if (sheet is null)
                return JsonError($"Fact sheet not found: '{documentUrl}'.");

            return Serialize(new { source = documentUrl, factSheet = sheet });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "analyzeFactSheet failed for {Url}", Sanitize(documentUrl));
            return JsonError($"Failed to analyse the fact sheet: {ex.Message}");
        }
    }

    /// <summary>Read and parse one fact sheet; <c>null</c> when it can't be found.</summary>
    internal async Task<FactSheet?> LoadFactSheetAsync(string documentUrl)
    {
        var content = await ReadDocumentAsync(documentUrl);
        return content is null ? null : ParseFactSheet(documentUrl, content);
    }

    // ─────────────────────────────────────────────────────────────────────
    // compareModels
    // ─────────────────────────────────────────────────────────────────────

    [McpServerTool(Name = "compareModels"),
     Description("Compare Caldova Managed Portfolios — or income structures built from them, such as a cash bucket plus a model — on a client's balance. For each option it calculates the total annual Caldova fees in DOLLARS: the tiered admin fee on the whole balance (0.30% on the first $250,000, 0.15% to $1,000,000, 0.05% to $2,000,000, nil above) plus the $180 p.a. account-keeping fee plus the investment fee (ICR) on the amount invested in each model. Returns JSON with a markdown comparison table (comparisonMarkdown), a Mermaid bar chart of the annual cost in dollars (chartMermaid, a ```mermaid``` block) and plain-English observations. Embed the table and the chart verbatim in your response.")]
    public string CompareModels(
        [Description("JSON array of options. Accepts analyzeFactSheet results or fact sheets directly (each model is applied to the whole balance), or structure objects { \"name\": \"Cash bucket + Balanced\", \"selected\": true, \"components\": [ { \"label\": \"Cash bucket\", \"amount\": 156000, \"icrPercent\": 0, \"growthPercent\": 0 }, { \"label\": \"Balanced\", \"amount\": 1094000, \"icrPercent\": 0.38, \"growthPercent\": 60 } ] }. Mark the client's current or SoA model with \"selected\": true.")]
        string modelsJson,
        [Description("Account balance in AUD used for the fee calculation, e.g. 138200.")]
        decimal balance)
    {
        if (string.IsNullOrWhiteSpace(modelsJson))
            return JsonError("modelsJson is required.");

        List<ModelOption> options;
        try
        {
            options = ParseModelsPayload(modelsJson).Options;
        }
        catch (Exception ex)
        {
            return JsonError($"Could not parse modelsJson: {ex.Message}");
        }

        if (options.Count == 0)
            return JsonError("Provide at least one model or structure to compare.");

        if (balance <= 0)
        {
            // Structures carry their own amounts — use the largest as the balance.
            var inferred = options
                .Select(o => o.Components.Count > 0 ? o.Components.Sum(c => c.Amount) : o.Amount ?? 0m)
                .DefaultIfEmpty(0m)
                .Max();
            if (inferred <= 0)
                return JsonError("balance must be greater than zero.");
            balance = inferred;
        }

        return Serialize(Compare(options, balance));
    }

    /// <summary>
    /// Core fee comparison shared by the MCP tool, the workbook and the
    /// deterministic page flow. All amounts are AUD, rounded to cents.
    /// </summary>
    internal static ModelComparison Compare(IReadOnlyList<ModelOption> options, decimal balance, string? chartTitle = null)
    {
        balance = Round2(balance);
        var admin = AdminFee(balance);
        var adminAndKeeping = admin + AccountKeepingFee;
        var spreadPercent = options
            .Select(o => o.FactSheet?.BuySellSpreadPercent)
            .FirstOrDefault(v => v.HasValue) ?? DefaultBuySellSpreadPercent;

        var computed = new List<(ModelOption Option, IReadOnlyList<ModelComponent> Components, decimal Invested, decimal InvestmentFee, decimal Total, decimal? Growth, decimal? Defensive)>();
        foreach (var o in options)
        {
            IReadOnlyList<ModelComponent> comps = o.Components.Count > 0
                ? o.Components
                : new[] { new ModelComponent(o.Name, o.Amount is > 0 ? o.Amount.Value : balance, o.IcrPercent ?? 0m, o.GrowthPercent) };
            var invested = comps.Sum(c => c.Amount);
            var investmentFee = Round2(comps.Sum(c => c.Amount * c.IcrPercent / 100m));
            var growth = o.GrowthPercent ?? WeightedGrowth(comps);
            var defensive = o.DefensivePercent ?? (growth.HasValue ? 100m - growth.Value : null);
            computed.Add((o, comps, invested, investmentFee, investmentFee + adminAndKeeping, growth, defensive));
        }

        var lowestTotal = computed.Min(c => c.Total);
        var rows = computed.Select(c =>
        {
            var blended = c.Invested > 0 ? Math.Round(c.InvestmentFee / c.Invested * 100m, 3) : 0m;
            var multi = c.Components.Count > 1;
            return new ModelCostRow(
                Name: c.Option.Name,
                Code: c.Option.Code,
                Selected: c.Option.Selected,
                GrowthDefensive: FormatSplit(c.Growth, c.Defensive),
                IcrPercent: multi ? blended : c.Components[0].IcrPercent,
                IcrLabel: multi ? $"{FormatPercent(blended)} blended" : FormatPercent(c.Components[0].IcrPercent),
                InvestedAmount: c.Invested,
                InvestmentFee: c.InvestmentFee,
                AdminFee: admin,
                AccountKeepingFee: AccountKeepingFee,
                AdminAndAccountKeepingFee: adminAndKeeping,
                TotalFee: c.Total,
                TotalFeePercent: balance > 0 ? Math.Round(c.Total / balance * 100m, 3) : 0m,
                DifferenceVsLowest: c.Total - lowestTotal,
                Components: multi
                    ? string.Join(" + ", c.Components.Select(p =>
                        $"{p.Label} {MoneySmart(p.Amount)} ({(p.IcrPercent == 0 ? "no investment fee" : FormatPercent(p.IcrPercent) + " ICR")})"))
                    : null,
                Style: c.Option.Style ?? c.Option.FactSheet?.Style,
                Note: c.Option.Note);
        }).ToList();

        var feeBasis = new ModelFeeBasis(
            Balance: balance,
            AdminFee: admin,
            AdminFeeWorking: AdminFeeWorking(balance),
            AccountKeepingFee: AccountKeepingFee,
            AdminAndAccountKeepingFee: adminAndKeeping,
            BuySellSpreadPercent: spreadPercent,
            BuySellSpreadOnBalance: Round2(balance * spreadPercent / 100m));

        var lowest = rows.OrderBy(r => r.TotalFee).First();
        var highest = rows.OrderByDescending(r => r.TotalFee).First();
        var selected = rows.FirstOrDefault(r => r.Selected);

        var summary = new ModelComparisonSummary(
            LowestCostOption: lowest.Name,
            LowestTotal: lowest.TotalFee,
            HighestCostOption: highest.Name,
            HighestTotal: highest.TotalFee,
            Spread: highest.TotalFee - lowest.TotalFee,
            SelectedOption: selected?.Name,
            SelectedTotal: selected?.TotalFee);

        var title = chartTitle ?? $"Total Caldova fees per year on {MoneySmart(balance)}";
        var chart = BuildBarChartMermaid(
            title,
            rows.Select(r => (r.Selected ? $"{r.Name} (selected)" : r.Name, r.TotalFee)).ToList(),
            "AUD per year");

        return new ModelComparison(
            Balance: balance,
            FeeBasis: feeBasis,
            Rows: rows,
            ComparisonMarkdown: BuildComparisonMarkdown(rows, feeBasis),
            ChartMermaid: chart,
            Observations: BuildObservations(rows, feeBasis, options),
            Summary: summary);
    }

    private static string BuildComparisonMarkdown(IReadOnlyList<ModelCostRow> rows, ModelFeeBasis basis)
    {
        var md = new StringBuilder();
        md.AppendLine("| Option | Growth / defensive | Investment fee (ICR) | Investment fee p.a. | Admin + account-keeping fee p.a. | Total Caldova fees p.a. |");
        md.AppendLine("|---|:-:|--:|--:|--:|--:|");
        foreach (var r in rows)
        {
            var name = r.Selected ? $"**{EscapeMd(r.Name)}** (selected)" : EscapeMd(r.Name);
            md.AppendLine(
                $"| {name} | {r.GrowthDefensive} | {r.IcrLabel} | {Money(r.InvestmentFee)} | " +
                $"{Money(r.AdminAndAccountKeepingFee)} | **{Money(r.TotalFee)}** |");
        }
        md.AppendLine();
        md.Append(
            $"_Balance {MoneySmart(basis.Balance)}. Admin fee: {basis.AdminFeeWorking}, plus the " +
            $"{MoneySmart(basis.AccountKeepingFee)} p.a. account-keeping fee — the same for every option. " +
            $"Excludes any adviser fee and the {FormatPercent(basis.BuySellSpreadPercent)} buy/sell spread on transactions._");

        var structures = rows.Where(r => !string.IsNullOrEmpty(r.Components)).ToList();
        if (structures.Count > 0)
        {
            md.AppendLine();
            md.AppendLine();
            foreach (var r in structures)
                md.AppendLine($"- **{EscapeMd(r.Name)}:** {EscapeMd(r.Components!)}");
        }
        return md.ToString().TrimEnd();
    }

    private static List<string> BuildObservations(IReadOnlyList<ModelCostRow> rows, ModelFeeBasis basis, IReadOnlyList<ModelOption> options)
    {
        var obs = new List<string>();
        var lowest = rows.OrderBy(r => r.TotalFee).First();
        var selected = rows.FirstOrDefault(r => r.Selected);

        if (rows.Count == 1)
        {
            obs.Add($"{rows[0].Name} costs {Money(rows[0].TotalFee)} p.a. in total Caldova fees on {MoneySmart(basis.Balance)} " +
                    $"({FormatPercent(rows[0].TotalFeePercent)} of the balance).");
        }
        else if (selected is not null && selected.Name != lowest.Name)
        {
            obs.Add($"{selected.Name} (selected) costs {Money(selected.TotalFee)} p.a. — {Money(selected.TotalFee - lowest.TotalFee)} p.a. more " +
                    $"than {lowest.Name}, the lowest-cost option at {Money(lowest.TotalFee)} p.a.");
            foreach (var r in rows.Where(r => !r.Selected))
            {
                var diff = selected.TotalFee - r.TotalFee;
                var direction = diff >= 0 ? "less" : "more";
                obs.Add($"{r.Name}: {Money(r.TotalFee)} p.a. ({Money(Math.Abs(diff))} {direction} than {selected.Name}), " +
                        $"growth/defensive {r.GrowthDefensive} vs {selected.GrowthDefensive}.");
            }
        }
        else if (selected is not null)
        {
            obs.Add($"{selected.Name} (selected) is the lowest-cost option compared, at {Money(selected.TotalFee)} p.a.");
        }
        else
        {
            var highest = rows.OrderByDescending(r => r.TotalFee).First();
            obs.Add($"Lowest annual cost: {lowest.Name} at {Money(lowest.TotalFee)} p.a.; highest: {highest.Name} at " +
                    $"{Money(highest.TotalFee)} p.a. — a difference of {Money(highest.TotalFee - lowest.TotalFee)} p.a.");
        }

        obs.Add($"The admin fee ({Money(basis.AdminFee)}) and the {MoneySmart(basis.AccountKeepingFee)} account-keeping fee are charged on the " +
                "whole account whichever option is chosen — only the investment fee (ICR) differs.");
        obs.Add($"Figures exclude any adviser fee and the {FormatPercent(basis.BuySellSpreadPercent)} buy/sell spread, which is a one-off cost " +
                $"when money is invested, switched or redeemed (about {Money(basis.BuySellSpreadOnBalance)} on {MoneySmart(basis.Balance)}).");

        var passive = options.Where(o => (o.Style ?? o.FactSheet?.Style ?? string.Empty)
            .Contains("passive", StringComparison.OrdinalIgnoreCase)).Select(o => o.Name).ToList();
        if (passive.Count > 0 && passive.Count < options.Count)
        {
            obs.Add($"{string.Join(" and ", passive)} {(passive.Count == 1 ? "is" : "are")} passively managed (index), which is why the fee " +
                    "is lower; active models aim to add value after fees but may not.");
        }

        var splits = rows.Select(r => r.GrowthDefensive).Where(s => s != "—").Distinct().ToList();
        if (splits.Count > 1)
        {
            obs.Add("The options carry different levels of investment risk (growth/defensive " + string.Join(", ", splits) + "). " +
                    "Fees are only one factor — any change must fit the client's risk profile and Statement of Advice, and is a " +
                    "decision for the adviser and client.");
        }

        obs.Add("Past performance is not a reliable indicator of future performance.");
        return obs;
    }

    /// <summary>
    /// Mermaid <c>xychart-beta</c> bar chart wrapped in a ```mermaid fence.
    /// Used for fee comparisons and for before/after balance charts.
    /// </summary>
    internal static string BuildBarChartMermaid(string title, IReadOnlyList<(string Label, decimal Value)> bars, string yAxisTitle)
    {
        var max = bars.Count == 0 ? 1m : Math.Max(1m, bars.Max(b => b.Value));
        var sb = new StringBuilder();
        sb.AppendLine("```mermaid");
        sb.AppendLine("xychart-beta");
        sb.AppendLine($"    title \"{EscapeMermaid(title)}\"");
        sb.AppendLine($"    x-axis [{string.Join(", ", bars.Select(b => $"\"{EscapeMermaid(b.Label)}\""))}]");
        sb.AppendLine($"    y-axis \"{EscapeMermaid(yAxisTitle)}\" 0 --> {NiceCeiling(max * 1.1m).ToString(CultureInfo.InvariantCulture)}");
        sb.AppendLine($"    bar [{string.Join(", ", bars.Select(b => Round2(b.Value).ToString("0.##", CultureInfo.InvariantCulture)))}]");
        sb.Append("```");
        return sb.ToString();
    }

    // ─────────────────────────────────────────────────────────────────────
    // generateClientWorkbook
    // ─────────────────────────────────────────────────────────────────────

    [McpServerTool(Name = "generateClientWorkbook"),
     Description("Generate the client's Excel (.xlsx) workbook for adviser review: Case Summary; Model Comparison with total annual fees in dollars; Fact Sheets and Asset Allocation (when fact sheets are supplied); one sheet per table in the summary or recommendations (e.g. holdings, an income or redemption plan); and Recommendations with the required warnings. Saves the file under wwwroot/investments/output/ and returns JSON with its downloadUrl (/investments/download/{fileName}).")]
    public string GenerateClientWorkbook(
        [Description("Case number, e.g. REQ-20261103-OPS001. Used in the file name.")]
        string caseNumber,
        [Description("JSON object of case summary fields (client, member number, product, adviser, risk profile, current model, balance, …). Keys become labels. Include \"balance\" so fees can be calculated. Arrays of objects (e.g. \"holdings\") are written to their own sheet.")]
        string caseSummaryJson,
        [Description("The same JSON accepted by compareModels (options and/or fact sheets), or the compareModels result. Pass [] if there is nothing to compare.")]
        string modelsJson,
        [Description("JSON object of recommendations, e.g. { \"portfolioFit\": \"…\", \"nextSteps\": \"…\", \"humanApprovalRequired\": \"Yes — …\", \"plan\": [ { \"step\": 1, \"source\": \"…\", \"amount\": 943 } ] }. Arrays of objects are written as their own sheets. Pass {} if none.")]
        string recommendationsJson)
    {
        if (string.IsNullOrWhiteSpace(caseNumber))
            return JsonError("caseNumber is required.");

        WorkbookJsonSection summary;
        try { summary = ReadSection(caseSummaryJson); }
        catch (Exception ex) { return JsonError($"Could not parse caseSummaryJson: {ex.Message}"); }

        ModelsPayload models;
        try { models = string.IsNullOrWhiteSpace(modelsJson) ? ModelsPayload.Empty : ParseModelsPayload(modelsJson); }
        catch (Exception ex) { return JsonError($"Could not parse modelsJson: {ex.Message}"); }

        WorkbookJsonSection recs;
        try { recs = ReadSection(recommendationsJson); }
        catch (Exception ex) { return JsonError($"Could not parse recommendationsJson: {ex.Message}"); }

        var balance = summary.Balance ?? models.Balance;
        var fileName = $"{SafeFileToken(caseNumber)}-investments-{DateTime.UtcNow:yyyyMMdd-HHmmss}-{Guid.NewGuid().ToString("N")[..4]}.xlsx";
        var outputDir = OutputDirectory;

        try
        {
            Directory.CreateDirectory(outputDir);
            var fullPath = Path.Combine(outputDir, fileName);
            var sheets = new List<string>();

            using (var wb = new XLWorkbook())
            {
                WriteSummarySheet(wb, caseNumber, summary, sheets);

                ModelComparison? comparison = models.Options.Count > 0 && balance is > 0
                    ? Compare(models.Options, balance.Value)
                    : null;
                WriteComparisonSheet(wb, models, comparison, sheets);
                WriteFactSheetSheets(wb, models.FactSheets, sheets);

                foreach (var table in summary.Tables)
                    WriteTableSheet(wb, table.Name, table.Rows, sheets);
                foreach (var table in recs.Tables)
                    WriteTableSheet(wb, table.Name, table.Rows, sheets);

                WriteRecommendationsSheet(wb, recs, sheets);
                wb.SaveAs(fullPath);
            }

            PruneOldWorkbooks(outputDir);

            var downloadUrl = DownloadUrlPrefix + Uri.EscapeDataString(fileName);
            _logger.LogInformation("generateClientWorkbook wrote {File}", fileName);

            return Serialize(new
            {
                caseNumber,
                fileName,
                downloadUrl,
                sheets,
                optionCount = models.Options.Count,
                factSheetCount = models.FactSheets.Count,
                balance
            });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "generateClientWorkbook failed for {CaseNumber}", Sanitize(caseNumber));
            return JsonError($"Failed to generate the workbook: {ex.Message}");
        }
    }

    private static readonly XLColor HeaderFill = XLColor.FromHtml("#FDE68A");
    private static readonly XLColor BrandFill = XLColor.FromHtml("#0F172A");
    private static readonly XLColor AccentColour = XLColor.FromHtml("#F59E0B");
    private const string MoneyFormat = "$#,##0.00";

    private static void WriteSummarySheet(XLWorkbook wb, string caseNumber, WorkbookJsonSection summary, List<string> sheets)
    {
        var ws = wb.Worksheets.Add(UniqueSheetName(wb, "Case Summary"));
        sheets.Add(ws.Name);

        ws.Cell(1, 1).Value = "Caldova Wealth — Investment Solutions";
        ws.Range(1, 1, 1, 2).Merge().Style
            .Font.SetBold().Font.SetFontSize(14).Font.SetFontColor(XLColor.White)
            .Fill.SetBackgroundColor(BrandFill);
        ws.Cell(2, 1).Value = $"Client workbook · case {caseNumber}";
        ws.Range(2, 1, 2, 2).Merge().Style.Font.SetBold().Font.SetFontColor(AccentColour);
        ws.Cell(3, 1).Value =
            $"Prepared {DateTime.UtcNow.ToString("d MMM yyyy", AuCulture)} by the Investment Analyst Agent (Ivy) for adviser review. " +
            "General information only — not personal financial advice.";
        ws.Range(3, 1, 3, 2).Merge().Style.Font.SetItalic().Alignment.SetWrapText(true);
        ws.Row(3).Height = 30;

        WriteHeader(ws, 5, "Field", "Value");
        var row = 6;
        ws.Cell(row, 1).Value = "Case number";
        ws.Cell(row, 2).Value = caseNumber;
        row++;
        foreach (var (label, value) in summary.Fields)
        {
            if (string.Equals(label, "Case number", StringComparison.OrdinalIgnoreCase)) continue;
            ws.Cell(row, 1).Value = label;
            SetCell(ws.Cell(row, 2), value, label);
            row++;
        }
        ws.Range(6, 1, Math.Max(6, row - 1), 1).Style.Font.SetBold();
        FitColumns(ws, 2, 80);
    }

    private static void WriteComparisonSheet(XLWorkbook wb, ModelsPayload models, ModelComparison? comparison, List<string> sheets)
    {
        var ws = wb.Worksheets.Add(UniqueSheetName(wb, "Model Comparison"));
        sheets.Add(ws.Name);
        ws.Cell(1, 1).Value = "Model comparison — total annual Caldova fees in dollars";
        ws.Cell(1, 1).Style.Font.SetBold().Font.SetFontSize(13);

        if (models.Options.Count == 0)
        {
            ws.Cell(3, 1).Value = "No model comparison is needed for this case.";
            FitColumns(ws, 1, 80);
            return;
        }

        if (comparison is null)
        {
            ws.Cell(2, 1).Value = "Balance not supplied — fees in dollars not calculated. Investment fees (ICR) are shown as percentages.";
            WriteHeader(ws, 4, "Option", "Code", "Growth / defensive", "Investment fee (ICR) % p.a.");
            var r = 5;
            foreach (var o in models.Options)
            {
                ws.Cell(r, 1).Value = o.Selected ? $"{o.Name} (selected)" : o.Name;
                ws.Cell(r, 2).Value = o.Code ?? string.Empty;
                ws.Cell(r, 3).Value = FormatSplit(o.GrowthPercent, o.DefensivePercent);
                if (o.IcrPercent is decimal icr) ws.Cell(r, 4).Value = icr;
                r++;
            }
            FitColumns(ws, 4, 60);
            return;
        }

        var basis = comparison.FeeBasis;
        ws.Cell(2, 1).Value =
            $"Balance {MoneySmart(basis.Balance)} · admin fee {basis.AdminFeeWorking} · account-keeping fee {MoneySmart(basis.AccountKeepingFee)} p.a.";
        ws.Cell(2, 1).Style.Font.SetItalic();

        WriteHeader(ws, 4,
            "Option", "Code", "Growth / defensive", "Investment fee (ICR) % p.a.", "Amount invested",
            "Investment fee $ p.a.", "Admin + account-keeping $ p.a.", "Total Caldova fees $ p.a.",
            "Total as % of balance", "Difference vs lowest $ p.a.", "Structure");

        var row = 5;
        foreach (var r in comparison.Rows)
        {
            ws.Cell(row, 1).Value = r.Selected ? $"{r.Name} (selected)" : r.Name;
            ws.Cell(row, 2).Value = r.Code ?? string.Empty;
            ws.Cell(row, 3).Value = r.GrowthDefensive;
            ws.Cell(row, 4).Value = r.IcrPercent;
            ws.Cell(row, 4).Style.NumberFormat.Format = "0.00";
            ws.Cell(row, 5).Value = r.InvestedAmount;
            ws.Cell(row, 6).Value = r.InvestmentFee;
            ws.Cell(row, 7).Value = r.AdminAndAccountKeepingFee;
            ws.Cell(row, 8).Value = r.TotalFee;
            ws.Cell(row, 9).Value = r.TotalFeePercent;
            ws.Cell(row, 9).Style.NumberFormat.Format = "0.00";
            ws.Cell(row, 10).Value = r.DifferenceVsLowest;
            ws.Cell(row, 11).Value = r.Components ?? string.Empty;
            foreach (var c in new[] { 5, 6, 7, 8, 10 })
                ws.Cell(row, c).Style.NumberFormat.Format = MoneyFormat;
            if (r.Selected) ws.Range(row, 1, row, 11).Style.Font.SetBold();
            row++;
        }

        ws.Range(5, 8, row - 1, 8).AddConditionalFormat()
            .DataBar(AccentColour)
            .LowestValue()
            .HighestValue();

        row++;
        foreach (var note in comparison.Observations)
        {
            ws.Cell(row, 1).Value = "• " + note;
            ws.Range(row, 1, row, 11).Merge().Style.Alignment.SetWrapText(true);
            ws.Row(row).Height = 30;
            row++;
        }

        ws.SheetView.FreezeRows(4);
        FitColumns(ws, 11, 45);
    }

    private static void WriteFactSheetSheets(XLWorkbook wb, IReadOnlyList<FactSheet> factSheets, List<string> sheets)
    {
        if (factSheets.Count == 0) return;

        var ws = wb.Worksheets.Add(UniqueSheetName(wb, "Fact Sheets"));
        sheets.Add(ws.Name);
        WriteHeader(ws, 1,
            "Model", "Code", "Style", "Growth / defensive", "Investment fee (ICR) % p.a.", "Buy/sell spread %",
            "Standard risk measure", "Negative years in 20", "Min. timeframe (years)",
            "1-year return %", "3-year return % p.a.", "5-year return % p.a.", "Returns to", "Objective");

        var row = 2;
        foreach (var fs in factSheets)
        {
            ws.Cell(row, 1).Value = fs.Name;
            ws.Cell(row, 2).Value = fs.Code ?? string.Empty;
            ws.Cell(row, 3).Value = fs.Style ?? string.Empty;
            ws.Cell(row, 4).Value = fs.GrowthDefensive;
            if (fs.InvestmentFeePercent is decimal icr) ws.Cell(row, 5).Value = icr;
            if (fs.BuySellSpreadPercent is decimal spread) ws.Cell(row, 6).Value = spread;
            ws.Cell(row, 7).Value = fs.RiskBand is int band ? $"{band} — {fs.RiskLabel}" : fs.RiskLabel ?? string.Empty;
            ws.Cell(row, 8).Value = fs.NegativeYearsIn20 ?? string.Empty;
            if (fs.MinimumTimeframeYears is int years) ws.Cell(row, 9).Value = years;
            if (fs.Returns?.OneYearPercent is decimal r1) ws.Cell(row, 10).Value = r1;
            if (fs.Returns?.ThreeYearPercentPa is decimal r3) ws.Cell(row, 11).Value = r3;
            if (fs.Returns?.FiveYearPercentPa is decimal r5) ws.Cell(row, 12).Value = r5;
            ws.Cell(row, 13).Value = fs.Returns?.PeriodEnding ?? fs.AsAt ?? string.Empty;
            ws.Cell(row, 14).Value = fs.Objective ?? string.Empty;
            row++;
        }
        row++;
        ws.Cell(row, 1).Value = "Returns are illustrative, net of investment fees and costs, before admin fees and taxes. " +
                                "Past performance is not a reliable indicator of future performance.";
        ws.Range(row, 1, row, 14).Merge().Style.Font.SetItalic();
        ws.SheetView.FreezeRows(1);
        FitColumns(ws, 14, 50);

        // Asset allocation: one column per model, one row per asset class.
        // "Australian shares (ASX 300 index)" and "Australian shares" share a row.
        var withAllocation = factSheets.Where(f => f.AssetAllocation.Count > 0).ToList();
        if (withAllocation.Count == 0) return;

        static string BaseClass(string assetClass) => Regex.Replace(assetClass, @"\s*\(.*?\)\s*$", string.Empty).Trim();

        var alloc = wb.Worksheets.Add(UniqueSheetName(wb, "Asset Allocation"));
        sheets.Add(alloc.Name);
        var assetClasses = withAllocation
            .SelectMany(f => f.AssetAllocation)
            .Select(a => (AssetClass: BaseClass(a.AssetClass), a.Type))
            .DistinctBy(a => a.AssetClass, StringComparer.OrdinalIgnoreCase)
            .OrderBy(a => string.Equals(a.Type, "defensive", StringComparison.OrdinalIgnoreCase) ? 1 : 0)
            .ToList();

        var headers = new List<string> { "Asset class", "Growth / defensive" };
        headers.AddRange(withAllocation.Select(f => $"{f.ShortName} target %"));
        WriteHeader(alloc, 1, headers.ToArray());

        var ar = 2;
        foreach (var (assetClass, type) in assetClasses)
        {
            alloc.Cell(ar, 1).Value = assetClass;
            alloc.Cell(ar, 2).Value = string.IsNullOrEmpty(type) ? string.Empty : char.ToUpperInvariant(type[0]) + type[1..];
            for (var i = 0; i < withAllocation.Count; i++)
            {
                var matches = withAllocation[i].AssetAllocation
                    .Where(a => string.Equals(BaseClass(a.AssetClass), assetClass, StringComparison.OrdinalIgnoreCase))
                    .ToList();
                if (matches.Count > 0) alloc.Cell(ar, 3 + i).Value = matches.Sum(a => a.TargetPercent);
            }
            ar++;
        }
        alloc.Cell(ar, 1).Value = "Total";
        for (var i = 0; i < withAllocation.Count; i++)
            alloc.Cell(ar, 3 + i).Value = withAllocation[i].AssetAllocation.Sum(a => a.TargetPercent);
        alloc.Range(ar, 1, ar, 2 + withAllocation.Count).Style.Font.SetBold();
        alloc.SheetView.FreezeRows(1);
        FitColumns(alloc, 2 + withAllocation.Count, 50);
    }

    private static void WriteTableSheet(XLWorkbook wb, string name, IReadOnlyList<List<(string Column, object? Value)>> rows, List<string> sheets)
    {
        if (rows.Count == 0) return;
        var ws = wb.Worksheets.Add(UniqueSheetName(wb, name));
        sheets.Add(ws.Name);

        var columns = rows.SelectMany(r => r.Select(c => c.Column)).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        WriteHeader(ws, 1, columns.ToArray());
        var rowIndex = 2;
        foreach (var r in rows)
        {
            foreach (var (column, value) in r)
            {
                var col = columns.FindIndex(c => string.Equals(c, column, StringComparison.OrdinalIgnoreCase)) + 1;
                SetCell(ws.Cell(rowIndex, col), value, column);
            }
            rowIndex++;
        }
        ws.SheetView.FreezeRows(1);
        FitColumns(ws, columns.Count, 60);
    }

    private static void WriteRecommendationsSheet(XLWorkbook wb, WorkbookJsonSection recs, List<string> sheets)
    {
        var ws = wb.Worksheets.Add(UniqueSheetName(wb, "Recommendations"));
        sheets.Add(ws.Name);
        WriteHeader(ws, 1, "Field", "Value");
        var row = 2;
        foreach (var (label, value) in recs.Fields)
        {
            ws.Cell(row, 1).Value = label;
            SetCell(ws.Cell(row, 2), value, label);
            row++;
        }
        if (recs.Fields.Count == 0)
        {
            ws.Cell(row, 1).Value = "Recommendations";
            ws.Cell(row, 2).Value = "(none provided)";
            row++;
        }

        row++;
        var standard = new (string Label, string Value)[]
        {
            ("Prepared by", "Investment Analyst Agent (Ivy) — Investment Solutions, Caldova Wealth"),
            ("Status", "Draft for adviser review. The adviser recommends and the client instructs — this workbook is not personal financial advice."),
            ("Past performance", "Past performance is not a reliable indicator of future performance."),
            ("Generated (UTC)", DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture))
        };
        foreach (var (label, value) in standard)
        {
            ws.Cell(row, 1).Value = label;
            ws.Cell(row, 2).Value = value;
            ws.Cell(row, 2).Style.Font.SetItalic();
            row++;
        }
        ws.Range(2, 1, row - 1, 1).Style.Font.SetBold();
        ws.Column(2).Style.Alignment.SetWrapText(true);
        FitColumns(ws, 2, 90);
    }

    private static void WriteHeader(IXLWorksheet ws, int row, params string[] headers)
    {
        for (var i = 0; i < headers.Length; i++)
            ws.Cell(row, i + 1).Value = headers[i];
        ws.Range(row, 1, row, headers.Length).Style
            .Font.SetBold()
            .Fill.SetBackgroundColor(HeaderFill)
            .Alignment.SetWrapText(true);
    }

    private static void SetCell(IXLCell cell, object? value, string label)
    {
        switch (value)
        {
            case null:
                break;
            case decimal d:
                cell.Value = d;
                if (LooksLikeMoney(label)) cell.Style.NumberFormat.Format = MoneyFormat;
                else if (LooksLikePercent(label)) cell.Style.NumberFormat.Format = "0.00";
                break;
            case bool b:
                cell.Value = b ? "Yes" : "No";
                break;
            default:
                cell.Value = value.ToString() ?? string.Empty;
                break;
        }
    }

    private static bool LooksLikeMoney(string label) =>
        Regex.IsMatch(label, @"\b(amount|balance|value|fee|fees|cost|gross|net|proceeds|payment|income|invested|cash|total)\b|\$", RegexOptions.IgnoreCase)
        && !LooksLikePercent(label);

    private static bool LooksLikePercent(string label) =>
        Regex.IsMatch(label, @"percent|%|\bicr\b|rate", RegexOptions.IgnoreCase);

    private static void FitColumns(IXLWorksheet ws, int columnCount, double maxWidth)
    {
        for (var c = 1; c <= columnCount; c++)
        {
            var column = ws.Column(c);
            column.AdjustToContents();
            if (column.Width > maxWidth)
            {
                column.Width = maxWidth;
                column.Style.Alignment.SetWrapText(true);
            }
            else if (column.Width < 10)
            {
                column.Width = 10;
            }
        }
    }

    private static string UniqueSheetName(XLWorkbook wb, string desired)
    {
        var cleaned = Regex.Replace(desired ?? "Sheet", @"[\[\]\:\*\?\/\\]", " ").Trim();
        if (cleaned.Length == 0) cleaned = "Sheet";
        if (cleaned.Length > 31) cleaned = cleaned[..31].Trim();
        var name = cleaned;
        var n = 2;
        while (wb.Worksheets.Any(w => string.Equals(w.Name, name, StringComparison.OrdinalIgnoreCase)))
        {
            var suffix = $" ({n++})";
            name = (cleaned.Length + suffix.Length > 31 ? cleaned[..(31 - suffix.Length)] : cleaned) + suffix;
        }
        return name;
    }

    private void PruneOldWorkbooks(string outputDir)
    {
        try
        {
            var stale = new DirectoryInfo(outputDir)
                .EnumerateFiles("*.xlsx")
                .OrderByDescending(f => f.CreationTimeUtc)
                .Skip(MaxWorkbooksKept)
                .ToList();
            foreach (var file in stale)
                file.Delete();
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Could not prune old investment workbooks");
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Parsing
    // ─────────────────────────────────────────────────────────────────────

    private async Task<string?> ReadDocumentAsync(string documentUrl)
    {
        var trimmed = documentUrl.Trim();
        if (trimmed.StartsWith('/'))
            return await ReadLocalAsync(trimmed);

        if (!Uri.TryCreate(trimmed, UriKind.Absolute, out var uri))
        {
            // A bare file name such as "model-growth.json" refers to a sample.
            return Regex.IsMatch(trimmed, @"^[A-Za-z0-9._-]+$") && !trimmed.Contains("..")
                ? await ReadLocalAsync(SamplesUrlPrefix + trimmed)
                : null;
        }
        if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
            return null;

        try
        {
            using var http = _httpClientFactory.CreateClient();
            http.Timeout = TimeSpan.FromSeconds(15);
            using var resp = await http.GetAsync(uri);
            if (resp.IsSuccessStatusCode)
                return await resp.Content.ReadAsStringAsync();
            _logger.LogInformation("Fact sheet fetch returned {Status} for {Url}", (int)resp.StatusCode, Sanitize(documentUrl));
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            _logger.LogInformation(ex, "Fact sheet fetch failed for {Url}", Sanitize(documentUrl));
        }

        // Same-app fallback: an absolute URL that points at this app's sample
        // folder (e.g. through a dev tunnel this host can't reach) is read from disk.
        return uri.AbsolutePath.StartsWith(SamplesUrlPrefix, StringComparison.OrdinalIgnoreCase)
            ? await ReadLocalAsync(Uri.UnescapeDataString(uri.AbsolutePath))
            : null;
    }

    private async Task<string?> ReadLocalAsync(string appPath)
    {
        var pathOnly = appPath.Split('?', '#')[0];
        var rel = pathOnly.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
        var fullRoot = Path.GetFullPath(WebRoot).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)
            + Path.DirectorySeparatorChar;
        var fullLocal = Path.GetFullPath(Path.Combine(WebRoot, rel));
        if (!fullLocal.StartsWith(fullRoot, StringComparison.OrdinalIgnoreCase))
            return null; // path traversal guard
        return File.Exists(fullLocal) ? await File.ReadAllTextAsync(fullLocal) : null;
    }

    internal static FactSheet ParseFactSheet(string source, string content)
    {
        var trimmed = content.TrimStart('\uFEFF', ' ', '\t', '\r', '\n');
        if (trimmed.StartsWith('{'))
        {
            try
            {
                using var doc = JsonDocument.Parse(trimmed);
                var el = doc.RootElement;
                if (el.TryGetProperty("factSheet", out var inner) && inner.ValueKind == JsonValueKind.Object)
                    el = inner;
                return FactSheetFromJson(el, source);
            }
            catch (JsonException)
            {
                // fall through to the text parser
            }
        }
        return ParseTextFactSheet(source, content);
    }

    private static FactSheet FactSheetFromJson(JsonElement el, string source)
    {
        var name = Str(el, "name") ?? Str(el, "model") ?? Str(el, "shortName")
            ?? Path.GetFileNameWithoutExtension(source.Split('?')[0]);
        var growth = Growth(el);
        var defensive = Defensive(el) ?? (growth.HasValue ? 100m - growth.Value : null);
        growth ??= defensive.HasValue ? 100m - defensive.Value : null;

        int? band = null;
        string? riskLabel = null, negativeYears = null;
        if (el.TryGetProperty("standardRiskMeasure", out var srm))
        {
            if (srm.ValueKind == JsonValueKind.Object)
            {
                band = (int?)Dec(srm, "band");
                riskLabel = Str(srm, "label");
                negativeYears = Str(srm, "negativeYearsIn20");
            }
            else if (srm.ValueKind == JsonValueKind.Number && srm.TryGetInt32(out var b))
            {
                band = b;
            }
        }
        // Re-parsing our own serialised FactSheet (analyzeFactSheet output).
        band ??= (int?)Dec(el, "riskBand");
        riskLabel ??= Str(el, "riskLabel");
        negativeYears ??= Str(el, "negativeYearsIn20");

        FactSheetReturns? returns = null;
        if (el.TryGetProperty("returns", out var ret) && ret.ValueKind == JsonValueKind.Object)
        {
            returns = new FactSheetReturns(
                PeriodEnding: Str(ret, "periodEnding") ?? Str(ret, "asAt"),
                OneYearPercent: Dec(ret, "oneYearPercent") ?? Dec(ret, "oneYear"),
                ThreeYearPercentPa: Dec(ret, "threeYearPercentPa") ?? Dec(ret, "threeYear"),
                FiveYearPercentPa: Dec(ret, "fiveYearPercentPa") ?? Dec(ret, "fiveYear"),
                Basis: Str(ret, "basis"),
                Warning: Str(ret, "warning") ?? PastPerformanceWarning);
        }

        var allocation = new List<FactSheetAllocation>();
        if (el.TryGetProperty("assetAllocation", out var aa) && aa.ValueKind == JsonValueKind.Array)
        {
            foreach (var a in aa.EnumerateArray())
            {
                var assetClass = Str(a, "assetClass") ?? Str(a, "name");
                var target = Dec(a, "targetPercent") ?? Dec(a, "percent") ?? Dec(a, "weightPercent");
                if (assetClass is not null && target is not null)
                    allocation.Add(new FactSheetAllocation(assetClass, Str(a, "type") ?? string.Empty, target.Value, Str(a, "rangePercent")));
            }
        }

        var holdings = new List<FactSheetHolding>();
        if (el.TryGetProperty("topHoldings", out var th) && th.ValueKind == JsonValueKind.Array)
        {
            foreach (var h in th.EnumerateArray())
            {
                var holding = h.ValueKind == JsonValueKind.String ? h.GetString() : Str(h, "holding") ?? Str(h, "name");
                if (!string.IsNullOrWhiteSpace(holding))
                    holdings.Add(new FactSheetHolding(holding!, Dec(h, "weightPercent") ?? Dec(h, "weight")));
            }
        }

        return new FactSheet(
            Name: name,
            ShortName: Str(el, "shortName") ?? ShortNameFrom(name),
            Code: Str(el, "code"),
            AsAt: Str(el, "asAt"),
            Style: Str(el, "style") ?? Str(el, "management"),
            Objective: Str(el, "objective"),
            GrowthPercent: growth,
            DefensivePercent: defensive,
            InvestmentFeePercent: Icr(el),
            BuySellSpreadPercent: Dec(el, "buySellSpreadPercent") ?? Dec(el, "buySellSpread"),
            RiskBand: band,
            RiskLabel: riskLabel,
            NegativeYearsIn20: negativeYears,
            MinimumTimeframeYears: (int?)(Dec(el, "minimumSuggestedTimeframeYears") ?? Dec(el, "minimumTimeframeYears")),
            Returns: returns,
            AssetAllocation: allocation,
            TopHoldings: holdings,
            SectorNotes: StrArray(el, "sectorNotes"),
            AvailableOn: StrArray(el, "availableOn"),
            SuitableFor: Str(el, "suitableFor"),
            Source: source);
    }

    private static FactSheet ParseTextFactSheet(string source, string content)
    {
        string? name = null, code = null, riskLabel = null;
        decimal? growth = null, defensive = null, icr = null, spread = null, r1 = null, r3 = null, r5 = null;
        int? band = null, timeframe = null;

        foreach (var raw in content.Split('\n'))
        {
            var line = raw.Trim().TrimStart('-', '*', '•').Trim();
            if (line.Length == 0) continue;

            var heading = Regex.Match(line, @"^#+\s*(.+)$");
            if (heading.Success) { name ??= heading.Groups[1].Value.Trim(); continue; }

            var kv = Regex.Match(line, @"^(?:name|model|portfolio)\s*[:\-]\s*(.+)$", RegexOptions.IgnoreCase);
            if (kv.Success) { name = kv.Groups[1].Value.Trim(); continue; }

            var codeMatch = Regex.Match(line, @"^code\s*[:\-]\s*(\S+)", RegexOptions.IgnoreCase);
            if (codeMatch.Success) { code = codeMatch.Groups[1].Value.Trim(); continue; }

            if (Regex.IsMatch(line, @"growth", RegexOptions.IgnoreCase))
            {
                var split = Regex.Match(line, @"(\d{1,3}(?:\.\d+)?)\s*/\s*(\d{1,3}(?:\.\d+)?)");
                if (split.Success && growth is null)
                {
                    growth = ParseDecimal(split.Groups[1].Value);
                    defensive = ParseDecimal(split.Groups[2].Value);
                }
            }

            if (Regex.IsMatch(line, @"\bicr\b|investment fee", RegexOptions.IgnoreCase))
                icr ??= FirstPercent(line);
            if (Regex.IsMatch(line, @"spread", RegexOptions.IgnoreCase))
                spread ??= FirstPercent(line);

            var risk = Regex.Match(line, @"risk[^:]*[:\-]\s*([1-7])\b\s*[—\-–(]*\s*([A-Za-z][A-Za-z\s]+)?", RegexOptions.IgnoreCase);
            if (risk.Success && band is null)
            {
                band = int.Parse(risk.Groups[1].Value, CultureInfo.InvariantCulture);
                riskLabel = risk.Groups[2].Success ? risk.Groups[2].Value.Trim().TrimEnd(')') : null;
            }

            var tf = Regex.Match(line, @"timeframe[^0-9]*(\d{1,2})\s*year", RegexOptions.IgnoreCase);
            if (tf.Success) timeframe ??= int.Parse(tf.Groups[1].Value, CultureInfo.InvariantCulture);

            r1 ??= ReturnFor(line, "1");
            r3 ??= ReturnFor(line, "3");
            r5 ??= ReturnFor(line, "5");
        }

        name ??= Path.GetFileNameWithoutExtension(source.Split('?')[0]);
        if (growth.HasValue && !defensive.HasValue) defensive = 100m - growth.Value;

        return new FactSheet(
            Name: name,
            ShortName: ShortNameFrom(name),
            Code: code,
            AsAt: null,
            Style: Regex.IsMatch(content, @"passive|index", RegexOptions.IgnoreCase) ? "Passive (index)" : null,
            Objective: null,
            GrowthPercent: growth,
            DefensivePercent: defensive,
            InvestmentFeePercent: icr.HasValue ? NormaliseIcr(icr.Value) : null,
            BuySellSpreadPercent: spread,
            RiskBand: band,
            RiskLabel: riskLabel,
            NegativeYearsIn20: null,
            MinimumTimeframeYears: timeframe,
            Returns: r1 is null && r3 is null && r5 is null
                ? null
                : new FactSheetReturns(null, r1, r3, r5, null, PastPerformanceWarning),
            AssetAllocation: Array.Empty<FactSheetAllocation>(),
            TopHoldings: Array.Empty<FactSheetHolding>(),
            SectorNotes: Array.Empty<string>(),
            AvailableOn: Array.Empty<string>(),
            SuitableFor: null,
            Source: source);
    }

    private static decimal? FirstPercent(string line)
    {
        var m = Regex.Match(line, @"(-?\d+(?:\.\d+)?)\s*%");
        return m.Success ? ParseDecimal(m.Groups[1].Value) : null;
    }

    private static decimal? ReturnFor(string line, string years)
    {
        var m = Regex.Match(line, $@"\b{years}[\s-]*(?:yr|yrs|year|years)\b[^0-9\-]*(-?\d+(?:\.\d+)?)\s*%", RegexOptions.IgnoreCase);
        return m.Success ? ParseDecimal(m.Groups[1].Value) : null;
    }

    internal static ModelsPayload ParseModelsPayload(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        var options = new List<ModelOption>();
        var sheets = new List<FactSheet>();
        decimal? balance = null;

        void AddSheet(FactSheet fs)
        {
            if (!sheets.Any(s => string.Equals(s.Name, fs.Name, StringComparison.OrdinalIgnoreCase)))
                sheets.Add(fs);
        }

        void AddElement(JsonElement el)
        {
            if (el.ValueKind != JsonValueKind.Object) return;

            if (el.TryGetProperty("factSheet", out var inner) && inner.ValueKind == JsonValueKind.Object)
            {
                var fs = FactSheetFromJson(inner, Str(el, "source") ?? string.Empty);
                AddSheet(fs);
                options.Add(OptionFromFactSheet(fs, IsSelected(el) || IsSelected(inner), Str(el, "note")));
                return;
            }
            if (LooksLikeFactSheet(el))
            {
                var fs = FactSheetFromJson(el, Str(el, "source") ?? string.Empty);
                AddSheet(fs);
                options.Add(OptionFromFactSheet(fs, IsSelected(el), Str(el, "note")));
                return;
            }
            options.Add(OptionFromJson(el));
        }

        if (root.ValueKind == JsonValueKind.Array)
        {
            foreach (var el in root.EnumerateArray()) AddElement(el);
        }
        else if (root.ValueKind == JsonValueKind.Object)
        {
            balance = Dec(root, "balance");
            var found = false;
            foreach (var key in new[] { "options", "models", "structures", "rows" })
            {
                if (root.TryGetProperty(key, out var arr) && arr.ValueKind == JsonValueKind.Array)
                {
                    foreach (var el in arr.EnumerateArray()) AddElement(el);
                    found = true;
                    break;
                }
            }
            if (root.TryGetProperty("factSheets", out var fsArr) && fsArr.ValueKind == JsonValueKind.Array)
            {
                foreach (var el in fsArr.EnumerateArray())
                {
                    var inner = el.ValueKind == JsonValueKind.Object && el.TryGetProperty("factSheet", out var f) ? f : el;
                    if (inner.ValueKind == JsonValueKind.Object)
                        AddSheet(FactSheetFromJson(inner, Str(el, "source") ?? string.Empty));
                }
                found = true;
            }
            if (!found) AddElement(root);
        }

        return new ModelsPayload(options, sheets, balance);
    }

    internal static ModelOption OptionFromFactSheet(FactSheet fs, bool selected = false, string? note = null) =>
        new(Name: fs.ShortName,
            Code: fs.Code,
            Selected: selected,
            GrowthPercent: fs.GrowthPercent,
            DefensivePercent: fs.DefensivePercent,
            IcrPercent: fs.InvestmentFeePercent,
            Style: fs.Style,
            Note: note,
            Amount: null,
            Components: Array.Empty<ModelComponent>(),
            FactSheet: fs);

    private static ModelOption OptionFromJson(JsonElement el)
    {
        var name = Str(el, "shortName") ?? Str(el, "name") ?? Str(el, "option") ?? Str(el, "model") ?? Str(el, "label") ?? "Option";
        var components = new List<ModelComponent>();
        if (el.TryGetProperty("components", out var arr) && arr.ValueKind == JsonValueKind.Array)
        {
            foreach (var c in arr.EnumerateArray())
            {
                if (c.ValueKind != JsonValueKind.Object) continue;
                components.Add(new ModelComponent(
                    Label: Str(c, "label") ?? Str(c, "name") ?? Str(c, "model") ?? "Component",
                    Amount: Dec(c, "amount") ?? Dec(c, "value") ?? Dec(c, "investedAmount") ?? 0m,
                    IcrPercent: Icr(c) ?? 0m,
                    GrowthPercent: Growth(c)));
            }
        }

        var growth = Growth(el) ?? WeightedGrowth(components);
        var defensive = Defensive(el) ?? (growth.HasValue ? 100m - growth.Value : null);
        var selected = IsSelected(el) || name.Contains("(selected)", StringComparison.OrdinalIgnoreCase);
        if (name.Contains("(selected)", StringComparison.OrdinalIgnoreCase))
            name = Regex.Replace(name, @"\s*\(selected\)", string.Empty, RegexOptions.IgnoreCase).Trim();

        return new ModelOption(
            Name: name,
            Code: Str(el, "code"),
            Selected: selected,
            GrowthPercent: growth,
            DefensivePercent: defensive,
            IcrPercent: Icr(el),
            Style: Str(el, "style") ?? Str(el, "management"),
            Note: Str(el, "note") ?? Str(el, "notes") ?? Str(el, "description"),
            Amount: Dec(el, "investedAmount") ?? Dec(el, "amount"),
            Components: components,
            FactSheet: null);
    }

    private static bool LooksLikeFactSheet(JsonElement el) =>
        el.TryGetProperty("documentType", out _)
        || el.TryGetProperty("assetAllocation", out _)
        || (el.TryGetProperty("investmentFeePercent", out _) && el.TryGetProperty("growthAllocation", out _));

    private static bool IsSelected(JsonElement el)
    {
        foreach (var key in new[] { "selected", "isSelected", "current" })
        {
            if (el.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.True)
                return true;
        }
        return false;
    }

    private static WorkbookJsonSection ReadSection(string? json)
    {
        var section = new WorkbookJsonSection();
        if (string.IsNullOrWhiteSpace(json)) return section;

        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        if (root.ValueKind == JsonValueKind.Array)
        {
            var rows = TableRows(root);
            if (rows.Count > 0) section.Tables.Add(("Items", rows));
            return section;
        }
        if (root.ValueKind != JsonValueKind.Object) return section;

        foreach (var prop in root.EnumerateObject())
        {
            var label = Humanize(prop.Name);
            var value = prop.Value;
            switch (value.ValueKind)
            {
                case JsonValueKind.Array when value.EnumerateArray().Any() && value.EnumerateArray().All(e => e.ValueKind == JsonValueKind.Object):
                    section.Tables.Add((label, TableRows(value)));
                    break;
                case JsonValueKind.Array:
                    // One row per item so long lists stay readable in Excel.
                    var items = value.EnumerateArray().Select(ScalarText).Where(t => t.Length > 0).ToList();
                    if (items.Count <= 1)
                    {
                        section.Fields.Add((label, items.FirstOrDefault() ?? string.Empty));
                    }
                    else
                    {
                        for (var i = 0; i < items.Count; i++)
                            section.Fields.Add((i == 0 ? label : string.Empty, "• " + items[i]));
                    }
                    break;
                case JsonValueKind.Object:
                    foreach (var sub in value.EnumerateObject())
                        section.Fields.Add(($"{label} — {Humanize(sub.Name)}", ScalarValue(sub.Value)));
                    break;
                default:
                    section.Fields.Add((label, ScalarValue(value)));
                    break;
            }

            if (section.Balance is null &&
                prop.Name is "balance" or "comparisonBalance" or "balanceForAnalysis" or "accountBalance")
            {
                section.Balance = value.ValueKind == JsonValueKind.Number && value.TryGetDecimal(out var d)
                    ? d
                    : value.ValueKind == JsonValueKind.String ? ParseMoney(value.GetString()) : null;
            }
        }
        return section;
    }

    private static List<List<(string Column, object? Value)>> TableRows(JsonElement array)
    {
        var rows = new List<List<(string, object?)>>();
        foreach (var item in array.EnumerateArray())
        {
            if (item.ValueKind != JsonValueKind.Object) continue;
            rows.Add(item.EnumerateObject().Select(p => (Humanize(p.Name), ScalarValue(p.Value))).ToList());
        }
        return rows;
    }

    private static object? ScalarValue(JsonElement v) => v.ValueKind switch
    {
        JsonValueKind.Number when v.TryGetDecimal(out var d) => d,
        JsonValueKind.String => v.GetString(),
        JsonValueKind.True => true,
        JsonValueKind.False => false,
        JsonValueKind.Null or JsonValueKind.Undefined => null,
        _ => v.GetRawText()
    };

    private static string ScalarText(JsonElement v) => ScalarValue(v) switch
    {
        null => string.Empty,
        bool b => b ? "Yes" : "No",
        decimal d => d.ToString(CultureInfo.InvariantCulture),
        var o => o.ToString() ?? string.Empty
    };

    // ─────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────

    internal const string PastPerformanceWarning = "Past performance is not a reliable indicator of future performance.";

    /// <summary>Caldova Super &amp; Pension tiered admin fee on the whole balance, $ p.a.</summary>
    internal static decimal AdminFee(decimal balance)
    {
        if (balance <= 0) return 0m;
        var tier1 = Math.Min(balance, 250_000m) * 0.0030m;
        var tier2 = Math.Clamp(balance - 250_000m, 0m, 750_000m) * 0.0015m;
        var tier3 = Math.Clamp(balance - 1_000_000m, 0m, 1_000_000m) * 0.0005m;
        return Round2(tier1 + tier2 + tier3);
    }

    internal static string AdminFeeWorking(decimal balance)
    {
        var parts = new List<string> { $"0.30% × {MoneySmart(Math.Min(balance, 250_000m))}" };
        if (balance > 250_000m) parts.Add($"0.15% × {MoneySmart(Math.Min(balance - 250_000m, 750_000m))}");
        if (balance > 1_000_000m) parts.Add($"0.05% × {MoneySmart(Math.Min(balance - 1_000_000m, 1_000_000m))}");
        if (balance > 2_000_000m) parts.Add($"nil on {MoneySmart(balance - 2_000_000m)}");
        return string.Join(" + ", parts) + $" = {Money(AdminFee(balance))}";
    }

    private static decimal? WeightedGrowth(IReadOnlyList<ModelComponent> components)
    {
        var total = components.Sum(c => c.Amount);
        if (components.Count == 0 || total <= 0 || components.Any(c => !c.GrowthPercent.HasValue))
            return null;
        return Math.Round(components.Sum(c => c.Amount * c.GrowthPercent!.Value) / total, 1);
    }

    private static decimal? Growth(JsonElement el) =>
        NormaliseShare(Dec(el, "growthAllocation") ?? Dec(el, "growthPercent") ?? Dec(el, "growth"))
        ?? SplitPart(el, 0);

    private static decimal? Defensive(JsonElement el) =>
        NormaliseShare(Dec(el, "defensiveAllocation") ?? Dec(el, "defensivePercent") ?? Dec(el, "defensive"))
        ?? SplitPart(el, 1);

    private static decimal? SplitPart(JsonElement el, int index)
    {
        var split = Str(el, "growthDefensive") ?? Str(el, "split");
        if (split is null) return null;
        var m = Regex.Match(split, @"(\d{1,3}(?:\.\d+)?)\s*/\s*(\d{1,3}(?:\.\d+)?)");
        return m.Success ? ParseDecimal(m.Groups[index + 1].Value) : null;
    }

    private static decimal? NormaliseShare(decimal? v) => v is > 0m and <= 1m ? v * 100m : v;

    private static decimal? Icr(JsonElement el)
    {
        var v = Dec(el, "investmentFeePercent") ?? Dec(el, "icrPercent") ?? Dec(el, "icr") ?? Dec(el, "investmentFee");
        return v.HasValue ? NormaliseIcr(v.Value) : null;
    }

    // An ICR of 0.42% may arrive as 0.42 (percent) or 0.0042 (fraction).
    private static decimal NormaliseIcr(decimal v) => v is > 0m and <= 0.02m ? v * 100m : v;

    private static string? Str(JsonElement el, string name)
        => el.ValueKind == JsonValueKind.Object
           && el.TryGetProperty(name, out var v)
           && v.ValueKind == JsonValueKind.String
            ? v.GetString()
            : null;

    private static IReadOnlyList<string> StrArray(JsonElement el, string name)
    {
        if (el.ValueKind != JsonValueKind.Object || !el.TryGetProperty(name, out var arr) || arr.ValueKind != JsonValueKind.Array)
            return Array.Empty<string>();
        return arr.EnumerateArray()
            .Where(v => v.ValueKind == JsonValueKind.String)
            .Select(v => v.GetString()!)
            .ToList();
    }

    private static decimal? Dec(JsonElement el, string name)
    {
        if (el.ValueKind != JsonValueKind.Object || !el.TryGetProperty(name, out var v)) return null;
        if (v.ValueKind == JsonValueKind.Number && v.TryGetDecimal(out var d)) return d;
        if (v.ValueKind == JsonValueKind.String) return ParseMoney(v.GetString());
        return null;
    }

    private static decimal? ParseMoney(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        var cleaned = Regex.Replace(s, @"[^\d.\-]", string.Empty);
        return decimal.TryParse(cleaned, NumberStyles.Number, CultureInfo.InvariantCulture, out var d) ? d : null;
    }

    private static decimal? ParseDecimal(string s) =>
        decimal.TryParse(s, NumberStyles.Number, CultureInfo.InvariantCulture, out var d) ? d : null;

    internal static decimal Round2(decimal v) => Math.Round(v, 2, MidpointRounding.AwayFromZero);

    /// <summary>"$1,175.04" (always two decimals) — used for fees.</summary>
    internal static string Money(decimal v) => Round2(v).ToString("C2", AuCulture);

    /// <summary>"$138,200" for whole dollars, "$414.60" otherwise — used for balances and amounts.</summary>
    internal static string MoneySmart(decimal v)
    {
        var r = Round2(v);
        return r == decimal.Truncate(r) ? r.ToString("C0", AuCulture) : r.ToString("C2", AuCulture);
    }

    internal static string FormatPercent(decimal v) =>
        v == 0m ? "nil" : v.ToString("0.00", CultureInfo.InvariantCulture) + "%";

    internal static string FormatSplit(decimal? growth, decimal? defensive)
    {
        if (growth is null) return "—";
        var d = defensive ?? 100m - growth.Value;
        return $"{growth.Value.ToString("0.#", CultureInfo.InvariantCulture)}/{d.ToString("0.#", CultureInfo.InvariantCulture)}";
    }

    private static decimal NiceCeiling(decimal value)
    {
        var step = value switch
        {
            <= 2_000m => 100m,
            <= 20_000m => 500m,
            <= 200_000m => 5_000m,
            _ => 50_000m
        };
        return Math.Ceiling(value / step) * step;
    }

    private static string ShortNameFrom(string name)
    {
        var idx = name.LastIndexOfAny(new[] { '—', '–' });
        var shortName = idx >= 0 ? name[(idx + 1)..] : name;
        shortName = shortName.Trim();
        return shortName.Length == 0 ? name : shortName;
    }

    // "humanApprovalRequired" → "Human approval required" (sentence case labels).
    private static string Humanize(string name)
    {
        if (string.IsNullOrEmpty(name)) return name;
        var sb = new StringBuilder();
        sb.Append(char.ToUpperInvariant(name[0]));
        for (var i = 1; i < name.Length; i++)
        {
            var c = name[i];
            if (c == '_')
            {
                sb.Append(' ');
                continue;
            }
            if (char.IsUpper(c) && !char.IsUpper(name[i - 1]))
            {
                sb.Append(' ');
                sb.Append(char.ToLowerInvariant(c));
                continue;
            }
            sb.Append(c);
        }
        return sb.ToString();
    }

    internal static string EscapeMd(string s) => s.Replace("|", "\\|");

    private static string EscapeMermaid(string s) => s.Replace("\"", "'");

    private static string SafeFileToken(string s)
    {
        var sb = new StringBuilder(s.Length);
        foreach (var c in s)
            sb.Append(char.IsAsciiLetterOrDigit(c) || c == '-' || c == '_' ? c : '-');
        var token = sb.ToString().Trim('-');
        return token.Length == 0 ? "case" : token.Length > 60 ? token[..60] : token;
    }

    private static string Sanitize(string value) => value.Replace('\r', ' ').Replace('\n', ' ');

    internal static string Serialize(object value) => JsonSerializer.Serialize(value, JsonOpts);

    private static string JsonError(string message) => Serialize(new { error = message });
}

// ─────────────────────────────────────────────────────────────────────────
// Investment data shapes (serialised camelCase in tool output)
// ─────────────────────────────────────────────────────────────────────────

internal sealed record FactSheetAllocation(string AssetClass, string Type, decimal TargetPercent, string? RangePercent);

internal sealed record FactSheetHolding(string Holding, decimal? WeightPercent);

internal sealed record FactSheetReturns(
    string? PeriodEnding,
    decimal? OneYearPercent,
    decimal? ThreeYearPercentPa,
    decimal? FiveYearPercentPa,
    string? Basis,
    string Warning);

/// <summary>A parsed Caldova Managed Portfolio fact sheet.</summary>
internal sealed record FactSheet(
    string Name,
    string ShortName,
    string? Code,
    string? AsAt,
    string? Style,
    string? Objective,
    decimal? GrowthPercent,
    decimal? DefensivePercent,
    decimal? InvestmentFeePercent,
    decimal? BuySellSpreadPercent,
    int? RiskBand,
    string? RiskLabel,
    string? NegativeYearsIn20,
    int? MinimumTimeframeYears,
    FactSheetReturns? Returns,
    IReadOnlyList<FactSheetAllocation> AssetAllocation,
    IReadOnlyList<FactSheetHolding> TopHoldings,
    IReadOnlyList<string> SectorNotes,
    IReadOnlyList<string> AvailableOn,
    string? SuitableFor,
    string Source)
{
    public string GrowthDefensive => InvestmentsMcpTools.FormatSplit(GrowthPercent, DefensivePercent);
}

/// <summary>One slice of an option — e.g. a cash bucket or the model it sits beside.</summary>
internal sealed record ModelComponent(string Label, decimal Amount, decimal IcrPercent, decimal? GrowthPercent);

/// <summary>
/// One option to compare: a single model applied to the whole balance, or a
/// structure made of components (e.g. two-year cash bucket + Balanced).
/// </summary>
internal sealed record ModelOption(
    string Name,
    string? Code,
    bool Selected,
    decimal? GrowthPercent,
    decimal? DefensivePercent,
    decimal? IcrPercent,
    string? Style,
    string? Note,
    decimal? Amount,
    IReadOnlyList<ModelComponent> Components,
    FactSheet? FactSheet);

internal sealed record ModelsPayload(List<ModelOption> Options, List<FactSheet> FactSheets, decimal? Balance)
{
    public static ModelsPayload Empty => new(new List<ModelOption>(), new List<FactSheet>(), null);
}

internal sealed record ModelFeeBasis(
    decimal Balance,
    decimal AdminFee,
    string AdminFeeWorking,
    decimal AccountKeepingFee,
    decimal AdminAndAccountKeepingFee,
    decimal BuySellSpreadPercent,
    decimal BuySellSpreadOnBalance);

internal sealed record ModelCostRow(
    string Name,
    string? Code,
    bool Selected,
    string GrowthDefensive,
    decimal IcrPercent,
    string IcrLabel,
    decimal InvestedAmount,
    decimal InvestmentFee,
    decimal AdminFee,
    decimal AccountKeepingFee,
    decimal AdminAndAccountKeepingFee,
    decimal TotalFee,
    decimal TotalFeePercent,
    decimal DifferenceVsLowest,
    string? Components,
    string? Style,
    string? Note);

internal sealed record ModelComparisonSummary(
    string LowestCostOption,
    decimal LowestTotal,
    string HighestCostOption,
    decimal HighestTotal,
    decimal Spread,
    string? SelectedOption,
    decimal? SelectedTotal);

internal sealed record ModelComparison(
    decimal Balance,
    ModelFeeBasis FeeBasis,
    IReadOnlyList<ModelCostRow> Rows,
    string ComparisonMarkdown,
    string ChartMermaid,
    IReadOnlyList<string> Observations,
    ModelComparisonSummary Summary);

/// <summary>Flattened view of a free-form JSON object passed to the workbook tool.</summary>
internal sealed class WorkbookJsonSection
{
    public List<(string Label, object? Value)> Fields { get; } = new();
    public List<(string Name, List<List<(string Column, object? Value)>> Rows)> Tables { get; } = new();
    public decimal? Balance { get; set; }
}
