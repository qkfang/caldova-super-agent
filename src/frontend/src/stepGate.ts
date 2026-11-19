/**
 * Step gate — a modal that pauses the scripted simulation at the start of
 * each major pipeline step (onboarding, benefits & eligibility, investment
 * review, financial crime, transfers & rollovers, team leader review,
 * payments, client communications).
 *
 * The popup names the staff member taking the case, lists the AI sub-agents
 * delegated under them (matching docs/foundry_agents.md), and offers:
 *  - Continue (proceed to this step manually),
 *  - Auto-play (skip the gate for the rest of the scenario).
 *
 * Auto-play can also be enabled up-front via the scenario picker.
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

export interface StageInfo {
  /** Short title shown in the popup header. */
  title: string;
  /** Step number relative to the scripted scenario (filled at runtime). */
  stepNumber?: number;
  /** Total step count (filled at runtime). */
  totalSteps?: number;
  /** Staff role label (e.g. "Onboarding & Requests Officer"). */
  staffRole: StaffRole;
  /** Staff persona name (e.g. "Olivia"). */
  staffName: string;
  /** Staff swatch color. */
  staffColor: string;
  /** Plain-English narration of what is about to happen. */
  narration: string;
  /** AI sub-agents delegated for this step. */
  agents: { name: string; description: string }[];
  /** Agent id used to deep-link the walkthrough page in the `src/backend` site. */
  appAgentId: string;
}

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

/** Stages that should pop the step gate (in order they appear in scripts). */
export const GATED_STAGES = new Set<StageKey>(
  Object.keys(STAGE_CONFIG) as StageKey[],
);

export interface StepGateHooks {
  /** Called when the user clicks Continue. */
  onContinue(): void;
  /** Called when the user clicks Auto-play (turns auto-play on for the run). */
  onAutoPlay(): void;
  /** Called when the user closes the gate (cancels the scenario). */
  onCancel(): void;
}

/** UI controller for the step-gate modal. */
export class StepGate {
  private readonly overlay: HTMLDivElement;
  private hooks: StepGateHooks | null = null;
  private opened = false;

  constructor() {
    const overlay = document.createElement("div");
    overlay.id = "step-gate-overlay";
    overlay.className = "modal-overlay step-gate hidden";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "step-gate-title");
    overlay.innerHTML = `
      <div class="modal-card step-card" role="document">
        <header>
          <div class="step-header-left">
            <div class="step-counter"></div>
            <h2 id="step-gate-title"></h2>
          </div>
          <button class="close" aria-label="Cancel scenario">×</button>
        </header>
        <div class="step-staff">
          <div class="step-staff-dot"></div>
          <div>
            <div class="step-staff-name"></div>
            <div class="step-staff-role"></div>
          </div>
        </div>
        <p class="step-narration"></p>
        <div class="step-agents-label">AI sub-agents delegated to this step</div>
        <ul class="step-agents-list"></ul>
        <a class="step-walkthrough"
           href="#"
           target="_blank"
           rel="noopener noreferrer">
          See how this team uses these agents <span aria-hidden="true">↗</span>
        </a>
        <footer class="step-footer">
          <button type="button" class="step-autoplay">▶ Auto-play rest</button>
          <button type="button" class="step-continue">Continue</button>
        </footer>
      </div>
    `;
    document.body.appendChild(overlay);
    this.overlay = overlay;

    overlay
      .querySelector(".step-continue")!
      .addEventListener("click", () => this.handleContinue());
    overlay
      .querySelector(".step-autoplay")!
      .addEventListener("click", () => this.handleAutoplay());
    overlay
      .querySelector(".close")!
      .addEventListener("click", () => this.handleCancel());
  }

  open(info: StageInfo, hooks: StepGateHooks): void {
    this.hooks = hooks;
    this.opened = true;
    const counter =
      info.stepNumber && info.totalSteps
        ? `Step ${info.stepNumber} of ${info.totalSteps}`
        : "";
    (this.overlay.querySelector(".step-counter") as HTMLElement).textContent =
      counter;
    (this.overlay.querySelector("#step-gate-title") as HTMLElement).textContent =
      info.title;
    (
      this.overlay.querySelector(".step-staff-dot") as HTMLElement
    ).style.background = info.staffColor;
    (this.overlay.querySelector(".step-staff-name") as HTMLElement).textContent =
      info.staffName;
    (this.overlay.querySelector(".step-staff-role") as HTMLElement).textContent =
      info.staffRole;
    (this.overlay.querySelector(".step-narration") as HTMLElement).textContent =
      info.narration;

    const walkthrough = this.overlay.querySelector(
      ".step-walkthrough",
    ) as HTMLAnchorElement;
    walkthrough.href = `${APP_BASE_URL}/agents/${encodeURIComponent(
      info.appAgentId,
    )}`;
    walkthrough.title = `Open ${info.title} walkthrough in a new tab`;

    const list = this.overlay.querySelector(
      ".step-agents-list",
    ) as HTMLUListElement;
    list.innerHTML = "";
    for (const a of info.agents) {
      const li = document.createElement("li");
      li.className = "step-agent";
      li.innerHTML = `
        <span class="bulb" aria-hidden="true">💡</span>
        <div>
          <div class="step-agent-name"></div>
          <div class="step-agent-desc"></div>
        </div>
      `;
      (li.querySelector(".step-agent-name") as HTMLElement).textContent = a.name;
      (li.querySelector(".step-agent-desc") as HTMLElement).textContent =
        a.description;
      list.appendChild(li);
    }

    this.overlay.classList.remove("hidden");
    (this.overlay.querySelector(".step-continue") as HTMLButtonElement).focus();
  }

  close(): void {
    this.opened = false;
    this.overlay.classList.add("hidden");
    this.hooks = null;
  }

  isOpen(): boolean {
    return this.opened;
  }

  private handleContinue(): void {
    const h = this.hooks;
    this.close();
    h?.onContinue();
  }

  private handleAutoplay(): void {
    const h = this.hooks;
    this.close();
    h?.onAutoPlay();
  }

  private handleCancel(): void {
    const h = this.hooks;
    this.close();
    h?.onCancel();
  }
}
