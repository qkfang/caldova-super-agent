namespace CaldovaSuper.App.Models;

/// <summary>
/// One step in a scripted member-case scenario, owned by a specific AI agent
/// in the operations office.
/// </summary>
public record ScenarioStep(
    int Number,
    string Title,
    string AgentName,
    string AgentIcon,
    string Summary);

/// <summary>
/// Metadata and steps for one of the five scripted Caldova Wealth demo
/// scenarios. Rendered by <c>Components/Pages/Scenarios/Scenario.razor</c>
/// and listed in the NavMenu and on the home page.
/// </summary>
public record ScenarioDefinition(
    string Id,
    string Number,
    string Title,
    string ShortTitle,
    string Customer,
    string Persona,
    string Tagline,
    string CaseNumber,
    string Outcome,
    IReadOnlyList<ScenarioStep> Steps,
    string Icon,
    string Accent);

/// <summary>
/// Static catalog of the five Caldova Wealth demo scenarios. Mirrors the
/// scripts in <c>docs/scenario-1..5</c>, the seeded cases in
/// <c>CaseStore.SeedDefaults</c> and the 3D frontend scenario files.
/// </summary>
public static class ScenarioCatalog
{
    private const string Onboarding = "Onboarding Agent";
    private const string Benefits = "Benefits & Eligibility Agent";
    private const string Investments = "Investment Analyst Agent";
    private const string FinCrime = "Financial Crime Agent";
    private const string Transfers = "Transfers & Rollovers Agent";
    private const string Payments = "Payments Agent";
    private const string Comms = "Client Communications Agent";
    private const string Leader = "Team Leader Agent";

    public static IReadOnlyList<ScenarioDefinition> All { get; } = new[]
    {
        // ── 1. Priya — new client onboarding & consolidation ────────────────
        new ScenarioDefinition(
            Id: "new-client-onboarding",
            Number: "1",
            Title: "New Client Onboarding & Super Consolidation",
            ShortTitle: "New client onboarding",
            Customer: "Priya Natarajan",
            Persona: "Priya Natarajan — new advised client (via Yarra Private Wealth)",
            Tagline: "An adviser's application pack becomes a clean, compliant account in one pass.",
            CaseNumber: "REQ-20261103-OPS001",
            Outcome: "Account opened ✅",
            Steps: new[]
            {
                new ScenarioStep(1, "Application received", Onboarding, "📥",
                    "Hannah Lewis emails Priya's application pack to Caldova New Business."),
                new ScenarioStep(2, "KYC & AML screening", FinCrime, "🛡️",
                    "Screen the new member before any money moves."),
                new ScenarioStep(3, "Rules check", Benefits, "📋",
                    "Check the application against the PDS, trust deed and super law."),
                new ScenarioStep(4, "Consolidation", Transfers, "🔁",
                    "Bring Priya's old super across — without losing cover by accident."),
                new ScenarioStep(5, "Portfolio fit & fees", Investments, "📈",
                    "Confirm the Growth model and show the fees in dollars."),
                new ScenarioStep(6, "Invest on arrival", Payments, "💳",
                    "Invest incoming money as it lands."),
                new ScenarioStep(7, "Welcome & adviser update", Comms, "✉️",
                    "Tell Priya and Hannah exactly where things stand."),
            },
            Icon: "💼",
            Accent: "#0ea5e9"),

        // ── 2. Grace — identity takeover & fake SMSF rollover blocked ───────
        new ScenarioDefinition(
            Id: "account-takeover-blocked",
            Number: "2",
            Title: "Identity Takeover & Fake SMSF Rollover — Blocked",
            ShortTitle: "Account takeover blocked",
            Customer: "Grace Williams",
            Persona: "Grace Williams — member travelling overseas",
            Tagline: "A full-balance rollover to a nine-day-old SMSF is stopped before a cent leaves.",
            CaseNumber: "REQ-20261106-OPS002",
            Outcome: "Request blocked 🛡️",
            Steps: new[]
            {
                new ScenarioStep(1, "Rollover request received", Onboarding, "📥",
                    "An 'urgent' email asks to roll Grace's whole balance to an SMSF."),
                new ScenarioStep(2, "Rollover rules", Benefits, "📋",
                    "Check the rules for a rollover to an SMSF."),
                new ScenarioStep(3, "Account-takeover investigation", FinCrime, "🛡️",
                    "Join up the timeline and the documents."),
                new ScenarioStep(4, "Hold the rollover", Transfers, "🔁",
                    "Stop the money leaving while the request is verified."),
                new ScenarioStep(5, "Approve the block", Leader, "🧭",
                    "A human decides."),
                new ScenarioStep(6, "Funds protected", Payments, "💳",
                    "Make sure no money moves."),
                new ScenarioStep(7, "Contact Grace", Comms, "✉️",
                    "Reach the real Grace on details we already trust."),
            },
            Icon: "🛡️",
            Accent: "#ef4444"),

        // ── 3. George — retirement: account-based pension ───────────────────
        new ScenarioDefinition(
            Id: "retirement-pension",
            Number: "3",
            Title: "Retirement — Starting an Account-Based Pension",
            ShortTitle: "Retirement pension",
            Customer: "George Papadopoulos",
            Persona: "George Papadopoulos — retiring member (via Bayside Financial Partners)",
            Tagline: "From forty years on the tools to a steady, tax-free income.",
            CaseNumber: "REQ-20261109-OPS003",
            Outcome: "Pension started ✅",
            Steps: new[]
            {
                new ScenarioStep(1, "Pension application received", Onboarding, "📥",
                    "Marcus Tan emails George's signed pension application."),
                new ScenarioStep(2, "Eligibility & caps", Benefits, "📋",
                    "Apply the pension rules — and cite them."),
                new ScenarioStep(3, "Income strategy", Investments, "📈",
                    "Make the income dependable."),
                new ScenarioStep(4, "Pension transfer", Transfers, "🔁",
                    "Move the money into the pension phase."),
                new ScenarioStep(5, "Approve, commence & pay", Payments, "💳",
                    "Start the pension — after a human says yes."),
                new ScenarioStep(6, "Welcome to retirement", Comms, "✉️",
                    "Celebrate the milestone, clearly."),
            },
            Icon: "🎉",
            Accent: "#f59e0b"),

        // ── 4. Tom — financial hardship early release ───────────────────────
        new ScenarioDefinition(
            Id: "financial-hardship",
            Number: "4",
            Title: "Financial Hardship — Early Release of Super",
            ShortTitle: "Financial hardship",
            Customer: "Tom Bradley",
            Persona: "Tom Bradley — member in financial hardship (direct)",
            Tagline: "Every hardship rule applied — with precision and kindness.",
            CaseNumber: "REQ-20261111-OPS004",
            Outcome: "Partially approved — $10,000 🟡",
            Steps: new[]
            {
                new ScenarioStep(1, "Hardship application received", Onboarding, "📥",
                    "Tom's late-night email arrives with his Centrelink letter."),
                new ScenarioStep(2, "Hardship criteria", Benefits, "📋",
                    "Apply the severe financial hardship rules."),
                new ScenarioStep(3, "Human review", Leader, "🧭",
                    "A vulnerable member gets a human touch."),
                new ScenarioStep(4, "Redemption plan", Investments, "📈",
                    "Decide what to sell."),
                new ScenarioStep(5, "Calculate & pay", Payments, "💳",
                    "Get the tax right, then pay."),
                new ScenarioStep(6, "A kind explanation", Comms, "✉️",
                    "Explain the outcome without jargon or judgement."),
            },
            Icon: "🤝",
            Accent: "#10b981"),

        // ── 5. Robert — death benefit under a binding nomination ────────────
        new ScenarioDefinition(
            Id: "death-benefit",
            Number: "5",
            Title: "Death Benefit — Binding Nomination",
            ShortTitle: "Death benefit",
            Customer: "Robert Chen",
            Persona: "Robert Chen — son of the late Mei Chen",
            Tagline: "Taking the paperwork weight off a grieving family.",
            CaseNumber: "REQ-20261113-OPS005",
            Outcome: "Benefit paid ✅",
            Steps: new[]
            {
                new ScenarioStep(1, "Death notification", Onboarding, "📥",
                    "Robert's email arrives with the claim form and certified documents."),
                new ScenarioStep(2, "Compassionate oversight", Leader, "🧭",
                    "A senior human owns the case."),
                new ScenarioStep(3, "Document checks", FinCrime, "🛡️",
                    "Verify the documents quietly in the background."),
                new ScenarioStep(4, "Nomination & dependants", Benefits, "📋",
                    "Confirm who must be paid — and how they're taxed."),
                new ScenarioStep(5, "Redeem the portfolio", Investments, "📈",
                    "Turn the pension's investments into cash."),
                new ScenarioStep(6, "Calculate & pay", Payments, "💳",
                    "Per-beneficiary components and tax, then approval."),
                new ScenarioStep(7, "Gentle letters", Comms, "✉️",
                    "Write the letters the family will keep."),
            },
            Icon: "🤍",
            Accent: "#a855f7"),
    };

    public static ScenarioDefinition? FindById(string id) =>
        All.FirstOrDefault(s => string.Equals(s.Id, id, StringComparison.OrdinalIgnoreCase));
}
