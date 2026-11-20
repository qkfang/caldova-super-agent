/**
 * The dock: the front desk on the Level 1 deck, its greeter, Amelia the
 * financial adviser, and the self-driving water taxi that brings members,
 * clients and advisers across the lake to sign their application, policy or
 * death benefit claim.
 *
 * Between the finale's requests, everyday visitors drop by. Amelia welcomes
 * each one and, while they sign, links them with the agents that get them
 * started: a gold beam runs from her to each agent's bay. In the finale the
 * chosen member arrives first: they sign at the front desk, Olivia's Form
 * Extraction agent walks out to read the form, and the request sets off
 * through the house (see requestTrace.ts).
 */
import { Color3, DynamicTexture, MeshBuilder, Quaternion, TransformNode } from "@babylonjs/core";
import { PALETTES, type VoxelCharacterPalette } from "../characterPalettes";
import { CUSTOMER_PERSONAS, findStaffById, type ScenarioId } from "../personaData";
import { VoxelCharacter } from "../voxelCharacter";
import { Batch, type Bubble, type Kit, rng } from "./kit";
import { ADVISER, ARRIVALS, DROP_INS, IMPOSTOR_PALETTE, SCENARIO_SIDE, SIDES, type SideId } from "./lakehouseData";
import { CHARACTER_SCALE, DOCK_DESK, FLOOR_Y, LAKE } from "./layout";
import type { Anchor, Highlights } from "./types";

type Pt = readonly [number, number];

/** The water taxi's way in, from out on the lake to its berth beside the jetty. */
const TAXI_IN: Pt[] = [
  [31, -31.8],
  [16, -31.6],
  [6, -31.0],
  [1.4, -30.2],
  [0.5, -29.0],
  [0.45, -27.0],
];
/** The finale's member starts closer in, so the arrival doesn't drag. */
const SCRIPTED_START = 1;
/** Where visitors step onto the jetty, and their walk up to the desk. */
const JETTY: Pt = [-1.4, -27.2];
const WALK_IN: Pt[] = [JETTY, [-1.4, -19.9], [-1.2, -18.6], [DOCK_DESK.x - 0.4, DOCK_DESK.z - 1.3]];
const TAXI_SPEED = 4.6;
const WALK_SPEED = 2.6;
const GOLD = Color3.FromHexString("#ffc35a");
/** Amelia stands out front of the counter: clear of its sign, the visitors' path and the agent's spot. */
const AMELIA_AT: Pt = [DOCK_DESK.x + 1.9, DOCK_DESK.z - 2.0];
/** She faces the jetty between visitors, and turns toward the visitor while she helps them. */
const FACE_IDLE = Math.PI - 0.2;
const FACE_HELP = Math.PI + 0.7;
/** Seconds between the agents she links. */
const LINK_EVERY = 1.6;

type Phase =
  | "away"
  | "sailing-in"
  | "stepping-off"
  | "walking-in"
  | "signing"
  | "signed"
  | "walking-out"
  | "stepping-on"
  | "sailing-out";

const STATUS: Record<Phase, string> = {
  away: "",
  "sailing-in": "On the water taxi",
  "stepping-off": "Stepping onto the jetty",
  "walking-in": "Walking up to the front desk",
  signing: "Signing at the front desk",
  signed: "Signed",
  "walking-out": "Heading back to the water taxi",
  "stepping-on": "Boarding the water taxi",
  "sailing-out": "Heading home",
};

interface Visitor {
  kind: "member" | "impostor" | "drop-in";
  ch: VoxelCharacter;
  bubble: Bubble;
  palette: VoxelCharacterPalette;
  name: string;
  doc: string;
  side: SideId;
  summary: string;
  scenario?: ScenarioId;
  /** Amelia's welcome as they walk up. */
  welcome: string;
  /** The agents Amelia links them with while they sign, by staff id. */
  links: readonly string[];
}

export interface VisitorInfo {
  kind: Visitor["kind"];
  palette: VoxelCharacterPalette;
  name: string;
  doc: string;
  side: SideId;
  summary: string;
  scenario?: ScenarioId;
  /** Where they are in their visit, in plain words. */
  status: string;
}

export interface DockHooks {
  /** A visitor is on the way: send the Form Extraction agent out to the desk. */
  callAgent(): void;
  /** The form has been read: the agent can go back inside. */
  releaseAgent(): void;
  /** The agent is standing at the desk, ready to read the signed form. */
  agentReady(): boolean;
  /** Amelia has linked the visitor with these agents, by staff id (empty once they are on their way). */
  link(staffIds: string[]): void;
}

export interface Dock {
  readonly root: TransformNode;
  readonly anchors: Map<string, Anchor>;
  /** The scripted visitor has signed (the finale's request can set off). */
  readonly signed: boolean;
  /** Speed of the scripted arrival (0 pauses it), set by the finale's controls. */
  timeScale: number;
  update(dt: number): void;
  /** The finale: the chosen member arrives by water taxi. */
  arrive(id: ScenarioId): void;
  /** Skip ahead to the signature. */
  fastForward(): void;
  /** Back to everyday visitors. */
  ambient(): void;
  /** Freeze the dock while the deck is hidden. */
  setActive(on: boolean): void;
  visitor(): VisitorInfo | null;
  /** What Amelia is doing right now, for her card. */
  adviserTask(): string;
  setHighlights(h: Highlights): void;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

export function buildDock(kit: Kit, deck: TransformNode, hooks: DockHooks): Dock {
  const scene = kit.scene;
  const root = new TransformNode("v2_dock", scene);
  root.parent = deck;
  const r = rng(91);
  const y = FLOOR_Y.agents;
  const dx = DOCK_DESK.x;
  const dz = DOCK_DESK.z;

  /* ---------------- The front desk ---------------- */
  const batch = new Batch(root, "dock");
  const prev = kit.useBatch(batch);
  const walnut = kit.mat("#ffffff", { texture: "walnut" });
  const steel = kit.mat("#2b3240", { specular: 0.25 });
  const gold = kit.mat("#c9a14a", { unlit: true });
  kit.block(root, dx, y, dz, 3.0, 1.1, 0.9, walnut);
  kit.block(root, dx, y + 1.1, dz, 3.2, 0.08, 1.1, kit.mat("#f1eee6", { specular: 0.3 }));
  kit.block(root, dx, y + 0.84, dz - 0.46, 2.6, 0.06, 0.02, gold);
  // The signing tablet and a pot plant.
  kit.block(root, dx + 0.95, y + 1.18, dz + 0.1, 0.12, 0.28, 0.12, steel);
  kit.block(root, dx + 0.95, y + 1.4, dz + 0.1, 0.66, 0.44, 0.06, kit.mat("#1f2937"));
  kit.block(root, dx + 0.95, y + 1.45, dz + 0.06, 0.56, 0.34, 0.02, kit.mat("#5ce1ff", { unlit: true }));
  kit.block(root, dx - 1.25, y + 1.18, dz + 0.1, 0.36, 0.3, 0.36, kit.mat("#d8d2c6"));
  kit.block(root, dx - 1.25, y + 1.48, dz + 0.1, 0.5, 0.42, 0.5, kit.mat("#5ea347"));
  // The canopy: two posts behind the greeter and a roof that reaches out over the counter.
  for (const px of [dx - 1.75, dx + 1.75]) kit.block(root, px, y, dz + 1.6, 0.16, 3.35, 0.16, steel);
  kit.block(root, dx, y + 3.35, dz + 0.4, 4.1, 0.18, 3.1, kit.mat("#f4f1ea"));
  kit.block(root, dx, y + 3.3, dz - 1.14, 4.12, 0.08, 0.06, gold);
  // A water-taxi stop on the end of the jetty.
  kit.block(root, -2.0, y, -30.2, 0.1, 1.8, 0.1, steel);
  kit.useBatch(prev);
  batch.flush();

  const sign = kit.label(root, {
    lines: [
      { text: "FRONT DESK", size: 64, weight: 800, color: "#0f1a2e" },
      { text: "Welcome to Caldova", size: 32, weight: 600, color: "#5b6476" },
    ],
    width: 3.4,
    px: 640,
    bg: "rgba(255,251,242,0.96)",
    accent: "#c9a14a",
    bar: "top",
  });
  sign.position.set(dx, y + 2.82, dz - 1.18);
  const stop = kit.label(root, {
    lines: [{ text: "WATER TAXI", size: 52, weight: 800, color: "#0f766e" }],
    width: 1.7,
    px: 420,
    pxHeight: 90,
    bg: "rgba(255,251,242,0.96)",
  });
  stop.position.set(-2.0, y + 1.95, -30.26);

  kit.hitbox(root, dx, y, dz + 0.3, 3.6, 3.4, 2.2, { type: "desk" });
  const ring = MeshBuilder.CreateTorus("v2_deskRing", { diameter: 4.6, thickness: 0.16, tessellation: 40 }, scene);
  ring.position.set(dx, y + 0.08, dz + 0.1);
  kit.finish(ring, root, kit.mat("#ffe08a", { unlit: true }), true);
  ring.setEnabled(false);

  // The paper being signed, the pen, the agent's scan and the "sent" note.
  const docTex = new DynamicTexture("v2_deskDocTex", { width: 256, height: 320 }, scene, true);
  const doc = MeshBuilder.CreatePlane("v2_deskDoc", { width: 0.62, height: 0.78 }, scene);
  doc.rotation.x = Math.PI / 2;
  doc.position.set(dx - 0.4, y + 1.19, dz - 0.1);
  kit.finish(doc, root, kit.screen(docTex), true);
  doc.setEnabled(false);
  const paintDoc = (title: string, side: SideId, signed: boolean): void => {
    const ctx = docTex.getContext() as unknown as CanvasRenderingContext2D;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 256, 320);
    ctx.fillStyle = SIDES[side].color;
    ctx.fillRect(0, 0, 256, 44);
    ctx.fillStyle = "#ffffff";
    ctx.font = '800 20px "Segoe UI", sans-serif';
    ctx.fillText("CALDOVA", 16, 30);
    ctx.fillStyle = "#0f1a2e";
    ctx.font = '700 21px "Segoe UI", sans-serif';
    wrapLines(ctx, title, 224).forEach((line, i) => ctx.fillText(line, 16, 76 + i * 26));
    ctx.fillStyle = "#cbd5e1";
    for (let i = 0; i < 5; i++) ctx.fillRect(16, 136 + i * 22, i % 2 ? 170 : 224, 8);
    ctx.fillStyle = "#64748b";
    ctx.font = '600 16px "Segoe UI", sans-serif';
    ctx.fillText("Sign here", 16, 268);
    ctx.fillRect(96, 276, 140, 3);
    if (signed) {
      ctx.strokeStyle = "#1d4ed8";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(100, 272);
      ctx.bezierCurveTo(122, 236, 136, 292, 156, 258);
      ctx.bezierCurveTo(170, 236, 186, 286, 226, 252);
      ctx.stroke();
      ctx.save();
      ctx.translate(176, 196);
      ctx.rotate(-0.22);
      ctx.strokeStyle = "#16a34a";
      ctx.lineWidth = 5;
      ctx.strokeRect(-62, -22, 124, 44);
      ctx.fillStyle = "#16a34a";
      ctx.font = '800 26px "Segoe UI", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("SIGNED", 0, 1);
      ctx.restore();
    }
    docTex.update(true);
  };
  // A blank form up front, so the texture is ready before the first visitor.
  paintDoc("", "shared", false);
  const pen = kit.block(root, 0, 0, 0, 0.06, 0.06, 0.42, kit.mat("#111827"), { dynamic: true });
  pen.setEnabled(false);
  const beam = kit.block(root, dx - 0.4, y + 1.24, dz - 0.1, 0.74, 0.02, 0.06, kit.mat("#5ce1ff", { unlit: true }), {
    dynamic: true,
  });
  beam.setEnabled(false);
  const sent = kit.label(root, {
    lines: [{ text: "Signed · sent to Onboarding", size: 34, weight: 700, color: "#0f766e" }],
    width: 2.6,
    px: 520,
    pxHeight: 70,
    bg: "rgba(255,255,255,0.95)",
    billboard: true,
  });
  sent.position.set(dx - 0.4, y + 2.15, dz - 0.3);
  sent.setEnabled(false);

  const anchorNode = new TransformNode("v2_deskAnchor", scene);
  anchorNode.parent = root;
  anchorNode.position.set(dx - 0.4, y + 1.2, dz - 0.1);
  const anchors = new Map<string, Anchor>([["desk", { node: anchorNode, group: "agents", dy: 0.3 }]]);

  /* ---------------- The greeter and the visitors ---------------- */
  const person = (
    id: string,
    palette: VoxelCharacterPalette,
    accent: string,
    bubbleY = 2.45,
  ): { ch: VoxelCharacter; bubble: Bubble } => {
    const ch = new VoxelCharacter(scene, id, palette);
    ch.root.parent = root;
    ch.root.scaling.setAll(CHARACTER_SCALE);
    return { ch, bubble: kit.bubble(ch.root, bubbleY, accent, CHARACTER_SCALE) };
  };
  const greeter = person("greeter", PALETTES.receptionGreeter, "#c9a14a");
  greeter.ch.root.position.set(dx - 0.4, y, dz + 1.05);
  greeter.ch.root.rotation.y = Math.PI;

  /* ---------------- Amelia, the financial adviser ---------------- */
  // She gives the advice, then links each visitor with the agents that get them started. Her
  // tablet shows the agent she is linking, in its colour. Her bubble floats a little higher than
  // the others', so it clears the FRONT DESK sign behind her.
  const amelia = person(ADVISER.id, ADVISER.palette, ADVISER.color, 2.75);
  amelia.ch.root.position.set(AMELIA_AT[0], y, AMELIA_AT[1]);
  amelia.ch.root.rotation.y = FACE_IDLE;
  // A slimmer click target, so the greeter behind the counter can still be clicked past her.
  amelia.ch.getHitbox().scaling.x = 0.75;
  const shoulder = amelia.ch.getHandAnchor().parent as TransformNode;
  const holder = new TransformNode("v2_ameliaTablet", scene);
  holder.parent = amelia.ch.getHandAnchor();
  holder.rotationQuaternion = new Quaternion();
  const tilt = new TransformNode("v2_ameliaTabletTilt", scene);
  tilt.parent = holder;
  tilt.position.set(0, 0.1, 0.04);
  tilt.rotation.x = -0.45;
  kit.block(tilt, 0, -0.18, 0, 0.52, 0.36, 0.05, kit.mat("#1f2937", { specular: 0.3 }), { dynamic: true });
  const screen = kit.block(tilt, 0, -0.15, 0.03, 0.44, 0.3, 0.012, kit.mat(ADVISER.color, { unlit: true }), { dynamic: true });
  let arm = 1.1;
  /** Holds the tablet out, higher while she shows the visitor who she is linking. */
  const pose = (dt: number, showing: boolean): void => {
    arm += ((showing ? 1.45 : 1.1) - arm) * Math.min(1, dt * 6);
    amelia.ch.setArmPose(0.12, arm);
    // Undo the shoulder's turn, so the tablet stays upright whatever the arm is doing.
    const s = shoulder.rotation;
    Quaternion.RotationYawPitchRollToRef(s.y, s.x, s.z, holder.rotationQuaternion!).conjugateInPlace();
  };
  pose(1, false);
  anchors.set("adviser", { node: amelia.ch.root, group: "agents", dy: 3.15 });

  const members = new Map<ScenarioId, Visitor>();
  for (const c of CUSTOMER_PERSONAS) {
    if (ARRIVALS[c.id].visitor !== "member") continue;
    const side = SCENARIO_SIDE[c.id];
    members.set(c.id, {
      kind: "member",
      ...person(`visitor:${c.id}`, PALETTES[c.palette], SIDES[side].color),
      palette: PALETTES[c.palette],
      name: c.name,
      doc: ARRIVALS[c.id].doc,
      side,
      summary: c.situation,
      scenario: c.id,
      welcome: ARRIVALS[c.id].welcome,
      links: ARRIVALS[c.id].links,
    });
  }
  const grace = CUSTOMER_PERSONAS.find((c) => c.id === "protection");
  const impostor: Visitor = {
    kind: "impostor",
    ...person("visitor:impostor", IMPOSTOR_PALETTE, SIDES.super.color),
    palette: IMPOSTOR_PALETTE,
    name: `Someone signing in ${grace?.name.split(" ")[0] ?? "a member"}’s name`,
    doc: ARRIVALS.protection.doc,
    side: SCENARIO_SIDE.protection,
    summary: `${grace?.name ?? "The member"} is overseas. This request in her name is lodged by someone else, and Felix’s Financial Crime Agent will check it.`,
    scenario: "protection",
    welcome: ARRIVALS.protection.welcome,
    links: ARRIVALS.protection.links,
  };
  const dropIns: Visitor[] = DROP_INS.map((d) => ({
    kind: "drop-in",
    ...person(`visitor:${d.id}`, d.palette, SIDES[d.side].color),
    palette: d.palette,
    name: d.who,
    doc: d.doc,
    side: d.side,
    summary: d.summary,
    welcome: d.welcome,
    links: d.links,
  }));
  for (const v of [...members.values(), impostor, ...dropIns]) v.ch.root.setEnabled(false);

  /* ---------------- The water taxi ---------------- */
  const taxi = new TransformNode("v2_taxi", scene);
  taxi.parent = root;
  const hull = kit.mat("#f8fafc", { specular: 0.3 });
  const teal = kit.mat("#14b8a6");
  kit.block(taxi, 0, -0.3, 0, 1.7, 0.6, 3.8, hull, { dynamic: true });
  kit.block(taxi, 0, -0.3, 2.05, 1.1, 0.55, 0.4, hull, { dynamic: true });
  kit.block(taxi, -0.86, 0.02, 0, 0.06, 0.14, 3.8, teal, { dynamic: true });
  kit.block(taxi, 0.86, 0.02, 0, 0.06, 0.14, 3.8, teal, { dynamic: true });
  kit.block(taxi, 0, 0.28, -0.2, 1.5, 0.04, 3.2, kit.mat("#ffffff", { texture: "cedar" }), { dynamic: true });
  kit.block(taxi, 0, 0.3, 1.05, 1.5, 0.6, 0.08, kit.mat("#1b2a44", { specular: 0.6 }), { dynamic: true });
  kit.block(taxi, 0, 0.3, 2.2, 0.24, 0.14, 0.1, kit.mat("#5ce1ff", { unlit: true }), { dynamic: true });
  kit.block(taxi, 0.62, 0.3, -1.75, 0.05, 1.3, 0.05, steel, { dynamic: true });
  kit.block(taxi, 0.82, 1.32, -1.75, 0.36, 0.22, 0.03, kit.mat("#c9a14a"), { dynamic: true });
  taxi.setEnabled(false);

  /* ---------------- The visit ---------------- */
  let phase: Phase = "away";
  let wait = 5;
  let scripted = false;
  let signedFlag = false;
  let active = true;
  let current: Visitor | null = null;
  let dropIndex = 0;
  let route: Pt[] = [];
  let hop = 0;
  let agentOut = false;
  /** Skipped ahead: sign without waiting for the agent to walk out. */
  let rushed = false;
  /** How long the signed form has waited for the agent. */
  let late = 0;
  let releaseIn = -1;
  let sentFor = 0;
  let greeterWait = 6;
  let greeterSays = 0;
  let clock = 0;
  const greet = (text: string): void => {
    greeter.bubble.say(text);
    greeterSays = 3.4;
  };
  let ameliaSays = 0;
  let taskIndex = 0;
  /** The greeter and Amelia take turns to say what they are doing between visitors. */
  let ameliaTurn = false;
  const advise = (text: string, time = 3.4): void => {
    amelia.bubble.say(text);
    ameliaSays = time;
  };
  /** The agents Amelia has linked the visitor with so far, and those still to come. */
  let linked: string[] = [];
  let toLink: string[] = [];
  let linkIn = 0;
  const agentName = (id: string): string => findStaffById(id)?.agent_name ?? "agent";
  const linkNext = (): void => {
    const id = toLink.shift();
    if (!id) return;
    linked = [...linked, id];
    hooks.link(linked);
    screen.material = kit.mat(findStaffById(id)?.color ?? ADVISER.color, { unlit: true });
    // One speaker at a time: the visitor has said they are signing, now Amelia talks.
    current?.bubble.hide();
    advise(linked.length === 1 ? `Linking the ${agentName(id)}` : `And the ${agentName(id)}`, LINK_EVERY + 0.3);
    linkIn = LINK_EVERY;
  };
  const clearLinks = (): void => {
    toLink = [];
    if (!linked.length) return;
    linked = [];
    hooks.link([]);
    screen.material = kit.mat(ADVISER.color, { unlit: true });
  };
  const taxiAt = { x: TAXI_IN[0][0], z: TAXI_IN[0][1], heading: -Math.PI / 2 };
  const timeScale = { value: 1 };

  const seat = (v: Visitor): void => {
    const s = Math.sin(taxiAt.heading);
    const c = Math.cos(taxiAt.heading);
    v.ch.root.position.set(taxiAt.x - s * 0.7, taxi.position.y + 0.3, taxiAt.z - c * 0.7);
    v.ch.root.rotation.y = taxiAt.heading;
  };
  const sail = (dt: number): boolean => {
    let step = TAXI_SPEED * dt;
    const end = route[route.length - 1];
    // Ease in to the berth.
    const toEnd = Math.hypot(end[0] - taxiAt.x, end[1] - taxiAt.z);
    if (phase === "sailing-in" && toEnd < 4) step *= 0.3 + (0.7 * toEnd) / 4;
    while (step > 0 && route.length) {
      const [tx, tz] = route[0];
      const ddx = tx - taxiAt.x;
      const ddz = tz - taxiAt.z;
      const dist = Math.hypot(ddx, ddz);
      if (dist <= step) {
        taxiAt.x = tx;
        taxiAt.z = tz;
        step -= dist;
        route.shift();
      } else {
        taxiAt.x += (ddx / dist) * step;
        taxiAt.z += (ddz / dist) * step;
        const target = Math.atan2(ddx, ddz);
        const diff = ((target - taxiAt.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        taxiAt.heading += diff * Math.min(1, dt * 3);
        step = 0;
      }
    }
    return route.length === 0;
  };
  const walk = (v: Visitor, dt: number): boolean => {
    const node = v.ch.root;
    let step = WALK_SPEED * dt;
    while (step > 0 && route.length) {
      const [tx, tz] = route[0];
      const ddx = tx - node.position.x;
      const ddz = tz - node.position.z;
      const dist = Math.hypot(ddx, ddz);
      if (dist <= step) {
        node.position.x = tx;
        node.position.z = tz;
        step -= dist;
        route.shift();
      } else {
        node.position.x += (ddx / dist) * step;
        node.position.z += (ddz / dist) * step;
        node.rotation.y = Math.atan2(ddx, ddz);
        step = 0;
      }
    }
    return route.length === 0;
  };
  const boatSpot = (): Pt => [taxiAt.x - Math.sin(taxiAt.heading) * 0.7, taxiAt.z - Math.cos(taxiAt.heading) * 0.7];

  const reset = (): void => {
    if (agentOut) hooks.releaseAgent();
    agentOut = false;
    releaseIn = -1;
    if (current) {
      current.ch.setWalking(false);
      current.ch.root.setEnabled(false);
      current.bubble.hide();
    }
    current = null;
    taxi.setEnabled(false);
    doc.setEnabled(false);
    pen.setEnabled(false);
    beam.setEnabled(false);
    sent.setEnabled(false);
    sentFor = 0;
    greeter.bubble.hide();
    amelia.bubble.hide();
    ameliaSays = 0;
    clearLinks();
    phase = "away";
  };
  const callAgent = (): void => {
    if (agentOut) return;
    hooks.callAgent();
    agentOut = true;
  };
  const begin = (v: Visitor, from: number): void => {
    current = v;
    rushed = false;
    taxiAt.x = TAXI_IN[from][0];
    taxiAt.z = TAXI_IN[from][1];
    const [nx, nz] = TAXI_IN[from + 1];
    taxiAt.heading = Math.atan2(nx - taxiAt.x, nz - taxiAt.z);
    route = TAXI_IN.slice(from + 1);
    taxi.setEnabled(true);
    v.ch.root.setEnabled(true);
    v.ch.setWalking(false);
    paintDoc(v.doc, v.side, false);
    phase = "sailing-in";
    // The finale's member is expected: the agent heads out while the taxi is still on the water.
    if (scripted) callAgent();
  };
  const startSigning = (v: Visitor, time: number): void => {
    v.ch.setWalking(false);
    v.ch.root.rotation.y = 0;
    doc.setEnabled(true);
    pen.setEnabled(true);
    v.bubble.say("Signing here");
    // Then Amelia links them with the agents that get them started.
    toLink = [...v.links];
    linkIn = 1.2;
    wait = time;
    late = 0;
    phase = "signing";
  };

  const step = (dt: number): void => {
    clock += dt;
    greeter.ch.update(dt);
    greeter.ch.root.rotation.y = Math.PI + Math.sin(clock * 0.5) * 0.15;
    amelia.ch.update(dt);
    const helping = !!current && (phase === "walking-in" || phase === "signing" || phase === "signed" || phase === "walking-out");
    const face = (helping ? FACE_HELP : FACE_IDLE) + Math.sin(clock * 0.4 + 1) * 0.1;
    amelia.ch.root.rotation.y += (face - amelia.ch.root.rotation.y) * Math.min(1, dt * 3);
    const linking = phase === "signing" || phase === "signed";
    pose(dt, linking && linked.length > 0);
    if (linking && toLink.length) {
      linkIn -= dt;
      if (linkIn <= 0) linkNext();
    }
    if (ameliaSays > 0) {
      ameliaSays -= dt;
      if (ameliaSays <= 0) amelia.bubble.hide();
    }
    if (sentFor > 0) {
      sentFor -= dt;
      sent.position.y = y + 2.15 + (2.5 - sentFor) * 0.12;
      if (sentFor <= 0) sent.setEnabled(false);
    }
    if (releaseIn > 0) {
      releaseIn -= dt;
      if (releaseIn <= 0 && agentOut) {
        hooks.releaseAgent();
        agentOut = false;
      }
    }
    if (!current) {
      greeterWait -= dt;
      if (greeterWait <= 0) {
        greeterWait = 10 + r() * 10;
        ameliaTurn = !ameliaTurn;
        if (ameliaTurn) {
          taskIndex = (taskIndex + 1) % ADVISER.tasks.length;
          advise(ADVISER.tasks[taskIndex]);
        } else greet(r() > 0.5 ? "Tidying the front desk" : "Checking the water taxi times");
      }
    }
    if (greeterSays > 0) {
      greeterSays -= dt;
      if (greeterSays <= 0) greeter.bubble.hide();
    }
    taxi.position.set(taxiAt.x, LAKE.waterY + Math.sin(clock * 1.3) * 0.05, taxiAt.z);
    taxi.rotation.y = taxiAt.heading;
    taxi.rotation.z = Math.sin(clock * 1.1) * 0.03;

    const v = current;
    switch (phase) {
      case "away":
        wait -= dt;
        if (wait <= 0 && !scripted) {
          begin(dropIns[dropIndex++ % dropIns.length], 0);
        }
        return;
      case "sailing-in":
        if (!v) return;
        if (sail(dt)) {
          hop = 0;
          phase = "stepping-off";
          greet("Welcome to Caldova!");
        }
        seat(v);
        return;
      case "stepping-off": {
        if (!v) return;
        hop = Math.min(1, hop + dt / 0.6);
        const [bx, bz] = boatSpot();
        v.ch.root.position.set(
          bx + (JETTY[0] - bx) * hop,
          taxi.position.y + 0.3 + (y - taxi.position.y - 0.3) * hop + Math.sin(Math.PI * hop) * 0.5,
          bz + (JETTY[1] - bz) * hop,
        );
        if (hop >= 1) {
          v.ch.root.position.y = y;
          route = WALK_IN.slice(1);
          v.ch.setWalking(true);
          greeter.bubble.hide();
          advise(v.welcome, 3.6);
          callAgent();
          phase = "walking-in";
        }
        return;
      }
      case "walking-in":
        if (!v) return;
        v.ch.update(dt);
        if (walk(v, dt)) startSigning(v, 3.3);
        return;
      case "signing": {
        if (!v) return;
        if (wait > 0.9) {
          wait -= dt;
          pen.position.set(dx - 0.36 + Math.sin(clock * 9) * 0.1, y + 1.24, dz - 0.36 + Math.cos(clock * 7) * 0.03);
          pen.rotation.y = 0.6;
          return;
        }
        if (pen.isEnabled()) {
          pen.setEnabled(false);
          paintDoc(v.doc, v.side, true);
        }
        // The Form Extraction agent scans the signed form once it is at the desk.
        if (!beam.isEnabled()) {
          if (!rushed && late < 6 && !hooks.agentReady()) {
            if (late === 0) greet("Our Form Extraction agent is on its way");
            late += dt;
            return;
          }
          beam.setEnabled(true);
        }
        wait -= dt;
        beam.position.z = dz - 0.1 + Math.sin((0.9 - wait) * 7) * 0.3;
        if (wait <= 0) {
          beam.setEnabled(false);
          sent.setEnabled(true);
          sentFor = 2.5;
          releaseIn = 1.6;
          v.bubble.hide();
          greet(v.kind === "drop-in" ? "All done, thank you" : "Thank you, it’s on its way");
          signedFlag = true;
          wait = 2.2;
          phase = "signed";
        }
        return;
      }
      case "signed":
        if (!v || scripted) return;
        wait -= dt;
        if (wait <= 0) {
          greeter.bubble.hide();
          clearLinks();
          route = [...WALK_IN].reverse().slice(1);
          v.ch.setWalking(true);
          phase = "walking-out";
        }
        return;
      case "walking-out":
        if (!v) return;
        v.ch.update(dt);
        if (walk(v, dt)) {
          v.ch.setWalking(false);
          doc.setEnabled(false);
          hop = 0;
          phase = "stepping-on";
        }
        return;
      case "stepping-on": {
        if (!v) return;
        hop = Math.min(1, hop + dt / 0.6);
        const [bx, bz] = boatSpot();
        v.ch.root.position.set(
          JETTY[0] + (bx - JETTY[0]) * hop,
          y + (taxi.position.y + 0.3 - y) * hop + Math.sin(Math.PI * hop) * 0.5,
          JETTY[1] + (bz - JETTY[1]) * hop,
        );
        if (hop >= 1) {
          route = [...TAXI_IN].reverse().slice(1);
          phase = "sailing-out";
        }
        return;
      }
      case "sailing-out":
        if (!v) return;
        if (sail(dt)) {
          reset();
          wait = 6 + r() * 8;
          return;
        }
        seat(v);
        return;
    }
  };

  return {
    root,
    anchors,
    get signed(): boolean {
      return signedFlag;
    },
    get timeScale(): number {
      return timeScale.value;
    },
    set timeScale(s: number) {
      timeScale.value = s;
    },
    update(dt: number): void {
      if (!active) return;
      step(scripted ? dt * timeScale.value : dt);
    },
    arrive(id: ScenarioId): void {
      reset();
      scripted = true;
      signedFlag = false;
      timeScale.value = 1;
      const v = ARRIVALS[id].visitor === "impostor" ? impostor : members.get(id);
      if (v) begin(v, SCRIPTED_START);
    },
    fastForward(): void {
      const v = current;
      if (!v || !scripted) return;
      if (phase === "sailing-in" || phase === "stepping-off" || phase === "walking-in") {
        taxiAt.x = TAXI_IN[TAXI_IN.length - 1][0];
        taxiAt.z = TAXI_IN[TAXI_IN.length - 1][1];
        taxiAt.heading = 0;
        route = [];
        const [sx, sz] = WALK_IN[WALK_IN.length - 1];
        v.ch.root.position.set(sx, y, sz);
        callAgent();
        rushed = true;
        startSigning(v, 1.3);
      } else if (phase === "signing") {
        rushed = true;
        wait = Math.min(wait, 0.5);
      }
    },
    ambient(): void {
      if (!scripted) return;
      reset();
      scripted = false;
      signedFlag = false;
      wait = 4;
    },
    setActive(on: boolean): void {
      active = on;
    },
    visitor(): VisitorInfo | null {
      if (!current || phase === "away") return null;
      const v = current;
      return {
        kind: v.kind,
        palette: v.palette,
        name: v.name,
        doc: v.doc,
        side: v.side,
        summary: v.summary,
        scenario: v.scenario,
        status: phase === "signing" ? `Signing the ${v.doc}` : STATUS[phase],
      };
    },
    adviserTask(): string {
      const v = current;
      if (!v || phase === "away") return ADVISER.tasks[taskIndex];
      const who =
        v.kind === "member" ? v.name.split(" ")[0] : v.kind === "impostor" ? "the visitor" : v.name.charAt(0).toLowerCase() + v.name.slice(1);
      switch (phase) {
        case "sailing-in":
        case "stepping-off":
          return "Meeting the water taxi";
        case "walking-in":
          return `Welcoming ${who}`;
        case "signing":
        case "signed":
          return linked.length ? `Linking ${who} with the ${agentName(linked[linked.length - 1])}` : `Helping ${who} get started`;
        default:
          return `Seeing ${who} off`;
      }
    },
    setHighlights(h: Highlights): void {
      ring.setEnabled(h.desk);
      greeter.ch.setHighlight(h.desk, GOLD);
      amelia.ch.setHighlight(h.adviser || h.desk, GOLD);
    },
  };
}
