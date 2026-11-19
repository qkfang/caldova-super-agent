using System.Collections.Concurrent;
using System.Globalization;
using System.Text.RegularExpressions;
using Azure;
using Azure.AI.ContentUnderstanding;
using Azure.Identity;

namespace CaldovaSuper.App.Services;

/// <summary>Outcome of one authenticity check against a document.</summary>
/// <param name="Status"><c>pass</c>, <c>fail</c>, <c>warn</c> or <c>n/a</c>.</param>
public record FinCrimeDocumentCheck(string Name, string Status, string Detail);

/// <summary>Per-document verdict plus the checks that produced it.</summary>
/// <param name="Verdict"><c>legit</c>, <c>suspicious</c> or <c>fake</c>.</param>
/// <param name="Source"><c>content-understanding</c> or <c>manifest-fallback</c>.</param>
public record FinCrimeDocumentVerification(
    string Id,
    string Label,
    string Kind,
    string Src,
    string Verdict,
    string Summary,
    IReadOnlyList<string> FailureReasons,
    IReadOnlyList<FinCrimeDocumentCheck> Checks,
    string? CuMarkdown,
    string Source,
    IReadOnlyDictionary<string, string?> ExtractedFields);

/// <summary>
/// Document-authenticity verifier for the Financial Crime "Try it out" tab.
///
/// When Azure Content Understanding is configured
/// (<c>AZURE_CONTENT_UNDERSTANDING_ENDPOINT</c>, optional
/// <c>AZURE_CONTENT_UNDERSTANDING_KEY</c> — otherwise
/// <c>DefaultAzureCredential</c>), each specimen image is sent to a custom
/// analyzer built on <c>prebuilt-document</c> with a shared authenticity field
/// schema (document type, issuer, holder / account / fund name, document
/// number, dates, MRZ, tamper indicators, security features, consistency
/// summary). The extracted fields are then run through a deterministic checks
/// layer that compares them with the Member Case (parties, dates of birth on
/// file, accepted payee names, the SMSF and its ATO SVS result) and scores each
/// document <c>legit</c> / <c>suspicious</c> / <c>fake</c> with the reasons.
///
/// Without Content Understanding (or if a call fails) the same checks run on
/// the case-file record in the specimen manifest, so the demo always completes.
/// </summary>
public class FinCrimeDocumentVerifier
{
    public const string SourceContentUnderstanding = "content-understanding";
    public const string SourceManifestFallback = "manifest-fallback";

    private const string DefaultAnalyzerId = "caldova_fincrime_authenticity_v1";

    private static readonly string[] DocumentKinds =
    [
        "driver-licence", "passport", "bank-statement", "smsf-registration",
        "death-certificate", "income-support-letter", "other",
    ];

    private static readonly Regex NoneRegex = new(
        @"^\s*(none|no|nil|n/?a|not applicable|none (found|detected|visible)|no (visible )?(tamper(ing)? )?indicators?( found| detected)?)\s*\.?\s*$",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly string[] DateFormats =
    [
        "yyyy-MM-dd", "dd/MM/yyyy", "d/MM/yyyy", "d/M/yyyy", "dd MMM yyyy", "d MMM yyyy",
        "dd MMMM yyyy", "d MMMM yyyy", "yyyy/MM/dd", "dd-MM-yyyy", "yyyy-MM-ddTHH:mm:ss",
    ];

    private readonly FinCrimeCaseDocumentStore _store;
    private readonly ILogger<FinCrimeDocumentVerifier> _logger;
    private readonly string? _endpoint;
    private readonly string? _apiKey;
    private readonly string? _tenantId;
    private readonly string _analyzerId;
    private readonly string _completionModel;
    private readonly string _embeddingModel;
    private readonly Lazy<ContentUnderstandingClient> _client;
    private readonly SemaphoreSlim _analyzerGate = new(1, 1);
    private volatile bool _analyzerReady;
    private DateTimeOffset _retryContentUnderstandingAfter = DateTimeOffset.MinValue;

    // Latest verification per case + document (so engaging the agent reuses the scan).
    private readonly ConcurrentDictionary<string, FinCrimeDocumentVerification> _cache =
        new(StringComparer.OrdinalIgnoreCase);

    // Document numbers already verified, with the case (and scenario) they were first seen on.
    private readonly ConcurrentDictionary<string, (string CaseNumber, string SampleId)> _seenDocumentNumbers =
        new(StringComparer.OrdinalIgnoreCase);

    public FinCrimeDocumentVerifier(
        FinCrimeCaseDocumentStore store,
        IConfiguration config,
        ILogger<FinCrimeDocumentVerifier> logger)
    {
        _store = store;
        _logger = logger;
        _endpoint = config["AZURE_CONTENT_UNDERSTANDING_ENDPOINT"];
        _apiKey = config["AZURE_CONTENT_UNDERSTANDING_KEY"];
        _tenantId = config["AZURE_TENANT_ID"];
        _analyzerId = NonEmpty(config["AZURE_CONTENT_UNDERSTANDING_ANALYZER_ID"]) ?? DefaultAnalyzerId;
        _completionModel = NonEmpty(config["AZURE_CONTENT_UNDERSTANDING_COMPLETION_MODEL"]) ?? "gpt-4.1";
        _embeddingModel = NonEmpty(config["AZURE_CONTENT_UNDERSTANDING_EMBEDDING_MODEL"]) ?? "text-embedding-3-large";
        _client = new Lazy<ContentUnderstandingClient>(CreateClient);
    }

    /// <summary>True when an Azure Content Understanding endpoint is configured.</summary>
    public bool ContentUnderstandingConfigured => !string.IsNullOrWhiteSpace(_endpoint);

    /// <summary>Every check the layer runs, in the order they appear on each document.</summary>
    public IReadOnlyList<string> CheckNames { get; } =
    [
        "Document type plausibility",
        "Name matches the case",
        "Date of birth matches the record on file",
        "Dates plausible and current",
        "No visible tamper indicators",
        "Security features or certification present",
        "MRZ check digits valid (passports)",
        "Electronic verification (DVS)",
        "Counterparty checks (account age, SMSF registration, SVS)",
        "Document not used on another member's case",
    ];

    /// <summary>
    /// Verify documents against a Member Case. Documents are analysed in
    /// parallel; results keep the requested order. With <paramref name="useCache"/>
    /// the latest scan of the same document on the same case is reused.
    /// </summary>
    public async Task<IReadOnlyList<FinCrimeDocumentVerification>> VerifyAsync(
        CaseRecord record,
        IReadOnlyList<FinCrimeSampleDocument> samples,
        bool useCache = false,
        CancellationToken cancellationToken = default)
    {
        if (samples.Count == 0) return Array.Empty<FinCrimeDocumentVerification>();

        var profile = _store.ProfileFor(record);
        var results = await Task.WhenAll(samples.Select(sample =>
            VerifyWithCacheAsync(record, profile, sample, useCache, cancellationToken)));

        // Remember document numbers so a document reused on another member's
        // case is flagged there. First case wins.
        foreach (var sample in samples)
        {
            var number = NormaliseNumber(sample.DocumentNumber);
            if (number.Length > 0)
                _seenDocumentNumbers.TryAdd(number, (record.CaseNumber, record.SampleId));
        }

        return results;
    }

    private async Task<FinCrimeDocumentVerification> VerifyWithCacheAsync(
        CaseRecord record,
        FinCrimeCaseProfile profile,
        FinCrimeSampleDocument sample,
        bool useCache,
        CancellationToken ct)
    {
        var key = $"{record.CaseNumber}|{sample.Id}";
        if (useCache && _cache.TryGetValue(key, out var cached)) return cached;

        FinCrimeDocumentVerification result;
        try
        {
            result = await VerifyOneAsync(record, profile, sample, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            _logger.LogWarning(ex, "Document verification failed for {DocumentId}; using the case-file record", sample.Id);
            result = BuildResult(record, profile, sample, ManifestFields(sample), null, SourceManifestFallback,
                $"Verification fell back to the case-file record ({Shorten(ex.Message, 140)}).");
        }
        _cache[key] = result;
        return result;
    }

    private async Task<FinCrimeDocumentVerification> VerifyOneAsync(
        CaseRecord record,
        FinCrimeCaseProfile profile,
        FinCrimeSampleDocument sample,
        CancellationToken ct)
    {
        if (!ContentUnderstandingConfigured)
        {
            return BuildResult(record, profile, sample, ManifestFields(sample), null, SourceManifestFallback, null);
        }

        if (DateTimeOffset.UtcNow < _retryContentUnderstandingAfter)
        {
            return BuildResult(record, profile, sample, ManifestFields(sample), null, SourceManifestFallback,
                "Content Understanding failed a moment ago, so the checks ran on the case-file record.");
        }

        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(90));
            var (extracted, markdown) = await AnalyzeAsync(sample, timeout.Token);

            // Content Understanding wins; the case-file record only fills gaps
            // (and supplies the DVS result, which comes from a separate service).
            var fields = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
            foreach (var (key, value) in extracted)
            {
                if (!string.IsNullOrWhiteSpace(value)) fields[key] = value.Trim();
            }
            foreach (var (key, value) in ManifestFields(sample))
            {
                if (!fields.ContainsKey(key) || key.Equals("electronicVerification", StringComparison.OrdinalIgnoreCase))
                    fields[key] = value;
            }
            return BuildResult(record, profile, sample, fields, markdown, SourceContentUnderstanding, null);
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            _logger.LogWarning(ex, "Content Understanding analysis failed for {DocumentId}; using the case-file record", sample.Id);
            _retryContentUnderstandingAfter = DateTimeOffset.UtcNow.AddMinutes(2);
            return BuildResult(record, profile, sample, ManifestFields(sample), null, SourceManifestFallback,
                $"Content Understanding was unavailable ({Shorten(ex.Message, 140)}), so the checks ran on the case-file record.");
        }
    }

    private FinCrimeDocumentVerification BuildResult(
        CaseRecord record,
        FinCrimeCaseProfile profile,
        FinCrimeSampleDocument sample,
        Dictionary<string, string?> fields,
        string? markdown,
        string source,
        string? note)
    {
        var recorder = RunChecks(record, profile, sample, fields);
        var (verdict, summary, reasons) = ScoreVerdict(recorder, sample);
        if (note is not null) reasons.Insert(0, note);
        return new FinCrimeDocumentVerification(
            Id: sample.Id,
            Label: sample.Label,
            Kind: sample.Kind,
            Src: sample.Src,
            Verdict: verdict,
            Summary: summary,
            FailureReasons: reasons,
            Checks: recorder.Checks,
            CuMarkdown: markdown,
            Source: source,
            ExtractedFields: fields);
    }

    // ── Azure Content Understanding ─────────────────────────────────────────

    private ContentUnderstandingClient CreateClient()
    {
        var endpoint = new Uri(_endpoint!);
        if (!string.IsNullOrWhiteSpace(_apiKey))
            return new ContentUnderstandingClient(endpoint, new AzureKeyCredential(_apiKey));

        var options = new DefaultAzureCredentialOptions
        {
            ExcludeVisualStudioCredential = true,
            ExcludeVisualStudioCodeCredential = true,
        };
        if (!string.IsNullOrWhiteSpace(_tenantId)) options.TenantId = _tenantId;
        return new ContentUnderstandingClient(endpoint, new DefaultAzureCredential(options));
    }

    private async Task<(Dictionary<string, string?> Fields, string? Markdown)> AnalyzeAsync(
        FinCrimeSampleDocument sample, CancellationToken ct)
    {
        var path = _store.ResolvePhysicalPath(sample)
            ?? throw new FileNotFoundException($"Specimen image for '{sample.Id}' was not found under wwwroot.");
        var client = _client.Value;
        await EnsureAnalyzerAsync(client, ct);

        // Send the image bytes rather than a URL: the cloud service can't
        // reach a developer's localhost.
        var bytes = await File.ReadAllBytesAsync(path, ct);
        var operation = await client.AnalyzeBinaryAsync(
            WaitUntil.Completed,
            _analyzerId,
            BinaryData.FromBytes(bytes),
            contentType: ContentTypeFor(path),
            cancellationToken: ct);

        var content = operation.Value.Contents?.FirstOrDefault();
        var fields = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        if (content?.Fields is not null)
        {
            foreach (var entry in content.Fields)
            {
                fields[entry.Key] = entry.Value?.Value switch
                {
                    null => null,
                    DateTimeOffset dto => dto.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    IFormattable formattable => formattable.ToString(null, CultureInfo.InvariantCulture),
                    var other => other.ToString(),
                };
            }
        }
        return (fields, content?.Markdown);
    }

    private async Task EnsureAnalyzerAsync(ContentUnderstandingClient client, CancellationToken ct)
    {
        if (_analyzerReady) return;
        await _analyzerGate.WaitAsync(ct);
        try
        {
            if (_analyzerReady) return;
            try
            {
                await client.GetAnalyzerAsync(_analyzerId, ct);
            }
            catch (RequestFailedException ex) when (ex.Status == 404)
            {
                _logger.LogInformation("Creating Content Understanding analyzer {AnalyzerId}", _analyzerId);
                await client.CreateAnalyzerAsync(WaitUntil.Completed, _analyzerId, BuildAnalyzer(), true, ct);
            }
            _analyzerReady = true;
        }
        finally
        {
            _analyzerGate.Release();
        }
    }

    private ContentAnalyzer BuildAnalyzer()
    {
        static ContentFieldDefinition Text(string description) => new()
        {
            Type = ContentFieldType.String,
            Method = GenerationMethod.Generate,
            Description = description,
        };

        var schema = new ContentFieldSchema(new Dictionary<string, ContentFieldDefinition>
        {
            ["documentType"] = new()
            {
                Type = ContentFieldType.String,
                Method = GenerationMethod.Classify,
                Description = "Type of document.",
            },
            ["issuer"] = Text("Issuing organisation exactly as printed (licensing authority, passport authority, bank, registry, agency or register)."),
            ["holderName"] = Text("Name the document is about: licence or passport holder, bank account name, SMSF fund name, deceased person on a death certificate, or the letter's addressee."),
            ["documentNumber"] = Text("Primary identifier: licence number, passport number, BSB and account number as printed (masked digits stay masked), ABN, death registration number or customer reference number."),
            ["dateOfBirth"] = Text("Date of birth printed on the document, as yyyy-MM-dd. Empty if none."),
            ["issueDate"] = Text("Issue date, statement date or letter date, as yyyy-MM-dd. Empty if none."),
            ["expiryDate"] = Text("Expiry date, as yyyy-MM-dd. Empty if none."),
            ["registrationDate"] = Text("ABN registration date (SMSF extract) or death registration date (death certificate), as yyyy-MM-dd. Empty if none."),
            ["dateOfDeath"] = Text("Date of death on a death certificate, as yyyy-MM-dd. Empty if none."),
            ["accountOpenedDate"] = Text("Date the bank account was opened, or the 'customer since' date, as yyyy-MM-dd. Empty if none."),
            ["incomeSupportSince"] = Text("Date income support started, from an income support letter, as yyyy-MM-dd. Empty if none."),
            ["mrz"] = Text("Passport machine-readable zone: both lines exactly as printed, separated by a newline. Empty if none."),
            ["tamperIndicators"] = Text("Visible signs the document was altered: a field re-typed in a different font, weight or baseline; patched backgrounds that interrupt the guilloche; a re-pasted or cut-out photo; a ghost image that doesn't match the main photo; missing or damaged holograms or security bands the card says it has; misspelt issuer names; impossible or inconsistent dates. Ignore the 'SPECIMEN — DEMO ONLY' watermark and stamps. Return 'none' when there are no indicators."),
            ["securityFeaturesPresent"] = new()
            {
                Type = ContentFieldType.String,
                Method = GenerationMethod.Classify,
                Description = "Whether the security features this document type should carry are present and intact (identity documents: hologram band, microprint, ghost image, MRZ; certified copies: certification stamp and seal). Use n/a for statements, letters and register extracts.",
            },
            ["consistencySummary"] = Text("One or two plain-English sentences on whether the document is internally consistent."),
        })
        {
            Name = "caldova_fincrime_authenticity",
            Description = "Authenticity-oriented fields for documents supporting super and wealth requests.",
        };
        foreach (var kind in DocumentKinds) schema.Fields["documentType"].Enum.Add(kind);
        foreach (var value in new[] { "yes", "no", "partial", "n/a" }) schema.Fields["securityFeaturesPresent"].Enum.Add(value);

        var analyzer = new ContentAnalyzer
        {
            BaseAnalyzerId = "prebuilt-document",
            Description = "Caldova Wealth financial-crime document authenticity: identity documents, bank statements, SMSF registration extracts, death certificates and income support letters. Every demo document carries a 'SPECIMEN — DEMO ONLY' watermark; that watermark is expected and is not a sign of tampering.",
            Config = new ContentAnalyzerConfig { EnableOcr = true, EnableLayout = true },
            FieldSchema = schema,
        };
        analyzer.Models["completion"] = _completionModel;
        analyzer.Models["embedding"] = _embeddingModel;
        return analyzer;
    }

    private static string ContentTypeFor(string path) => Path.GetExtension(path).ToLowerInvariant() switch
    {
        ".png" => "image/png",
        ".jpg" or ".jpeg" => "image/jpeg",
        ".pdf" => "application/pdf",
        _ => "application/octet-stream",
    };

    // ── Case-file record (fallback) ─────────────────────────────────────────

    private static Dictionary<string, string?> ManifestFields(FinCrimeSampleDocument s)
    {
        var isId = IsIdentityDocument(s.Kind);
        var fields = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
        {
            ["documentType"] = s.Kind,
            ["issuer"] = s.Issuer,
            ["holderName"] = s.ExpectedHolderName,
            ["documentNumber"] = s.DocumentNumber,
            ["dateOfBirth"] = s.ExpectedDateOfBirth,
            ["issueDate"] = s.ExpectedIssueDate,
            ["expiryDate"] = s.ExpectedExpiryDate,
            ["registrationDate"] = s.RegistrationDate,
            ["dateOfDeath"] = s.DateOfDeath,
            ["accountOpenedDate"] = s.AccountOpenedDate,
            ["incomeSupportSince"] = s.IncomeSupportSince,
            ["mrz"] = s.Mrz,
            ["tamperIndicators"] = s.TamperIndicators
                ?? (s.Expected.Equals("fake", StringComparison.OrdinalIgnoreCase) ? s.Description : "none"),
            ["securityFeaturesPresent"] = s.SecurityFeatures
                ?? (isId ? (s.Expected.Equals("legit", StringComparison.OrdinalIgnoreCase) ? "yes" : "no") : "n/a"),
            ["electronicVerification"] = s.ElectronicVerification,
        };
        if (s.ExpectedTotal is { } total)
            fields["closingBalance"] = total.ToString("N2", CultureInfo.InvariantCulture);
        return fields.Where(kv => !string.IsNullOrWhiteSpace(kv.Value))
            .ToDictionary(kv => kv.Key, kv => kv.Value, StringComparer.OrdinalIgnoreCase);
    }

    // ── Deterministic checks layer ──────────────────────────────────────────

    private sealed class CheckRecorder(IReadOnlyList<string> names)
    {
        public List<FinCrimeDocumentCheck> Checks { get; } = new();
        public List<string> FailHeadlines { get; } = new();
        public List<string> WarnHeadlines { get; } = new();

        public void Pass(string detail) => Add("pass", detail, null);
        public void Fail(string detail, string headline) => Add("fail", detail, headline);
        public void Warn(string detail, string headline) => Add("warn", detail, headline);
        public void NotApplicable(string detail = "Not applicable to this document type.") => Add("n/a", detail, null);

        private void Add(string status, string detail, string? headline)
        {
            Checks.Add(new FinCrimeDocumentCheck(names[Checks.Count], status, detail));
            if (headline is null) return;
            (status == "fail" ? FailHeadlines : WarnHeadlines).Add(headline);
        }
    }

    private CheckRecorder RunChecks(
        CaseRecord record,
        FinCrimeCaseProfile profile,
        FinCrimeSampleDocument sample,
        IReadOnlyDictionary<string, string?> f)
    {
        var c = new CheckRecorder(CheckNames);
        var kind = sample.Kind.ToLowerInvariant();
        var isId = IsIdentityDocument(kind);
        var received = ParseDate(record.ReceivedDate) ?? record.CreatedAt.Date;
        var holder = Get(f, "holderName");
        var party = FindParty(profile, holder);

        // 1. Document type plausibility
        var detected = Get(f, "documentType");
        if (string.IsNullOrWhiteSpace(detected))
            c.Warn("Document type could not be determined.", "document type unclear");
        else if (Normalise(detected).Replace(" ", "-") == kind)
            c.Pass($"Read as {WithArticle(KindLabel(kind))} — matches the case file.");
        else
            c.Warn($"Read as '{detected}', but the case file lists it as {WithArticle(KindLabel(kind))}.", "document type doesn't match the case file");

        // 2. Name matches the case
        switch (kind)
        {
            case "driver-licence" or "passport" or "income-support-letter":
                if (string.IsNullOrWhiteSpace(holder))
                    c.Warn("Name could not be read from the document.", "name unreadable");
                else if (party is null)
                    c.Warn($"'{holder}' is not a party on this case ({PartyList(profile)}).", "name doesn't match anyone on the case");
                else
                    c.Pass($"'{holder}' matches {party.Name} ({party.Role.ToLowerInvariant()}).");
                break;
            case "death-certificate":
                if (string.IsNullOrWhiteSpace(holder))
                    c.Warn("Name of the deceased could not be read.", "name unreadable");
                else if (party is null || !party.Role.Contains("deceased", StringComparison.OrdinalIgnoreCase))
                    c.Warn($"'{holder}' is not the deceased member on this case ({PartyList(profile)}).", "deceased doesn't match the case");
                else
                    c.Pass($"'{holder}' matches the deceased member, {party.Name}.");
                break;
            case "bank-statement":
                if (string.IsNullOrWhiteSpace(holder))
                {
                    c.Warn("Account name could not be read.", "account name unreadable");
                }
                else if (profile.AcceptedAccountNames.FirstOrDefault(n => NamesMatch(holder, n)) is { } accepted)
                {
                    c.Pass($"Account name '{holder}' matches {accepted}.");
                }
                else
                {
                    var member = profile.Parties.FirstOrDefault()?.Name ?? record.ClientName;
                    var fund = profile.ReceivingSmsf is { } smsf ? $" nor the receiving SMSF ('{smsf.FundName}')" : string.Empty;
                    c.Warn($"Account name '{holder}' matches neither the member ({member}){fund} — payee name mismatch.", "payee name mismatch");
                }
                break;
            case "smsf-registration":
                if (profile.ReceivingSmsf is not { } receiving)
                    c.Warn("There is no rollover to an SMSF on this case.", "SMSF not part of this case");
                else if (!string.IsNullOrWhiteSpace(holder) && NamesMatch(holder, receiving.FundName))
                    c.Pass($"Fund name matches the SMSF named on the request ('{receiving.FundName}').");
                else
                    c.Warn($"Fund name '{holder}' doesn't match the SMSF named on the request ('{receiving.FundName}').", "fund name mismatch");
                break;
            default:
                c.NotApplicable();
                break;
        }

        // 3. Date of birth matches the record on file
        if (isId || kind is "death-certificate" or "income-support-letter")
        {
            var dobRaw = Get(f, "dateOfBirth");
            var docDob = ParseDate(dobRaw);
            if (docDob is null)
                c.Warn("Date of birth could not be read.", "date of birth unreadable");
            else if (party is null)
                c.Warn("The named person isn't on this case, so the date of birth wasn't compared.", "date of birth not compared");
            else if (ParseDate(party.DateOfBirth) is not { } onFile)
                c.Warn($"No date of birth on file for {party.Name}.", "no date of birth on file");
            else if (onFile.Date == docDob.Value.Date)
                c.Pass($"{Dmy(docDob)} matches the record on file for {party.Name}.");
            else
                c.Fail($"Document shows {Dmy(docDob)}; the record on file for {party.Name} is {Dmy(onFile)}.",
                    "date of birth contradicts the record on file");
        }
        else
        {
            c.NotApplicable();
        }

        // 4. Dates plausible and current
        CheckDates(c, kind, f, received);

        // 5. No visible tamper indicators
        var tamper = Get(f, "tamperIndicators");
        if (string.IsNullOrWhiteSpace(tamper) || NoneRegex.IsMatch(tamper))
            c.Pass("No tamper indicators found.");
        else
            c.Fail($"Tamper indicators: {Shorten(tamper, 260)}", "visible signs of alteration");

        // 6. Security features or certification present
        var security = Normalise(Get(f, "securityFeaturesPresent"));
        if (isId)
        {
            if (security.StartsWith("yes"))
                c.Pass("Expected security features look intact.");
            else if (security.StartsWith("partial"))
                c.Fail("Security features are incomplete — patterns interrupted or features damaged.", "security features incomplete");
            else if (security.StartsWith("no"))
                c.Fail("Expected security features are missing or damaged.", "security features missing");
            else
                c.Warn("Could not confirm the security features.", "security features not confirmed");
        }
        else if (kind == "death-certificate")
        {
            if (security.StartsWith("yes"))
                c.Pass("Certified copy: certification stamp and registry seal present.");
            else
                c.Warn("No certification found — ask for a certified copy.", "not a certified copy");
        }
        else
        {
            c.NotApplicable();
        }

        // 7. MRZ check digits (passports)
        if (kind == "passport")
        {
            var mrz = Get(f, "mrz");
            var (valid, problems) = ValidateTd3(mrz);
            if (string.IsNullOrWhiteSpace(mrz))
                c.Warn("The machine-readable zone could not be read.", "MRZ unreadable");
            else if (!valid)
                c.Fail($"MRZ check digits inconsistent: {string.Join("; ", problems)}.", "MRZ check digits inconsistent");
            else if (!MrzMatchesPrinted(mrz, Get(f, "documentNumber"), out var mismatch))
                c.Fail($"MRZ check digits are valid but {mismatch}.", "MRZ doesn't match the printed data");
            else
                c.Pass("Document number, date of birth, expiry and composite check digits are all consistent with the printed data.");
        }
        else
        {
            c.NotApplicable();
        }

        // 8. Electronic verification (DVS)
        if (isId)
        {
            var dvs = Get(f, "electronicVerification");
            if (string.IsNullOrWhiteSpace(dvs))
                c.Warn("No Document Verification Service (DVS) result on the case.", "DVS not run");
            else if (dvs.StartsWith("no match", StringComparison.OrdinalIgnoreCase))
                c.Fail($"DVS: {dvs}.", "DVS returned no match");
            else if (dvs.StartsWith("match", StringComparison.OrdinalIgnoreCase))
                c.Pass($"DVS: {dvs}.");
            else
                c.Warn($"DVS: {dvs}.", "DVS result unclear");
        }
        else
        {
            c.NotApplicable();
        }

        // 9. Counterparty checks
        CheckCounterparty(c, kind, f, profile, received);

        // 10. Document not used on another member's case
        var owners = _store.OwnerSampleIds(sample.Id);
        var number = NormaliseNumber(Get(f, "documentNumber") ?? sample.DocumentNumber);
        if (owners.Count > 0 && !owners.Contains(record.SampleId, StringComparer.OrdinalIgnoreCase))
        {
            var ownerNames = string.Join(", ", owners.Select(FinCrimeCaseDocumentStore.OwnerName));
            c.Warn($"This document is held on another member's case ({ownerNames}); one document shouldn't support two members' requests.",
                "document belongs to another member's case");
        }
        else if (number.Length > 0 &&
                 _seenDocumentNumbers.TryGetValue(number, out var seen) &&
                 !seen.CaseNumber.Equals(record.CaseNumber, StringComparison.OrdinalIgnoreCase) &&
                 !seen.SampleId.Equals(record.SampleId, StringComparison.OrdinalIgnoreCase))
        {
            c.Warn($"Document number {Get(f, "documentNumber")} was already submitted on case {seen.CaseNumber}.",
                "document already used on another case");
        }
        else
        {
            c.Pass("Not seen on any other member's case.");
        }

        return c;
    }

    private static void CheckDates(CheckRecorder c, string kind, IReadOnlyDictionary<string, string?> f, DateTime received)
    {
        switch (kind)
        {
            case "driver-licence" or "passport":
            {
                var issue = ParseDate(Get(f, "issueDate"));
                var expiry = ParseDate(Get(f, "expiryDate"));
                if (issue is null && expiry is null)
                    c.Warn("Issue and expiry dates could not be read.", "dates unreadable");
                else if (issue is not null && expiry is not null && expiry < issue)
                    c.Fail($"Expiry ({Dmy(expiry)}) is before issue ({Dmy(issue)}).", "impossible dates");
                else if (issue is not null && issue > received)
                    c.Fail($"Issued {Dmy(issue)} — after the request was received ({Dmy(received)}).", "issued after the request");
                else if (expiry is not null && expiry < received)
                    c.Warn($"Expired on {Dmy(expiry)}, before the request ({Dmy(received)}).", "expired document");
                else
                    c.Pass($"Issued {Dmy(issue)}, expires {Dmy(expiry)} — current when the request was received.");
                break;
            }
            case "bank-statement":
            {
                var statement = ParseDate(Get(f, "issueDate"));
                if (statement is null)
                    c.Warn("Statement date could not be read.", "statement date unreadable");
                else if (statement > received)
                    c.Warn($"Statement dated {Dmy(statement)} — after the request date.", "statement dated after the request");
                else if ((received - statement.Value).TotalDays > 92)
                    c.Warn($"Statement dated {Dmy(statement)} — more than three months before the request.", "statement out of date");
                else
                    c.Pass($"Statement dated {Dmy(statement)} — within three months of the request.");
                break;
            }
            case "smsf-registration":
            {
                var registered = ParseDate(Get(f, "registrationDate"));
                if (registered is null)
                    c.Warn("Registration date could not be read.", "registration date unreadable");
                else if (registered > received)
                    c.Warn($"Registered {Dmy(registered)} — after the request date.", "registration after the request");
                else
                    c.Pass($"Registered {Dmy(registered)}, before the request date.");
                break;
            }
            case "death-certificate":
            {
                var death = ParseDate(Get(f, "dateOfDeath"));
                var registered = ParseDate(Get(f, "registrationDate") ?? Get(f, "issueDate"));
                if (death is null)
                    c.Warn("Date of death could not be read.", "date of death unreadable");
                else if (death > received)
                    c.Fail($"Date of death ({Dmy(death)}) is after the notification ({Dmy(received)}).", "impossible dates");
                else if (registered is not null && registered < death)
                    c.Fail($"Registered {Dmy(registered)} — before the date of death ({Dmy(death)}).", "impossible dates");
                else
                    c.Pass($"Died {Dmy(death)}; registered {Dmy(registered)}; notified {Dmy(received)}.");
                break;
            }
            case "income-support-letter":
            {
                var letter = ParseDate(Get(f, "issueDate"));
                if (letter is null)
                {
                    c.Warn("Letter date could not be read.", "letter date unreadable");
                    break;
                }
                var days = (int)(received - letter.Value).TotalDays;
                if (days < 0)
                    c.Warn($"Letter dated {Dmy(letter)} — after the application.", "letter dated after the application");
                else if (days > 21)
                    c.Warn($"Letter dated {Dmy(letter)} — {days} days before the application; it needs to be dated within 21 days.", "income support letter out of date");
                else
                    c.Pass($"Letter dated {Dmy(letter)} — {days} day{(days == 1 ? "" : "s")} before the application (within 21 days).");
                break;
            }
            default:
                c.NotApplicable();
                break;
        }
    }

    private static void CheckCounterparty(
        CheckRecorder c, string kind, IReadOnlyDictionary<string, string?> f, FinCrimeCaseProfile profile, DateTime received)
    {
        switch (kind)
        {
            case "bank-statement":
            {
                var opened = ParseDate(Get(f, "accountOpenedDate"));
                if (opened is null)
                {
                    c.Warn("The account opening date isn't shown.", "account age unknown");
                    break;
                }
                var days = (int)(received - opened.Value).TotalDays;
                if (days is >= 0 and <= 30)
                    c.Warn($"Account opened {Dmy(opened)} — {days} days before the request (newly opened account).", "newly opened account");
                else
                    c.Pass($"Account open since {Dmy(opened)}.");
                break;
            }
            case "smsf-registration":
            {
                var parts = new List<string>();
                var concerns = new List<string>();
                if (ParseDate(Get(f, "registrationDate")) is { } registered)
                {
                    var days = (int)(received - registered).TotalDays;
                    if (days is >= 0 and <= 30)
                    {
                        parts.Add($"ABN registered {Dmy(registered)} — {days} days before the request (newly registered SMSF)");
                        concerns.Add("newly registered SMSF");
                    }
                    else
                    {
                        parts.Add($"ABN registered {Dmy(registered)}");
                    }
                }
                if (profile.ReceivingSmsf is { } smsf)
                {
                    parts.Add("ATO SVS: " + string.Join(", ", new[]
                    {
                        (smsf.AbnIsRegisteredSmsf ? "✓" : "✗") + " registered SMSF",
                        (smsf.MemberTfnLinked ? "✓" : "✗") + " member's TFN linked",
                        (smsf.BankDetailsMatch ? "✓" : "✗") + " bank details match",
                        (smsf.EsaMatches ? "✓" : "✗") + " ESA matches",
                    }));
                    if (!smsf.AbnIsRegisteredSmsf || !smsf.MemberTfnLinked || !smsf.BankDetailsMatch || !smsf.EsaMatches)
                        concerns.Add("SVS mismatch");
                }
                else
                {
                    parts.Add("no SVS result on this case");
                    concerns.Add("no SVS result");
                }
                var detail = string.Join("; ", parts) + ".";
                if (concerns.Count > 0)
                    c.Warn(detail, string.Join(", ", concerns));
                else
                    c.Pass(detail);
                break;
            }
            default:
                c.NotApplicable();
                break;
        }
    }

    private static (string Verdict, string Summary, List<string> Reasons) ScoreVerdict(
        CheckRecorder c, FinCrimeSampleDocument sample)
    {
        var reasons = c.Checks
            .Where(x => x.Status is "fail" or "warn")
            .Select(x => $"{x.Name}: {x.Detail}")
            .ToList();

        var verdict = c.FailHeadlines.Count > 0 ? "fake"
                    : c.WarnHeadlines.Count > 0 ? "suspicious"
                    : "legit";

        // Respect the case-file flag if extraction missed what the checks need.
        if (verdict == "legit" && !sample.Expected.Equals("legit", StringComparison.OrdinalIgnoreCase))
        {
            verdict = "suspicious";
            reasons.Add($"The case file flags this document for review: {sample.Description}");
            c.WarnHeadlines.Add("flagged on the case file");
        }

        var summary = verdict switch
        {
            "fake" => "Likely altered — " + string.Join("; ", c.FailHeadlines.Concat(c.WarnHeadlines).Distinct()) + ".",
            "suspicious" => "Needs verification — " + string.Join("; ", c.WarnHeadlines.Distinct()) + ".",
            _ => "Consistent with a genuine document — every applicable check passed.",
        };
        return (verdict, summary, reasons);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private static bool IsIdentityDocument(string kind) =>
        kind.Equals("driver-licence", StringComparison.OrdinalIgnoreCase) ||
        kind.Equals("passport", StringComparison.OrdinalIgnoreCase);

    private static string KindLabel(string kind) => kind switch
    {
        "driver-licence" => "driver licence",
        "passport" => "passport",
        "bank-statement" => "bank statement",
        "smsf-registration" => "SMSF registration extract",
        "death-certificate" => "death certificate",
        "income-support-letter" => "income support letter",
        _ => kind.Replace('-', ' '),
    };

    private static string WithArticle(string noun) =>
        (Regex.IsMatch(noun, "^(SMSF|[aeiouAEIOU])") ? "an " : "a ") + noun;

    private static string? Get(IReadOnlyDictionary<string, string?> fields, string key) =>
        fields.TryGetValue(key, out var v) && !string.IsNullOrWhiteSpace(v) ? v : null;

    private static string? NonEmpty(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string Normalise(string? value) =>
        Regex.Replace((value ?? string.Empty).ToLowerInvariant(), @"[^a-z0-9&/]+", " ").Trim();

    private static string NormaliseNumber(string? value) =>
        Regex.Replace(value ?? string.Empty, @"[^A-Za-z0-9*]", string.Empty).ToUpperInvariant();

    private static FinCrimeCaseParty? FindParty(FinCrimeCaseProfile profile, string? name)
    {
        if (string.IsNullOrWhiteSpace(name)) return null;
        return profile.Parties.FirstOrDefault(p =>
            NamesMatch(name, p.Name) || (p.Aliases?.Any(a => NamesMatch(name, a)) ?? false));
    }

    private static string PartyList(FinCrimeCaseProfile profile) =>
        string.Join(", ", profile.Parties.Select(p => $"{p.Name} — {p.Role.ToLowerInvariant()}"));

    /// <summary>
    /// Names match when they normalise to the same text, or share at least two
    /// meaningful tokens (one when either name is a single word).
    /// </summary>
    private static bool NamesMatch(string a, string b)
    {
        var na = Normalise(a);
        var nb = Normalise(b);
        if (na.Length == 0 || nb.Length == 0) return false;
        if (na == nb) return true;
        var ta = Tokens(na);
        var tb = Tokens(nb);
        if (ta.Count == 0 || tb.Count == 0) return false;
        var common = ta.Intersect(tb).Count();
        return common >= Math.Min(2, Math.Min(ta.Count, tb.Count)) && common >= Math.Min(ta.Count, tb.Count);
    }

    private static HashSet<string> Tokens(string normalised) =>
        new(normalised.Split(' ', StringSplitOptions.RemoveEmptyEntries).Where(t => t.Length >= 2 && t is not ("pty" or "ltd" or "the")));

    private static DateTime? ParseDate(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var text = raw.Trim();
        if (DateTime.TryParseExact(text, DateFormats, CultureInfo.InvariantCulture, DateTimeStyles.AllowWhiteSpaces, out var exact))
            return exact.Date;
        return DateTime.TryParse(text, CultureInfo.GetCultureInfo("en-AU"), DateTimeStyles.AllowWhiteSpaces, out var loose)
            ? loose.Date
            : null;
    }

    private static string Dmy(DateTime? value) =>
        value is { } d ? d.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture) : "(not shown)";

    private static string Shorten(string value, int max) =>
        string.IsNullOrEmpty(value) || value.Length <= max ? value : value[..max] + "…";

    // ── ICAO 9303 TD3 (passport) machine-readable zone ──────────────────────

    private static int MrzValue(char ch) => ch switch
    {
        >= '0' and <= '9' => ch - '0',
        >= 'A' and <= 'Z' => ch - 'A' + 10,
        _ => 0,
    };

    private static char CheckDigit(string field)
    {
        int[] weights = [7, 3, 1];
        var total = 0;
        for (var i = 0; i < field.Length; i++)
            total += MrzValue(char.ToUpperInvariant(field[i])) * weights[i % 3];
        return (char)('0' + total % 10);
    }

    private static string? MrzLine2(string? mrz) =>
        (mrz ?? string.Empty)
            .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(l => l.Replace(" ", string.Empty).ToUpperInvariant())
            .LastOrDefault(l => l.Length == 44);

    private static (bool Valid, List<string> Problems) ValidateTd3(string? mrz)
    {
        var problems = new List<string>();
        var line = MrzLine2(mrz);
        if (line is null)
        {
            problems.Add("the second MRZ line is not the 44 characters a passport needs");
            return (false, problems);
        }

        void Expect(string label, string field, char actual)
        {
            var expected = CheckDigit(field);
            if (actual != expected) problems.Add($"{label} check digit is {actual}, expected {expected}");
        }

        Expect("document number", line[..9], line[9]);
        Expect("date of birth", line[13..19], line[19]);
        Expect("expiry date", line[21..27], line[27]);
        var personal = line[28..42];
        var personalBlank = personal.All(ch => ch == '<') && (line[42] == '<' || line[42] == '0');
        if (!personalBlank) Expect("personal number", personal, line[42]);
        Expect("composite", line[..10] + line[13..20] + line[21..43], line[43]);
        return (problems.Count == 0, problems);
    }

    private static bool MrzMatchesPrinted(string? mrz, string? printedNumber, out string mismatch)
    {
        mismatch = string.Empty;
        var line = MrzLine2(mrz);
        var printed = NormaliseNumber(printedNumber);
        if (line is null || printed.Length == 0) return true;
        var mrzNumber = line[..9].TrimEnd('<');
        if (mrzNumber.Equals(printed, StringComparison.OrdinalIgnoreCase)) return true;
        mismatch = $"the MRZ document number ({mrzNumber}) differs from the printed number ({printedNumber})";
        return false;
    }
}
