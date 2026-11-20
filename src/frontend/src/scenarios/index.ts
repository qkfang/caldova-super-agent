/**
 * JSON-driven scenario definitions: one `<id>.json` file per scenario in
 * this folder, mirroring `docs/scenario-N-*.md`. Each holds:
 *  - The case facts: case number, amounts and outcome.
 *  - Beat list — the narration for every step, in the order the case moves
 *    through the team, starting with the request being lodged.
 *  - The result — how the case ends.
 *
 * The lakehouse finale (`v2/requestTrace.ts`) turns each beat into a stop on
 * the request's route through the house, so one JSON edit changes the
 * finale's narration.
 */
import type { ScenarioId, StaffRole } from "../personaData";

import onboarding from "./onboarding.json";
import protection from "./protection.json";
import retirement from "./retirement.json";
import hardship from "./hardship.json";
import bereavement from "./bereavement.json";

/** `rejected` covers declined and blocked cases; `result.status` holds the label. */
export type ScenarioOutcome = "approved" | "rejected" | "partial";

export type BeatAction =
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
  | "comms-notify";

/** Who works the beat: a staff role, or the client lodging the request. */
export type BeatFocus = StaffRole | "customer";

export interface ScenarioBeatJson {
  at: BeatFocus;
  action: BeatAction;
  narration: string;
}

/** Case status label recorded by Payments when the outcome is decided. */
export type CaseDecisionStatus =
  | "completed"
  | "partially approved"
  | "declined"
  | "blocked";

/** How the case ends. The finale's last stop shows the icon, headline and summary. */
export interface ScenarioResultJson {
  /** Case status once Payments records the outcome. */
  status: CaseDecisionStatus;
  /** One-line outcome. */
  headline: string;
  /** The headline figure (e.g. "$7,932 net"). */
  figure: string;
  icon: string;
  /** Outcome line with the full detail. */
  summary: string;
}

export interface ScenarioDefinition {
  id: ScenarioId;
  /** The N in `docs/scenario-N-*.md`. */
  scenarioNumber: number;
  /** Case number, matching the seeded entries in the backend `CaseStore.SeedDefaults`. */
  caseId: string;
  customerId: ScenarioId;
  /** Amount requested on the case. */
  amount: number;
  /** Gross amount paid, invested or commenced at the payment step (0 when blocked). */
  paidAmount: number;
  outcome: ScenarioOutcome;
  beats: ScenarioBeatJson[];
  result: ScenarioResultJson;
}

/** Single source of truth for every scenario. */
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
