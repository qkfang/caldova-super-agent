using System.Collections.Concurrent;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Channels;
using Microsoft.Extensions.AI;
using CaldovaSuper.Agents;

namespace CaldovaSuper.App.Services;

/// <summary>
/// One participant in the Team Leader group chat. <c>Id</c> is the agent's
/// page route id, <c>AgentRole</c> the <see cref="CaldovaAgentFactory"/> key.
/// </summary>
public record GroupChatParticipant(string Id, string Persona, string Role, string AgentRole);

/// <summary>
/// One streamed turn event written to the group-chat session channel and
/// surfaced over HTTP. <c>Kind</c> is one of: <c>info</c> (orchestration
/// status), <c>ask</c> (Theo's question to a specialist), <c>reply</c>
/// (specialist's answer), <c>conclude</c> (Theo's plan), <c>error</c>,
/// <c>done</c>.
/// </summary>
public record GroupChatTurn(
    string Kind,
    string SpeakerId,
    string SpeakerPersona,
    string SpeakerRole,
    string Text,
    DateTimeOffset Timestamp);

/// <summary>
/// Cumulative state of a single group-chat session; held in memory so the
/// SSE subscriber receives every turn even if it connects late.
/// <c>Mode</c> is <c>live</c> (Foundry agents) or <c>scripted</c> (the
/// deterministic replay used when Foundry isn't configured).
/// </summary>
public class GroupChatSession
{
    public string Id { get; }
    public string CaseNumber { get; }
    public string Mode { get; }
    public List<GroupChatTurn> Turns { get; } = new();
    public Channel<GroupChatTurn> Events { get; } =
        Channel.CreateUnbounded<GroupChatTurn>(new UnboundedChannelOptions
        {
            // Exactly one orchestration task writes to this channel and the
            // matching SSE handler is the only reader for the session.
            SingleReader = true,
            SingleWriter = true
        });
    public bool Completed { get; set; }

    public GroupChatSession(string id, string caseNumber, string mode)
    {
        Id = id;
        CaseNumber = caseNumber;
        Mode = mode;
    }
}

/// <summary>
/// Orchestrates a multi-agent group chat about a single Member Case.
///
/// Modelled on the <c>GroupChatManager</c> / <c>GroupChatHost</c> pattern in
/// <c>Microsoft.Agents.AI.Workflows</c> (see
/// <c>AgentWorkflowBuilder.CreateGroupChatBuilderWith</c>): the Team Leader
/// Agent (Theo) acts as the group-chat manager (<c>SelectNextAgentAsync</c> +
/// <c>ShouldTerminateAsync</c>), and the seven other Caldova operations
/// agents — Olivia (Onboarding), Ben (Benefits &amp; Eligibility), Ivy
/// (Investments), Felix (Financial Crime), Rory (Transfers &amp; Rollovers),
/// Penny (Payments) and Cara (Client Communications) — take part as
/// specialists.
///
/// The transcript is kept as <see cref="ChatMessage"/> instances — the type
/// the framework's <c>GroupChatManager</c> consumes — so the orchestration
/// could later move onto the framework's workflow runtime once the Foundry
/// agents are wrapped as <c>AIAgent</c> instances.
///
/// When Foundry isn't configured (or the live agents fail before the
/// discussion starts) the service replays a deterministic, case-specific
/// stand-up built from the canonical case facts, so the demo always
/// completes end-to-end.
/// </summary>
public class TeamLeaderGroupChatService
{
    // Hard cap on the number of group-chat turns. Each iteration is framed
    // to Theo (the group-chat manager) as one "turn": he either picks a
    // specialist to speak or concludes. The cap guarantees the chat ends
    // even if Theo never elects to conclude on his own.
    private const int MaxIterations = 20;

    // Pacing for the scripted replay so the transcript reads like a live chat.
    private static readonly TimeSpan AskDelay = TimeSpan.FromMilliseconds(550);
    private static readonly TimeSpan ReplyDelay = TimeSpan.FromMilliseconds(1200);

    private const string LeaderId = "team-leader";
    private const string LeaderPersona = "Theo";
    private const string LeaderRole = "Client Operations Team Leader";

    private readonly CaseStore _store;
    private readonly CaldovaAgentFactory _agentFactory;
    private readonly ILogger<TeamLeaderGroupChatService> _logger;

    private readonly ConcurrentDictionary<string, GroupChatSession> _sessions =
        new(StringComparer.OrdinalIgnoreCase);

    /// <summary>
    /// Specialist participants in the group chat — every operations role
    /// except the Team Leader, who chairs as the manager.
    /// </summary>
    public static readonly IReadOnlyList<GroupChatParticipant> Participants = new[]
    {
        new GroupChatParticipant("onboarding",            "Olivia", "Onboarding & Requests Officer",     "onboarding"),
        new GroupChatParticipant("benefits-eligibility",  "Ben",    "Benefits & Eligibility Assessor",   "benefits"),
        new GroupChatParticipant("investment-analyst",    "Ivy",    "Investment Analyst",                "investments"),
        new GroupChatParticipant("financial-crime",       "Felix",  "Financial Crime Investigator",      "fincrime"),
        new GroupChatParticipant("transfers-rollovers",   "Rory",   "Transfers & Rollovers Coordinator", "transfers"),
        new GroupChatParticipant("payments",              "Penny",  "Payments Officer",                  "payments"),
        new GroupChatParticipant("client-communications", "Cara",   "Client Communications Specialist",  "communications"),
    };

    public TeamLeaderGroupChatService(
        CaseStore store,
        CaldovaAgentFactory agentFactory,
        ILogger<TeamLeaderGroupChatService> logger)
    {
        _store = store;
        _agentFactory = agentFactory;
        _logger = logger;
    }

    public bool IsConfigured => _agentFactory.IsConfigured;

    public CaseRecord? GetCase(string caseNumber) => _store.Get(caseNumber);

    public GroupChatSession? GetSession(string sessionId) =>
        _sessions.TryGetValue(sessionId, out var s) ? s : null;

    /// <summary>
    /// Start a group-chat session for the given case. Returns immediately;
    /// orchestration runs on a background task and pushes
    /// <see cref="GroupChatTurn"/> events to the session channel — live
    /// Foundry agents when configured, otherwise the scripted replay.
    /// </summary>
    public GroupChatSession StartSession(CaseRecord memberCase)
    {
        var mode = IsConfigured ? "live" : "scripted";
        var session = new GroupChatSession(Guid.NewGuid().ToString("N"), memberCase.CaseNumber, mode);
        _sessions[session.Id] = session;
        _ = Task.Run(() => mode == "live"
            ? RunLiveAsync(session, memberCase)
            : RunScriptedAsync(session, memberCase));
        return session;
    }

    // ── Live orchestration (Foundry agents) ───────────────────────────────────
    private async Task RunLiveAsync(GroupChatSession session, CaseRecord memberCase)
    {
        try
        {
            await EmitLeaderAsync(session, "info",
                $"Opening group chat for case {memberCase.CaseNumber} — {memberCase.ClientName}, {Lower(memberCase.RequestType)}. Inviting the team…");

            // Conversation history kept in MAF's ChatMessage shape. Each
            // message's AuthorName carries the speaker persona so Theo can
            // refer back to who said what.
            var history = new List<ChatMessage>
            {
                new(ChatRole.System, BuildBrief(memberCase)) { AuthorName = "CaseFile" }
            };

            var leader = _agentFactory.Create("team-leader");
            var specialistsById = Participants.ToDictionary(p => p.Id, p => p, StringComparer.OrdinalIgnoreCase);

            for (var iteration = 0; iteration < MaxIterations; iteration++)
            {
                // Manager step: ask Theo who should speak next, or conclude.
                var managerPrompt = BuildManagerPrompt(memberCase, history, iteration, MaxIterations);
                var managerResult = await leader.RunWithTraceAsync(managerPrompt);
                var decision = ParseManagerDecision(managerResult.Text);

                if (decision is null)
                {
                    _logger.LogWarning("Team Leader returned an unparseable decision; concluding. Raw: {Raw}",
                        Truncate(managerResult.Text, 400));
                    await EmitLeaderAsync(session, "conclude", managerResult.Text.Trim());
                    history.Add(new ChatMessage(ChatRole.Assistant, managerResult.Text) { AuthorName = LeaderPersona });
                    break;
                }

                if (string.Equals(decision.Action, "conclude", StringComparison.OrdinalIgnoreCase))
                {
                    var summary = string.IsNullOrWhiteSpace(decision.Summary)
                        ? "The team has reached a conclusion. Closing the discussion."
                        : decision.Summary!;
                    await EmitLeaderAsync(session, "conclude", summary);
                    history.Add(new ChatMessage(ChatRole.Assistant, summary) { AuthorName = LeaderPersona });
                    break;
                }

                if (!specialistsById.TryGetValue(decision.Speaker ?? "", out var participant))
                {
                    await EmitLeaderAsync(session, "conclude",
                        $"(Theo picked an unknown speaker '{decision.Speaker}'. Closing the discussion.)");
                    break;
                }

                var question = string.IsNullOrWhiteSpace(decision.Prompt)
                    ? $"{participant.Persona}, what's your view on this case?"
                    : decision.Prompt!;

                await EmitLeaderAsync(session, "ask", $"@{participant.Persona} ({participant.Role}) — {question}");
                history.Add(new ChatMessage(ChatRole.Assistant, $"To {participant.Persona}: {question}")
                {
                    AuthorName = LeaderPersona
                });

                // Specialist step.
                CaldovaAgent specialist;
                try
                {
                    specialist = _agentFactory.Create(participant.AgentRole);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to create specialist {Role}", participant.AgentRole);
                    await EmitAsync(session, "error", participant.Id, participant.Persona, participant.Role,
                        $"Couldn't bring {participant.Persona} into the chat: {ex.Message}");
                    continue;
                }

                var specialistPrompt = BuildSpecialistPrompt(memberCase, participant, question, history);
                AgentTraceResult specialistResult;
                try
                {
                    specialistResult = await specialist.RunWithTraceAsync(specialistPrompt);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Specialist {Role} failed", participant.AgentRole);
                    await EmitAsync(session, "error", participant.Id, participant.Persona, participant.Role,
                        $"{participant.Persona} couldn't respond: {ex.Message}");
                    continue;
                }

                var reply = string.IsNullOrWhiteSpace(specialistResult.Text)
                    ? "(no response)"
                    : specialistResult.Text.Trim();
                await EmitAsync(session, "reply", participant.Id, participant.Persona, participant.Role, reply);
                history.Add(new ChatMessage(ChatRole.Assistant, reply) { AuthorName = participant.Persona });
            }

            if (!session.Turns.Any(t => t.Kind == "conclude"))
            {
                await EmitLeaderAsync(session, "conclude",
                    $"Reached the {MaxIterations}-turn limit. Closing the discussion and recording the transcript on the case.");
            }
        }
        catch (Exception ex) when (!session.Turns.Any(t => t.Kind is "ask" or "reply"))
        {
            // Nothing has been discussed yet — replay the scripted stand-up so
            // the demo still completes.
            _logger.LogWarning(ex, "Live group chat unavailable for case {CaseNumber}; replaying the scripted stand-up",
                memberCase.CaseNumber);
            await EmitLeaderAsync(session, "info",
                "The live Foundry agents aren't available right now, so this is a scripted replay built from the case facts.");
            await RunScriptCoreAsync(session, memberCase);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Group-chat orchestration failed for case {CaseNumber}", memberCase.CaseNumber);
            await EmitLeaderAsync(session, "error", "Orchestration failed: " + ex.Message);
        }
        finally
        {
            await CompleteAsync(session);
        }
    }

    // ── Scripted replay (no Foundry) ─────────────────────────────────────────
    private async Task RunScriptedAsync(GroupChatSession session, CaseRecord memberCase)
    {
        try
        {
            await EmitLeaderAsync(session, "info",
                $"Opening group chat for case {memberCase.CaseNumber} — {memberCase.ClientName}, {Lower(memberCase.RequestType)}. " +
                "Offline mode: Foundry isn't configured, so this is a scripted replay built from the case facts.");
            await RunScriptCoreAsync(session, memberCase);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Scripted group chat failed for case {CaseNumber}", memberCase.CaseNumber);
            await EmitLeaderAsync(session, "error", "Replay failed: " + ex.Message);
        }
        finally
        {
            await CompleteAsync(session);
        }
    }

    private async Task RunScriptCoreAsync(GroupChatSession session, CaseRecord memberCase)
    {
        var script = ScriptFor(memberCase);
        var byId = Participants.ToDictionary(p => p.Id, p => p, StringComparer.OrdinalIgnoreCase);

        foreach (var step in script.Steps)
        {
            if (!byId.TryGetValue(step.SpeakerId, out var participant)) continue;
            await Task.Delay(AskDelay);
            await EmitLeaderAsync(session, "ask", $"@{participant.Persona} ({participant.Role}) — {step.Question}");
            await Task.Delay(ReplyDelay);
            await EmitAsync(session, "reply", participant.Id, participant.Persona, participant.Role, step.Answer);
        }

        await Task.Delay(AskDelay);
        await EmitLeaderAsync(session, "conclude", script.Conclusion);
    }

    private static async Task CompleteAsync(GroupChatSession session)
    {
        session.Completed = true;
        await session.Events.Writer.WriteAsync(new GroupChatTurn(
            "done", "system", "system", "system", "", DateTimeOffset.UtcNow));
        session.Events.Writer.TryComplete();
    }

    private static Task EmitLeaderAsync(GroupChatSession session, string kind, string text) =>
        EmitAsync(session, kind, LeaderId, LeaderPersona, LeaderRole, text);

    private static async Task EmitAsync(
        GroupChatSession session, string kind, string speakerId,
        string persona, string role, string text)
    {
        var turn = new GroupChatTurn(kind, speakerId, persona, role, text, DateTimeOffset.UtcNow);
        session.Turns.Add(turn);
        await session.Events.Writer.WriteAsync(turn);
    }

    // ── Case facts shared by the prompts (and the Team Leader dashboard) ──────

    /// <summary>
    /// Canonical key facts on file for a Member Case, keyed off
    /// <see cref="CaseRecord.SampleId"/>. Used to ground the live group-chat
    /// prompts and the Team Leader agent's floor review.
    /// </summary>
    public static IReadOnlyList<string> KeyFacts(CaseRecord c) => (c.SampleId ?? string.Empty).ToLowerInvariant() switch
    {
        "onboarding-priya" =>
        [
            "New Caldova Super (Select) account CS-2049817 via adviser Hannah Lewis CFP® (Yarra Private Wealth, ADV-10442); Caldova Managed Portfolio — Growth per SoA dated 28 Oct 2026 (risk profile Growth).",
            "Consolidating Southern Cross Industry Super (USI SCI0001AU, member 88213045, ~$96,400, holds $520,000 Death & TPD cover) and Harbourline Retail Super (USI HRB0007AU, member HR-4471902, ~$41,800, no insurance) — total ~$138,200.",
            "Ongoing adviser fee $3,300 p.a. incl. GST ($275 a month) from super; signed consent meets SIS s99FA.",
            "Binding nomination to Arjun Mehta (de facto, 100%) has only ONE witness — not valid as binding; treated as non-binding until re-signed before two adult witnesses who aren't beneficiaries.",
            "Insurance-loss warning: rolling over Southern Cross ends the $520,000 Death & TPD cover — hold that rollover until the adviser/member confirm in writing or replacement cover is in place.",
            "ID verified (DVS), TFN supplied (*** *** 418); KYC/AML screening clear (no PEP or sanctions match).",
            "SuperStream rollovers complete within 3 business days of the old fund having all required information; invest on receipt and keep 1% in the Caldova Cash Account.",
        ],
        "rollover-grace" =>
        [
            "Grace Williams, 63, direct member, Caldova Super (Select) CS-1058220, balance $612,400; travelling in Italy since 18 Oct 2026 (travel notice on file); verified mobile before the change: 0491 570 157.",
            "2 Nov 2026 10:42 — a caller impersonating Grace passed knowledge-based checks and changed the mobile to 0491 570 158 and the email to grace.w.super@mailbox.example.",
            "3 Nov 2026 21:14 — online access registered from a new device on a Sydney IP; MFA code sent to the new mobile.",
            "6 Nov 2026 07:52 (~93 hours after the change) — request to roll over the full balance to 'GW Family Superannuation Fund': SMSF ABN registered 28 Oct 2026; bank account name 'G Williams Holdings Pty Ltd'.",
            "ATO SMSF verification service: the ABN is a registered SMSF but Grace's TFN is NOT linked; bank details and ESA don't match. Licence image tampered (font/DOB mismatch, missing hologram).",
            "Financial-crime risk HIGH — recommended: hold, lock online access, call back on the pre-change verified number, IDCARE referral. An SMR to AUSTRAC within 3 business days is a human decision and is never disclosed to the member.",
        ],
        "pension-george" =>
        [
            "George Papadopoulos, 66, Caldova Super (Select) CS-1077881, balance $1,284,600; adviser Marcus Tan (Bayside Financial Partners, ADV-20871).",
            "Commence Caldova Pension CP-3077881 with $1,250,000 on 16 Nov 2026, leaving $34,600 in accumulation; $78,000 p.a. paid monthly ($6,500 on the 15th), first payment 15 Dec 2026; reversionary beneficiary Helen (spouse).",
            "Age 65 condition of release met. Transfer balance cap $2.1 million (2026-27), no prior transfer balance account → $850,000 of cap space remains after the credit.",
            "Minimum drawdown 5% (age 65–74) = $62,500 p.a.; pro-rated 227/365 days from 16 Nov = $38,870 for 2026-27. Payments are tax-free (age 60+).",
            "Income strategy: cash bucket of two years' payments ($156,000) in cash and term deposits; remaining $1,094,000 in the Balanced model.",
            "Commencements of $1,000,000 or more need Team Leader approval (Teams card).",
        ],
        "hardship-tom" =>
        [
            "Tom Bradley, 47, direct member, Caldova Super (Essential) CS-1030412, balance $84,300; former Lygon Street café owner.",
            "Requested $15,000 on severe financial hardship grounds (11 Nov 2026). JobSeeker continuously since 6 Apr 2026 (31 weeks); Services Australia letter dated 9 Nov 2026; behind on mortgage and utilities; no hardship release in the last 12 months.",
            "Rule: a single payment of $1,000–$10,000 gross, once in any 12 months → partial approval of $10,000 gross.",
            "Tax: under 60 → 22% withheld from the taxable component. Tax-free 6% = $600; taxable $9,400; PAYG withheld $2,068; net $7,932 paid Fri 13 Nov 2026; $2,068 remitted to the ATO.",
            "Vulnerable member — human review; the letter must include the National Debt Helpline (1800 007 007) and Moneysmart.",
        ],
        "death-benefit-robert" =>
        [
            "Mei Chen, 81, died 12 Oct 2026; Caldova Pension CP-3019042, balance $486,200; adviser Marcus Tan. Beneficiaries: son Robert Chen (the family's contact) and daughter Lily Chen. Pension payments stopped on notification.",
            "Binding nomination signed 18 Mar 2024 before two adult witnesses not named in it; lapsing, valid to 18 Mar 2027; Robert 50% / Lily 50%; both are SIS dependants → binding, no trustee discretion. No reversionary beneficiary.",
            "Tax: adult children who weren't financially dependent are non-dependants for tax → 17% withheld from the taxable component. Components 38% tax-free / 62% taxable.",
            "Each beneficiary: gross $243,100; tax-free $92,378; taxable $150,722; withheld $25,622.74; net $217,477.26 (final amounts depend on the sale proceeds when the portfolio is redeemed).",
            "Certified death certificate and both IDs genuine. Every death benefit needs Team Leader approval.",
        ],
        _ =>
        [
            $"{c.RequestType} for {c.ClientName} ({c.MemberNumber}), received {c.ReceivedDate}: {c.RequestSummary}",
            $"Amount: {c.Amount}. Priority: {c.Priority} — {c.PriorityReason}",
        ]
    };

    private static string BuildBrief(CaseRecord c)
    {
        var lines = new List<string>
        {
            "MEMBER CASE FOR GROUP-CHAT REVIEW",
            "=================================",
            $"Case number    : {c.CaseNumber}",
            $"Client         : {c.ClientName}",
            $"Client email   : {c.ClientEmail}",
            $"Client phone   : {c.ClientPhone}",
            $"Member number  : {c.MemberNumber}",
            $"Product        : {c.Product}",
            $"Request type   : {c.RequestType}",
            $"Received       : {c.ReceivedDate}",
            $"Adviser        : {(string.IsNullOrWhiteSpace(c.AdviserPractice) ? c.AdviserName : $"{c.AdviserName} ({c.AdviserPractice})")}",
            $"Amount         : {c.Amount}",
            $"Priority       : {c.Priority} ({c.PriorityReason})",
            "",
            "REQUEST SUMMARY",
            "---------------",
            c.RequestSummary,
            "",
            "KEY FACTS ON FILE",
            "-----------------",
        };
        lines.AddRange(KeyFacts(c).Select(f => "- " + f));
        return string.Join("\n", lines);
    }

    private static string BuildManagerPrompt(
        CaseRecord c, IReadOnlyList<ChatMessage> history, int iteration, int maxIterations)
    {
        var roster = string.Join("\n", Participants.Select(p => $"- {p.Id}: {p.Persona}, {p.Role}"));
        var transcript = RenderTranscript(history);

        return
            "You are Theo, the Client Operations Team Leader at Caldova Wealth, chairing a group chat\n" +
            "with the operations specialists about ONE Member Case. You are the GROUP-CHAT MANAGER:\n" +
            "you decide which specialist speaks next, or whether the team has reached a conclusion\n" +
            "and the discussion should end.\n\n" +
            $"This is turn {iteration + 1} of at most {maxIterations}.\n\n" +
            "PARTICIPANTS (use the id in the JSON 'speaker' field):\n" +
            roster + "\n\n" +
            "MEMBER CASE:\n" +
            BuildBrief(c) + "\n\n" +
            "TRANSCRIPT SO FAR:\n" +
            (string.IsNullOrWhiteSpace(transcript) ? "(empty)" : transcript) + "\n\n" +
            "DECIDE the next step. Options:\n" +
            "  1. Pick the most relevant specialist who has NOT yet covered their part of the\n" +
            "     case, and ask them ONE focused question.\n" +
            "  2. Conclude once the team has covered what this case needs — request completeness\n" +
            "     (NIGO), eligibility and the rules, financial-crime signals, transfers and\n" +
            "     counterparties, investments, payment and tax, and member/adviser communications —\n" +
            "     or earlier if the case is straightforward. The summary must be a short numbered\n" +
            "     plan with owners, any approvals you (a human) will give, the clocks that apply\n" +
            "     and the expected outcome.\n\n" +
            "Respond with ONLY a JSON object (no prose, no markdown fences) in this exact shape:\n" +
            "{\n" +
            "  \"action\":  \"ask\" | \"conclude\",\n" +
            "  \"speaker\": \"<participant id>\"        // required when action=ask\n" +
            "  \"prompt\":  \"<question to specialist>\" // required when action=ask\n" +
            "  \"summary\": \"<Theo's plan>\"            // required when action=conclude\n" +
            "}\n";
    }

    private static string BuildSpecialistPrompt(
        CaseRecord c, GroupChatParticipant participant, string question,
        IReadOnlyList<ChatMessage> history)
    {
        var transcript = RenderTranscript(history);
        return
            "You are taking part in a Caldova Wealth client operations GROUP CHAT about Member Case\n" +
            $"{c.CaseNumber}, chaired by Theo (Client Operations Team Leader).\n\n" +
            "Stay in character as your role and answer Theo's question directly and concisely\n" +
            "(under 150 words). Do NOT repeat your full standard report — speak conversationally,\n" +
            "as if in a stand-up with the team. Use only the facts on the case, never give personal\n" +
            "financial advice and never accuse a member of fraud. End with a single line beginning\n" +
            "'Recommendation:' summarising your input.\n\n" +
            "MEMBER CASE:\n" + BuildBrief(c) + "\n\n" +
            "TRANSCRIPT SO FAR:\n" +
            (string.IsNullOrWhiteSpace(transcript) ? "(empty)" : transcript) + "\n\n" +
            $"THEO ASKS YOU ({participant.Persona}, {participant.Role}):\n" + question;
    }

    private static string RenderTranscript(IReadOnlyList<ChatMessage> history)
    {
        var lines = new List<string>();
        foreach (var msg in history)
        {
            if (msg.Role == ChatRole.System) continue;
            var who = string.IsNullOrWhiteSpace(msg.AuthorName) ? msg.Role.Value : msg.AuthorName;
            lines.Add($"{who}: {msg.Text}");
        }
        return string.Join("\n\n", lines);
    }

    private static ManagerDecision? ParseManagerDecision(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;

        // Strip markdown code fences if the model added them despite instructions.
        var cleaned = Regex.Replace(text, "```(?:json)?", "", RegexOptions.IgnoreCase).Trim();
        var braceStart = cleaned.IndexOf('{');
        var braceEnd = cleaned.LastIndexOf('}');
        if (braceStart < 0 || braceEnd <= braceStart) return null;

        var json = cleaned.Substring(braceStart, braceEnd - braceStart + 1);
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            return new ManagerDecision(
                Action: root.TryGetProperty("action", out var a) ? a.GetString() : null,
                Speaker: root.TryGetProperty("speaker", out var s) ? s.GetString() : null,
                Prompt: root.TryGetProperty("prompt", out var p) ? p.GetString() : null,
                Summary: root.TryGetProperty("summary", out var sm) ? sm.GetString() : null);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string Truncate(string s, int max) =>
        string.IsNullOrEmpty(s) ? string.Empty : (s.Length <= max ? s : s[..max] + "…");

    private static string Lower(string? s) =>
        string.IsNullOrWhiteSpace(s)
            ? "request"
            : s.ToLowerInvariant().Replace("smsf", "SMSF").Replace("death benefit claim", "death benefit");

    private record ManagerDecision(string? Action, string? Speaker, string? Prompt, string? Summary);

    // ── Scripted stand-ups (canonical case facts) ─────────────────────────────
    private record ScriptStep(string SpeakerId, string Question, string Answer);

    private record GroupChatScript(IReadOnlyList<ScriptStep> Steps, string Conclusion);

    private static GroupChatScript ScriptFor(CaseRecord c) => (c.SampleId ?? string.Empty).ToLowerInvariant() switch
    {
        "onboarding-priya" => new GroupChatScript(
        [
            new("onboarding",
                "Is Priya's application pack in good order, and what's still NIGO?",
                "Mostly, yes. Hannah's pack has everything we need to open CS-2049817: ID verified via DVS on 28 October, TFN supplied (*** *** 418), " +
                "application signed on 30 October, the Growth model per the SoA dated 28 October, and a signed consent for the $3,300 p.a. advice fee. " +
                "Two NIGO items: the binding nomination for Arjun has only one witness, and the insurance-loss acknowledgement for Southern Cross isn't ticked.\n" +
                "Recommendation: open the account now and chase both items through Hannah."),
            new("financial-crime",
                "Anything from KYC and AML screening before money moves?",
                "All clear. PEP and sanctions screening returned no matches, and the DVS check meets our KYC standard. I've recorded a Low risk rating, with reasons, on the case.\n" +
                "Recommendation: no financial-crime hold — proceed."),
            new("benefits-eligibility",
                "Do the fee consent and the nomination stand up?",
                "The fee consent meets SIS s99FA — written, signed and dated by Priya, with the amount, the services and a 12-month term, and it can be withdrawn. " +
                "The nomination doesn't meet SIS reg 6.17A: it needs two witnesses aged 18 or over who aren't named in it, so we treat it as non-binding until Priya re-signs. " +
                "Growth is consistent with her SoA risk profile and the product's target market.\n" +
                "Recommendation: approve the account opening and request a re-signed nomination."),
            new("transfers-rollovers",
                "How do we consolidate without Priya losing cover by accident?",
                "Harbourline Retail Super (HRB0007AU, about $41,800, no insurance) goes through SuperStream now — 3 business days once they have everything. " +
                "Southern Cross Industry Super (SCI0001AU, about $96,400) holds $520,000 of Death & TPD cover that ends on rollover, so I'm holding it until Hannah and Priya " +
                "confirm in writing, or replacement cover is in place.\n" +
                "Recommendation: proceed with Harbourline; hold Southern Cross pending the insurance decision."),
            new("investment-analyst",
                "Does Growth still fit, and what does it cost in dollars?",
                "Growth (80/20) matches the SoA's Growth risk profile. On $138,200, Caldova fees come to about $1,175 a year for Growth, $1,120 for Balanced and $843 for " +
                "Index Balanced — admin plus investment fees, excluding the adviser fee. The choice is Hannah's advice; my workbook just makes the trade-offs visible.\n" +
                "Recommendation: keep Growth and send the workbook to Hannah."),
            new("payments",
                "What happens when the money lands?",
                "Each rollover is matched to the case on receipt, 1% stays in the Caldova Cash Account and the rest goes into Growth — about $41,382 invested from Harbourline. " +
                "The $275 monthly adviser fee runs under the signed consent. No payment approvals are needed.\n" +
                "Recommendation: invest on arrival."),
            new("client-communications",
                "What do Priya and Hannah hear from us?",
                "Priya gets a welcome email: member number CS-2049817, our USI CDV0101AU for her employer, what's happening with each old fund, and how to re-sign her nomination. " +
                "Hannah gets an adviser update with two actions — re-sign the nomination before two independent adult witnesses, and confirm the insurance decision on Southern Cross. " +
                "No advice, and complaint rights are included.\n" +
                "Recommendation: send both today — spot-check only."),
        ],
            $"Thanks, team. Plan for {c.CaseNumber}:\n" +
            "1. Open CS-2049817 now — Growth model, $3,300 p.a. fee under the s99FA consent (Olivia, Ben).\n" +
            "2. Request the Harbourline rollover now and track the 3-business-day SLA (Rory).\n" +
            "3. Hold Southern Cross until the insurance decision is confirmed in writing — Rory chases Hannah.\n" +
            "4. Treat the nomination as non-binding until Priya re-signs (Ben).\n" +
            "5. Invest on arrival with 1% in cash (Penny); welcome email and adviser update today (Cara).\n" +
            "No approvals needed from me. Outcome: account opened ✅"),

        "rollover-grace" => new GroupChatScript(
        [
            new("onboarding",
                "What came in, and why is it marked Urgent?",
                "A request to roll Grace's whole balance — about $612,400 — to 'GW Family Superannuation Fund'. It came from an email address that was changed on 2 November, " +
                "asks us not to call her 'old' number, pays an account named 'G Williams Holdings Pty Ltd', and the signature differs from the specimen on file. " +
                "Her travel notice says she's in Italy.\n" +
                "Recommendation: don't process anything — route to Ben and Felix."),
            new("benefits-eligibility",
                "What do the rollover rules say?",
                "Before any rollover to an SMSF we must use the ATO SMSF verification service (SIS reg 6.33E). The ABN is a registered SMSF — but only since 28 October — " +
                "and Grace's TFN isn't linked to it, and the bank details and ESA don't match. SMSF validation fails, so the rollover can't proceed.\n" +
                "Recommendation: do not process; escalate to Financial Crime."),
            new("financial-crime",
                "What's your read on the risk, and what do you recommend?",
                "Risk HIGH. The timeline joins up: mobile and email changed by phone on 2 November at 10:42, a new device on a Sydney IP on 3 November at 21:14 with the MFA code " +
                "going to the new number, then this request at 07:52 on 6 November — about 93 hours after the change — to move everything to a nine-day-old SMSF. " +
                "The licence image has an altered date-of-birth font and no hologram, and the payee name doesn't match. These are AUSTRAC- and ATO-listed indicators — " +
                "Grace is the likely victim, not a suspect.\n" +
                "Recommendation: hold, lock online access, call back on the pre-change number 0491 570 157, refer to IDCARE, and consider an SMR within 3 business days — your call."),
            new("transfers-rollovers",
                "Where does the SuperStream rollover stand?",
                "On hold. The 3-business-day clock only runs once all required information has been received and verified, and a failed SMSF verification means it hasn't. " +
                "I'll cancel the request with the receiving fund and record the reason — nothing has been sent.\n" +
                "Recommendation: hold and cancel."),
            new("payments",
                "Confirm no money can leave.",
                "Confirmed — the outbound payment to 'G Williams Holdings Pty Ltd' is cancelled and there's a payment block on the account until Grace re-verifies. " +
                "Her $612,400 is still invested.\n" +
                "Recommendation: keep the block in place."),
            new("client-communications",
                "How do we reach the real Grace?",
                "Only on her pre-change verified details — grace.williams@example.com and 0491 570 157 — never the new ones. I'll call at a time that suits her in Florence, " +
                "then send a calm reassurance letter: her money is safe, what we've done, free IDCARE support on 1800 595 160, and how to reach a person. " +
                "No mention of any report to authorities. It needs your approval before it goes.\n" +
                "Recommendation: call first, letter second — human-approved."),
        ],
            $"I approve the block. Plan for {c.CaseNumber}:\n" +
            "1. Rollover blocked and cancelled; payment block until Grace re-verifies (Rory, Penny).\n" +
            "2. Lock online access, restore the pre-change contact details and reset her credentials (Felix).\n" +
            "3. SMR referral approved to the AML/CTF compliance officer — due within 3 business days, by Wed 11 Nov 2026 — and kept strictly confidential.\n" +
            "4. Cara calls Grace on 0491 570 157, then sends the reassurance letter after my review, with the IDCARE referral.\n" +
            "5. QA: review how a phone change of details passed knowledge-based checks — step-up verification to the existing number next time.\n" +
            "Outcome: request blocked 🛡️ — Grace's $612,400 is protected."),

        "pension-george" => new GroupChatScript(
        [
            new("onboarding",
                "Is George's pension application complete?",
                "Yes. $1,250,000 into a new Caldova Pension from CS-1077881, leaving about $34,600 in accumulation; $78,000 a year paid monthly ($6,500 on the 15th); " +
                "Helen as reversionary beneficiary; requested start Monday 16 November. No existing retirement-phase income streams, and the application was signed on 6 November. " +
                "One flag: a commencement of $1,000,000 or more needs your approval.\n" +
                "Recommendation: in good order — over to Ben."),
            new("benefits-eligibility",
                "Walk us through eligibility and the caps.",
                "George is 66, so the age-65 condition of release is met. The $1,250,000 credit is within the $2.1 million transfer balance cap for 2026-27, leaving $850,000 of cap space. " +
                "The minimum at 5% is $62,500 a year; pro-rated for 227 of 365 days from 16 November it's $38,870 for 2026-27, and his seven payments before 30 June total $45,500. " +
                "Helen, as his spouse, is an eligible reversionary beneficiary, and payments are tax-free from 60.\n" +
                "Recommendation: approve."),
            new("investment-analyst",
                "How do we make the income dependable?",
                "A two-year cash bucket — $156,000 in cash and term deposits — with the remaining $1,094,000 in the Balanced model. That covers two years of payments without " +
                "selling growth assets in a downturn. I've compared three structures in a workbook for Marcus; the decision is his and George's.\n" +
                "Recommendation: implement as instructed on the application."),
            new("transfers-rollovers",
                "Transfer and ATO reporting?",
                "The internal transfer of $1,250,000 from CS-1077881 to CP-3077881 is scheduled for 16 November once approved, with $34,600 staying in accumulation. " +
                "The transfer balance account report for the $1,250,000 credit is ready to go to the ATO.\n" +
                "Recommendation: run on approval."),
            new("payments",
                "What do you need from me?",
                "A Teams approval — commencements of $1,000,000 or more are above my authority. The payee checks out: a joint account in George's name, ending 2214. " +
                "Each $6,500 payment is tax-free, so PAYG withholding is nil, and the first payment is on 15 December 2026.\n" +
                "Recommendation: approve in Teams so we can commence on 16 November."),
            new("client-communications",
                "What does George hear?",
                "A warm 'welcome to retirement' letter: pension CP-3077881, $6,500 a month from 15 December, tax-free, Helen as reversionary, $34,600 still in super, " +
                "this year's minimum of $38,870 and how to change his payments. Marcus gets the same facts in adviser language, including the $850,000 of cap space left. " +
                "Then a short congratulatory SMS.\n" +
                "Recommendation: send after commencement — spot-check."),
        ],
            $"Approved — let's start George's pension. Plan for {c.CaseNumber}:\n" +
            "1. I approve the $1,250,000 commencement in Teams (authority limit: $1,000,000 or more).\n" +
            "2. Rory transfers to CP-3077881 on Mon 16 Nov 2026 and reports the credit to the ATO; $34,600 stays in accumulation.\n" +
            "3. Penny sets up $6,500 a month from Tue 15 Dec 2026, tax-free.\n" +
            "4. Ivy implements the cash bucket ($156,000) and Balanced ($1,094,000) per the application.\n" +
            "5. Cara sends the welcome-to-retirement letter, Marcus's confirmation and the SMS.\n" +
            "Outcome: pension started ✅"),

        "hardship-tom" => new GroupChatScript(
        [
            new("onboarding",
                "What has Tom sent us?",
                "A late-night application on 11 November for $15,000 on severe financial hardship grounds: JobSeeker continuously since 6 April 2026, a Services Australia letter " +
                "dated 9 November, a statutory declaration and overdue notices for his mortgage and power bill. He's a direct member with $84,300. " +
                "I've flagged him as vulnerable and noted that $15,000 is above the $10,000 maximum.\n" +
                "Recommendation: High priority, with a human touch throughout."),
            new("benefits-eligibility",
                "Does he meet the criteria, and what can we release?",
                "Every criterion is met: 31 weeks of income support (26 needed), still receiving it, a letter within 21 days, unable to meet reasonable and immediate family " +
                "living expenses, and no hardship release in the last 12 months. But the law limits a release to a single payment of $1,000 to $10,000 gross, once in any 12 months.\n" +
                "Recommendation: partially approve $10,000 gross — needs your approval."),
            new("financial-crime",
                "Any red flags? Hardship applications get targeted.",
                "None. The Services Australia letter is consistent with Tom's details, the payee account is in his own name, and there's no recent change of details or " +
                "SMSF activity — nothing that looks like an illegal early-release promoter.\n" +
                "Recommendation: no financial-crime hold."),
            new("investment-analyst",
                "Where does the $10,000 come from?",
                "Cash first, then Balanced units, keeping the 1% minimum in the Caldova Cash Account. His balance goes from $84,300 to about $74,300 before market movements.\n" +
                "Recommendation: redeem as planned once you've approved."),
            new("payments",
                "What does Tom actually receive?",
                "Gross $10,000: tax-free $600 (6%) and taxable $9,400. Tom's under 60, so 22% is withheld from the taxable part — $2,068. That leaves $7,932 for his account " +
                "in the name Thomas Bradley, ending 5120, on Friday 13 November, and the $2,068 goes to the ATO.\n" +
                "Recommendation: pay on Friday once the partial release is approved."),
            new("client-communications",
                "How do we tell him?",
                "Kindly and plainly. The letter leads with what we can do — $10,000 approved — explains that $10,000 is the legal maximum, shows the tax in a simple table, " +
                "mentions the effect on his super gently, and points him to free help: the National Debt Helpline on 1800 007 007 and Moneysmart. It includes his right to " +
                "complain — to us first, then AFCA — because part of his request couldn't be met. I'll offer him a call too.\n" +
                "Recommendation: send after your review."),
        ],
            $"I've reviewed Tom's circumstances and I approve the partial release. Plan for {c.CaseNumber}:\n" +
            "1. Partial approval recorded: $10,000 gross (the legal maximum) of the $15,000 requested.\n" +
            "2. Ivy redeems cash first, then Balanced units.\n" +
            "3. Penny pays $7,932 on Fri 13 Nov 2026 and remits $2,068 PAYG to the ATO.\n" +
            "4. Cara's letter goes after my review — with the National Debt Helpline (1800 007 007), Moneysmart and an offer of a call.\n" +
            "5. The 45-day complaint clock only starts if Tom complains — nothing open.\n" +
            "Outcome: partially approved 🟡"),

        "death-benefit-robert" => new GroupChatScript(
        [
            new("onboarding",
                "What do we have from Robert?",
                "Robert's email of 13 November with a certified death certificate (Births, Deaths and Marriages Victoria, registration 2026/031874), the signed request form " +
                "and certified ID for himself and Lily. Mei died on 12 October; her Caldova Pension CP-3019042 is about $486,200. I stopped her pension payments on notification.\n" +
                "Recommendation: compassionate handling, with Cara as the family's single contact."),
            new("financial-crime",
                "Are the documents genuine?",
                "Yes — the certified death certificate and both identity documents check out as genuine. Low risk, so we won't ask the family for anything more.\n" +
                "Recommendation: no further action."),
            new("benefits-eligibility",
                "Is the nomination binding, and how is the benefit taxed?",
                "Binding. Mei signed it on 18 March 2024 in front of two adult witnesses who aren't named in it; it's a lapsing nomination valid to 18 March 2027. " +
                "Robert and Lily are her children — SIS dependants — so we must pay 50/50 as nominated, with no trustee discretion. For tax, adult children who weren't " +
                "financially dependent are non-dependants, so 17% is withheld from the taxable component, and it's paid as lump sums.\n" +
                "Recommendation: pay 50% each, as nominated."),
            new("investment-analyst",
                "And the portfolio?",
                "I'll redeem Mei's pension portfolio to cash. Values can move until the sale completes, so the final amounts depend on the sale proceeds — the figures " +
                "we're quoting are based on the $486,200 balance.\n" +
                "Recommendation: redeem now so the family isn't kept waiting."),
            new("payments",
                "What will each of them receive?",
                "Each child: $243,100 gross — $92,378 tax-free (38%) and $150,722 taxable (62%) — with $25,622.74 withheld at 17%, so $217,477.26 net. " +
                "Both accounts are in the beneficiaries' own names. Every death benefit needs your approval, so I'll raise one Teams card per payment.\n" +
                "Recommendation: approve both payments."),
            new("client-communications",
                "And the family?",
                "Separate, gentle condolence letters to Robert and Lily — the payment, a plain-English explanation of why 17% applies to the taxable part, what happens next, " +
                "one name and number to call, and their complaint rights: us first, then AFCA. With the family's consent, Marcus Tan gets a short update. " +
                "I'll call Robert before the letters go.\n" +
                "Recommendation: human-reviewed before sending."),
        ],
            $"Thank you all — let's do this right for the Chen family. Plan for {c.CaseNumber}:\n" +
            "1. Binding nomination confirmed — pay 50/50 to Robert and Lily, as Mei asked (Ben).\n" +
            "2. Ivy redeems the portfolio; Penny raises the Teams approvals and I'll approve both: $243,100 gross, $25,622.74 withheld, $217,477.26 net each.\n" +
            "3. Cara stays the family's single contact — she calls Robert, then sends both condolence letters after my review; Marcus is updated with consent.\n" +
            "4. I'll keep the complaint clock in view — up to 90 days for a death benefit complaint, though we hope none arises.\n" +
            "Outcome: benefit paid ✅"),

        _ => GenericScript(c)
    };

    private static GroupChatScript GenericScript(CaseRecord c)
    {
        var type = c.RequestType ?? string.Empty;
        var t = type.ToLowerInvariant();
        var rule =
            t.Contains("smsf") ? "a rollover to an SMSF must pass the ATO SMSF verification service before anything moves" :
            t.Contains("pension") ? "the condition of release, the $2.1 million transfer balance cap and the minimum drawdown" :
            t.Contains("hardship") ? "26 weeks of income support and the $1,000–$10,000, once-in-12-months limit" :
            t.Contains("death") ? "the nomination's validity and who counts as a dependant" :
            t.Contains("account") ? "ID, TFN, signatures, fee consent (s99FA), two-witness nominations and any insurance that ends on rollover" :
            "the PDS, the trust deed and super law";

        return new GroupChatScript(
        [
            new("onboarding",
                "What's on the case, and is it in good order?",
                $"{c.RequestType} for {c.ClientName} ({c.MemberNumber}), received {c.ReceivedDate}. {c.RequestSummary} Priority {c.Priority}: {c.PriorityReason}\n" +
                "Recommendation: route to Benefits & Eligibility for the rules check."),
            new("benefits-eligibility",
                "What rules apply here?",
                $"I'll check it against the PDS, trust deed and super law — in particular {rule} — and cite each clause.\n" +
                "Recommendation: assess before anything moves."),
            new("financial-crime",
                "Any screening concerns?",
                "I'll verify identity and check for any recent change of contact or bank details before money moves.\n" +
                "Recommendation: no hold unless screening flags something."),
            new("payments",
                "Anything for Payments yet?",
                "Nothing to pay until Ben's decision is approved; I'll check the payee and calculate any tax then.\n" +
                "Recommendation: wait for the eligibility decision."),
            new("client-communications",
                "What does the member hear today?",
                "An acknowledgement today — the reference, what happens next, how to contact us and their right to complain.\n" +
                "Recommendation: send the acknowledgement."),
        ],
            $"Plan for {c.CaseNumber}:\n" +
            "1. Ben assesses against the rules and recommends approve, partial or decline.\n" +
            "2. Felix completes screening before any money moves.\n" +
            "3. Cara acknowledges the request today.\n" +
            "4. I'll review any decline, partial approval or high-value payment before it goes ahead.");
    }
}
