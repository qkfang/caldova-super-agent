/**
 * The lakehouse's surroundings: a floating voxel island with a lake carved
 * into its front, the deck and jetty, trees, a beach, the driveway with an
 * EV charger, and the things that move (water, fish, boats, a fire pit,
 * clouds below the island and a delivery drone over the roof).
 */
import {
  type AbstractMesh,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Texture,
  TransformNode,
} from "@babylonjs/core";
import { Batch, Kit, rng } from "./kit";
import { FLOOR_Y, ISLAND, LAKE, PIT, ROOF_Y } from "./layout";

export interface Exterior {
  /** The deck and jetty group, which the dock builds on. */
  deck: TransformNode;
  /** Whether the deck is showing (it hides when the story looks into the engine room). */
  readonly deckVisible: boolean;
  update(dt: number, t: number): void;
  /** Fade the deck and jetty out (they hide the front of the engine room) or back in. */
  setDeckVisible(visible: boolean): void;
}

interface Swimmer {
  node: TransformNode;
  cx: number;
  cz: number;
  rx: number;
  rz: number;
  y: number;
  speed: number;
  phase: number;
}

export function buildExterior(kit: Kit): Exterior {
  const scene = kit.scene;
  const root = new TransformNode("v2_exterior", scene);
  const batch = new Batch(root, "exterior");
  kit.useBatch(batch);
  const r = rng(20261119);

  const grass = kit.mat("#ffffff", { texture: "grass" });
  const dirt = kit.mat("#ffffff", { texture: "dirt" });
  const stone = kit.mat("#ffffff", { texture: "stone" });
  const deepStone = kit.mat("#a3a8b0", { texture: "stone" });
  const sand = kit.mat("#ffffff", { texture: "sand" });
  const gravel = kit.mat("#ffffff", { texture: "gravel" });
  const cedar = kit.mat("#ffffff", { texture: "cedar" });
  const darkTimber = kit.mat("#4a3426");
  const steel = kit.mat("#2b3240", { specular: 0.25 });
  const white = kit.mat("#f4f1ea");
  const bark = kit.mat("#6b4a2f");
  const warmGlow = kit.mat("#ffd27a", { unlit: true });

  /* ---------------- Island ---------------- */
  const land = (x0: number, x1: number, z0: number, z1: number, top = grass, bottom: number = ISLAND.bottom): void => {
    const w = x1 - x0;
    const d = z1 - z0;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    kit.block(root, cx, -0.6, cz, w, 0.6, d, top);
    kit.block(root, cx, -3.6, cz, w, 3, d, dirt);
    if (bottom < -3.6) kit.block(root, cx, bottom, cz, w, -3.6 - bottom, d, stone);
  };
  land(ISLAND.x0, ISLAND.x1, PIT.z1, ISLAND.z1);
  land(ISLAND.x0, PIT.x0, PIT.z0, PIT.z1);
  land(PIT.x1, ISLAND.x1, PIT.z0, PIT.z1);
  // Rock under the basement.
  kit.block(root, 0, ISLAND.bottom, (PIT.z0 + PIT.z1) / 2, PIT.x1 - PIT.x0, FLOOR_Y.engine - 0.3 - ISLAND.bottom, PIT.z1 - PIT.z0, stone);
  // Lake bed.
  const lakeD = LAKE.z1 - LAKE.z0;
  const lakeCz = (LAKE.z0 + LAKE.z1) / 2;
  kit.block(root, 0, LAKE.bedY - 0.6, lakeCz, ISLAND.x1 - ISLAND.x0, 0.6, lakeD, sand);
  kit.block(root, 0, ISLAND.bottom, lakeCz, ISLAND.x1 - ISLAND.x0, LAKE.bedY - 0.6 - ISLAND.bottom, lakeD, stone);
  // Two headlands reaching into the lake: pines on the left, a beach on the right.
  land(ISLAND.x0, -31, -23, LAKE.z1, grass, LAKE.bedY);
  land(31, ISLAND.x1, -27, LAKE.z1, sand, LAKE.bedY);
  // Sandy shore either side of the house.
  kit.block(root, -26, -0.6, LAKE.z1 + 1.1, 10, 0.62, 2.2, sand);
  kit.block(root, 26, -0.6, LAKE.z1 + 1.1, 10, 0.62, 2.2, sand);
  // The island's stepped underside, so it reads as a floating diorama.
  kit.block(root, 0, -15, -2, 80, 3, 52, deepStone);
  kit.block(root, 0, -18, -2, 56, 3, 32, deepStone);
  kit.block(root, 0, -20.5, -1, 28, 2.5, 14, deepStone);

  /* ---------------- Water ---------------- */
  const water = kit.mat("#3c9fca", { alpha: 0.52, specular: 0.7 });
  const lake = kit.block(root, 0, LAKE.bedY, lakeCz, ISLAND.x1 - ISLAND.x0 - 0.1, LAKE.waterY - LAKE.bedY, lakeD - 0.05, water, {
    dynamic: true,
    name: "v2_water",
  });
  // The lake draws before every other see-through mesh, so signs and tags below the waterline
  // (the engine room's level tag) stay sharp instead of being tinted by the water.
  lake.alphaIndex = 0;
  const rippleTex = kit.canvas("v2_ripples", 256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const rr = rng(77);
    for (let i = 0; i < 140; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.25 + rr() * 0.45})`;
      ctx.fillRect(Math.floor(rr() * w), Math.floor(rr() * h), 6 + Math.floor(rr() * 18), 2);
    }
  });
  rippleTex.wrapU = Texture.WRAP_ADDRESSMODE;
  rippleTex.wrapV = Texture.WRAP_ADDRESSMODE;
  rippleTex.uScale = 9;
  rippleTex.vScale = 2.2;
  const surfaceMat = kit.screen(rippleTex, true);
  surfaceMat.disableDepthWrite = true;
  const surface = MeshBuilder.CreateGround("v2_waterSurface", { width: ISLAND.x1 - ISLAND.x0, height: lakeD }, scene);
  surface.position.set(0, LAKE.waterY + 0.02, lakeCz);
  surface.material = surfaceMat;
  surface.isPickable = false;
  surface.parent = root;
  surface.alphaIndex = 1;

  // Lily pads, reeds and shore rocks.
  const pad = kit.mat("#4f9a45");
  const blossom = kit.mat("#f7a8c8");
  for (const [x, z] of [[-26, -20], [-23, -24], [14, -22], [17, -19], [21, -25], [-15, -30]] as const) {
    const disc = MeshBuilder.CreateDisc(`v2_lily${x}`, { radius: 0.75, tessellation: 10 }, scene);
    disc.rotation.x = Math.PI / 2;
    disc.position.set(x, LAKE.waterY + 0.05, z);
    kit.finish(disc, root, pad);
    if (r() > 0.4) kit.block(root, x + 0.2, LAKE.waterY + 0.05, z - 0.1, 0.3, 0.25, 0.3, blossom);
  }
  const reed = kit.mat("#6f9a3e");
  const cattail = kit.mat("#6b4a2f");
  for (const [cx, cz] of [[-30.5, -14.5], [-28, -16.5], [29.5, -14.2], [-44, -24.5], [30.5, -17]] as const) {
    for (let i = 0; i < 7; i++) {
      const x = cx + (r() - 0.5) * 2;
      const z = cz + (r() - 0.5) * 1.6;
      const h = 1.2 + r() * 1.2;
      kit.block(root, x, LAKE.waterY - 0.3, z, 0.12, h, 0.12, reed);
      if (r() > 0.5) kit.block(root, x, LAKE.waterY - 0.3 + h, z, 0.2, 0.4, 0.2, cattail);
    }
  }
  for (let i = 0; i < 14; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * (22 + r() * 9);
    const s = 0.6 + r() * 1.1;
    kit.block(root, x, LAKE.waterY - 0.5, LAKE.z1 - 0.4 - r() * 1.2, s * 1.3, s, s, stone);
  }

  /* ---------------- Deck and jetty ---------------- */
  // The deck has its own group so it can fade away when the story looks into the engine room.
  const deck = new TransformNode("v2_deck", scene);
  deck.parent = root;
  const deckBatch = new Batch(deck, "deck");
  kit.useBatch(deckBatch);
  const deckTop = FLOOR_Y.agents;
  kit.block(root, -6, deckTop - 0.4, -16.2, 24, 0.4, 6.6, cedar);
  for (const x of [-17.6, -12, -6, 0, 5.6]) {
    for (const z of [-19.2, -16.2]) kit.cyl(root, x, LAKE.bedY, z, 0.5, deckTop - 0.4 - LAKE.bedY, darkTimber, { tess: 8 });
  }
  // Timber post-and-rail along the deck edge (no glass), open where the jetty meets it.
  const rail = (x0: number, x1: number, z0: number, z1: number): void => {
    const len = Math.max(x1 - x0, z1 - z0);
    const alongX = x1 - x0 >= z1 - z0;
    kit.block(root, (x0 + x1) / 2, deckTop + 1.0, (z0 + z1) / 2, alongX ? len : 0.14, 0.1, alongX ? 0.14 : len, cedar);
    const n = Math.max(1, Math.round(len / 2));
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      kit.block(root, x0 + (x1 - x0) * f, deckTop, z0 + (z1 - z0) * f, 0.14, 1.0, 0.14, darkTimber);
    }
  };
  rail(-18, -3.3, -19.45, -19.45);
  rail(-0.7, 6, -19.45, -19.45);
  rail(-17.95, -17.95, -19.45, -12.95);

  kit.block(root, -2, deckTop - 0.32, -25.3, 2.2, 0.3, 11.6, cedar);
  for (let z = -20.5; z >= -31; z -= 2.6) {
    for (const x of [-3.15, -0.85]) kit.cyl(root, x, LAKE.bedY, z, 0.3, deckTop + 0.4 - LAKE.bedY, darkTimber, { tess: 8 });
  }
  for (const x of [-3.15, -0.85]) {
    kit.block(root, x, deckTop, -31, 0.2, 1.5, 0.2, darkTimber);
    kit.block(root, x, deckTop + 1.5, -31, 0.42, 0.42, 0.42, warmGlow);
  }
  const buoy = MeshBuilder.CreateTorus("v2_buoy", { diameter: 0.9, thickness: 0.24, tessellation: 16 }, scene);
  buoy.position.set(-3.3, deckTop + 0.9, -27);
  buoy.rotation.z = Math.PI / 2;
  kit.finish(buoy, root, kit.mat("#ef4444"));

  // Fire pit and chairs on the deck, with string lights overhead.
  const fireX = -11;
  const fireZ = -16.2;
  kit.cyl(root, fireX, deckTop, fireZ, 1.9, 0.5, kit.mat("#6b7280"), { tess: 10 });
  const embers = kit.cyl(deck, fireX, deckTop, fireZ, 1.3, 0.56, kit.mat("#ff7a1a", { unlit: true, unique: true }), {
    tess: 10,
    dynamic: true,
  });
  kit.block(root, fireX, deckTop + 0.56, fireZ, 1.2, 0.18, 0.22, bark, { rotY: 0.6 });
  kit.block(root, fireX, deckTop + 0.6, fireZ, 1.2, 0.18, 0.22, bark, { rotY: -0.7 });
  const chair = (x: number, z: number, rot: number, hex: string): void => {
    const node = new TransformNode("v2_chair", scene);
    node.parent = root;
    node.position.set(x, deckTop, z);
    node.rotation.y = rot;
    const m = kit.mat(hex);
    kit.block(node, 0, 0, 0, 0.12, 0.45, 0.12, m);
    kit.block(node, 0, 0.42, 0, 1.0, 0.14, 1.0, m);
    const back = kit.block(node, 0, 0.5, 0.48, 1.0, 1.2, 0.12, m);
    back.rotation.x = -0.32;
    kit.block(node, -0.55, 0.75, -0.05, 0.12, 0.1, 1.1, m);
    kit.block(node, 0.55, 0.75, -0.05, 0.12, 0.1, 1.1, m);
    kit.block(node, -0.55, 0, -0.45, 0.12, 0.75, 0.12, m);
    kit.block(node, 0.55, 0, -0.45, 0.12, 0.75, 0.12, m);
  };
  chair(fireX - 2.2, fireZ - 0.6, 2.0, "#9cc5a1");
  chair(fireX + 2.2, fireZ - 0.6, -2.0, "#f19a7a");
  chair(fireX, fireZ + 2.3, Math.PI, "#8ec5e8");
  for (const x of [-17.6, 5.6]) kit.block(root, x, deckTop, -19.2, 0.18, 3.6, 0.18, steel);
  for (let i = 0; i <= 16; i++) {
    const f = i / 16;
    const x = -17.6 + f * 23.2;
    const y = deckTop + 3.5 - Math.sin(Math.PI * f) * 0.9;
    kit.block(root, x, y, -19.2, 0.22, 0.22, 0.22, warmGlow);
  }
  kit.useBatch(batch);

  // A rowboat and a kayak on the water.
  const boat = new TransformNode("v2_boat", scene);
  boat.parent = root;
  const hullWhite = kit.mat("#f4f1ea");
  const hullStripe = kit.mat("#1f3a5f");
  kit.block(boat, 0, 0, 0, 1.5, 0.32, 3.6, hullWhite, { dynamic: true });
  kit.block(boat, -0.78, 0.1, 0, 0.16, 0.6, 3.6, hullStripe, { dynamic: true });
  kit.block(boat, 0.78, 0.1, 0, 0.16, 0.6, 3.6, hullStripe, { dynamic: true });
  kit.block(boat, 0, 0.1, -1.9, 1.2, 0.6, 0.3, hullStripe, { dynamic: true });
  kit.block(boat, 0, 0.1, 1.9, 1.4, 0.6, 0.2, hullStripe, { dynamic: true });
  kit.block(boat, 0, 0.42, 0.4, 1.4, 0.12, 0.5, cedar, { dynamic: true });
  boat.position.set(-5.6, LAKE.waterY - 0.2, -27.5);
  boat.rotation.y = 0.25;
  const kayak = new TransformNode("v2_kayak", scene);
  kayak.parent = root;
  kit.block(kayak, 0, 0, 0, 0.75, 0.34, 3.6, kit.mat("#f97316"), { dynamic: true });
  kit.block(kayak, 0, 0.3, 0.1, 0.5, 0.1, 0.9, kit.mat("#1f2937"), { dynamic: true });
  kit.block(kayak, 0, 0.42, 0.1, 2.6, 0.06, 0.12, kit.mat("#e5e7eb"), { dynamic: true });
  kayak.position.set(9.5, LAKE.waterY - 0.12, -25.5);
  kayak.rotation.y = 1.15;

  /* ---------------- Trees, beach and lawn ---------------- */
  const pineA = kit.mat("#2f6b3f");
  const pineB = kit.mat("#3b7d4a");
  const leafA = kit.mat("#5ea347");
  const leafB = kit.mat("#7bbf5a");
  const autumn = kit.mat("#e0a43a");
  const pine = (x: number, z: number, s: number): void => {
    kit.block(root, x, 0, z, 0.5 * s, 1.2 * s, 0.5 * s, bark);
    kit.block(root, x, 1.0 * s, z, 2.8 * s, 1.3 * s, 2.8 * s, pineA);
    kit.block(root, x, 2.2 * s, z, 2.0 * s, 1.2 * s, 2.0 * s, pineB);
    kit.block(root, x, 3.3 * s, z, 1.2 * s, 1.1 * s, 1.2 * s, pineA);
    kit.block(root, x, 4.3 * s, z, 0.5 * s, 0.6 * s, 0.5 * s, pineB);
  };
  const leafy = (x: number, z: number, s: number, canopy = leafA): void => {
    kit.block(root, x, 0, z, 0.55 * s, 1.8 * s, 0.55 * s, bark);
    kit.block(root, x, 1.6 * s, z, 3.0 * s, 2.2 * s, 3.0 * s, canopy);
    kit.block(root, x + 0.4 * s, 3.6 * s, z - 0.3 * s, 2.0 * s, 0.9 * s, 2.0 * s, canopy === autumn ? autumn : leafB);
    kit.block(root, x - 1.4 * s, 2.0 * s, z + 0.5 * s, 0.9 * s, 1.2 * s, 1.4 * s, leafB);
  };
  const bush = (x: number, z: number, s: number): void => {
    kit.block(root, x, 0, z, 1.4 * s, 0.9 * s, 1.1 * s, leafB);
    kit.block(root, x + 0.4 * s, 0, z + 0.3 * s, 0.9 * s, 1.2 * s, 0.9 * s, leafA);
  };
  for (const [x, z, s] of [
    [-41, 24, 1.3], [-34, 18, 1.1], [-27, 26, 1.4], [-19, 21, 1.2], [-9, 26, 1.3], [1, 22, 1.1],
    [11, 27, 1.4], [19, 20, 1.2], [27, 25, 1.3], [36, 21, 1.2], [42, 27, 1.1], [-40, 4, 1.2],
    [-42, -9, 1.1], [42, 6, 1.1], [-41, -17, 1.2], [-36, -20, 1.0],
  ] as const) pine(x, z, s);
  for (const [x, z, s, a] of [
    [-37, 13, 1.0, 0], [-24, 14, 0.9, 0], [6, 15, 1.0, 1], [24, 14, 0.9, 0], [39, 13, 1.0, 1],
    [-34, -4, 1.0, 0], [40, -8, 0.9, 0], [-44, -21, 0.8, 1],
  ] as const) leafy(x, z, s, a ? autumn : leafA);
  for (const [x, z, s] of [[-28, 6, 1], [-26, -8, 0.9], [24, -9, 0.8], [26, 7.4, 1], [34, -15, 0.7], [-33, -14, 0.8]] as const) {
    bush(x, z, s);
  }
  const petals = ["#f472b6", "#facc15", "#a78bfa", "#fb7185", "#ffffff"].map((hex) => kit.mat(hex));
  for (const [cx, cz] of [[23.5, -5.5], [23.5, 4.5], [-23.5, -6], [-24, 0.5]] as const) {
    for (let i = 0; i < 10; i++) {
      kit.block(root, cx + (r() - 0.5) * 2.6, 0, cz + (r() - 0.5) * 2.2, 0.28, 0.35 + r() * 0.2, 0.28, petals[i % petals.length]);
    }
  }
  // Beach umbrella and loungers on the right headland.
  kit.block(root, 38, 0, -21, 0.14, 2.8, 0.14, white);
  kit.cyl(root, 38, 2.6, -21, 3.4, 0.5, kit.mat("#f97316"), { top: 0.3, tess: 8 });
  for (const x of [36.4, 39.6]) {
    kit.block(root, x, 0.25, -21.5, 1.0, 0.18, 2.3, kit.mat("#e0f2fe"));
    const back = kit.block(root, x, 0.35, -20.5, 1.0, 0.9, 0.14, kit.mat("#e0f2fe"));
    back.rotation.x = 0.5;
  }
  // Picnic table on the left lawn.
  kit.block(root, -31, 0, 1, 3.2, 1.0, 1.4, cedar);
  kit.block(root, -31, 0, -0.3, 3.2, 0.5, 0.5, cedar);
  kit.block(root, -31, 0, 2.3, 3.2, 0.5, 0.5, cedar);

  /* ---------------- Driveway and EV ---------------- */
  kit.block(root, (PIT.x1 + ISLAND.x1) / 2, 0, -0.5, ISLAND.x1 - PIT.x1, 0.06, 4.4, gravel);
  const car = new TransformNode("v2_ev", scene);
  car.parent = root;
  car.position.set(31.5, 0.06, 5.2);
  const carBody = kit.mat("#f4f6fb", { specular: 0.4 });
  kit.block(car, 0, 0.35, 0, 4.4, 0.95, 2.0, carBody);
  kit.block(car, 0.2, 1.3, 0, 2.6, 0.8, 1.84, kit.mat("#1b2a44", { specular: 0.6 }));
  kit.block(car, 0, 0.3, 0, 4.5, 0.12, 2.04, kit.mat("#14b8a6"));
  kit.block(car, -2.22, 0.75, 0, 0.06, 0.16, 1.6, kit.mat("#bff6ff", { unlit: true }));
  for (const [x, z] of [[-1.4, -1.02], [1.4, -1.02], [-1.4, 1.02], [1.4, 1.02]] as const) {
    const wheel = MeshBuilder.CreateCylinder("v2_wheel", { diameter: 0.9, height: 0.36, tessellation: 12 }, scene);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(x, 0.45, z);
    kit.finish(wheel, car, kit.mat("#1a1a1f"));
  }
  kit.block(root, 28.4, 0.06, 7.6, 0.5, 1.7, 0.4, white);
  kit.block(root, 28.4, 1.1, 7.38, 0.36, 0.36, 0.06, kit.mat("#34d399", { unlit: true }));
  kit.block(root, 29.4, 0.06, 6.9, 2.0, 0.08, 0.1, kit.mat("#1f2937"));

  kit.useBatch(null);
  batch.flush();
  deckBatch.flush();
  // Meshes added to the deck later (the dock) are picked up the next time it fades,
  // and each mesh's own visibility (0 for click targets) is kept.
  const baseVisibility = new WeakMap<AbstractMesh, number>();
  let deckMeshes: AbstractMesh[] = [];
  const collectDeck = (): void => {
    deckMeshes = deck.getChildMeshes(false);
    for (const m of deckMeshes) if (!baseVisibility.has(m)) baseVisibility.set(m, m.visibility);
  };
  let deckAlpha = 1;
  let deckTarget = 1;

  /* ---------------- Things that move ---------------- */
  const fishMats = ["#ff9f43", "#f6e58d", "#c7d2fe", "#ff7f50"].map((hex) => kit.mat(hex));
  const swimmers: Swimmer[] = [];
  const addFish = (cx: number, cz: number, rx: number, rz: number, y: number, speed: number): void => {
    const node = new TransformNode("v2_fish", scene);
    node.parent = root;
    const m = fishMats[swimmers.length % fishMats.length];
    kit.block(node, 0, -0.18, 0, 0.26, 0.36, 0.85, m, { dynamic: true });
    kit.block(node, 0, -0.15, -0.55, 0.06, 0.32, 0.26, m, { dynamic: true });
    kit.block(node, 0, 0.14, 0.05, 0.05, 0.16, 0.3, m, { dynamic: true });
    swimmers.push({ node, cx, cz, rx, rz, y, speed, phase: r() * Math.PI * 2 });
  };
  addFish(-10, -22, 9, 4, -3, 0.35);
  addFish(12, -24, 8, 3, -4.5, -0.3);
  addFish(-30, -28, 5, 2.5, -3.5, 0.45);
  addFish(25, -29, 6, 2, -2.5, -0.4);
  addFish(0, -15, 14, 1.2, -3.2, 0.22);
  addFish(-6, -15.6, 10, 1, -4.8, -0.28);
  addFish(8, -15.3, 6, 0.9, -2.4, 0.4);

  const cloudMat = kit.mat("#ffffff", { emissive: 0.45 });
  const clouds: TransformNode[] = [];
  for (let i = 0; i < 9; i++) {
    const node = new TransformNode("v2_cloud", scene);
    node.parent = root;
    const n = 3 + Math.floor(r() * 3);
    for (let j = 0; j < n; j++) {
      const w = 3 + r() * 4;
      kit.block(node, (j - n / 2) * 2.4 + r() * 1.2, r() * 1, (r() - 0.5) * 2.4, w, 1.2 + r() * 1.2, 2.4 + r() * 2.4, cloudMat, {
        dynamic: true,
      });
    }
    // Drift well below and beyond the island so the clouds frame it without covering it.
    const side = i % 2 === 0 ? 1 : -1;
    node.position.set(-110 + r() * 220, -34 + r() * 12, side * (60 + r() * 45));
    clouds.push(node);
  }

  const drone = new TransformNode("v2_drone", scene);
  drone.parent = root;
  const droneBody = kit.mat("#1f2937", { specular: 0.4 });
  kit.block(drone, 0, 0, 0, 0.9, 0.28, 0.9, droneBody, { dynamic: true });
  kit.block(drone, 0, 0.02, 0, 2.3, 0.08, 0.14, droneBody, { dynamic: true, rotY: Math.PI / 4 });
  kit.block(drone, 0, 0.02, 0, 2.3, 0.08, 0.14, droneBody, { dynamic: true, rotY: -Math.PI / 4 });
  kit.block(drone, 0, -0.62, 0, 0.6, 0.5, 0.6, kit.mat("#c89b6d"), { dynamic: true });
  const rotors: Mesh[] = [];
  for (const [x, z] of [[0.8, 0.8], [-0.8, 0.8], [0.8, -0.8], [-0.8, -0.8]] as const) {
    rotors.push(kit.block(drone, x, 0.12, z, 0.9, 0.03, 0.12, kit.mat("#e5e7eb"), { dynamic: true }));
  }
  const droneLight = kit.mat("#5ce1ff", { unlit: true });
  kit.block(drone, 0, -0.06, 0.48, 0.3, 0.1, 0.06, droneLight, { dynamic: true });

  const embersMat = embers.material as StandardMaterial;

  return {
    deck,
    get deckVisible(): boolean {
      return deckTarget > 0;
    },
    setDeckVisible(visible: boolean): void {
      deckTarget = visible ? 1 : 0;
      collectDeck();
      if (visible) deck.setEnabled(true);
    },
    update(dt: number, t: number): void {
      if (deckAlpha !== deckTarget) {
        deckAlpha += (deckTarget - deckAlpha) * (1 - Math.exp(-dt * 5));
        if (Math.abs(deckTarget - deckAlpha) < 0.01) deckAlpha = deckTarget;
        for (const m of deckMeshes) m.visibility = (baseVisibility.get(m) ?? 1) * deckAlpha;
        deck.setEnabled(deckAlpha > 0.01);
      }
      rippleTex.uOffset = (rippleTex.uOffset + dt * 0.012) % 1;
      rippleTex.vOffset = (rippleTex.vOffset + dt * 0.006) % 1;
      for (const f of swimmers) {
        const a = f.phase + t * f.speed;
        f.node.position.set(f.cx + Math.cos(a) * f.rx, f.y + Math.sin(t * 1.3 + f.phase) * 0.15, f.cz + Math.sin(a) * f.rz);
        // Face along the direction of travel.
        const dx = -Math.sin(a) * f.rx * f.speed;
        const dz = Math.cos(a) * f.rz * f.speed;
        f.node.rotation.y = Math.atan2(dx, dz);
      }
      boat.position.y = LAKE.waterY - 0.2 + Math.sin(t * 1.1) * 0.06;
      boat.rotation.z = Math.sin(t * 0.9) * 0.04;
      kayak.position.y = LAKE.waterY - 0.12 + Math.sin(t * 1.4 + 1) * 0.05;
      for (const c of clouds) {
        c.position.x += dt * 0.9;
        if (c.position.x > 120) c.position.x = -120;
      }
      const da = t * 0.22;
      drone.position.set(-6 + Math.cos(da) * 15, ROOF_Y + 5.2 + Math.sin(t * 1.7) * 0.25, -2 + Math.sin(da) * 11);
      drone.rotation.y = Math.atan2(-Math.sin(da) * 15, Math.cos(da) * 11);
      drone.rotation.z = 0.08;
      for (const rot of rotors) rot.rotation.y += dt * 40;
      embersMat.emissiveColor.set(1, 0.42 + Math.sin(t * 11) * 0.06 + Math.sin(t * 7.3) * 0.05, 0.1);
      embers.scaling.y = 1 + Math.sin(t * 9) * 0.04;
    },
  };
}
