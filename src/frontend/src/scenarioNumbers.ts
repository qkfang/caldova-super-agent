/**
 * Maps each client scenario id to its docs/scenario-N number:
 * scenario-1 new-client-onboarding, scenario-2 account-takeover,
 * scenario-3 retirement-pension, scenario-4 financial-hardship,
 * scenario-5 death-benefit.
 */
import type { ScenarioId } from "./personaData";

// Keep the property order aligned with docs/scenario-N-*.md so the
// canonical 1..5 sequence is consistent across frontend, backend and docs.
export const SCENARIO_NUMBER: Record<ScenarioId, number> = {
  onboarding: 1,
  protection: 2,
  retirement: 3,
  hardship: 4,
  bereavement: 5,
};
