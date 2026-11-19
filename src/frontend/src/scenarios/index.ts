/**
 * JSON-driven scenario definitions.
 *
 * Each scenario lives in its own `<id>.json` file in this folder so the
 * simulation can be fully triggered and played out from data alone:
 *  - Client + life-event zone (Melbourne neighbourhood)
 *  - Reset block — snaps every staff member back to their desk and clears
 *    any leftover ambient case folders before the scripted run begins.
 *  - Beat list — the narration shown in the banner / step gate for every
 *    step, in the order the case moves through the office.
 *  - Consultation hooks — specialists (Investment Analyst, Financial Crime,
 *    Transfers & Rollovers, Team Leader) who work the case before and/or
 *    after Benefits & Eligibility — plus the deterministic outcome.
 *
 * `personaData.ts` and `caseSimulation.ts` import these to drive the
 * scripted flow, so one JSON edit changes both the on-screen narration
 * and the underlying simulation behaviour.
 */
import type { ScenarioId, StaffRole } from "../personaData";

import onboarding from "./onboarding.json";
import protection from "./protection.json";
import retirement from "./retirement.json";
import hardship from "./hardship.json";
import bereavement from "./bereavement.json";

/** `rejected` is shown as "blocked" for financial-crime scenarios. */
export type ScenarioOutcome = "approved" | "rejected" | "partial";

export interface ScenarioConsultation {
  role: StaffRole;
  narration: string;
  /** Seconds the specialist dwells on the case at their desk. */
  duration: number;
}

export type BeatAction =
  | "arrive-at-zone"
  | "walk-to-office"
  | "enter-office"
  | "lodge-at-reception"
  | "onboarding-pickup"
  | "onboarding-route"
  | "benefits-pickup"
  | "benefits-process"
  | "investment-review"
  | "fincrime-review"
  | "transfers-coordinate"
  | "team-leader-review"
  | "benefits-handoff"
  | "payment"
  | "comms-notify"
  | "customer-leave";

export type BeatFocus = StaffRole | "customer" | "office" | "neighbourhood";

export interface ScenarioBeatJson {
  at: BeatFocus;
  action: BeatAction;
  narration: string;
  duration?: number;
  outcome?: ScenarioOutcome;
}

export interface ScenarioResetJson {
  office: {
    /** Snap every staff member back to their home desk. */
    snapStaffToDesks: boolean;
    /** Clear inbox / payments / comms / benefits-ready queues. */
    clearQueues: boolean;
    /** Despawn every non-scripted client currently in flight. */
    removeUnscriptedCustomers: boolean;
  };
  neighbourhood: {
    incidentZone: ScenarioId;
  };
}

/** Activity-log lines written as the case moves through the core pipeline. */
export interface ScenarioNarrationsJson {
  /** Logged when Benefits & Eligibility picks the case up. */
  benefits: string;
  /** Logged when Benefits & Eligibility finishes the assessment. */
  benefitsResult: string;
  /** Logged when Payments picks the case up. */
  payment: string;
  /** Logged when Payments records the outcome. */
  paymentResult: string;
  /** Logged when Client Communications closes the case. */
  comms: string;
}

/** Case status label recorded by Payments when the outcome is decided. */
export type CaseDecisionStatus =
  | "completed"
  | "partially approved"
  | "declined"
  | "blocked";

/** End-of-scenario wording for the result banner and summary modal. */
export interface ScenarioResultJson {
  /** Case status shown once Payments records the outcome. */
  status: CaseDecisionStatus;
  /** Headline on the client result banner. */
  headline: string;
  /** Big figure on the result banner (e.g. "$7,932 net"). */
  figure: string;
  /** Icon on the result banner. */
  icon: string;
  /** Outcome line in the scenario summary modal. */
  summary: string;
}

export interface ScenarioDefinition {
  id: ScenarioId;
  scenarioNumber: number;
  /**
   * Fixed case number used when this scenario is launched. Mirrors the
   * seeded entries in the backend `CaseStore.SeedDefaults` so the scripted
   * simulation, the onboarding mock data, and downstream agent pages all
   * reference the same case.
   */
  caseId: string;
  customerId: ScenarioId;
  incidentZone: ScenarioId;
  /** Amount requested on the case (shown when it arrives). */
  amount: number;
  /** Gross amount paid, invested or commenced at the payment step (0 when blocked). */
  paidAmount: number;
  /** Force Benefits & Eligibility to pass the case on (true) or decline it outright (false). */
  approveAtBenefits: boolean;
  outcome: ScenarioOutcome;
  narrations: ScenarioNarrationsJson;
  /** Specialists consulted after Onboarding and before Benefits & Eligibility. */
  preBenefits: ScenarioConsultation[];
  /** Specialists consulted after Benefits & Eligibility and before Payments. */
  postBenefits: ScenarioConsultation[];
  beats: ScenarioBeatJson[];
  result: ScenarioResultJson;
  reset: ScenarioResetJson;
}

/** Single source of truth for every scripted scenario. */
export const SCENARIOS: Record<ScenarioId, ScenarioDefinition> = {
  onboarding: onboarding as ScenarioDefinition,
  protection: protection as ScenarioDefinition,
  retirement: retirement as ScenarioDefinition,
  hardship: hardship as ScenarioDefinition,
  bereavement: bereavement as ScenarioDefinition,
};

export function getScenario(id: ScenarioId): ScenarioDefinition {
  const s = SCENARIOS[id];
  if (!s) {
    const valid = Object.keys(SCENARIOS).join(", ");
    throw new Error(`Unknown scenario id: ${id}. Valid IDs are: ${valid}`);
  }
  return s;
}

/** Narration for the first beat with the given action, if the scenario defines one. */
export function getBeatNarration(
  id: ScenarioId,
  action: BeatAction,
): string | undefined {
  return getScenario(id).beats.find((b) => b.action === action)?.narration;
}
