/**
 * Lower level · The Engine Room — Microsoft IQ and the Azure services under
 * the waterline, behind a glass wall onto the lake.
 *
 * Microsoft Foundry sits in the middle as a glowing core that runs every
 * agent. Behind it, on a raised deck, is Microsoft IQ, the context layer
 * every agent shares: Work IQ, Fabric IQ, Foundry IQ and Web IQ. Around
 * them are the Azure services: along the glass, the tools and channels that
 * particular agents call (Content Understanding, Voice Live, Teams approvals
 * and MCP tools), and behind, the platform (Entra ID, the network, Key
 * Vault, Storage, App Service and Application Insights). Floor traces carry
 * pulses of data to and from the core.
 */
import { Color3, Mesh, MeshBuilder, StandardMaterial, Texture, TransformNode, Vector3 } from "@babylonjs/core";
import { Batch, Kit, rng } from "../kit";
import { INFRA, TIERS, infraInfo, levelInfo, type InfraId } from "../lakehouseData";
import { FLOOR_Y, SLABS, WALLS } from "../layout";
import { buildShell } from "../shell";
import type { Anchor, Highlights, LevelBuild } from "../types";

interface Place {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  /** Where the floor trace ends. */
  tx: number;
  tz: number;
  /** Stands on the Microsoft IQ deck. */
  deck?: boolean;
}

/** The raised Microsoft IQ deck behind Foundry. */
const DECK = { x0: -12, x1: 12, z0: 2.3, z1: 7.7, h: 0.6 };
/** IQ traces run along the front of the deck, then drop into the back of Foundry. */
const MANIFOLD_Z = 2.75;
const FOUNDRY_BACK = 0.7;
const BUS_Z = -2.5;
const GOLD = "#ffe08a";

const PLACES: Record<InfraId, Place> = {
  foundry: { x: 0, z: -2.5, w: 6.4, d: 6.4, h: 4.8, tx: 0, tz: -2.5 },
  // Microsoft IQ, on the deck.
  workiq: { x: -9.3, z: 5.2, w: 3.8, d: 2.2, h: 3.4, tx: -9.3, tz: 4.1, deck: true },
  fabriciq: { x: -4.4, z: 5.2, w: 3.2, d: 3.0, h: 3.6, tx: -4.4, tz: 3.7, deck: true },
  foundryiq: { x: 4.4, z: 5.4, w: 4.4, d: 1.6, h: 3.9, tx: 4.4, tz: 4.6, deck: true },
  webiq: { x: 9.3, z: 5.2, w: 2.4, d: 2.4, h: 5.2, tx: 9.3, tz: 4.0, deck: true },
  // Along the glass: the services particular agents call.
  content: { x: -14.2, z: -8.0, w: 5.2, d: 1.6, h: 2.9, tx: -14.2, tz: -7.2 },
  voice: { x: -6.4, z: -8.8, w: 2.6, d: 1.6, h: 2.8, tx: -6.4, tz: -8.0 },
  teams: { x: 6.4, z: -8.4, w: 3.0, d: 1.6, h: 2.8, tx: 6.4, tz: -7.6 },
  mcp: { x: 14.2, z: -8.6, w: 4.4, d: 0.8, h: 3.5, tx: 14.2, tz: -8.2 },
  // Behind the bus: the platform.
  identity: { x: -14.6, z: 5.6, w: 3.2, d: 1.2, h: 3.2, tx: -14.6, tz: 5.0 },
  network: { x: -11.2, z: 0.2, w: 4.4, d: 1.2, h: 3.6, tx: -11.2, tz: -0.4 },
  vault: { x: -6.4, z: 0.0, w: 3.6, d: 1.2, h: 3.6, tx: -6.4, tz: -0.6 },
  storage: { x: 6.6, z: 0.2, w: 3.6, d: 2.0, h: 2.8, tx: 6.6, tz: -0.8 },
  apps: { x: 11.6, z: 0.0, w: 4.4, d: 1.4, h: 3.9, tx: 11.6, tz: -0.7 },
  monitor: { x: 16.4, z: 7.3, w: 5.0, d: 0.8, h: 3.6, tx: 16.4, tz: 6.6 },
};

interface Pulse {
  mesh: Mesh;
  path: Vector3[];
  length: number;
  speed: number;
  offset: number;
}

type Paint = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

/** The three Work IQ tiles: a document, a chat and a meeting. */
const WORK_TILES: Paint[] = [
  (ctx, w, h) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#2b6cd4";
    ctx.fillRect(0, 0, w, 46);
    ctx.fillStyle = "#ffffff";
    ctx.font = '800 26px "Segoe UI", sans-serif';
    ctx.fillText("DOC", 16, 32);
    ctx.fillStyle = "#cbd5e1";
    for (let i = 0; i < 6; i++) ctx.fillRect(16, 70 + i * 26, i % 3 === 2 ? 104 : 166, 11);
  },
  (ctx, w, h) => {
    ctx.fillStyle = "#f5f3ff";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#6264a7";
    ctx.fillRect(0, 0, w, 46);
    ctx.fillStyle = "#ffffff";
    ctx.font = '800 26px "Segoe UI", sans-serif';
    ctx.fillText("CHAT", 16, 32);
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(14, 66, 128, 40);
    ctx.fillStyle = "#8b8cc7";
    ctx.fillRect(58, 120, 128, 40);
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(14, 174, 104, 40);
  },
  (ctx, w, h) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#0f6cbd";
    ctx.fillRect(0, 0, w, 46);
    ctx.fillStyle = "#ffffff";
    ctx.font = '800 26px "Segoe UI", sans-serif';
    ctx.fillText("MEETING", 16, 32);
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 2;
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) ctx.strokeRect(14 + c * 43, 62 + r * 42, 43, 42);
    ctx.fillStyle = "#fb7185";
    ctx.fillRect(59, 106, 41, 80);
  },
];

export function buildEngineLevel(kit: Kit): LevelBuild {
  const scene = kit.scene;
  const root = new TransformNode("v2_lvl_engine", scene);
  const batch = new Batch(root, "engine");
  kit.useBatch(batch);
  const y = FLOOR_Y.engine;
  const yd = y + DECK.h;
  const info = levelInfo("engine");
  const r = rng(11);

  // Circuit-board floor.
  const circuit = kit.canvas("v2_circuit", 256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#0e1526";
    ctx.fillRect(0, 0, w, h);
    const rr = rng(5);
    ctx.strokeStyle = "rgba(124,108,240,0.35)";
    ctx.lineWidth = 3;
    for (let i = 0; i < 14; i++) {
      const x = Math.floor(rr() * 8) * 32 + 16;
      const y0 = Math.floor(rr() * 8) * 32 + 16;
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y0 + 32 + Math.floor(rr() * 3) * 32);
      ctx.lineTo(x + 32 + Math.floor(rr() * 3) * 32, y0 + 96);
      ctx.stroke();
      ctx.fillStyle = "rgba(167,139,250,0.55)";
      ctx.fillRect(x - 5, y0 - 5, 10, 10);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, w, h);
  });
  circuit.wrapU = Texture.WRAP_ADDRESSMODE;
  circuit.wrapV = Texture.WRAP_ADDRESSMODE;
  const floorMat = new StandardMaterial("v2_circuitMat", scene);
  floorMat.diffuseTexture = circuit;
  floorMat.emissiveColor = new Color3(0.55, 0.55, 0.65);
  floorMat.specularColor = Color3.Black();
  const height = -0.2 - y;
  const { tag } = buildShell(kit, {
    root,
    level: info,
    floorY: y,
    slab: SLABS.engine,
    walls: WALLS.engine,
    floor: floorMat,
    back: kit.mat("#ffffff", { texture: "concrete" }),
    open: ["front"],
    height,
    tagAt: [-25.8, y + 2.8, -16.5],
  });

  // The frameless glass wall onto the lake: kept faint and matte so the room stays crisp.
  const concrete = kit.mat("#ffffff", { texture: "concrete" });
  const steel = kit.mat("#2b3240", { specular: 0.25 });
  const fz = (SLABS.engine.z0 + WALLS.engine.z0) / 2 - 0.2;
  kit.block(root, 0, y, fz, 40.8, 0.4, 0.4, concrete);
  kit.block(root, 0, y + 0.4, fz, 40, 4.6, 0.12, kit.mat("#9fe3ff", { alpha: 0.1, specular: 0.15 }));
  kit.block(root, 0, y + 5.0, fz, 40.8, height - 5.0, 0.4, concrete);

  const darkSteel = kit.mat("#1e2433", { specular: 0.3 });
  const rack = kit.mat("#1b2030", { specular: 0.2 });
  const walnut = kit.mat("#ffffff", { texture: "walnut" });
  const violet = kit.mat("#a78bfa", { unlit: true });
  const glowOf = (id: InfraId): StandardMaterial => kit.mat(infraInfo(id).color, { unlit: true });

  // Blinking LEDs: four merged groups toggled in turn.
  const ledBatch = new Batch(root, "engine_leds");
  const ledMats = ["#34d399", "#5ce1ff", "#fbbf24", "#34d399"].map((hex, i) =>
    kit.mat(hex, { unlit: true, specular: 0.01 * (i + 1) }),
  );
  const led = (x: number, ly: number, z: number, w = 0.14, h = 0.1, d = 0.05): void => {
    const prev = kit.useBatch(ledBatch);
    kit.block(root, x, ly, z, w, h, d, ledMats[Math.floor(r() * ledMats.length)]);
    kit.useBatch(prev);
  };

  /* ---------------- The Microsoft IQ deck ---------------- */
  const iqColor = TIERS.iq.color;
  const deckTex = kit.canvas("v2_iqDeck", 128, 128, (ctx, w, h) => {
    ctx.fillStyle = "#2c2a5c";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(240,171,252,0.75)";
    ctx.fillRect(w / 2 - 6, h / 2 - 6, 12, 12);
    ctx.strokeStyle = "rgba(232,121,249,0.3)";
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, w, h);
  });
  deckTex.wrapU = Texture.WRAP_ADDRESSMODE;
  deckTex.wrapV = Texture.WRAP_ADDRESSMODE;
  const deckMat = new StandardMaterial("v2_iqDeckMat", scene);
  deckMat.diffuseTexture = deckTex;
  deckMat.emissiveColor = new Color3(0.62, 0.6, 0.75);
  deckMat.specularColor = Color3.Black();
  const deckW = DECK.x1 - DECK.x0;
  const deckD = DECK.z1 - DECK.z0;
  const deckX = (DECK.x0 + DECK.x1) / 2;
  const deckZ = (DECK.z0 + DECK.z1) / 2;
  kit.block(root, deckX, y, deckZ, deckW, DECK.h, deckD, deckMat, { tile: 1.5 });
  const deckEdge = kit.mat(iqColor, { unlit: true });
  kit.block(root, deckX, y + DECK.h - 0.16, DECK.z0 - 0.03, deckW + 0.06, 0.14, 0.06, deckEdge);
  kit.block(root, DECK.x0 - 0.03, y + DECK.h - 0.16, deckZ, 0.06, 0.14, deckD, deckEdge);
  kit.block(root, DECK.x1 + 0.03, y + DECK.h - 0.16, deckZ, 0.06, 0.14, deckD, deckEdge);
  // The tier signs: Microsoft IQ stands on its deck, and the Azure services sign is on the side wall.
  const iqSign = kit.label(root, {
    lines: [
      { text: TIERS.iq.name.toUpperCase(), size: 64, weight: 800, color: iqColor },
      { text: TIERS.iq.tagline, size: 30, weight: 500, color: "#f5d0fe" },
    ],
    width: 4.0,
    px: 640,
    bg: "rgba(10,14,30,0.94)",
    accent: iqColor,
    bar: "top",
  });
  iqSign.billboardMode = Mesh.BILLBOARDMODE_Y;
  iqSign.position.set(0, yd + 2.5, 5.2);
  const azureSign = kit.label(root, {
    lines: [
      { text: TIERS.azure.name.toUpperCase(), size: 64, weight: 800, color: TIERS.azure.color },
      { text: TIERS.azure.tagline, size: 32, weight: 500, color: "#c6d2e6" },
    ],
    width: 6.0,
    px: 768,
    bg: "rgba(10,14,30,0.94)",
    accent: TIERS.azure.color,
    bar: "top",
  });
  azureSign.rotation.y = -Math.PI / 2;
  azureSign.position.set(WALLS.engine.x0 + 0.32, y + 3.0, -3.6);

  /* ---------------- Component nodes, labels, rings and hitboxes ---------------- */
  const nodes = new Map<InfraId, TransformNode>();
  const rings = new Map<InfraId, Mesh>();
  const anchors = new Map<string, Anchor>();
  const spinners: Array<(t: number, dt: number) => void> = [];

  for (const comp of INFRA) {
    const p = PLACES[comp.id];
    const base = p.deck ? yd : y;
    const node = new TransformNode(`v2_infra_${comp.id}`, scene);
    node.parent = root;
    node.position.set(p.x, base, p.z);
    nodes.set(comp.id, node);
    anchors.set(`infra:${comp.id}`, { node, group: "engine", dy: Math.min(3, p.h * 0.6) });
    const label = kit.label(root, {
      lines: [
        { text: comp.sign, size: 48, weight: 800, color: comp.color },
        { text: comp.tag, size: 32, weight: 500, color: "#d4dcef" },
      ],
      width: comp.id === "foundry" ? 6.0 : 4.6,
      px: 560,
      bg: "rgba(10,14,30,0.94)",
      accent: comp.color,
      bar: "top",
    });
    label.billboardMode = Mesh.BILLBOARDMODE_Y;
    // Keep the label under the Level 1 slab so it never pokes through the floor above.
    label.position.set(p.x, Math.min(base + p.h + 0.9, y + height - 0.8), p.z);
    const ringD = Math.max(p.w, p.d) + 1.6;
    const ring = MeshBuilder.CreateTorus(`v2_infraRing_${comp.id}`, { diameter: ringD, thickness: 0.16, tessellation: 40 }, scene);
    ring.position.set(p.x, base + 0.12, p.z);
    kit.finish(ring, root, kit.mat(GOLD, { unlit: true }), true);
    ring.setEnabled(false);
    rings.set(comp.id, ring);
    kit.hitbox(root, p.x, base, p.z, Math.max(1.6, p.w), p.h, Math.max(1.6, p.d), { type: "infra", id: comp.id });
  }
  // Beams to Microsoft IQ as a whole land on the deck, just under its sign.
  const iqHub = new TransformNode("v2_iqHub", scene);
  iqHub.parent = root;
  iqHub.position.set(0, yd, 5.2);
  anchors.set("iq", { node: iqHub, group: "engine", dy: 1.3 });

  const at = (id: InfraId): Place => PLACES[id];

  /* ---------------- Microsoft Foundry: the core ---------------- */
  {
    const p = at("foundry");
    const node = nodes.get("foundry")!;
    kit.cyl(root, p.x, y, p.z, 6.4, 0.4, darkSteel, { tess: 32 });
    const inlay = MeshBuilder.CreateTorus("v2_foundryInlay", { diameter: 5.6, thickness: 0.12, tessellation: 48 }, scene);
    inlay.position.set(p.x, y + 0.42, p.z);
    kit.finish(inlay, root, violet);
    kit.cyl(root, p.x, y + 0.4, p.z, 3.0, 4.0, kit.mat("#d9ccff", { alpha: 0.16, specular: 0.8 }), { tess: 24, dynamic: true });
    kit.cyl(root, p.x, y + 4.4, p.z, 3.3, 0.3, darkSteel, { tess: 32 });
    const core = kit.cyl(node, 0, 0.6, 0, 1.3, 3.4, kit.mat("#b39cff", { unlit: true }), { tess: 16, dynamic: true });
    const coreRings = [1.3, 2.3, 3.3].map((ry, i) => {
      const ring = MeshBuilder.CreateTorus(`v2_coreRing${i}`, { diameter: i === 1 ? 2.7 : 2.3, thickness: 0.09, tessellation: 40 }, scene);
      ring.position.y = ry;
      kit.finish(ring, node, kit.mat("#e9d5ff", { unlit: true }), true);
      return ring;
    });
    kit.cyl(root, p.x, y + 4.7, p.z, 1.0, height - 4.7, kit.mat("#c4b5fd", { unlit: true, alpha: 0.28 }), { tess: 16, dynamic: true });
    spinners.push((t) => {
      core.scaling.x = core.scaling.z = 1 + Math.sin(t * 3) * 0.08;
      coreRings.forEach((ring, i) => {
        ring.rotation.x = Math.sin(t * 0.9 + i) * 0.5;
        ring.rotation.z = Math.cos(t * 0.7 + i * 2) * 0.5;
      });
    });
  }

  /* ---------------- Work IQ: documents, chats and meetings ---------------- */
  {
    const p = at("workiq");
    const node = nodes.get("workiq")!;
    kit.block(root, p.x, yd, p.z, 3.8, 0.5, 2.2, darkSteel);
    kit.block(root, p.x, yd + 0.2, p.z - 1.11, 3.4, 0.1, 0.02, glowOf("workiq"));
    kit.block(root, p.x, yd + 0.5, p.z + 0.55, 3.8, 2.9, 0.08, kit.mat("#ffd1dc", { alpha: 0.14, specular: 0.6 }));
    const tiles = WORK_TILES.map((paint, i) => {
      const tex = kit.canvas(`v2_workTile${i}`, 200, 240, paint);
      const plane = MeshBuilder.CreatePlane(`v2_workTilePlane${i}`, { width: 1.05, height: 1.26 }, scene);
      plane.position.set((i - 1) * 1.2, 1.95, -0.1);
      kit.finish(plane, node, kit.screen(tex), true);
      return plane;
    });
    const orbit = new TransformNode("v2_workOrbit", scene);
    orbit.parent = node;
    orbit.position.y = 1.9;
    const dot = glowOf("workiq");
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      kit.block(orbit, Math.cos(a) * 2.05, -0.08, Math.sin(a) * 1.0, 0.16, 0.16, 0.16, dot, { dynamic: true });
    }
    spinners.push((t) => {
      tiles.forEach((m, i) => {
        m.position.y = 1.95 + Math.sin(t * 1.4 + i * 1.9) * 0.12;
      });
      orbit.rotation.y = t * 0.6;
    });
  }

  /* ---------------- Fabric IQ: the business as a data lattice ---------------- */
  {
    const p = at("fabriciq");
    const node = nodes.get("fabriciq")!;
    kit.block(root, p.x, yd, p.z, 3.2, 0.5, 3.0, darkSteel);
    kit.block(root, p.x, yd + 0.2, p.z - 1.51, 2.8, 0.1, 0.02, glowOf("fabriciq"));
    kit.block(root, p.x, yd + 0.5, p.z, 2.9, 2.9, 2.7, kit.mat("#bbf7d0", { alpha: 0.1, specular: 0.7 }));
    kit.block(root, p.x, yd + 3.4, p.z, 3.1, 0.2, 2.9, darkSteel);
    // Entities (nodes) and their relationships (edges), built at the origin then parented.
    const lattice = new TransformNode("v2_fabricLattice", scene);
    const lb = new Batch(lattice, "fabric_lattice");
    const prev = kit.useBatch(lb);
    const entity = kit.mat(infraInfo("fabriciq").color, { emissive: 0.6 });
    const hub = kit.mat("#f0fdf4", { emissive: 0.7 });
    const edge = kit.mat("#d1fae5", { emissive: 0.45 });
    const s = 0.64;
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        for (let k = -1; k <= 1; k++) {
          const centre = i === 0 && j === 0 && k === 0;
          const n = centre ? 0.34 : 0.22;
          kit.block(lattice, i * s, j * s - n / 2, k * s, n, n, n, centre ? hub : entity);
          if (i < 1) kit.block(lattice, (i + 0.5) * s, j * s - 0.03, k * s, s, 0.06, 0.06, edge);
          if (j < 1) kit.block(lattice, i * s, j * s, k * s, 0.06, s, 0.06, edge);
          if (k < 1) kit.block(lattice, i * s, j * s - 0.03, (k + 0.5) * s, 0.06, 0.06, s, edge);
        }
      }
    }
    kit.useBatch(prev);
    lb.flush();
    lattice.parent = node;
    lattice.position.y = 1.95;
    spinners.push((t) => {
      lattice.rotation.y = t * 0.45;
      lattice.rotation.x = Math.sin(t * 0.4) * 0.3;
    });
  }

  /* ---------------- Foundry IQ: shelves of indexed documents ---------------- */
  {
    const p = at("foundryiq");
    const docMats = ["#a78bfa", "#ddd6fe", "#f5f3ff", "#c4b5fd"].map((hex) => kit.mat(hex, { emissive: 0.45 }));
    for (const side of [-1, 1]) {
      const sx = p.x + side * 1.12;
      kit.block(root, sx, yd, p.z + 0.2, 2.2, 3.9, 1.2, walnut);
      for (let row = 0; row < 4; row++) {
        for (let k = 0; k < 6; k++) {
          const dh = 0.45 + r() * 0.25;
          kit.block(root, sx - 0.83 + k * 0.33, yd + 0.2 + row * 0.92, p.z - 0.42, 0.24, dh, 0.6, docMats[Math.floor(r() * docMats.length)]);
        }
      }
    }
    const scan = kit.block(nodes.get("foundryiq")!, 0, 0.1, -0.78, 0.1, 3.7, 0.05, kit.mat("#ede9fe", { unlit: true }), {
      dynamic: true,
    });
    spinners.push((t) => {
      scan.position.x = Math.sin(t * 0.8) * 2.1;
    });
  }

  /* ---------------- Web IQ: the globe and the antenna ---------------- */
  {
    const p = at("webiq");
    const node = nodes.get("webiq")!;
    kit.cyl(root, p.x, yd, p.z, 2.4, 0.3, darkSteel, { tess: 20 });
    kit.cyl(root, p.x, yd + 0.3, p.z - 0.5, 0.5, 0.35, steel, { tess: 10 });
    kit.cyl(root, p.x, yd, p.z + 0.55, 0.3, height - DECK.h, steel, { tess: 8 });
    const globe = new TransformNode("v2_webGlobe", scene);
    const gb = new Batch(globe, "web_globe");
    const prev = kit.useBatch(gb);
    const sea = kit.mat(infraInfo("webiq").color, { emissive: 0.5 });
    const land = kit.mat("#e0f2fe", { emissive: 0.5 });
    const gs = 0.22;
    for (let i = -4; i <= 4; i++) {
      for (let j = -4; j <= 4; j++) {
        for (let k = -4; k <= 4; k++) {
          const q = (i * i + j * j + k * k) / 16;
          if (q > 1 || q < 0.55) continue;
          const isLand = (Math.abs(i * 3 + j * 5 + k * 7) % 4 === 0 || (j > 1 && i < 0)) && Math.abs(j) < 4;
          kit.block(globe, i * gs, j * gs - gs / 2, k * gs, gs * 0.92, gs * 0.92, gs * 0.92, isLand ? land : sea);
        }
      }
    }
    kit.useBatch(prev);
    gb.flush();
    globe.parent = node;
    globe.position.set(0, 1.55, -0.5);
    const web = MeshBuilder.CreateTorus("v2_webRing", { diameter: 2.5, thickness: 0.05, tessellation: 40 }, scene);
    web.parent = node;
    web.position.set(0, 1.55, -0.5);
    web.rotation.x = 1.1;
    kit.finish(web, node, glowOf("webiq"), true);
    const dish = new TransformNode("v2_webDish", scene);
    dish.parent = node;
    dish.position.set(0, 3.7, 0.55);
    const cone = kit.cyl(dish, 0, -0.3, 0, 0.3, 0.6, kit.mat("#e5e7eb", { specular: 0.4 }), { top: 2.2, tess: 20, dynamic: true });
    cone.rotation.x = -0.9;
    const blink = kit.block(node, 0, 4.65, 0.55, 0.28, 0.28, 0.28, kit.mat("#ef4444", { unlit: true }), { dynamic: true });
    spinners.push((t) => {
      globe.rotation.y = t * 0.5;
      web.rotation.z = t * 0.8;
      dish.rotation.y = Math.sin(t * 0.4) * 1.2;
      blink.setEnabled(Math.sin(t * 4) > 0);
    });
  }

  /* ---------------- Content Understanding: the document scanner ---------------- */
  {
    const p = at("content");
    const node = nodes.get("content")!;
    kit.block(root, p.x, y, p.z, 5.2, 0.9, 1.4, darkSteel);
    kit.block(root, p.x, y + 0.9, p.z, 5.0, 0.04, 1.2, kit.mat("#111827"));
    kit.block(root, p.x - 0.95, y + 0.9, p.z, 0.22, 1.8, 1.5, steel);
    kit.block(root, p.x + 0.95, y + 0.9, p.z, 0.22, 1.8, 1.5, steel);
    kit.block(root, p.x, y + 2.7, p.z, 2.2, 0.25, 1.6, steel);
    const scanMat = kit.mat("#fb923c", { unlit: true, alpha: 0.45 });
    const beam = kit.block(node, 0, 0.94, 0, 0.06, 1.76, 1.3, scanMat, { dynamic: true });
    const docs = [0, 1, 2].map(() => kit.block(node, 0, 0.94, 0, 0.8, 0.05, 1.0, kit.mat("#ffffff"), { dynamic: true }));
    spinners.push((t) => {
      beam.scaling.x = 1 + Math.abs(Math.sin(t * 6)) * 2;
      docs.forEach((doc, i) => {
        doc.position.x = ((t * 0.9 + i * 1.7) % 5.1) - 2.55;
      });
    });
  }

  /* ---------------- Entra ID: the identity gate beside the lift ---------------- */
  {
    const p = at("identity");
    const node = nodes.get("identity")!;
    const yellow = kit.mat("#facc15", { unlit: true });
    for (const side of [-1, 1]) {
      kit.block(root, p.x + side * 1.3, y, p.z, 0.5, 2.9, 0.9, steel);
      kit.block(root, p.x + side * 1.3, y + 0.3, p.z - 0.47, 0.1, 2.3, 0.05, yellow);
    }
    kit.block(root, p.x, y + 2.9, p.z, 3.1, 0.3, 0.9, steel);
    const key = new TransformNode("v2_key", scene);
    key.parent = node;
    key.position.y = 1.6;
    const gold = kit.mat("#fde68a", { emissive: 0.6 });
    const bow = MeshBuilder.CreateTorus("v2_keyBow", { diameter: 0.7, thickness: 0.16, tessellation: 20 }, scene);
    bow.rotation.x = Math.PI / 2;
    bow.position.x = -0.5;
    kit.finish(bow, key, gold, true);
    kit.block(key, 0.25, -0.07, 0, 0.9, 0.14, 0.14, gold, { dynamic: true });
    kit.block(key, 0.55, -0.3, 0, 0.12, 0.25, 0.14, gold, { dynamic: true });
    kit.block(key, 0.35, -0.26, 0, 0.12, 0.2, 0.14, gold, { dynamic: true });
    kit.block(root, p.x + 2.05, y, p.z - 0.3, 0.2, 1.3, 0.2, steel);
    kit.block(root, p.x + 2.05, y + 1.3, p.z - 0.3, 0.4, 0.5, 0.16, darkSteel);
    kit.block(root, p.x + 2.05, y + 1.45, p.z - 0.4, 0.24, 0.2, 0.04, kit.mat("#34d399", { unlit: true }));
    spinners.push((t) => {
      key.rotation.y = t * 1.2;
      key.position.y = 1.6 + Math.sin(t * 2) * 0.12;
    });
  }

  /* ---------------- Key Vault: the vault door ---------------- */
  {
    const p = at("vault");
    const node = nodes.get("vault")!;
    kit.block(root, p.x, y, p.z + 0.2, 3.6, 3.6, 0.6, darkSteel);
    const door = kit.cyl(root, p.x, y + 1.8 - 0.2, p.z - 0.2, 3.0, 0.4, kit.mat("#8a94a6", { specular: 0.6 }), { tess: 28 });
    door.rotation.x = Math.PI / 2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      kit.block(root, p.x + Math.cos(a) * 1.25, y + 1.8 + Math.sin(a) * 1.25 - 0.1, p.z - 0.44, 0.2, 0.2, 0.1, steel);
    }
    const wheel = new TransformNode("v2_vaultWheel", scene);
    wheel.parent = node;
    wheel.position.set(0, 1.8, -0.5);
    const wheelMat = kit.mat("#cbd5e1", { specular: 0.6 });
    const rim = MeshBuilder.CreateTorus("v2_wheelRim", { diameter: 1.3, thickness: 0.12, tessellation: 24 }, scene);
    rim.rotation.x = Math.PI / 2;
    kit.finish(rim, wheel, wheelMat, true);
    for (let i = 0; i < 3; i++) {
      kit.block(wheel, 0, -0.06, 0, 1.3, 0.12, 0.1, wheelMat, { dynamic: true }).rotation.z = (i * Math.PI) / 3;
    }
    spinners.push((t) => {
      wheel.rotation.z = Math.sin(t * 0.5) * 0.8;
    });
  }

  /* ---------------- Network: the patch panel ---------------- */
  {
    const p = at("network");
    kit.block(root, p.x, y, p.z + 0.1, 4.4, 3.6, 1.2, rack);
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 12; col++) {
        led(p.x - 1.87 + col * 0.34, y + 0.6 + row * 0.45, p.z - 0.53, 0.16, 0.12, 0.05);
      }
    }
    const cable = kit.mat("#22d3ee", { emissive: 0.7 });
    for (let i = 0; i < 5; i++) kit.block(root, p.x - 1.8 + i * 0.9, y + 3.6, p.z + 0.1, 0.1, height - 3.6, 0.1, cable);
  }

  /* ---------------- Storage: stacked containers ---------------- */
  {
    const p = at("storage");
    const crate = kit.mat("#0f766e");
    const band = kit.mat("#34d399", { unlit: true });
    for (const [cx, cy, cz, s] of [
      [-1.0, 0, 0.2, 1.4],
      [0.6, 0, -0.1, 1.4],
      [-0.3, 1.4, 0.1, 1.2],
      [1.4, 0, 0.6, 1.0],
    ] as const) {
      kit.block(root, p.x + cx, y + cy, p.z + cz, s, s, s, crate);
      kit.block(root, p.x + cx, y + cy + s * 0.45, p.z + cz - s / 2 - 0.01, s * 0.9, 0.08, 0.02, band);
    }
  }

  /* ---------------- App Service: two server racks ---------------- */
  {
    const p = at("apps");
    ["FRONTEND", "BACKEND"].forEach((name, i) => {
      const rx = p.x + (i === 0 ? -1.15 : 1.15);
      kit.block(root, rx, y, p.z, 1.9, 3.9, 1.3, rack);
      for (let row = 0; row < 9; row++) {
        kit.block(root, rx, y + 0.3 + row * 0.33, p.z - 0.66, 1.6, 0.22, 0.03, kit.mat("#2a3345"));
        led(rx - 0.6, y + 0.36 + row * 0.33, p.z - 0.69);
        led(rx - 0.38, y + 0.36 + row * 0.33, p.z - 0.69);
      }
      const plate = kit.label(root, {
        lines: [{ text: name, size: 40, weight: 800, color: "#bfdbfe" }],
        width: 1.6,
        px: 320,
        pxHeight: 64,
        bg: "rgba(15,23,42,0.95)",
      });
      plate.position.set(rx, y + 3.55, p.z - 0.68);
    });
  }

  /* ---------------- App Insights: the monitoring wall ---------------- */
  {
    const p = at("monitor");
    kit.block(root, p.x, y + 0.6, p.z, 5.2, 3.0, 0.12, darkSteel);
    kit.block(root, p.x - 2.3, y, p.z, 0.16, 0.7, 0.4, darkSteel);
    kit.block(root, p.x + 2.3, y, p.z, 0.16, 0.7, 0.4, darkSteel);
    const charts = ["REQUESTS", "DEPENDENCIES", "FAILURES"];
    charts.forEach((title, i) => {
      const tex = kit.canvas(`v2_chart${i}`, 320, 220, (ctx, w, h) => {
        ctx.fillStyle = "#0b1222";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#fbbf24";
        ctx.font = '700 26px "Segoe UI", sans-serif';
        ctx.fillText(title, 18, 38);
        const rr = rng(40 + i);
        ctx.strokeStyle = ["#5ce1ff", "#a78bfa", "#34d399"][i];
        ctx.lineWidth = 5;
        ctx.beginPath();
        for (let k = 0; k <= 12; k++) {
          const px = 18 + (k / 12) * (w - 36);
          const py = i === 2 ? h - 40 - rr() * 10 : h - 40 - (0.25 + rr() * 0.6) * (h - 100);
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      });
      const screen = MeshBuilder.CreatePlane(`v2_chartPlane${i}`, { width: 1.55, height: 1.07 }, scene);
      screen.position.set(p.x + (i - 1) * 1.65, y + 2.2, p.z - 0.08);
      kit.finish(screen, root, kit.screen(tex));
    });
  }

  /* ---------------- MCP tools: the tool rack ---------------- */
  {
    const p = at("mcp");
    kit.block(root, p.x, y + 0.4, p.z, 4.4, 3.0, 0.12, kit.mat("#334155"));
    kit.block(root, p.x - 2.0, y, p.z, 0.16, 0.5, 0.5, darkSteel);
    kit.block(root, p.x + 2.0, y, p.z, 0.16, 0.5, 0.5, darkSteel);
    // One column per tool family: Investments, Transfers, Payments, Teams.
    const toolColors = ["#f59e0b", "#10b981", "#a855f7", "#818cf8"];
    for (let i = 0; i < 4; i++) {
      for (let row = 0; row < 2; row++) {
        const tx = p.x - 1.55 + i * 1.03;
        kit.block(root, tx, y + 0.9 + row * 1.25, p.z - 0.3, 0.6, 0.75, 0.45, kit.mat(toolColors[i]));
        kit.block(root, tx, y + 1.15 + row * 1.25, p.z - 0.54, 0.34, 0.2, 0.06, kit.mat(toolColors[i], { unlit: true }));
      }
    }
  }

  /* ---------------- Teams approvals: the console and the card ---------------- */
  {
    const p = at("teams");
    const node = nodes.get("teams")!;
    kit.block(root, p.x, y, p.z, 3.0, 1.0, 1.4, rack);
    kit.block(root, p.x, y + 1.0, p.z, 3.1, 0.1, 1.5, kit.mat("#312e81"));
    const cardTex = kit.canvas("v2_approvalCard", 420, 260, (ctx, w, h) => {
      ctx.fillStyle = "#eef2ff";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#4f46e5";
      ctx.fillRect(0, 0, w, 54);
      ctx.fillStyle = "#ffffff";
      ctx.font = '700 26px "Segoe UI", sans-serif';
      ctx.fillText("Payment approval", 20, 36);
      ctx.fillStyle = "#1e1b4b";
      ctx.font = '600 22px "Segoe UI", sans-serif';
      ctx.fillText("Approval needed before release", 20, 98);
      ctx.fillStyle = "#16a34a";
      ctx.fillRect(20, 160, 170, 64);
      ctx.fillStyle = "#e5e7eb";
      ctx.fillRect(220, 160, 170, 64);
      ctx.fillStyle = "#ffffff";
      ctx.font = '800 28px "Segoe UI", sans-serif';
      ctx.fillText("Approve", 50, 202);
      ctx.fillStyle = "#374151";
      ctx.fillText("Reject", 262, 202);
    });
    const card = MeshBuilder.CreatePlane("v2_approvalCardPlane", { width: 2.1, height: 1.3 }, scene);
    card.parent = node;
    card.position.y = 2.2;
    card.billboardMode = Mesh.BILLBOARDMODE_Y;
    card.material = kit.screen(cardTex);
    card.isPickable = false;
    spinners.push((t) => {
      card.position.y = 2.2 + Math.sin(t * 1.6) * 0.12;
    });
  }

  /* ---------------- Voice Live: the studio mic ---------------- */
  {
    const p = at("voice");
    const node = nodes.get("voice")!;
    kit.cyl(root, p.x - 0.6, y, p.z, 0.9, 0.08, steel, { tess: 16 });
    kit.cyl(root, p.x - 0.6, y, p.z, 0.1, 1.7, steel, { tess: 8 });
    kit.block(root, p.x - 0.6, y + 1.7, p.z, 0.36, 0.62, 0.36, kit.mat("#ec4899", { emissive: 0.3 }));
    const pop = MeshBuilder.CreateTorus("v2_popFilter", { diameter: 0.6, thickness: 0.05, tessellation: 20 }, scene);
    pop.rotation.x = Math.PI / 2;
    pop.position.set(p.x - 0.6, y + 2.0, p.z - 0.45);
    kit.finish(pop, root, steel);
    const bars: Mesh[] = [];
    const barMat = kit.mat("#f472b6", { unlit: true });
    for (let i = 0; i < 6; i++) {
      bars.push(kit.block(node, 0.3 + i * 0.25, 0.05, 0, 0.16, 1, 0.16, barMat, { dynamic: true }));
    }
    spinners.push((t) => {
      bars.forEach((bar, i) => {
        bar.scaling.y = 0.3 + Math.abs(Math.sin(t * (5 + i * 0.8) + i * 1.3)) * 1.6;
        bar.position.y = 0.05 + bar.scaling.y / 2;
      });
    });
  }

  /* ---------------- Floor traces and pulses ---------------- */
  const trace = (hex: string, name: string): StandardMaterial => {
    const m = new StandardMaterial(name, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.emissiveColor = Color3.FromHexString(hex).scale(0.8);
    m.specularColor = Color3.Black();
    return m;
  };
  const busMat = trace("#7c6cf0", "v2_engineTrace");
  const iqMat = trace(iqColor, "v2_iqTrace");
  const busBase = Color3.FromHexString("#7c6cf0");
  const iqBase = Color3.FromHexString(iqColor);
  const azure = INFRA.filter((i) => i.id !== "foundry" && !PLACES[i.id].deck);
  const iq = INFRA.filter((i) => PLACES[i.id].deck);

  // The Azure bus: one trace through the core, with a stub out to each service.
  const xs = azure.map((i) => PLACES[i.id].tx);
  kit.block(root, (Math.min(...xs) + Math.max(...xs)) / 2, y + 0.01, BUS_Z, Math.max(...xs) - Math.min(...xs), 0.04, 0.16, busMat);
  // The IQ manifold along the front of the deck, and the trunk that drops into the back of Foundry.
  const iqXs = iq.map((i) => PLACES[i.id].tx);
  kit.block(root, (Math.min(...iqXs) + Math.max(...iqXs)) / 2, yd + 0.01, MANIFOLD_Z, Math.max(...iqXs) - Math.min(...iqXs), 0.04, 0.2, iqMat);
  kit.block(root, 0, yd + 0.01, (MANIFOLD_Z + DECK.z0) / 2, 0.3, 0.04, MANIFOLD_Z - DECK.z0, iqMat);
  kit.block(root, 0, y + 0.01, DECK.z0 - 0.04, 0.3, DECK.h, 0.04, iqMat);
  kit.block(root, 0, y + 0.01, (DECK.z0 + FOUNDRY_BACK) / 2, 0.3, 0.04, DECK.z0 - FOUNDRY_BACK, iqMat);

  const busPulse = kit.mat("#f5f3ff", { unlit: true });
  const iqPulse = kit.mat("#fdf4ff", { unlit: true });
  const pulses: Pulse[] = [];
  const addPulse = (path: Vector3[], mat: StandardMaterial): void => {
    let length = 0;
    for (let k = 1; k < path.length; k++) length += Vector3.Distance(path[k - 1], path[k]);
    const mesh = kit.block(root, 0, 0, 0, 0.34, 0.2, 0.34, mat, { dynamic: true });
    pulses.push({ mesh, path, length: Math.max(0.1, length), speed: 4 + r() * 2, offset: r() });
  };
  for (const comp of azure) {
    const p = PLACES[comp.id];
    if (Math.abs(p.tz - BUS_Z) > 0.01) {
      kit.block(root, p.tx, y + 0.01, (p.tz + BUS_Z) / 2, 0.16, 0.04, Math.abs(p.tz - BUS_Z), busMat);
    }
    const py = y + 0.2;
    addPulse([new Vector3(Math.sign(p.tx) * 3.2, py, BUS_Z), new Vector3(p.tx, py, BUS_Z), new Vector3(p.tx, py, p.tz)], busPulse);
  }
  for (const comp of iq) {
    const p = PLACES[comp.id];
    kit.block(root, p.tx, yd + 0.01, (p.tz + MANIFOLD_Z) / 2, 0.16, 0.04, p.tz - MANIFOLD_Z, iqMat);
    const fy = y + 0.2;
    const dy = yd + 0.2;
    addPulse(
      [
        new Vector3(0, fy, FOUNDRY_BACK),
        new Vector3(0, fy, DECK.z0 - 0.2),
        new Vector3(0, dy, DECK.z0 + 0.1),
        new Vector3(0, dy, MANIFOLD_Z),
        new Vector3(p.tx, dy, MANIFOLD_Z),
        new Vector3(p.tx, dy, p.tz),
      ],
      iqPulse,
    );
  }

  kit.useBatch(null);
  batch.flush();
  const ledGroups = ledBatch.flush();

  let introT = -1;
  let selected: ReadonlySet<InfraId> = new Set();
  const tmp = new Vector3();
  const along = (pk: Pulse, f: number, out: Vector3): void => {
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
  let blinkClock = 0;

  return {
    id: "engine",
    root,
    tag,
    anchors,
    update(dt: number, t: number): void {
      for (const spin of spinners) spin(t, dt);
      let level = 0.8;
      if (introT >= 0) {
        introT += dt;
        level = Math.min(0.8, 0.1 + introT * 0.6);
        if (introT > 2) introT = -1;
      }
      busMat.emissiveColor.copyFrom(busBase).scaleInPlace(level);
      iqMat.emissiveColor.copyFrom(iqBase).scaleInPlace(level);
      for (const pk of pulses) {
        along(pk, ((t * pk.speed) / (pk.length * 2) + pk.offset) % 1, tmp);
        pk.mesh.position.copyFrom(tmp);
      }
      blinkClock += dt;
      if (blinkClock > 0.3) {
        blinkClock = 0;
        ledGroups.forEach((m, i) => {
          m.isVisible = i === 0 || Math.random() > 0.35;
        });
      }
      for (const [id, ring] of rings) {
        if (!selected.has(id)) continue;
        const k = 1 + Math.sin(t * 5) * 0.05;
        ring.scaling.x = k;
        ring.scaling.z = k;
      }
    },
    setHighlights(h: Highlights): void {
      selected = h.infra;
      for (const [id, ring] of rings) ring.setEnabled(selected.has(id));
    },
    intro(): void {
      introT = 0;
    },
  };
}
