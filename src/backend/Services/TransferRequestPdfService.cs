using System.Collections.Concurrent;
using MigraDoc.DocumentObjectModel;
using MigraDoc.DocumentObjectModel.Tables;
using MigraDoc.Rendering;
using PdfSharp.Fonts;
namespace CaldovaSuper.App.Services;

/// <summary>
/// One generated transfer / rollover request PDF, kept in memory so the
/// <c>/transfers/request/{id}.pdf</c> endpoint can stream it back.
/// </summary>
public record TransferRequestPdfRecord(
    string Id,
    string FileName,
    byte[] Content,
    DateTimeOffset CreatedAt);

/// <summary>One transfer line printed on the request.</summary>
public record TransferRequestPdfLeg(
    string Counterparty,
    string CounterpartyId,
    string Direction,
    string TransferType,
    string Amount,
    string Status,
    string Detail);

/// <summary>One SMSF verification line printed on the request.</summary>
public record TransferRequestPdfCheck(string Check, bool Passed, string Detail);

/// <summary>Input model for <see cref="TransferRequestPdfService.Generate"/>.</summary>
public record TransferRequestPdfInput(
    string CaseNumber,
    string MemberName,
    string MemberNumber,
    string Product,
    string RequestType,
    string Adviser,
    string AsAt,
    string RequestStatus,
    IReadOnlyList<TransferRequestPdfLeg> Legs,
    IReadOnlyList<string> InsuranceWarnings,
    string? SvsSummary,
    IReadOnlyList<TransferRequestPdfCheck> SvsChecks,
    IReadOnlyList<string> SlaLines,
    IReadOnlyList<string> Notes);

/// <summary>
/// Generates the branded "Caldova Wealth — Rollover / Transfer Request" PDF
/// for a Member Case using PDFsharp + MigraDoc (pure managed, cross-platform
/// — works on win-x64, win-arm64, linux-*, osx-*), and caches it in memory
/// so the Transfers &amp; Rollovers page and MCP tool can hand out a
/// download link.
/// </summary>
public class TransferRequestPdfService
{
    // Brand colours (parsed once).
    private static readonly Color BrandNavy = Color.FromRgb(0x0f, 0x17, 0x2a);
    private static readonly Color BrandTeal = Color.FromRgb(0x0f, 0x76, 0x6e);
    private static readonly Color BrandGreen = Color.FromRgb(0x10, 0xb9, 0x81);
    private static readonly Color TextDark = Color.FromRgb(0x1f, 0x29, 0x37);
    private static readonly Color TextMuted = Color.FromRgb(0x47, 0x55, 0x69);
    private static readonly Color TextSubtle = Color.FromRgb(0x64, 0x74, 0x8b);
    private static readonly Color PanelBg = Color.FromRgb(0xf8, 0xfa, 0xfc);
    private static readonly Color PanelBorder = Color.FromRgb(0xcb, 0xd5, 0xe1);
    private static readonly Color WarnBg = Color.FromRgb(0xfe, 0xf3, 0xc7);
    private static readonly Color WarnText = Color.FromRgb(0x92, 0x40, 0x0e);
    private static readonly Color BlockedBg = Color.FromRgb(0xfe, 0xe2, 0xe2);
    private static readonly Color BlockedText = Color.FromRgb(0x99, 0x1b, 0x1b);
    private static readonly Color OkBg = Color.FromRgb(0xd1, 0xfa, 0xe5);
    private static readonly Color OkText = Color.FromRgb(0x06, 0x5f, 0x46);
    private static readonly Color InfoBg = Color.FromRgb(0xe0, 0xf2, 0xfe);
    private static readonly Color InfoText = Color.FromRgb(0x07, 0x59, 0x85);

    private readonly ConcurrentDictionary<string, TransferRequestPdfRecord> _store = new();

    // PDFsharp 6.x doesn't ship a default font resolver — without one, any
    // attempt to render a font (even just the predefined "error font") throws
    // "The font 'Courier New' cannot be resolved …". Enabling the built-in
    // Windows-fonts resolver lets MigraDoc load Arial/Courier/etc. from
    // C:\Windows\Fonts on Windows hosts. Done once per process.
    static TransferRequestPdfService()
    {
        if (OperatingSystem.IsWindows())
        {
            GlobalFontSettings.UseWindowsFontsUnderWindows = true;
        }
        else
        {
            // Native Linux / macOS hosts (App Service Linux, containers,
            // CI runners): UseWindowsFontsUnderWsl2 only works inside WSL2,
            // so we install a resolver that discovers system TTF/OTF files
            // and aliases Windows family names (Arial, Courier New, …) to
            // whatever is installed (DejaVu, Liberation, FreeFont).
            if (GlobalFontSettings.FontResolver is null)
            {
                GlobalFontSettings.FontResolver = new LinuxFontResolver();
            }
        }
    }

    /// <summary>
    /// Generate a transfer request PDF and store it in memory. Returns the
    /// record so the caller can surface its <c>Id</c> in a download URL
    /// (<c>/transfers/request/{id}.pdf</c>).
    /// </summary>
    public TransferRequestPdfRecord Generate(TransferRequestPdfInput input)
    {
        var id = Guid.NewGuid().ToString("N").Substring(0, 12);
        var safeCase = new string((input.CaseNumber ?? "case").Where(c => char.IsAsciiLetterOrDigit(c) || c == '-').ToArray());
        if (string.IsNullOrEmpty(safeCase)) safeCase = "case";
        var fileName = $"Caldova-TransferRequest-{safeCase}-{id}.pdf";

        var doc = BuildDocument(input, safeCase, id);

        var renderer = new PdfDocumentRenderer { Document = doc };
        renderer.RenderDocument();

        using var ms = new MemoryStream();
        renderer.PdfDocument.Save(ms, false);
        var bytes = ms.ToArray();

        var record = new TransferRequestPdfRecord(id, fileName, bytes, DateTimeOffset.UtcNow);
        _store[id] = record;

        // Bound the in-memory cache so a long-running demo can't grow unbounded.
        if (_store.Count > 200)
        {
            foreach (var stale in _store.Values
                         .OrderBy(r => r.CreatedAt)
                         .Take(_store.Count - 200))
            {
                _store.TryRemove(stale.Id, out _);
            }
        }

        return record;
    }

    public TransferRequestPdfRecord? Get(string id)
        => _store.TryGetValue(id ?? string.Empty, out var record) ? record : null;

    private static Document BuildDocument(TransferRequestPdfInput input, string safeCase, string id)
    {
        var doc = new Document();
        doc.Info.Title = $"Caldova Wealth — Rollover / Transfer Request {safeCase}";
        doc.Info.Author = "Caldova Wealth — Transfers & Rollovers";
        doc.Info.Subject = "Rollover / transfer request";

        var normal = doc.Styles["Normal"]!;
        normal.Font.Name = "Arial";
        normal.Font.Size = 9.5;
        normal.Font.Color = TextDark;

        var section = doc.AddSection();
        section.PageSetup.PageFormat = PageFormat.A4;
        section.PageSetup.LeftMargin = Unit.FromPoint(36);
        section.PageSetup.RightMargin = Unit.FromPoint(36);
        // The header has a two-line masthead plus an accent rule (~55pt tall);
        // leave enough headroom so the body never renders over it.
        section.PageSetup.TopMargin = Unit.FromPoint(110);
        section.PageSetup.BottomMargin = Unit.FromPoint(56);
        section.PageSetup.HeaderDistance = Unit.FromPoint(28);
        section.PageSetup.FooterDistance = Unit.FromPoint(20);

        BuildHeader(section, safeCase, id);
        BuildFooter(section);
        BuildBody(section, input);

        return doc;
    }

    private static void BuildHeader(Section section, string safeCase, string id)
    {
        var header = section.Headers.Primary;

        var table = header.AddTable();
        table.Borders.Visible = false;
        table.AddColumn(Unit.FromCentimeter(10));
        table.AddColumn(Unit.FromCentimeter(8.4));
        var row = table.AddRow();

        var left = row.Cells[0];
        var brand = left.AddParagraph("CALDOVA WEALTH");
        brand.Format.Font.Size = 16;
        brand.Format.Font.Bold = true;
        brand.Format.Font.Color = BrandNavy;
        var sub = left.AddParagraph("Client Operations — Transfers & Rollovers");
        sub.Format.Font.Size = 9;
        sub.Format.Font.Color = TextMuted;

        var right = row.Cells[1];
        var title = right.AddParagraph("ROLLOVER / TRANSFER REQUEST");
        title.Format.Alignment = ParagraphAlignment.Right;
        title.Format.Font.Size = 13;
        title.Format.Font.Bold = true;
        title.Format.Font.Color = BrandTeal;
        var issued = right.AddParagraph($"Issued: {DateTimeOffset.Now:ddd d MMM yyyy}");
        issued.Format.Alignment = ParagraphAlignment.Right;
        issued.Format.Font.Size = 9;
        issued.Format.Font.Color = TextMuted;
        var reference = right.AddParagraph($"Reference: TR-{safeCase}-{id}");
        reference.Format.Alignment = ParagraphAlignment.Right;
        reference.Format.Font.Size = 9;
        reference.Format.Font.Color = TextMuted;

        var rule = header.AddParagraph();
        rule.Format.Borders.Bottom.Color = BrandGreen;
        rule.Format.Borders.Bottom.Width = 1;
        rule.Format.SpaceBefore = Unit.FromPoint(6);
        rule.Format.SpaceAfter = Unit.FromPoint(6);
    }

    private static void BuildFooter(Section section)
    {
        var footer = section.Footers.Primary;
        var p = footer.AddParagraph();
        p.Format.Alignment = ParagraphAlignment.Center;
        p.Format.Font.Size = 7.5;
        p.Format.Font.Color = TextSubtle;
        p.AddText($"Caldova Superannuation Services Pty Ltd (trustee) · {FundDirectory.CaldovaFundName} · USI {FundDirectory.CaldovaUsi} · ABN {FundDirectory.CaldovaAbn}");
        var p2 = footer.AddParagraph();
        p2.Format.Alignment = ParagraphAlignment.Center;
        p2.Format.Font.Size = 7.5;
        p2.Format.Font.Color = TextSubtle;
        p2.AddText("Wealth Team in a Day — fictional data · Page ");
        p2.AddPageField();
        p2.AddText(" of ");
        p2.AddNumPagesField();
    }

    private static void BuildBody(Section section, TransferRequestPdfInput input)
    {
        AddStatusBanner(section, input.RequestStatus);

        AddSectionHeading(section, "Member details");
        var details = section.AddTable();
        details.Borders.Visible = false;
        details.AddColumn(Unit.FromPoint(130));
        details.AddColumn(Unit.FromPoint(393));
        AddKeyValueRow(details, "Case number", input.CaseNumber);
        AddKeyValueRow(details, "Member", input.MemberName);
        AddKeyValueRow(details, "Member / account number", input.MemberNumber);
        AddKeyValueRow(details, "Product", input.Product);
        AddKeyValueRow(details, "Request type", input.RequestType);
        AddKeyValueRow(details, "Adviser", input.Adviser);
        AddKeyValueRow(details, "As at", input.AsAt);

        AddSectionHeading(section, "Transfers on this request");
        if (input.Legs.Count == 0)
        {
            AddPanelParagraph(section, "No rollover or transfer request has been raised for this case — nothing is sent to another fund.");
        }
        else
        {
            var legs = section.AddTable();
            legs.Borders.Width = 0.5;
            legs.Borders.Color = PanelBorder;
            legs.Format.Font.Size = 8.5;
            legs.AddColumn(Unit.FromPoint(128));
            legs.AddColumn(Unit.FromPoint(112));
            legs.AddColumn(Unit.FromPoint(72));
            legs.AddColumn(Unit.FromPoint(62));
            legs.AddColumn(Unit.FromPoint(149));

            var head = legs.AddRow();
            head.HeadingFormat = true;
            head.Shading.Color = PanelBg;
            foreach (var (text, i) in new[] { "Counterparty", "Direction / type", "Amount", "Status", "Detail" }.Select((t, i) => (t, i)))
            {
                var hp = head.Cells[i].AddParagraph(text);
                hp.Format.Font.Bold = true;
                if (i == 2) hp.Format.Alignment = ParagraphAlignment.Right;
            }

            foreach (var leg in input.Legs)
            {
                var row = legs.AddRow();
                row.TopPadding = Unit.FromPoint(3);
                row.BottomPadding = Unit.FromPoint(3);
                var cp = row.Cells[0].AddParagraph(leg.Counterparty);
                cp.Format.Font.Bold = true;
                if (!string.IsNullOrWhiteSpace(leg.CounterpartyId))
                {
                    var idp = row.Cells[0].AddParagraph(leg.CounterpartyId);
                    idp.Format.Font.Color = TextMuted;
                }
                row.Cells[1].AddParagraph(leg.Direction).Format.Font.Bold = true;
                row.Cells[1].AddParagraph(leg.TransferType).Format.Font.Color = TextMuted;
                var amt = row.Cells[2].AddParagraph(leg.Amount);
                amt.Format.Alignment = ParagraphAlignment.Right;
                var (bg, fg) = Tone(leg.Status);
                row.Cells[3].Shading.Color = bg;
                var st = row.Cells[3].AddParagraph(leg.Status.ToUpperInvariant());
                st.Format.Font.Bold = true;
                st.Format.Font.Color = fg;
                row.Cells[4].AddParagraph(leg.Detail);
            }
        }

        if (input.InsuranceWarnings.Count > 0)
        {
            AddSectionHeading(section, "Insurance-loss warnings");
            foreach (var warning in input.InsuranceWarnings)
                AddCalloutParagraph(section, "Warning: " + warning, WarnBg, WarnText);
        }

        if (!string.IsNullOrWhiteSpace(input.SvsSummary) || input.SvsChecks.Count > 0)
        {
            AddSectionHeading(section, "SMSF verification (ATO SMSF verification service)");
            if (!string.IsNullOrWhiteSpace(input.SvsSummary))
            {
                var passed = input.SvsChecks.Count > 0 && input.SvsChecks.All(c => c.Passed);
                AddCalloutParagraph(section, input.SvsSummary!, passed ? OkBg : BlockedBg, passed ? OkText : BlockedText);
            }
            if (input.SvsChecks.Count > 0)
            {
                var svs = section.AddTable();
                svs.Borders.Width = 0.5;
                svs.Borders.Color = PanelBorder;
                svs.Format.Font.Size = 8.5;
                svs.AddColumn(Unit.FromPoint(170));
                svs.AddColumn(Unit.FromPoint(55));
                svs.AddColumn(Unit.FromPoint(298));
                var head = svs.AddRow();
                head.HeadingFormat = true;
                head.Shading.Color = PanelBg;
                head.Cells[0].AddParagraph("Check").Format.Font.Bold = true;
                head.Cells[1].AddParagraph("Result").Format.Font.Bold = true;
                head.Cells[2].AddParagraph("Detail").Format.Font.Bold = true;
                foreach (var check in input.SvsChecks)
                {
                    var row = svs.AddRow();
                    row.Cells[0].AddParagraph(check.Check);
                    row.Cells[1].Shading.Color = check.Passed ? OkBg : BlockedBg;
                    var result = row.Cells[1].AddParagraph(check.Passed ? "PASS" : "FAIL");
                    result.Format.Font.Bold = true;
                    result.Format.Font.Color = check.Passed ? OkText : BlockedText;
                    row.Cells[2].AddParagraph(check.Detail);
                }
            }
        }

        AddSectionHeading(section, "Service levels");
        AddBullet(section, "Rollovers must be completed within 3 business days of receiving all required information (SIS reg 6.34A).");
        foreach (var line in input.SlaLines)
            AddBullet(section, line);

        if (input.Notes.Count > 0)
        {
            AddSectionHeading(section, "Notes");
            foreach (var note in input.Notes)
                AddBullet(section, note);
        }

        AddSectionHeading(section, "Instructions to the counterparty");
        var status = input.RequestStatus.ToUpperInvariant();
        var instructions = input.Legs.Count == 0
            ? "No action is required from any other fund for this case."
            : status.StartsWith("HELD", StringComparison.Ordinal)
                ? "HELD — this request has not been sent to the receiving fund. Do not act on any copy of it."
                : $"For transfers marked DISPATCHED: please pay the rollover through SuperStream to {FundDirectory.CaldovaFundName} " +
                  $"(USI {FundDirectory.CaldovaUsi}, ABN {FundDirectory.CaldovaAbn}) within 3 business days, quoting the member " +
                  "number above, and send the rollover benefit statement with the payment. Transfers marked HELD or SCHEDULED " +
                  "must not be actioned until Caldova confirms.";
        AddPanelParagraph(section, instructions);
    }

    private static (Color Background, Color Text) Tone(string status)
    {
        var s = status.ToUpperInvariant();
        if (s.StartsWith("DISPATCH", StringComparison.Ordinal) || s.StartsWith("REPORTED", StringComparison.Ordinal)) return (OkBg, OkText);
        if (s.StartsWith("SCHEDULED", StringComparison.Ordinal)) return (InfoBg, InfoText);
        if (s.StartsWith("BLOCK", StringComparison.Ordinal)) return (BlockedBg, BlockedText);
        if (s.StartsWith("HELD", StringComparison.Ordinal)) return (WarnBg, WarnText);
        return (PanelBg, TextMuted);
    }

    private static void AddStatusBanner(Section section, string requestStatus)
    {
        var s = (requestStatus ?? string.Empty).ToUpperInvariant();
        var (bg, fg) = s.Contains("NOT SENT", StringComparison.Ordinal)
            ? (BlockedBg, BlockedText)
            : s.Contains("HELD", StringComparison.Ordinal)
                ? (WarnBg, WarnText)
                : s.StartsWith("DISPATCH", StringComparison.Ordinal)
                    ? (OkBg, OkText)
                    : s.StartsWith("SCHEDULED", StringComparison.Ordinal)
                        ? (InfoBg, InfoText)
                        : (PanelBg, TextMuted);

        var banner = section.AddTable();
        banner.Borders.Visible = false;
        banner.AddColumn(Unit.FromPoint(523));
        var row = banner.AddRow();
        row.Shading.Color = bg;
        row.TopPadding = Unit.FromPoint(6);
        row.BottomPadding = Unit.FromPoint(6);
        var p = row.Cells[0].AddParagraph();
        p.Format.LeftIndent = Unit.FromPoint(6);
        var label = p.AddFormattedText("REQUEST STATUS:  ");
        label.Font.Bold = true;
        label.Font.Color = fg;
        var value = p.AddFormattedText(string.IsNullOrWhiteSpace(requestStatus) ? "—" : requestStatus);
        value.Font.Bold = true;
        value.Font.Size = 11;
        value.Font.Color = fg;
    }

    private static void AddSectionHeading(Section section, string text)
    {
        var p = section.AddParagraph(text);
        p.Format.Font.Size = 11.5;
        p.Format.Font.Bold = true;
        p.Format.Font.Color = BrandTeal;
        p.Format.SpaceBefore = Unit.FromPoint(10);
        p.Format.SpaceAfter = Unit.FromPoint(4);
        p.Format.KeepWithNext = true;
    }

    private static void AddKeyValueRow(Table table, string key, string? value)
    {
        var row = table.AddRow();
        var k = row.Cells[0].AddParagraph(key);
        k.Format.Font.Bold = true;
        k.Format.Font.Color = TextMuted;
        row.Cells[0].VerticalAlignment = VerticalAlignment.Top;
        row.Cells[1].AddParagraph(string.IsNullOrWhiteSpace(value) ? "—" : value!);
        row.TopPadding = Unit.FromPoint(2);
        row.BottomPadding = Unit.FromPoint(2);
    }

    private static void AddBullet(Section section, string text)
    {
        var p = section.AddParagraph($"•  {text}");
        p.Format.LeftIndent = Unit.FromPoint(10);
        p.Format.FirstLineIndent = Unit.FromPoint(-8);
        p.Format.SpaceAfter = Unit.FromPoint(2);
    }

    private static void AddPanelParagraph(Section section, string text)
    {
        var p = section.AddParagraph(text);
        p.Format.Shading.Color = PanelBg;
        p.Format.LeftIndent = Unit.FromPoint(8);
        p.Format.RightIndent = Unit.FromPoint(8);
        p.Format.SpaceBefore = Unit.FromPoint(2);
        p.Format.SpaceAfter = Unit.FromPoint(2);
        p.Format.Borders.Distance = Unit.FromPoint(4);
    }

    private static void AddCalloutParagraph(Section section, string text, Color background, Color foreground)
    {
        var p = section.AddParagraph(text);
        p.Format.Shading.Color = background;
        p.Format.Font.Color = foreground;
        p.Format.LeftIndent = Unit.FromPoint(8);
        p.Format.RightIndent = Unit.FromPoint(8);
        p.Format.SpaceBefore = Unit.FromPoint(2);
        p.Format.SpaceAfter = Unit.FromPoint(4);
        p.Format.Borders.Distance = Unit.FromPoint(4);
    }
}
