import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import { PALETTES, VoxelCharacter } from "./voxelCharacter";
import type { ScenarioId } from "./personaData";

/**
 * Per-frame mover used for ambient cars / pedestrians / pets in the
 * neighbourhood scene. Each mover owns one or more meshes and advances
 * itself toward the next waypoint on every tick.
 */
interface Mover {
  update(dtSec: number): void;
  /** Optional disposal hook (currently unused — neighbourhood is permanent). */
  dispose?(): void;
}

/**
 * A scripted life-event animation tied to a client scenario.
 *
 * The animation is restartable: `start()` snaps everything to its
 * baseline and replays the sequence. `update(dt)` advances the
 * elapsed-time-driven keyframes.
 */
interface IncidentAnimation {
  start(): void;
  stop(): void;
  update(dtSec: number): void;
  /** Total duration of the scripted sequence in seconds. */
  durationSec: number;
}

/**
 * Vehicle types supported by {@link NeighbourhoodAmbient.addCar}. Each
 * variant has a distinctive voxel silhouette so a row of ambient
 * traffic feels varied instead of "five identical sedans".
 */
export type VehicleType =
  | "sedan"
  | "jeep"
  | "mini"
  | "bicycle"
  | "scooter"
  | "van"
  | "tram";

/**
 * Build a simple voxel sedan (chassis + cabin + windows + four wheels)
 * parented under a single TransformNode the caller can move and rotate.
 *
 * The car's long axis runs along local +Z so that `parent.rotation.y =
 * Math.atan2(nx, nz)` (which yields 0 when travelling +Z) orients the
 * car correctly along its direction of travel.
 */
export function buildCarMeshes(
  scene: Scene,
  parent: TransformNode,
  bodyHex: string,
  topHex: string,
): void {
  const body = MeshBuilder.CreateBox(
    `${parent.name}_body`,
    { width: 1.3, height: 0.7, depth: 2.4 },
    scene,
  );
  body.parent = parent;
  body.position = new Vector3(0, 0.5, 0);
  const bodyMat = new StandardMaterial(`${parent.name}_body_mat`, scene);
  bodyMat.diffuseColor = Color3.FromHexString(bodyHex);
  bodyMat.specularColor = new Color3(0.05, 0.05, 0.05);
  body.material = bodyMat;

  const top = MeshBuilder.CreateBox(
    `${parent.name}_top`,
    { width: 1.2, height: 0.55, depth: 1.4 },
    scene,
  );
  top.parent = parent;
  top.position = new Vector3(0, 1.1, 0);
  const topMat = new StandardMaterial(`${parent.name}_top_mat`, scene);
  topMat.diffuseColor = Color3.FromHexString(topHex);
  topMat.specularColor = new Color3(0.05, 0.05, 0.05);
  top.material = topMat;

  const win = MeshBuilder.CreateBox(
    `${parent.name}_win`,
    { width: 1.25, height: 0.4, depth: 1.2 },
    scene,
  );
  win.parent = parent;
  win.position = new Vector3(0, 1.1, 0);
  const winMat = new StandardMaterial(`${parent.name}_win_mat`, scene);
  winMat.diffuseColor = Color3.FromHexString("#cfe7ff");
  winMat.specularColor = new Color3(0.1, 0.1, 0.1);
  win.material = winMat;

  // Four wheels (just dark boxes). Wheel positions sit at the four
  // corners of the body (which now runs along local +Z), with the wheels'
  // narrow axis pointing outward from the sides of the car.
  const wheelMat = new StandardMaterial(`${parent.name}_wheel_mat`, scene);
  wheelMat.diffuseColor = Color3.FromHexString("#1c2230");
  for (const [dx, dz] of [
    [0.55, 0.8],
    [-0.55, 0.8],
    [0.55, -0.8],
    [-0.55, -0.8],
  ] as Array<[number, number]>) {
    const w = MeshBuilder.CreateBox(
      `${parent.name}_wheel_${dx}_${dz}`,
      { width: 0.25, height: 0.45, depth: 0.45 },
      scene,
    );
    w.parent = parent;
    w.position = new Vector3(dx, 0.22, dz);
    w.material = wheelMat;
  }
}

/**
 * Build a chunky voxel jeep / SUV (taller cabin, exposed roll cage,
 * larger wheels). Long axis runs along local +Z, matching the sedan.
 */
export function buildJeepMeshes(
  scene: Scene,
  parent: TransformNode,
  bodyHex: string,
  topHex: string,
): void {
  const bodyMat = new StandardMaterial(`${parent.name}_body_mat`, scene);
  bodyMat.diffuseColor = Color3.FromHexString(bodyHex);
  bodyMat.specularColor = new Color3(0.05, 0.05, 0.05);
  const topMat = new StandardMaterial(`${parent.name}_top_mat`, scene);
  topMat.diffuseColor = Color3.FromHexString(topHex);
  topMat.specularColor = new Color3(0.05, 0.05, 0.05);
  const winMat = new StandardMaterial(`${parent.name}_win_mat`, scene);
  winMat.diffuseColor = Color3.FromHexString("#cfe7ff");

  // Tall, square chassis.
  const body = MeshBuilder.CreateBox(
    `${parent.name}_body`,
    { width: 1.45, height: 0.85, depth: 2.2 },
    scene,
  );
  body.parent = parent;
  body.position = new Vector3(0, 0.6, 0);
  body.material = bodyMat;

  // Boxy upright cabin sitting almost square on the chassis.
  const cab = MeshBuilder.CreateBox(
    `${parent.name}_cab`,
    { width: 1.35, height: 0.85, depth: 1.6 },
    scene,
  );
  cab.parent = parent;
  cab.position = new Vector3(0, 1.45, -0.1);
  cab.material = topMat;

  // Front windscreen.
  const win = MeshBuilder.CreateBox(
    `${parent.name}_win`,
    { width: 1.4, height: 0.5, depth: 1.55 },
    scene,
  );
  win.parent = parent;
  win.position = new Vector3(0, 1.55, -0.1);
  win.material = winMat;

  // Front grille / bull bar.
  const grille = MeshBuilder.CreateBox(
    `${parent.name}_grille`,
    { width: 1.5, height: 0.35, depth: 0.18 },
    scene,
  );
  grille.parent = parent;
  grille.position = new Vector3(0, 0.5, 1.15);
  const grilleMat = new StandardMaterial(`${parent.name}_grille_mat`, scene);
  grilleMat.diffuseColor = Color3.FromHexString("#1c2230");
  grille.material = grilleMat;

  // Spare wheel on the back.
  const spare = MeshBuilder.CreateBox(
    `${parent.name}_spare`,
    { width: 0.55, height: 0.55, depth: 0.18 },
    scene,
  );
  spare.parent = parent;
  spare.position = new Vector3(0, 0.95, -1.2);
  const spareMat = new StandardMaterial(`${parent.name}_spare_mat`, scene);
  spareMat.diffuseColor = Color3.FromHexString("#1c2230");
  spare.material = spareMat;

  // Four chunky wheels.
  const wheelMat = new StandardMaterial(`${parent.name}_wheel_mat`, scene);
  wheelMat.diffuseColor = Color3.FromHexString("#1c2230");
  for (const [dx, dz] of [
    [0.65, 0.8],
    [-0.65, 0.8],
    [0.65, -0.8],
    [-0.65, -0.8],
  ] as Array<[number, number]>) {
    const w = MeshBuilder.CreateBox(
      `${parent.name}_wheel_${dx}_${dz}`,
      { width: 0.3, height: 0.6, depth: 0.6 },
      scene,
    );
    w.parent = parent;
    w.position = new Vector3(dx, 0.3, dz);
    w.material = wheelMat;
  }
}

/**
 * Build a chunky voxel panel van: long boxy cargo body, slightly
 * shorter forward cab with windscreen, four wheels, and a sliding
 * side door panel. Long axis runs along local +Z (cab at +Z front).
 */
export function buildVanMeshes(
  scene: Scene,
  parent: TransformNode,
  bodyHex: string,
  topHex: string,
): void {
  const bodyMat = new StandardMaterial(`${parent.name}_body_mat`, scene);
  bodyMat.diffuseColor = Color3.FromHexString(bodyHex);
  bodyMat.specularColor = new Color3(0.05, 0.05, 0.05);
  const topMat = new StandardMaterial(`${parent.name}_top_mat`, scene);
  topMat.diffuseColor = Color3.FromHexString(topHex);
  topMat.specularColor = new Color3(0.05, 0.05, 0.05);
  const winMat = new StandardMaterial(`${parent.name}_win_mat`, scene);
  winMat.diffuseColor = Color3.FromHexString("#cfe7ff");
  const darkMat = new StandardMaterial(`${parent.name}_dark_mat`, scene);
  darkMat.diffuseColor = Color3.FromHexString("#1c2230");

  // Tall cargo box (rear section).
  const body = MeshBuilder.CreateBox(
    `${parent.name}_body`,
    { width: 1.35, height: 1.35, depth: 1.7 },
    scene,
  );
  body.parent = parent;
  body.position = new Vector3(0, 0.85, -0.45);
  body.material = bodyMat;

  // Slightly shorter forward cab.
  const cab = MeshBuilder.CreateBox(
    `${parent.name}_cab`,
    { width: 1.3, height: 1.0, depth: 1.1 },
    scene,
  );
  cab.parent = parent;
  cab.position = new Vector3(0, 1.0, 0.85);
  cab.material = topMat;

  // Windscreen.
  const win = MeshBuilder.CreateBox(
    `${parent.name}_win`,
    { width: 1.32, height: 0.45, depth: 1.05 },
    scene,
  );
  win.parent = parent;
  win.position = new Vector3(0, 1.25, 0.9);
  win.material = winMat;

  // Side door panel (slightly recessed look via a darker stripe).
  const door = MeshBuilder.CreateBox(
    `${parent.name}_door`,
    { width: 1.38, height: 0.7, depth: 0.7 },
    scene,
  );
  door.parent = parent;
  door.position = new Vector3(0, 0.85, -0.45);
  const doorMat = new StandardMaterial(`${parent.name}_door_mat`, scene);
  doorMat.diffuseColor = Color3.FromHexString(topHex);
  doorMat.specularColor = new Color3(0.05, 0.05, 0.05);
  door.material = doorMat;

  // Front grille / bumper.
  const grille = MeshBuilder.CreateBox(
    `${parent.name}_grille`,
    { width: 1.32, height: 0.3, depth: 0.16 },
    scene,
  );
  grille.parent = parent;
  grille.position = new Vector3(0, 0.45, 1.45);
  grille.material = darkMat;

  // Four wheels.
  const wheelMat = new StandardMaterial(`${parent.name}_wheel_mat`, scene);
  wheelMat.diffuseColor = Color3.FromHexString("#1c2230");
  for (const [dx, dz] of [
    [0.6, 0.85],
    [-0.6, 0.85],
    [0.6, -1.0],
    [-0.6, -1.0],
  ] as Array<[number, number]>) {
    const w = MeshBuilder.CreateBox(
      `${parent.name}_wheel_${dx}_${dz}`,
      { width: 0.25, height: 0.5, depth: 0.5 },
      scene,
    );
    w.parent = parent;
    w.position = new Vector3(dx, 0.25, dz);
    w.material = wheelMat;
  }
}

/**
 * Build a Melbourne-style voxel tram: a long green body with a gold window
 * band, a roof pantograph, glowing destination boards at both ends and two
 * bogies underneath. Long axis runs along local +Z (like the other
 * vehicles); at ~6.4 units it's the longest vehicle in the neighbourhood.
 */
export function buildTramMeshes(
  scene: Scene,
  parent: TransformNode,
  bodyHex: string,
  topHex: string,
): void {
  const mat = (suffix: string, hex: string, glow = 0): StandardMaterial => {
    const m = new StandardMaterial(`${parent.name}_${suffix}_mat`, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.specularColor = new Color3(0.05, 0.05, 0.05);
    if (glow > 0) m.emissiveColor = Color3.FromHexString(hex).scale(glow);
    return m;
  };
  const box = (
    suffix: string,
    w: number,
    h: number,
    d: number,
    pos: Vector3,
    material: StandardMaterial,
  ): Mesh => {
    const b = MeshBuilder.CreateBox(
      `${parent.name}_${suffix}`,
      { width: w, height: h, depth: d },
      scene,
    );
    b.parent = parent;
    b.position = pos;
    b.material = material;
    return b;
  };
  const bodyMat = mat("body", bodyHex);
  const bandMat = mat("band", topHex);
  const winMat = mat("win", "#cfe7ff");
  const darkMat = mat("dark", "#1c2230");
  const signMat = mat("sign", "#ffb347", 0.6);

  // Green lower body, gold window band and a green roof cap.
  box("lower", 1.5, 0.75, 6.4, new Vector3(0, 0.62, 0), bodyMat);
  box("band", 1.52, 0.7, 6.2, new Vector3(0, 1.34, 0), bandMat);
  box("roof", 1.4, 0.18, 6.3, new Vector3(0, 1.78, 0), bodyMat);
  // Window strip along both sides plus a windscreen at each end.
  box("windows", 1.54, 0.42, 5.4, new Vector3(0, 1.36, 0), winMat);
  box("screenF", 1.3, 0.45, 0.06, new Vector3(0, 1.36, 3.12), winMat);
  box("screenB", 1.3, 0.45, 0.06, new Vector3(0, 1.36, -3.12), winMat);
  // Destination boards above the windscreens.
  box("destF", 1.0, 0.2, 0.06, new Vector3(0, 1.62, 3.13), signMat);
  box("destB", 1.0, 0.2, 0.06, new Vector3(0, 1.62, -3.13), signMat);
  // Bumpers.
  box("bumpF", 1.3, 0.18, 0.12, new Vector3(0, 0.36, 3.24), darkMat);
  box("bumpB", 1.3, 0.18, 0.12, new Vector3(0, 0.36, -3.24), darkMat);
  // Pantograph: base plate, angled arm and the contact shoe on top.
  box("pantoBase", 0.6, 0.1, 0.6, new Vector3(0, 1.92, 0), darkMat);
  const arm = box("pantoArm", 0.08, 0.9, 0.08, new Vector3(0, 2.3, 0.2), darkMat);
  arm.rotation.x = 0.5;
  box("pantoShoe", 0.9, 0.06, 0.12, new Vector3(0, 2.72, 0.42), darkMat);
  // Two bogies underneath.
  for (const dz of [-2.1, 2.1]) {
    box(`bogie_${dz}`, 1.2, 0.3, 1.2, new Vector3(0, 0.15, dz), darkMat);
  }
}

/**
 * Build a stubby voxel Mini Cooper-style hatchback: short, rounded
 * silhouette with a contrasting roof stripe. Long axis runs along
 * local +Z.
 */
function buildMiniCooperMeshes(
  scene: Scene,
  parent: TransformNode,
  bodyHex: string,
  topHex: string,
): void {
  const bodyMat = new StandardMaterial(`${parent.name}_body_mat`, scene);
  bodyMat.diffuseColor = Color3.FromHexString(bodyHex);
  bodyMat.specularColor = new Color3(0.05, 0.05, 0.05);
  const topMat = new StandardMaterial(`${parent.name}_top_mat`, scene);
  topMat.diffuseColor = Color3.FromHexString(topHex);
  const winMat = new StandardMaterial(`${parent.name}_win_mat`, scene);
  winMat.diffuseColor = Color3.FromHexString("#cfe7ff");

  // Short, squat body.
  const body = MeshBuilder.CreateBox(
    `${parent.name}_body`,
    { width: 1.2, height: 0.65, depth: 1.9 },
    scene,
  );
  body.parent = parent;
  body.position = new Vector3(0, 0.45, 0);
  body.material = bodyMat;

  // Rounded cabin slightly inset.
  const top = MeshBuilder.CreateBox(
    `${parent.name}_top`,
    { width: 1.1, height: 0.55, depth: 1.05 },
    scene,
  );
  top.parent = parent;
  top.position = new Vector3(0, 1.05, -0.05);
  top.material = topMat;

  // Wraparound windows.
  const win = MeshBuilder.CreateBox(
    `${parent.name}_win`,
    { width: 1.15, height: 0.32, depth: 0.95 },
    scene,
  );
  win.parent = parent;
  win.position = new Vector3(0, 1.1, -0.05);
  win.material = winMat;

  // Roof stripe (contrast).
  const stripeMat = new StandardMaterial(`${parent.name}_stripe_mat`, scene);
  stripeMat.diffuseColor = Color3.FromHexString("#f8f8f8");
  const stripe = MeshBuilder.CreateBox(
    `${parent.name}_stripe`,
    { width: 0.5, height: 0.06, depth: 1.05 },
    scene,
  );
  stripe.parent = parent;
  stripe.position = new Vector3(0, 1.36, -0.05);
  stripe.material = stripeMat;

  // Headlights (round-ish blocks).
  const headMat = new StandardMaterial(`${parent.name}_head_mat`, scene);
  headMat.diffuseColor = Color3.FromHexString("#fff5c8");
  headMat.emissiveColor = Color3.FromHexString("#fff5c8").scale(0.3);
  for (const dx of [-0.4, 0.4]) {
    const h = MeshBuilder.CreateBox(
      `${parent.name}_head_${dx}`,
      { width: 0.22, height: 0.22, depth: 0.08 },
      scene,
    );
    h.parent = parent;
    h.position = new Vector3(dx, 0.5, 0.95);
    h.material = headMat;
  }

  // Four small wheels.
  const wheelMat = new StandardMaterial(`${parent.name}_wheel_mat`, scene);
  wheelMat.diffuseColor = Color3.FromHexString("#1c2230");
  for (const [dx, dz] of [
    [0.5, 0.65],
    [-0.5, 0.65],
    [0.5, -0.65],
    [-0.5, -0.65],
  ] as Array<[number, number]>) {
    const w = MeshBuilder.CreateBox(
      `${parent.name}_wheel_${dx}_${dz}`,
      { width: 0.22, height: 0.42, depth: 0.42 },
      scene,
    );
    w.parent = parent;
    w.position = new Vector3(dx, 0.2, dz);
    w.material = wheelMat;
  }
}

/**
 * Build a voxel bicycle with a rider (frame + two wheels + handlebar +
 * seat + simple cyclist). Long axis runs along local +Z.
 */
function buildBicycleMeshes(
  scene: Scene,
  parent: TransformNode,
  frameHex: string,
  shirtHex: string,
): void {
  const frameMat = new StandardMaterial(`${parent.name}_frame_mat`, scene);
  frameMat.diffuseColor = Color3.FromHexString(frameHex);
  const wheelMat = new StandardMaterial(`${parent.name}_wheel_mat`, scene);
  wheelMat.diffuseColor = Color3.FromHexString("#1c2230");

  // Two thin wheels.
  for (const dz of [0.6, -0.6]) {
    const w = MeshBuilder.CreateBox(
      `${parent.name}_wheel_${dz}`,
      { width: 0.1, height: 0.55, depth: 0.55 },
      scene,
    );
    w.parent = parent;
    w.position = new Vector3(0, 0.3, dz);
    w.material = wheelMat;
  }

  // Frame: top tube + down tube approximated as two boxes.
  const top = MeshBuilder.CreateBox(
    `${parent.name}_frame_top`,
    { width: 0.1, height: 0.1, depth: 1.0 },
    scene,
  );
  top.parent = parent;
  top.position = new Vector3(0, 0.7, 0);
  top.material = frameMat;
  const down = MeshBuilder.CreateBox(
    `${parent.name}_frame_down`,
    { width: 0.1, height: 0.1, depth: 0.9 },
    scene,
  );
  down.parent = parent;
  down.position = new Vector3(0, 0.45, 0.05);
  down.material = frameMat;

  // Seat.
  const seatMat = new StandardMaterial(`${parent.name}_seat_mat`, scene);
  seatMat.diffuseColor = Color3.FromHexString("#1c2230");
  const seat = MeshBuilder.CreateBox(
    `${parent.name}_seat`,
    { width: 0.18, height: 0.08, depth: 0.3 },
    scene,
  );
  seat.parent = parent;
  seat.position = new Vector3(0, 0.92, -0.45);
  seat.material = seatMat;

  // Handlebars.
  const bar = MeshBuilder.CreateBox(
    `${parent.name}_bar`,
    { width: 0.5, height: 0.08, depth: 0.08 },
    scene,
  );
  bar.parent = parent;
  bar.position = new Vector3(0, 0.95, 0.55);
  bar.material = frameMat;

  // Rider: torso + head + arms + legs (no animation — silhouette only).
  const skinMat = new StandardMaterial(`${parent.name}_skin_mat`, scene);
  skinMat.diffuseColor = Color3.FromHexString("#e9c8a3");
  const shirtMat = new StandardMaterial(`${parent.name}_shirt_mat`, scene);
  shirtMat.diffuseColor = Color3.FromHexString(shirtHex);
  const trouserMat = new StandardMaterial(`${parent.name}_trouser_mat`, scene);
  trouserMat.diffuseColor = Color3.FromHexString("#2c3a52");

  const torso = MeshBuilder.CreateBox(
    `${parent.name}_torso`,
    { width: 0.45, height: 0.55, depth: 0.35 },
    scene,
  );
  torso.parent = parent;
  torso.position = new Vector3(0, 1.25, -0.25);
  torso.material = shirtMat;

  const head = MeshBuilder.CreateBox(
    `${parent.name}_head`,
    { width: 0.4, height: 0.4, depth: 0.4 },
    scene,
  );
  head.parent = parent;
  head.position = new Vector3(0, 1.7, -0.1);
  head.material = skinMat;

  // Helmet.
  const helmetMat = new StandardMaterial(`${parent.name}_helmet_mat`, scene);
  helmetMat.diffuseColor = Color3.FromHexString(frameHex);
  const helmet = MeshBuilder.CreateBox(
    `${parent.name}_helmet`,
    { width: 0.46, height: 0.18, depth: 0.46 },
    scene,
  );
  helmet.parent = parent;
  helmet.position = new Vector3(0, 1.95, -0.1);
  helmet.material = helmetMat;

  // Legs angled forward toward pedals.
  for (const dx of [-0.12, 0.12]) {
    const leg = MeshBuilder.CreateBox(
      `${parent.name}_leg_${dx}`,
      { width: 0.16, height: 0.55, depth: 0.16 },
      scene,
    );
    leg.parent = parent;
    leg.position = new Vector3(dx, 0.65, -0.1);
    leg.material = trouserMat;
  }
}

/**
 * Build a voxel kick scooter with a standing rider. Long axis runs
 * along local +Z (deck stretches forward to back).
 */
function buildScooterMeshes(
  scene: Scene,
  parent: TransformNode,
  deckHex: string,
  shirtHex: string,
): void {
  const deckMat = new StandardMaterial(`${parent.name}_deck_mat`, scene);
  deckMat.diffuseColor = Color3.FromHexString(deckHex);
  const wheelMat = new StandardMaterial(`${parent.name}_wheel_mat`, scene);
  wheelMat.diffuseColor = Color3.FromHexString("#1c2230");

  // Deck.
  const deck = MeshBuilder.CreateBox(
    `${parent.name}_deck`,
    { width: 0.3, height: 0.1, depth: 1.2 },
    scene,
  );
  deck.parent = parent;
  deck.position = new Vector3(0, 0.25, 0);
  deck.material = deckMat;

  // Wheels.
  for (const dz of [0.55, -0.55]) {
    const w = MeshBuilder.CreateBox(
      `${parent.name}_wheel_${dz}`,
      { width: 0.12, height: 0.32, depth: 0.32 },
      scene,
    );
    w.parent = parent;
    w.position = new Vector3(0, 0.18, dz);
    w.material = wheelMat;
  }

  // Stem + handlebar.
  const stem = MeshBuilder.CreateBox(
    `${parent.name}_stem`,
    { width: 0.1, height: 1.1, depth: 0.1 },
    scene,
  );
  stem.parent = parent;
  stem.position = new Vector3(0, 0.85, 0.55);
  stem.material = deckMat;
  const bar = MeshBuilder.CreateBox(
    `${parent.name}_bar`,
    { width: 0.5, height: 0.08, depth: 0.08 },
    scene,
  );
  bar.parent = parent;
  bar.position = new Vector3(0, 1.35, 0.55);
  bar.material = deckMat;

  // Rider standing on the deck.
  const skinMat = new StandardMaterial(`${parent.name}_skin_mat`, scene);
  skinMat.diffuseColor = Color3.FromHexString("#e9c8a3");
  const shirtMat = new StandardMaterial(`${parent.name}_shirt_mat`, scene);
  shirtMat.diffuseColor = Color3.FromHexString(shirtHex);
  const trouserMat = new StandardMaterial(`${parent.name}_trouser_mat`, scene);
  trouserMat.diffuseColor = Color3.FromHexString("#2c3a52");

  for (const dx of [-0.1, 0.1]) {
    const leg = MeshBuilder.CreateBox(
      `${parent.name}_leg_${dx}`,
      { width: 0.16, height: 0.55, depth: 0.18 },
      scene,
    );
    leg.parent = parent;
    leg.position = new Vector3(dx, 0.6, 0);
    leg.material = trouserMat;
  }

  const torso = MeshBuilder.CreateBox(
    `${parent.name}_torso`,
    { width: 0.45, height: 0.55, depth: 0.35 },
    scene,
  );
  torso.parent = parent;
  torso.position = new Vector3(0, 1.2, 0);
  torso.material = shirtMat;

  const head = MeshBuilder.CreateBox(
    `${parent.name}_head`,
    { width: 0.4, height: 0.4, depth: 0.4 },
    scene,
  );
  head.parent = parent;
  head.position = new Vector3(0, 1.65, 0.05);
  head.material = skinMat;
}

/**
 * Dispatch to the correct vehicle builder based on `type`.
 */
function buildVehicleMeshes(
  scene: Scene,
  parent: TransformNode,
  type: VehicleType,
  bodyHex: string,
  topHex: string,
): void {
  switch (type) {
    case "jeep":
      buildJeepMeshes(scene, parent, bodyHex, topHex);
      return;
    case "mini":
      buildMiniCooperMeshes(scene, parent, bodyHex, topHex);
      return;
    case "bicycle":
      buildBicycleMeshes(scene, parent, bodyHex, topHex);
      return;
    case "scooter":
      buildScooterMeshes(scene, parent, bodyHex, topHex);
      return;
    case "van":
      buildVanMeshes(scene, parent, bodyHex, topHex);
      return;
    case "tram":
      buildTramMeshes(scene, parent, bodyHex, topHex);
      return;
    case "sedan":
    default:
      buildCarMeshes(scene, parent, bodyHex, topHex);
      return;
  }
}

/**
 * Build a small voxel dog (body + head + tail + 4 legs) parented under a
 * single TransformNode. Tail wags via a child pivot; legs jiggle while
 * walking.
 */
function buildDogMeshes(
  scene: Scene,
  parent: TransformNode,
  furHex: string,
): {
  legs: Mesh[];
  tail: TransformNode;
} {
  const furMat = new StandardMaterial(`${parent.name}_fur_mat`, scene);
  furMat.diffuseColor = Color3.FromHexString(furHex);
  furMat.specularColor = new Color3(0.05, 0.05, 0.05);

  const noseMat = new StandardMaterial(`${parent.name}_nose_mat`, scene);
  noseMat.diffuseColor = Color3.FromHexString("#1c2230");

  const body = MeshBuilder.CreateBox(
    `${parent.name}_body`,
    { width: 0.9, height: 0.45, depth: 0.5 },
    scene,
  );
  body.parent = parent;
  body.position = new Vector3(0, 0.45, 0);
  body.material = furMat;

  const head = MeshBuilder.CreateBox(
    `${parent.name}_head`,
    { width: 0.45, height: 0.45, depth: 0.45 },
    scene,
  );
  head.parent = parent;
  head.position = new Vector3(0.55, 0.6, 0);
  head.material = furMat;

  const nose = MeshBuilder.CreateBox(
    `${parent.name}_nose`,
    { width: 0.18, height: 0.18, depth: 0.18 },
    scene,
  );
  nose.parent = parent;
  nose.position = new Vector3(0.85, 0.55, 0);
  nose.material = noseMat;

  // Tail with a pivot so it can wag.
  const tailPivot = new TransformNode(`${parent.name}_tail_pivot`, scene);
  tailPivot.parent = parent;
  tailPivot.position = new Vector3(-0.45, 0.55, 0);
  const tail = MeshBuilder.CreateBox(
    `${parent.name}_tail`,
    { width: 0.25, height: 0.12, depth: 0.12 },
    scene,
  );
  tail.parent = tailPivot;
  tail.position = new Vector3(-0.15, 0.05, 0);
  tail.material = furMat;

  // Legs.
  const legs: Mesh[] = [];
  for (const [dx, dz] of [
    [0.3, 0.18],
    [-0.3, 0.18],
    [0.3, -0.18],
    [-0.3, -0.18],
  ] as Array<[number, number]>) {
    const leg = MeshBuilder.CreateBox(
      `${parent.name}_leg_${dx}_${dz}`,
      { width: 0.16, height: 0.3, depth: 0.16 },
      scene,
    );
    leg.parent = parent;
    leg.position = new Vector3(dx, 0.18, dz);
    leg.material = furMat;
    legs.push(leg);
  }

  return { legs, tail: tailPivot };
}

/**
 * Pet types supported by {@link NeighbourhoodAmbient.addPet}.
 */
export type PetType = "dog" | "cat" | "rabbit";

/**
 * Build a small voxel cat (slim body + perked ears + upright tail).
 * Same return contract as {@link buildDogMeshes} so the wandering
 * mover can drive it identically.
 */
function buildCatMeshes(
  scene: Scene,
  parent: TransformNode,
  furHex: string,
): {
  legs: Mesh[];
  tail: TransformNode;
} {
  const furMat = new StandardMaterial(`${parent.name}_fur_mat`, scene);
  furMat.diffuseColor = Color3.FromHexString(furHex);
  furMat.specularColor = new Color3(0.05, 0.05, 0.05);
  const darkMat = new StandardMaterial(`${parent.name}_dark_mat`, scene);
  darkMat.diffuseColor = Color3.FromHexString("#1c2230");

  const body = MeshBuilder.CreateBox(
    `${parent.name}_body`,
    { width: 0.75, height: 0.35, depth: 0.4 },
    scene,
  );
  body.parent = parent;
  body.position = new Vector3(0, 0.4, 0);
  body.material = furMat;

  const head = MeshBuilder.CreateBox(
    `${parent.name}_head`,
    { width: 0.38, height: 0.38, depth: 0.38 },
    scene,
  );
  head.parent = parent;
  head.position = new Vector3(0.5, 0.55, 0);
  head.material = furMat;

  // Two pointy ears.
  for (const dz of [-0.1, 0.1]) {
    const ear = MeshBuilder.CreateBox(
      `${parent.name}_ear_${dz}`,
      { width: 0.12, height: 0.18, depth: 0.12 },
      scene,
    );
    ear.parent = parent;
    ear.position = new Vector3(0.5, 0.82, dz);
    ear.material = furMat;
  }

  // Nose.
  const nose = MeshBuilder.CreateBox(
    `${parent.name}_nose`,
    { width: 0.12, height: 0.12, depth: 0.12 },
    scene,
  );
  nose.parent = parent;
  nose.position = new Vector3(0.72, 0.5, 0);
  nose.material = darkMat;

  // Upright tail with pivot at the base for a gentle sway.
  const tailPivot = new TransformNode(`${parent.name}_tail_pivot`, scene);
  tailPivot.parent = parent;
  tailPivot.position = new Vector3(-0.38, 0.5, 0);
  const tail = MeshBuilder.CreateBox(
    `${parent.name}_tail`,
    { width: 0.12, height: 0.5, depth: 0.12 },
    scene,
  );
  tail.parent = tailPivot;
  tail.position = new Vector3(-0.05, 0.25, 0);
  tail.material = furMat;

  const legs: Mesh[] = [];
  for (const [dx, dz] of [
    [0.25, 0.14],
    [-0.25, 0.14],
    [0.25, -0.14],
    [-0.25, -0.14],
  ] as Array<[number, number]>) {
    const leg = MeshBuilder.CreateBox(
      `${parent.name}_leg_${dx}_${dz}`,
      { width: 0.13, height: 0.28, depth: 0.13 },
      scene,
    );
    leg.parent = parent;
    leg.position = new Vector3(dx, 0.16, dz);
    leg.material = furMat;
    legs.push(leg);
  }

  return { legs, tail: tailPivot };
}

/**
 * Build a small voxel rabbit (round body + tall ears + puff tail).
 * Same return contract as {@link buildDogMeshes}.
 */
function buildRabbitMeshes(
  scene: Scene,
  parent: TransformNode,
  furHex: string,
): {
  legs: Mesh[];
  tail: TransformNode;
} {
  const furMat = new StandardMaterial(`${parent.name}_fur_mat`, scene);
  furMat.diffuseColor = Color3.FromHexString(furHex);
  furMat.specularColor = new Color3(0.05, 0.05, 0.05);
  const tailMat = new StandardMaterial(`${parent.name}_tail_mat`, scene);
  tailMat.diffuseColor = Color3.FromHexString("#f8f4ee");
  const darkMat = new StandardMaterial(`${parent.name}_dark_mat`, scene);
  darkMat.diffuseColor = Color3.FromHexString("#1c2230");

  const body = MeshBuilder.CreateBox(
    `${parent.name}_body`,
    { width: 0.55, height: 0.4, depth: 0.45 },
    scene,
  );
  body.parent = parent;
  body.position = new Vector3(0, 0.4, 0);
  body.material = furMat;

  const head = MeshBuilder.CreateBox(
    `${parent.name}_head`,
    { width: 0.38, height: 0.34, depth: 0.34 },
    scene,
  );
  head.parent = parent;
  head.position = new Vector3(0.4, 0.6, 0);
  head.material = furMat;

  // Two tall ears.
  for (const dz of [-0.12, 0.12]) {
    const ear = MeshBuilder.CreateBox(
      `${parent.name}_ear_${dz}`,
      { width: 0.1, height: 0.4, depth: 0.12 },
      scene,
    );
    ear.parent = parent;
    ear.position = new Vector3(0.4, 0.95, dz);
    ear.material = furMat;
  }

  // Eye dots.
  for (const dz of [-0.1, 0.1]) {
    const eye = MeshBuilder.CreateBox(
      `${parent.name}_eye_${dz}`,
      { width: 0.06, height: 0.06, depth: 0.06 },
      scene,
    );
    eye.parent = parent;
    eye.position = new Vector3(0.55, 0.65, dz);
    eye.material = darkMat;
  }

  // Puff tail (no real wag — pivot is here for animation parity).
  const tailPivot = new TransformNode(`${parent.name}_tail_pivot`, scene);
  tailPivot.parent = parent;
  tailPivot.position = new Vector3(-0.3, 0.45, 0);
  const tail = MeshBuilder.CreateBox(
    `${parent.name}_tail`,
    { width: 0.16, height: 0.16, depth: 0.16 },
    scene,
  );
  tail.parent = tailPivot;
  tail.position = new Vector3(0, 0, 0);
  tail.material = tailMat;

  const legs: Mesh[] = [];
  // Front legs short, back legs longer (rabbit hop posture).
  for (const [dx, dz, h] of [
    [0.18, 0.14, 0.25],
    [0.18, -0.14, 0.25],
    [-0.18, 0.16, 0.36],
    [-0.18, -0.16, 0.36],
  ] as Array<[number, number, number]>) {
    const leg = MeshBuilder.CreateBox(
      `${parent.name}_leg_${dx}_${dz}`,
      { width: 0.13, height: h, depth: 0.18 },
      scene,
    );
    leg.parent = parent;
    leg.position = new Vector3(dx, h / 2, dz);
    leg.material = furMat;
    legs.push(leg);
  }

  return { legs, tail: tailPivot };
}

/**
 * Build a small voxel bird (body + head + two wings + tail). The
 * wings are returned as separate meshes so the flying mover can flap
 * them on every frame.
 */
function buildBirdMeshes(
  scene: Scene,
  parent: TransformNode,
  bodyHex: string,
  wingHex: string,
): { wings: Mesh[] } {
  const bodyMat = new StandardMaterial(`${parent.name}_body_mat`, scene);
  bodyMat.diffuseColor = Color3.FromHexString(bodyHex);
  const wingMat = new StandardMaterial(`${parent.name}_wing_mat`, scene);
  wingMat.diffuseColor = Color3.FromHexString(wingHex);
  const beakMat = new StandardMaterial(`${parent.name}_beak_mat`, scene);
  beakMat.diffuseColor = Color3.FromHexString("#e8a13a");
  const eyeMat = new StandardMaterial(`${parent.name}_eye_mat`, scene);
  eyeMat.diffuseColor = Color3.FromHexString("#1c2230");

  const body = MeshBuilder.CreateBox(
    `${parent.name}_body`,
    { width: 0.32, height: 0.3, depth: 0.5 },
    scene,
  );
  body.parent = parent;
  body.position = new Vector3(0, 0, 0);
  body.material = bodyMat;

  const head = MeshBuilder.CreateBox(
    `${parent.name}_head`,
    { width: 0.28, height: 0.28, depth: 0.28 },
    scene,
  );
  head.parent = parent;
  head.position = new Vector3(0, 0.15, 0.32);
  head.material = bodyMat;

  const beak = MeshBuilder.CreateBox(
    `${parent.name}_beak`,
    { width: 0.1, height: 0.08, depth: 0.14 },
    scene,
  );
  beak.parent = parent;
  beak.position = new Vector3(0, 0.12, 0.5);
  beak.material = beakMat;

  for (const dx of [-0.1, 0.1]) {
    const eye = MeshBuilder.CreateBox(
      `${parent.name}_eye_${dx}`,
      { width: 0.05, height: 0.05, depth: 0.05 },
      scene,
    );
    eye.parent = parent;
    eye.position = new Vector3(dx, 0.2, 0.42);
    eye.material = eyeMat;
  }

  const tail = MeshBuilder.CreateBox(
    `${parent.name}_tail`,
    { width: 0.28, height: 0.06, depth: 0.18 },
    scene,
  );
  tail.parent = parent;
  tail.position = new Vector3(0, 0.02, -0.32);
  tail.material = wingMat;

  // Two wings hinged near the body so they can flap (rotation around Z).
  const wings: Mesh[] = [];
  for (const dx of [-0.28, 0.28]) {
    const wing = MeshBuilder.CreateBox(
      `${parent.name}_wing_${dx}`,
      { width: 0.4, height: 0.08, depth: 0.3 },
      scene,
    );
    wing.parent = parent;
    wing.position = new Vector3(dx, 0.05, 0);
    wing.material = wingMat;
    wings.push(wing);
  }

  return { wings };
}

/**
 * Move `parent` toward `target` along the XZ plane at `speed` units/sec.
 * Returns true if the parent has reached the target this frame.
 */
function stepToward(
  parent: TransformNode,
  target: Vector3,
  speed: number,
  dtSec: number,
): boolean {
  const dx = target.x - parent.position.x;
  const dz = target.z - parent.position.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.05) return true;
  const step = Math.min(dist, speed * dtSec);
  const nx = dx / dist;
  const nz = dz / dist;
  parent.position.x += nx * step;
  parent.position.z += nz * step;
  parent.rotation.y = Math.atan2(nx, nz);
  return dist - step < 0.05;
}

/**
 * Ambient controller for the neighbourhood scene: cars driving in
 * loops, pedestrians walking sidewalks, pets wandering grassy areas,
 * and per-scenario life-event animations (e.g. the retirement
 * confetti). Wired into the per-frame tick from `main.ts` whenever the
 * neighbourhood scene is the active rendered scene.
 */
export class NeighbourhoodAmbient {
  private movers: Mover[] = [];
  private incidents = new Map<ScenarioId, IncidentAnimation>();
  private activeIncident: IncidentAnimation | null = null;

  constructor(private readonly scene: Scene, private readonly root: TransformNode) {}

  /**
   * Spawn a vehicle that drives back and forth along the supplied
   * route. Defaults to a sedan; pass `type` for a jeep, mini cooper,
   * bicycle, scooter, delivery van or tram so ambient traffic feels
   * varied. The
   * route is a simple list of XZ waypoints; the vehicle loops them
   * forever (A → B → ... → A → B → ...).
   */
  addCar(
    id: string,
    waypoints: Array<[number, number]>,
    opts: {
      bodyColor?: string;
      topColor?: string;
      speed?: number;
      type?: VehicleType;
    } = {},
  ): void {
    if (waypoints.length < 2) return;
    const vehicleType: VehicleType = opts.type ?? "sedan";
    const carRoot = new TransformNode(`nh_car_${id}`, this.scene);
    carRoot.parent = this.root;
    buildVehicleMeshes(
      this.scene,
      carRoot,
      vehicleType,
      opts.bodyColor ?? "#3a8fd6",
      opts.topColor ?? "#2a6fb0",
    );
    const start = waypoints[0];
    carRoot.position = new Vector3(start[0], 0.05, start[1]);
    // Orient the car along the first leg so it doesn't pop into rotation
    // on the very first frame.
    {
      const next = waypoints[1];
      const nx = next[0] - start[0];
      const nz = next[1] - start[1];
      carRoot.rotation.y = Math.atan2(nx, nz);
    }
    let idx = 1;
    const speed = opts.speed ?? 4.5;
    this.movers.push({
      update: (dt) => {
        const wp = waypoints[idx];
        const target = new Vector3(wp[0], 0.05, wp[1]);
        if (stepToward(carRoot, target, speed, dt)) {
          idx++;
          if (idx >= waypoints.length) {
            // Loop one-way: teleport back to the start of the route so
            // the car always travels in the intended direction along its
            // lane, instead of bouncing back along it in reverse.
            const first = waypoints[0];
            carRoot.position.x = first[0];
            carRoot.position.z = first[1];
            const next = waypoints[1];
            carRoot.rotation.y = Math.atan2(
              next[0] - first[0],
              next[1] - first[1],
            );
            idx = 1;
          }
        }
      },
    });
  }

  /**
   * Spawn a wandering voxel pedestrian that paces between the supplied
   * waypoints and animates their walk cycle while moving.
   */
  addPedestrian(
    id: string,
    paletteKey: keyof typeof PALETTES,
    waypoints: Array<[number, number]>,
    speed = 1.6,
  ): VoxelCharacter | null {
    if (waypoints.length < 2) return null;
    const palette = PALETTES[paletteKey];
    const ch = new VoxelCharacter(this.scene, `nh_amb_${id}`, palette);
    ch.root.parent = this.root;
    const start = waypoints[0];
    ch.root.position = new Vector3(start[0], 0, start[1]);
    let idx = 1;
    let pauseTimer = 0;
    ch.setWalking(true);
    this.movers.push({
      update: (dt) => {
        ch.update(dt);
        if (pauseTimer > 0) {
          pauseTimer -= dt;
          if (pauseTimer <= 0) ch.setWalking(true);
          return;
        }
        const wp = waypoints[idx];
        const target = new Vector3(wp[0], 0, wp[1]);
        if (stepToward(ch.root, target, speed, dt)) {
          idx = (idx + 1) % waypoints.length;
          // Brief pause at each waypoint so the route reads as natural.
          pauseTimer = 0.6 + Math.random() * 0.8;
          ch.setWalking(false);
        }
      },
    });
    return ch;
  }

  /**
   * Spawn a wandering pet (voxel dog, cat, or rabbit) that bumbles
   * around inside the supplied circular grass patch. Picks a fresh
   * random target whenever it arrives.
   */
  addPet(
    id: string,
    home: { cx: number; cz: number; radius: number },
    opts: { furColor?: string; speed?: number; type?: PetType } = {},
  ): void {
    const petRoot = new TransformNode(`nh_pet_${id}`, this.scene);
    petRoot.parent = this.root;
    const petType: PetType = opts.type ?? "dog";
    const furColor = opts.furColor ?? "#c8a878";
    const built =
      petType === "cat"
        ? buildCatMeshes(this.scene, petRoot, furColor)
        : petType === "rabbit"
          ? buildRabbitMeshes(this.scene, petRoot, furColor)
          : buildDogMeshes(this.scene, petRoot, furColor);
    const { legs, tail } = built;
    petRoot.position = new Vector3(home.cx, 0, home.cz);
    let target = new Vector3(home.cx, 0, home.cz);
    let pauseTimer = 0;
    let phase = 0;
    const speed = opts.speed ?? 1.2;
    const pickTarget = (): void => {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * home.radius;
      target = new Vector3(
        home.cx + Math.cos(angle) * r,
        0,
        home.cz + Math.sin(angle) * r,
      );
    };
    pickTarget();
    // Per-pet baseline for leg height (rabbits sit lower than dogs).
    const legBaseY = legs.map((l) => l.position.y);
    this.movers.push({
      update: (dt) => {
        // Tail / cat-tail / rabbit puff sways gently.
        phase += dt * (petType === "cat" ? 4 : petType === "rabbit" ? 6 : 8);
        if (petType === "cat") {
          tail.rotation.x = Math.sin(phase) * 0.25;
        } else if (petType === "rabbit") {
          tail.rotation.y = Math.sin(phase) * 0.2;
        } else {
          tail.rotation.y = Math.sin(phase) * 0.6;
        }
        if (pauseTimer > 0) {
          pauseTimer -= dt;
          // Settle legs while paused.
          legs.forEach((l, i) => (l.position.y = legBaseY[i]));
          return;
        }
        if (stepToward(petRoot, target, speed, dt)) {
          pauseTimer = 0.8 + Math.random() * 1.2;
          pickTarget();
          return;
        }
        if (petType === "rabbit") {
          // Rabbit hops: bob whole pet vertically.
          const hop = Math.max(0, Math.sin(phase * 1.6) * 0.18);
          petRoot.position.y = hop;
        } else {
          // Bouncy leg shuffle while walking.
          const bounce = Math.sin(phase * 1.4) * 0.04;
          legs[0].position.y = legBaseY[0] + Math.max(0, bounce);
          legs[3].position.y = legBaseY[3] + Math.max(0, bounce);
          legs[1].position.y = legBaseY[1] + Math.max(0, -bounce);
          legs[2].position.y = legBaseY[2] + Math.max(0, -bounce);
        }
      },
    });
  }

  /**
   * Spawn a flying bird that loops along the supplied XZ waypoints at
   * the given altitude. Wings flap on every frame and the body bobs
   * gently. Routes loop one-way (A → B → ... → A) like {@link addCar}.
   */
  addBird(
    id: string,
    waypoints: Array<[number, number]>,
    opts: {
      bodyColor?: string;
      wingColor?: string;
      altitude?: number;
      speed?: number;
    } = {},
  ): void {
    if (waypoints.length < 2) return;
    const birdRoot = new TransformNode(`nh_bird_${id}`, this.scene);
    birdRoot.parent = this.root;
    const { wings } = buildBirdMeshes(
      this.scene,
      birdRoot,
      opts.bodyColor ?? "#3a4a52",
      opts.wingColor ?? "#1c2a32",
    );
    const altitude = opts.altitude ?? 6;
    const start = waypoints[0];
    birdRoot.position = new Vector3(start[0], altitude, start[1]);
    {
      const next = waypoints[1];
      const nx = next[0] - start[0];
      const nz = next[1] - start[1];
      birdRoot.rotation.y = Math.atan2(nx, nz);
    }
    let idx = 1;
    const speed = opts.speed ?? 5.5;
    let phase = Math.random() * Math.PI * 2;
    this.movers.push({
      update: (dt) => {
        phase += dt * 14;
        // Flap wings around local Z so they flick up and down on the sides.
        const flap = Math.sin(phase) * 0.9;
        wings[0].rotation.z = flap;
        wings[1].rotation.z = -flap;
        // Gentle vertical bob.
        birdRoot.position.y = altitude + Math.sin(phase * 0.5) * 0.25;
        const wp = waypoints[idx];
        const target = new Vector3(wp[0], birdRoot.position.y, wp[1]);
        if (stepToward(birdRoot, target, speed, dt)) {
          idx++;
          if (idx >= waypoints.length) {
            const first = waypoints[0];
            birdRoot.position.x = first[0];
            birdRoot.position.z = first[1];
            const next = waypoints[1];
            birdRoot.rotation.y = Math.atan2(
              next[0] - first[0],
              next[1] - first[1],
            );
            idx = 1;
          }
        }
      },
    });
  }

  /**
   * Register a free-running ambient animation that ticks every frame.
   * Useful for permanent props that should always be alive (e.g. the
   * retirement balloons bobbing in the breeze), as opposed to
   * the scripted, scenario-bound incidents handled by {@link
   * registerIncident}.
   */
  addAnimation(update: (dtSec: number) => void): void {
    this.movers.push({ update });
  }

  /** Register an incident animation for a given scenario. */
  registerIncident(id: ScenarioId, anim: IncidentAnimation): void {
    this.incidents.set(id, anim);
  }

  /**
   * Trigger the scenario's incident animation. Stops any incident that
   * was already in flight so a new scenario can overwrite the old one.
   */
  playIncident(id: ScenarioId): void {
    const anim = this.incidents.get(id);
    if (this.activeIncident && this.activeIncident !== anim) {
      this.activeIncident.stop();
    }
    if (!anim) {
      this.activeIncident = null;
      return;
    }
    this.activeIncident = anim;
    anim.start();
  }

  /** Stop the currently-playing incident (e.g. on cancel). */
  clearIncident(): void {
    if (this.activeIncident) {
      this.activeIncident.stop();
      this.activeIncident = null;
    }
  }

  /** Per-frame tick invoked from the render loop. */
  update(dtSec: number): void {
    for (const m of this.movers) m.update(dtSec);
    if (this.activeIncident) this.activeIncident.update(dtSec);
  }
}

/* ------------------------------------------------------------------------ */
/* Life-event animation factories                                           */
/* ------------------------------------------------------------------------ */

/** A reusable pop of voxel confetti that pops up and flutters down. */
interface ConfettiPop {
  launch(origin: Vector3): void;
  update(dtSec: number): void;
  reset(): void;
}

function createConfettiPop(
  scene: Scene,
  root: TransformNode,
  name: string,
  colors: string[],
  count = 28,
): ConfettiPop {
  const mats = colors.map((hex, i) => {
    const m = new StandardMaterial(`${name}_mat_${i}`, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.emissiveColor = Color3.FromHexString(hex).scale(0.35);
    m.specularColor = new Color3(0, 0, 0);
    return m;
  });
  const pieces: Array<{ mesh: Mesh; vel: Vector3; spin: Vector3; life: number }> = [];
  for (let i = 0; i < count; i++) {
    const mesh = MeshBuilder.CreateBox(
      `${name}_${i}`,
      { width: 0.18, height: 0.04, depth: 0.12 },
      scene,
    );
    mesh.parent = root;
    mesh.material = mats[i % mats.length];
    mesh.isPickable = false;
    mesh.isVisible = false;
    pieces.push({ mesh, vel: Vector3.Zero(), spin: Vector3.Zero(), life: 0 });
  }
  return {
    launch: (origin) => {
      for (const p of pieces) {
        const angle = Math.random() * Math.PI * 2;
        const out = 0.8 + Math.random() * 2.0;
        p.vel = new Vector3(
          Math.cos(angle) * out,
          4.0 + Math.random() * 2.5,
          Math.sin(angle) * out,
        );
        p.spin = new Vector3(
          Math.random() * 10 - 5,
          Math.random() * 10 - 5,
          Math.random() * 10 - 5,
        );
        p.life = 2.4 + Math.random() * 1.4;
        p.mesh.position = origin.clone();
        p.mesh.isVisible = true;
      }
    },
    update: (dt) => {
      const drag = Math.exp(-1.4 * dt);
      for (const p of pieces) {
        if (!p.mesh.isVisible) continue;
        // Light gravity with a capped fall speed so the pieces flutter down.
        p.vel.y = Math.max(-1.4, p.vel.y - 7.0 * dt);
        p.vel.x *= drag;
        p.vel.z *= drag;
        p.mesh.position.addInPlace(p.vel.scale(dt));
        p.mesh.rotation.addInPlace(p.spin.scale(dt));
        p.life -= dt;
        if (p.life <= 0 || p.mesh.position.y <= 0.08) p.mesh.isVisible = false;
      }
    },
    reset: () => {
      for (const p of pieces) p.mesh.isVisible = false;
    },
  };
}

/**
 * New job (onboarding): two pops of confetti in Caldova's department
 * colours over the Docklands forecourt — a fresh start worth celebrating.
 */
export function makeCelebrationIncident(
  scene: Scene,
  root: TransformNode,
  origin: Vector3,
): IncidentAnimation {
  const colors = ["#0ea5e9", "#ffd166", "#ec4899", "#10b981", "#ffffff"];
  const first = createConfettiPop(scene, root, "nh_newjob_confetti_a", colors);
  const second = createConfettiPop(scene, root, "nh_newjob_confetti_b", colors);
  let elapsed = 0;
  let running = false;
  let secondFired = false;
  const duration = 4.5;

  const reset = (): void => {
    first.reset();
    second.reset();
  };

  return {
    durationSec: duration,
    start: () => {
      elapsed = 0;
      running = true;
      secondFired = false;
      reset();
      first.launch(origin);
    },
    stop: () => {
      running = false;
      reset();
    },
    update: (dt) => {
      if (!running) return;
      elapsed += dt;
      if (!secondFired && elapsed >= 1.2) {
        secondFired = true;
        second.launch(origin.add(new Vector3(1.2, 0.6, 0.4)));
      }
      first.update(dt);
      second.update(dt);
      if (elapsed >= duration) {
        running = false;
        reset();
      }
    },
  };
}

/**
 * Identity-takeover attempt (protection): red rings pulse outward around
 * the member like a radar ping while a phone alert badge bounces overhead —
 * someone is trying to move her super while she is overseas.
 */
export function makeIdentityAlertIncident(
  scene: Scene,
  root: TransformNode,
  center: Vector3,
): IncidentAnimation {
  const rings: Array<{ mesh: Mesh; mat: StandardMaterial }> = [];
  for (let i = 0; i < 2; i++) {
    const mesh = MeshBuilder.CreateTorus(
      `nh_alert_ring_${i}`,
      { diameter: 2.4, thickness: 0.14, tessellation: 40 },
      scene,
    );
    mesh.parent = root;
    mesh.position = new Vector3(center.x, 0.14, center.z);
    const mat = new StandardMaterial(`nh_alert_ring_mat_${i}`, scene);
    mat.diffuseColor = Color3.FromHexString("#ef4444");
    mat.emissiveColor = Color3.FromHexString("#ef4444");
    mat.specularColor = new Color3(0, 0, 0);
    mat.alpha = 0;
    mesh.material = mat;
    mesh.isPickable = false;
    mesh.isVisible = false;
    rings.push({ mesh, mat });
  }

  // Bouncing alert badge: a red disc with a phone glyph, always facing
  // the camera.
  const badge = MeshBuilder.CreatePlane(
    "nh_alert_badge",
    { width: 1.1, height: 1.1 },
    scene,
  );
  badge.parent = root;
  badge.billboardMode = Mesh.BILLBOARDMODE_ALL;
  badge.isPickable = false;
  badge.isVisible = false;
  const tex = new DynamicTexture("nh_alert_badge_tex", { width: 256, height: 256 }, scene, false);
  tex.hasAlpha = true;
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, 256, 256);
  ctx.beginPath();
  ctx.arc(128, 128, 112, 0, Math.PI * 2);
  ctx.fillStyle = "#ef4444";
  ctx.fill();
  ctx.lineWidth = 12;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  ctx.font = "120px 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("📱", 128, 136);
  tex.update();
  const badgeMat = new StandardMaterial("nh_alert_badge_mat", scene);
  badgeMat.diffuseTexture = tex;
  badgeMat.opacityTexture = tex;
  badgeMat.emissiveColor = new Color3(1, 1, 1);
  badgeMat.disableLighting = true;
  badgeMat.backFaceCulling = false;
  badge.material = badgeMat;
  const badgeBaseY = center.y + 3.2;

  let elapsed = 0;
  let running = false;
  const duration = 4.5;

  const hide = (): void => {
    for (const r of rings) {
      r.mesh.isVisible = false;
      r.mat.alpha = 0;
    }
    badge.isVisible = false;
  };
  hide();

  return {
    durationSec: duration,
    start: () => {
      elapsed = 0;
      running = true;
      for (const r of rings) r.mesh.isVisible = true;
      badge.isVisible = true;
      badge.position = new Vector3(center.x, badgeBaseY, center.z);
    },
    stop: () => {
      running = false;
      hide();
    },
    update: (dt) => {
      if (!running) return;
      elapsed += dt;
      // Each ring expands and fades over 1.4 s, offset by half a cycle.
      for (let i = 0; i < rings.length; i++) {
        const phase = (elapsed / 1.4 + i * 0.5) % 1;
        const s = 0.5 + phase * 1.7;
        rings[i].mesh.scaling = new Vector3(s, 1, s);
        rings[i].mat.alpha = (1 - phase) * 0.85;
      }
      badge.position.y = badgeBaseY + Math.abs(Math.sin(elapsed * 4.2)) * 0.55;
      if (elapsed >= duration) {
        running = false;
        hide();
      }
    },
  };
}

/**
 * Retirement: the "Happy Retirement" banner unfurls with a little bounce
 * and confetti pops over the front garden.
 */
export function makeRetirementIncident(
  scene: Scene,
  root: TransformNode,
  banner: Mesh,
  confettiOrigin: Vector3,
): IncidentAnimation {
  const baseScale = banner.scaling.clone();
  const baseRotZ = banner.rotation.z;
  const colors = ["#e8a33d", "#ffd166", "#3a8fd6", "#d9534f", "#ffffff"];
  const first = createConfettiPop(scene, root, "nh_retire_confetti_a", colors);
  const second = createConfettiPop(scene, root, "nh_retire_confetti_b", colors);
  let elapsed = 0;
  let running = false;
  let secondFired = false;
  const duration = 4.5;

  const restore = (): void => {
    banner.scaling = baseScale.clone();
    banner.rotation.z = baseRotZ;
    first.reset();
    second.reset();
  };

  return {
    durationSec: duration,
    start: () => {
      elapsed = 0;
      running = true;
      secondFired = false;
      restore();
      banner.scaling = new Vector3(baseScale.x, baseScale.y * 0.05, baseScale.z);
      first.launch(confettiOrigin);
    },
    stop: () => {
      running = false;
      restore();
    },
    update: (dt) => {
      if (!running) return;
      elapsed += dt;
      // Unfurl over 0.6 s with a small overshoot, then sway gently.
      const t = Math.min(1, elapsed / 0.6);
      const overshoot = Math.sin(t * Math.PI) * 0.2;
      banner.scaling.y = baseScale.y * Math.max(0.05, t + overshoot);
      banner.rotation.z = baseRotZ + Math.sin(elapsed * 3) * 0.03;
      if (!secondFired && elapsed >= 1.5) {
        secondFired = true;
        second.launch(confettiOrigin.add(new Vector3(-1.4, 0.3, 0)));
      }
      first.update(dt);
      second.update(dt);
      if (elapsed >= duration) {
        running = false;
        restore();
      }
    },
  };
}

/**
 * Financial hardship (café closed): a soft grey cloud gathers over the
 * shuttered café while the shopfront pavement dims — a quiet, respectful
 * cue rather than an alarm.
 */
export function makeHardshipCloudIncident(
  scene: Scene,
  root: TransformNode,
  cloudCenter: Vector3,
  groundCenter: Vector3,
): IncidentAnimation {
  const cloudMat = new StandardMaterial("nh_hardship_cloud_mat", scene);
  cloudMat.diffuseColor = Color3.FromHexString("#9aa0a8");
  cloudMat.emissiveColor = Color3.FromHexString("#5a6068");
  cloudMat.specularColor = new Color3(0, 0, 0);
  cloudMat.alpha = 0;
  const puffs: Array<{ mesh: Mesh; base: Vector3 }> = [];
  const puffDefs: Array<[number, number, number, number]> = [
    // [dx, dy, dz, size]
    [-0.9, 0, 0, 1.4],
    [0.4, 0.3, 0.2, 1.7],
    [1.5, -0.05, -0.1, 1.2],
    [-0.1, 0.55, -0.3, 1.1],
  ];
  for (let i = 0; i < puffDefs.length; i++) {
    const [dx, dy, dz, size] = puffDefs[i];
    const mesh = MeshBuilder.CreateBox(
      `nh_hardship_cloud_${i}`,
      { width: size, height: size * 0.6, depth: size * 0.8 },
      scene,
    );
    mesh.parent = root;
    mesh.material = cloudMat;
    mesh.isPickable = false;
    mesh.isVisible = false;
    const base = new Vector3(cloudCenter.x + dx, cloudCenter.y + dy, cloudCenter.z + dz);
    mesh.position = base.clone();
    puffs.push({ mesh, base });
  }

  const dim = MeshBuilder.CreateCylinder(
    "nh_hardship_dim",
    { diameter: 5.5, height: 0.03 },
    scene,
  );
  dim.parent = root;
  dim.position = new Vector3(groundCenter.x, 0.1, groundCenter.z);
  const dimMat = new StandardMaterial("nh_hardship_dim_mat", scene);
  dimMat.diffuseColor = Color3.FromHexString("#3a3f48");
  dimMat.specularColor = new Color3(0, 0, 0);
  dimMat.alpha = 0;
  dim.material = dimMat;
  dim.isPickable = false;
  dim.isVisible = false;

  let elapsed = 0;
  let running = false;
  const duration = 4.5;

  const hide = (): void => {
    cloudMat.alpha = 0;
    dimMat.alpha = 0;
    for (const p of puffs) {
      p.mesh.isVisible = false;
      p.mesh.position = p.base.clone();
    }
    dim.isVisible = false;
  };
  hide();

  return {
    durationSec: duration,
    start: () => {
      elapsed = 0;
      running = true;
      for (const p of puffs) p.mesh.isVisible = true;
      dim.isVisible = true;
    },
    stop: () => {
      running = false;
      hide();
    },
    update: (dt) => {
      if (!running) return;
      elapsed += dt;
      const t = Math.min(1, elapsed / duration);
      // Fade in, hold, fade out — never a hard flash.
      const fade = t < 0.2 ? t / 0.2 : t > 0.8 ? (1 - t) / 0.2 : 1;
      cloudMat.alpha = 0.78 * fade;
      for (let i = 0; i < puffs.length; i++) {
        const p = puffs[i];
        p.mesh.position.x = p.base.x + t * 0.8;
        p.mesh.position.y = p.base.y + Math.sin(elapsed * 1.6 + i) * 0.08;
      }
      dimMat.alpha = (0.16 + 0.08 * Math.sin(elapsed * 2.2)) * fade;
      if (elapsed >= duration) {
        running = false;
        hide();
      }
    },
  };
}

/**
 * Bereavement: a soft warm halo gently fades in and out around the
 * family home, signalling that this case is handled with care (no alarm
 * or chaos).
 */
export function makeCalmGlowIncident(
  scene: Scene,
  root: TransformNode,
  position: Vector3,
): IncidentAnimation {
  const halo = MeshBuilder.CreateCylinder(
    "nh_life_halo",
    { diameter: 7, height: 0.05 },
    scene,
  );
  halo.parent = root;
  halo.position = position.clone();
  const hmat = new StandardMaterial("nh_life_halo_mat", scene);
  hmat.diffuseColor = Color3.FromHexString("#f4e8c8");
  hmat.emissiveColor = Color3.FromHexString("#f4e8c8");
  hmat.alpha = 0;
  halo.material = hmat;
  halo.isVisible = false;

  let elapsed = 0;
  let running = false;
  const duration = 4.0;

  return {
    durationSec: duration,
    start: () => {
      elapsed = 0;
      running = true;
      halo.isVisible = true;
      hmat.alpha = 0;
    },
    stop: () => {
      running = false;
      hmat.alpha = 0;
      halo.isVisible = false;
    },
    update: (dt) => {
      if (!running) return;
      elapsed += dt;
      const t = Math.min(1, elapsed / duration);
      hmat.alpha = Math.sin(t * Math.PI) * 0.45;
      if (elapsed >= duration) {
        running = false;
        hmat.alpha = 0;
        halo.isVisible = false;
      }
    },
  };
}
