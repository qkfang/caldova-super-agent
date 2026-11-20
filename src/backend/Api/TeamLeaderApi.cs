using System.Text;
using CaldovaSuper.Agents;
using CaldovaSuper.App.Services;

namespace CaldovaSuper.App.Api;

record TeamLeaderProcessRequest(string CaseNumber);

/// <summary>
/// HTTP endpoints behind the "Try it out" tab on the Team Leader agent page
/// (<c>/agents/team-leader</c>):
///
/// 1. List the Member Cases held in <see cref="CaseStore"/> so the user can
///    pick the case Theo should focus on.
/// 2. Engage the Team Leader Agent. The page always receives Theo's
///    deterministic floor dashboard — counts by stage, SLA and IDR clocks,
///    escalations, the approval queue, vulnerable members, coaching insights
///    and today's priorities — built from the cases on the floor (the five
///    scenario cases sit at their decision points). When Foundry is
///    configured the live agent reviews the same floor and its streamed
///    narrative is shown alongside.
/// </summary>
public static class TeamLeaderApi
{
    // ── Dashboard shapes (serialised camelCase to the page) ───────────────────
    internal record StageCount(string Stage, int Count, string Hint);
    internal record FloorCase(string CaseNumber, string ClientName, string RequestType, string Priority, string Stage, string Owner, string NextAction);
    internal record FloorClock(string Clock, string CaseNumber, string ClientName, string Rule, string Status, string State);
    internal record Escalation(string CaseNumber, string ClientName, string Severity, string Reason, string Owner, string Clock);
    internal record ApprovalItem(int Priority, string CaseNumber, string ClientName, string Item, string Authority, string Recommendation, string Due);
    internal record VulnerableMember(string CaseNumber, string ClientName, string Flag, string Handling);
    internal record CaseFocus(
        string CaseNumber, string ClientName, string RequestType, string Stage, string Owner,
        string Summary, string Decision, string Recommendation, IReadOnlyList<string> KeyFacts);
    internal record FloorView(
        string AsAt,
        IReadOnlyList<StageCount> StageCounts,
        IReadOnlyList<FloorCase> Cases,
        IReadOnlyList<FloorClock> Clocks,
        IReadOnlyList<Escalation> Escalations,
        IReadOnlyList<ApprovalItem> Approvals,
        IReadOnlyList<VulnerableMember> Vulnerable,
        IReadOnlyList<string> Coaching,
        IReadOnlyList<string> Priorities);

    private record CaseProfile(
        string Stage,
        string Owner,
        string NextAction,
        IReadOnlyList<FloorClock> Clocks,
        Escalation? Escalation,
        ApprovalItem? Approval,
        VulnerableMember? Vulnerable,
        string Summary,
        string Decision,
        string Recommendation,
        string? Today = null);

    private const string Received = "Received";
    private const string InAssessment = "In assessment";
    private const string AwaitingApproval = "Awaiting approval";
    private const string AwaitingCounterparty = "Awaiting counterparty";
    private const string Completed = "Completed";

    public static void MapTeamLeaderEndpoints(
        this WebApplication app,
        CaseStore store,
        CaldovaAgentFactory factory,
        ILogger logger)
    {
        // Cases on the floor, most recent first — populates the case picker
        // on both the Try it out and Group Chat tabs.
        app.MapGet("/team-leader/cases", () =>
        {
            var cases = store.All().Select(c => new
            {
                caseNumber = c.CaseNumber,
                clientName = c.ClientName,
                requestType = c.RequestType,
                memberNumber = c.MemberNumber,
                priority = c.Priority,
                receivedDate = c.ReceivedDate,
                createdAt = c.CreatedAt
            });
            return Results.Ok(cases);
        });

        // Full Member Case record for a single case.
        app.MapGet("/team-leader/cases/{caseNumber}", (string caseNumber) =>
        {
            var record = store.Get(caseNumber);
            return record is null
                ? Results.NotFound(new { error = $"case '{caseNumber}' not found" })
                : Results.Ok(record);
        });

        // Engage Theo on the selected case: the deterministic floor view is
        // always returned; with Foundry configured the live agent reviews the
        // same floor (streamed over SSE when the client asks for it).
        app.MapPost("/team-leader/process", async (HttpContext httpContext, TeamLeaderProcessRequest request) =>
        {
            if (string.IsNullOrWhiteSpace(request.CaseNumber))
                return Results.BadRequest(new { error = "caseNumber is required" });

            var focusCase = store.Get(request.CaseNumber);
            if (focusCase is null)
                return Results.NotFound(new { error = $"case '{request.CaseNumber}' not found" });

            logger.LogInformation("Team Leader process: caseNumber={CaseNumber}", Sanitize(focusCase.CaseNumber));

            var allCases = store.All();
            var floor = BuildFloor(allCases);
            var focus = BuildFocus(focusCase);
            var prompt = BuildPrompt(focusCase, focus, floor);

            object BuildEnvelope(AgentTraceResult? trace, string? agentError) => new
            {
                caseNumber = focusCase.CaseNumber,
                clientName = focusCase.ClientName,
                requestType = focusCase.RequestType,
                floor,
                focus,
                agentNotes = trace?.Text,
                agentError,
                agentConfigured = factory.IsConfigured,
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
                        streamingAgent = factory.Create("team-leader");
                    }
                    catch (Exception ex)
                    {
                        logger.LogWarning(ex, "Team Leader Agent could not be created; showing the deterministic floor view");
                        createError = ex.Message;
                    }
                }
                await AgentSseStreaming.StreamAsync(
                    httpContext,
                    streamingAgent,
                    prompt,
                    (trace, error) => BuildEnvelope(trace, error ?? createError),
                    logger,
                    "Team Leader Agent");
                return Results.Empty;
            }

            AgentTraceResult? traceResult = null;
            string? agentInvocationError = null;
            if (factory.IsConfigured)
            {
                try
                {
                    var agent = factory.Create("team-leader");
                    traceResult = await agent.RunWithTraceAsync(prompt);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Team Leader Agent invocation failed; showing the deterministic floor view");
                    agentInvocationError = ex.Message;
                }
            }

            return Results.Ok(BuildEnvelope(traceResult, agentInvocationError));
        });
    }

    // ── Floor model ───────────────────────────────────────────────────────────
    private static FloorView BuildFloor(IReadOnlyList<CaseRecord> cases)
    {
        var profiles = cases.Select(c => (Case: c, Profile: ProfileFor(c))).ToList();

        string[] stages = [Received, InAssessment, AwaitingApproval, AwaitingCounterparty, Completed];
        var hints = new Dictionary<string, string>
        {
            [Received] = "opened by Olivia, awaiting triage",
            [InAssessment] = "with Ben, Felix or Ivy",
            [AwaitingApproval] = "on Theo's desk",
            [AwaitingCounterparty] = "with other funds, advisers or the ATO",
            [Completed] = "closed",
        };
        var stageCounts = stages
            .Select(s => new StageCount(s, profiles.Count(p => p.Profile.Stage == s), hints[s]))
            .ToList();

        var floorCases = profiles
            .Select(p => new FloorCase(p.Case.CaseNumber, p.Case.ClientName, p.Case.RequestType, p.Case.Priority,
                p.Profile.Stage, p.Profile.Owner, p.Profile.NextAction))
            .ToList();

        var clocks = profiles
            .SelectMany(p => p.Profile.Clocks)
            .OrderBy(c => StateRank(c.State))
            .ToList();

        // Escalations: most severe first, then in approval-queue order.
        var escalations = profiles
            .Where(p => p.Profile.Escalation is not null)
            .OrderBy(p => SeverityRank(p.Profile.Escalation!.Severity))
            .ThenBy(p => p.Profile.Approval?.Priority ?? int.MaxValue)
            .Select(p => p.Profile.Escalation!)
            .ToList();

        var approvals = profiles
            .Where(p => p.Profile.Approval is not null)
            .Select(p => p.Profile.Approval!)
            .OrderBy(a => a.Priority)
            .ToList();

        var vulnerable = profiles
            .Where(p => p.Profile.Vulnerable is not null)
            .Select(p => p.Profile.Vulnerable!)
            .ToList();

        var seededSamples = profiles
            .Where(p => IsSeeded(p.Case))
            .Select(p => (p.Case.SampleId ?? string.Empty).ToLowerInvariant())
            .ToHashSet();

        var coaching = new List<string>();
        if (seededSamples.Contains("rollover-grace"))
            coaching.Add("Account takeover (Grace): a phone change of contact details passed knowledge-based checks using data likely exposed in a 2025 breach. " +
                         "Coach the contact centre on step-up verification to the existing number and a hold on withdrawals and rollovers after any change of details — APRA expects MFA for these.");
        if (seededSamples.Contains("onboarding-priya"))
            coaching.Add("NIGO (Priya): one-witness nominations and un-ticked insurance-loss acknowledgements are common adviser NIGO items. " +
                         "Share the checklist with Yarra Private Wealth so packs arrive in good order first time.");
        if (seededSamples.Contains("hardship-tom"))
            coaching.Add("Hardship (Tom): lead with what we can do, explain the $10,000 cap in one sentence and always include free counselling (National Debt Helpline 1800 007 007) — use Tom's letter as the QA exemplar.");
        if (seededSamples.Contains("death-benefit-robert"))
            coaching.Add("Bereavement (Chen family): one named contact, no process jargon, every letter human-reviewed — and tell the family what happens next before they have to ask.");
        if (seededSamples.Contains("pension-george"))
            coaching.Add("Retirement (George): a one-table payment schedule answers most new-retiree questions before they're asked — reuse Cara's format.");
        coaching.Add("QA sampling: 100% of blocks, declines, partial approvals and bereavement letters; 1 in 5 routine completions.");

        // Today's priorities: the approval queue in order, then other
        // follow-ups, then triage of anything newly received.
        var priorities = profiles
            .Where(p => p.Profile.Today is not null)
            .OrderBy(p => p.Profile.Approval?.Priority ?? int.MaxValue)
            .Select(p => $"{p.Case.CaseNumber} — {p.Profile.Today}")
            .ToList();
        var received = profiles.Count(p => p.Profile.Stage == Received);
        if (received > 0)
            priorities.Add($"Triage the {received} newly received case{(received == 1 ? "" : "s")} with Olivia and route each to the right specialist.");

        var asAt = $"{cases.Count} open Member Case{(cases.Count == 1 ? "" : "s")} · scenario cases shown at their decision points";

        return new FloorView(asAt, stageCounts, floorCases, clocks, escalations, approvals, vulnerable, coaching, priorities);
    }

    private static CaseFocus BuildFocus(CaseRecord c)
    {
        var p = ProfileFor(c);
        IReadOnlyList<string> facts = IsSeeded(c)
            ? TeamLeaderGroupChatService.KeyFacts(c)
            :
            [
                $"{c.RequestType} for {c.ClientName} ({c.MemberNumber}), received {c.ReceivedDate}.",
                c.RequestSummary,
                $"Amount: {c.Amount}. Priority: {c.Priority} — {c.PriorityReason}",
                ClientCommunicationsDrafter.HasAdviser(c)
                    ? $"Adviser: {c.AdviserName}{(string.IsNullOrWhiteSpace(c.AdviserPractice) ? "" : " (" + c.AdviserPractice + ")")}."
                    : "Direct member — no adviser on the account.",
            ];
        return new CaseFocus(
            c.CaseNumber, c.ClientName, c.RequestType, p.Stage, p.Owner,
            p.Summary, p.Decision, p.Recommendation, facts);
    }

    private static bool IsSeeded(CaseRecord c) =>
        CaseStore.IsScenarioCaseNumber(c.CaseNumber);

    private static string Sample(CaseRecord c) => (c.SampleId ?? string.Empty).ToLowerInvariant();

    // Where each case sits on the floor. Seeded scenario cases are shown at
    // the point they reach Theo's desk; cases opened live by the Onboarding
    // demo are freshly received.
    private static CaseProfile ProfileFor(CaseRecord c)
    {
        if (!IsSeeded(c)) return ReceivedProfile(c);

        var n = c.CaseNumber;
        var who = c.ClientName;
        switch (Sample(c))
        {
            case "onboarding-priya":
                return new CaseProfile(
                    Stage: AwaitingCounterparty,
                    Owner: "Rory (Transfers & Rollovers)",
                    NextAction: "Harbourline rollover in flight; Southern Cross held for the adviser's insurance confirmation; nomination re-sign outstanding.",
                    Clocks:
                    [
                        new("SuperStream rollover in — Harbourline", n, who,
                            "3 business days once Harbourline has all required information (SIS reg 6.34A)",
                            "Running — requested via SuperStream", "running"),
                        new("SuperStream rollover in — Southern Cross", n, who,
                            "3 business days once all required information is received",
                            "Not started — held until the $520,000 Death & TPD cover decision is confirmed in writing", "paused"),
                        new("Payday Super allocation", n, who,
                            "Allocate (or return) each SG contribution within 3 business days of receipt",
                            "Starts when Priya's first employer contribution arrives", "watch"),
                    ],
                    Escalation: new(n, who, "Watch",
                        "Southern Cross rollover (~$96,400) held — ending $520,000 of Death & TPD cover needs written confirmation; the nomination has only one witness.",
                        "Rory → Hannah Lewis (adviser)", "Southern Cross clock paused"),
                    Approval: null,
                    Vulnerable: null,
                    Summary: "New advised Caldova Super (Select) account CS-2049817 open in the Growth model; consolidating ~$138,200 from two external funds.",
                    Decision: "No approval needed — account opening is within delegated authority.",
                    Recommendation: "Have Rory chase Hannah for the written insurance decision so $96,400 isn't left waiting; Cara's welcome email and adviser update are ready to go.",
                    Today: "Ask Rory to chase Hannah for Priya's written insurance decision so the ~$96,400 Southern Cross rollover isn't left waiting.");

            case "rollover-grace":
                return new CaseProfile(
                    Stage: AwaitingApproval,
                    Owner: "Felix (Financial Crime) → Theo",
                    NextAction: "Approve the block and the SMR referral; Cara calls Grace on her pre-change verified number.",
                    Clocks:
                    [
                        new("SMR to AUSTRAC", n, who,
                            "Within 3 business days of forming a suspicion",
                            "Due Wed 11 Nov 2026 (suspicion formed Fri 6 Nov)", "due"),
                        new("SuperStream rollover out", n, who,
                            "3 business days once all required information is received and verified (SIS reg 6.34A)",
                            "Not running — SMSF verification failed; rollover held and cancelled", "paused"),
                    ],
                    Escalation: new(n, who, "Urgent",
                        "Suspected identity takeover: full-balance rollover ($612,400) to a nine-day-old SMSF; SVS failed; contact details changed ~93 hours earlier; tampered licence; payee name mismatch.",
                        "Felix → Theo", "SMR due Wed 11 Nov 2026"),
                    Approval: new(1, n, who,
                        "Block the rollover on financial-crime grounds + SMR referral to the AML/CTF compliance officer",
                        "Financial-crime blocks and SMRs always need a human decision",
                        "Approve the block and the confidential SMR referral; keep the payment block until Grace re-verifies",
                        "SMR by Wed 11 Nov 2026"),
                    Vulnerable: new(n, who,
                        "Identity-takeover victim, travelling overseas (Italy)",
                        "Contact only on pre-change verified details; human-approved reassurance letter; IDCARE referral; never mention the SMR"),
                    Summary: "Full-balance rollover ($612,400) to a newly registered SMSF after a phone change of details — financial-crime risk HIGH.",
                    Decision: "Approve the block and the SMR referral.",
                    Recommendation: "Approve now — the 3-business-day SMR clock is the tightest on the floor, and no money has moved.",
                    Today: "Approve Grace's block and the SMR referral first — the SMR clock (due Wed 11 Nov 2026) is the tightest on the floor.");

            case "pension-george":
                return new CaseProfile(
                    Stage: AwaitingApproval,
                    Owner: "Penny (Payments) → Theo",
                    NextAction: "Approve the $1,250,000 commencement in Teams so the pension starts Mon 16 Nov 2026.",
                    Clocks:
                    [
                        new("Pension commencement", n, who,
                            "Requested start date — needs approval first (≥ $1,000,000)",
                            "Mon 16 Nov 2026", "due"),
                        new("First pension payment", n, who,
                            "$6,500 on the 15th of each month, tax-free",
                            "Tue 15 Dec 2026", "watch"),
                    ],
                    Escalation: new(n, who, "High",
                        "Pension commencement of $1,250,000 — above Payments' authority (commencements of $1,000,000 or more).",
                        "Penny → Theo", "Start Mon 16 Nov 2026"),
                    Approval: new(3, n, who,
                        "Pension commencement — $1,250,000 into Caldova Pension CP-3077881",
                        "Commencements of $1,000,000 or more",
                        "Approve — age 65 met, $850,000 of transfer balance cap left, $38,870 minimum covered ($45,500 scheduled)",
                        "before Mon 16 Nov 2026"),
                    Vulnerable: null,
                    Summary: "Account-based pension of $1,250,000 paying $6,500 a month from 15 Dec 2026; Helen as reversionary beneficiary.",
                    Decision: "Approve the commencement (authority limit: $1,000,000 or more).",
                    Recommendation: "Approve in Teams — every rule check passed and Cara's welcome-to-retirement letter is ready.",
                    Today: "Approve George's $1,250,000 pension commencement in Teams ahead of the Mon 16 Nov 2026 start.");

            case "hardship-tom":
                return new CaseProfile(
                    Stage: AwaitingApproval,
                    Owner: "Ben (Benefits & Eligibility) → Theo",
                    NextAction: "Vulnerable-member review, then approve the $10,000 partial release so Penny can pay on Friday.",
                    Clocks:
                    [
                        new("Hardship payment", n, who,
                            "Pay once the partial release is approved",
                            "Target Fri 13 Nov 2026 — $7,932 net", "due"),
                        new("Complaint (IDR) clock", n, who,
                            "45 days for super trustee complaints (RG 271)",
                            "Not running — starts only if Tom complains about the partial decision", "watch"),
                    ],
                    Escalation: new(n, who, "High",
                        "Vulnerable member (financial hardship); $15,000 requested exceeds the $10,000 legal maximum — partial approval.",
                        "Ben → Theo", "Pay Fri 13 Nov 2026"),
                    Approval: new(2, n, who,
                        "Partial hardship release — $10,000 gross of $15,000 requested",
                        "Partial approvals and hardship releases (vulnerable member)",
                        "Approve $10,000 — $2,068 PAYG withheld, $7,932 net; kind letter with the National Debt Helpline (1800 007 007)",
                        "Fri 13 Nov 2026"),
                    Vulnerable: new(n, who,
                        "Financial hardship; visible distress (late-night application)",
                        "Human review; kind plain-English letter; National Debt Helpline 1800 007 007 and Moneysmart; offer a call"),
                    Summary: "Severe financial hardship — every criterion met, capped at $10,000 by law.",
                    Decision: "Approve the partial release ($10,000 of $15,000).",
                    Recommendation: "Approve today so $7,932 reaches Tom on Friday, and read Cara's letter for tone before it goes.",
                    Today: "Review Tom's vulnerable-member brief and approve the $10,000 partial release so Penny can pay $7,932 on Fri 13 Nov 2026.");

            case "death-benefit-robert":
                return new CaseProfile(
                    Stage: AwaitingApproval,
                    Owner: "Theo (case owner)",
                    NextAction: "Approve both death benefit payments once Ivy confirms the sale proceeds.",
                    Clocks:
                    [
                        new("Pension payments", n, who,
                            "Stop on notification of death",
                            "Stopped on 13 Nov 2026", "ok"),
                        new("Complaint (IDR) clock", n, who,
                            "Up to 90 days for death benefit distribution complaints (RG 271)",
                            "Not running — no complaint open", "watch"),
                    ],
                    Escalation: new(n, who, "High",
                        "Bereavement — compassionate handling; every death benefit needs Team Leader approval.",
                        "Theo (case owner)", "Robert asked how long this will take — keep him updated"),
                    Approval: new(4, n, who,
                        "Death benefit — 2 × $243,100 gross to Robert and Lily Chen (binding nomination)",
                        "Every death benefit needs Team Leader approval",
                        "Approve both — nomination valid to 18 Mar 2027, documents genuine; $25,622.74 withheld (17%), $217,477.26 net each",
                        "on redemption of the portfolio"),
                    Vulnerable: new(n, "Robert & Lily Chen",
                        "Bereavement — their mother, Mei Chen, died on 12 Oct 2026",
                        "Theo owns the case; Cara is the single contact; human-approved condolence letters; Marcus updated only with consent"),
                    Summary: "Death benefit under a valid binding nomination — 50/50 to Mei Chen's two children.",
                    Decision: "Approve both death benefit payments.",
                    Recommendation: "Approve as soon as the sale completes; Cara calls Robert before the letters go.",
                    Today: "Approve the Chen death benefit payments ($217,477.26 net each) once the portfolio sale completes, and keep Cara as the family's single contact.");

            default:
                return ReceivedProfile(c);
        }
    }

    private static CaseProfile ReceivedProfile(CaseRecord c)
    {
        var n = c.CaseNumber;
        var who = c.ClientName;
        var t = (c.RequestType ?? string.Empty).ToLowerInvariant();

        var (next, clock, expected) =
            t.Contains("smsf") || t.Contains("rollover")
                ? ("Benefits & Eligibility, then Financial Crime",
                   new FloorClock("SuperStream rollover out", n, who,
                       "3 business days once all required information is received — SVS must pass first for an SMSF",
                       "Not started — verification pending", "paused"),
                   "a financial-crime block or SMR if verification fails")
            : t.Contains("pension")
                ? ("Benefits & Eligibility",
                   new FloorClock("Pension commencement", n, who,
                       "Commencements of $1,000,000 or more need approval",
                       "Amount checked at assessment", "watch"),
                   "the commencement, if $1,000,000 or more")
            : t.Contains("hardship")
                ? ("Benefits & Eligibility",
                   new FloorClock("Vulnerable-member review", n, who,
                       "Hardship releases need human approval before payment",
                       "Before any payment", "watch"),
                   "the hardship release (and any partial approval)")
            : t.Contains("death")
                ? ("Financial Crime (documents), then Benefits & Eligibility",
                   new FloorClock("Complaint (IDR) clock", n, who,
                       "Up to 90 days for death benefit distribution complaints",
                       "Not running", "watch"),
                   "every death benefit payment")
                : ("Financial Crime (KYC), then Benefits & Eligibility",
                   new FloorClock("Payday Super allocation", n, who,
                       "Allocate (or return) each SG contribution within 3 business days of receipt",
                       "Starts when the first contribution arrives", "watch"),
                   "nothing expected unless an exception arises");

        var priority = c.Priority ?? string.Empty;
        Escalation? escalation =
            priority.Equals("Urgent", StringComparison.OrdinalIgnoreCase) ? new(n, who, "Urgent", c.PriorityReason, "Olivia → " + next, "Triage now")
            : priority.Equals("High", StringComparison.OrdinalIgnoreCase) ? new(n, who, "High", c.PriorityReason, "Olivia → " + next, "Triage today")
            : null;

        VulnerableMember? vulnerable =
            t.Contains("hardship") ? new(n, who, "Financial hardship", "Human review; kind letter; free financial counselling details")
            : t.Contains("death") ? new(n, who, "Bereavement", "Compassionate handling; one named contact; human-approved letters")
            : t.Contains("smsf") ? new(n, who, "Possible scam target (rollover to an SMSF)", "Contact only on verified details held before any recent change")
            : null;

        return new CaseProfile(
            Stage: Received,
            Owner: "Olivia (Onboarding & Requests)",
            NextAction: $"Triage and route to {next}.",
            Clocks: [clock],
            Escalation: escalation,
            Approval: null,
            Vulnerable: vulnerable,
            Summary: c.RequestSummary,
            Decision: $"No decision yet — approval expected later for {expected}.",
            Recommendation: $"Route to {next}; Cara sends the acknowledgement today.");
    }

    private static int StateRank(string state) => state switch
    {
        "due" => 0,
        "running" => 1,
        "paused" => 2,
        "watch" => 3,
        _ => 4
    };

    private static int SeverityRank(string severity) => severity switch
    {
        "Urgent" => 0,
        "High" => 1,
        "Watch" => 2,
        _ => 3
    };

    // ── Prompt for the live Team Leader Agent ────────────────────────────────
    private static string BuildPrompt(CaseRecord c, CaseFocus focus, FloorView floor)
    {
        var sb = new StringBuilder();
        sb.AppendLine("TEAM LEADER FLOOR REVIEW — CALDOVA CLIENT OPERATIONS");
        sb.AppendLine("====================================================");
        sb.AppendLine($"Focus case     : {c.CaseNumber}");
        sb.AppendLine($"Client         : {c.ClientName} ({c.MemberNumber})");
        sb.AppendLine($"Product        : {c.Product}");
        sb.AppendLine($"Request type   : {c.RequestType}");
        sb.AppendLine($"Received       : {c.ReceivedDate}");
        sb.AppendLine($"Adviser        : {(string.IsNullOrWhiteSpace(c.AdviserPractice) ? c.AdviserName : $"{c.AdviserName} ({c.AdviserPractice})")}");
        sb.AppendLine($"Amount         : {c.Amount}");
        sb.AppendLine($"Priority       : {c.Priority} — {c.PriorityReason}");
        sb.AppendLine($"Stage / owner  : {focus.Stage} / {focus.Owner}");
        sb.AppendLine($"Request        : {c.RequestSummary}");
        sb.AppendLine();
        sb.AppendLine("KEY FACTS ON FILE (focus case)");
        foreach (var fact in focus.KeyFacts) sb.AppendLine($"- {fact}");
        sb.AppendLine();
        sb.AppendLine($"FLOOR SNAPSHOT — {floor.AsAt}");
        sb.AppendLine("Counts by stage: " + string.Join(", ", floor.StageCounts.Select(s => $"{s.Stage} {s.Count}")));
        foreach (var fc in floor.Cases)
            sb.AppendLine($"- {fc.CaseNumber} · {fc.ClientName} · {fc.RequestType} · {fc.Priority} · {fc.Stage} · owner {fc.Owner} · next: {fc.NextAction}");
        sb.AppendLine();
        sb.AppendLine("CLOCKS (rollover 3 business days; Payday Super allocation 3 business days; IDR 30/45/90 days; SMR 3 business days)");
        foreach (var clock in floor.Clocks)
            sb.AppendLine($"- [{clock.State}] {clock.Clock} — {clock.CaseNumber} ({clock.ClientName}): {clock.Status}. Rule: {clock.Rule}");
        sb.AppendLine();
        sb.AppendLine("ITEMS WAITING FOR HUMAN APPROVAL");
        foreach (var a in floor.Approvals)
            sb.AppendLine($"- {a.CaseNumber} ({a.ClientName}): {a.Item} — authority: {a.Authority}; due {a.Due}");
        sb.AppendLine();
        sb.AppendLine("VULNERABLE MEMBERS");
        foreach (var v in floor.Vulnerable)
            sb.AppendLine($"- {v.CaseNumber} ({v.ClientName}): {v.Flag}");
        sb.AppendLine();
        sb.AppendLine("TASK");
        sb.AppendLine("----");
        sb.AppendLine("Review the floor as Theo's Team Leader Agent and produce your structured output: Floor Summary, Escalations, " +
                      "Approval Queue, Quality / Coaching Insights and Recommended Priorities for Today. Lead with the focus case " +
                      "where it matters, state each clock's status, and flag vulnerable members for a human touch. Use only the facts " +
                      "above, cite the rule behind each approval, recommend — never decide — and never give personal financial advice.");
        return sb.ToString();
    }

    private static string Sanitize(string value) =>
        value.Replace('\r', ' ').Replace('\n', ' ');
}
