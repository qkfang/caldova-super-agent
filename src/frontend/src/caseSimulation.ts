import {
  Color3,
  Mesh,
  MeshBuilder,
  Observable,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import { OfficeLayout } from "./officeScene";
import { OFFICE_CHARACTER_SCALE, PALETTES, VoxelCharacter, type VoxelCharacterPalette } from "./voxelCharacter";
import {
  CUSTOMER_PERSONAS,
  STAFF_PERSONAS,
  findCustomerPersona,
  type CustomerPersona,
  type ScenarioId,
  type StaffPersona,
  type StaffRole,
  type StaffTeam,
} from "./personaData";
import {
  getBeatNarration,
  getScenario,
  type BeatAction,
  type CaseDecisionStatus,
  type ScenarioNarrationsJson,
} from "./scenarios";
import { APP_BASE_URL, STAGE_CONFIG } from "./stepGate";

/**
 * Caldova Client Operations staff roles, mirroring the cast in
 * `personaData.ts` and the departments in the voxel office.
 */
export type AgentRole = StaffRole;

export type CaseStatus =
  | "received"
  | "onboarding"
  | "assessing"
  | "assessed"
  | CaseDecisionStatus
  | "closed";

export interface MemberCase {
  id: string;
  type: string;
  /** Amount requested on the case. */
  amount: number;
  /** Gross amount paid, invested or commenced by Payments (0 until decided / when declined). */
  paidAmount: number;
  status: CaseStatus;
  /** Outcome recorded by Payments; undefined until decided. */
  outcome?: ScriptOutcome;
  /** The visible folder mesh that travels with the case. */
  mesh: Mesh;
  /**
   * Optional scripted scenario data. Present only on cases started via
   * `startScripted` — drives deterministic outcomes and inserts
   * "consultation" beats with specialist staff (Investment Analyst,
   * Financial Crime, Transfers & Rollovers, Team Leader) before and/or
   * after the Benefits & Eligibility assessment.
   */
  script?: CaseScript;
  /**
   * Identifier of the staff member currently holding / processing the
   * case folder. `null` means the folder is on a desk/inbox/archive.
   */
  currentHolderId: string | null;
}

export type ScriptOutcome = "approved" | "rejected" | "partial";

export interface ScriptExtraBeat {
  role: AgentRole;
  narration: string;
  /** Seconds the specialist dwells on the folder. */
  duration: number;
}

export interface CaseScript {
  scenarioId: ScenarioId;
  /**
   * Fixed case number used for the spawned client's folder. Mirrors the
   * seeded record in the backend so the on-screen case number matches the
   * mock data shown on the agent demo pages.
   */
  caseId: string;
  /** Amount requested on the case. */
  amount: number;
  /** Gross amount paid / invested / commenced at the payment step. */
  paidAmount: number;
  /** Force Benefits & Eligibility to pass the case on (true) or decline it (false). */
  approveAtBenefits: boolean;
  /** Sequential consultations between Onboarding and Benefits & Eligibility. */
  preBenefits: ScriptExtraBeat[];
  /** Sequential consultations between Benefits & Eligibility and Payments. */
  postBenefits: ScriptExtraBeat[];
  /** Final outcome — overrides the random roll. */
  outcome: ScriptOutcome;
  /** Case status shown once Payments records the outcome. */
  decisionStatus: CaseDecisionStatus;
  /** Activity-log lines for the core pipeline steps. */
  narrations: ScenarioNarrationsJson;
  /** Hex color used for log entries / banner. */
  color: string;
  /** Persona name shown in banner. */
  personaName: string;
  /** Fired when the camera focus should change. */
  onFocusChange?: (info: BeatFocusInfo) => void;
  /** Fired once when the scripted case is fully closed. */
  onClosed?: () => void;
}

export interface BeatFocusInfo {
  /** Stable id of the staff/client the camera should follow. */
  characterId: string;
  /** Activity-log narration for this beat. */
  narration: string;
  /** Pipeline stage label. */
  stage: string;
}

/**
 * Client request scenarios — each one matches a client persona from
 * `personaData.ts`, so the simulation, profile cards, and scenario picker
 * stay in sync.
 */
const CUSTOMER_SCENARIOS: Array<{
  id: ScenarioId;
  persona: string;
  palette: keyof typeof PALETTES;
  type: string;
  min: number;
  max: number;
}> = CUSTOMER_PERSONAS.map((p) => ({
  id: p.id,
  persona: p.name,
  palette: p.palette as keyof typeof PALETTES,
  type: p.request_type,
  min: p.amount_min,
  max: p.amount_max,
}));

/** Mint a case number in the canonical `REQ-YYYYMMDD-XXXXXX` format. */
function mintCaseId(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate(),
  ).padStart(2, "0")}`;
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `REQ-${ymd}-${suffix}`;
}

/** Format a dollar amount for the activity log (e.g. "$1,250,000"). */
function money(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

/** Logger contract used by the simulation. */
export interface SimLogger {
  setMetric(name: "submitted" | "processing" | "approved" | "rejected", value: number): void;
  log(message: string, kind?: "info" | "good" | "bad" | "warn"): void;
  setAgentStatus(id: string, busy: boolean, activity: string): void;
  registerAgent(info: { id: string; name: string; role: AgentRole; team: StaffTeam; color: string; palette: VoxelCharacterPalette }): void;
}

/** Move a transform along XZ toward `target` at a given speed (m/s). */
function moveToward(
  node: TransformNode,
  target: Vector3,
  speed: number,
  dtSec: number,
): boolean {
  const dx = target.x - node.position.x;
  const dz = target.z - node.position.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.05) {
    node.position.x = target.x;
    node.position.z = target.z;
    return true;
  }
  const step = Math.min(dist, speed * dtSec);
  const nx = dx / dist;
  const nz = dz / dist;
  node.position.x += nx * step;
  node.position.z += nz * step;
  // Face direction of travel
  node.rotation.y = Math.atan2(nx, nz);
  return false;
}

/* ------------------------------------------------------------------ */
/* Office navigation                                                   */
/*                                                                     */
/* Cubicles in `officeScene.ts` are walled boxes: side walls at        */
/* `cx ± 2.95` (z ∈ [cz-2.4, cz+2.6]), back partition at z = cz+2.6    */
/* (x ∈ [cx-3, cx+3]). The only opening is the south side at          */
/* z = cz - 2.4. Straight-line pathing from one cubicle to another     */
/* therefore cuts through partitions and the desks behind them. The   */
/* planner below produces a list of XZ waypoints that:                 */
/*   1. Exit the source cubicle through its south opening.             */
/*   2. Travel along the front aisle (z ≈ -3.6, south of front-row    */
/*      cubicles) and/or the central aisle (z ≈ 6.6, between front- and */
/*      back-row cubicles).                                            */
/*   3. Cross between rows only via the gaps between front-row         */
/*      cubicles. Front-row backs at z=2.6 are 6m wide and centred on  */
/*      cx ∈ {-24,-12,0,12}, leaving safe x-gaps centred at            */
/*      ROW_GAP_X = {-18, -6, 6} (between cubicles) and {-30, 18}     */
/*      (around the leftmost / rightmost cubicle ends).                */
/*   4. Enter the target cubicle through its south opening.            */
/* ------------------------------------------------------------------ */

interface CubicleZone {
  cx: number;
  cz: number;
}

/**
 * All seven department cubicles plus the Team Leader executive office
 * (which has a glass partition at z = cz - 2.4 — same opening side as a
 * regular cubicle, so it's modelled identically here).
 */
const CUBICLE_ZONES: CubicleZone[] = [
  { cx: -24, cz: 0 }, // Onboarding (Superannuation wing)
  { cx: -12, cz: 0 }, // Benefits (Superannuation wing)
  { cx: 0, cz: 0 }, // Transfers (Superannuation wing)
  { cx: 12, cz: 0 }, // Payments (Superannuation wing)
  { cx: -12, cz: 13 }, // Investments (Wealth Management wing)
  { cx: 0, cz: 13 }, // Comms (Wealth Management wing)
  { cx: 12, cz: 13 }, // Financial Crime (Wealth Management wing)
  { cx: -24, cz: 13 }, // Head of Client Operations (Team Leader)
];

/** Front aisle Z (south of front-row cubicles, north of lobby furniture). */
const FRONT_AISLE_Z = -3.6;
/** Central aisle Z (between front- and back-row cubicles). */
const CENTRAL_AISLE_Z = 6.6;
/** Z of the back row of pods (the front row is at z = 0). */
const BACK_ROW_Z = 13;
/** Just south of any cubicle's south opening (clear of side-wall ends). */
const CUBICLE_APPROACH_OFFSET = 2.6;

/**
 * X-coordinates of the gaps between front-row cubicles. Front-row back
 * partitions are 6m wide and centred at cx ∈ {-24,-12,0,12}, so a path
 * crossing z=2.6 must do so at one of these gap centres (or at the far
 * left/right ends) to avoid clipping a partition.
 */
const ROW_GAP_X = [-30, -18, -6, 6, 18];

/** Find the cubicle that contains point `p`, or null if it's in the open. */
function findCubicleAt(p: { x: number; z: number }): CubicleZone | null {
  for (const c of CUBICLE_ZONES) {
    if (
      Math.abs(p.x - c.cx) <= 3.0 &&
      p.z >= c.cz - 2.4 &&
      p.z <= c.cz + 2.6
    ) {
      return c;
    }
  }
  return null;
}

/** Aisle Z appropriate for reaching/leaving a cubicle of row `cz`. */
function aisleZForRow(cz: number): number {
  // Back row: use the central aisle just south of its opening.
  // Front row (cz=0): use the front aisle just south of its opening.
  return cz === BACK_ROW_Z ? CENTRAL_AISLE_Z : FRONT_AISLE_Z;
}

/** Pick the gap-X nearest the average of `xs` for crossing front-row backs. */
function nearestGapX(...xs: number[]): number {
  const avg = xs.reduce((a, b) => a + b, 0) / xs.length;
  let best = ROW_GAP_X[0];
  let bestD = Math.abs(avg - best);
  for (const g of ROW_GAP_X) {
    const d = Math.abs(avg - g);
    if (d < bestD) {
      best = g;
      bestD = d;
    }
  }
  return best;
}

/**
 * Plan a sequence of XZ waypoints from `from` to `to` that avoids the
 * cubicle partitions and desks. The returned list does NOT include
 * `from`, but always ends with a waypoint at `to`.
 */
function planOfficePath(
  from: { x: number; z: number },
  to: Vector3,
): Vector3[] {
  const srcCub = findCubicleAt(from);
  const tgtCub = findCubicleAt({ x: to.x, z: to.z });
  const wps: Vector3[] = [];
  const y = 0.2;
  const push = (x: number, z: number): void => {
    // Skip duplicates (consecutive waypoints with the same XZ).
    const last = wps.length > 0 ? wps[wps.length - 1] : null;
    if (last && Math.abs(last.x - x) < 0.05 && Math.abs(last.z - z) < 0.05) {
      return;
    }
    wps.push(new Vector3(x, y, z));
  };

  // Same cubicle (or both in the open) — go direct.
  if (
    srcCub &&
    tgtCub &&
    srcCub.cx === tgtCub.cx &&
    srcCub.cz === tgtCub.cz
  ) {
    push(to.x, to.z);
    return wps;
  }

  // 1. Exit source cubicle south of its opening.
  if (srcCub) {
    push(srcCub.cx, srcCub.cz - CUBICLE_APPROACH_OFFSET);
  }

  // 2. Decide which aisle(s) connect source and target sides.
  //    "side" is determined by the cubicle row, or by the point's z if
  //    the endpoint is in the open lobby.
  const srcAisleZ = srcCub
    ? aisleZForRow(srcCub.cz)
    : from.z >= 2.6
      ? CENTRAL_AISLE_Z
      : FRONT_AISLE_Z;
  const tgtAisleZ = tgtCub
    ? aisleZForRow(tgtCub.cz)
    : to.z >= 2.6
      ? CENTRAL_AISLE_Z
      : FRONT_AISLE_Z;

  if (srcAisleZ === tgtAisleZ) {
    // Same aisle: walk along it from the source x to the target x.
    if (srcCub) push(srcCub.cx, srcAisleZ);
    if (tgtCub) push(tgtCub.cx, tgtAisleZ);
  } else {
    // Crossing rows: use a front-row-cubicle gap to bridge the aisles.
    const srcX = srcCub ? srcCub.cx : from.x;
    const tgtX = tgtCub ? tgtCub.cx : to.x;
    const gapX = nearestGapX(srcX, tgtX);
    if (srcCub) push(srcCub.cx, srcAisleZ);
    push(gapX, srcAisleZ);
    push(gapX, tgtAisleZ);
    if (tgtCub) push(tgtCub.cx, tgtAisleZ);
  }

  // 3. Enter target cubicle south of its opening.
  if (tgtCub) {
    push(tgtCub.cx, tgtCub.cz - CUBICLE_APPROACH_OFFSET);
  }

  // 4. Final destination.
  push(to.x, to.z);
  return wps;
}

/** Which side of the Benefits & Eligibility assessment a consultation runs on. */
type ConsultPhase = "pre" | "post";

/** Tasks that processing staff agents can be assigned to. */
type Task =
  | { kind: "idle" }
  | { kind: "pickup"; memberCase: MemberCase }
  | { kind: "route"; memberCase: MemberCase }
  | { kind: "assess"; memberCase: MemberCase }
  | { kind: "carry-to-payments"; memberCase: MemberCase }
  | { kind: "pay"; memberCase: MemberCase }
  | { kind: "carry-to-comms"; memberCase: MemberCase }
  | { kind: "communicate"; memberCase: MemberCase }
  /** Specialist staff consult on a scripted case (Investments, Financial Crime, etc). */
  | {
      kind: "consult";
      memberCase: MemberCase;
      beat: ScriptExtraBeat;
      phase: ConsultPhase;
    };

interface StaffAgent {
  id: string;
  name: string;
  role: AgentRole;
  color: string;
  character: VoxelCharacter;
  homePoint: Vector3;
  task: Task;
  /** Time remaining (sec) for the current "processing" sub-state. */
  processTimer: number;
  /** Current intermediate target while moving. */
  moveTarget: Vector3 | null;
  /** Remaining waypoints after `moveTarget` (consumed in order). */
  moveQueue: Vector3[];
  /** Optional callback invoked once we reach moveTarget. */
  onArrive: (() => void) | null;
  /** True while the staff member is driven by the case pipeline. */
  active: boolean;
  /** Index into `persona.ambient` for the rotating idle status. */
  ambientIndex: number;
  /** Seconds until the idle status rotates to the next ambient line. */
  ambientTimer: number;
  /** Ring buffer of recent case numbers this staff member has touched. */
  caseHistory: string[];
  /** Persona record (typical line, personality, etc) for profile card. */
  persona: StaffPersona;
}

interface CustomerAgent {
  character: VoxelCharacter;
  memberCase: MemberCase;
  persona: string;
  /** Client persona id (if known) — used by profile card. */
  personaId?: ScenarioId;
  state: "entering" | "to-reception" | "leaving" | "done";
  moveTarget: Vector3;
}

/**
 * Top-level simulation: clients spawn, drop requests at reception, and the
 * Onboarding & Requests Officer routes them through Benefits & Eligibility
 * → Payments → Client Communications. The Investment Analyst, Financial
 * Crime Investigator, Transfers & Rollovers Coordinator and Team Leader are
 * visible at their desks with rotating status lines, and join scripted
 * cases as specialist consultations.
 */
export class CaseSimulation {
  private readonly scene: Scene;
  private readonly layout: OfficeLayout;
  private readonly logger: SimLogger;

  private readonly staff: StaffAgent[] = [];
  private readonly customers: CustomerAgent[] = [];

  /** Cases sitting in the reception inbox awaiting Onboarding pickup. */
  private readonly inbox: MemberCase[] = [];
  /** Cases on the Benefits & Eligibility desk awaiting assessment. */
  private readonly benefitsInbox: MemberCase[] = [];
  /** Cases back on the Benefits desk after specialist review, awaiting hand-off to Payments. */
  private readonly benefitsHandoffQueue: MemberCase[] = [];
  /** Cases that have been assessed, awaiting a Payments pickup. */
  private readonly paymentsQueue: MemberCase[] = [];
  /** Cases waiting for Client Communications (any outcome). */
  private readonly communicationsQueue: MemberCase[] = [];

  private spawnTimer = 1.5;
  private autoSpawnPaused = false;
  private paused = false;
  private metrics = { submitted: 0, processing: 0, approved: 0, rejected: 0 };

  /** Track every case that has touched the office, by case number. */
  private readonly casesById = new Map<string, MemberCase>();
  /** Client agents indexed by their character.id (e.g. "cust_REQ-…"). */
  private readonly customersByCharId = new Map<string, CustomerAgent>();

  /** Observable fired when a scripted case's focus character changes. */
  readonly onScriptFocusChange = new Observable<BeatFocusInfo>();

  /** The currently highlighted character (hover or click), or null. */
  private highlightedId: string | null = null;

  constructor(scene: Scene, layout: OfficeLayout, logger: SimLogger) {
    this.scene = scene;
    this.layout = layout;
    this.logger = logger;
    this.spawnStaff();
  }

  private spawnStaff(): void {
    /** Map StaffPersona to its desk position from the office layout. */
    const homeFor = (role: AgentRole): Vector3 => {
      switch (role) {
        case "Onboarding & Requests Officer":
          return this.layout.onboardingDeskPoint;
        case "Benefits & Eligibility Assessor":
          return this.layout.benefitsDeskPoint;
        case "Investment Analyst":
          return this.layout.investmentsDeskPoint;
        case "Financial Crime Investigator":
          return this.layout.finCrimeDeskPoint;
        case "Transfers & Rollovers Coordinator":
          return this.layout.transfersDeskPoint;
        case "Payments Officer":
          return this.layout.paymentsDeskPoint;
        case "Client Communications Specialist":
          return this.layout.communicationsDeskPoint;
        case "Client Operations Team Leader":
          return this.layout.teamLeaderDeskPoint;
      }
    };

    for (const persona of STAFF_PERSONAS) {
      const home = homeFor(persona.role);
      const palette = PALETTES[persona.palette];
      const ch = new VoxelCharacter(this.scene, persona.id, palette);
      ch.root.scaling.setAll(OFFICE_CHARACTER_SCALE);
      ch.root.position = home.clone();
      ch.root.position.y = 0.2;
      const agent: StaffAgent = {
        id: persona.id,
        name: persona.name,
        role: persona.role,
        color: persona.color,
        character: ch,
        homePoint: home.clone(),
        task: { kind: "idle" },
        processTimer: 0,
        moveTarget: null,
        moveQueue: [],
        onArrive: null,
        active: persona.active_in_pipeline,
        ambientIndex: 0,
        ambientTimer: 3 + Math.random() * 4,
        caseHistory: [],
        persona,
      };
      this.staff.push(agent);
      this.logger.registerAgent({
        id: persona.id,
        name: persona.name,
        role: persona.role,
        team: persona.team,
        color: persona.color,
        palette,
      });
      this.setIdleStatus(agent);
    }
  }

  /** Show the staff member's resting status (first ambient line) and restart rotation. */
  private setIdleStatus(s: StaffAgent): void {
    s.ambientIndex = 0;
    s.ambientTimer = 4 + Math.random() * 4;
    this.logger.setAgentStatus(s.id, false, s.persona.ambient[0] ?? "Awaiting next request");
  }

  /** Spawn a new client with a fresh case folder. */
  spawnCustomer(scenarioId?: ScenarioId, script?: CaseScript): CustomerAgent {
    const scenario = scenarioId
      ? CUSTOMER_SCENARIOS.find((s) => s.id === scenarioId) ??
        CUSTOMER_SCENARIOS[0]
      : CUSTOMER_SCENARIOS[Math.floor(Math.random() * CUSTOMER_SCENARIOS.length)];
    // Unscripted clients get a random amount (to the nearest $100) within
    // their persona's range; scripted cases use the canonical amount.
    const amount =
      script?.amount ??
      Math.round((scenario.min + Math.random() * (scenario.max - scenario.min)) / 100) * 100;
    const caseId = script?.caseId ?? mintCaseId();
    const memberCase: MemberCase = {
      id: caseId,
      type: scenario.type,
      amount,
      paidAmount: 0,
      status: "received",
      mesh: this.makeCaseFolder(caseId),
      currentHolderId: null,
      script,
    };
    this.casesById.set(caseId, memberCase);

    const palette = PALETTES[scenario.palette];
    const ch = new VoxelCharacter(this.scene, `cust_${caseId}`, palette);
    ch.root.scaling.setAll(OFFICE_CHARACTER_SCALE);
    ch.root.position = this.layout.spawnPoint.clone();
    ch.root.position.y = 0.2;
    // Slight lateral jitter so they don't overlap (only for unscripted spawns)
    if (!script) {
      ch.root.position.x += (Math.random() - 0.5) * 1.5;
    }

    // Client carries the folder until they reach reception.
    memberCase.mesh.parent = ch.getHandAnchor();
    memberCase.mesh.position = Vector3.Zero();
    memberCase.mesh.rotation = Vector3.Zero();
    memberCase.currentHolderId = ch.id;

    const customer: CustomerAgent = {
      character: ch,
      memberCase,
      persona: scenario.persona,
      personaId: scenario.id,
      state: "entering",
      moveTarget: this.layout.entrancePoint.clone(),
    };
    ch.setWalking(true);
    // Scripted clients continue the same urgent run they used to cross
    // the neighbourhood — they sprint through the door and across the
    // lobby to reception, then drop back to a normal walk on the way out.
    if (script) {
      ch.setRunning(true);
    }
    this.customers.push(customer);
    this.customersByCharId.set(ch.id, customer);

    this.metrics.submitted++;
    this.metrics.processing++;
    this.pushMetrics();
    this.logger.log(
      `Request ${memberCase.id} received — ${memberCase.type}, ${money(amount)} (${scenario.persona})`,
      script ? "warn" : "info",
    );
    if (script) {
      this.fireFocusChange(
        memberCase,
        ch.id,
        "enter-office",
        this.beatText(memberCase, "enter-office", `${scenario.persona} arrived at the office`),
      );
    }
    return customer;
  }

  private makeCaseFolder(id: string): Mesh {
    const folder = MeshBuilder.CreateBox(
      `folder_${id}`,
      { width: 0.32, height: 0.06, depth: 0.42 },
      this.scene,
    );
    const mat = new StandardMaterial(`folderMat_${id}`, this.scene);
    // Random-ish folder color (manila / red / blue / green)
    const palette = ["#e8c069", "#d4584b", "#5a8fcf", "#7a9c5a"];
    mat.diffuseColor = Color3.FromHexString(
      palette[Math.floor(Math.random() * palette.length)],
    );
    mat.specularColor = new Color3(0.05, 0.05, 0.05);
    folder.material = mat;
    return folder;
  }

  /** Per-frame tick. */
  update(dtSec: number): void {
    if (this.paused) return;
    // Auto-spawn clients periodically (paused during scripted scenarios).
    if (!this.autoSpawnPaused) {
      this.spawnTimer -= dtSec;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = 6 + Math.random() * 6;
        this.spawnCustomer();
      }
    }

    this.updateCustomers(dtSec);
    this.updateStaff(dtSec);
    this.updateAmbient(dtSec);
  }

  private updateCustomers(dtSec: number): void {
    const customerWalkSpeed = 2.2;
    const customerRunSpeed = 4.4;
    for (const c of this.customers) {
      if (c.state === "done") continue;
      c.character.update(dtSec);
      // Scripted clients sprint into the building and across the lobby;
      // ambient clients stroll at normal pace.
      const running = !!c.memberCase.script && (c.state === "entering" || c.state === "to-reception");
      const speed = running ? customerRunSpeed : customerWalkSpeed;
      const arrived = moveToward(
        c.character.root,
        c.moveTarget,
        speed,
        dtSec,
      );
      if (!arrived) continue;

      switch (c.state) {
        case "entering":
          c.state = "to-reception";
          c.moveTarget = this.layout.receptionPoint.clone();
          break;
        case "to-reception": {
          // Drop folder on the inbox tray.
          c.character.setWalking(false);
          const folder = c.memberCase.mesh;
          folder.parent = null;
          folder.position = this.layout.inboxPoint.clone();
          // Stack folders slightly so they don't overlap.
          folder.position.y += this.inbox.length * 0.07;
          this.inbox.push(c.memberCase);
          c.memberCase.currentHolderId = null;
          const lodged = this.beatText(
            c.memberCase,
            "lodge-at-reception",
            `Request ${c.memberCase.id} lodged at reception by ${c.persona}`,
          );
          this.logger.log(lodged, c.memberCase.script ? "warn" : "info");
          if (c.memberCase.script) {
            const onboarding = this.staff.find(
              (x) => x.role === "Onboarding & Requests Officer",
            );
            if (onboarding) {
              this.fireFocusChange(c.memberCase, onboarding.id, "lodge-at-reception", lodged);
            }
          }
          c.state = "leaving";
          c.moveTarget = this.layout.exitPoint.clone();
          c.character.setRunning(false);
          c.character.setWalking(true);
          break;
        }
        case "leaving":
          c.state = "done";
          c.character.setWalking(false);
          this.customersByCharId.delete(c.character.id);
          c.character.root.dispose();
          break;
      }
    }
    // Compact the client array occasionally
    if (this.customers.length > 0 && this.customers[0].state === "done") {
      for (let i = this.customers.length - 1; i >= 0; i--) {
        if (this.customers[i].state === "done") this.customers.splice(i, 1);
      }
    }
  }

  private updateStaff(dtSec: number): void {
    const speed = 2.6;
    for (const s of this.staff) {
      if (!s.active) continue;
      s.character.update(dtSec);

      // Try to assign tasks to idle staff.
      if (s.task.kind === "idle") {
        this.tryAssignTask(s);
      }

      if (s.moveTarget) {
        s.character.setWalking(true);
        const arrived = moveToward(s.character.root, s.moveTarget, speed, dtSec);
        if (arrived) {
          if (s.moveQueue.length > 0) {
            // Advance to the next waypoint without firing onArrive.
            s.moveTarget = s.moveQueue.shift()!;
          } else {
            s.moveTarget = null;
            s.character.setWalking(false);
            const cb = s.onArrive;
            s.onArrive = null;
            if (cb) cb();
          }
        }
      } else if (s.processTimer > 0) {
        s.processTimer -= dtSec;
        if (s.processTimer <= 0) {
          this.completeProcessingStep(s);
        }
      }
    }
  }

  /**
   * Rotate idle staff through their ambient status lines. Specialists who
   * are not on a case are animated here (pipeline staff are animated by
   * `updateStaff`); pipeline staff only rotate while idle at their desk
   * and no scripted scenario is running.
   */
  private updateAmbient(dtSec: number): void {
    for (const s of this.staff) {
      if (!s.active) s.character.update(dtSec);
      const lines = s.persona.ambient;
      if (lines.length < 2) continue;
      const idleAtDesk = s.active
        ? s.task.kind === "idle" &&
          !s.moveTarget &&
          s.processTimer <= 0 &&
          !this.autoSpawnPaused
        : true;
      if (!idleAtDesk) continue;
      s.ambientTimer -= dtSec;
      if (s.ambientTimer <= 0) {
        s.ambientIndex = (s.ambientIndex + 1) % lines.length;
        s.ambientTimer = 4 + Math.random() * 4;
        this.logger.setAgentStatus(s.id, false, lines[s.ambientIndex]);
      }
    }
  }

  private tryAssignTask(s: StaffAgent): void {
    if (s.role === "Onboarding & Requests Officer" && this.inbox.length > 0) {
      const memberCase = this.inbox.shift()!;
      s.task = { kind: "pickup", memberCase };
      this.recordCase(s, memberCase);
      this.logger.setAgentStatus(s.id, true, `Picking up ${memberCase.id}`);
      if (memberCase.script) {
        this.fireFocusChange(
          memberCase,
          s.id,
          "onboarding-pickup",
          this.beatText(memberCase, "onboarding-pickup", `${s.name} picks up request ${memberCase.id}`),
        );
      }
      this.gotoAndThen(s, this.layout.inboxPoint, () => {
        // Take folder
        memberCase.mesh.parent = s.character.getHandAnchor();
        memberCase.mesh.position = Vector3.Zero();
        memberCase.mesh.rotation = Vector3.Zero();
        memberCase.currentHolderId = s.id;
        // Walk to the Benefits & Eligibility desk and drop the folder there.
        memberCase.status = "onboarding";
        this.logger.log(
          `Onboarding & Requests routed ${memberCase.id} to Benefits & Eligibility`,
          memberCase.script ? "warn" : "info",
        );
        s.task = { kind: "route", memberCase };
        this.logger.setAgentStatus(s.id, true, `Routing ${memberCase.id}`);
        if (memberCase.script) {
          this.fireFocusChange(
            memberCase,
            s.id,
            "onboarding-route",
            this.beatText(
              memberCase,
              "onboarding-route",
              `${s.name} routes ${memberCase.id} to Benefits & Eligibility`,
            ),
          );
        }
        const dropPoint = this.layout.benefitsDeskPoint.clone();
        dropPoint.z -= 1.4; // approach side of desk
        this.gotoAndThen(s, dropPoint, () => {
          this.placeOnDesk(memberCase, this.layout.benefitsDeskPoint);
          memberCase.status = "assessing";
          // Run any pre-assessment consultations (e.g. Financial Crime KYC,
          // Team Leader oversight) before Benefits & Eligibility picks it up.
          if (memberCase.script && memberCase.script.preBenefits.length > 0) {
            const beat = memberCase.script.preBenefits.shift()!;
            this.startConsultation(memberCase, beat, "pre");
          } else {
            this.benefitsInbox.push(memberCase);
          }
          // Onboarding officer returns home.
          s.task = { kind: "idle" };
          this.logger.setAgentStatus(s.id, false, "Returning to desk");
          this.gotoAndThen(s, s.homePoint, () => this.setIdleStatus(s));
        });
      });
      return;
    }

    if (s.role === "Benefits & Eligibility Assessor") {
      // Specialist reviews are finished — carry the case to Payments.
      if (this.benefitsHandoffQueue.length > 0) {
        const memberCase = this.benefitsHandoffQueue.shift()!;
        this.carryToPayments(s, memberCase, true);
        return;
      }
      // Otherwise pick up the next case routed to the Benefits desk.
      const memberCase = this.benefitsInbox.shift();
      if (!memberCase) return;
      s.task = { kind: "assess", memberCase };
      this.recordCase(s, memberCase);
      this.logger.setAgentStatus(s.id, true, `Assessing ${memberCase.id}`);
      this.logger.log(
        memberCase.script?.narrations.benefits ??
          `Benefits & Eligibility assessing ${memberCase.id} (${memberCase.type})`,
        memberCase.script ? "warn" : "info",
      );
      if (memberCase.script) {
        this.fireFocusChange(
          memberCase,
          s.id,
          "benefits-pickup",
          this.beatText(memberCase, "benefits-pickup", `${s.name} begins assessing ${memberCase.id}`),
        );
      }
      // Pick up folder from desk
      const pickupPoint = this.layout.benefitsDeskPoint.clone();
      pickupPoint.z -= 1.0;
      this.gotoAndThen(s, pickupPoint, () => {
        memberCase.mesh.parent = s.character.getHandAnchor();
        memberCase.mesh.position = Vector3.Zero();
        memberCase.currentHolderId = s.id;
        // Sit at desk for a "processing" beat
        this.gotoAndThen(s, s.homePoint, () => {
          s.processTimer = memberCase.script ? 2.5 : 2.5 + Math.random() * 2.0;
        });
      });
      return;
    }

    if (s.role === "Payments Officer" && this.paymentsQueue.length > 0) {
      const memberCase = this.paymentsQueue.shift()!;
      s.task = { kind: "pay", memberCase };
      this.recordCase(s, memberCase);
      this.logger.setAgentStatus(s.id, true, `Reviewing ${memberCase.id}`);
      this.logger.log(
        memberCase.script?.narrations.payment ??
          `Payments reviewing ${memberCase.id} — ${money(memberCase.amount)}`,
        memberCase.script ? "warn" : "info",
      );
      if (memberCase.script) {
        this.fireFocusChange(
          memberCase,
          s.id,
          "payment",
          this.beatText(memberCase, "payment", `${s.name} reviews ${memberCase.id} for payment`),
        );
      }
      const pickup = this.layout.paymentsDeskPoint.clone();
      pickup.z -= 1.0;
      this.gotoAndThen(s, pickup, () => {
        memberCase.mesh.parent = s.character.getHandAnchor();
        memberCase.mesh.position = Vector3.Zero();
        memberCase.currentHolderId = s.id;
        this.gotoAndThen(s, s.homePoint, () => {
          s.processTimer = memberCase.script ? 2.5 : 2.5 + Math.random() * 2.0;
        });
      });
      return;
    }

    if (
      s.role === "Client Communications Specialist" &&
      this.communicationsQueue.length > 0
    ) {
      const memberCase = this.communicationsQueue.shift()!;
      s.task = { kind: "communicate", memberCase };
      this.recordCase(s, memberCase);
      this.logger.setAgentStatus(s.id, true, `Contacting client — ${memberCase.id}`);
      if (memberCase.script) {
        this.fireFocusChange(
          memberCase,
          s.id,
          "comms-notify",
          this.beatText(memberCase, "comms-notify", `${s.name} contacts the client about ${memberCase.id}`),
        );
      }
      // Pick from the Payments desk.
      const pickup = this.layout.paymentsDeskPoint.clone();
      pickup.z -= 1.0;
      this.gotoAndThen(s, pickup, () => {
        memberCase.mesh.parent = s.character.getHandAnchor();
        memberCase.mesh.position = Vector3.Zero();
        memberCase.currentHolderId = s.id;
        // Walk to the comms desk and file the folder in the archive (closed case).
        this.gotoAndThen(s, this.layout.communicationsDeskPoint, () => {
          const slot = this.layout.archivePoint.clone();
          slot.x += (Math.random() - 0.5) * 1.5;
          slot.z += (Math.random() - 0.5) * 0.8;
          slot.y += Math.random() * 0.4;
          memberCase.mesh.parent = null;
          memberCase.mesh.position = slot;
          memberCase.mesh.rotation = new Vector3(0, Math.random() * Math.PI, 0);
          memberCase.currentHolderId = null;
          memberCase.status = "closed";
          this.logger.log(
            memberCase.script?.narrations.comms ??
              `Client notified — case ${memberCase.id} closed`,
            "good",
          );
          s.task = { kind: "idle" };
          this.metrics.processing = Math.max(0, this.metrics.processing - 1);
          this.pushMetrics();
          this.gotoAndThen(s, s.homePoint, () => this.setIdleStatus(s));
          // Notify scenario runner that the scripted case is fully closed.
          if (memberCase.script) {
            const onClosed = memberCase.script.onClosed;
            // Defer slightly so the comms beat reads naturally.
            setTimeout(() => onClosed?.(), 600);
          }
        });
      });
      return;
    }
  }

  /** Put a folder down on top of a desk (slightly toward the back edge). */
  private placeOnDesk(memberCase: MemberCase, desk: Vector3): void {
    const drop = desk.clone();
    drop.y = 1.0;
    drop.z += 0.4;
    memberCase.mesh.parent = null;
    memberCase.mesh.position = drop;
    memberCase.mesh.rotation = Vector3.Zero();
    memberCase.currentHolderId = null;
  }

  /**
   * Benefits & Eligibility carries a case to the Payments desk. When
   * `fromDesk` is true the folder is first collected from the Benefits desk
   * (after specialist consultations); otherwise it's already in hand.
   */
  private carryToPayments(s: StaffAgent, memberCase: MemberCase, fromDesk: boolean): void {
    s.task = { kind: "carry-to-payments", memberCase };
    this.recordCase(s, memberCase);
    this.logger.setAgentStatus(s.id, true, `Hand-off ${memberCase.id}`);
    if (memberCase.script && fromDesk) {
      this.fireFocusChange(
        memberCase,
        s.id,
        "benefits-handoff",
        this.beatText(memberCase, "benefits-handoff", `${s.name} hands ${memberCase.id} to Payments`),
      );
    }
    const deliver = (): void => {
      const dropPos = this.layout.paymentsDeskPoint.clone();
      dropPos.z -= 1.4;
      this.gotoAndThen(s, dropPos, () => {
        this.placeOnDesk(memberCase, this.layout.paymentsDeskPoint);
        this.paymentsQueue.push(memberCase);
        s.task = { kind: "idle" };
        this.logger.setAgentStatus(s.id, false, "Returning to desk");
        this.gotoAndThen(s, s.homePoint, () => this.setIdleStatus(s));
      });
    };
    if (!fromDesk) {
      deliver();
      return;
    }
    const pickup = this.layout.benefitsDeskPoint.clone();
    pickup.z -= 1.0;
    this.gotoAndThen(s, pickup, () => {
      memberCase.mesh.parent = s.character.getHandAnchor();
      memberCase.mesh.position = Vector3.Zero();
      memberCase.currentHolderId = s.id;
      deliver();
    });
  }

  private completeProcessingStep(s: StaffAgent): void {
    const t = s.task;
    if (t.kind === "assess") {
      const memberCase = t.memberCase;
      // Scripted cases use a deterministic result; otherwise 85% pass.
      const valid = memberCase.script
        ? memberCase.script.approveAtBenefits
        : Math.random() < 0.85;
      if (valid) {
        memberCase.status = "assessed";
        this.logger.log(
          memberCase.script?.narrations.benefitsResult ??
            `Benefits & Eligibility cleared ${memberCase.id} — forwarding to Payments`,
          memberCase.script ? "warn" : "good",
        );
        if (memberCase.script) {
          this.fireFocusChange(
            memberCase,
            s.id,
            "benefits-process",
            this.beatText(memberCase, "benefits-process", `${s.name} cleared ${memberCase.id}`),
          );
        }
        // Scripted case with specialist reviews — run them before Payments.
        if (memberCase.script && memberCase.script.postBenefits.length > 0) {
          // Leave the folder on the Benefits desk so the specialist can collect it.
          this.placeOnDesk(memberCase, this.layout.benefitsDeskPoint);
          s.task = { kind: "idle" };
          this.logger.setAgentStatus(s.id, false, "Awaiting specialist review");
          this.gotoAndThen(s, s.homePoint, () => {
            this.logger.setAgentStatus(s.id, false, "Awaiting specialist review");
          });
          const beat = memberCase.script.postBenefits.shift()!;
          this.startConsultation(memberCase, beat, "post");
          return;
        }
        this.carryToPayments(s, memberCase, false);
      } else {
        // Declined at assessment — send straight to Client Communications.
        memberCase.status = "declined";
        memberCase.outcome = "rejected";
        this.metrics.rejected++;
        this.pushMetrics();
        this.logger.log(
          `Benefits & Eligibility declined ${memberCase.id} — not in good order (missing documents)`,
          "bad",
        );
        s.task = { kind: "carry-to-comms", memberCase };
        this.logger.setAgentStatus(s.id, true, `Hand-off ${memberCase.id}`);
        const drop = this.layout.paymentsDeskPoint.clone();
        drop.z -= 1.4;
        this.gotoAndThen(s, drop, () => {
          this.placeOnDesk(memberCase, this.layout.paymentsDeskPoint);
          this.communicationsQueue.push(memberCase);
          s.task = { kind: "idle" };
          this.logger.setAgentStatus(s.id, false, "Returning to desk");
          this.gotoAndThen(s, s.homePoint, () => this.setIdleStatus(s));
        });
      }
    } else if (t.kind === "pay") {
      const memberCase = t.memberCase;
      const script = memberCase.script;
      let outcome: ScriptOutcome;
      if (script) {
        outcome = script.outcome;
      } else {
        // Larger payments attract more scrutiny in the ambient simulation.
        const approveProb =
          memberCase.amount < 50000 ? 0.9 : memberCase.amount < 250000 ? 0.8 : 0.7;
        outcome = Math.random() < approveProb ? "approved" : "rejected";
      }
      memberCase.outcome = outcome;
      if (outcome === "approved" || outcome === "partial") {
        memberCase.paidAmount = script ? script.paidAmount : memberCase.amount;
        memberCase.status =
          script?.decisionStatus ??
          (outcome === "partial" ? "partially approved" : "completed");
        this.metrics.approved++;
        this.logger.log(
          script?.narrations.paymentResult ??
            (outcome === "partial"
              ? `Partial payment released — ${memberCase.id}, ${money(memberCase.paidAmount)} of ${money(memberCase.amount)}`
              : `Payment released — ${memberCase.id}, ${money(memberCase.paidAmount)}`),
          "good",
        );
      } else {
        memberCase.paidAmount = 0;
        memberCase.status = script?.decisionStatus ?? "declined";
        this.metrics.rejected++;
        this.logger.log(
          script?.narrations.paymentResult ??
            `Request declined — ${memberCase.id} (referred to the Team Leader for review)`,
          "bad",
        );
      }
      this.pushMetrics();
      // Drop on desk for Client Communications pickup
      this.placeOnDesk(memberCase, this.layout.paymentsDeskPoint);
      this.communicationsQueue.push(memberCase);
      s.task = { kind: "idle" };
      this.setIdleStatus(s);
    } else if (t.kind === "consult") {
      // A specialist finished a scripted consultation: drop the folder back
      // on the Benefits desk and run the next consultation in the same
      // phase (if any), otherwise continue the core pipeline.
      const { memberCase, phase } = t;
      this.placeOnDesk(memberCase, this.layout.benefitsDeskPoint);
      s.task = { kind: "idle" };
      this.setIdleStatus(s);
      // Send the specialist home, then return them to ambient (non-pipeline) state.
      this.gotoAndThen(s, s.homePoint, () => {
        s.active = s.persona.active_in_pipeline;
        this.setIdleStatus(s);
      });
      this.advanceAfterConsultation(memberCase, phase);
    }
  }

  /**
   * Continue a scripted case once a consultation (or a skipped one) is
   * done: run the next consultation in the same phase, or move the case
   * on to Benefits & Eligibility ("pre") / the hand-off to Payments ("post").
   */
  private advanceAfterConsultation(memberCase: MemberCase, phase: ConsultPhase): void {
    const queue =
      phase === "pre" ? memberCase.script?.preBenefits : memberCase.script?.postBenefits;
    if (queue && queue.length > 0) {
      const beat = queue.shift()!;
      this.startConsultation(memberCase, beat, phase);
    } else if (phase === "pre") {
      this.benefitsInbox.push(memberCase);
    } else {
      this.benefitsHandoffQueue.push(memberCase);
    }
  }

  /**
   * Start a scripted consultation: a specialist walks to the Benefits desk,
   * picks up the folder, walks back to their own desk, dwells for
   * `beat.duration` seconds, then walks back and drops the folder on the
   * Benefits desk so the next step can run.
   */
  private startConsultation(memberCase: MemberCase, beat: ScriptExtraBeat, phase: ConsultPhase): void {
    const consultant = this.staff.find((x) => x.role === beat.role);
    if (!consultant) {
      // Unknown role in the scenario data — skip it rather than stall the case.
      this.advanceAfterConsultation(memberCase, phase);
      return;
    }
    // Temporarily activate this specialist so the staff updater drives it.
    consultant.active = true;
    consultant.task = { kind: "consult", memberCase, beat, phase };
    this.recordCase(consultant, memberCase);
    this.logger.setAgentStatus(consultant.id, true, `Reviewing ${memberCase.id}`);
    this.logger.log(beat.narration, memberCase.script ? "warn" : "info");
    if (memberCase.script) {
      this.fireFocusChange(
        memberCase,
        consultant.id,
        `consult:${beat.role}`,
        beat.narration,
      );
    }
    // Walk to the Benefits desk to pick up the folder
    const pickup = this.layout.benefitsDeskPoint.clone();
    pickup.z -= 1.0;
    this.gotoAndThen(consultant, pickup, () => {
      memberCase.mesh.parent = consultant.character.getHandAnchor();
      memberCase.mesh.position = Vector3.Zero();
      memberCase.currentHolderId = consultant.id;
      // Walk back to the specialist's own desk
      this.gotoAndThen(consultant, consultant.homePoint, () => {
        consultant.processTimer = beat.duration;
      });
    });
  }

  private gotoAndThen(
    s: StaffAgent,
    target: Vector3,
    onArrive: () => void,
  ): void {
    // Plan a multi-waypoint path that avoids cubicle partitions/desks.
    const path = planOfficePath(
      { x: s.character.root.position.x, z: s.character.root.position.z },
      target,
    );
    // `planOfficePath` always returns at least one waypoint (the final
    // destination). The first becomes the immediate moveTarget; the rest
    // queue up so the staff agent walks the route segment-by-segment.
    s.moveTarget = path[0].clone();
    s.moveTarget.y = 0.2;
    s.moveQueue = path.slice(1).map((p) => {
      const v = p.clone();
      v.y = 0.2;
      return v;
    });
    s.onArrive = onArrive;
  }

  private pushMetrics(): void {
    this.logger.setMetric("submitted", this.metrics.submitted);
    this.logger.setMetric("processing", this.metrics.processing);
    this.logger.setMetric("approved", this.metrics.approved);
    this.logger.setMetric("rejected", this.metrics.rejected);
  }

  /* ---------------------------------------------------------------- */
  /* Helpers used internally for scripted scenarios + profile cards    */
  /* ---------------------------------------------------------------- */

  private recordCase(s: StaffAgent, memberCase: MemberCase): void {
    if (s.caseHistory[0] === memberCase.id) return;
    s.caseHistory.unshift(memberCase.id);
    if (s.caseHistory.length > 8) s.caseHistory.length = 8;
  }

  /** Scenario beat narration for scripted cases, or the generic fallback. */
  private beatText(memberCase: MemberCase, action: BeatAction, fallback: string): string {
    if (!memberCase.script) return fallback;
    return getBeatNarration(memberCase.script.scenarioId, action) ?? fallback;
  }

  private fireFocusChange(
    memberCase: MemberCase,
    characterId: string,
    stage: string,
    narration: string,
  ): void {
    const info: BeatFocusInfo = { characterId, stage, narration };
    this.onScriptFocusChange.notifyObservers(info);
    memberCase.script?.onFocusChange?.(info);
  }

  /* ---------------------------------------------------------------- */
  /* Public API used by main.ts / scenarioRunner / profileCard         */
  /* ---------------------------------------------------------------- */

  /** Look up a case by its case number. */
  getCase(id: string): {
    id: string;
    type: string;
    amount: number;
    paidAmount: number;
    status: CaseStatus;
    outcome?: ScriptOutcome;
  } | null {
    const c = this.casesById.get(id);
    if (!c) return null;
    return {
      id: c.id,
      type: c.type,
      amount: c.amount,
      paidAmount: c.paidAmount,
      status: c.status,
      outcome: c.outcome,
    };
  }

  /** True if auto-spawning of random clients is currently paused. */
  isAutoSpawnPaused(): boolean {
    return this.autoSpawnPaused;
  }
  pauseAutoSpawn(): void {
    this.autoSpawnPaused = true;
  }
  resumeAutoSpawn(): void {
    this.autoSpawnPaused = false;
    this.spawnTimer = 8 + Math.random() * 4;
  }

  /**
   * Pause / resume the entire simulation tick (used by the step gate to
   * freeze movement and processing while the user reads the popup).
   */
  setPaused(p: boolean): void {
    this.paused = p;
  }
  isPaused(): boolean {
    return this.paused;
  }

  /** Look up a staff member by their stable id. */
  getStaff(id: string): {
    id: string;
    name: string;
    role: AgentRole;
    color: string;
    character: VoxelCharacter;
    homePoint: Vector3;
  } | undefined {
    const s = this.staff.find((x) => x.id === id);
    if (!s) return undefined;
    return {
      id: s.id,
      name: s.name,
      role: s.role,
      color: s.color,
      character: s.character,
      homePoint: s.homePoint.clone(),
    };
  }

  /** Look up a staff member by role. */
  getStaffByRole(role: AgentRole): ReturnType<CaseSimulation["getStaff"]> {
    const s = this.staff.find((x) => x.role === role);
    if (!s) return undefined;
    return this.getStaff(s.id);
  }

  /** Returns the VoxelCharacter for a given id (staff or client). */
  getCharacterById(id: string): VoxelCharacter | null {
    const s = this.staff.find((x) => x.id === id);
    if (s) return s.character;
    const c = this.customersByCharId.get(id);
    if (c) return c.character;
    return null;
  }

  /** Highlight a single character (typically the camera-focus target). */
  setHighlightedCharacter(id: string | null): void {
    if (this.highlightedId === id) return;
    if (this.highlightedId) {
      const prev = this.getCharacterById(this.highlightedId);
      prev?.setHighlight(false);
    }
    this.highlightedId = id;
    if (id) {
      const ch = this.getCharacterById(id);
      ch?.setHighlight(true);
    }
  }

  /** Returns the id of the currently scripted-highlighted character, or null. */
  getHighlightedCharacter(): string | null {
    return this.highlightedId;
  }

  /** Returns the office layout reference points (for scenarioRunner). */
  getLayout(): OfficeLayout {
    return this.layout;
  }

  /** Make a profile-card view-model for the clicked character. */
  getCharacterProfile(id: string): CharacterProfile | null {
    const staff = this.staff.find((x) => x.id === id);
    if (staff) {
      const heldCase = this.findCaseHeldBy(id);
      const cases = staff.caseHistory
        .map((cid) => this.casesById.get(cid))
        .filter((c): c is MemberCase => !!c)
        .map((c) => ({
          id: c.id,
          type: c.type,
          status: c.status,
        }));
      return {
        kind: "staff",
        id: staff.id,
        name: staff.name,
        role: staff.role,
        team: staff.persona.team,
        color: staff.color,
        palette: PALETTES[staff.persona.palette],
        personality: staff.persona.personality,
        typicalLine: staff.persona.typical_line,
        responsibilities: staff.persona.responsibilities,
        situation: staff.persona.role_short,
        current: heldCase
          ? `Holding ${heldCase.id} — ${heldCase.type}`
          : describeTask(staff.task),
        cases,
        scenarioName: "",
        currentHandler: null,
        activeCase: null,
        agentUrl: `${APP_BASE_URL}/agents/${encodeURIComponent(
          staff.persona.app_agent_id,
        )}`,
        agent: {
          name: staff.persona.agent_name,
          tagline: staff.persona.agent_tagline,
          subAgents:
            Object.values(STAGE_CONFIG).find((s) => s.role === staff.role)?.agents ?? [],
        },
      };
    }

    const customer = this.customersByCharId.get(id);
    if (customer) {
      const persona = customer.personaId
        ? findCustomerPersona(customer.personaId)
        : undefined;
      const handler = customer.memberCase.currentHolderId
        ? this.staff.find((x) => x.id === customer.memberCase.currentHolderId)
        : undefined;
      return {
        kind: "customer",
        id: customer.character.id,
        name: customer.persona,
        role: persona?.request_type ?? customer.memberCase.type,
        color: persona?.color ?? "#6e7a8a",
        palette: PALETTES[(persona?.palette ?? "customerOnboarding") as keyof typeof PALETTES],
        personality: persona?.personality ?? "",
        typicalLine: persona?.typical_line ?? "",
        responsibilities: persona?.need ?? [],
        situation: persona?.situation_long ?? "",
        current: describeCustomerState(customer),
        cases: [
          {
            id: customer.memberCase.id,
            type: customer.memberCase.type,
            status: customer.memberCase.status,
          },
        ],
        scenarioName: persona?.request_type ?? "Client",
        currentHandler: handler ? `${handler.name} — ${handler.role}` : null,
        activeCase: {
          id: customer.memberCase.id,
          type: customer.memberCase.type,
          amount: customer.memberCase.amount,
          status: customer.memberCase.status,
        },
        agentUrl: null,
        agent: null,
      };
    }

    return null;
  }

  private findCaseHeldBy(id: string): MemberCase | undefined {
    for (const c of this.casesById.values()) {
      if (c.currentHolderId === id) return c;
    }
    return undefined;
  }

  /**
   * Snap the office back to a clean baseline before a scripted scenario
   * begins, per the JSON `reset` block. Despawns unscripted clients,
   * clears case queues / orphan folders, and returns every staff member
   * to their desk so the camera and the audience start from a known state.
   */
  resetForScenario(scenarioId: ScenarioId): void {
    const def = getScenario(scenarioId);
    const reset = def.reset.office;

    if (reset.removeUnscriptedCustomers) {
      // Despawn any non-scripted client that's currently in flight.
      for (const c of this.customers) {
        if (c.memberCase.script) continue;
        if (c.state === "done") continue;
        // Detach folder from client; we'll dispose it via removeCase.
        if (c.memberCase.mesh.parent === c.character.getHandAnchor()) {
          c.memberCase.mesh.parent = null;
        }
        this.customersByCharId.delete(c.character.id);
        c.character.root.dispose();
        c.state = "done";
        this.removeCase(c.memberCase);
      }
      // Compact the client array.
      for (let i = this.customers.length - 1; i >= 0; i--) {
        if (this.customers[i].state === "done") this.customers.splice(i, 1);
      }
    }

    if (reset.clearQueues) {
      // Drop any folders sitting in the inbox / benefits / payments / comms queues.
      for (const q of [
        this.inbox,
        this.benefitsInbox,
        this.benefitsHandoffQueue,
        this.paymentsQueue,
        this.communicationsQueue,
      ]) {
        while (q.length > 0) {
          const memberCase = q.shift()!;
          if (!memberCase.script) this.removeCase(memberCase);
        }
      }
    }

    if (reset.snapStaffToDesks) {
      // Force every staff member back to their home desk and a clean state.
      for (const s of this.staff) {
        // If a staff member is carrying a folder for an unscripted case, drop it.
        const held = this.findCaseHeldBy(s.id);
        if (held && !held.script) {
          held.mesh.parent = null;
          this.removeCase(held);
        }
        s.task = { kind: "idle" };
        s.moveTarget = null;
        s.moveQueue = [];
        s.onArrive = null;
        s.processTimer = 0;
        s.character.setWalking(false);
        s.character.hideThoughtBulbs();
        s.character.root.position.x = s.homePoint.x;
        s.character.root.position.y = 0.2;
        s.character.root.position.z = s.homePoint.z;
        s.character.root.rotation.y = 0;
        // Specialists return to their rotating status lines; pipeline staff
        // go back to "Awaiting next request".
        s.active = s.persona.active_in_pipeline;
        this.setIdleStatus(s);
      }
    }
  }

  /** Dispose a case's folder mesh and remove it from the registry. */
  private removeCase(memberCase: MemberCase): void {
    if (memberCase.mesh && !memberCase.mesh.isDisposed()) {
      memberCase.mesh.dispose();
    }
    this.casesById.delete(memberCase.id);
    this.metrics.processing = Math.max(0, this.metrics.processing - 1);
    this.pushMetrics();
  }

  /**
   * Begin a scripted scenario in the office. The caller is responsible for
   * the neighbourhood walk + scene transition; once that's done it calls
   * this method which spawns the client at the office spawn point and
   * lets the existing pipeline take over (with deterministic outcomes).
   *
   * @returns the spawned client (caller can read its character.id, case, etc).
   */
  startScripted(scenarioId: ScenarioId, hooks: {
    onFocusChange?: (info: BeatFocusInfo) => void;
    onClosed?: () => void;
  } = {}): { customer: CustomerAgentInfo; persona: CustomerPersona } {
    this.pauseAutoSpawn();
    // Apply the JSON reset block so the office is in a clean, deterministic
    // state regardless of any ambient activity that was in flight.
    this.resetForScenario(scenarioId);
    const persona = findCustomerPersona(scenarioId);
    const script = buildScriptForScenario(persona);
    script.onFocusChange = hooks.onFocusChange;
    script.onClosed = () => {
      hooks.onClosed?.();
      // Auto-spawn resumes a few seconds after closure so the office calms down.
      setTimeout(() => this.resumeAutoSpawn(), 1500);
    };
    const customer = this.spawnCustomer(scenarioId, script);
    return {
      customer: {
        characterId: customer.character.id,
        character: customer.character,
        caseId: customer.memberCase.id,
        personaName: customer.persona,
      },
      persona,
    };
  }
}

/* ---------------------------------------------------------------- */
/* Public types & helpers                                            */
/* ---------------------------------------------------------------- */

export interface CustomerAgentInfo {
  characterId: string;
  character: VoxelCharacter;
  caseId: string;
  personaName: string;
}

export interface CharacterProfileCase {
  id: string;
  type: string;
  status: CaseStatus;
}

export interface CharacterProfile {
  kind: "staff" | "customer";
  id: string;
  name: string;
  role: string;
  /** Staff only — team the staff member belongs to. */
  team?: string;
  color: string;
  /** Voxel palette so the profile card can render a matching character bust. */
  palette: VoxelCharacterPalette;
  personality: string;
  typicalLine: string;
  responsibilities: string[];
  situation: string;
  current: string;
  cases: CharacterProfileCase[];
  /** Client only — friendly request type. */
  scenarioName: string;
  /** Client only — name of staff currently holding the folder. */
  currentHandler: string | null;
  /** Client only — their in-flight case. */
  activeCase: {
    id: string;
    type: string;
    amount: number;
    status: CaseStatus;
  } | null;
  /**
   * Staff only — absolute URL to the matching agent walkthrough page in the
   * companion `src/backend` Blazor site (`/agents/{app_agent_id}`). Null for
   * clients.
   */
  agentUrl: string | null;
  /** Staff only — the AI agent working behind this person ("under the hood"). */
  agent: {
    name: string;
    tagline: string;
    subAgents: { name: string; description: string }[];
  } | null;
}

function describeTask(task: Task): string {
  switch (task.kind) {
    case "idle":
      return "At desk, awaiting work";
    case "pickup":
      return `Picking up ${task.memberCase.id}`;
    case "route":
      return `Routing ${task.memberCase.id} to Benefits & Eligibility`;
    case "assess":
      return `Assessing ${task.memberCase.id}`;
    case "carry-to-payments":
      return `Routing ${task.memberCase.id} to Payments`;
    case "pay":
      return `Processing payment for ${task.memberCase.id}`;
    case "carry-to-comms":
      return `Routing ${task.memberCase.id} to Client Communications`;
    case "communicate":
      return `Contacting the client about ${task.memberCase.id}`;
    case "consult":
      return `Reviewing ${task.memberCase.id}`;
  }
}

function describeCustomerState(c: CustomerAgent): string {
  switch (c.state) {
    case "entering":
      return "Walking into the office";
    case "to-reception":
      return "Heading to reception";
    case "leaving":
      return "Leaving the office";
    case "done":
      return "Departed";
  }
}

/**
 * Builds a deterministic scenario script for a given client persona,
 * sourced from the JSON definition in `src/scenarios/<id>.json`. The JSON
 * is the single source of truth — narration, consultations, outcome — so
 * editing the JSON updates both the on-screen story and the underlying
 * simulation behaviour.
 */
function buildScriptForScenario(p: CustomerPersona): CaseScript {
  const def = getScenario(p.id);
  const toBeat = (c: { role: AgentRole; narration: string; duration: number }): ScriptExtraBeat => ({
    role: c.role,
    narration: c.narration,
    duration: c.duration,
  });
  return {
    scenarioId: def.id,
    caseId: def.caseId,
    amount: def.amount,
    paidAmount: def.paidAmount,
    approveAtBenefits: def.approveAtBenefits,
    // Copies, so the simulation can consume them without touching the JSON.
    preBenefits: def.preBenefits.map(toBeat),
    postBenefits: def.postBenefits.map(toBeat),
    outcome: def.outcome,
    decisionStatus: def.result.status,
    narrations: { ...def.narrations },
    color: p.color,
    personaName: p.name,
  };
}
