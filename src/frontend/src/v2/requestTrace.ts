/**
 * The finale: one member request travelling through the whole house.
 *
 * It starts at the dock: the member arrives by water taxi and signs at the
 * front desk (dock.ts). Once the form is signed, the request appears at the
 * desk and sets off. Each step starts with a person on Level 2, dips down to
 * their agent on Level 1 and the engine-room component that agent leans on,
 * then comes back up for the human decision. The result rises to the brain
 * on Level 3, where Maya's idea is measured. Steps come from the scenario
 * beats in scenarios/*.json, which mirror docs/scenario-N-*.md.
 */
import { Mesh, TransformNode, Vector3 } from "@babylonjs/core";
import {
  CUSTOMER_PERSONAS,
  STAFF_PERSONAS,
  findStaffByRole,
  type ScenarioId,
  type StaffRole,
} from "../personaData";
import { getScenario } from "../scenarios";
import type { Dock } from "./dock";
import type { Kit } from "./kit";
import { AGENTS, ARRIVALS, SCENARIO_SIDE, SIDES, infraInfo, sideBadge, type InfraId, type SideId } from "./lakehouseData";
import type { Anchor } from "./types";

export interface TraceFocus {
  staff?: string;
  agent?: string;
  infra?: InfraId[];
  brain?: boolean;
  desk?: boolean;
}

export interface TraceStep {
  index: number;
  total: number;
  kind: "arrive" | "work" | "handoff" | "result";
  who: string;
  route: string[];
  text: string;
  color: string;
  /** Which side of the business this step belongs to, for the trace panel's chip. */
  side?: { label: string; color: string };
}

export interface TraceHooks {
  step(step: TraceStep): void;
  focus(f: TraceFocus | null): void;
  /** "dock": the house together, looking at the dock. "trace": the house pulled apart for the request. */
  stage(stage: "dock" | "trace"): void;
  done(): void;
}

interface Stop {
  kind: TraceStep["kind"];
  staffId?: string;
  text: string;
}

interface Waypoint {
  anchor?: Anchor;
  offset?: Vector3;
  dwell: number;
  first?: boolean;
  /** Wait here, with the request hidden, until the visitor at the front desk has signed. */
  gate?: boolean;
  enter?: () => void;
  /** Called as the request moves on from here. */
  leave?: () => void;
}

const ROLES = new Set<string>(STAFF_PERSONAS.map((p) => p.role));
const SPEED = 24;

/** Turn a scenario's beats into stops: one per person, merging their consecutive beats. */
export function buildStops(id: ScenarioId): Stop[] {
  const def = getScenario(id);
  const lodge = def.beats.find((b) => b.action === "lodge-at-reception")?.narration ?? def.beats[0]?.narration ?? "";
  const stops: Stop[] = [{ kind: "arrive", text: lodge }];
  for (const beat of def.beats) {
    if (!ROLES.has(beat.at)) continue;
    const staff = findStaffByRole(beat.at as StaffRole);
    const handoff = beat.action === "benefits-handoff";
    const last = stops[stops.length - 1];
    if (last.staffId === staff.id) {
      last.text += ` ${beat.narration}`;
      if (!handoff) last.kind = "work";
      continue;
    }
    stops.push({ kind: handoff ? "handoff" : "work", staffId: staff.id, text: beat.narration });
  }
  stops.push({ kind: "result", text: `${def.result.icon} ${def.result.headline}. ${def.result.summary}` });
  return stops;
}

export class RequestTrace {
  private readonly orb: TransformNode;
  private readonly core: Mesh;
  private readonly trail: Mesh[] = [];
  private trailIdx = 0;
  private trailClock = 0;
  private waypoints: Waypoint[] = [];
  private wp = 0;
  private dwell = 0;
  private arrived = false;
  private running = false;
  private finished = false;
  private readonly target = new Vector3();
  private requestSide: SideId = "super";
  private scenario: ScenarioId = "retirement";
  /** Announces the first step as soon as the member's water taxi sets off. */
  private arrival: (() => void) | null = null;
  paused = false;
  speed = 1;

  constructor(
    private readonly kit: Kit,
    private readonly resolve: (key: string) => Anchor | undefined,
    private readonly hooks: TraceHooks,
    private readonly dock: Dock,
  ) {
    const scene = kit.scene;
    this.orb = new TransformNode("v2_traceOrb", scene);
    this.core = kit.block(this.orb, 0, -0.8, 0, 1.6, 1.6, 1.6, kit.mat("#ffd98a", { unlit: true }), {
      dynamic: true,
    });
    kit.block(this.orb, 0, -0.5, 0, 1.0, 1.0, 1.0, kit.mat("#ffffff", { unlit: true }), { dynamic: true });
    const trailMat = kit.mat("#ffc35a", { unlit: true });
    for (let i = 0; i < 30; i++) {
      const m = kit.block(null, 0, 0, 0, 0.7, 0.7, 0.7, trailMat, { dynamic: true });
      m.setEnabled(false);
      this.trail.push(m);
    }
    this.orb.setEnabled(false);
  }

  get active(): boolean {
    return this.running;
  }

  get done(): boolean {
    return this.finished;
  }

  start(id: ScenarioId): void {
    this.scenario = id;
    const stops = buildStops(id);
    const customer = CUSTOMER_PERSONAS.find((c) => c.id === id);
    this.requestSide = SCENARIO_SIDE[id];
    this.waypoints = [];
    this.arrival = null;
    stops.forEach((stop, index) => this.addStop(stop, index, stops.length, customer?.name ?? "", customer?.color ?? "#ffc35a"));
    this.wp = 0;
    this.dwell = 0;
    this.arrived = false;
    this.finished = false;
    this.running = true;
    this.paused = false;
    // The request appears at the front desk once the member has signed.
    this.orb.setEnabled(false);
    for (const m of this.trail) m.setEnabled(false);
    this.dock.arrive(id);
    this.hooks.stage("dock");
    this.announceArrival();
  }

  /** Step 1 is told while the member is still on the water, before the request exists. */
  private announceArrival(): void {
    this.arrival?.();
  }

  stop(): void {
    this.running = false;
    this.finished = false;
    this.orb.setEnabled(false);
    for (const m of this.trail) m.setEnabled(false);
    this.dock.ambient();
    this.hooks.focus(null);
  }

  /** Jump ahead to the next step. */
  skip(): void {
    if (!this.running || this.finished) return;
    if (this.waypoints[this.wp]?.gate && !this.arrived) {
      this.dock.fastForward();
      return;
    }
    for (let i = this.wp + 1; i < this.waypoints.length; i++) {
      if (this.waypoints[i].first) {
        this.moveTo(i);
        return;
      }
    }
  }

  private moveTo(i: number): void {
    this.waypoints[this.wp]?.leave?.();
    this.wp = i;
    this.arrived = false;
  }

  update(dt: number): void {
    if (!this.running) return;
    for (const m of this.trail) {
      if (!m.isEnabled()) continue;
      const s = m.scaling.x * Math.exp(-dt * 3.2);
      if (s < 0.08) m.setEnabled(false);
      else m.scaling.setAll(s);
    }
    this.orb.rotation.y += dt * 2.4;
    this.orb.rotation.x += dt * 1.3;
    this.core.scaling.setAll(1 + Math.sin(performance.now() / 160) * 0.08);
    const gate = this.waypoints[this.wp];
    if (gate?.gate && !this.arrived) {
      // The dock plays the arrival at the finale's speed, and holds still when paused.
      this.dock.timeScale = this.paused ? 0 : this.speed;
      if (!this.dock.signed) return;
      this.targetOf(gate, this.orb.position);
      this.orb.setEnabled(true);
      this.arrived = true;
      this.dwell = gate.dwell;
      gate.enter?.();
      return;
    }
    if (this.paused || this.finished) {
      if (this.finished) this.follow(this.waypoints[this.waypoints.length - 1]);
      return;
    }
    const sdt = dt * this.speed;
    const w = this.waypoints[this.wp];
    if (!w) return;
    this.targetOf(w, this.target);
    if (!this.arrived) {
      const dx = this.target.x - this.orb.position.x;
      const dy = this.target.y - this.orb.position.y;
      const dz = this.target.z - this.orb.position.z;
      const dist = Math.hypot(dx, dy, dz);
      const step = SPEED * sdt * (dist > 30 ? 1.8 : 1);
      if (dist <= step) {
        this.orb.position.copyFrom(this.target);
        this.arrived = true;
        this.dwell = w.dwell;
        w.enter?.();
      } else {
        this.orb.position.x += (dx / dist) * step;
        this.orb.position.y += (dy / dist) * step;
        this.orb.position.z += (dz / dist) * step;
      }
      this.trailClock += sdt;
      if (this.trailClock > 0.03) {
        this.trailClock = 0;
        const m = this.trail[this.trailIdx++ % this.trail.length];
        m.position.copyFrom(this.orb.position);
        m.scaling.setAll(1);
        m.setEnabled(true);
      }
      return;
    }
    this.orb.position.copyFrom(this.target);
    this.dwell -= sdt;
    if (this.dwell > 0) return;
    if (this.wp >= this.waypoints.length - 1) {
      this.finished = true;
      this.hooks.done();
      return;
    }
    this.moveTo(this.wp + 1);
  }

  private follow(w: Waypoint | undefined): void {
    if (!w) return;
    this.targetOf(w, this.target);
    this.orb.position.copyFrom(this.target);
  }

  private targetOf(w: Waypoint, out: Vector3): void {
    if (w.anchor) {
      out.copyFrom(w.anchor.node.getAbsolutePosition());
      out.y += w.anchor.dy + 0.9;
    } else {
      out.setAll(0);
    }
    if (w.offset) out.addInPlace(w.offset);
  }

  /** The chip for an agent's side; a dedicated agent from the other side has been called in. */
  private sideChip(side: SideId): TraceStep["side"] {
    const calledIn = side !== "shared" && side !== this.requestSide;
    return { label: `${sideBadge(side)}${calledIn ? " · called in" : ""}`, color: SIDES[side].color };
  }

  private addStop(stop: Stop, index: number, total: number, member: string, memberColor: string): void {
    const read = Math.min(7.5, Math.max(3.2, stop.text.length * 0.045));
    const announce = (who: string, route: string[], color: string, side?: TraceStep["side"]): void =>
      this.hooks.step({ index, total, kind: stop.kind, who, route, text: stop.text, color, side });

    if (stop.kind === "arrive") {
      const arrival = ARRIVALS[this.scenario];
      const side = SIDES[this.requestSide];
      const impostor = arrival.visitor === "impostor";
      const visitor = impostor ? "Someone" : member;
      const who = impostor ? `Someone · signing in ${member.split(" ")[0]}’s name` : `${member} · arrives by water taxi`;
      this.arrival = () => {
        this.hooks.focus({ desk: true });
        this.hooks.step({
          index,
          total,
          kind: "arrive",
          who,
          route: [visitor, "Front desk", "Form Extraction agent"],
          text: `${arrival.line} ${stop.text}`,
          color: memberColor,
          side: { label: `${side.name} request`, color: side.color },
        });
      };
      this.waypoints.push({
        anchor: this.resolve("desk"),
        dwell: 1.8,
        first: true,
        gate: true,
        // Signed: the request glows over the desk a moment, then the house pulls apart as it sets off.
        leave: () => this.hooks.stage("trace"),
      });
      return;
    }

    if (stop.kind === "result") {
      this.waypoints.push({
        anchor: this.resolve("brain"),
        dwell: 6,
        first: true,
        enter: () => {
          this.hooks.focus({ brain: true });
          announce("Back to the top floor", ["Outcome", "Maya’s goals"], "#ffc35a");
        },
      });
      return;
    }

    const staff = STAFF_PERSONAS.find((p) => p.id === stop.staffId);
    const agent = staff ? AGENTS[staff.id] : undefined;
    if (!staff || !agent) return;
    const person = this.resolve(`staff:${staff.id}`);
    const who = `${staff.name} · ${staff.department}`;
    const side = this.sideChip(agent.side);

    if (stop.kind === "handoff") {
      this.waypoints.push({
        anchor: person,
        dwell: read,
        first: true,
        enter: () => {
          this.hooks.focus({ staff: staff.id });
          announce(who, [staff.name, "hands over"], staff.color, side);
        },
      });
      return;
    }

    const sig = agent.signature;
    const route = [staff.name, staff.agent_name, infraInfo(sig).name];
    const infra: InfraId[] = sig === "foundry" ? ["foundry"] : ["foundry", sig];
    const pod = this.resolve(`agent:${staff.id}`);
    this.waypoints.push({
      anchor: person,
      dwell: read * 0.4,
      first: true,
      enter: () => {
        this.hooks.focus({ staff: staff.id });
        announce(who, route, staff.color, side);
      },
    });
    this.waypoints.push({ anchor: pod, dwell: read * 0.2, enter: () => this.hooks.focus({ staff: staff.id, agent: staff.id }) });
    this.waypoints.push({
      anchor: this.resolve(`infra:${sig}`),
      dwell: read * 0.25,
      enter: () => this.hooks.focus({ staff: staff.id, agent: staff.id, infra }),
    });
    this.waypoints.push({ anchor: pod, dwell: 0.1 });
    this.waypoints.push({ anchor: person, dwell: read * 0.15 + 0.5, enter: () => this.hooks.focus({ staff: staff.id }) });
  }
}
