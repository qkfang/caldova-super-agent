/**
 * Content for the v2 "Lakehouse" storybook (`/v2`, see docs/storybook.md).
 *
 * The lakehouse is read from the top down:
 *   Level 3 · The Idea         Maya Ashworth, the business owner, and her idea ("the brain")
 *   Level 2 · The People       the eight-person Caldova Client Operations team
 *   Level 1 · The Agents       one Microsoft Foundry agent under each person
 *   Lower level · Engine Room  the Azure infrastructure and network underneath
 *
 * Staff, sub-agents and scenarios come from the v1 canon (personaData.ts,
 * stepGate.ts and scenarios/*.json). This file only adds what v2 needs on
 * top: the owner, the idea, the Foundry agent ids, and the engine room.
 */
import type { VoxelCharacterPalette } from "../characterPalettes";

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
  { id: "people", floor: "2", name: "The People", caption: "Caldova Client Operations", accent: "#ff8f6b" },
  { id: "agents", floor: "1", name: "The Agents", caption: "Microsoft Foundry agents", accent: "#5ce1ff" },
  { id: "engine", floor: "B", name: "The Engine Room", caption: "Infrastructure and network", accent: "#a78bfa" },
];

export function levelInfo(id: LevelId): LevelInfo {
  const l = LEVELS.find((x) => x.id === id);
  if (!l) throw new Error(`Unknown level: ${id}`);
  return l;
}

/* ------------------------------------------------------------------------ */
/* Level 3 — the business owner and the idea                                 */
/* ------------------------------------------------------------------------ */

export const OWNER = {
  id: "owner",
  name: "Maya Ashworth",
  firstName: "Maya",
  role: "Managing Director, Caldova Wealth",
  badge: "Business owner",
  color: "#ffc35a",
  personality: "Curious, practical and people-first.",
  typical_line: "If a member has to chase us, we’ve already let them down.",
  summary:
    "Maya is the business owner. She is accountable for Caldova Client Operations: she sets the goals, decides where to invest, and holds the line on one rule — people approve every decision that matters.",
  owns: [
    "The goals the whole house works to",
    "The guardrails: when a person must approve, and what agents may never do",
    "Investment in the team and the platform",
    "The results members and advisers feel",
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

/** The idea that lives in "the brain" above Maya's table. */
export const IDEA = {
  name: "Wealth Team in a Day",
  statement:
    "Give every person in Client Operations a specialised AI agent for their stage of the request lifecycle, so requests become clearer, faster and more consistent, with people approving every decision that matters.",
  goals: [
    {
      tile: "CLEARER",
      title: "Clearer",
      text: "Members and advisers always know where their request is and what happens next.",
    },
    {
      tile: "FASTER",
      title: "Faster",
      text: "Agents do the reading, checking, calculating and drafting in minutes, so requests don’t sit in a queue.",
    },
    {
      tile: "CONSISTENT",
      title: "More consistent",
      text: "Every request follows one lifecycle, and every check cites the rule it relied on.",
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
/* Level 1 — one Foundry agent per person                                    */
/* ------------------------------------------------------------------------ */

export type InfraId =
  | "foundry"
  | "search"
  | "bing"
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
  /** Engine-room components this agent calls while it works. */
  uses: InfraId[];
  /** The component that makes this agent different, used by the request trace. */
  signature: InfraId;
  signatureLine: string;
}

/** Every agent shares these through the CaldovaAgent base class. */
const SHARED: InfraId[] = ["foundry", "search", "bing"];

/** Keyed by staff id (personaData.ts). */
export const AGENTS: Record<string, AgentInfo> = {
  "onboarding-1": {
    foundryId: "onboarding-agent",
    uses: SHARED,
    signature: "search",
    signatureLine: "Runs the NIGO checklist against the guides in the wealth_knowledge index.",
  },
  "benefits-1": {
    foundryId: "benefits-eligibility-agent",
    uses: SHARED,
    signature: "search",
    signatureLine: "Cites a rule from the wealth_knowledge index for every check.",
  },
  "investments-1": {
    foundryId: "investment-analyst-agent",
    uses: [...SHARED, "mcp"],
    signature: "mcp",
    signatureLine: "Uses MCP tools to analyse fact sheets, compare models and build the client workbook.",
  },
  "fincrime-1": {
    foundryId: "financial-crime-agent",
    uses: [...SHARED, "content"],
    signature: "content",
    signatureLine: "Uses Azure Content Understanding to check documents for signs of tampering.",
  },
  "transfers-1": {
    foundryId: "transfers-rollovers-agent",
    uses: [...SHARED, "mcp"],
    signature: "mcp",
    signatureLine: "Uses MCP tools to look up funds, verify SMSFs and generate the transfer request PDF.",
  },
  "payments-1": {
    foundryId: "payments-agent",
    uses: [...SHARED, "mcp", "teams"],
    signature: "teams",
    signatureLine: "Uses MCP tools to calculate benefits and check limits, then waits for a Microsoft Teams approval.",
  },
  "comms-1": {
    foundryId: "client-communications-agent",
    voiceId: "client-communications-voice-agent",
    uses: [...SHARED, "voice"],
    signature: "voice",
    signatureLine: "Has a voice agent on Azure Voice Live, so members can talk to Cara about their case.",
  },
  "lead-1": {
    foundryId: "team-leader-agent",
    uses: SHARED,
    signature: "foundry",
    signatureLine: "Runs the group chat that coordinates the other seven agents on one case.",
  },
};

/* ------------------------------------------------------------------------ */
/* Lower level — the engine room                                             */
/* ------------------------------------------------------------------------ */

export interface InfraInfo {
  id: InfraId;
  name: string;
  /** Short label painted in the engine room. */
  sign: string;
  /** One-line subtitle under the sign. */
  tag: string;
  kind: string;
  color: string;
  /** "all" when every agent depends on it. */
  scope: "all" | "some" | "platform";
  summary: string;
  details: string[];
  security: string;
}

export const INFRA: InfraInfo[] = [
  {
    id: "foundry",
    name: "Microsoft Foundry",
    sign: "MICROSOFT FOUNDRY",
    tag: "9 agents · gpt-5.4",
    kind: "Agent platform and model",
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
    id: "search",
    name: "Azure AI Search · wealth_knowledge",
    sign: "AZURE AI SEARCH",
    tag: "wealth_knowledge index",
    kind: "Grounding and knowledge",
    color: "#38bdf8",
    scope: "all",
    summary:
      "Grounds every answer in, and cites, the wealth_knowledge index: PDS and trust-deed extracts, super rules, the fee schedule, the model portfolio menu and the case files.",
    details: [
      "Semantic search enabled",
      "Built and loaded with ai-search/setup-index.ps1 and ingest-documents.ps1",
      "It is the digital version of the v1 office’s document archive",
    ],
    security:
      "Foundry’s managed identities read the index with Search Index Data Reader; the web apps hold Search Index Data Contributor.",
  },
  {
    id: "bing",
    name: "Grounding with Bing Search",
    sign: "BING GROUNDING",
    tag: "web grounding",
    kind: "Grounding on the public web",
    color: "#2dd4bf",
    scope: "all",
    summary:
      "Public web grounding for up-to-date reference information, wired into every agent through the shared base class.",
    details: ["Connected to the Foundry project as a Bing grounding connection"],
    security: "Reached through the Foundry project connection, so the apps hold no Bing keys.",
  },
  {
    id: "mcp",
    name: "MCP server · caldova-ops-mcp",
    sign: "MCP TOOLS",
    tag: "caldova-ops-mcp at /mcp",
    kind: "Tools that act on systems",
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
    kind: "Human in the loop",
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
    kind: "Document analysis",
    color: "#fb923c",
    scope: "some",
    summary:
      "Checks ID documents, bank statements, SMSF letters and death certificates, and returns a legit, suspicious or fake verdict with the reasons.",
    details: ["Used by Felix’s Financial Crime Agent"],
    security: "Signs in with DefaultAzureCredential, or an API key when one is configured.",
  },
  {
    id: "voice",
    name: "Azure Voice Live",
    sign: "VOICE LIVE",
    tag: "Cara’s voice agent",
    kind: "Real-time voice",
    color: "#ec4899",
    scope: "some",
    summary: "Lets members and advisers talk to Cara’s voice agent about a case, in plain English.",
    details: ["Runs client-communications-voice-agent", "The backend proxies the Voice Live WebSocket"],
    security: "The backend’s managed identity signs each Voice Live connection.",
  },
  {
    id: "apps",
    name: "Azure App Service",
    sign: "APP SERVICE",
    tag: "frontend + backend",
    kind: "Hosting",
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
    kind: "Identity and access",
    color: "#facc15",
    scope: "platform",
    summary:
      "No keys in code: the web apps and Foundry sign in with managed identities and DefaultAzureCredential, and role assignments limit what each one can do.",
    details: [
      "Azure AI User, Azure AI Developer and Cognitive Services OpenAI User on Foundry",
      "Search Index Data Reader, Search Index Data Contributor and Search Service Contributor on AI Search",
    ],
    security: "Every call carries an Entra ID token scoped by these roles.",
  },
  {
    id: "vault",
    name: "Azure Key Vault",
    sign: "KEY VAULT",
    tag: "secrets and keys",
    kind: "Secrets",
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
    kind: "Files",
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
    kind: "Observability",
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
    kind: "How it all connects",
    color: "#22d3ee",
    scope: "platform",
    summary:
      "Every hop is HTTPS: the browser to App Service, the backend to the Foundry project endpoint, Foundry to AI Search, Bing and the backend’s /mcp tools, plus a WebSocket for Voice Live.",
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
