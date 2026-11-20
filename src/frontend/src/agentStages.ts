/**
 * Each staff member's step in a request: its title, the staff role that
 * owns it, the two specialised assistants of that person's agent (matching
 * docs/foundry_agents.md) and the matching `src/backend` agent page. The
 * lakehouse uses it for each agent's assistants on Level 1, and
 * `APP_BASE_URL` for links to the agent pages.
 */
import type { StaffRole } from "./personaData";

export type StageKey =
  | "onboarding-pickup"
  | "benefits-pickup"
  | "consult:Investment Analyst"
  | "consult:Financial Crime Investigator"
  | "consult:Transfers & Rollovers Coordinator"
  | "consult:Client Operations Team Leader"
  | "payment"
  | "comms-notify";

/**
 * Base URL for the companion `src/backend` Blazor site that hosts the
 * per-agent walkthrough pages (`/agents/{id}`).
 *
 * Read from the `VITE_APP_BASE_URL` Vite app setting at build time. The
 * default value lives in `src/frontend/.env`; override it with an
 * `.env.local` for local development, or via the
 * `.github/workflows/21_deploy_frontend.yml` workflow for deployments.
 */
export const APP_BASE_URL: string = (
  (import.meta as unknown as { env?: Record<string, string> }).env
    ?.VITE_APP_BASE_URL ?? ""
).replace(/\/+$/, "");

/** Stage configuration — title, staff role, AI sub-agents, and the matching
 * `src/backend` agent route id used to deep-link the walkthrough page. */
export const STAGE_CONFIG: Record<
  StageKey,
  {
    title: string;
    /** Staff role that owns this step. */
    role: StaffRole;
    /** Matches an Id in `src/backend/Models/AgentCatalog.cs` (route `/agents/{id}`). */
    appAgentId: string;
    agents: { name: string; description: string }[];
  }
> = {
  "onboarding-pickup": {
    title: "Onboarding & Requests",
    role: "Onboarding & Requests Officer",
    appAgentId: "onboarding",
    agents: [
      {
        name: "Agent Olivia #1 — Form Extraction",
        description:
          "Reads adviser emails, application forms and member requests, and extracts every field into the Member Case for Olivia.",
      },
      {
        name: "Agent Olivia #2 — NIGO Checklist",
        description:
          "Runs the not-in-good-order checklist — ID, TFN, signatures, fee consent, nominations, investment and insurance elections — and sets the priority.",
      },
    ],
  },
  "benefits-pickup": {
    title: "Benefits & Eligibility",
    role: "Benefits & Eligibility Assessor",
    appAgentId: "benefits-eligibility",
    agents: [
      {
        name: "Agent Ben #1 — Eligibility Rules",
        description:
          "Checks conditions of release, hardship criteria, the transfer balance cap and minimum drawdowns, citing the PDS, trust deed and SIS clause.",
      },
      {
        name: "Agent Ben #2 — Nominations & Consent",
        description:
          "Validates BDBNs and SIS dependants, adviser fee consent (s99FA) and TMD fit, and drafts the approve / partial / decline recommendation.",
      },
    ],
  },
  "consult:Investment Analyst": {
    title: "Investment Review",
    role: "Investment Analyst",
    appAgentId: "investment-analyst",
    agents: [
      {
        name: "Agent Ivy #1 — Portfolio Fit",
        description:
          "Checks the model portfolio against the client's risk profile and Statement of Advice, and plans redemptions and cash buckets.",
      },
      {
        name: "Agent Ivy #2 — Fee Comparison",
        description:
          "Compares model portfolios on fees in dollars, returns and risk, and builds the client workbook and chart.",
      },
    ],
  },
  "consult:Financial Crime Investigator": {
    title: "Financial Crime Review",
    role: "Financial Crime Investigator",
    appAgentId: "financial-crime",
    agents: [
      {
        name: "Agent Felix #1 — ID Authenticity",
        description:
          "Scans ID documents, bank statements and certificates for signs of tampering.",
      },
      {
        name: "Agent Felix #2 — Risk Timeline",
        description:
          "Builds the account-activity timeline, screens PEP and sanctions lists, and explains the risk score with recommended holds and call-backs.",
      },
    ],
  },
  "consult:Transfers & Rollovers Coordinator": {
    title: "Transfers & Rollovers",
    role: "Transfers & Rollovers Coordinator",
    appAgentId: "transfers-rollovers",
    agents: [
      {
        name: "Agent Rory #1 — Fund Lookup & SVS",
        description:
          "Finds external funds by USI, verifies SMSFs with the ATO SMSF verification service, and warns about insurance cover lost on rollover.",
      },
      {
        name: "Agent Rory #2 — Rollover Requests",
        description:
          "Generates the SuperStream rollover or transfer request, tracks the 3-business-day SLA and chases counterparties.",
      },
    ],
  },
  "consult:Client Operations Team Leader": {
    title: "Team Leader Review",
    role: "Client Operations Team Leader",
    appAgentId: "team-leader",
    agents: [
      {
        name: "Agent Theo #1 — SLA & Escalations",
        description:
          "Monitors queues, rollover SLAs and IDR clocks, and surfaces the cases that need a decision.",
      },
      {
        name: "Agent Theo #2 — Approvals & Quality",
        description:
          "Prepares approval recommendations for declines, blocks and vulnerable-member cases, and samples closed cases for quality.",
      },
    ],
  },
  payment: {
    title: "Payments",
    role: "Payments Officer",
    appAgentId: "payments",
    agents: [
      {
        name: "Agent Penny #1 — Benefit Calculator",
        description:
          "Splits tax-free and taxable components, and calculates PAYG withholding and the net payment.",
      },
      {
        name: "Agent Penny #2 — Payment Controls",
        description:
          "Validates payee and bank details, checks authority limits, raises the Microsoft Teams approval card, and releases money only after approval.",
      },
    ],
  },
  "comms-notify": {
    title: "Client Communications",
    role: "Client Communications Specialist",
    appAgentId: "client-communications",
    agents: [
      {
        name: "Agent Cara #1 — Letters & Updates",
        description:
          "Drafts member letters, adviser updates and SMS in plain English, matched to the case outcome.",
      },
      {
        name: "Agent Cara #2 — Tone & Compliance",
        description:
          "Checks tone for bereavement, hardship and scam victims, and confirms required disclosures and IDR/AFCA rights — never personal advice.",
      },
    ],
  },
};
