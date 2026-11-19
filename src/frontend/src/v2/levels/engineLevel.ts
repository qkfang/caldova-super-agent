/**
 * Lower level · The Engine Room — the infrastructure and network under the
 * waterline, behind a glass wall onto the lake.
 *
 * Microsoft Foundry sits in the middle as a glowing core. Every other
 * component (AI Search, MCP tools, Teams approvals, Content Understanding,
 * Voice Live, App Service, Entra ID, Key Vault, Storage, App Insights and
 * the network) is wired to it by floor traces that carry pulses of data.
 */
import { Color3, Mesh, MeshBuilder, StandardMaterial, Texture, TransformNode, Vector3 } from "@babylonjs/core";
import { Batch, Kit, rng } from "../kit";
import { INFRA, levelInfo, type InfraId } from "../lakehouseData";
import { FLOOR_Y, SLABS, WALLS } from "../layout";
import { buildShell } from "../shell";
import type { Anchor, Highlights, LevelBuild } from "../types";

interface Place {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  /** Where the floor trace from Foundry ends. */
  tx: number;
  tz: number;
}

const PLACES: Record<InfraId, Place> = {
  foundry: { x: 0, z: -2.5, w: 6.4, d: 6.4, h: 4.8, tx: 0, tz: -2.5 },
  search: { x: -12.5, z: 4.6, w: 5.8, d: 1.6, h: 3.9, tx: -12.5, tz: 3.6 },
  content: { x: -12.5, z: -4.4, w: 5.2, d: 1.6, h: 2.9, tx: -12.5, tz: -3.5 },
  bing: { x: -17.4, z: -9.6, w: 2.6, d: 2.6, h: 5.8, tx: -17.4, tz: -8.5 },
  identity: { x: -14.6, z: 0.6, w: 3.2, d: 1.2, h: 3.2, tx: -14.6, tz: 0 },
  vault: { x: -6, z: 7.0, w: 3.6, d: 1.2, h: 3.6, tx: -6, tz: 6.2 },
  network: { x: 0, z: 7.0, w: 5.0, d: 1.2, h: 3.6, tx: 0, tz: 6.2 },
  storage: { x: 6, z: 6.6, w: 3.6, d: 2.0, h: 2.8, tx: 6, tz: 5.5 },
  apps: { x: 12.6, z: 4.6, w: 4.4, d: 1.4, h: 3.9, tx: 12.6, tz: 3.8 },
  monitor: { x: 19.3, z: 4.6, w: 0.8, d: 5.0, h: 3.6, tx: 18.6, tz: 4.6 },
  mcp: { x: 19.3, z: -4.2, w: 0.8, d: 5.6, h: 3.6, tx: 18.6, tz: -4.2 },
  teams: { x: 12.4, z: -7.4, w: 3.0, d: 1.6, h: 2.8, tx: 12.4, tz: -6.5 },
  voice: { x: 4.4, z: -9.4, w: 2.6, d: 1.6, h: 2.8, tx: 4.4, tz: -8.5 },
};

const BUS_Z = -2.5;
const GOLD = "#ffe08a";

interface Pulse {
  mesh: Mesh;
  path: Vector3[];
  length: number;
  speed: number;
  offset: number;
}

export function buildEngineLevel(kit: Kit): LevelBuild {
  const scene = kit.scene;
  const root = new TransformNode("v2_lvl_engine", scene);
  const batch = new Batch(kit, root, "engine");
  kit.useBatch(batch);
  const y = FLOOR_Y.engine;
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
  buildShell(kit, {
    root,
    level: info,
    floorY: y,
    slab: SLABS.engine,
    walls: WALLS.engine,
    floor: floorMat,
    back: kit.mat("#ffffff", { texture: "concrete" }),
    glass: [],
    open: ["front"],
    height,
    tagAt: [-25.8, y + 2.8, -16.5],
  });

  // The glass wall onto the lake.
  const concrete = kit.mat("#ffffff", { texture: "concrete" });
  const steel = kit.mat("#2b3240", { specular: 0.25 });
  const fz = (SLABS.engine.z0 + WALLS.engine.z0) / 2 - 0.2;
  kit.block(root, 0, y, fz, 40.8, 0.4, 0.4, concrete);
  kit.block(root, 0, y + 0.4, fz, 40, 4.6, 0.12, kit.mat("#9fe3ff", { alpha: 0.16, specular: 0.8 }));
  kit.block(root, 0, y + 5.0, fz, 40.8, height - 5.0, 0.4, concrete);
  for (let x = -20; x <= 20; x += 5) kit.block(root, x, y + 0.4, fz, 0.16, 4.6, 0.2, steel);

  const darkSteel = kit.mat("#1e2433", { specular: 0.3 });
  const rack = kit.mat("#1b2030", { specular: 0.2 });
  const walnut = kit.mat("#ffffff", { texture: "walnut" });
  const violet = kit.mat("#a78bfa", { unlit: true, glow: true });

  // Blinking LEDs: four merged groups toggled in turn.
  const ledBatch = new Batch(kit, root, "engine_leds");
  const ledMats = ["#34d399", "#5ce1ff", "#fbbf24", "#34d399"].map((hex, i) =>
    kit.mat(hex, { unlit: true, glow: true, specular: 0.01 * (i + 1) }),
  );
  const led = (x: number, ly: number, z: number, w = 0.14, h = 0.1, d = 0.05): void => {
    const prev = kit.useBatch(ledBatch);
    kit.block(root, x, ly, z, w, h, d, ledMats[Math.floor(r() * ledMats.length)]);
    kit.useBatch(prev);
  };

  const nodes = new Map<InfraId, TransformNode>();
  const rings = new Map<InfraId, { mesh: Mesh; sx: number }>();
  const anchors = new Map<string, Anchor>();
  const spinners: Array<(t: number, dt: number) => void> = [];

  for (const comp of INFRA) {
    const p = PLACES[comp.id];
    const node = new TransformNode(`v2_infra_${comp.id}`, scene);
    node.parent = root;
    node.position.set(p.x, y, p.z);
    nodes.set(comp.id, node);
    anchors.set(`infra:${comp.id}`, { node, group: "engine", dy: Math.min(3, p.h * 0.6) });
    const wallMounted = comp.id === "monitor" || comp.id === "mcp";
    const labelX = wallMounted ? p.x - 1.4 : p.x;
    const tag = kit.label(root, {
      lines: [
        { text: comp.sign, size: 46, weight: 800, color: comp.color },
        { text: comp.tag, size: 30, weight: 500, color: "#d4dcef" },
      ],
      width: comp.id === "foundry" ? 5.2 : 3.9,
      px: 560,
      bg: "rgba(10,14,30,0.84)",
      accent: comp.color,
      bar: "top",
    });
    tag.billboardMode = Mesh.BILLBOARDMODE_Y;
    // Keep the label under the Level 1 slab so it never pokes through the floor above.
    tag.position.set(labelX, Math.min(y + p.h + 0.9, y + height - 0.8), p.z);
    const ringD = Math.max(p.w, p.d) + 1.6;
    const ring = MeshBuilder.CreateTorus(`v2_infraRing_${comp.id}`, { diameter: ringD, thickness: 0.16, tessellation: 40 }, scene);
    ring.position.set(wallMounted ? p.x - 1.2 : p.x, y + 0.12, p.z);
    const sx = wallMounted ? 0.5 : 1;
    ring.scaling.x = sx;
    kit.finish(ring, root, kit.mat(GOLD, { unlit: true, glow: true }), true);
    ring.setEnabled(false);
    rings.set(comp.id, { mesh: ring, sx });
    const hx = wallMounted ? p.x - 0.6 : p.x;
    kit.hitbox(root, hx, y, p.z, Math.max(1.6, p.w), p.h, Math.max(1.6, p.d), { type: "infra", id: comp.id });
  }

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
    const core = kit.cyl(node, 0, 0.6, 0, 1.3, 3.4, kit.mat("#b39cff", { unlit: true, glow: true }), { tess: 16, dynamic: true });
    const coreRings = [1.3, 2.3, 3.3].map((ry, i) => {
      const ring = MeshBuilder.CreateTorus(`v2_coreRing${i}`, { diameter: i === 1 ? 2.7 : 2.3, thickness: 0.09, tessellation: 40 }, scene);
      ring.position.y = ry;
      kit.finish(ring, node, kit.mat("#e9d5ff", { unlit: true, glow: true }), true);
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

  /* ---------------- Azure AI Search: shelves of indexed documents ---------------- */
  {
    const p = at("search");
    const docMats = ["#38bdf8", "#a5f3fc", "#e0f2fe", "#7dd3fc"].map((hex) => kit.mat(hex, { emissive: 0.45 }));
    for (const side of [-1, 1]) {
      const sx = p.x + side * 1.45;
      kit.block(root, sx, y, p.z + 0.2, 2.7, 3.9, 1.2, walnut);
      for (let row = 0; row < 4; row++) {
        for (let k = 0; k < 7; k++) {
          const dh = 0.45 + r() * 0.25;
          kit.block(root, sx - 1.0 + k * 0.33, y + 0.2 + row * 0.92, p.z - 0.42, 0.24, dh, 0.6, docMats[Math.floor(r() * docMats.length)]);
        }
      }
    }
    const scan = kit.block(nodes.get("search")!, 0, 0.1, -0.78, 0.1, 3.7, 0.05, kit.mat("#bae6fd", { unlit: true, glow: true }), {
      dynamic: true,
    });
    spinners.push((t) => {
      scan.position.x = Math.sin(t * 0.8) * 2.6;
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
        doc.position.x = (((t * 0.9 + i * 1.7) % 5.1) - 2.55);
      });
    });
  }

  /* ---------------- Bing grounding: the antenna ---------------- */
  {
    const p = at("bing");
    const node = nodes.get("bing")!;
    kit.cyl(root, p.x, y, p.z, 1.6, 0.3, darkSteel, { tess: 16 });
    kit.cyl(root, p.x, y, p.z, 0.3, height, steel, { tess: 8 });
    const dish = new TransformNode("v2_bingDish", scene);
    dish.parent = node;
    dish.position.y = 3.6;
    const cone = kit.cyl(dish, 0, -0.3, 0, 0.3, 0.6, kit.mat("#e5e7eb", { specular: 0.4 }), { top: 2.4, tess: 20, dynamic: true });
    cone.rotation.x = -0.9;
    const blink = kit.block(node, 0, 5.2, 0, 0.3, 0.3, 0.3, kit.mat("#ef4444", { unlit: true, glow: true }), { dynamic: true });
    spinners.push((t) => {
      dish.rotation.y = Math.sin(t * 0.4) * 1.2;
      blink.setEnabled(Math.sin(t * 4) > 0);
    });
  }

  /* ---------------- Entra ID: the identity gate ---------------- */
  {
    const p = at("identity");
    const node = nodes.get("identity")!;
    const yellow = kit.mat("#facc15", { unlit: true, glow: true });
    for (const side of [-1, 1]) {
      kit.block(root, p.x + side * 1.3, y, p.z, 0.5, 2.9, 0.9, steel);
      kit.block(root, p.x + side * 1.3, y + 0.3, p.z - 0.47, 0.1, 2.3, 0.05, yellow);
    }
    kit.block(root, p.x, y + 2.9, p.z, 3.1, 0.3, 0.9, steel);
    const key = new TransformNode("v2_key", scene);
    key.parent = node;
    key.position.y = 1.6;
    const gold = kit.mat("#fde68a", { emissive: 0.6, glow: true });
    const bow = MeshBuilder.CreateTorus("v2_keyBow", { diameter: 0.7, thickness: 0.16, tessellation: 20 }, scene);
    bow.rotation.x = Math.PI / 2;
    bow.position.x = -0.5;
    kit.finish(bow, key, gold, true);
    kit.block(key, 0.25, -0.07, 0, 0.9, 0.14, 0.14, gold, { dynamic: true });
    kit.block(key, 0.55, -0.3, 0, 0.12, 0.25, 0.14, gold, { dynamic: true });
    kit.block(key, 0.35, -0.26, 0, 0.12, 0.2, 0.14, gold, { dynamic: true });
    kit.block(root, p.x + 2.2, y, p.z - 0.3, 0.2, 1.3, 0.2, steel);
    kit.block(root, p.x + 2.2, y + 1.3, p.z - 0.3, 0.4, 0.5, 0.16, darkSteel);
    kit.block(root, p.x + 2.2, y + 1.45, p.z - 0.4, 0.24, 0.2, 0.04, kit.mat("#34d399", { unlit: true, glow: true }));
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
    kit.block(root, p.x, y, p.z + 0.1, 5.0, 3.6, 1.2, rack);
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 14; col++) {
        led(p.x - 2.2 + col * 0.34, y + 0.6 + row * 0.45, p.z - 0.53, 0.16, 0.12, 0.05);
      }
    }
    const cable = kit.mat("#22d3ee", { emissive: 0.7 });
    for (let i = 0; i < 5; i++) kit.block(root, p.x - 2 + i, y + 3.6, p.z + 0.1, 0.1, height - 3.6, 0.1, cable);
  }

  /* ---------------- Storage: stacked containers ---------------- */
  {
    const p = at("storage");
    const crate = kit.mat("#0f766e");
    const band = kit.mat("#34d399", { unlit: true, glow: true });
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
    kit.block(root, p.x + 0.4, y + 0.6, p.z, 0.12, 3.0, 5.4, darkSteel);
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
      const screen = MeshBuilder.CreatePlane(`v2_chartPlane${i}`, { width: 1.65, height: 1.13 }, scene);
      screen.rotation.y = Math.PI / 2;
      screen.position.set(p.x + 0.3, y + 2.4, p.z + (i - 1) * 1.8);
      kit.finish(screen, root, kit.screen(tex));
    });
  }

  /* ---------------- MCP tools: the tool wall ---------------- */
  {
    const p = at("mcp");
    kit.block(root, p.x + 0.4, y + 0.5, p.z, 0.12, 3.0, 5.6, kit.mat("#334155"));
    const toolColors = ["#f59e0b", "#10b981", "#a855f7", "#818cf8"];
    for (let i = 0; i < 4; i++) {
      for (let row = 0; row < 2; row++) {
        const tz = p.z - 2.0 + i * 1.33;
        kit.block(root, p.x + 0.15, y + 1.1 + row * 1.2, tz, 0.4, 0.7, 0.55, kit.mat(toolColors[i]));
        kit.block(root, p.x - 0.08, y + 1.35 + row * 1.2, tz, 0.08, 0.2, 0.3, kit.mat(toolColors[i], { unlit: true, glow: true }));
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
    const barMat = kit.mat("#f472b6", { unlit: true, glow: true });
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
  const traceMat = new StandardMaterial("v2_engineTrace", scene);
  traceMat.diffuseColor = Color3.FromHexString("#7c6cf0");
  traceMat.emissiveColor = Color3.FromHexString("#7c6cf0").scale(0.8);
  traceMat.specularColor = Color3.Black();
  const xs = INFRA.map((i) => PLACES[i.id].tx);
  kit.block(root, (Math.min(...xs) + Math.max(...xs)) / 2, y + 0.01, BUS_Z, Math.max(...xs) - Math.min(...xs), 0.04, 0.16, traceMat);
  const pulseMat = kit.mat("#f5f3ff", { unlit: true, glow: true });
  const pulses: Pulse[] = [];
  for (const comp of INFRA) {
    if (comp.id === "foundry") continue;
    const p = PLACES[comp.id];
    if (Math.abs(p.tz - BUS_Z) > 0.01) {
      kit.block(root, p.tx, y + 0.01, (p.tz + BUS_Z) / 2, 0.16, 0.04, Math.abs(p.tz - BUS_Z), traceMat);
    }
    const start = new Vector3(p.tx > 0 ? 3.2 : -3.2, y + 0.2, BUS_Z);
    const path = [start, new Vector3(p.tx, y + 0.2, BUS_Z), new Vector3(p.tx, y + 0.2, p.tz)];
    let length = 0;
    for (let k = 1; k < path.length; k++) length += Vector3.Distance(path[k - 1], path[k]);
    const mesh = kit.block(root, 0, 0, 0, 0.34, 0.2, 0.34, pulseMat, { dynamic: true });
    pulses.push({ mesh, path, length: Math.max(0.1, length), speed: 4 + r() * 2, offset: r() });
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
    anchors,
    update(dt: number, t: number): void {
      for (const spin of spinners) spin(t, dt);
      let level = 0.8;
      if (introT >= 0) {
        introT += dt;
        level = Math.min(0.8, 0.1 + introT * 0.6);
        if (introT > 2) introT = -1;
      }
      traceMat.emissiveColor.set(0.486 * level, 0.424 * level, 0.94 * level);
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
        ring.mesh.scaling.x = ring.sx * k;
        ring.mesh.scaling.z = k;
      }
    },
    setHighlights(h: Highlights): void {
      selected = h.infra;
      for (const [id, ring] of rings) ring.mesh.setEnabled(selected.has(id));
    },
    intro(): void {
      introT = 0;
    },
  };
}
