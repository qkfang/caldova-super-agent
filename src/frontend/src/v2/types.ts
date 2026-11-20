/**
 * Shared types for the "Lakehouse" storybook (see docs/storybook.md).
 */
import type { Mesh, TransformNode } from "@babylonjs/core";
import type { InfraId, LevelId } from "./lakehouseData";

/** A level of the house, plus the roof that lifts off the top floor. */
export type GroupId = LevelId | "roof";

/** How the level stack is arranged: whole house, one level opened up, or all levels pulled apart. */
export type StackMode =
  | { kind: "house" }
  | { kind: "focus"; level: LevelId }
  | { kind: "exploded" };

/** Anything the visitor can click and read about in the inspector card. */
export type InspectTarget =
  | { type: "owner" }
  | { type: "brain" }
  | { type: "staff"; id: string }
  | { type: "agent"; id: string }
  | { type: "role"; id: string }
  | { type: "infra"; id: InfraId }
  | { type: "desk" }
  | { type: "visitor" }
  /** Amelia, the financial adviser at the front desk. */
  | { type: "adviser" }
  | { type: "party" }
  | { type: "guest"; id: string };

/** Metadata stamped on v2 click hitboxes. */
export interface V2PickMetadata {
  kind: "v2";
  target: InspectTarget;
}

/** A point on a level that threads and the request trace can attach to. */
export interface Anchor {
  node: TransformNode;
  group: GroupId;
  /** Height above the node's origin to attach at. */
  dy: number;
}

/** What is lit up across the house for the current selection or trace step. */
export interface Highlights {
  owner: boolean;
  brain: boolean;
  /** The front desk on the dock. */
  desk: boolean;
  /** Amelia, the financial adviser at the front desk. */
  adviser: boolean;
  staff: ReadonlySet<string>;
  /** Agent bays, by staff id. */
  agents: ReadonlySet<string>;
  /** Individual roles on the agent floor, by role id. */
  roles: ReadonlySet<string>;
  infra: ReadonlySet<InfraId>;
  /** The party on the roof. */
  party: boolean;
  /** Party guests, by guest id. */
  guests: ReadonlySet<string>;
}

/** One level of the house as built by its level builder. */
export interface LevelBuild {
  id: LevelId;
  root: TransformNode;
  /** The floating level tag beside the building. */
  tag: Mesh;
  /** Keys: `owner`, `brain`, `staff:<id>`, `agent:<id>`, `role:<id>`, `infra:<id>`, `iq`, `hub`. */
  anchors: Map<string, Anchor>;
  update(dt: number, t: number): void;
  setHighlights(h: Highlights): void;
  /** One-shot animation played when the story arrives at this level. */
  intro(): void;
}
