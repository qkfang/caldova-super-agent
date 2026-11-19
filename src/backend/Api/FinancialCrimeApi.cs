using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using CaldovaSuper.Agents;
using CaldovaSuper.App.Models;
using CaldovaSuper.App.Services;

namespace CaldovaSuper.App.Api;

record FinCrimeVerifyRequest(string CaseNumber, List<string>? DocumentIds);
record FinCrimeProcessRequest(string CaseNumber, List<string>? DocumentIds);

/// <summary>
/// One explainable risk indicator: what was found, the evidence (with
/// document numbers), where it came from and the points it adds to the score.
/// </summary>
/// <param name="Severity"><c>high</c>, <c>medium</c>, <c>low</c> or <c>info</c> (watch-point).</param>
public record FinCrimeRiskIndicator(string Key, string Title, string Evidence, string Source, int Points, string Severity);

/// <summary>A recommended control for the human investigator.</summary>
public record FinCrimeRecommendedAction(string Action, string Detail, bool RequiresApproval);

/// <summary>
/// HTTP endpoints behind the "Try it out" tab on the Financial Crime Agent page
/// (<c>/agents/financial-crime</c>):
///
/// 1. <c>GET /fincrime/cases</c> — Member Cases held in memory (the five
///    scenario cases plus any opened live by the Onboarding demo).
/// 2. <c>GET /fincrime/cases/{caseNumber}/activity</c> — the account-activity
///    timeline, parties and screening / SVS results for the case.
/// 3. <c>GET /fincrime/samples</c> and <c>GET /fincrime/cases/{caseNumber}/documents</c>
///    — the specimen documents and the ones attached to the case.
/// 4. <c>POST /fincrime/documents/verify</c> — document authenticity (Azure
///    Content Understanding + deterministic checks layer).
/// 5. <c>POST /fincrime/process</c> — engage Felix's Financial Crime Agent with
///    the case, timeline, screening results and document findings; returns an
///    explainable risk score, indicators and recommended controls (streamed
///    over SSE when the client sends <c>Accept: text/event-stream</c>).
///
/// When Foundry or Content Understanding isn't configured, a deterministic
/// assessment built from the scenario data keeps the demo complete.
/// </summary>
public static class FinancialCrimeApi
{
    private const int Baseline = 5;

    // Victorian public holidays near the demo dates (business-day maths for SMRs).
    private static readonly HashSet<DateTime> PublicHolidays =
    [
        new(2026, 11, 3), new(2026, 12, 25), new(2026, 12, 28), new(2027, 1, 1), new(2027, 1, 26),
    ];

    private static readonly Regex PressureRegex = new(
        @"\burgent\b|as (?:soon|urgently|quickly) as possible|investment opportunity that closes next week|closes next week|(?:please )?(?:do not|don't) call my old number|can only be contacted on my new (?:mobile|number|email)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static void MapFinancialCrimeEndpoints(
        this WebApplication app,
        CaseStore store,
        CaldovaAgentFactory factory,
        FinCrimeCaseDocumentStore docStore,
        FinCrimeDocumentVerifier verifier,
        ILogger logger)
    {
        // Cases for the "Pick a case" dropdown.
        app.MapGet("/fincrime/cases", () =>
        {
            var cases = store.All().Select(r =>
            {
                docStore.EnsureCaseAttachments(r.CaseNumber, r.SampleId);
                return new
                {
                    caseNumber = r.CaseNumber,
                    sampleId = r.SampleId,
                    clientName = r.ClientName,
                    clientEmail = r.ClientEmail,
                    clientPhone = r.ClientPhone,
                    memberNumber = r.MemberNumber,
                    product = r.Product,
                    requestType = r.RequestType,
                    receivedDate = r.ReceivedDate,
                    adviserName = r.AdviserName,
                    adviserPractice = r.AdviserPractice,
                    requestSummary = r.RequestSummary,
                    amount = r.Amount,
                    preferredContact = r.PreferredContact,
                    priority = r.Priority,
                    priorityReason = r.PriorityReason,
                    createdAt = r.CreatedAt.ToString("u"),
                    documentCount = docStore.DocumentsForCase(r.CaseNumber).Count,
                };
            });
            return Results.Ok(cases);
        });

        // Account-activity timeline, parties and screening results for a case.
        app.MapGet("/fincrime/cases/{caseNumber}/activity", (string caseNumber) =>
        {
            var record = store.Get(caseNumber);
            if (record is null)
                return Results.NotFound(new { error = $"case '{caseNumber}' not found" });

            var profile = docStore.ProfileFor(record);
            return Results.Ok(new
            {
                caseNumber = record.CaseNumber,
                isScenario = profile.IsScenario,
                verifiedContact = profile.VerifiedContact,
                parties = profile.Parties.Select(p => new
                {
                    name = p.Name,
                    role = p.Role,
                    dateOfBirth = FormatDate(p.DateOfBirth),
                }),
                receivingSmsf = profile.ReceivingSmsf,
                timeline = profile.Timeline,
                screening = profile.Screening,
            });
        });

        // Static manifest of specimen documents (drives the "Add sample docs" popover).
        app.MapGet("/fincrime/samples", () =>
            Results.Ok(docStore.AllSamples().Select(s => new
            {
                id = s.Id,
                label = s.Label,
                kind = s.Kind,
                src = s.Src,
                expected = s.Expected,
                description = s.Description,
            })));

        // Documents attached to a case (seeded per scenario — see FinCrimeCaseDocumentStore).
        app.MapGet("/fincrime/cases/{caseNumber}/documents", (string caseNumber) =>
        {
            var record = store.Get(caseNumber);
            if (record is null)
                return Results.NotFound(new { error = $"case '{caseNumber}' not found" });

            docStore.EnsureCaseAttachments(record.CaseNumber, record.SampleId);
            return Results.Ok(docStore.DocumentsForCase(record.CaseNumber));
        });

        // Scan documents: per-document verdict, reasons and every check performed.
        app.MapPost("/fincrime/documents/verify", async (FinCrimeVerifyRequest request, HttpContext ctx) =>
        {
            if (string.IsNullOrWhiteSpace(request.CaseNumber))
                return Results.BadRequest(new { error = "caseNumber is required" });

            var record = store.Get(request.CaseNumber);
            if (record is null)
                return Results.NotFound(new { error = $"case '{request.CaseNumber}' not found" });

            docStore.EnsureCaseAttachments(record.CaseNumber, record.SampleId);
            var ids = request.DocumentIds ?? docStore.DocumentsForCase(record.CaseNumber).Select(d => d.Id).ToList();
            var samples = docStore.ResolveSamples(ids);
            var documents = await verifier.VerifyAsync(record, samples, useCache: false, ctx.RequestAborted);

            return Results.Ok(new
            {
                caseNumber = record.CaseNumber,
                contentUnderstandingConfigured = verifier.ContentUnderstandingConfigured,
                checkNames = verifier.CheckNames,
                documents,
            });
        });

        // Engage Felix's Financial Crime Agent on the case.
        app.MapPost("/fincrime/process", async (HttpContext httpContext, FinCrimeProcessRequest request) =>
        {
            if (string.IsNullOrWhiteSpace(request.CaseNumber))
                return Results.BadRequest(new { error = "caseNumber is required" });

            var record = store.Get(request.CaseNumber);
            if (record is null)
                return Results.NotFound(new { error = $"case '{request.CaseNumber}' not found" });

            logger.LogInformation("Financial crime review: caseNumber={CaseNumber}", Sanitize(record.CaseNumber));

            // Reuse the documents scanned in step 3 when available; default to the
            // documents attached to the case when the page sends none.
            docStore.EnsureCaseAttachments(record.CaseNumber, record.SampleId);
            var ids = request.DocumentIds ?? docStore.DocumentsForCase(record.CaseNumber).Select(d => d.Id).ToList();
            var samples = docStore.ResolveSamples(ids);
            var documents = await verifier.VerifyAsync(record, samples, useCache: true, httpContext.RequestAborted);

            var profile = docStore.ProfileFor(record);
            var assessment = Assess(record, profile, documents);
            var prompt = BuildAgentPrompt(record, profile, documents);
            string? agentCreateError = null;

            object BuildEnvelope(AgentTraceResult? trace, string? agentError) => new
            {
                caseNumber = record.CaseNumber,
                clientName = record.ClientName,
                riskLevel = assessment.Level,
                riskScore = assessment.Score,
                riskSummary = assessment.Summary,
                indicators = assessment.Indicators,
                checksClear = assessment.ChecksClear,
                actions = assessment.Actions,
                approvalRequired = assessment.ApprovalRequired,
                smrNote = assessment.SmrNote,
                verifiedContact = profile.VerifiedContact,
                timeline = profile.Timeline,
                screening = profile.Screening,
                documents,
                checkNames = verifier.CheckNames,
                contentUnderstandingConfigured = verifier.ContentUnderstandingConfigured,
                agentRiskLevel = ParseAgentLevel(trace?.Text),
                agentRiskScore = ParseAgentScore(trace?.Text),
                agentNotes = trace?.Text,
                agentConfigured = factory.IsConfigured,
                agentError = agentError ?? agentCreateError,
                agentInput = trace?.Input,
                agentRawOutput = trace is null ? null : new
                {
                    text = trace.Text,
                    citations = trace.Citations,
                    outputItems = trace.OutputItems,
                    responseId = trace.ResponseId,
                    durationMs = trace.DurationMs,
                },
            };

            if (AgentSseStreaming.WantsEventStream(httpContext))
            {
                // Creating the agent registers it with Foundry, so it can fail too;
                // the stream then still ends with the deterministic assessment.
                CaldovaAgent? streamingAgent = null;
                if (factory.IsConfigured)
                {
                    try
                    {
                        streamingAgent = factory.Create("fincrime");
                    }
                    catch (Exception ex)
                    {
                        logger.LogWarning(ex, "Financial Crime Agent could not be created; streaming the deterministic assessment only");
                        agentCreateError = ex.Message;
                    }
                }
                await AgentSseStreaming.StreamAsync(httpContext, streamingAgent, prompt, BuildEnvelope, logger, "Financial Crime Agent");
                return Results.Empty;
            }

            AgentTraceResult? traceResult = null;
            string? agentInvocationError = null;
            if (factory.IsConfigured)
            {
                try
                {
                    traceResult = await factory.Create("fincrime").RunWithTraceAsync(prompt);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Financial Crime Agent invocation failed; using the deterministic assessment only");
                    agentInvocationError = ex.Message;
                }
            }

            return Results.Ok(BuildEnvelope(traceResult, agentInvocationError));
        });
    }

    // ── Prompt ──────────────────────────────────────────────────────────────

    /// <summary>
    /// Build the prompt for Felix's agent: the case, the people on it, the
    /// account-activity timeline, screening / SVS results, the document
    /// authenticity findings (numbered so the agent can cite them), the request
    /// email and the scoring rubric that keeps the risk score explainable.
    /// </summary>
    private static string BuildAgentPrompt(
        CaseRecord c,
        FinCrimeCaseProfile profile,
        IReadOnlyList<FinCrimeDocumentVerification> documents)
    {
        var sb = new StringBuilder();
        sb.AppendLine("MEMBER CASE FOR FINANCIAL CRIME REVIEW");
        sb.AppendLine("======================================");
        sb.AppendLine($"Case number: {c.CaseNumber}");
        sb.AppendLine($"Request type: {c.RequestType}");
        sb.AppendLine($"Received: {c.ReceivedDate} (treat this as today's date for any deadlines)");
        sb.AppendLine($"Member / client: {c.ClientName} — {c.MemberNumber} — {c.Product}");
        sb.AppendLine($"Adviser: {(string.IsNullOrWhiteSpace(c.AdviserPractice) ? c.AdviserName : $"{c.AdviserName}, {c.AdviserPractice}")}");
        sb.AppendLine($"Amount: {c.Amount}");
        sb.AppendLine($"Priority at intake: {c.Priority} — {c.PriorityReason}");
        sb.AppendLine($"Contact details we trust for call-backs: {profile.VerifiedContact}");
        sb.AppendLine();
        sb.AppendLine("Request summary (as captured by Onboarding):");
        sb.AppendLine(c.RequestSummary);
        sb.AppendLine();

        sb.AppendLine("PEOPLE ON THE CASE");
        foreach (var p in profile.Parties)
        {
            var dob = FormatDate(p.DateOfBirth);
            sb.AppendLine($"- {p.Name} — {p.Role}{(dob is null ? "" : $" — DOB on file {dob}")}");
        }
        sb.AppendLine();

        sb.AppendLine("ACCOUNT-ACTIVITY TIMELINE (Melbourne time)");
        foreach (var e in profile.Timeline)
            sb.AppendLine($"- {e.When} · {e.Channel} · {e.Summary}. {e.Detail} [{e.Flag}]");
        sb.AppendLine();

        sb.AppendLine("SCREENING & VERIFICATION RESULTS");
        foreach (var s in profile.Screening)
            sb.AppendLine($"- {s.Check}: {s.Result} [{s.Status}]");
        if (profile.ReceivingSmsf is { } smsf)
        {
            sb.AppendLine($"- SMSF named on the request: {smsf.FundName}, ABN {smsf.Abn}, registered {FormatDate(smsf.RegisteredOn)}, ESA {smsf.Esa}");
        }
        sb.AppendLine();

        if (documents.Count > 0)
        {
            sb.AppendLine("DOCUMENT AUTHENTICITY FINDINGS");
            sb.AppendLine("Each document on the case was read by Azure Content Understanding (or from the case-file");
            sb.AppendLine("record when it isn't configured) and scored by a deterministic checks layer. Cite each");
            sb.AppendLine("document by its number.");
            for (var i = 0; i < documents.Count; i++)
            {
                var d = documents[i];
                sb.AppendLine($"Document #{i + 1} — {d.Label} ({d.Kind})");
                sb.AppendLine($"  Verdict: {d.Verdict} · Source: {d.Source}");
                sb.AppendLine($"  Summary: {d.Summary}");
                foreach (var check in d.Checks.Where(x => x.Status is "fail" or "warn"))
                    sb.AppendLine($"  [{check.Status}] {check.Name} — {check.Detail}");
                var passed = d.Checks.Where(x => x.Status == "pass").Select(x => x.Name).ToList();
                if (passed.Count > 0) sb.AppendLine($"  Passed: {string.Join("; ", passed)}");
            }
            sb.AppendLine();
        }

        if (RequestSampleCatalog.FindById(c.SampleId) is { } email)
        {
            sb.AppendLine("REQUEST EMAIL (as received)");
            sb.AppendLine($"From: {email.EmailFrom}");
            sb.AppendLine($"Date: {email.EmailDate}");
            sb.AppendLine($"Subject: {email.EmailSubject}");
            sb.AppendLine(email.EmailBody.Length > 1500 ? email.EmailBody[..1500] + "…" : email.EmailBody);
            sb.AppendLine();
        }

        sb.AppendLine("SCORING RUBRIC (keep the score explainable)");
        sb.AppendLine("Start at 5. Add: contact details changed less than 96 hours before a money-out request +20;");
        sb.AppendLine("new device in a location that contradicts a travel notice +12 (new device elsewhere +6);");
        sb.AppendLine("one-time code sent to a newly changed number +5; SMSF registered less than 30 days before the");
        sb.AppendLine("request +10; failed ATO SMSF verification (SVS) +15; first altered document +15 (+5 each extra);");
        sb.AppendLine("payee name matching neither the member nor the fund +6; urgency or 'don't call my old number'");
        sb.AppendLine("language +4; other document needing verification +6 each (max 12); watch-points: new member +3,");
        sb.AppendLine("member in hardship +4, death benefit paid to claimants +2. High 65+, Medium 35–64, Low under 35.");
        sb.AppendLine("Any altered document puts the case at Medium or above.");
        sb.AppendLine();

        sb.AppendLine("TASK");
        sb.AppendLine("Review this case for financial-crime risk — fraud, scams, identity takeover and AML/CTF. Use the");
        sb.AppendLine("knowledge base (financial-crime red flags & controls guide, rollover and SMSF verification rules,");
        sb.AppendLine("the member's case files) and cite document titles. Produce your six output sections, refer to");
        sb.AppendLine("documents by number, and keep the language neutral — never accuse anyone; the member may be the");
        sb.AppendLine("victim. Only use the trusted contact details above for any call-back. If you recommend an SMR, say");
        sb.AppendLine("it is due within 3 business days of forming the suspicion, that lodging it is a human decision,");
        sb.AppendLine("and that nobody may be tipped off.");
        return sb.ToString();
    }

    // ── Deterministic assessment ────────────────────────────────────────────

    private sealed record Assessment(
        string Level,
        int Score,
        string Summary,
        IReadOnlyList<FinCrimeRiskIndicator> Indicators,
        IReadOnlyList<string> ChecksClear,
        IReadOnlyList<FinCrimeRecommendedAction> Actions,
        string ApprovalRequired,
        string? SmrNote);

    /// <summary>
    /// Explainable risk assessment from the case profile (timeline, SVS,
    /// payees), the request email and the document verdicts. Every point on the
    /// score comes from a named indicator so a human can see exactly why.
    /// </summary>
    private static Assessment Assess(
        CaseRecord c,
        FinCrimeCaseProfile p,
        IReadOnlyList<FinCrimeDocumentVerification> documents)
    {
        var indicators = new List<FinCrimeRiskIndicator>();
        var clear = new List<string>();
        var received = ParseDate(c.ReceivedDate) ?? c.CreatedAt.Date;
        var request = p.Timeline.LastOrDefault(e => e.Type == "request");
        var requestAt = request?.At ?? received;
        var member = p.Parties.FirstOrDefault()?.Name ?? c.ClientName;

        // Contact details changed shortly before money out.
        var change = p.Timeline.LastOrDefault(e => e.Type == "contact-change" && e.At <= requestAt);
        if (p.MoneyOut && change is not null && (requestAt - change.At).TotalHours <= 96)
        {
            var hours = (int)Math.Round((requestAt - change.At).TotalHours);
            indicators.Add(new("contact-change", "Contact details changed shortly before a money-out request",
                $"{change.Summary} on {change.When} — about {hours} hours before the request ({request?.When ?? FormatDate(c.ReceivedDate)}). {change.Detail}",
                "Account activity", 20, "high"));
        }

        // New device, especially somewhere the member isn't.
        var device = p.Timeline.FirstOrDefault(e => e.Type == "new-device");
        var travel = p.Timeline.FirstOrDefault(e => e.Type == "travel-notice");
        if (device is not null)
        {
            var unexpected = travel?.Location is { } away && device.Location is { } seenAt &&
                             !seenAt.Contains(away, StringComparison.OrdinalIgnoreCase);
            indicators.Add(new("new-device",
                unexpected ? "New device in an unexpected location" : "Online access from a new device",
                $"{device.When}: {device.Detail}" + (travel is not null ? $" ({travel.Summary}.)" : string.Empty),
                "Account activity", unexpected ? 12 : 6, unexpected ? "high" : "medium"));
        }

        var mfa = p.Timeline.FirstOrDefault(e => e.Type == "mfa" && e.Flag == "red");
        if (mfa is not null)
        {
            indicators.Add(new("mfa", "One-time code sent to a newly changed number",
                $"{mfa.When}: {mfa.Detail}", "Account activity", 5, "medium"));
        }

        // SMSF red flags.
        if (p.ReceivingSmsf is { } smsf)
        {
            if (ParseDate(smsf.RegisteredOn) is { } registered)
            {
                var days = (requestAt.Date - registered).Days;
                if (days is >= 0 and <= 30)
                {
                    indicators.Add(new("new-smsf", "Rollover to a newly registered SMSF",
                        $"'{smsf.FundName}' (ABN {smsf.Abn}) was registered on {Dmy(registered)} — {days} days before the request. Setting up an SMSF to receive someone else's benefits is a known AUSTRAC / ATO indicator.",
                        "Request & SMSF details", 10, "high"));
                }
            }

            var failed = new List<string>();
            if (!smsf.AbnIsRegisteredSmsf) failed.Add("the ABN is not a registered SMSF");
            if (!smsf.MemberTfnLinked) failed.Add($"{FirstName(member)}'s TFN is not linked to the fund");
            if (!smsf.BankDetailsMatch) failed.Add("the bank details don't match");
            if (!smsf.EsaMatches) failed.Add("the ESA doesn't match");
            if (failed.Count > 0)
            {
                indicators.Add(new("svs", "ATO SMSF verification (SVS) failed",
                    $"{Capitalise(string.Join(", ", failed))}. A rollover to an SMSF can't proceed until SVS passes (SIS reg 6.33E).",
                    "ATO SVS result", 15, "high"));
            }
            else
            {
                clear.Add("ATO SMSF verification (SVS) passed.");
            }
        }
        else if (string.Equals(c.RequestType, RequestTypes.RolloverOutSmsf, StringComparison.OrdinalIgnoreCase))
        {
            indicators.Add(new("svs-pending", "Rollover to an SMSF — verification not yet run",
                "No ATO SMSF verification (SVS) result is on this case. It must pass — member's TFN linked, bank details and ESA matching — before any money moves.",
                "Request type", 15, "medium"));
        }

        // Payee names.
        var mismatched = p.RequestedPayees
            .Where(n => !p.AcceptedAccountNames.Any(a => NamesMatch(n, a)))
            .ToList();
        if (mismatched.Count > 0)
        {
            var fund = p.ReceivingSmsf is { } s ? $" or the SMSF ('{s.FundName}')" : string.Empty;
            indicators.Add(new("payee", "Payee name doesn't match the member or the fund",
                $"The request pays an account named '{string.Join("', '", mismatched)}' — not {member}{fund}.",
                "Request", 6, "medium"));
        }

        // Pressure / channel-steering language in the request email.
        var email = RequestSampleCatalog.FindById(c.SampleId);
        if (p.MoneyOut && email is not null)
        {
            var phrases = PressureRegex.Matches($"{email.EmailSubject}\n{email.EmailBody}")
                .Select(m => m.Value.Trim().TrimEnd(',', '-', ' '))
                .Where(v => v.Length > 0)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Take(4)
                .ToList();
            if (phrases.Count > 0)
            {
                indicators.Add(new("pressure", "Urgency and 'don't use my old details' language",
                    $"The request email says {string.Join(", ", phrases.Select(x => $"'{x}'"))} — pressure to act fast and steering away from known contact details are common scam indicators.",
                    "Request email", 4, "low"));
            }
        }

        // Documents.
        var numbered = documents.Select((d, i) => (Doc: d, No: i + 1)).ToList();
        var fakes = numbered.Where(x => x.Doc.Verdict == "fake").ToList();
        if (fakes.Count > 0)
        {
            indicators.Add(new("document-altered",
                fakes.Count == 1
                    ? $"Altered {KindLabel(fakes[0].Doc.Kind)} (Document #{fakes[0].No})"
                    : $"{fakes.Count} documents show signs of alteration",
                string.Join(" ", fakes.Select(x => $"Document #{x.No} ({x.Doc.Label}): {x.Doc.Summary}")),
                string.Join(", ", fakes.Select(x => $"Document #{x.No}")),
                15 + 5 * (fakes.Count - 1), "high"));
        }

        var extraDocPoints = 0;
        foreach (var (doc, no) in numbered.Where(x => x.Doc.Verdict == "suspicious"))
        {
            var target = doc.Kind switch
            {
                "bank-statement" => "payee",
                "smsf-registration" => "new-smsf",
                _ => null,
            };
            var index = target is null ? -1 : indicators.FindIndex(x => x.Key == target);
            if (index < 0 && doc.Kind == "smsf-registration") index = indicators.FindIndex(x => x.Key == "svs");
            if (index >= 0)
            {
                var existing = indicators[index];
                indicators[index] = existing with
                {
                    Evidence = $"{existing.Evidence} See Document #{no}: {doc.Summary}",
                    Source = $"{existing.Source}, Document #{no}",
                };
            }
            else
            {
                var points = Math.Min(6, 12 - extraDocPoints);
                extraDocPoints += points;
                indicators.Add(new($"document-review-{no}", $"Document needs verification — {doc.Label}",
                    $"Document #{no}: {doc.Summary}", $"Document #{no}", points, "medium"));
            }
        }
        foreach (var (doc, no) in numbered.Where(x => x.Doc.Verdict == "legit"))
            clear.Add($"Document #{no} ({doc.Label}) — consistent with a genuine document.");

        // Watch-points by request type.
        switch (c.RequestType)
        {
            case RequestTypes.NewAccount:
                indicators.Add(new("new-member", "Watch-point: new relationship, no account history yet",
                    "Normal for a new member — there's no behaviour to compare against, so identity verification and PEP / sanctions screening carry the weight.",
                    "Request type", 3, "info"));
                break;
            case RequestTypes.FinancialHardship:
                indicators.Add(new("hardship", "Watch-point: member in financial hardship",
                    "Not a concern about the member. People in hardship are targeted by illegal early-release promoters, so include scam-awareness information and watch for a follow-up rollover to an SMSF (an AUSTRAC indicator).",
                    "Request type", 4, "info"));
                break;
            case RequestTypes.DeathBenefit:
                indicators.Add(new("claimants", "Watch-point: benefit paid to claimants, not the member",
                    "Death benefits can attract impersonation, so the death certificate, the claimants' IDs and their payment accounts are checked before payment.",
                    "Request type", 2, "info"));
                break;
        }

        // Screening hits (SVS is scored above) and the clear results.
        foreach (var s in p.Screening)
        {
            if (s.Check.StartsWith("SVS", StringComparison.OrdinalIgnoreCase)) continue;
            if (s.Status == "fail")
                indicators.Add(new("screening", $"Screening match — {s.Check}", s.Result, "Screening", 20, "high"));
            else if (s.Status == "pass")
                clear.Add($"{s.Check}: {s.Result}.");
        }
        foreach (var e in p.Timeline.Where(e => e.Flag == "ok" && e.Type == "check"))
        {
            var line = $"{e.Summary}.";
            if (!clear.Contains(line)) clear.Add(line);
        }

        var score = Math.Clamp(Baseline + indicators.Sum(x => x.Points), 1, 99);
        if (fakes.Count > 0 && score < 40) score = 40;
        var level = score >= 65 ? "High" : score >= 35 ? "Medium" : "Low";

        var first = FirstName(member);
        var smrDue = AddBusinessDays(received, 3);
        var concerns = indicators.Where(x => x.Severity is not "info").ToList();
        var strongest = concerns.OrderByDescending(x => x.Points).Take(5).Select(x => LowerFirst(x.Title));
        var summary = level switch
        {
            "High" =>
                $"High risk ({score}/100). {concerns.Count} indicators match patterns AUSTRAC and the ATO warn super funds about — the strongest: " +
                string.Join("; ", strongest) +
                $". Recommend holding the request and contacting {first} only on the details we already trust — {first} is most likely the victim, not a suspect.",
            "Medium" =>
                $"Medium risk ({score}/100). Some indicators need verifying before the request continues — " +
                string.Join("; ", strongest.Take(4)) +
                $". Verify with {first} on the contact details already on file; other checks can continue in parallel.",
            _ => $"Low risk ({score}/100). " + LowRiskSummary(c, p),
        };

        var actions = BuildActions(level, c, p, change, smrDue, received);
        var approval = level switch
        {
            "High" => "Yes — holding or blocking the request, locking online access, contacting the member about suspected fraud and lodging an SMR are human decisions. Felix reviews the evidence; the Team Leader approves the block.",
            "Medium" => "Yes — delaying the request on financial-crime grounds needs human approval. Verification calls on the trusted contact details and document requests can go ahead.",
            _ => "No financial-crime decision needed — the result is recorded on the case. Other approvals on this case stay with the relevant team.",
        };
        var smrNote = level switch
        {
            "High" => $"SMR consideration: if a suspicion is formed, a suspicious matter report to AUSTRAC is due within 3 business days — by {LongDate(smrDue)} if formed on {LongDate(received)}. Lodging it is a human decision, and nobody may be tipped off.",
            "Medium" => "No SMR at this stage — reassess once the member has been verified.",
            _ => null,
        };

        return new Assessment(level, score, summary, indicators, clear, actions, approval, smrNote);
    }

    private static string LowRiskSummary(CaseRecord c, FinCrimeCaseProfile p) => c.RequestType switch
    {
        RequestTypes.NewAccount =>
            "Identity verified electronically and no PEP or sanctions match — KYC/AML screening is clear.",
        RequestTypes.DeathBenefit =>
            "The death certificate and the claimants' IDs are genuine and each payment account is in the claimant's own name — no extra checks, so the family isn't asked for anything more.",
        RequestTypes.FinancialHardship =>
            "The hardship documents are genuine and the payment account is in the member's legal name. Include scam-awareness information — people in hardship are targeted by illegal early-release schemes.",
        RequestTypes.PensionCommencement =>
            "No financial-crime concerns — pension payments go to the nominated account on file and nothing has changed recently.",
        _ => p.IsScenario
            ? "No elevated indicators — continue along the standard path."
            : "No elevated indicators in the information on this case — continue along the standard path with routine checks.",
    };

    private static List<FinCrimeRecommendedAction> BuildActions(
        string level,
        CaseRecord c,
        FinCrimeCaseProfile p,
        FinCrimeActivityEvent? change,
        DateTime smrDue,
        DateTime received)
    {
        var first = FirstName(p.Parties.FirstOrDefault()?.Name ?? c.ClientName);
        var actions = new List<FinCrimeRecommendedAction>();

        if (level == "High")
        {
            actions.Add(new("Hold the request",
                p.ReceivingSmsf is not null
                    ? "Don't process the rollover. The 3-business-day SuperStream clock only runs once all required information is received — a failed SMSF verification means it hasn't."
                    : "Don't release any money until the member has been verified.",
                true));
            actions.Add(new("Lock online access",
                change is not null
                    ? $"Suspend online access and treat the contact-detail change on {Dmy(change.At)} as unverified until {first} confirms it."
                    : $"Suspend online access until {first} has been verified.",
                true));
            actions.Add(new("Call back on the verified number",
                $"Contact {first} only on {p.VerifiedContact} — never the number or email supplied after the change.",
                true));
            actions.Add(new("Restore and support",
                $"If {first} didn't make the request: reset the online credentials, restore the verified contact details and offer a referral to IDCARE, Australia's free identity and cyber support service.",
                false));
            actions.Add(new("Stop the money at every step",
                "Ask Transfers & Rollovers to cancel the request with the receiving fund and Payments to confirm no money leaves the account.",
                false));
            actions.Add(new("Consider an SMR to AUSTRAC",
                $"If a suspicion is formed, the suspicious matter report is due within 3 business days — by {LongDate(smrDue)} if formed on {LongDate(received)}. Lodging it is a human decision; keep it confidential (no tipping off).",
                true));
            actions.Add(new("Prepare reassuring, neutral wording",
                $"Ask Client Communications to draft the call script and letter — calm, plain English, no accusation. {first} is most likely the victim.",
                true));
            return actions;
        }

        if (level == "Medium")
        {
            actions.Add(new("Verify before continuing",
                $"Confirm the request with {first} on {p.VerifiedContact} before any money moves.",
                false));
            actions.Add(new("Resolve the document findings",
                "Ask for a certified copy or the original of any document flagged for review, and re-check it.",
                false));
            if (string.Equals(c.RequestType, RequestTypes.RolloverOutSmsf, StringComparison.OrdinalIgnoreCase) && p.ReceivingSmsf is null)
            {
                actions.Add(new("Run the ATO SMSF verification service",
                    "Before any rollover to an SMSF, SVS must confirm the member's TFN is linked and the bank details and ESA match.",
                    false));
            }
            actions.Add(new("Re-score after verification",
                "Update the case with the outcome; hold the request only with human approval.",
                true));
            return actions;
        }

        actions.Add(new("Record the result on the case",
            $"Note the screening and document results on {c.CaseNumber} and release it to the next team.",
            false));
        switch (c.RequestType)
        {
            case RequestTypes.NewAccount:
                actions.Add(new("Standard new-member monitoring",
                    "Alert on contact-detail or bank-account changes in the first 90 days, with step-up (SMS code) verification.",
                    false));
                break;
            case RequestTypes.DeathBenefit:
                actions.Add(new("Pay only to the claimants' own accounts",
                    $"Payments go only to accounts in the claimants' own names ({string.Join(" and ", p.RequestedPayees.DefaultIfEmpty("as nominated"))} — confirmed). No call-back or extra documents needed — keep it low-friction for the family.",
                    false));
                break;
            case RequestTypes.FinancialHardship:
                actions.Add(new("Include scam-awareness information",
                    "Ask Client Communications to mention that Caldova never charges a fee to release super early and to be wary of 'early access' offers — illegal early-release promoters target people in hardship.",
                    false));
                actions.Add(new("Watch for a follow-up SMSF rollover",
                    "A hardship request followed by a rollover to an SMSF is an AUSTRAC indicator — flag any such request for review.",
                    false));
                break;
            case RequestTypes.PensionCommencement:
                actions.Add(new("Keep the standard payment controls",
                    "Pension payments go to the nominated account on file; any change of bank details needs step-up verification and a call-back on the number on file.",
                    false));
                break;
            default:
                actions.Add(new("Continue along the standard path",
                    "No financial-crime action needed beyond routine monitoring.",
                    false));
                break;
        }
        return actions;
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private static DateTime AddBusinessDays(DateTime start, int days)
    {
        var date = start.Date;
        var added = 0;
        while (added < days)
        {
            date = date.AddDays(1);
            if (date.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday || PublicHolidays.Contains(date)) continue;
            added++;
        }
        return date;
    }

    private static int? ParseAgentScore(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        var m = Regex.Match(text, @"\b(\d{1,3})\s*(?:/|out of)\s*100\b", RegexOptions.IgnoreCase);
        return m.Success && int.TryParse(m.Groups[1].Value, out var v) && v <= 100 ? v : null;
    }

    private static string? ParseAgentLevel(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        var section = Regex.Match(text, @"Risk Score[^\n]*(\n[^\n]*){0,3}", RegexOptions.IgnoreCase);
        var scope = section.Success ? section.Value : text;
        var m = Regex.Match(scope, @"\b(High|Medium|Low)\b", RegexOptions.IgnoreCase);
        return m.Success ? CultureInfo.InvariantCulture.TextInfo.ToTitleCase(m.Value.ToLowerInvariant()) : null;
    }

    private static DateTime? ParseDate(string? raw) =>
        DateTime.TryParseExact(raw, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d)
            ? d
            : null;

    private static string? FormatDate(string? iso) =>
        ParseDate(iso) is { } d ? Dmy(d) : iso;

    private static string Dmy(DateTime d) => d.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);

    private static string LongDate(DateTime d) => d.ToString("ddd d MMM yyyy", CultureInfo.InvariantCulture);

    private static string KindLabel(string kind) => kind switch
    {
        "driver-licence" => "driver licence",
        "bank-statement" => "bank statement",
        "smsf-registration" => "SMSF registration extract",
        "death-certificate" => "death certificate",
        "income-support-letter" => "income support letter",
        _ => kind.Replace('-', ' '),
    };

    private static bool NamesMatch(string a, string b)
    {
        static string Norm(string s) => Regex.Replace(s.ToLowerInvariant(), @"[^a-z0-9&]+", " ").Trim();
        return Norm(a) == Norm(b);
    }

    private static string FirstName(string name) =>
        name.Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? name;

    private static string LowerFirst(string s) =>
        string.IsNullOrEmpty(s) || (s.Length > 1 && char.IsUpper(s[1]))
            ? s
            : char.ToLowerInvariant(s[0]) + s[1..];

    private static string Capitalise(string s) =>
        string.IsNullOrEmpty(s) ? s : char.ToUpperInvariant(s[0]) + s[1..];

    private static string Sanitize(string value) =>
        value.Replace('\r', ' ').Replace('\n', ' ');
}
