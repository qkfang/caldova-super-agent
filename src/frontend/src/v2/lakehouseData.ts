/**
 * Content for the "Lakehouse" storybook, the frontend at `/` (see docs/storybook.md).
 *
 * Caldova Wealth is a wealth management business built for the agentic era.
 * It has two sides, Wealth Management and Superannuation, and the house is
 * read from the top down:
 *   Level 3 · The Idea         Maya Ashworth, the business owner for both sides, and her idea
 *   Level 2 · The People       two small teams, one per side, with Theo leading both
 *   Level 1 · The Agents       one group of agents, each with its specialised assistants (the roles):
 *                              dedicated to a side, or shared by both
 *   Lower level · Engine Room  Microsoft IQ and the Azure services underneath
 *   The dock                   the front desk, where visitors arrive by water taxi to sign
 *   The roof                   a party for the customers, under a big CALDOVA WEALTH sign
 *
 * Staff, assistants and scenarios come from the shared canon (personaData.ts,
 * agentStages.ts and scenarios/*.json). This file adds what the storybook needs on top.
 */
import { PALETTES, type VoxelCharacterPalette } from "../characterPalettes";
import { CUSTOMER_PERSONAS, STAFF_PERSONAS, type ScenarioId, type StaffTeam } from "../personaData";
import { STAGE_CONFIG } from "../agentStages";

export type LevelId = "idea" | "people" | "agents" | "engine";

export interface LevelInfo {
  id: LevelId;
  /** Lift button label. */
  floor: string;
  name: string;
  caption: string;
  accent: string;
}

/** Top to bottom. */
export const LEVELS: readonly LevelInfo[] = [
  { id: "idea", floor: "3", name: "The Idea", caption: "The business owner's office", accent: "#ffc35a" },
  { id: "people", floor: "2", name: "The People", caption: "Two small teams", accent: "#ff8f6b" },
  { id: "agents", floor: "1", name: "The Agents", caption: "One group of agents", accent: "#5ce1ff" },
  { id: "engine", floor: "B", name: "The Engine Room", caption: "Azure and Microsoft IQ", accent: "#a78bfa" },
];

export function levelInfo(id: LevelId): LevelInfo {
  const l = LEVELS.find((x) => x.id === id);
  if (!l) throw new Error(`Unknown level: ${id}`);
  return l;
}

/* ------------------------------------------------------------------------ */
/* The two sides of the business                                             */
/* ------------------------------------------------------------------------ */

export type SideId = "wealth" | "super" | "shared";

export interface SideInfo {
  id: SideId;
  name: string;
  team: StaffTeam;
  color: string;
  products: string[];
  blurb: string;
}

/** Colours match the team accents (STAFF_TEAMS in personaData.ts). */
export const SIDES: Record<SideId, SideInfo> = {
  wealth: {
    id: "wealth",
    name: "Wealth Management",
    team: "Wealth Management Team",
    color: "#c9a14a",
    products: ["Caldova Wrap", "Caldova Managed Portfolios"],
    blurb: "An investor-directed portfolio service and model portfolios for clients who invest through an adviser.",
  },
  super: {
    id: "super",
    name: "Superannuation",
    team: "Superannuation Team",
    color: "#14b8a6",
    products: ["Caldova Super", "Caldova Pension"],
    blurb: "Retirement savings and retirement income in the Caldova Superannuation Master Fund, direct or through an adviser.",
  },
  shared: {
    id: "shared",
    name: "Both sides",
    team: "Client Operations Leadership",
    color: "#8b9cf7",
    products: ["Caldova Cash Account"],
    blurb: "What both sides share: leadership, risk, client communications and the cash account inside every account.",
  },
};

/** The side a person works on, from their team (personaData.ts). */
export function teamSide(team: StaffTeam): SideId {
  if (team === "Superannuation Team") return "super";
  if (team === "Wealth Management Team") return "wealth";
  return "shared";
}

/** Badge text for an agent's side. */
export function sideBadge(side: SideId): string {
  return side === "shared" ? "Shared · both sides" : `Dedicated · ${side === "super" ? "Super" : "Wealth"}`;
}

/** The side each scenario belongs to: all five are Superannuation member requests. */
export const SCENARIO_SIDE: Record<ScenarioId, SideId> = {
  onboarding: "super",
  protection: "super",
  retirement: "super",
  hardship: "super",
  bereavement: "super",
};

/* ------------------------------------------------------------------------ */
/* Level 3 — the business owner and the idea                                 */
/* ------------------------------------------------------------------------ */

export const OWNER = {
  id: "owner",
  name: "Maya Ashworth",
  firstName: "Maya",
  role: "Managing Director, Caldova Wealth",
  badge: "Business owner for both sides",
  color: "#ffc35a",
  personality: "Curious, practical and people-first.",
  typical_line: "If a member has to chase us, we’ve already let them down.",
  summary:
    "Maya is the business owner for both sides of Caldova: Wealth Management and Superannuation. She sets the goals, decides where to invest, and holds the line on one rule: people approve every decision that matters.",
  owns: [
    "The goals both sides work to",
    "The guardrails: when a person must approve, and what agents may never do",
    "Investment in the two teams, the agents and the platform",
    "The results members, clients and advisers feel",
  ],
  // Smart-casual for the lakehouse: cream knit, slate trousers, Caldova-gold scarf.
  palette: {
    skin: "#b27b56",
    hair: "#2a1a12",
    shirt: "#f1ebe0",
    pants: "#3b4a5e",
    shoes: "#2a2420",
    accent: "#c9a14a",
    hairStyle: "long",
    glasses: true,
  } satisfies VoxelCharacterPalette,
};

/** The idea that lives in "the brain" above Maya's table: one hemisphere for each side. */
export const IDEA = {
  name: "Wealth Team in a Day",
  era: "A wealth business for the agentic era",
  statement:
    "Run both sides of Caldova with small expert teams supported by one group of AI agents: dedicated where the work is specialised, shared where it isn’t, and all grounded in the same IQ layer on Azure. Requests become clearer, faster and more consistent, and people approve every decision that matters.",
  goals: [
    {
      tile: "CLEARER",
      title: "Clearer",
      text: "Members, clients and advisers always know where their request is and what happens next.",
    },
    {
      tile: "FASTER",
      title: "Faster",
      text: "Agents do the reading, checking, calculating and drafting in minutes, so requests don’t sit in a queue.",
    },
    {
      tile: "CONSISTENT",
      title: "More consistent",
      text: "Both sides follow one lifecycle, and every check cites the rule it relied on.",
    },
    {
      tile: "PEOPLE APPROVE",
      title: "People approve",
      text: "Agents recommend. A named person makes every decision that matters.",
    },
  ],
  lifecycle: ["Request", "Verify", "Assess", "Action", "Confirm"],
  /** Human approval is always required for these (README "The Wealth Operations Agent Team"). */
  guardrails: [
    "Declines and partial approvals",
    "Financial-crime blocks and suspicious matter reports (SMRs)",
    "A single payment of $250,000 or more, and every death benefit",
    "Pension commencements of $1 million or more",
    "Hardship releases",
    "Complaint responses",
    "Any communication to a fraud victim or a bereaved family",
  ],
  never: "Agents never give personal financial advice. That is the adviser’s job.",
};

/* ------------------------------------------------------------------------ */
/* Level 1 — one group of agents for both teams                              */
/* ------------------------------------------------------------------------ */

export type InfraId =
  | "workiq"
  | "fabriciq"
  | "foundryiq"
  | "webiq"
  | "foundry"
  | "mcp"
  | "teams"
  | "content"
  | "voice"
  | "apps"
  | "identity"
  | "vault"
  | "storage"
  | "monitor"
  | "network";

export interface AgentInfo {
  /** Foundry agent id (docs/foundry_agents.md, "Option A: One Agent per Department"). */
  foundryId: string;
  /** Cara also has a separate voice agent. */
  voiceId?: string;
  /** Which side of the business the agent is dedicated to, or "shared" by both. */
  side: SideId;
  /** Why it is dedicated or shared. */
  sideNote: string;
  /** Engine-room components this agent calls while it works. */
  uses: InfraId[];
  /** The component that makes this agent different, used by the request trace. */
  signature: InfraId;
  signatureLine: string;
}

/** Every agent runs on Foundry and inherits the same IQ layer through the CaldovaAgent base class. */
const SHARED: InfraId[] = ["foundry", "workiq", "fabriciq", "foundryiq", "webiq"];

/** Keyed by staff id (personaData.ts). */
export const AGENTS: Record<string, AgentInfo> = {
  "onboarding-1": {
    foundryId: "onboarding-agent",
    side: "super",
    sideNote: "Every super request starts here: new accounts, pensions, withdrawals, rollovers and death notifications.",
    uses: SHARED,
    signature: "foundryiq",
    signatureLine: "Runs the NIGO checklist against the guides in the wealth_knowledge index.",
  },
  "benefits-1": {
    foundryId: "benefits-eligibility-agent",
    side: "super",
    sideNote: "Applies super law, the trust deed and the PDS.",
    uses: SHARED,
    signature: "foundryiq",
    signatureLine: "Cites a rule from the wealth_knowledge index for every check.",
  },
  "transfers-1": {
    foundryId: "transfers-rollovers-agent",
    side: "super",
    sideNote: "Moves super between Caldova, other funds, SMSFs and the ATO.",
    uses: [...SHARED, "mcp"],
    signature: "mcp",
    signatureLine: "Uses MCP tools to look up funds, verify SMSFs and generate the transfer request PDF.",
  },
  "payments-1": {
    foundryId: "payments-agent",
    side: "super",
    sideNote: "Pays super benefits and pensions, with tax components and PAYG withholding.",
    uses: [...SHARED, "mcp", "teams"],
    signature: "teams",
    signatureLine: "Uses MCP tools to calculate benefits and check limits, then waits for a Microsoft Teams approval.",
  },
  "investments-1": {
    foundryId: "investment-analyst-agent",
    side: "wealth",
    sideNote:
      "Owned by the Wealth Management side for its model portfolios and Statements of Advice. The Super team calls it in when a member’s portfolio or pension income needs an investment view.",
    uses: [...SHARED, "mcp"],
    signature: "mcp",
    signatureLine: "Uses MCP tools to analyse fact sheets, compare models and build the client workbook.",
  },
  "fincrime-1": {
    foundryId: "financial-crime-agent",
    side: "shared",
    sideNote: "Protects members and clients on both sides from fraud, scams and identity takeover.",
    uses: [...SHARED, "content"],
    signature: "content",
    signatureLine: "Uses Azure Content Understanding to check documents for signs of tampering.",
  },
  "comms-1": {
    foundryId: "client-communications-agent",
    voiceId: "client-communications-voice-agent",
    side: "shared",
    sideNote: "Writes to super members and wealth clients alike, and to their advisers.",
    uses: [...SHARED, "voice"],
    signature: "voice",
    signatureLine: "Has a voice agent on Azure Voice Live, so members can talk to Cara about their case.",
  },
  "lead-1": {
    foundryId: "team-leader-agent",
    side: "shared",
    sideNote: "Watches both teams’ queues and coordinates both sides’ agents on one case.",
    uses: SHARED,
    signature: "foundry",
    signatureLine: "Runs the group chat that coordinates the other seven agents on one case.",
  },
};

/* ------------------------------------------------------------------------ */
/* Level 1 — the roles: each agent and its two specialised assistants        */
/* ------------------------------------------------------------------------ */

export type RoleKind = "lead" | "assistant" | "voice";

/** What a role's robot carries, so its job reads at a glance. */
export type RoleProp =
  | "beacon"
  | "doc"
  | "clipboard"
  | "book"
  | "stamp"
  | "pie"
  | "chart"
  | "magnifier"
  | "timeline"
  | "globe"
  | "parcel"
  | "clock"
  | "badge"
  | "calculator"
  | "lock"
  | "envelope"
  | "heart"
  | "headset";

export interface AgentRole {
  /** `<staffId>:lead`, `<staffId>:1`, `<staffId>:2`, or `comms-1:voice`. */
  id: string;
  staffId: string;
  kind: RoleKind;
  /** Full name, such as "Agent Olivia #1 — Form Extraction". */
  name: string;
  /** Short name, such as "Form Extraction". */
  short: string;
  description: string;
  prop: RoleProp;
  /** What it is seen doing at its own bay. */
  tasks: string[];
}

interface RoleExtra {
  props: [RoleProp, RoleProp];
  lead: string[];
  tasks: [string[], string[]];
}

/** Props and everyday tasks for each agent's roles; names and descriptions come from agentStages.ts. */
const ROLE_EXTRAS: Record<string, RoleExtra> = {
  "onboarding-1": {
    props: ["doc", "clipboard"],
    lead: ["Opening a Member Case", "Setting the case priority", "Routing a case"],
    tasks: [
      ["Reading an application pack", "Extracting every field", "Filling in the Member Case"],
      ["Running the NIGO checklist", "Chasing a missing TFN", "Checking signatures and ID"],
    ],
  },
  "benefits-1": {
    props: ["book", "stamp"],
    lead: ["Drafting a recommendation", "Citing the trust deed", "Weighing the evidence"],
    tasks: [
      ["Testing a condition of release", "Checking cap space", "Working out a drawdown"],
      ["Validating a BDBN", "Checking adviser fee consent", "Confirming SIS dependants"],
    ],
  },
  "investments-1": {
    props: ["pie", "chart"],
    lead: ["Reviewing model portfolios", "Planning a cash bucket", "Building a client workbook"],
    tasks: [
      ["Checking fit with the SOA", "Matching the risk profile", "Planning redemptions"],
      ["Comparing fees in dollars", "Charting returns and risk", "Updating the fee workbook"],
    ],
  },
  "fincrime-1": {
    props: ["magnifier", "timeline"],
    lead: ["Scoring the case risk", "Recommending a call-back", "Screening PEP and sanctions"],
    tasks: [
      ["Scanning an ID document", "Checking for tampering", "Comparing security features"],
      ["Building an activity timeline", "Flagging a new device", "Reviewing a change of details"],
    ],
  },
  "transfers-1": {
    props: ["globe", "parcel"],
    lead: ["Tracking rollover SLAs", "Lodging a SuperStream rollover", "Chasing an external fund"],
    tasks: [
      ["Looking up a fund by USI", "Running an SMSF check", "Flagging lost insurance cover"],
      ["Generating a rollover request", "Chasing a counterparty", "Checking the 3-day SLA"],
    ],
  },
  "payments-1": {
    props: ["calculator", "lock"],
    lead: ["Preparing the payment run", "Investing a rollover", "Waiting for an approval"],
    tasks: [
      ["Splitting tax components", "Calculating PAYG", "Working out the net payment"],
      ["Validating a payee BSB", "Checking authority limits", "Raising a Teams approval"],
    ],
  },
  "comms-1": {
    props: ["envelope", "heart"],
    lead: ["Drafting an adviser update", "Sending an SMS", "Preparing a member letter"],
    tasks: [
      ["Writing in plain English", "Matching a letter to the outcome", "Drafting an adviser email"],
      ["Checking the tone", "Adding IDR and AFCA rights", "Checking disclosures"],
    ],
  },
  "lead-1": {
    props: ["clock", "badge"],
    lead: ["Running the group chat", "Coordinating the agents", "Summarising a case"],
    tasks: [
      ["Watching the SLA clocks", "Checking IDR deadlines", "Surfacing a case for Theo"],
      ["Preparing an approval pack", "Sampling closed cases", "Flagging a vulnerable member"],
    ],
  },
};

function buildRoles(): AgentRole[] {
  const roles: AgentRole[] = [];
  for (const p of STAFF_PERSONAS) {
    const extra = ROLE_EXTRAS[p.id];
    const agent = AGENTS[p.id];
    if (!extra || !agent) continue;
    roles.push({
      id: `${p.id}:lead`,
      staffId: p.id,
      kind: "lead",
      name: p.agent_name,
      short: p.agent_name,
      description: p.agent_tagline,
      prop: "beacon",
      tasks: extra.lead,
    });
    const assistants = Object.values(STAGE_CONFIG).find((s) => s.role === p.role)?.agents ?? [];
    assistants.slice(0, 2).forEach((a, i) => {
      roles.push({
        id: `${p.id}:${i + 1}`,
        staffId: p.id,
        kind: "assistant",
        name: a.name,
        short: a.name.split("—")[1]?.trim() ?? a.name,
        description: a.description,
        prop: extra.props[i],
        tasks: extra.tasks[i],
      });
    });
    if (agent.voiceId) {
      roles.push({
        id: `${p.id}:voice`,
        staffId: p.id,
        kind: "voice",
        name: "Client Communications Voice Agent",
        short: "Voice Agent",
        description:
          "Talks to members, clients and advisers about their case on Azure Voice Live, using only facts from the Member Case, and offers a call-back from a person for anything sensitive.",
        prop: "headset",
        tasks: ["Taking a member call", "Explaining next steps", "Offering a call-back"],
      });
    }
  }
  return roles;
}

/** Every role on the agent floor: 8 agents, their 16 assistants and Cara's voice agent. */
export const ROLES: AgentRole[] = buildRoles();

export function roleInfo(id: string): AgentRole | undefined {
  return ROLES.find((r) => r.id === id);
}

export function rolesOf(staffId: string): AgentRole[] {
  return ROLES.filter((r) => r.staffId === staffId);
}

/** The role that works the front desk on the dock. */
export const DESK_ROLE = "onboarding-1:1";

/**
 * Who each agent hands work to (docs/foundry_agents.md, "Suggested Agent
 * Handoff Rules"). Any agent can also escalate to Theo's, and Theo's agent
 * coordinates the specialists on complex cases.
 */
export const HANDOFFS: Record<string, string[]> = {
  "onboarding-1": ["benefits-1", "fincrime-1"],
  "benefits-1": ["fincrime-1", "investments-1", "transfers-1"],
  "investments-1": ["payments-1"],
  "transfers-1": ["payments-1"],
  "payments-1": ["comms-1"],
  "fincrime-1": [],
  "comms-1": [],
  "lead-1": ["onboarding-1", "benefits-1", "payments-1", "fincrime-1"],
};

/* ------------------------------------------------------------------------ */
/* Lower level — Microsoft IQ and the Azure services                         */
/* ------------------------------------------------------------------------ */

export interface InfraInfo {
  id: InfraId;
  name: string;
  /** Short label painted in the engine room. */
  sign: string;
  /** One-line subtitle under the sign. */
  tag: string;
  /** "iq": the Microsoft IQ layer on the raised deck; "azure": the services around it. */
  tier: TierId;
  kind: string;
  color: string;
  /** "all" when every agent depends on it. */
  scope: "all" | "some" | "platform";
  summary: string;
  details: string[];
  security: string;
  /** How the scenarios use it today, shown on its card under "In the scenarios". */
  inScenarios?: string;
}

export type TierId = "iq" | "azure";

/** The two tiers of the engine room. */
export const TIERS: Record<TierId, { name: string; tagline: string; color: string }> = {
  iq: { name: "Microsoft IQ", tagline: "the context layer every agent shares", color: "#e879f9" },
  azure: { name: "Azure services", tagline: "the platform underneath", color: "#60a5fa" },
};

export const INFRA: InfraInfo[] = [
  {
    id: "workiq",
    name: "Work IQ",
    sign: "WORK IQ",
    tag: "how people work",
    tier: "iq",
    kind: "Microsoft IQ · work context",
    color: "#fb7185",
    scope: "all",
    summary:
      "Context on how people work: the documents, conversations, meetings, collaboration and past decisions in Microsoft 365.",
    details: ["Adviser emails, member calls and the team’s conversations about a case", "Part of Microsoft IQ"],
    security: "Permission-trimmed: an agent only sees the Microsoft 365 content its user is allowed to see.",
    inScenarios: "Not wired up yet. Adviser emails arrive as case documents, and approvals go to Microsoft Teams through an MCP tool.",
  },
  {
    id: "fabriciq",
    name: "Fabric IQ",
    sign: "FABRIC IQ",
    tag: "the state of the business",
    tier: "iq",
    kind: "Microsoft IQ · business data",
    color: "#4ade80",
    scope: "all",
    summary:
      "The state of the business through governed data, business entities, relationships and rules: members, clients, accounts, balances, holdings and transactions across both sides.",
    details: ["A business model of entities and relationships that agents can reason over", "Built on Microsoft Fabric", "Part of Microsoft IQ"],
    security: "Governed data: people and agents work under the same rules and permissions.",
    inScenarios: "Not wired up yet. The backend’s Member Case store and the case files stand in for it.",
  },
  {
    id: "foundryiq",
    name: "Foundry IQ · wealth_knowledge",
    sign: "FOUNDRY IQ",
    tag: "policies and documents",
    tier: "iq",
    kind: "Microsoft IQ · knowledge",
    color: "#c4b5fd",
    scope: "all",
    summary:
      "Curated institutional knowledge: PDS and trust-deed extracts, super rules, the fee schedule, the model portfolio menu and the case files in the wealth_knowledge index, returned with citations.",
    details: [
      "Foundry IQ is the new name for Azure AI Search",
      "Semantic search enabled",
      "Built and loaded with ai-search/setup-index.ps1 and ingest-documents.ps1",
    ],
    security:
      "Foundry’s managed identities read the index with Search Index Data Reader; the web apps hold Search Index Data Contributor.",
    inScenarios: "Live: every agent grounds on, and cites, the wealth_knowledge index.",
  },
  {
    id: "webiq",
    name: "Web IQ",
    sign: "WEB IQ",
    tag: "the web, right now",
    tier: "iq",
    kind: "Microsoft IQ · web context",
    color: "#38bdf8",
    scope: "all",
    summary: "Timely, citation-ready context from the public web, so agents can check up-to-date reference information.",
    details: ["Part of Microsoft IQ"],
    security: "Web grounding goes through the Foundry project connection, so the apps hold no web-search keys.",
    inScenarios: "The Grounding with Bing Search connection in the Foundry project stands in for it.",
  },
  {
    id: "foundry",
    name: "Microsoft Foundry",
    sign: "MICROSOFT FOUNDRY",
    tag: "9 agents · gpt-5.4",
    tier: "azure",
    kind: "Azure · agent platform and model",
    color: "#a78bfa",
    scope: "all",
    summary:
      "Hosts the nine agents (eight staff agents plus Cara’s voice agent) and the gpt-5.4 model they reason with.",
    details: [
      "Declarative agents created from code with Azure.AI.Projects, on a shared CaldovaAgent base class",
      "Model deployment gpt-5.4 (GlobalStandard) with the default responsible-AI content filters",
      "Theo’s group chat coordinates the specialist agents on a single case",
    ],
    security:
      "The backend calls the project endpoint with its managed identity, which holds the Azure AI User, Azure AI Developer and Cognitive Services OpenAI User roles.",
  },
  {
    id: "mcp",
    name: "MCP server · caldova-ops-mcp",
    sign: "MCP TOOLS",
    tag: "caldova-ops-mcp at /mcp",
    tier: "azure",
    kind: "Azure · tools that act on systems",
    color: "#f472b6",
    scope: "some",
    summary:
      "The backend serves Model Context Protocol tools at /mcp, and Foundry calls them while an agent works. This is how agents act on systems, not just talk about them.",
    details: [
      "Investments: analyse fact sheets, compare models, build the client workbook",
      "Transfers: look up funds, verify SMSFs, generate the transfer request PDF",
      "Payments: validate payees, calculate benefits, check authority limits, request approval and release payment",
      "Teams: send the approval card",
    ],
    security: "Foundry reaches the backend’s /mcp endpoint over HTTPS at the public URL set in APP_MCP_URL.",
  },
  {
    id: "teams",
    name: "Microsoft Teams approvals",
    sign: "TEAMS APPROVALS",
    tag: "human approvals",
    tier: "azure",
    kind: "Microsoft 365 · human in the loop",
    color: "#818cf8",
    scope: "some",
    summary:
      "Carries approvals to people. A payment waits until a human approves the adaptive card in Microsoft Teams.",
    details: [
      "Sent by the teams_sendApprovalCard MCP tool",
      "Penny’s agent raises the card, and Theo approves it",
      "In the scenarios, delivery to the Teams channel is simulated",
    ],
    security: "The card shows masked bank details only, and nothing is released until a person approves.",
  },
  {
    id: "content",
    name: "Azure Content Understanding",
    sign: "CONTENT UNDERSTANDING",
    tag: "document checks",
    tier: "azure",
    kind: "Azure · document analysis",
    color: "#fb923c",
    scope: "some",
    summary:
      "Checks ID documents, bank statements, SMSF letters and death certificates, and returns a legit, suspicious or fake verdict with the reasons.",
    details: ["Used by Felix’s Financial Crime Agent, for both sides"],
    security: "Signs in with DefaultAzureCredential, or an API key when one is configured.",
  },
  {
    id: "voice",
    name: "Azure Voice Live",
    sign: "VOICE LIVE",
    tag: "Cara’s voice agent",
    tier: "azure",
    kind: "Azure · real-time voice",
    color: "#ec4899",
    scope: "some",
    summary: "Lets members, clients and advisers talk to Cara’s voice agent about a case, in plain English.",
    details: ["Runs client-communications-voice-agent", "The backend proxies the Voice Live WebSocket"],
    security: "The backend’s managed identity signs each Voice Live connection.",
  },
  {
    id: "apps",
    name: "Azure App Service",
    sign: "APP SERVICE",
    tag: "frontend + backend",
    tier: "azure",
    kind: "Azure · hosting",
    color: "#60a5fa",
    scope: "platform",
    summary:
      "Two Linux web apps on one plan: the frontend (this voxel site) and the backend (the Blazor agent console, its APIs, the Member Case store and the MCP endpoint).",
    details: ["Frontend: Node 20 serving the static Vite build", "Backend: .NET 10", "Deployed by GitHub Actions"],
    security:
      "Both web apps are HTTPS-only with TLS 1.2, FTP is disabled, and each runs with a system-assigned managed identity.",
  },
  {
    id: "identity",
    name: "Microsoft Entra ID",
    sign: "ENTRA ID",
    tag: "managed identities",
    tier: "azure",
    kind: "Azure · identity and access",
    color: "#facc15",
    scope: "platform",
    summary:
      "No keys in code: the web apps and Foundry sign in with managed identities and DefaultAzureCredential, and role assignments limit what each one can do.",
    details: [
      "Azure AI User, Azure AI Developer and Cognitive Services OpenAI User on Foundry",
      "Search Index Data Reader, Search Index Data Contributor and Search Service Contributor on Foundry IQ (Azure AI Search)",
    ],
    security: "Every call carries an Entra ID token scoped by these roles.",
  },
  {
    id: "vault",
    name: "Azure Key Vault",
    sign: "KEY VAULT",
    tag: "secrets and keys",
    tier: "azure",
    kind: "Azure · secrets",
    color: "#94a3b8",
    scope: "platform",
    summary: "Provisioned with the platform as the place for secrets and keys, so they never live in code or config.",
    details: ["Standard tier"],
    security: "The agents and apps sign in with managed identities rather than stored keys.",
  },
  {
    id: "storage",
    name: "Azure Storage",
    sign: "STORAGE",
    tag: "StorageV2",
    tier: "azure",
    kind: "Azure · files",
    color: "#34d399",
    scope: "platform",
    summary: "A general-purpose StorageV2 account deployed with the platform, ready for document uploads and generated files.",
    details: ["Standard locally redundant storage", "Seven-day soft delete for blobs"],
    security: "HTTPS only with TLS 1.2, and no anonymous access to blobs.",
  },
  {
    id: "monitor",
    name: "Application Insights · Log Analytics",
    sign: "APP INSIGHTS",
    tag: "telemetry",
    tier: "azure",
    kind: "Azure · observability",
    color: "#f59e0b",
    scope: "platform",
    summary: "Both web apps send telemetry to Application Insights, backed by a Log Analytics workspace.",
    details: ["The connection string is set on both App Service apps", "30-day retention in Log Analytics"],
    security: "Workspace-based Application Insights, so telemetry lands in the Log Analytics workspace.",
  },
  {
    id: "network",
    name: "Network and wiring",
    sign: "NETWORK",
    tag: "HTTPS · WebSocket",
    tier: "azure",
    kind: "Azure · how it all connects",
    color: "#22d3ee",
    scope: "platform",
    summary:
      "Every hop is HTTPS: the browser to App Service, the backend to the Foundry project endpoint, Foundry to Foundry IQ, the web and the backend’s /mcp tools, plus a WebSocket for Voice Live.",
    details: [
      "Public endpoints today, secured with Entra ID tokens and role assignments",
      "For production, add private endpoints and virtual network integration",
    ],
    security: "TLS on every connection, with identity checked on every call.",
  },
];

export function infraInfo(id: InfraId): InfraInfo {
  const i = INFRA.find((x) => x.id === id);
  if (!i) throw new Error(`Unknown engine-room component: ${id}`);
  return i;
}

const INFRA_SHORT: Partial<Record<InfraId, string>> = {
  teams: "Teams approvals",
  content: "Content Understanding",
  voice: "Voice Live",
};

/** A component's name, short enough for a chip: "Foundry IQ", "MCP server", "Teams approvals". */
export function infraShort(id: InfraId): string {
  return INFRA_SHORT[id] ?? infraInfo(id).name.split(" · ")[0];
}

/** Staff ids whose agents depend on a component ("all" and "platform" mean every agent). */
export function agentsUsing(id: InfraId): string[] {
  const scope = infraInfo(id).scope;
  return Object.entries(AGENTS)
    .filter(([, a]) => scope !== "some" || a.uses.includes(id))
    .map(([staffId]) => staffId);
}

/* ------------------------------------------------------------------------ */
/* The dock — visitors arrive by water taxi and sign at the front desk       */
/* ------------------------------------------------------------------------ */

export const FRONT_DESK = {
  name: "The front desk",
  summary:
    "Members, clients and advisers arrive by water taxi and sign their application, policy or death benefit claim at the front desk on the dock. The greeter welcomes them, Amelia gets them started with the right agents, and Olivia’s Form Extraction agent reads the signed form straight into a new Member Case.",
  inScenarios: "Requests arrive as adviser emails, forms and member requests. The dock is the storybook’s way of showing them coming in.",
};

/** An agent Amelia links customers with, and what it does to get them started. */
export interface AdviserLink {
  /** Staff id of the person the agent works for (personaData.ts). */
  id: string;
  why: string;
}

/**
 * Amelia, Caldova's financial adviser at the front desk. She gives the advice (agents never do),
 * then links each customer with the agents that get them started. Like the staff, her name starts
 * with the first letter of her role.
 */
export const ADVISER = {
  /** Her character id, for picking. */
  id: "amelia",
  name: "Amelia",
  role: "Financial Adviser",
  line: "Meets new customers at the front desk, gives them advice, and links them with the agents that get them started.",
  color: "#ffc35a",
  palette: {
    skin: "#b97a56",
    hair: "#1d1410",
    shirt: "#8b2f4b",
    pants: "#2b2f3a",
    shoes: "#1a1a1a",
    accent: "#c9a14a",
    hairStyle: "ponytail",
    shirtLogo: true,
  } as VoxelCharacterPalette,
  /** What she is doing between visitors. */
  tasks: [
    "Reviewing a Statement of Advice",
    "Preparing a welcome pack",
    "Checking a fee consent form",
    "Reading a model portfolio fact sheet",
  ],
  links: [
    { id: "onboarding-1", why: "Opens the account and checks the forms are in good order" },
    { id: "benefits-1", why: "Checks eligibility, insurance cover and fee consent" },
    { id: "investments-1", why: "Checks portfolio fit and shows the fees in dollars" },
    { id: "comms-1", why: "Sends the welcome pack and keeps everyone updated" },
  ] as readonly AdviserLink[],
};

/** How each finale member arrives at the front desk. */
export interface Arrival {
  /** The member signs, or someone signs in their name (the protection scenario). */
  visitor: "member" | "impostor";
  /** Painted on the paper they sign. */
  doc: string;
  /** Opening line of the finale's first step. */
  line: string;
  /** Amelia's welcome as they walk up. */
  welcome: string;
  /** The agents Amelia links them with while they sign, by staff id. */
  links: readonly string[];
}

export const ARRIVALS: Record<ScenarioId, Arrival> = {
  onboarding: {
    visitor: "member",
    doc: "Caldova Super application",
    line: "Priya arrives by water taxi and signs at the front desk.",
    welcome: "Hi Priya! Hannah sent your pack ahead",
    links: ["onboarding-1"],
  },
  protection: {
    visitor: "impostor",
    doc: "Rollover request · CS-1058220",
    line: "Someone arrives by water taxi and signs at the front desk in Grace’s name. Grace is in Italy.",
    welcome: "Welcome to Caldova. Let’s get this lodged",
    links: ["onboarding-1"],
  },
  retirement: {
    visitor: "member",
    doc: "Caldova Pension application",
    line: "George arrives by water taxi to sign the pension application his adviser, Marcus Tan, has prepared.",
    welcome: "Hi George! Marcus has it all prepared",
    links: ["onboarding-1"],
  },
  hardship: {
    visitor: "member",
    doc: "Hardship release application",
    line: "Tom arrives by water taxi and signs at the front desk.",
    welcome: "Hi Tom. We’ll help you through this",
    links: ["onboarding-1"],
  },
  bereavement: {
    visitor: "member",
    doc: "Death benefit claim",
    line: "Robert arrives by water taxi with his mother’s paperwork, and signs at the front desk.",
    welcome: "I’m so sorry about your mother, Robert",
    links: ["onboarding-1"],
  },
};

/** Someone signing in another member's name: hooded, with dark glasses. */
export const IMPOSTOR_PALETTE: VoxelCharacterPalette = {
  skin: "#d6a982",
  hair: "#2b2f36",
  shirt: "#3a4150",
  pants: "#1d2129",
  shoes: "#14161a",
  hairStyle: "hood",
  glasses: true,
};

/** Everyday visitors who drop by the front desk between the finale's requests. */
export interface DropIn {
  id: string;
  who: string;
  side: SideId;
  doc: string;
  summary: string;
  palette: VoxelCharacterPalette;
  /** Amelia's welcome as they walk up. */
  welcome: string;
  /** The agents Amelia links them with while they sign, by staff id. */
  links: readonly string[];
}

export const DROP_INS: DropIn[] = [
  {
    id: "new-member",
    who: "A new member",
    side: "super",
    doc: "Caldova Super · insurance cover",
    summary: "Joins Caldova Super and signs the policy for her insurance cover.",
    welcome: "Welcome! Let’s set up your super",
    links: ["onboarding-1", "benefits-1"],
    palette: {
      skin: "#e3b48f",
      hair: "#4a2c1d",
      shirt: "#14b8a6",
      pants: "#334155",
      shoes: "#1f2937",
      accent: "#f8fafc",
      hairStyle: "bun",
    },
  },
  {
    id: "new-client",
    who: "A new client",
    side: "wealth",
    doc: "Caldova Wrap · account application",
    summary: "Signs his Caldova Wrap account application, set up with his adviser.",
    welcome: "Welcome! Let’s open your Wrap account",
    links: ["onboarding-1", "investments-1"],
    palette: {
      skin: "#c48c64",
      hair: "#cfcfd4",
      shirt: "#1e3a5f",
      pants: "#d6cfc2",
      shoes: "#3a2a20",
      hairStyle: "short",
      facial: "stubble",
      glasses: true,
    },
  },
  {
    id: "adviser",
    who: "An adviser",
    side: "wealth",
    doc: "Managed Portfolio · client application",
    summary: "Drops off a client’s Managed Portfolio application with the Statement of Advice.",
    welcome: "Thanks! I’ll get your client started",
    links: ["onboarding-1", "investments-1", "comms-1"],
    palette: {
      skin: "#f1c7a1",
      hair: "#6b4423",
      shirt: "#334155",
      pants: "#334155",
      shoes: "#1a1a1a",
      accent: "#c9a14a",
      hairStyle: "short",
    },
  },
];

/* ------------------------------------------------------------------------ */
/* The roof — a party for the customers                                      */
/* ------------------------------------------------------------------------ */

export const PARTY = {
  name: "The rooftop celebration",
  summary:
    "Caldova Wealth throws a party on the roof for its members, clients and their advisers: the people the whole house works for.",
  /** Printed on the front of the DJ booth. */
  tagline: "Celebrating our members, clients and advisers",
  guests: "George and Helen, Priya, the advisers Marcus Tan and Hannah Lewis, and members and clients from both sides",
};

/** The big marquee sign along the back of the roof. */
export const PARTY_SIGN = "CALDOVA WEALTH";

export interface PartyGuest {
  id: string;
  name: string;
  /** Under the name on the card. */
  role: string;
  /** The card's one plain-English line. */
  line: string;
  /** The side they are with (advisers work with both). Not set for partners. */
  side?: SideId;
  palette: VoxelCharacterPalette;
  /** Their request in the finale, if they have one. */
  scenario?: ScenarioId;
  /** The card action that replays it. */
  story?: string;
  /** A labelled fact for the card: their adviser, their client, or who they came with. */
  with?: [label: string, names: string];
  /** What they do at their home spot. */
  home: string[];
}

const customerName = (id: ScenarioId): string => CUSTOMER_PERSONAS.find((c) => c.id === id)?.name ?? "";

/**
 * The guests are customers with happy news, and their advisers. The other
 * finale members' stories (hardship, a scam, a death in the family) are not
 * party stories, so they are not on the roof.
 */
export const PARTY_GUESTS: PartyGuest[] = [
  {
    id: "george",
    name: customerName("retirement"),
    role: "A Caldova Pension member",
    line: "Just retired, and celebrating with Helen. His Caldova Pension now pays him every month.",
    side: "super",
    palette: PALETTES.customerRetirement,
    scenario: "retirement",
    story: "Watch his request ›",
    with: ["Adviser", "Marcus Tan"],
    home: ["Telling Marcus about retirement", "Chatting with Marcus and Helen"],
  },
  {
    id: "helen",
    name: "Helen",
    role: "George’s wife",
    line: "Here to celebrate George’s retirement. She is the reversionary beneficiary on his pension.",
    palette: {
      skin: "#ebc19c",
      hair: "#d9c7a8",
      shirt: "#e07a5f",
      pants: "#e07a5f",
      shoes: "#7a4b2a",
      accent: "#f4d58d",
      hairStyle: "long",
      lowerBody: "dress",
    },
    with: ["Here with", "George"],
    home: ["Chatting with George and Marcus", "Toasting George’s retirement"],
  },
  {
    id: "priya",
    name: customerName("onboarding"),
    role: "A new Caldova Super member",
    line: "New to Caldova Super, with her old super brought across into one account.",
    side: "super",
    palette: PALETTES.customerOnboarding,
    scenario: "onboarding",
    story: "Watch her request ›",
    with: ["Adviser", "Hannah Lewis"],
    home: ["Telling Hannah about her new job", "Catching up with Hannah"],
  },
  {
    id: "hannah",
    name: "Hannah Lewis",
    role: "Adviser · Yarra Private Wealth",
    line: "Priya’s adviser, here with her clients.",
    side: "shared",
    palette: {
      skin: "#f2c9a8",
      hair: "#9a3f1c",
      shirt: "#1f2f4d",
      pants: "#1f2f4d",
      shoes: "#1a1a1a",
      accent: "#c9a14a",
      hairStyle: "long",
      lowerBody: "skirt",
    },
    with: ["Client here", "Priya"],
    home: ["Catching up with Priya", "Hearing about Priya’s new job"],
  },
  {
    id: "marcus",
    name: "Marcus Tan",
    role: "Adviser · Bayside Financial Partners",
    line: "George’s adviser, here to toast his retirement.",
    side: "shared",
    palette: {
      skin: "#e5b98f",
      hair: "#141414",
      shirt: "#2f6f6a",
      pants: "#2a2f3a",
      shoes: "#3a2a20",
      accent: "#f8fafc",
      hairStyle: "short",
      glasses: true,
    },
    with: ["Client here", "George"],
    home: ["Catching up with George", "Talking retirement with George and Helen"],
  },
  {
    id: "wrap",
    name: "A Caldova Wrap client",
    role: "A Wealth Management client",
    line: "Invests through Caldova Wrap, with a portfolio set up by his adviser.",
    side: "wealth",
    palette: {
      skin: "#7a4e33",
      hair: "#1d1d1d",
      shirt: "#c9a14a",
      pants: "#2a3344",
      shoes: "#1a1a1a",
      hairStyle: "bald",
      facial: "beard",
    },
    home: ["Relaxing in the lounge", "Chatting in the lounge"],
  },
  {
    id: "portfolio",
    name: "A Managed Portfolios client",
    role: "A Wealth Management client",
    line: "Her savings are invested in one of the Caldova Managed Portfolios.",
    side: "wealth",
    palette: {
      skin: "#f3d1b5",
      hair: "#b8862e",
      shirt: "#9b6ad6",
      pants: "#ece6da",
      shoes: "#d9a03a",
      accent: "#f8fafc",
      hairStyle: "ponytail",
    },
    home: ["Chatting in the lounge", "Laughing on the beanbags"],
  },
  {
    id: "member",
    name: "A Caldova Super member",
    role: "A Superannuation member",
    line: "Has been with Caldova Super for most of his working life.",
    side: "super",
    palette: {
      skin: "#e8b896",
      hair: "#f0f0f0",
      shirt: "#14b8a6",
      pants: "#d6cfc2",
      shoes: "#5a3a25",
      accent: "#f8fafc",
      hairStyle: "hat",
      glasses: true,
    },
    home: ["Relaxing in the lounge", "Telling a story in the lounge"],
  },
];

/** The DJ behind the decks. */
export const PARTY_DJ_PALETTE: VoxelCharacterPalette = {
  skin: "#a26f4c",
  hair: "#111111",
  shirt: "#111827",
  pants: "#1f2937",
  shoes: "#f4f0e6",
  accent: "#5ce1ff",
  hairStyle: "cap",
  glasses: true,
  shirtLogo: true,
};
