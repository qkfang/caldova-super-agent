/**
 * Content for the v2 "Lakehouse" storybook (`/v2`, see docs/storybook.md).
 *
 * Caldova Wealth is a wealth management business built for the agentic era.
 * It has two sides, Wealth Management and Superannuation, and the house is
 * read from the top down:
 *   Level 3 · The Idea         Maya Ashworth, the business owner for both sides, and her idea
 *   Level 2 · The People       two small teams, one per side, with Theo leading both
 *   Level 1 · The Agents       one group of agents: dedicated to a side, or shared by both
 *   Lower level · Engine Room  Microsoft IQ and the Azure services underneath
 *
 * Staff, assistants and scenarios come from the v1 canon (personaData.ts,
 * stepGate.ts and scenarios/*.json). This file adds what v2 needs on top.
 */
import type { VoxelCharacterPalette } from "../characterPalettes";
import type { ScenarioId, StaffTeam } from "../personaData";

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

/** Colours match the v1 team accents (STAFF_TEAMS in personaData.ts). */
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

/** The side a person works on, from their v1 team (personaData.ts). */
export function teamSide(team: StaffTeam): SideId {
  if (team === "Superannuation Team") return "super";
  if (team === "Wealth Management Team") return "wealth";
  return "shared";
}

/** Badge text for an agent's side. */
export function sideBadge(side: SideId): string {
  return side === "shared" ? "Shared · both sides" : `Dedicated · ${side === "super" ? "Super" : "Wealth"}`;
}

/** The side each v1 scenario belongs to: all five are Superannuation member requests. */
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
  /** What this demo actually runs today (shown on the IQ cards). */
  demo?: string;
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
    demo: "Not wired up in this demo. Adviser emails arrive as case documents, and approvals go to Microsoft Teams through an MCP tool.",
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
    demo: "Not wired up in this demo. The backend’s Member Case store and the seeded case files stand in for it.",
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
    demo: "Live in this demo: every agent grounds on, and cites, the wealth_knowledge index.",
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
    security: "In this demo, web grounding goes through the Foundry project connection, so the apps hold no web-search keys.",
    demo: "Stands in for Web IQ in this demo: web context comes from the Grounding with Bing Search connection in the Foundry project.",
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
      "In the demo, delivery to the Teams channel is simulated",
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
      "The demo uses public endpoints secured with Entra ID tokens and role assignments",
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

/** Staff ids whose agents depend on a component ("all" and "platform" mean every agent). */
export function agentsUsing(id: InfraId): string[] {
  const scope = infraInfo(id).scope;
  return Object.entries(AGENTS)
    .filter(([, a]) => scope !== "some" || a.uses.includes(id))
    .map(([staffId]) => staffId);
}
