/**
 * Single source of truth for staff and client persona data.
 *
 * All persona-level facts (name, role/situation, personality, typical line,
 * scenario palette, request type & amount range) live here so that the
 * lakehouse's cast, its cards and the finale never disagree.
 *
 * Mirrors the Caldova Wealth canon (team in docs/foundry_agents.md and
 * docs/characters.md) and matches the palette keys defined in
 * `characterPalettes.ts`.
 */
import type { PALETTES } from "./characterPalettes";

export type PaletteKey = keyof typeof PALETTES;

export type StaffRole =
  | "Onboarding & Requests Officer"
  | "Benefits & Eligibility Assessor"
  | "Investment Analyst"
  | "Financial Crime Investigator"
  | "Transfers & Rollovers Coordinator"
  | "Payments Officer"
  | "Client Communications Specialist"
  | "Client Operations Team Leader";

/**
 * The two product teams that make up Caldova Client Operations, plus the
 * leadership that runs both. Level 2 of the lakehouse is organised by these
 * teams: the Wealth Management wing on the left, the Superannuation wing on
 * the right, and Theo between them.
 */
export type StaffTeam =
  | "Superannuation Team"
  | "Wealth Management Team"
  | "Client Operations Leadership";

export interface StaffPersona {
  /** Stable id used for click hitboxes and the lakehouse's anchors. */
  id: string;
  name: string;
  role: StaffRole;
  /** Team the staff member belongs to (decides their side of the business and their wing on Level 2). */
  team: StaffTeam;
  /** Department name shown in the UI (e.g. "Benefits & Eligibility"). */
  department: string;
  /** Human-readable role/duties summary (one line). */
  role_short: string;
  /** The role in one short sentence, as in docs/characters.md ("**Role:**"), for compact cards. */
  role_line: string;
  palette: PaletteKey;
  /** Accent colour for their desk, their agent's bay and their cards. */
  color: string;
  personality: string;
  /** Bullet list of "what they do". */
  responsibilities: string[];
  /** Their signature line, as in docs/characters.md. */
  typical_line: string;
  /** Rotating status lines shown while the staff member is idle at their desk. */
  ambient: string[];
  /**
   * Id of the matching agent walkthrough page in the companion `src/backend`
   * Blazor site. Mirrors an Id in `src/backend/Models/AgentCatalog.cs` and is
   * used to link to `/agents/{app_agent_id}`.
   */
  app_agent_id: string;
  /** Name of the AI agent working behind this staff member (as in the backend catalogue). */
  agent_name: string;
  /** One-line summary of what the agent does for them. */
  agent_tagline: string;
}

// Order matches docs/scenario-N-*.md:
//   1 onboarding, 2 protection, 3 retirement, 4 hardship, 5 bereavement.
export type ScenarioId =
  | "onboarding"
  | "protection"
  | "retirement"
  | "hardship"
  | "bereavement";

export interface CustomerPersona {
  id: ScenarioId;
  name: string;
  /** Short summary for cards. */
  situation: string;
  /** Long-form narrative. */
  situation_long: string;
  need: string[];
  concern: string;
  personality: string;
  typical_line: string;
  palette: PaletteKey;
  /** Headline request type (matches the backend RequestType values). */
  request_type: string;
  /** Scenario colour, used for the member's chip in the finale. */
  color: string;
}

/* ------------------------------------------------------------------------ */
/* Staff cast — Caldova Client Operations                                   */
/* ------------------------------------------------------------------------ */

export const STAFF_PERSONAS: StaffPersona[] = [
  {
    id: "onboarding-1",
    name: "Olivia",
    role: "Onboarding & Requests Officer",
    team: "Superannuation Team",
    department: "Onboarding & Requests",
    role_short:
      "The front door of the Superannuation Team — every new account, pension, withdrawal, rollover and death notification starts with Olivia, whether it comes from a member or an adviser.",
    role_line: "The front door for every application and member request.",
    palette: "onboardingOfficer",
    color: "#0ea5e9",
    personality: "Calm, meticulous and welcoming.",
    responsibilities: [
      "Reads adviser submissions, application forms and member requests",
      "Extracts every field and runs the NIGO (not in good order) checklist",
      "Checks ID verification, TFN, signatures, adviser fee consent, nominations and investment choices",
      "Opens the Member Case and sets its priority",
      "Routes the case to the Superannuation or Wealth Management specialists",
    ],
    typical_line:
      "I’ll get this set up properly first time — let me check nothing’s missing.",
    ambient: [
      "Awaiting next request",
      "Checking NIGO items",
      "Chasing a missing TFN declaration",
      "Logging adviser application packs",
      "Opening new Member Cases",
    ],
    app_agent_id: "onboarding",
    agent_name: "Onboarding Agent",
    agent_tagline: "Every application and request, set up right first time.",
  },
  {
    id: "benefits-1",
    name: "Ben",
    role: "Benefits & Eligibility Assessor",
    team: "Superannuation Team",
    department: "Benefits & Eligibility",
    role_short:
      "The Superannuation Team’s technical specialist — applies the trust deed, PDS and super law to every request, and recommends approve, partial or decline.",
    role_line: "Applies the trust deed, PDS and super law to each request.",
    palette: "benefitsAssessor",
    color: "#6366f1",
    personality: "Analytical, fair and precise.",
    responsibilities: [
      "Checks conditions of release and preservation",
      "Applies financial-hardship criteria and payment limits",
      "Tests transfer balance cap space and minimum pension drawdowns",
      "Confirms BDBN validity and SIS dependants",
      "Verifies adviser fee consent (s99FA) and TMD fit — always citing the clause",
    ],
    typical_line:
      "You’re eligible — here’s the rule that says so, and here’s what we still need.",
    ambient: [
      "Awaiting next request",
      "Reviewing BDBN witness declarations",
      "Checking a condition of release",
      "Calculating minimum drawdowns",
      "Testing transfer balance cap space",
    ],
    app_agent_id: "benefits-eligibility",
    agent_name: "Benefits & Eligibility Agent",
    agent_tagline: "Applies the trust deed, PDS and super law — and cites every rule.",
  },
  {
    id: "investments-1",
    name: "Ivy",
    role: "Investment Analyst",
    team: "Wealth Management Team",
    department: "Investment Solutions",
    role_short:
      "The Wealth Management Team’s portfolio specialist — owns the model-portfolio menu and makes sure every portfolio still fits the client’s Statement of Advice.",
    role_line: "Works in the Investment Solutions team and owns the model portfolio menu.",
    palette: "investmentAnalyst",
    color: "#f59e0b",
    personality: "Curious, data-driven and plain-speaking.",
    responsibilities: [
      "Checks model fit against the risk profile and Statement of Advice",
      "Compares model portfolios on fees ($ p.a.), returns and risk",
      "Builds income and cash-bucket strategies for pensions",
      "Plans redemptions and switches",
      "Produces the client workbook and charts",
    ],
    typical_line:
      "Let’s make sure the portfolio still fits the plan — and show the fees in dollars, not just percentages.",
    ambient: [
      "Comparing model portfolios",
      "Reviewing the Growth model fact sheet",
      "Building a pension cash bucket",
      "Checking buy/sell spreads",
      "Updating the fee comparison workbook",
    ],
    app_agent_id: "investment-analyst",
    agent_name: "Investment Analyst Agent",
    agent_tagline: "Keeps portfolios on plan — and shows the fees in dollars.",
  },
  {
    id: "fincrime-1",
    name: "Felix",
    role: "Financial Crime Investigator",
    team: "Wealth Management Team",
    department: "Financial Crime",
    role_short:
      "The risk and compliance partner for both teams — protects members and clients from fraud, scams and identity takeover, and runs AML/CTF checks.",
    role_line: "Protects members from fraud, scams and identity takeover, and looks after AML/CTF obligations.",
    palette: "finCrimeInvestigator",
    color: "#ef4444",
    personality: "Observant, sceptical and discreet — never accusatory.",
    responsibilities: [
      "Checks ID documents for tampering",
      "Builds the account-activity timeline (contact-detail changes, new devices)",
      "Screens for PEP and sanctions matches",
      "Flags SMSF rollover red flags with an explainable risk score",
      "Recommends holds and call-backs — an SMR to AUSTRAC stays a human decision",
    ],
    typical_line:
      "Something doesn’t add up — let’s verify with the member on a number we already trust.",
    ambient: [
      "Running PEP & sanctions screening",
      "Reviewing change-of-details alerts",
      "Checking new-device logins",
      "Verifying ID document security features",
      "Reviewing SMSF rollover red flags",
    ],
    app_agent_id: "financial-crime",
    agent_name: "Financial Crime Agent",
    agent_tagline: "Protects members from fraud, scams and identity takeover.",
  },
  {
    id: "transfers-1",
    name: "Rory",
    role: "Transfers & Rollovers Coordinator",
    team: "Superannuation Team",
    department: "Transfers & Rollovers",
    role_short:
      "The Superannuation Team’s rollover specialist — moves money between Caldova and the outside world: SuperStream rollovers, SMSFs, in-specie transfers and the ATO.",
    role_line: "Moves money between Caldova and the outside world.",
    palette: "transfersCoord",
    color: "#10b981",
    personality: "Organised, persistent and counterparty-savvy.",
    responsibilities: [
      "Looks up external funds by USI and lodges SuperStream rollovers",
      "Warns when a rollover will end insurance cover",
      "Verifies SMSFs with the ATO SMSF verification service (SVS)",
      "Generates transfer and rollover request forms",
      "Tracks the 3-business-day SLA and chases counterparties",
    ],
    typical_line:
      "Your old funds have the request — the money should land within three business days.",
    ambient: [
      "Reconciling SuperStream rollovers",
      "Running SVS check",
      "Chasing an external fund",
      "Tracking rollover SLAs",
      "Lodging transfer balance account reports",
    ],
    app_agent_id: "transfers-rollovers",
    agent_name: "Transfers & Rollovers Agent",
    agent_tagline: "Moves money between funds safely — and on time.",
  },
  {
    id: "payments-1",
    name: "Penny",
    role: "Payments Officer",
    team: "Superannuation Team",
    department: "Payments",
    role_short:
      "The Superannuation Team’s pensions and payments officer — releases money correctly: lump sums, pension payments, death benefits, hardship payments and rollovers out.",
    role_line: "Releases money correctly.",
    palette: "paymentsOfficer",
    color: "#a855f7",
    personality: "Precise, transparent and unflappable.",
    responsibilities: [
      "Validates payee and bank details",
      "Splits tax-free and taxable components",
      "Calculates PAYG withholding",
      "Checks authority limits and raises a Microsoft Teams approval card",
      "Releases money only after human approval, and invests incoming rollovers",
    ],
    typical_line:
      "Gross $10,000, tax withheld $2,068 — $7,932 lands in your account on Friday.",
    ambient: [
      "Awaiting next request",
      "Validating payee BSB",
      "Calculating PAYG withholding",
      "Preparing the pension payment run",
      "Investing incoming rollovers",
    ],
    app_agent_id: "payments",
    agent_name: "Payments Agent",
    agent_tagline: "Gets the tax right, then waits for the human approval.",
  },
  {
    id: "comms-1",
    name: "Cara",
    role: "Client Communications Specialist",
    team: "Wealth Management Team",
    department: "Client Communications",
    role_short:
      "The client and adviser relationship voice of the Wealth Management Team — clear updates, letters and calls in plain English, for super members and wealth clients alike.",
    role_line: "Talks to members and advisers.",
    palette: "commsSpecialist",
    color: "#ec4899",
    personality: "Warm, clear and empathetic.",
    responsibilities: [
      "Drafts member letters, adviser updates, SMS and call scripts",
      "Explains decisions in plain English — no jargon",
      "Matches tone for bereavement, hardship and scam victims",
      "Checks every message for required disclosures and IDR/AFCA rights",
      "Takes calls as Cara through the voice agent",
    ],
    typical_line: "I’ll explain exactly what happens next — no jargon.",
    ambient: [
      "Awaiting next request",
      "Drafting an adviser update",
      "Plain-English check on a member letter",
      "Returning a member call",
      "Sending an SMS confirmation",
    ],
    app_agent_id: "client-communications",
    agent_name: "Client Communications Agent",
    agent_tagline: "Plain-English updates for members and their advisers.",
  },
  {
    id: "lead-1",
    name: "Theo",
    role: "Client Operations Team Leader",
    team: "Client Operations Leadership",
    department: "Team Leader Office",
    role_short:
      "Leads both the Superannuation and Wealth Management teams from between them — workload, SLAs, IDR clocks, approvals, quality and vulnerable members.",
    role_line: "Runs the operations floor.",
    palette: "teamLeader",
    color: "#14b8a6",
    personality: "Decisive, supportive and commercially aware.",
    responsibilities: [
      "Monitors queues, rollover SLAs and IDR clocks",
      "Approves declines, partial approvals and financial-crime blocks",
      "Personally reviews vulnerable-member cases",
      "Samples completed cases for quality",
      "Coordinates the specialist agents on complex cases",
    ],
    typical_line:
      "Let’s get this right for the member — I’ll take the approval.",
    ambient: [
      "Reviewing the SLA dashboard",
      "Checking IDR clocks",
      "Approving a high-value payment",
      "QA sampling closed cases",
      "Coaching the team",
    ],
    app_agent_id: "team-leader",
    agent_name: "Team Leader Agent",
    agent_tagline: "Watches the whole floor — SLAs, IDR clocks and approvals.",
  },
];

/* ------------------------------------------------------------------------ */
/* Client cast — five scripted Melbourne life events                        */
/* ------------------------------------------------------------------------ */

export const CUSTOMER_PERSONAS: CustomerPersona[] = [
  // Order matches docs/scenario-N-*.md:
  //   1. onboarding   2. protection   3. retirement   4. hardship   5. bereavement
  {
    id: "onboarding",
    name: "Priya Natarajan",
    situation:
      "Starting a new job in Docklands — consolidating her old super into one Caldova account.",
    situation_long:
      "Priya (34) is a product manager who has just started at a Docklands fintech and lives in a Southbank apartment. Her adviser, Hannah Lewis of Yarra Private Wealth, has sent Caldova an application pack for a new Caldova Super (Select) account in the Growth model, consolidating about $138,200 from Southern Cross Industry Super and Harbourline Retail Super.",
    need: [
      "One super account, set up properly and digitally",
      "Her two old funds (about $138,200) rolled over without fuss",
      "The Growth model portfolio from her Statement of Advice",
      "Her partner Arjun nominated as her beneficiary",
    ],
    concern:
      "She is busy with the new job — she doesn’t want paperwork bouncing back, or to lose anything valuable when her old funds close.",
    personality: "Busy, organised, and wants it done digitally.",
    typical_line:
      "I’ve got super scattered across old jobs — I just want one account, set up properly.",
    palette: "customerOnboarding",
    request_type: "New account & consolidation",
    color: "#3a8fd6",
  },
  {
    id: "protection",
    name: "Grace Williams",
    situation:
      "Travelling in Italy — someone is trying to move her super while she’s away.",
    situation_long:
      "Grace (63) is a retired school principal from Williamstown and a direct member (no adviser) with $612,400 in Caldova Super (Select). She left Melbourne Airport on 18 October for a long-planned trip through Italy and has a travel notice on file. While she is away, someone using her identity has changed her contact details and asked to roll her entire balance to a brand-new SMSF.",
    need: [
      "Her $612,400 kept safe",
      "To be contacted on the number she already trusts",
      "Her online access locked down and reset",
      "Clear reassurance about what happens next",
    ],
    concern:
      "She is overseas and had no idea anything was happening — the alert went to an email she isn’t checking.",
    personality: "Independent and careful — rattled when she hears.",
    typical_line: "I’m in Florence — I haven’t asked anyone to move my super!",
    palette: "customerProtection",
    request_type: "Rollover out to SMSF",
    color: "#d9534f",
  },
  {
    id: "retirement",
    name: "George Papadopoulos",
    situation: "Just retired — wants a steady pension income from his super.",
    situation_long:
      "George (66) is a retired electrical contractor from Oakleigh, married to Helen (63). With his adviser Marcus Tan of Bayside Financial Partners, he is asking Caldova to start an account-based pension with $1,250,000 of his $1,284,600 balance, paying $78,000 a year in monthly instalments, with Helen as his reversionary beneficiary.",
    need: [
      "A reliable $6,500 every month",
      "Helen protected as his reversionary beneficiary",
      "A cash buffer so he never has to sell in a downturn",
      "Plain answers on tax and the transfer balance cap",
    ],
    concern:
      "He is a little anxious about “running out” after forty years of earning.",
    personality: "Proud, practical, and a little anxious about running out.",
    typical_line:
      "Forty years on the tools — I just want a steady income and to stop worrying.",
    palette: "customerRetirement",
    request_type: "Pension commencement",
    color: "#e8a33d",
  },
  {
    id: "hardship",
    name: "Tom Bradley",
    situation: "His Lygon St café has closed — he needs help catching up on bills.",
    situation_long:
      "Tom (47) ran a small café on Lygon Street, Carlton, until it closed in mid-2025. He has received JobSeeker continuously since 6 April 2026 and is behind on his mortgage and utility bills. He is applying to release $15,000 of his $84,300 Caldova Super (Essential) balance on severe financial hardship grounds.",
    need: [
      "Money to catch up on the mortgage and utilities",
      "A quick, respectful decision",
      "To understand the tax and the impact on his retirement",
      "Pointers to free financial counselling",
    ],
    concern:
      "He never thought he would need to touch his super and feels embarrassed asking.",
    personality: "Proud, embarrassed and stressed.",
    typical_line:
      "I never thought I’d need to touch my super — I just need to catch up on the bills.",
    palette: "customerHardship",
    request_type: "Financial hardship release",
    color: "#e07a2c",
  },
  {
    id: "bereavement",
    name: "Robert Chen",
    situation: "His mum has passed away — her pension is paid to the family.",
    situation_long:
      "Robert (52) lives in Box Hill. His mother, Mei Chen, died on 12 October 2026 aged 81, holding a Caldova Pension worth $486,200. Acting for himself and his sister Lily, he has sent Caldova the death certificate and their IDs. Mei’s binding nomination splits her benefit 50/50 between her two children.",
    need: [
      "A gentle, clear process during a hard time",
      "Confirmation that Mum’s nomination will be followed",
      "A plain-English explanation of the tax",
      "A realistic timeline for the payments",
    ],
    concern:
      "The paperwork feels overwhelming while the family is grieving.",
    personality: "Quiet, grieving, and organised for the family.",
    typical_line:
      "Mum always said she’d sorted everything — I just want to do this right for her.",
    palette: "customerBereavement",
    request_type: "Death benefit (binding nomination)",
    color: "#6e7a8a",
  },
];

// Scripted scenario beats live in src/scenarios/<id>.json
// (see src/scenarios/index.ts for the typed loader).

/* ------------------------------------------------------------------------ */
/* Helpers                                                                  */
/* ------------------------------------------------------------------------ */

/** Teams in display order, with each team's accent colour. */
export const STAFF_TEAMS: ReadonlyArray<{ name: StaffTeam; blurb: string; color: string }> = [
  { name: "Superannuation Team", blurb: "Member accounts, rollovers, pensions", color: "#14b8a6" },
  { name: "Wealth Management Team", blurb: "Advice, investments, risk, clients", color: "#c9a14a" },
  { name: "Client Operations Leadership", blurb: "Oversight of both teams", color: "#6b7fb0" },
];

export function findStaffByRole(role: StaffRole): StaffPersona {
  const p = STAFF_PERSONAS.find((x) => x.role === role);
  if (!p) throw new Error(`No staff persona for role: ${role}`);
  return p;
}

export function findStaffById(id: string): StaffPersona | undefined {
  return STAFF_PERSONAS.find((x) => x.id === id);
}
