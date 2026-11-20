/**
 * World layout for the lakehouse. One unit is roughly 0.6 m; the voxel
 * characters stand about three units tall.
 *
 * Cross-section (front view, the lake is in front of the house):
 *
 *   y 16.8  ── roof ──────────────
 *   y 11.3  Level 3 · The Idea
 *   y  5.8  Level 2 · The People
 *   y  0.3  Level 1 · The Agents   ── deck ── jetty
 *   y -0.6  ~~~~~~~~~~~~~~~~~~~~~~ waterline ~~~~~~~
 *   y -6.0  Lower level · The Engine Room (glass wall onto the lake)
 */
import type { LevelId } from "./lakehouseData";

export interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** Top of each level's floor slab. */
export const FLOOR_Y: Record<LevelId, number> = {
  engine: -6,
  agents: 0.3,
  people: 5.8,
  idea: 11.3,
};

/** Underside of the roof slab (the top of Level 3). */
export const ROOF_Y = 16.3;
/** Floor-to-ceiling height of each storey. */
export const STOREY = 5;
/** Floor slab thickness. */
export const SLAB = 0.5;

/** The basement pit cut into the island (also the size of the Level 1 floor slab). */
export const PIT: Rect = { x0: -20.4, x1: 20.4, z0: -12.9, z1: 8.4 };

/** Wall footprints. */
export const WALLS: Record<LevelId, Rect> = {
  engine: { x0: -20, x1: 20, z0: -12.5, z1: 8 },
  agents: { x0: -20, x1: 20, z0: -12.2, z1: 8 },
  people: { x0: -21, x1: 21, z0: -13, z1: 9 },
  idea: { x0: -20, x1: 8, z0: -10, z1: 7 },
};

/** Floor slab footprints (Level 3's slab is also Level 2's roof, so it carries the terrace). */
export const SLABS: Record<LevelId, Rect> = {
  engine: { x0: -20, x1: 20, z0: -12.5, z1: 8 },
  agents: PIT,
  people: { x0: -21, x1: 21, z0: -13, z1: 9 },
  idea: { x0: -21, x1: 21, z0: -13, z1: 9 },
};

export const ROOF: Rect = { x0: -21.5, x1: 9.5, z0: -11.5, z1: 8.5 };

/** Lift and stair core, stacked through every level at the back-left corner. */
export const CORE: Rect = { x0: -20, x1: -17, z0: 3.5, z1: 7 };

/**
 * Desk positions on Level 2, on a grid of five columns and two rows. Each
 * agent pod on Level 1 sits directly underneath its human, so the thread
 * between them runs straight down.
 *
 *   Level 2   | Wealth Management Team | Theo |   Superannuation Team   |
 *             |  Ivy   Cara / Felix    | lead | Olivia Ben / Rory Penny |
 *   Level 1   | Wealth |      Shared by both     |   Dedicated · Super  |
 *
 * Cara and Felix sit with the Wealth Management Team (personaData.ts), but their
 * agents serve both sides, so they sit in the shared zone with Theo's.
 */
export const STATIONS: Record<string, { x: number; z: number }> = {
  "investments-1": { x: -15, z: -6 },
  "comms-1": { x: -7.5, z: -6 },
  "fincrime-1": { x: -7.5, z: 3.5 },
  "lead-1": { x: 0, z: 3.5 },
  "onboarding-1": { x: 7.5, z: -6 },
  "benefits-1": { x: 15, z: -6 },
  "transfers-1": { x: 7.5, z: 3.5 },
  "payments-1": { x: 15, z: 3.5 },
};

/** The empty front-centre cell: the huddle table on Level 2, the Member Case on Level 1. */
export const CENTRE_CELL = { x: 0, z: -6 };

/** Level 2 wings, left to right. */
export const WINGS = {
  wealth: { x0: -19.6, x1: -3.75 },
  lead: { x0: -3.75, x1: 3.75 },
  super: { x0: 3.75, x1: 19.6 },
} as const;

/** Level 1 zones, left to right: one group of agents, dedicated to a side or shared by both. */
export const ZONES = {
  wealth: { x0: -19.6, x1: -11.25 },
  shared: { x0: -11.25, x1: 3.75 },
  super: { x0: 3.75, x1: 19.6 },
} as const;

/** The front desk on the dock (the Level 1 deck), where visitors sign in. */
export const DOCK_DESK = { x: 2.6, z: -16.0 };

/** The floating island and the lake carved into its front. */
export const ISLAND = { x0: -46, x1: 46, z0: -34, z1: 30, bottom: -12 };
export const LAKE = { z0: -34, z1: -12.9, waterY: -0.6, bedY: -7 };

/** Characters are drawn larger than life so they read from the orbit camera. */
export const CHARACTER_SCALE = 1.5;

/** Facing angle (rotation.y) for a voxel character so it looks along (dx, dz). */
export function faceAngle(dx: number, dz: number): number {
  return Math.atan2(dx, dz);
}
