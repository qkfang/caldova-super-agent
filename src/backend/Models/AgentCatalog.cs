namespace CaldovaSuper.App.Models;

/// <summary>
/// Lightweight metadata for one of the eight Caldova Wealth operations
/// agents. The detailed page content is hand-written in
/// <c>Components/Pages/Agents/&lt;Agent&gt;.razor</c>; this catalog powers
/// navigation (Home, NavMenu) and the chat "references" surface.
/// </summary>
public record AgentDefinition(
    string Id,
    string Name,
    string Department,
    string Persona,
    string Tagline,
    string Purpose,
    IReadOnlyList<string> Responsibilities,
    string Icon,
    string Accent);

/// <summary>
/// Static catalog of all eight Caldova Wealth client operations agents.
/// Mirrors the agents in <c>src/agent/Agents</c> and the team table in
/// <c>docs/foundry_agents.md</c>.
/// </summary>
public static class AgentCatalog
{
    public static IReadOnlyList<AgentDefinition> All { get; } = new[]
    {
        new AgentDefinition(
            Id: "onboarding",
            Name: "Onboarding Agent",
            Department: "Onboarding & Requests",
            Persona: "Olivia — Onboarding & Requests Officer",
            Tagline: "Every application and request, set up right first time.",
            Purpose: "Reads adviser emails, application forms and member requests, extracts every field, runs the NIGO checklist and opens a structured Member Case so the rest of the team can pick it up.",
            Responsibilities: new[]
            {
                "Watch the new-business and member-requests inboxes.",
                "Extract client, adviser, product, amount and nomination details from forms.",
                "Run the NIGO checklist — ID, TFN, signatures, witnesses, fee consent, insurance elections.",
                "Set priority and flag vulnerable members or possible scams.",
                "Open the Member Case and route it to the right specialist.",
            },
            Icon: "📥",
            Accent: "#0ea5e9"),

        new AgentDefinition(
            Id: "benefits-eligibility",
            Name: "Benefits & Eligibility Agent",
            Department: "Benefits & Eligibility",
            Persona: "Ben — Benefits & Eligibility Assessor",
            Tagline: "Applies the trust deed, PDS and super law — and cites every rule.",
            Purpose: "Assesses each request against conditions of release, caps, pension standards, nomination rules and fee-consent requirements, then recommends approve, partial or decline for a human to confirm.",
            Responsibilities: new[]
            {
                "Check conditions of release, preservation and financial-hardship criteria.",
                "Apply the transfer balance cap and minimum pension drawdowns.",
                "Validate binding death benefit nominations and SIS dependants.",
                "Confirm adviser fee consent (s99FA) and SMSF rollover requirements.",
                "Recommend approve / partial / decline with every rule cited.",
            },
            Icon: "📋",
            Accent: "#6366f1"),

        new AgentDefinition(
            Id: "investment-analyst",
            Name: "Investment Analyst Agent",
            Department: "Investment Solutions",
            Persona: "Ivy — Investment Analyst",
            Tagline: "Keeps portfolios on plan — and shows the fees in dollars.",
            Purpose: "Checks model-portfolio fit against the client's risk profile, compares Caldova Managed Portfolios on fees, returns and risk, designs pension income strategies and redemption plans, and builds the client workbook.",
            Responsibilities: new[]
            {
                "Check the selected model against the SoA risk profile.",
                "Compare models on annual cost in dollars, allocation and risk.",
                "Design cash-bucket income strategies for new pensions.",
                "Plan redemptions for withdrawals and death benefits.",
                "Produce an Excel workbook and chart via MCP tools.",
            },
            Icon: "📈",
            Accent: "#f59e0b"),

        new AgentDefinition(
            Id: "financial-crime",
            Name: "Financial Crime Agent",
            Department: "Financial Crime",
            Persona: "Felix — Financial Crime Investigator",
            Tagline: "Protects members from fraud, scams and identity takeover.",
            Purpose: "Builds the account-activity timeline, checks identity documents for tampering, tests SMSF rollovers against red flags, scores risk explainably and recommends holds and call-backs — the human decides.",
            Responsibilities: new[]
            {
                "Timeline contact-detail changes, new devices and money-out requests.",
                "Check ID documents and certificates for authenticity.",
                "Test SMSF rollovers against SVS results and known red flags.",
                "Produce an explainable risk score — never accusing the member.",
                "Recommend holds, call-backs on verified numbers and SMR consideration.",
            },
            Icon: "🛡️",
            Accent: "#ef4444"),

        new AgentDefinition(
            Id: "transfers-rollovers",
            Name: "Transfers & Rollovers Agent",
            Department: "Transfers & Rollovers",
            Persona: "Rory — Transfers & Rollovers Coordinator",
            Tagline: "Moves money between funds safely — and on time.",
            Purpose: "Coordinates SuperStream rollovers in and out, SMSF rollovers, in-specie transfers and pension transfers — warning about insurance that would be lost, verifying SMSFs and tracking counterparty SLAs.",
            Responsibilities: new[]
            {
                "Identify counterparties by USI from the external fund directory.",
                "Warn about insurance cover that ends on rollover.",
                "Verify SMSFs before any rollover out (SVS, bank and ESA match).",
                "Generate the transfer request PDF and track the 3-business-day SLA.",
                "Draft member and adviser transfer updates.",
            },
            Icon: "🔁",
            Accent: "#10b981"),

        new AgentDefinition(
            Id: "payments",
            Name: "Payments Agent",
            Department: "Payments",
            Persona: "Penny — Payments Officer",
            Tagline: "Gets the tax right, then waits for the human approval.",
            Purpose: "Validates the payee, splits tax-free and taxable components, calculates PAYG withholding, checks authority limits and raises a Microsoft Teams approval — releasing money only after a human approves.",
            Responsibilities: new[]
            {
                "Validate the payee and bank details against the case.",
                "Confirm the eligibility decision and approved amount.",
                "Calculate components, PAYG withholding and the net payment.",
                "Check authority limits and raise a Teams approval card.",
                "Release the payment only after approval.",
            },
            Icon: "💳",
            Accent: "#a855f7"),

        new AgentDefinition(
            Id: "client-communications",
            Name: "Client Communications Agent",
            Department: "Client Communications",
            Persona: "Cara — Client Communications Specialist",
            Tagline: "Plain-English updates for members and their advisers.",
            Purpose: "Drafts member letters, adviser updates, SMS and call scripts that explain decisions clearly and kindly — matching tone to bereavement, hardship or a fraud scare — and takes calls as Cara via Voice Live.",
            Responsibilities: new[]
            {
                "Draft member letters and adviser updates at every stage.",
                "Explain rules, caps and tax in plain English.",
                "Match tone to bereavement, hardship and fraud-victim situations.",
                "Check every message for required disclosures and complaint rights.",
                "Take calls as Cara through Voice Live.",
            },
            Icon: "✉️",
            Accent: "#ec4899"),

        new AgentDefinition(
            Id: "team-leader",
            Name: "Team Leader Agent",
            Department: "Team Leader Office",
            Persona: "Theo — Client Operations Team Leader",
            Tagline: "Watches the whole floor — SLAs, IDR clocks and approvals.",
            Purpose: "Oversees workload and service levels, queues human approvals, protects vulnerable members and coordinates the other seven agents in a live group chat on any case.",
            Responsibilities: new[]
            {
                "Track rollover, contribution and complaint (IDR) clocks.",
                "Queue approvals — holds, high-value payments, death benefits, hardship.",
                "Make sure vulnerable members get a human touch.",
                "Run QA sampling and coaching insights.",
                "Orchestrate the multi-agent group chat on a case.",
            },
            Icon: "🧭",
            Accent: "#14b8a6"),
    };

    public static AgentDefinition? FindById(string id) =>
        All.FirstOrDefault(a => string.Equals(a.Id, id, StringComparison.OrdinalIgnoreCase));
}
