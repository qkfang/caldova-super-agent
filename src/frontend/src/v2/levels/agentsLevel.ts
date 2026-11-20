/**
 * Level 1 · The Agents — one group of Microsoft Foundry agents that
 * supports both teams, shown role by role.
 *
 * The floor is split into zones: agents dedicated to the Wealth Management
 * side, agents shared by both sides, and agents dedicated to the
 * Superannuation side. Each person's agent has a bay directly under their
 * desk on Level 2 and works there with its two specialised assistants
 * (named in agentStages.ts); Cara's bay also has her voice agent. Every role
 * is its own small voxel robot, carrying something that says what it does,
 * and the bay's frame glows in the colour of its side.
 *
 * The roles move about the floor: to the Member Case at the front of the
 * shared zone, to the Foundry uplink (their line down to Microsoft Foundry
 * and Microsoft IQ), to the shared MCP tool bench, and to the next agent's
 * bay to hand work on. Olivia's Form Extraction agent also walks out to the
 * front desk on the dock whenever a visitor signs.
 */
import { Color3, Mesh, MeshBuilder, StandardMaterial, Texture, TransformNode, Vector3 } from "@babylonjs/core";
import { STAFF_PERSONAS, findStaffById } from "../../personaData";
import { Batch, type Kit, rng } from "../kit";
import {
  AGENTS,
  DESK_ROLE,
  HANDOFFS,
  SIDES,
  levelInfo,
  rolesOf,
  sideBadge,
  type AgentRole,
  type RoleProp,
  type SideId,
} from "../lakehouseData";
import { CENTRE_CELL, DOCK_DESK, FLOOR_Y, SLABS, STATIONS, WALLS, ZONES } from "../layout";
import { buildShell } from "../shell";
import type { Anchor, Highlights, LevelBuild } from "../types";
import { SpotBook, Wanderer, type Outing, type Pt, type Spot } from "../wander";

const HUB = { x: CENTRE_CELL.x, z: CENTRE_CELL.z + 0.2 };
const HUB_R = 1.3;
const BUS_Z = -1.25;
/** The line the robots walk along between the two rows of bays. */
const CZ = -1.0;
const POD_W = 5.6;
const POD_D = 4.6;
/** The robots' line down to Microsoft Foundry and Microsoft IQ, right above Foundry's core. */
const UPLINK = { x: 0, z: -2.5 };
/** The MCP tool bench in the back-left corner: Investments, Transfers, Payments and Teams. */
const BENCH_Z = 6.9;
const BENCH_XS = [-16.2, -14.8, -13.4, -12.0];
const BENCH_COLORS = ["#f59e0b", "#10b981", "#a855f7", "#818cf8"];
/** Where the left column splits: Ivy's dedicated bay in front, the shared tool bench behind. */
const SPLIT_Z = 0.6;

/** Floor lettering for each zone, in a lighter tint of the side colour so it reads on the dark grid. */
const ZONE_TEXT: Record<SideId, { text: string; color: string }> = {
  wealth: { text: "DEDICATED · WEALTH", color: "#e9c877" },
  shared: { text: "SHARED BY BOTH SIDES", color: "#b9c3ff" },
  super: { text: "DEDICATED · SUPER", color: "#5eead4" },
};

/** Where each role stands in its bay: the agent behind, its assistants in front. */
const HOME_OFFSETS: Record<number, Array<[number, number]>> = {
  3: [
    [0, 0.9],
    [-1.6, -0.7],
    [1.6, -0.7],
  ],
  4: [
    [-1.0, 0.9],
    [-1.9, -0.9],
    [0.2, -0.9],
    [1.5, 0.9],
  ],
};

/** What each agent does at the MCP tool bench (the tool families in caldova-ops-mcp). */
const TOOL_WORK: Record<string, { bench: number; tasks: string[] }> = {
  "investments-1": { bench: 0, tasks: ["Analysing a fact sheet", "Comparing two models", "Building the client workbook"] },
  "transfers-1": { bench: 1, tasks: ["Looking up a fund by USI", "Verifying an SMSF", "Generating the rollover PDF"] },
  "payments-1": { bench: 2, tasks: ["Calculating a benefit", "Checking authority limits", "Sending a Teams approval card"] },
};

interface Robot {
  role: AgentRole;
  node: TransformNode;
  tip: Mesh;
  ring: Mesh;
  scale: number;
  phase: number;
  walking: boolean;
  wanderer: Wanderer;
}

interface Pod {
  id: string;
  node: TransformNode;
  ring: Mesh;
  pad: StandardMaterial;
  padBase: Color3;
  power: number;
}

interface Packet {
  mesh: Mesh;
  path: Vector3[];
  length: number;
  speed: number;
  offset: number;
}

export interface AgentsLevelBuild extends LevelBuild {
  /** Send Olivia's Form Extraction agent out to the front desk. */
  callToDesk(): void;
  releaseDesk(): void;
  /** The Form Extraction agent is standing at the front desk, ready to read. */
  deskReady(): boolean;
  /** What a role is doing right now, for the inspector. */
  roleTask(id: string): string | null;
  /** Light up the bays Amelia has linked the visitor at the front desk with, by staff id. */
  setLinked(ids: ReadonlySet<string>): void;
}

/** What a role's robot carries, built in robot space (it faces -z). */
function addProp(kit: Kit, node: TransformNode, prop: RoleProp): void {
  const z = -0.42;
  const b = (x: number, y: number, zz: number, w: number, h: number, d: number, hex: string, glow = false): Mesh =>
    kit.block(node, x, y, zz, w, h, d, kit.mat(hex, glow ? { unlit: true } : {}));
  const disc = (y: number, d: number, hex: string): Mesh => {
    const m = kit.cyl(node, 0, y, z, d, 0.06, kit.mat(hex), { tess: 20 });
    m.rotation.x = Math.PI / 2;
    return m;
  };
  switch (prop) {
    case "doc":
      b(0, 0.4, z, 0.46, 0.6, 0.04, "#ffffff");
      for (const [ly, w] of [
        [0.86, 0.32],
        [0.74, 0.32],
        [0.62, 0.2],
      ] as const)
        b(0, ly, z - 0.03, w, 0.04, 0.02, "#94a3b8");
      break;
    case "clipboard":
      b(0, 0.38, z, 0.5, 0.66, 0.05, "#8b5e3c");
      b(0, 0.42, z - 0.03, 0.4, 0.5, 0.02, "#ffffff");
      b(0, 1.02, z - 0.01, 0.22, 0.06, 0.04, "#cbd5e1");
      b(-0.08, 0.72, z - 0.05, 0.1, 0.05, 0.02, "#16a34a");
      b(-0.08, 0.56, z - 0.05, 0.1, 0.05, 0.02, "#16a34a");
      break;
    case "book":
      b(0, 0.38, z, 0.52, 0.64, 0.2, "#2563eb");
      b(0, 0.84, z - 0.11, 0.3, 0.06, 0.02, "#fcd34d");
      break;
    case "stamp":
      b(0, 0.4, z, 0.4, 0.12, 0.34, "#334155");
      b(0, 0.52, z, 0.14, 0.32, 0.14, "#dc2626");
      b(0, 0.84, z, 0.26, 0.12, 0.26, "#dc2626");
      break;
    case "pie":
      disc(0.62, 0.58, "#f59e0b");
      b(0.08, 0.68, z - 0.05, 0.2, 0.2, 0.02, "#0d9488");
      break;
    case "chart":
      b(0, 0.32, z, 0.5, 0.05, 0.2, "#334155");
      [0.22, 0.36, 0.5].forEach((h, i) => b(-0.15 + i * 0.15, 0.37, z, 0.11, h, 0.11, i === 2 ? "#f59e0b" : "#fcd34d"));
      break;
    case "magnifier": {
      const rim = MeshBuilder.CreateTorus("v2_propLens", { diameter: 0.44, thickness: 0.07, tessellation: 18 }, kit.scene);
      rim.rotation.x = Math.PI / 2;
      rim.position.set(0.05, 0.74, z);
      kit.finish(rim, node, kit.mat("#cbd5e1", { specular: 0.5 }));
      disc(0.71, 0.36, "#bfe6ff").position.x = 0.05;
      b(-0.14, 0.32, z, 0.08, 0.32, 0.08, "#7c3a12").rotation.z = 0.6;
      break;
    }
    case "timeline":
      b(0, 0.66, z, 0.64, 0.06, 0.04, "#e2e8f0");
      ["#22c55e", "#f59e0b", "#ef4444"].forEach((hex, i) => b(-0.22 + i * 0.22, 0.62, z - 0.03, 0.12, 0.14, 0.04, hex));
      break;
    case "globe":
      b(0, 0.42, z, 0.46, 0.46, 0.46, "#2563eb");
      b(-0.08, 0.62, z - 0.24, 0.2, 0.14, 0.02, "#22c55e");
      b(0.1, 0.48, z - 0.24, 0.14, 0.12, 0.02, "#22c55e");
      break;
    case "parcel":
      b(0, 0.4, z, 0.52, 0.4, 0.34, "#b7824a");
      b(0, 0.4, z - 0.18, 0.08, 0.4, 0.02, "#f8fafc");
      b(0, 0.8, z, 0.52, 0.04, 0.1, "#f8fafc");
      break;
    case "clock":
      disc(0.66, 0.5, "#f8fafc");
      b(0, 0.69, z - 0.05, 0.04, 0.18, 0.02, "#111827");
      b(0.06, 0.67, z - 0.05, 0.14, 0.04, 0.02, "#111827");
      break;
    case "badge":
      disc(0.66, 0.48, "#16a34a");
      b(-0.07, 0.63, z - 0.05, 0.12, 0.05, 0.02, "#ffffff").rotation.z = -0.8;
      b(0.05, 0.67, z - 0.05, 0.2, 0.05, 0.02, "#ffffff").rotation.z = 0.9;
      break;
    case "calculator":
      b(0, 0.34, z, 0.42, 0.58, 0.08, "#334155");
      b(0, 0.76, z - 0.05, 0.32, 0.1, 0.02, "#86efac", true);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) b(-0.12 + i * 0.12, 0.42 + j * 0.1, z - 0.05, 0.08, 0.06, 0.02, "#e2e8f0");
      break;
    case "lock": {
      b(0, 0.4, z, 0.38, 0.32, 0.16, "#f59e0b");
      const shackle = MeshBuilder.CreateTorus("v2_propShackle", { diameter: 0.26, thickness: 0.05, tessellation: 16 }, kit.scene);
      shackle.rotation.x = Math.PI / 2;
      shackle.position.set(0, 0.74, z);
      kit.finish(shackle, node, kit.mat("#94a3b8", { specular: 0.5 }));
      b(0, 0.5, z - 0.09, 0.06, 0.1, 0.02, "#1f2937");
      break;
    }
    case "envelope":
      b(0, 0.42, z, 0.52, 0.36, 0.04, "#ffffff");
      b(-0.12, 0.64, z - 0.03, 0.3, 0.04, 0.02, "#ec4899").rotation.z = -0.55;
      b(0.12, 0.64, z - 0.03, 0.3, 0.04, 0.02, "#ec4899").rotation.z = 0.55;
      break;
    case "heart":
      b(0, 0.46, z, 0.5, 0.36, 0.06, "#f9a8d4");
      b(-0.14, 0.38, z, 0.1, 0.1, 0.06, "#f9a8d4");
      for (const x of [-0.12, 0, 0.12]) b(x, 0.6, z - 0.04, 0.06, 0.06, 0.02, "#be185d");
      break;
    case "headset":
      for (const x of [-0.37, 0.37]) b(x, 1.32, 0, 0.12, 0.26, 0.28, "#ec4899");
      b(0, 1.77, 0, 0.84, 0.07, 0.12, "#1f2937");
      b(0.27, 1.2, -0.22, 0.05, 0.05, 0.32, "#1f2937");
      b(0.24, 1.16, -0.4, 0.1, 0.1, 0.1, "#ec4899", true);
      break;
    case "beacon":
      break;
  }
}

/** One role as a small voxel robot, merged into a few meshes. Leads are bigger, with a sash in their side's colour. */
function buildRobot(kit: Kit, role: AgentRole, accent: string, sideColor: string): Omit<Robot, "wanderer" | "phase" | "walking" | "role"> {
  const node = new TransformNode(`v2_robot_${role.id}`, kit.scene);
  const rb = new Batch(node, `robot_${role.id}`);
  const prev = kit.useBatch(rb);
  const lead = role.kind === "lead";
  const metal = kit.mat("#dfeaf7", { emissive: 0.25 });
  const dark = kit.mat("#16213a");
  const body = kit.mat(accent, { emissive: 0.35 });
  const glow = kit.mat("#6ec1ff", { unlit: true });
  kit.block(node, -0.18, 0, 0, 0.28, 0.55, 0.3, dark);
  kit.block(node, 0.18, 0, 0, 0.28, 0.55, 0.3, dark);
  kit.block(node, 0, 0.55, 0, 0.8, 0.75, 0.48, body);
  kit.block(node, 0, 0.8, -0.26, 0.32, 0.28, 0.06, glow);
  kit.block(node, -0.52, 0.6, 0, 0.2, 0.62, 0.22, metal);
  kit.block(node, 0.52, 0.6, 0, 0.2, 0.62, 0.22, metal);
  kit.block(node, 0, 1.27, 0, 0.62, 0.5, 0.52, metal);
  kit.block(node, 0, 1.42, -0.27, 0.5, 0.2, 0.06, dark);
  kit.block(node, -0.12, 1.46, -0.31, 0.1, 0.08, 0.04, glow);
  kit.block(node, 0.12, 1.46, -0.31, 0.1, 0.08, 0.04, glow);
  kit.block(node, 0, 1.77, 0, 0.06, lead ? 0.45 : 0.3, 0.06, metal);
  if (lead) kit.block(node, 0, 1.02, 0, 0.84, 0.12, 0.52, kit.mat(sideColor, { unlit: true }));
  addProp(kit, node, role.prop);
  kit.useBatch(prev);
  rb.flush();
  const tipSize = lead ? 0.24 : 0.16;
  const tip = kit.block(node, 0, lead ? 2.2 : 2.03, 0, tipSize, tipSize, tipSize, lead ? kit.mat(sideColor, { unlit: true }) : glow, {
    dynamic: true,
  });
  const ring = MeshBuilder.CreateTorus(`v2_roleRing_${role.id}`, { diameter: 1.7, thickness: 0.1, tessellation: 32 }, kit.scene);
  ring.position.y = 0.05;
  kit.finish(ring, node, kit.mat("#ffe08a", { unlit: true }), true);
  ring.setEnabled(false);
  return { node, tip, ring, scale: lead ? 1.4 : 1.12 };
}

/** Drops repeated points so no segment of a packet path has zero length. */
function dedupe(points: Vector3[]): Vector3[] {
  return points.filter((p, i) => i === 0 || Vector3.Distance(p, points[i - 1]) > 0.01);
}

export function buildAgentsLevel(kit: Kit): AgentsLevelBuild {
  const scene = kit.scene;
  const root = new TransformNode("v2_lvl_agents", scene);
  const batch = new Batch(root, "agents");
  kit.useBatch(batch);
  const y = FLOOR_Y.agents;
  const info = levelInfo("agents");
  const r = rng(29);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(r() * list.length)];
  const between = (a: number, b: number): number => a + (b - a) * r();

  // Glowing grid floor, one cell every two units.
  const gridTex = kit.canvas("v2_agentGrid", 128, 128, (ctx, w, h) => {
    ctx.fillStyle = "#13233f";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(110,193,255,0.55)";
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, w, h);
  });
  gridTex.wrapU = Texture.WRAP_ADDRESSMODE;
  gridTex.wrapV = Texture.WRAP_ADDRESSMODE;
  const gridMat = new StandardMaterial("v2_agentGridMat", scene);
  gridMat.diffuseTexture = gridTex;
  gridMat.emissiveColor = new Color3(0.42, 0.48, 0.6);
  gridMat.specularColor = Color3.Black();
  const { tag } = buildShell(kit, {
    root,
    level: info,
    floorY: y,
    slab: SLABS.agents,
    walls: WALLS.agents,
    floor: gridMat,
    back: kit.mat("#1b2740"),
  });

  /* ---------------- The zones ---------------- */
  const walls = WALLS.agents;
  const z0 = walls.z0 + 0.4;
  const z1 = walls.z1 - 0.4;
  const zoneRects: Array<{ side: SideId; x0: number; x1: number; z0: number; z1: number }> = [
    { side: "wealth", x0: ZONES.wealth.x0, x1: ZONES.wealth.x1, z0, z1: SPLIT_Z },
    { side: "shared", x0: ZONES.wealth.x0, x1: ZONES.wealth.x1, z0: SPLIT_Z, z1 },
    { side: "shared", x0: ZONES.shared.x0, x1: ZONES.shared.x1, z0, z1 },
    { side: "super", x0: ZONES.super.x0, x1: ZONES.super.x1, z0, z1 },
  ];
  for (const z of zoneRects) {
    kit.block(root, (z.x0 + z.x1) / 2, y + 0.004, (z.z0 + z.z1) / 2, z.x1 - z.x0 - 0.3, 0.012, z.z1 - z.z0, kit.mat(SIDES[z.side].color, { unlit: true, alpha: 0.28 }));
  }
  for (const side of ["wealth", "shared", "super"] as const) {
    const zone = ZONES[side];
    const cx = (zone.x0 + zone.x1) / 2;
    const w = zone.x1 - zone.x0 - 0.3;
    kit.block(root, cx, y + 0.01, z0 + 0.1, w, 0.04, 0.16, kit.mat(SIDES[side].color, { unlit: true }));
    const decal = kit.label(root, {
      lines: [{ text: ZONE_TEXT[side].text, size: 60, weight: 800, color: ZONE_TEXT[side].color }],
      width: Math.min(w - 1, 10.5),
      px: 1024,
      pxHeight: 100,
    });
    decal.rotation.x = Math.PI / 2;
    decal.position.set(cx, y + 0.07, -10.5);
  }
  // Dashed lines where the zones meet.
  const dash = kit.mat("#c7d2fe", { unlit: true });
  for (let z = z0 + 0.6; z < SPLIT_Z - 0.4; z += 1.5) kit.block(root, ZONES.wealth.x1, y + 0.01, z + 0.4, 0.12, 0.04, 0.8, dash);
  for (let x = ZONES.wealth.x0 + 0.6; x < ZONES.wealth.x1 - 0.4; x += 1.5) kit.block(root, x + 0.4, y + 0.01, SPLIT_Z, 0.8, 0.04, 0.12, dash);
  for (let z = z0 + 0.6; z < z1 - 0.4; z += 1.5) kit.block(root, ZONES.super.x0, y + 0.01, z + 0.4, 0.12, 0.04, 0.8, dash);

  // The floor's sign, on the back wall above the tool bench.
  const back = kit.label(root, {
    lines: [
      { text: "ONE GROUP OF AGENTS", size: 60, weight: 800, color: "#5ce1ff" },
      { text: "Each agent with its specialised roles", size: 30, weight: 500, color: "#c6d2e6" },
    ],
    width: 6.4,
    px: 768,
    bg: "rgba(10,20,40,0.94)",
  });
  back.position.set(-13.4, y + 3.3, walls.z1 - 0.32);

  const traceMat = kit.mat("#2e7fbf", { emissive: 0.6 });
  const darkSteel = kit.mat("#1e2433", { specular: 0.3 });
  const pods: Pod[] = [];
  const robots: Robot[] = [];
  const anchors = new Map<string, Anchor>();
  const book = new SpotBook();

  /* ---------------- Places the roles visit ---------------- */
  const hubSpots: Spot[] = [
    { at: [-2.1, -4.9], face: Math.atan2(2.1, -0.9), via: [[-2.1, CZ]], key: "hub:w" },
    { at: [2.1, -4.9], face: Math.atan2(-2.1, -0.9), via: [[2.1, CZ]], key: "hub:e" },
    { at: [0, -3.6], face: Math.PI, via: [[0, CZ]], key: "hub:n" },
  ];
  const uplinkSpots: Spot[] = [
    { at: [-1.5, -2.3], face: Math.PI / 2, via: [[-1.5, CZ]], key: "uplink:w" },
    { at: [1.5, -2.3], face: -Math.PI / 2, via: [[1.5, CZ]], key: "uplink:e" },
  ];
  const benchSpots: Spot[] = BENCH_XS.map((x, i) => ({
    at: [x, 5.75] as Pt,
    face: 0,
    via: [[ZONES.wealth.x1, CZ], [ZONES.wealth.x1, 4.7], [x, 4.7]] as Pt[],
    key: `bench:${i}`,
  }));
  const lookoutSpots: Spot[] = [
    { at: [-11.25, -11.5], face: Math.PI, via: [[-11.25, CZ]], key: "look:w" },
    { at: [11.25, -11.5], face: Math.PI, via: [[11.25, CZ]], key: "look:e" },
  ];
  const handoffSpot = (staffId: string): Spot => {
    const st = STATIONS[staffId];
    return st.z < 0
      ? { at: [st.x + 1.2, -3.0], face: Math.PI, via: [[st.x + 1.2, CZ]], key: `handoff:${staffId}` }
      : { at: [st.x - 1.2, 0.9], face: 0, via: [[st.x - 1.2, CZ]], key: `handoff:${staffId}` };
  };
  const deskSpot: Spot = {
    at: [DOCK_DESK.x + 2.3, DOCK_DESK.z - 0.2],
    face: -Math.PI / 2,
    via: [
      [ZONES.super.x0, CZ],
      [ZONES.super.x0, -11.6],
      [DOCK_DESK.x + 2.3, -13.4],
    ],
  };
  const freeOf = (spots: Spot[]): Spot | null => {
    const free = spots.filter((s) => book.free(s.key));
    return free.length ? pick(free) : null;
  };

  /* ---------------- Bays and their roles ---------------- */
  for (const p of STAFF_PERSONAS) {
    const st = STATIONS[p.id];
    const agent = AGENTS[p.id];
    if (!st || !agent) continue;
    const side = SIDES[agent.side];
    const cz = st.z + 0.2;
    const padMat = new StandardMaterial(`v2_pad_${p.id}`, scene);
    const padBase = Color3.FromHexString(p.color);
    padMat.diffuseColor = padBase.scale(0.6);
    padMat.emissiveColor = padBase.scale(0.35);
    padMat.specularColor = Color3.Black();
    kit.block(root, st.x, y, cz, POD_W, 0.06, POD_D, padMat);
    const frameMat = kit.mat(side.color, { unlit: true });
    for (const [fw, fd, fx, fz] of [
      [POD_W, 0.14, 0, -POD_D / 2],
      [POD_W, 0.14, 0, POD_D / 2],
      [0.14, POD_D, -POD_W / 2, 0],
      [0.14, POD_D, POD_W / 2, 0],
    ] as const) {
      kit.block(root, st.x + fx, y + 0.02, cz + fz, fw, 0.08, fd, frameMat);
    }
    // Trace from the bus to the bay's edge.
    const edge = st.z < 0 ? cz + POD_D / 2 : cz - POD_D / 2;
    kit.block(root, st.x, y + 0.01, (BUS_Z + edge) / 2, 0.14, 0.04, Math.abs(edge - BUS_Z), traceMat);

    const node = new TransformNode(`v2_pod_${p.id}`, scene);
    node.parent = root;
    node.position.set(st.x, y, cz);
    anchors.set(`agent:${p.id}`, { node, group: "agents", dy: 2.1 });

    const roles = rolesOf(p.id);
    const assistants = roles.filter((rl) => rl.kind !== "lead").map((rl) => rl.short);
    const panel = kit.label(node, {
      lines: [
        { text: p.agent_name, size: 50, weight: 800, color: p.color },
        { text: sideBadge(agent.side).toUpperCase(), size: 30, weight: 800, color: ZONE_TEXT[agent.side].color },
        { text: agent.foundryId, size: 34, weight: 600, color: "#9fd4ff" },
        { text: `+ ${assistants.join(" · ")}`, size: 30, weight: 600, color: "#e2e8f0" },
        { text: `works for ${p.name}`, size: 30, weight: 500, color: "#c6d2e6" },
      ],
      width: 5.2,
      px: 640,
      bg: "rgba(10,20,40,0.94)",
      accent: side.color,
      bar: "left",
      align: "left",
    });
    panel.billboardMode = Mesh.BILLBOARDMODE_Y;
    panel.position.set(0, 4.35, 1.7);

    const ring = MeshBuilder.CreateTorus(`v2_podRing_${p.id}`, { diameter: 6.8, thickness: 0.2, tessellation: 48 }, scene);
    ring.position.set(st.x, y + 0.14, cz);
    kit.finish(ring, root, kit.mat("#ffe08a", { unlit: true }), true);
    ring.setEnabled(false);
    // A low click target over the pad, so the roles standing on it can be clicked on their own.
    kit.hitbox(root, st.x, y, cz, POD_W, 0.5, POD_D, { type: "agent", id: p.id });
    pods.push({ id: p.id, node, ring, pad: padMat, padBase, power: 1 });

    const offsets = HOME_OFFSETS[roles.length] ?? HOME_OFFSETS[3];
    const handoffs = [...(HANDOFFS[p.id] ?? []), ...(p.id === "lead-1" ? [] : ["lead-1"])];
    const tools = TOOL_WORK[p.id];
    roles.forEach((role, i) => {
      const [ox, oz] = offsets[i] ?? [0, 0];
      const parts = buildRobot(kit, role, p.color, side.color);
      parts.node.parent = root;
      parts.node.scaling.setAll(parts.scale);
      parts.node.position.y = y;
      kit.hitbox(parts.node, 0, 0, 0, 1.2, 2.3, 1.0, role.kind === "lead" ? { type: "agent", id: p.id } : { type: "role", id: role.id });
      const bubble = kit.bubble(parts.node, 2.55, side.color, parts.scale);
      const home: Spot = { at: [st.x + ox, cz + oz], face: Math.PI, via: [[st.x + ox, CZ]] };
      const robot: Robot = { role, ...parts, phase: r() * 6, walking: false, wanderer: null as unknown as Wanderer };
      const lead = role.kind === "lead";
      const voice = role.kind === "voice";
      const outing = (spot: Spot | null, task: string, where: string, dwell: [number, number]): Outing | null =>
        spot ? { spot, task, where, dwell: between(...dwell) } : null;
      const choices: Array<[number, () => Outing | null]> = [
        [voice ? 1 : 3, () => outing(freeOf(hubSpots), pick(["Updating the Member Case", "Reading the Member Case"]), "the Member Case", [4, 7])],
        [2, () => outing(freeOf(uplinkSpots), pick(["Grounding in Foundry IQ", "Checking the PDS", "Looking up a rule"]), "the Foundry uplink", [3, 5])],
        [
          voice ? 0 : 2,
          () => {
            const target = pick(handoffs);
            const t = findStaffById(target);
            return outing(book.free(handoffSpot(target).key) ? handoffSpot(target) : null, `Handing over to the ${t?.agent_name ?? "next agent"}`, `${t?.name ?? "the next"}’s bay`, [3, 5]);
          },
        ],
        [tools ? 2 : 0, () => (tools ? outing(book.free(benchSpots[tools.bench].key) ? benchSpots[tools.bench] : null, pick(tools.tasks), "the MCP tool bench", [4, 7]) : null)],
        // The lakeside is out on the deck, so only while this floor is in place.
        [0.4, () => (Math.abs(root.position.y) > 0.5 ? null : outing(freeOf(lookoutSpots), "Watching the boats", "the lakeside", [4, 6]))],
      ];
      const total = choices.reduce((s, [w]) => s + w, 0);
      robot.wanderer = new Wanderer({
        body: {
          root: parts.node,
          walk: (on) => {
            robot.walking = on;
          },
        },
        home,
        homeName: "the bay",
        homeTask: () => pick(role.tasks),
        homeDwell: lead ? [14, 26] : voice ? [10, 20] : [7, 16],
        plan: () => {
          let roll = r() * total;
          for (const [w, make] of choices) {
            roll -= w;
            if (roll <= 0) return make();
          }
          return null;
        },
        speed: 2.6,
        book,
        rand: r,
        bubble,
        yaw: Math.PI,
      });
      robots.push(robot);
      anchors.set(`role:${role.id}`, { node: parts.node, group: "agents", dy: 2.2 });
    });
  }

  // The bus that links every bay to the Member Case.
  const xs = Object.values(STATIONS).map((s) => s.x);
  const busX0 = Math.min(...xs);
  const busX1 = Math.max(...xs);
  kit.block(root, (busX0 + busX1) / 2, y + 0.01, BUS_Z, busX1 - busX0 + 0.14, 0.04, 0.14, traceMat);
  kit.block(root, HUB.x, y + 0.01, (BUS_Z + HUB.z + HUB_R) / 2, 0.14, 0.04, BUS_Z - HUB.z - HUB_R, traceMat);

  /* ---------------- The Foundry uplink ---------------- */
  kit.cyl(root, UPLINK.x, y, UPLINK.z, 2.5, 0.04, kit.mat("#141a30"), { tess: 32 });
  kit.cyl(root, UPLINK.x, y + 0.01, UPLINK.z, 1.5, 0.05, kit.mat("#4c3a99", { unlit: true }), { tess: 24 });
  const uplinkRing = MeshBuilder.CreateTorus("v2_uplinkRing", { diameter: 2.3, thickness: 0.1, tessellation: 40 }, scene);
  uplinkRing.position.set(UPLINK.x, y + 0.06, UPLINK.z);
  kit.finish(uplinkRing, root, kit.mat("#a78bfa", { unlit: true }));
  const uplinkBeam = kit.cyl(root, UPLINK.x, y + 0.05, UPLINK.z, 1.2, 3.0, kit.mat("#c4b5fd", { unlit: true, alpha: 0.22 }), {
    top: 0.5,
    tess: 20,
    dynamic: true,
  });
  uplinkBeam.setEnabled(false);
  const uplinkText = kit.label(root, {
    lines: [{ text: "FOUNDRY UPLINK", size: 60, weight: 800, color: "#c4b5fd" }],
    width: 2.6,
    px: 640,
    pxHeight: 96,
  });
  uplinkText.rotation.x = Math.PI / 2;
  uplinkText.position.set(UPLINK.x, y + 0.07, UPLINK.z - 1.55);
  kit.hitbox(root, UPLINK.x, y, UPLINK.z, 2.4, 0.4, 2.4, { type: "infra", id: "foundry" });

  /* ---------------- The MCP tool bench ---------------- */
  BENCH_XS.forEach((x, i) => {
    kit.block(root, x, y, BENCH_Z, 1.0, 1.0, 0.7, darkSteel);
    kit.block(root, x, y + 1.0, BENCH_Z + 0.06, 0.9, 0.62, 0.08, kit.mat("#0b1222"));
    kit.block(root, x, y + 1.08, BENCH_Z, 0.78, 0.46, 0.02, kit.mat(BENCH_COLORS[i], { unlit: true }));
  });
  const benchText = kit.label(root, {
    lines: [{ text: "MCP TOOL BENCH", size: 60, weight: 800, color: "#f9a8d4" }],
    width: 4.2,
    px: 768,
    pxHeight: 96,
  });
  benchText.rotation.x = Math.PI / 2;
  benchText.position.set((BENCH_XS[0] + BENCH_XS[3]) / 2, y + 0.07, 3.6);
  kit.hitbox(root, (BENCH_XS[0] + BENCH_XS[3]) / 2, y, BENCH_Z, 5.2, 1.7, 1.0, { type: "infra", id: "mcp" });

  /* ---------------- Cara's voice agent and Theo's group chat ---------------- */
  const cara = STATIONS["comms-1"];
  const caraZ = cara.z + 0.2;
  const eqBars: Mesh[] = [];
  const eqMat = kit.mat("#ec4899", { unlit: true });
  for (let i = 0; i < 4; i++) {
    eqBars.push(kit.block(root, cara.x + 2.05 + i * 0.17, y + 0.1, caraZ + 1.95, 0.12, 1, 0.12, eqMat, { dynamic: true }));
  }
  const voiceTag = kit.label(root, {
    lines: [{ text: "voice agent", size: 40, weight: 700, color: "#fbcfe8" }],
    width: 1.9,
    px: 320,
    pxHeight: 70,
    bg: "rgba(10,20,40,0.94)",
  });
  voiceTag.billboardMode = Mesh.BILLBOARDMODE_Y;
  voiceTag.position.set(cara.x + 2.3, y + 2.25, caraZ + 1.95);

  const theo = STATIONS["lead-1"];
  const chatRing = MeshBuilder.CreateTorus("v2_groupChat", { diameter: 5.4, thickness: 0.08, tessellation: 40 }, scene);
  chatRing.position.set(theo.x, y + 3.2, theo.z + 0.2);
  kit.finish(chatRing, root, kit.mat("#14b8a6", { unlit: true }), true);
  const chatTag = kit.label(root, {
    lines: [{ text: "group chat", size: 40, weight: 700, color: "#99f6e4" }],
    width: 1.9,
    px: 320,
    pxHeight: 70,
    bg: "rgba(10,20,40,0.94)",
  });
  chatTag.billboardMode = Mesh.BILLBOARDMODE_Y;
  chatTag.position.set(theo.x - 2.5, y + 3.4, theo.z + 0.2);

  /* ---------------- The Member Case hub ---------------- */
  kit.cyl(root, HUB.x, y, HUB.z, HUB_R * 2, 0.7, darkSteel, { tess: 24 });
  const hubRingFloor = MeshBuilder.CreateTorus("v2_hubFloorRing", { diameter: 2.4, thickness: 0.1, tessellation: 32 }, scene);
  hubRingFloor.position.set(HUB.x, y + 0.72, HUB.z);
  kit.finish(hubRingFloor, root, kit.mat("#ffc35a", { unlit: true }));
  const hub = new TransformNode("v2_memberCase", scene);
  hub.parent = root;
  hub.position.set(HUB.x, y + 1.9, HUB.z);
  const caseCube = kit.block(hub, 0, -0.55, 0, 1.1, 1.1, 1.1, kit.mat("#ffc35a", { emissive: 0.55 }), {
    dynamic: true,
  });
  kit.block(caseCube, 0.22, 0.55, 0, 0.5, 0.14, 0.9, kit.mat("#fff1c9", { emissive: 0.6 }), { dynamic: true });
  const hubRings = [1.9, 2.5].map((d, i) => {
    const ring = MeshBuilder.CreateTorus(`v2_hubRing${i}`, { diameter: d, thickness: 0.07, tessellation: 40 }, scene);
    kit.finish(ring, hub, kit.mat("#5ce1ff", { unlit: true }), true);
    return ring;
  });
  const hubTag = kit.label(root, {
    lines: [
      { text: "MEMBER CASE", size: 52, weight: 800, color: "#ffd98a" },
      { text: "the one record every agent shares", size: 30, weight: 500, color: "#c6d2e6" },
    ],
    width: 4.2,
    px: 560,
    bg: "rgba(10,20,40,0.94)",
  });
  hubTag.billboardMode = Mesh.BILLBOARDMODE_Y;
  hubTag.position.set(HUB.x, y + 3.75, HUB.z);
  anchors.set("hub", { node: hub, group: "agents", dy: 0 });

  /* ---------------- Data packets ---------------- */
  const packetMat = kit.mat("#ffffff", { unlit: true });
  const packets: Packet[] = [];
  for (const [i, p] of STAFF_PERSONAS.entries()) {
    const st = STATIONS[p.id];
    const cz = st.z + 0.2;
    const edge = st.z < 0 ? cz + POD_D / 2 : cz - POD_D / 2;
    const py = y + 0.2;
    const path = dedupe([
      new Vector3(HUB.x, py, HUB.z + HUB_R),
      new Vector3(HUB.x, py, BUS_Z),
      new Vector3(st.x, py, BUS_Z),
      new Vector3(st.x, py, edge),
    ]);
    let length = 0;
    for (let k = 1; k < path.length; k++) length += Vector3.Distance(path[k - 1], path[k]);
    for (let j = 0; j < 2; j++) {
      const mesh = kit.block(root, 0, 0, 0, 0.28, 0.16, 0.28, packetMat, { dynamic: true });
      packets.push({ mesh, path, length, speed: 3 + (i % 3) * 0.6, offset: j * 0.5 + i * 0.13 });
    }
  }

  kit.useBatch(null);
  batch.flush();

  let selected: ReadonlySet<string> = new Set();
  let linked: ReadonlySet<string> = new Set();
  const lit = (id: string): boolean => selected.has(id) || linked.has(id);
  let introT = -1;
  const pointOnPath = (pk: Packet, f: number, out: Vector3): void => {
    // Ping-pong along the polyline so packets go out to the bay and come back.
    const u = f < 0.5 ? f * 2 : 2 - f * 2;
    let d = u * pk.length;
    for (let k = 1; k < pk.path.length; k++) {
      const seg = Vector3.Distance(pk.path[k - 1], pk.path[k]);
      if (d <= seg || k === pk.path.length - 1) {
        Vector3.LerpToRef(pk.path[k - 1], pk.path[k], seg > 0 ? Math.min(1, d / seg) : 1, out);
        return;
      }
      d -= seg;
    }
  };
  const tmp = new Vector3();
  const deskRobot = robots.find((rb) => rb.role.id === DESK_ROLE);
  const byRole = new Map(robots.map((rb) => [rb.role.id, rb]));
  // The front desk wants the Form Extraction agent; `deskPinned` says whether it has been sent.
  let deskCalled = false;
  let deskPinned = false;
  const sendToDesk = (): void => {
    deskRobot?.wanderer.pin({ spot: deskSpot, task: "Reading forms at the front desk", where: "the front desk", dwell: Infinity });
    deskPinned = true;
  };

  return {
    id: "agents",
    root,
    tag,
    anchors,
    update(dt: number, t: number): void {
      if (introT >= 0) introT += dt;
      const lifted = Math.abs(root.position.y) > 0.5;
      // Called while the floor was out of the way: go now it is back in place.
      if (deskCalled && !deskPinned && !lifted) sendToDesk();
      pods.forEach((pod, i) => {
        const on = lit(pod.id);
        // Bays power up one after another during the chapter intro.
        pod.power = introT >= 0 ? Math.min(1, Math.max(0, (introT - i * 0.18) / 0.5)) : 1;
        const glow = (0.12 + 0.28 * pod.power) * (on ? 1.6 : 1);
        pod.pad.emissiveColor.copyFrom(pod.padBase).scaleInPlace(glow);
        if (on) pod.ring.scaling.setAll(1 + Math.sin(t * 5) * 0.05);
      });
      if (introT > 3) introT = -1;
      let uplinkBusy = false;
      for (const rb of robots) {
        // A level moved out of the way takes its robots with it, so call in any that are out on the deck.
        if (lifted && rb.node.position.z < walls.z0 - 0.2) {
          rb.wanderer.snapHome();
          if (rb === deskRobot) deskPinned = false;
        }
        rb.wanderer.update(dt);
        const working = selected.has(rb.role.staffId) && rb.wanderer.isHome;
        if (rb.walking) {
          rb.node.position.y = y + 0.14 + Math.sin(t * 11 + rb.phase) * 0.04;
          rb.node.rotation.x = -0.1;
        } else {
          const amp = working ? 0.3 : 0.05;
          rb.node.position.y = y + Math.abs(Math.sin(t * (working ? 5 : 1.8) + rb.phase)) * amp;
          rb.node.rotation.x = 0;
        }
        rb.tip.scaling.setAll(1 + 0.35 * Math.sin(t * 5 + rb.phase));
        if (rb.ring.isEnabled()) rb.ring.scaling.setAll(1 + Math.sin(t * 5) * 0.06);
        if (!rb.walking && Math.abs(rb.node.position.z - UPLINK.z) < 0.4 && Math.abs(Math.abs(rb.node.position.x) - 1.5) < 0.2) {
          uplinkBusy = true;
        }
      }
      uplinkBeam.setEnabled(uplinkBusy);
      if (uplinkBusy) uplinkBeam.scaling.x = uplinkBeam.scaling.z = 1 + Math.sin(t * 6) * 0.08;
      uplinkRing.scaling.setAll(1 + Math.sin(t * 2) * 0.03);
      hub.rotation.y = t * 0.8;
      caseCube.rotation.y = t * 0.6;
      caseCube.position.y = Math.sin(t * 1.8) * 0.12;
      hubRings[0].rotation.x = t * 1.1;
      hubRings[1].rotation.z = t * 0.9;
      for (const pk of packets) {
        const f = ((t * pk.speed) / (pk.length * 2) + pk.offset) % 1;
        pointOnPath(pk, f, tmp);
        pk.mesh.position.copyFrom(tmp);
      }
      eqBars.forEach((bar, i) => {
        bar.scaling.y = 0.4 + Math.abs(Math.sin(t * (4 + i * 0.7) + i)) * 1.4;
        bar.position.y = y + 0.1 + bar.scaling.y / 2;
      });
      chatRing.rotation.y = t * 0.6;
      chatRing.position.y = y + 3.2 + Math.sin(t * 1.5) * 0.1;
    },
    setHighlights(h: Highlights): void {
      selected = h.agents;
      for (const pod of pods) pod.ring.setEnabled(lit(pod.id));
      for (const rb of robots) {
        rb.ring.setEnabled(h.roles.has(rb.role.id));
        // A bay that is selected, or working on the finale's request, calls its team home to work.
        rb.wanderer.hold(selected.has(rb.role.staffId));
      }
    },
    intro(): void {
      introT = 0;
    },
    callToDesk(): void {
      deskCalled = true;
      if (Math.abs(root.position.y) <= 0.5) sendToDesk();
    },
    releaseDesk(): void {
      deskCalled = false;
      if (deskPinned) deskRobot?.wanderer.release();
      deskPinned = false;
    },
    deskReady(): boolean {
      if (!deskRobot) return true;
      const p = deskRobot.node.position;
      return !deskRobot.wanderer.walking && Math.hypot(p.x - deskSpot.at[0], p.z - deskSpot.at[1]) < 0.3;
    },
    roleTask(id: string): string | null {
      return byRole.get(id)?.wanderer.task ?? null;
    },
    setLinked(ids: ReadonlySet<string>): void {
      linked = ids;
      for (const pod of pods) pod.ring.setEnabled(lit(pod.id));
    },
  };
}
