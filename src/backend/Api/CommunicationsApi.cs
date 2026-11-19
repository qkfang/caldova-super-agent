using System.Text;
using System.Text.RegularExpressions;
using CaldovaSuper.Agents;
using CaldovaSuper.App.Services;

namespace CaldovaSuper.App.Api;

record CommunicationsProcessRequest(string CaseNumber);

record CommunicationsVoiceRequest(string Message, string? CaseNumber, string? PreviousResponseId);

/// <summary>
/// HTTP endpoints behind the "Try it out" and "Voice chat" tabs on the Client
/// Communications agent page (<c>/agents/client-communications</c>).
///
/// The flow:
///
/// 1. List the Member Cases held in <see cref="CaseStore"/> (the five seeded
///    scenario cases plus any opened live by the Onboarding demo) so the user
///    can pick one.
/// 2. Engage the Client Communications Agent (Cara) on the selected case. The
///    page always receives Cara's deterministic case summary and drafts from
///    <see cref="ClientCommunicationsDrafter"/> — member letter/email, adviser
///    update (when the account has an adviser) and SMS, each with tone and
///    compliance notes — and, when Foundry is configured, the live agent's
///    streamed narrative as well.
/// 3. A typed "talk to Cara" endpoint used by the Voice chat tab whenever the
///    real-time Voice Live connection isn't available: the live voice agent
///    answers when Foundry is configured, otherwise a deterministic,
///    case-aware spoken-style reply is returned.
/// </summary>
public static class CommunicationsApi
{
    public static void MapCommunicationsEndpoints(
        this WebApplication app,
        CaseStore store,
        CaldovaAgentFactory factory,
        ILogger logger)
    {
        // Lightweight list for the case pickers (Try it out + Voice chat),
        // most recent first.
        app.MapGet("/communications/cases", () =>
        {
            var cases = store.All().Select(c => new
            {
                caseNumber = c.CaseNumber,
                clientName = c.ClientName,
                requestType = c.RequestType,
                memberNumber = c.MemberNumber,
                adviserName = c.AdviserName,
                priority = c.Priority,
                createdAt = c.CreatedAt
            });
            return Results.Ok(cases);
        });

        // Full Member Case record for a single case.
        app.MapGet("/communications/cases/{caseNumber}", (string caseNumber) =>
        {
            var record = store.Get(caseNumber);
            return record is null
                ? Results.NotFound(new { error = $"case '{caseNumber}' not found" })
                : Results.Ok(record);
        });

        // Engage Cara on the selected case. Deterministic drafts are always
        // produced server-side so the demo completes end-to-end; when Foundry
        // is configured the live agent is invoked too and its narrative is
        // returned in `agentNotes` (streamed as SSE `delta` events when the
        // client sends `Accept: text/event-stream`).
        app.MapPost("/communications/process", async (HttpContext httpContext, CommunicationsProcessRequest request) =>
        {
            if (string.IsNullOrWhiteSpace(request.CaseNumber))
                return Results.BadRequest(new { error = "caseNumber is required" });

            var record = store.Get(request.CaseNumber);
            if (record is null)
                return Results.NotFound(new { error = $"case '{request.CaseNumber}' not found" });

            logger.LogInformation("Communications process: caseNumber={CaseNumber}", Sanitize(record.CaseNumber));

            var bundle = ClientCommunicationsDrafter.Build(record);
            var prompt = BuildDraftingPrompt(record, bundle);

            object BuildEnvelope(AgentTraceResult? trace, string? agentError) => new
            {
                caseNumber = record.CaseNumber,
                clientName = record.ClientName,
                requestType = record.RequestType,
                memberNumber = record.MemberNumber,
                priority = record.Priority,
                adviserName = record.AdviserName,
                stage = bundle.Stage,
                outcome = bundle.Outcome,
                summary = bundle.Summary,
                vulnerabilityFlags = bundle.VulnerabilityFlags,
                humanApprovalRequired = bundle.HumanApprovalRequired,
                humanApprovalReason = bundle.HumanApprovalReason,
                drafts = bundle.Drafts,
                adviserNote = bundle.AdviserNote,
                agentNotes = trace?.Text,
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

            if (AgentSseStreaming.WantsEventStream(httpContext))
            {
                CaldovaAgent? streamingAgent = null;
                string? createError = null;
                if (factory.IsConfigured)
                {
                    try
                    {
                        streamingAgent = factory.Create("communications");
                    }
                    catch (Exception ex)
                    {
                        logger.LogWarning(ex, "Client Communications Agent could not be created; using deterministic drafts");
                        createError = ex.Message;
                    }
                }
                await AgentSseStreaming.StreamAsync(
                    httpContext,
                    streamingAgent,
                    prompt,
                    (trace, error) => BuildEnvelope(trace, error ?? createError),
                    logger,
                    "Client Communications Agent");
                return Results.Empty;
            }

            AgentTraceResult? traceResult = null;
            string? agentInvocationError = null;
            if (factory.IsConfigured)
            {
                try
                {
                    var agent = factory.Create("communications");
                    traceResult = await agent.RunWithTraceAsync(prompt);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Client Communications Agent invocation failed; falling back to deterministic drafts");
                    agentInvocationError = ex.Message;
                }
            }

            return Results.Ok(BuildEnvelope(traceResult, agentInvocationError));
        });

        // Typed "talk to Cara" endpoint behind the Voice chat tab. Used when
        // the real-time Voice Live call isn't connected (or isn't configured):
        // the browser sends the caller's words, gets a short spoken-style
        // reply, and can read it aloud with the Web Speech API. With Foundry
        // configured the conversational voice agent answers (chaining turns
        // via previousResponseId); otherwise a deterministic, case-aware reply
        // keeps the demo working end-to-end.
        app.MapPost("/communications/voice", async (CommunicationsVoiceRequest request) =>
        {
            if (string.IsNullOrWhiteSpace(request.Message))
                return Results.BadRequest(new { error = "message is required" });

            CaseRecord? record = string.IsNullOrWhiteSpace(request.CaseNumber)
                ? null
                : store.Get(request.CaseNumber);

            logger.LogInformation(
                "Communications voice: caseNumber={CaseNumber}, chained={Chained}",
                Sanitize(request.CaseNumber ?? "(none)"),
                !string.IsNullOrWhiteSpace(request.PreviousResponseId));

            string reply;
            string? responseId = null;
            var agentUsed = false;

            if (factory.IsConfigured)
            {
                try
                {
                    var agent = factory.Create("communications-voice");
                    AgentTraceResult result;
                    if (!string.IsNullOrWhiteSpace(request.PreviousResponseId))
                    {
                        try
                        {
                            result = await agent.ChatWithTraceAsync(request.PreviousResponseId!, request.Message);
                        }
                        catch (Exception ex)
                        {
                            logger.LogInformation(ex, "Voice chat chaining failed; starting a fresh turn");
                            result = await agent.RunWithTraceAsync(BuildVoicePrompt(record, request.Message));
                        }
                    }
                    else
                    {
                        result = await agent.RunWithTraceAsync(BuildVoicePrompt(record, request.Message));
                    }

                    reply = StripMarkdown(result.Text);
                    responseId = result.ResponseId;
                    agentUsed = !string.IsNullOrWhiteSpace(reply);
                    if (!agentUsed) reply = FallbackVoiceReply(request.Message, record);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Client Communications voice agent invocation failed; using the scripted reply");
                    reply = FallbackVoiceReply(request.Message, record);
                }
            }
            else
            {
                reply = FallbackVoiceReply(request.Message, record);
            }

            return Results.Ok(new
            {
                reply,
                responseId,
                agentConfigured = factory.IsConfigured,
                agentUsed
            });
        });
    }

    // ── Prompts ───────────────────────────────────────────────────────────────
    private static string BuildDraftingPrompt(CaseRecord r, ClientCommunicationsDrafter.DraftBundle bundle)
    {
        var isScenario = ClientCommunicationsDrafter.IsScenarioCase(r);
        var sample = isScenario ? (r.SampleId ?? string.Empty).ToLowerInvariant() : string.Empty;
        var type = (r.RequestType ?? string.Empty).ToLowerInvariant();
        var hasAdviser = ClientCommunicationsDrafter.HasAdviser(r);
        var sb = new StringBuilder();

        sb.AppendLine("MEMBER CASE FOR CLIENT COMMUNICATIONS");
        sb.AppendLine("=====================================");
        sb.AppendLine($"Case number    : {r.CaseNumber}");
        sb.AppendLine($"Client         : {r.ClientName}");
        sb.AppendLine($"Email / phone  : {r.ClientEmail} / {r.ClientPhone}");
        sb.AppendLine($"Preferred      : {r.PreferredContact}");
        sb.AppendLine($"Member number  : {r.MemberNumber}");
        sb.AppendLine($"Product        : {r.Product}");
        sb.AppendLine($"Request type   : {r.RequestType}");
        sb.AppendLine($"Received       : {r.ReceivedDate}");
        sb.AppendLine($"Adviser        : {(hasAdviser ? $"{r.AdviserName} ({r.AdviserPractice})" : "None (direct member)")}");
        sb.AppendLine($"Amount         : {r.Amount}");
        sb.AppendLine($"Priority       : {r.Priority} — {r.PriorityReason}");
        sb.AppendLine($"Request summary: {r.RequestSummary}");
        sb.AppendLine();
        sb.AppendLine("CASE FILE NOTES (what has happened so far — use only these facts)");
        sb.AppendLine("-----------------------------------------------------------------");
        sb.AppendLine($"Stage          : {bundle.Stage}");
        sb.AppendLine($"Outcome        : {bundle.Outcome}");
        sb.AppendLine($"What happened  : {bundle.Summary.WhatHappened}");
        sb.AppendLine("What's next    :");
        foreach (var step in bundle.Summary.WhatsNext) sb.AppendLine($"- {step}");
        if (bundle.VulnerabilityFlags.Count > 0)
        {
            sb.AppendLine("Vulnerability  :");
            foreach (var flag in bundle.VulnerabilityFlags) sb.AppendLine($"- {flag}");
        }
        sb.AppendLine();
        sb.AppendLine("TASK");
        sb.AppendLine("----");
        sb.AppendLine("Write the communications for this case as Cara:");
        sb.AppendLine("1. Case summary — the member's likely sentiment, what happened and what happens next (3–5 lines).");
        sb.AppendLine(sample == "death-benefit-robert"
            ? "2. Member letters — a separate condolence letter to each beneficiary (Robert and Lily)."
            : "2. Member letter or email.");
        sb.AppendLine(hasAdviser
            ? $"3. Adviser update for {r.AdviserName} ({r.AdviserPractice}) in adviser language."
            : "3. No adviser on this account — say so and skip the adviser update.");
        sb.AppendLine("4. An SMS (aim for under 160 characters, no sensitive details).");
        sb.AppendLine("For each draft give Channel & Audience, Draft Message, Tone & Compliance Check and Human Approval Required.");
        sb.AppendLine("Compliance must cover: no personal financial advice; next steps; timeframes; contact details " +
                      "(Caldova Client Services 1300 975 707); complaint rights — Caldova's internal dispute resolution first, then AFCA " +
                      "(1800 931 678, www.afca.org.au).");
        switch (sample)
        {
            case "hardship-tom":
                sb.AppendLine("Hardship: be kind and non-judgemental; explain why $10,000 is the legal maximum; include the National Debt Helpline " +
                              "(1800 007 007) and Moneysmart (www.moneysmart.gov.au).");
                break;
            case "rollover-grace":
                sb.AppendLine("Fraud victim: lead with reassurance that her money is safe; contact only via the pre-change verified details " +
                              "(grace.williams@example.com, 0491 570 157); include IDCARE (1800 595 160); NEVER mention an SMR, AUSTRAC or any report.");
                break;
            case "death-benefit-robert":
                sb.AppendLine("Bereavement: condolences first, plain-English explanation of the 17% withholding, one named contact, " +
                              "and the adviser update only with the family's consent.");
                break;
            case "onboarding-priya":
                sb.AppendLine("Include the insurance-loss warning (Southern Cross $520,000 Death & TPD cover ends on rollover) and the " +
                              "nomination re-sign request; give the employer details (USI CDV0101AU).");
                break;
            case "pension-george":
                sb.AppendLine("Celebrate the retirement; give the payment schedule ($6,500 monthly from 15/12/2026), the $38,870 minimum " +
                              "for 2026-27 and, for the adviser, the $850,000 remaining transfer balance cap space.");
                break;
            default:
                // A case opened live: acknowledge receipt, set expectations and
                // match the tone to the request type — no decision exists yet.
                sb.AppendLine("This case has just been received — acknowledge it, explain what happens next and don't pre-empt any decision.");
                if (type.Contains("hardship"))
                    sb.AppendLine("Hardship: be kind and non-judgemental and include the National Debt Helpline (1800 007 007) and Moneysmart.");
                else if (type.Contains("death"))
                    sb.AppendLine("Bereavement: condolences first, plain English and one named contact.");
                else if (type.Contains("smsf") || type.Contains("rollover"))
                    sb.AppendLine("Rollover out: write only to the verified contact details on file, invite the member to call if they didn't " +
                                  "make the request, and never discuss any suspicion with the requester.");
                break;
        }
        sb.AppendLine("Use only the facts above — never invent amounts or dates. Mask TFNs and bank account numbers.");
        return sb.ToString();
    }

    private static string BuildVoicePrompt(CaseRecord? record, string message)
    {
        var sb = new StringBuilder();
        sb.AppendLine("You are Cara from Caldova Wealth, speaking with a caller on a voice call. Reply in two to four short, warm, " +
                      "plain-English sentences — no markdown, lists or headings. Never invent case facts; if you don't know, say " +
                      "you'll check and follow up. Never give personal financial advice.");
        sb.AppendLine();
        if (record is not null)
        {
            var bundle = ClientCommunicationsDrafter.Build(record);
            sb.AppendLine("CALLER & CASE CONTEXT (the caller's identity has already been verified — do not read this aloud):");
            sb.AppendLine($"Case number   : {record.CaseNumber}");
            sb.AppendLine($"Caller        : {record.ClientName}");
            sb.AppendLine($"Member number : {record.MemberNumber}");
            sb.AppendLine($"Request type  : {record.RequestType}");
            sb.AppendLine($"Stage         : {bundle.Stage}");
            sb.AppendLine($"What happened : {bundle.Summary.WhatHappened}");
            sb.AppendLine("What's next   : " + string.Join(" ", bundle.Summary.WhatsNext));
            sb.AppendLine();
        }
        sb.AppendLine("CALLER SAID:");
        sb.AppendLine(message);
        return sb.ToString();
    }

    // ── Deterministic voice replies ───────────────────────────────────────────
    private static string FallbackVoiceReply(string message, CaseRecord? record)
    {
        var intent = DetectIntent(message);
        if (record is null) return GenericReply(intent);

        if (ClientCommunicationsDrafter.IsScenarioCase(record))
        {
            var caseReply = CaseReply(record, intent);
            if (caseReply is not null) return caseReply;
        }

        var first = ClientCommunicationsDrafter.FirstName(record.ClientName);
        if (intent is "status" or "general" or "greeting")
        {
            var condolence = (record.RequestType ?? string.Empty).Contains("death", StringComparison.OrdinalIgnoreCase)
                ? "I'm so sorry for your loss. "
                : string.Empty;
            return $"Hi {first}, it's Cara from Caldova. {condolence}Your request, {record.CaseNumber}, is with our team now, and we'll be in " +
                   "touch as soon as there's an update — there's nothing you need to do right now. Is there anything I can help with in the meantime?";
        }
        return $"Hi {first}. " + GenericReply(intent);
    }

    private static string DetectIntent(string message)
    {
        var t = (message ?? string.Empty).ToLowerInvariant().Replace('’', '\'');
        bool Any(params string[] words) => words.Any(w => t.Contains(w));

        if (Any("changed my", "change my details", "someone changed", "hacked", "scam", "fraud", "didn't ask",
                "did not ask", "not me", "suspicious", "stolen", "identity"))
            return "security";
        if (Any("passed away", "passed", "died", "death", "funeral", "deceased", "estate"))
            return "bereavement";
        if (Any("hardship", "bills", "struggling", "mortgage", "can't afford", "cannot afford", "behind on",
                "centrelink", "jobseeker", "early access", "access my super", "withdraw"))
            return "hardship";
        if (Any("pension", "retire", "income stream"))
            return "pension";
        if (Any("consolidate", "combine", "scattered", "old jobs", "old super", "super accounts", "other fund", "one account",
                "roll over", "rollover", "move my super"))
            return "consolidate";
        if (Any("mum", "mother", "dad", "father", "parent"))
            return "family";
        if (Any("status", "update", "what's happening", "whats happening", "where is", "where's", "how long", "when will"))
            return "status";
        if (Any("hello", "hi ", "hey", "good morning", "good afternoon", "g'day"))
            return "greeting";
        return "general";
    }

    // Case-aware replies once the caller has been verified against a case.
    // Returns null when the caller's question doesn't fit the case, so the
    // generic answer for that topic is used instead.
    private static string? CaseReply(CaseRecord record, string intent)
    {
        var generalOrStatus = intent is "status" or "general" or "greeting";
        switch ((record.SampleId ?? string.Empty).ToLowerInvariant())
        {
            case "onboarding-priya" when generalOrStatus || intent == "consolidate":
                return "Hi Priya, it's Cara from Caldova. Your new Caldova Super account, CS-2049817, is open and invested in the Growth portfolio from Hannah's advice. " +
                       "We've asked Harbourline to send your super across, which should arrive within about three business days, and we're holding your Southern Cross account " +
                       "until you and Hannah confirm you're happy for its $520,000 of insurance cover to end. The only other thing is your nomination for Arjun — it needs a " +
                       "second witness, so Hannah has a fresh form for you.";
            case "rollover-grace" when generalOrStatus || intent is "security" or "family":
                return "Grace, I'm so glad you called, and I'm sorry you've had this worry while you're away. Your super is safe — the request to move your $612,400 " +
                       "was stopped, and no money has left your account. We've put your previous contact details back and locked your online access, and a specialist " +
                       "will call you on 0491 570 157 to set you up again — that's the only number we'll use. IDCARE can also help you, free, on 1800 595 160.";
            case "pension-george" when generalOrStatus || intent == "pension":
                return "Hi George, congratulations again on your retirement. Your Caldova Pension started on the 16th of November, and you'll receive $6,500 a month " +
                       "from the 15th of December — tax-free, so nothing is taken out. This year's minimum is $38,870, and your payments are comfortably above it. " +
                       "Would you like me to explain anything about the payments?";
            case "hardship-tom" when generalOrStatus || intent == "hardship":
                return "Hi Tom, thanks for calling — I know this hasn't been easy. We've approved $10,000 before tax, which is the most the law allows for a hardship " +
                       "release in any twelve months, and $7,932 will reach your account on Friday the 13th of November after tax. If it would help, the National Debt " +
                       "Helpline on 1800 007 007 offers free financial counselling. Is there anything I can explain for you?";
            case "death-benefit-robert" when generalOrStatus || intent is "bereavement" or "family":
                return "Robert, I'm so sorry about your mum. Her binding nomination is valid, so her pension has been paid exactly as she wished — half to you and half " +
                       "to Lily, $217,477.26 each after tax — and we've written to you both with the details. I'll be your contact the whole way through, so please " +
                       "call me on 1300 975 707 whenever you need.";
            default:
                return null;
        }
    }

    private static string GenericReply(string intent) => intent switch
    {
        "security" =>
            "That must be really worrying — thank you for calling us straight away. For your protection we never change details or move money on a call like this, " +
            "so I'm flagging your account to our member protection team now, and a specialist will call you back on the number we had on file before the change. " +
            "Please don't share any codes you've been sent, and IDCARE can help for free on 1800 595 160.",
        "bereavement" =>
            "I'm so sorry for your loss. I'll help you through this one step at a time — could you tell me your loved one's full name and, if you have it, their " +
            "member number? We'll need a certified copy of the death certificate and some identification for you, and I'll stay your contact the whole way through.",
        "family" =>
            "Of course, I'd be glad to help. I can only talk about your mum's account with her permission, or if you hold her power of attorney — and if she has " +
            "passed away, I'm so sorry, and I'll gently guide you through what we need. Could you tell me a little more about what's happened?",
        "hardship" =>
            "I'm sorry things are tough at the moment — asking is the right step. You may be able to access some of your super on severe financial hardship grounds " +
            "if you've received Centrelink income support, like JobSeeker, for 26 weeks in a row; it's a single payment of between $1,000 and $10,000 before tax, " +
            "once in any twelve months. The National Debt Helpline on 1800 007 007 also offers free financial counselling — would you like me to send you the form?",
        "pension" =>
            "I'd be glad to help you start a pension. Generally you can start an account-based pension once you've met a condition of release — like turning 65, " +
            "or retiring after 60 — and your adviser can help you decide how much income to take. I'll just need to confirm your full name, date of birth and " +
            "member number, and then I can send you the application pack.",
        "consolidate" =>
            "Happy to help bring your super together. We can request the rollovers from your other funds for you — I'll just need each fund's name and your member " +
            "number with them. One important thing: if any of those accounts includes insurance, that cover usually ends when the account is closed, so it's worth " +
            "checking with your adviser first.",
        "status" =>
            "I can check that for you. Could you give me your member number, or the case reference starting with R-E-Q, so I can pull up the details?",
        _ =>
            "Hi, you're speaking with Cara from Caldova Wealth. I can help with your account, a request you've made, or questions about how super and pensions " +
            "work. What can I help you with today?"
    };

    // Strip basic markdown so the reply sounds natural when read aloud by the
    // browser's speech synthesiser.
    private static string StripMarkdown(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;
        var lines = text.Replace("\r\n", "\n").Split('\n');
        var cleaned = new List<string>(lines.Length);
        foreach (var raw in lines)
        {
            var line = raw.TrimStart();
            if (line.StartsWith("```")) continue;
            while (line.StartsWith('#')) line = line[1..];
            if (line.StartsWith("- ") || line.StartsWith("* ")) line = line[2..];
            line = Regex.Replace(line, @"^\d+\.\s+", "");
            line = line.Replace("**", "").Replace("__", "").Replace("`", "");
            cleaned.Add(line.Trim());
        }
        return string.Join(" ", cleaned.Where(l => l.Length > 0)).Trim();
    }

    private static string Sanitize(string value) =>
        value.Replace('\r', ' ').Replace('\n', ' ');
}
