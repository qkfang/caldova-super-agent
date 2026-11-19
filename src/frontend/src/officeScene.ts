import {
  Color3,
  DynamicTexture,
  Material,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import { NeighbourhoodAmbient } from "./neighbourhoodAmbient";
import { buildPark } from "./parkSurroundings";
import { OFFICE_CHARACTER_SCALE, VoxelCharacter } from "./voxelCharacter";

/**
 * Anchor points used by the simulation. Coordinates are in scene units.
 *
 * Layout (bird's-eye, X right / Z forward) — one floor plate of the Caldova
 * Wealth building (72 × 47 units, x∈[-36, 36], z∈[-15, 32]), organised by team:
 *
 *   z = +32 ┌────────────────────────────────────────────────────────────────┐
 *           │ INVESTMENT   │ identity  │ CLIENT MEETING   │ skyline  │ Staff   │
 *           │ COMMITTEE    │ wall      │ SUITES + archive │ windows  │ Kitchen │
 *           ├──────────────┴───────────┴──────────────────┴──────────┴─────────┤
 *           │ HEAD OF CLIENT│ Investment│ Client &  │ Risk &    │ Client Café │  WEALTH
 *           │ OPERATIONS    │ Solutions │ Adviser   │ Fin Crime │             │  MANAGEMENT
 *           │ (corner)      │ Ivy       │ Comms Cara│ Felix     │             │  WING (back)
 *           ├───────────────┼───────────┼───────────┼───────────┼─────────────┤
 *           │ Onboarding    │ Benefits  │ Transfers │ Payments  │ Member      │  SUPERANNUATION
 *           │ Olivia        │ Ben       │ Rory      │ Penny     │ Lounge      │  WING (front)
 *           ├───────────────┴───────────┴───────────┴───────────┴─────────────┤
 *           │  Private client lobby: concierge · Super / Wealth / Adviser desks │
 *   z = -15 └────────────────────────────────────────────────────────────────┘
 *           x = -36                                                     x = +36
 *
 * The Superannuation wing (front row) sits closest to the lobby because it is
 * member-facing; the Wealth Management wing (back row) sits behind it beside
 * the meeting suites and investment committee room. Each team has its own
 * floor finish, floor lettering and wall banner. Pods are spaced 12 units
 * apart across (x = -24, -12, 0, +12) and 13 apart front to back (rows at
 * z = 0 and z = 13) so each pod has clear breathing room, and the
 * simulation's aisle planner keeps working off the same grid.
 */
export interface GlassMaterial {
  material: Material;
  /** The material's normal (opaque) alpha. */
  baseAlpha: number;
}

export interface OfficeLayout {
  /** Floor-level materials that fade to glass while the agent layer is shown. */
  glassMaterials: GlassMaterial[];
  /** World position where clients spawn outside the door. */
  spawnPoint: Vector3;
  /** Just inside the entrance — used as a routing anchor. */
  entrancePoint: Vector3;
  /** Where clients queue/drop their request at reception. */
  receptionPoint: Vector3;
  /** Where clients go after handing in their request, then despawn. */
  exitPoint: Vector3;
  /** Cubicle desk for the Onboarding & Requests Officer. */
  onboardingDeskPoint: Vector3;
  /** Cubicle desk for the Benefits & Eligibility Assessor. */
  benefitsDeskPoint: Vector3;
  /** Cubicle desk for the Investment Analyst. */
  investmentsDeskPoint: Vector3;
  /** Cubicle desk for the Financial Crime Investigator. */
  finCrimeDeskPoint: Vector3;
  /** Cubicle desk for the Transfers & Rollovers Coordinator. */
  transfersDeskPoint: Vector3;
  /** Cubicle desk for the Payments Officer. */
  paymentsDeskPoint: Vector3;
  /** Cubicle desk for the Client Communications Specialist. */
  communicationsDeskPoint: Vector3;
  /** Office desk for the Client Operations Team Leader. */
  teamLeaderDeskPoint: Vector3;
  /** Shared inbox tray on the reception desk where clients drop folders. */
  inboxPoint: Vector3;
  /** Shelf where closed case files rest (in the comms department). */
  archivePoint: Vector3;
}

interface MaterialFactory {
  (name: string, hex: string): StandardMaterial;
}

/**
 * Build the isometric voxel office. All meshes are static; the function
 * returns the layout reference points used by the agent simulation.
 */
export function buildOffice(scene: Scene): OfficeLayout {
  const mat: MaterialFactory = (name, hex) => {
    const m = new StandardMaterial(name, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.specularColor = new Color3(0.05, 0.05, 0.05);
    return m;
  };

  // ----- Floor & park -----
  // The office is one floor plate of the Caldova Wealth building:
  // x∈[-30, 30], z∈[-15, 25] (60 × 40 units). `buildPark` lays out the lawn,
  // paths, forecourt, pond, gazebo and trees around it.
  buildPark(scene);

  // Wandering lobby staff. Self-contained: the ambient instance ticks itself
  // off the scene's render observable.
  buildOfficeAmbient(scene);
  const officeStart = scene.meshes.length;

  // Main office floor — warm limestone. The floor plate is 72 × 47 units:
  // x∈[-36, 36], z∈[-15, 32].
  const floor = MeshBuilder.CreateBox(
    "floor",
    { width: 72, depth: 47, height: 0.2 },
    scene,
  );
  floor.position = new Vector3(0, 0.0, 8.5);
  floor.material = mat("floor", "#dcd7cb");

  // Tile grid lines (subtle stripes baked in via thin overlay boxes)
  const tileLine = mat("tileLine", "#c9c3b4");
  for (let i = -35; i <= 35; i += 2) {
    const lineX = MeshBuilder.CreateBox(
      `tileX_${i}`,
      { width: 0.04, height: 0.01, depth: 47 },
      scene,
    );
    lineX.position = new Vector3(i, 0.11, 8.5);
    lineX.material = tileLine;
  }
  for (let i = -14; i <= 31; i += 2) {
    const lineZ = MeshBuilder.CreateBox(
      `tileZ_${i}`,
      { width: 72, height: 0.01, depth: 0.04 },
      scene,
    );
    lineZ.position = new Vector3(0, 0.11, i);
    lineZ.material = tileLine;
  }

  // Private client lobby — dark slate stone with a brass inlay edge and
  // burgundy waiting-area rugs.
  const lobbyFloor = MeshBuilder.CreateBox(
    "lobbyFloor",
    { width: 50, height: 0.06, depth: 8.5 },
    scene,
  );
  lobbyFloor.position = new Vector3(-5, 0.13, -10);
  lobbyFloor.material = mat("lobbyFloor", "#3a4660");
  const lobbyInlay = MeshBuilder.CreateBox(
    "lobbyInlay",
    { width: 50, height: 0.02, depth: 0.14 },
    scene,
  );
  lobbyInlay.position = new Vector3(-5, 0.17, -5.9);
  lobbyInlay.material = mat("lobbyInlay", "#c9a14a");
  // Waiting-area rugs: brass-bordered burgundy under each sofa group.
  for (const rx of [-15.5, 3.5]) {
    const border = MeshBuilder.CreateBox(
      `lobbyRugBorder_${rx}`,
      { width: 6.4, height: 0.02, depth: 3.4 },
      scene,
    );
    border.position = new Vector3(rx, 0.17, -12.0);
    border.material = mat("lobbyRugBorder", "#c9a14a");
    const rug = MeshBuilder.CreateBox(
      `lobbyRug_${rx}`,
      { width: 6.0, height: 0.025, depth: 3.0 },
      scene,
    );
    rug.position = new Vector3(rx, 0.175, -12.0);
    rug.material = mat("lobbyRug", "#6b2230");
  }

  // Decorative break-room wood floor (back-right) so the kitchen feels distinct
  const kitchenFloor = MeshBuilder.CreateBox(
    "kitchenFloor",
    { width: 10, height: 0.06, depth: 8.0 },
    scene,
  );
  kitchenFloor.position = new Vector3(30, 0.13, 27);
  kitchenFloor.material = mat("kitchenFloor", "#d8b884");

  // Client café accent floor (back-right column)
  const cafeFloor = MeshBuilder.CreateBox(
    "cafeFloor",
    { width: 8, height: 0.06, depth: 6.5 },
    scene,
  );
  cafeFloor.position = new Vector3(32, 0.13, 13);
  cafeFloor.material = mat("cafeFloor", "#b88a64");

  // Member lounge accent floor (front-right column)
  const loungeFloor = MeshBuilder.CreateBox(
    "loungeFloor",
    { width: 10, height: 0.06, depth: 6.0 },
    scene,
  );
  loungeFloor.position = new Vector3(30, 0.13, 0);
  loungeFloor.material = mat("loungeFloor", "#27324a");

  // Investment committee room accent floor (back-far-left): dark walnut
  const committeeFloor = MeshBuilder.CreateBox(
    "committeeFloor",
    { width: 10, height: 0.06, depth: 8.0 },
    scene,
  );
  committeeFloor.position = new Vector3(-30, 0.13, 27);
  committeeFloor.material = mat("committeeFloor", "#5a3d2b");

  // Team wing floors: a carpet band under each row of pods so the two
  // teams read as distinct wings. Superannuation (front) is a cool teal-
  // grey; Wealth Management (back) is warm taupe with a brass edge.
  const superBand = MeshBuilder.CreateBox(
    "wingBandSuper",
    { width: 46, height: 0.04, depth: 7.6 },
    scene,
  );
  superBand.position = new Vector3(-6, 0.12, 0.2);
  superBand.material = mat("wingBandSuper", "#b9cdd0");
  const wealthBand = MeshBuilder.CreateBox(
    "wingBandWealth",
    { width: 46, height: 0.04, depth: 7.6 },
    scene,
  );
  wealthBand.position = new Vector3(-6, 0.12, 13.2);
  wealthBand.material = mat("wingBandWealth", "#d6c6a8");
  for (const [name, z, hex] of [
    ["wingEdgeSuper", -3.7, "#14b8a6"],
    ["wingEdgeWealth", 9.3, "#c9a14a"],
  ] as const) {
    const edge = MeshBuilder.CreateBox(name, { width: 46, height: 0.05, depth: 0.14 }, scene);
    edge.position = new Vector3(-6, 0.125, z);
    edge.material = mat(name, hex);
  }

  // ----- Walls -----
  const wallMat = mat("wall", "#e9edf3");
  const trimMat = mat("trim", "#b79a5b");

  const makeWall = (
    name: string,
    w: number,
    h: number,
    d: number,
    pos: Vector3,
  ): Mesh => {
    const wall = MeshBuilder.CreateBox(
      name,
      { width: w, height: h, depth: d },
      scene,
    );
    wall.position = pos;
    wall.material = wallMat;
    return wall;
  };

  // Outer walls — back, left, right (sized to the 72 × 47 floor footprint)
  makeWall("backWall", 72, 4.6, 0.3, new Vector3(0, 2.3, 32.0));
  makeWall("leftWall", 0.3, 4.6, 47, new Vector3(-36.0, 2.3, 8.5));
  makeWall("rightWall", 0.3, 4.6, 47, new Vector3(36.0, 2.3, 8.5));
  // Front low walls flanking the entrance gap (so we can see inside)
  makeWall("frontLeft", 34, 1.4, 0.3, new Vector3(-19.0, 0.7, -15));
  makeWall("frontRight", 34, 1.4, 0.3, new Vector3(19.0, 0.7, -15));

  // Bottom trim along outer walls
  const trimBack = MeshBuilder.CreateBox(
    "trimBack",
    { width: 72, height: 0.3, depth: 0.4 },
    scene,
  );
  trimBack.position = new Vector3(0, 0.25, 31.85);
  trimBack.material = trimMat;

  // ----- "CALDOVA WEALTH" identity wall (back-mid, between the Head of Client
  // Operations office and the filing cabinets) -----
  const identityPanel = MeshBuilder.CreateBox(
    "identityPanel",
    { width: 8.0, height: 3.2, depth: 0.12 },
    scene,
  );
  identityPanel.position = new Vector3(-13, 2.3, 31.78);
  identityPanel.material = mat("identityPanel", "#1f2d4a");

  drawSignTexture(scene, identityPanel, 1024, 440, (ctx) => {
    ctx.fillStyle = "#1f2d4a";
    ctx.fillRect(0, 0, 1024, 440);
    ctx.fillStyle = "#c9a14a";
    ctx.fillRect(50, 28, 924, 5);
    ctx.fillStyle = "#e7c872";
    ctx.font = "bold 112px sans-serif";
    ctx.fillText("CALDOVA", 50, 150);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 76px sans-serif";
    ctx.fillText("WEALTH", 50, 240);
    ctx.font = "26px sans-serif";
    ctx.fillStyle = "#b9c4dd";
    ctx.fillText("SUPERANNUATION  ·  WEALTH MANAGEMENT  ·  CLIENT OPERATIONS", 50, 290);
    ctx.font = "28px sans-serif";
    ctx.fillStyle = "#cfd8ee";
    const values = ["Trust", "Care", "Expertise", "Clarity", "Stewardship"];
    const colW = 1024 / values.length;
    for (let i = 0; i < values.length; i++) {
      // small icon circle
      ctx.beginPath();
      ctx.arc(60 + i * colW + 30, 372, 22, 0, Math.PI * 2);
      ctx.fillStyle = "#c9a14a";
      ctx.fill();
      ctx.fillStyle = "#cfd8ee";
      ctx.fillText(values[i], 60 + i * colW + 70, 382);
    }
  });

  // ----- "OUR PROCESS" board (right wall) -----
  const processPanel = MeshBuilder.CreateBox(
    "processPanel",
    { width: 0.12, height: 2.6, depth: 3.4 },
    scene,
  );
  processPanel.position = new Vector3(35.78, 2.4, 17);
  processPanel.material = mat("processPanel", "#f4ecdb");

  drawSignTexture(scene, processPanel, 512, 400, (ctx) => {
    ctx.fillStyle = "#f4ecdb";
    ctx.fillRect(0, 0, 512, 400);
    ctx.fillStyle = "#1c2230";
    ctx.font = "bold 56px sans-serif";
    ctx.fillText("OUR PROCESS", 30, 70);
    ctx.font = "bold 38px sans-serif";
    const steps = ["1  Request", "2  Verify", "3  Assess", "4  Action", "5  Confirm"];
    for (let i = 0; i < steps.length; i++) {
      ctx.fillStyle = "#3a5fb0";
      ctx.fillRect(30, 110 + i * 55, 18, 38);
      ctx.fillStyle = "#1c2230";
      ctx.fillText(steps[i], 60, 142 + i * 55);
    }
  });

  // ----- Concierge backdrop behind the reception desk -----
  const welcomeSign = MeshBuilder.CreateBox(
    "welcomeSign",
    { width: 6.4, height: 2.0, depth: 0.14 },
    scene,
  );
  welcomeSign.position = new Vector3(-15.2, 1.0, -8.2);
  welcomeSign.material = mat("welcomeSign", "#1f2d4a");
  drawSignTexture(scene, welcomeSign, 768, 240, (ctx) => {
    ctx.fillStyle = "#1f2d4a";
    ctx.fillRect(0, 0, 768, 240);
    ctx.fillStyle = "#c9a14a";
    ctx.fillRect(30, 22, 708, 4);
    ctx.fillRect(30, 214, 708, 4);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#e7c872";
    ctx.font = "bold 78px sans-serif";
    ctx.fillText("CALDOVA", 384, 84);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 50px sans-serif";
    ctx.fillText("WEALTH", 384, 142);
    ctx.fillStyle = "#b9c4dd";
    ctx.font = "26px sans-serif";
    ctx.fillText("Welcome — how can we help today?", 384, 190);
  });

  // ----- Entrance sign on the front wall -----
  const helpSign = MeshBuilder.CreateBox(
    "helpSign",
    { width: 2.6, height: 1.2, depth: 0.08 },
    scene,
  );
  helpSign.position = new Vector3(7.5, 0.75, -15.2);
  helpSign.material = mat("helpSign", "#1f2d4a");
  drawSignTexture(scene, helpSign, 416, 192, (ctx) => {
    ctx.fillStyle = "#1f2d4a";
    ctx.fillRect(0, 0, 416, 192);
    ctx.fillStyle = "#c9a14a";
    ctx.fillRect(24, 20, 368, 4);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 40px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Your super &", 208, 82);
    ctx.fillText("wealth, cared for.", 208, 130);
    ctx.fillStyle = "#c9a14a";
    ctx.fillRect(24, 168, 368, 4);
  });

  // ----- Building name along the front wall (faces the forecourt) -----
  const buildingSign = MeshBuilder.CreateBox(
    "buildingSign",
    { width: 13.0, height: 0.9, depth: 0.08 },
    scene,
  );
  buildingSign.position = new Vector3(-17.0, 0.75, -15.2);
  drawSignTexture(scene, buildingSign, 1280, 90, (ctx) => {
    ctx.fillStyle = "#1f2d4a";
    ctx.fillRect(0, 0, 1280, 90);
    ctx.fillStyle = "#c9a14a";
    ctx.fillRect(0, 0, 1280, 4);
    ctx.fillRect(0, 86, 1280, 4);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#e7c872";
    ctx.font = "bold 50px sans-serif";
    ctx.fillText("CALDOVA WEALTH", 330, 46);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 30px sans-serif";
    ctx.fillText("SUPERANNUATION  ·  WEALTH MANAGEMENT", 880, 48);
  });

  // ----- Back-wall windows: a skyline view over the neighbouring towers -----
  const windowMat = mat("window", "#cfe7ff");
  const windowFrame = mat("windowFrame", "#b79a5b");
  const skylineMat = skylineMaterial(scene, "skyline");
  [-32, -28, 8.5, 12.9, 17.3, 21.7, 26.1, 30.5, 34].forEach((x, i) => {
    const frame = MeshBuilder.CreateBox(
      `winFrame_${i}`,
      { width: 3.2, height: 2.6, depth: 0.1 },
      scene,
    );
    frame.position = new Vector3(x, 2.7, 31.84);
    frame.material = windowFrame;
    const glass = MeshBuilder.CreateBox(
      `winGlass_${i}`,
      { width: 2.8, height: 2.2, depth: 0.05 },
      scene,
    );
    glass.position = new Vector3(x, 2.7, 31.79);
    glass.material = skylineMat;
  });

  // ----- Team wing banners: left wall signs + floor lettering -----
  for (const [name, z, hex, label, sub] of [
    ["Super", 0.2, "#0f766e", "SUPERANNUATION TEAM", "Members · Rollovers · Pensions"],
    ["Wealth", 13.2, "#1f2d4a", "WEALTH MANAGEMENT TEAM", "Advice · Investments · Risk · Clients"],
  ] as const) {
    const banner = textPlane(scene, `wingBanner_${name}`, 8.4, 1.0, 1024, 122, (ctx) => {
      ctx.fillStyle = hex;
      ctx.fillRect(0, 0, 1024, 122);
      ctx.fillStyle = "#c9a14a";
      ctx.fillRect(0, 0, 1024, 6);
      ctx.fillRect(0, 116, 1024, 6);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 58px sans-serif";
      ctx.fillText(label, 512, 50);
      ctx.fillStyle = "#e7c872";
      ctx.font = "30px sans-serif";
      ctx.fillText(sub, 512, 94);
    });
    banner.position = new Vector3(-35.75, 3.95, z);
    banner.rotation.y = -Math.PI / 2;
  }
  for (const [name, z, hex, label] of [
    ["Super", -4.9, "#0f766e", "SUPERANNUATION TEAM"],
    ["Wealth", 8.3, "#8a6a1f", "WEALTH MANAGEMENT TEAM"],
  ] as const) {
    const lettering = textPlane(
      scene,
      `wingFloor_${name}`,
      24,
      1.4,
      1536,
      90,
      (ctx) => {
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = hex;
        ctx.font = "bold 62px sans-serif";
        ctx.fillText(label.split("").join(" "), 768, 46);
      },
      true,
    );
    lettering.position = new Vector3(-6, 0.155, z);
    lettering.rotation.x = Math.PI / 2;
  }

  // ----- Left-wall windows: the view across Flinders Lane -----
  [-9, -1.5, 5.5, 13.5, 20].forEach((z, i) => {
    const frame = MeshBuilder.CreateBox(
      `winFrameL_${i}`,
      { width: 0.1, height: 2.2, depth: 3.4 },
      scene,
    );
    frame.position = new Vector3(-35.84, 2.2, z);
    frame.material = windowFrame;
    const glass = MeshBuilder.CreatePlane(`winGlassL_${i}`, { width: 3.0, height: 1.9 }, scene);
    glass.position = new Vector3(-35.78, 2.2, z);
    glass.rotation.y = -Math.PI / 2;
    glass.material = skylineMat;
  });

  // ----- Front entrance (double doors) -----
  // Doors slide horizontally apart when a character (staff or client)
  // walks within proximity of the entrance, and slide closed again
  // when no-one is nearby. The base x positions below are the closed
  // pose; openOffset is added/subtracted to slide them into the
  // adjacent wall.
  const doorFrame = mat("doorFrame", "#7a8aa6");
  // The entrance gap between the front-left/right walls spans x = -2..+2
  // (4 units wide). Each door is sized to cover half of that gap so the
  // closed doorway has no visible side gaps.
  const leftDoor = MeshBuilder.CreateBox(
    "leftDoor",
    { width: 2.0, height: 2.4, depth: 0.15 },
    scene,
  );
  leftDoor.position = new Vector3(-1.0, 1.2, -15);
  leftDoor.material = doorFrame;
  const rightDoor = leftDoor.clone("rightDoor");
  rightDoor.position.x = 1.0;
  const doorGlassPanes: Mesh[] = [];
  for (const d of [leftDoor, rightDoor]) {
    const glass = MeshBuilder.CreateBox(
      `${d.name}_glass`,
      { width: 1.6, height: 1.6, depth: 0.05 },
      scene,
    );
    glass.material = windowMat;
    // Parent the glass to the door so it slides with the frame, and
    // express its offset in the door's local space (door origin is at
    // y=1.2, z=-15, so y=0.2 places the pane vertically and z=0.07
    // pushes it just outside the front face).
    glass.parent = d;
    glass.position = new Vector3(0, 0.2, 0.07);
    doorGlassPanes.push(glass);
  }

  // Auto-open behaviour: scan voxel character roots once per frame
  // and ease the doors toward open/closed based on the closest
  // character's distance to the entrance. Voxel characters are added
  // to the scene as TransformNodes named "char_*" by VoxelCharacter,
  // so we can detect them generically without coupling to the
  // simulation layer.
  const leftDoorClosedX = -1.0;
  const rightDoorClosedX = 1.0;
  const doorOpenOffset = 1.8; // slide each door ~1.8 units behind the adjacent wall
  const triggerRadius = 3.2; // metres around the entrance
  const doorwayPosition = new Vector3(0, 0, -15);
  let doorOpenAmount = 0; // 0 = closed, 1 = fully open
  scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(0.1, scene.getEngine().getDeltaTime() / 1000);
    let nearest = Number.POSITIVE_INFINITY;
    for (const node of scene.transformNodes) {
      if (!node.name.startsWith("char_")) continue;
      const p = node.position;
      const dx = p.x - doorwayPosition.x;
      const dz = p.z - doorwayPosition.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < nearest) nearest = d;
    }
    const target = nearest <= triggerRadius ? 1 : 0;
    // Ease toward target at ~4/sec so the slide feels mechanical
    // rather than instant.
    const rate = 4.0;
    doorOpenAmount += (target - doorOpenAmount) * Math.min(1, dt * rate);
    leftDoor.position.x = leftDoorClosedX - doorOpenOffset * doorOpenAmount;
    rightDoor.position.x = rightDoorClosedX + doorOpenOffset * doorOpenAmount;
  });
  // Welcome mat
  const mat1 = MeshBuilder.CreateBox(
    "welcomeMat",
    { width: 2.4, height: 0.04, depth: 1.2 },
    scene,
  );
  mat1.position = new Vector3(0, 0.13, -13.6);
  mat1.material = mat("welcomeMat", "#3a3a44");

  // ----- Reception / Welcome lobby furniture (front-left) -----
  // Reception desk — walnut concierge desk with a pale stone top
  const recDeskMat = mat("recDesk", "#4a3224");
  const recDeskTop = mat("recDeskTop", "#e8dcc4");
  const recBase = MeshBuilder.CreateBox(
    "recDeskBase",
    { width: 4.5, height: 1.0, depth: 1.4 },
    scene,
  );
  recBase.position = new Vector3(-15.2, 0.5, -10.4);
  recBase.material = recDeskMat;
  const recTop = MeshBuilder.CreateBox(
    "recDeskTop",
    { width: 4.7, height: 0.15, depth: 1.6 },
    scene,
  );
  recTop.position = new Vector3(-15.2, 1.07, -10.4);
  recTop.material = recDeskTop;
  // Inbox tray on reception desk
  const tray = MeshBuilder.CreateBox(
    "inboxTray",
    { width: 0.8, height: 0.1, depth: 0.5 },
    scene,
  );
  tray.position = new Vector3(-14.0, 1.18, -10.4);
  tray.material = mat("tray", "#3a3a44");
  const trayLabel = MeshBuilder.CreateBox(
    "inboxLabel",
    { width: 0.4, height: 0.02, depth: 0.2 },
    scene,
  );
  trayLabel.position = new Vector3(-14.0, 1.24, -10.25);
  trayLabel.material = mat("trayLabel", "#ffb347");
  // Reception monitor
  buildMonitor(scene, mat, new Vector3(-16.0, 1.07, -10.7), 0);
  // Brass "CONCIERGE" plaque on the front of the desk
  const conciergePlaque = MeshBuilder.CreateBox(
    "conciergePlaque",
    { width: 2.6, height: 0.4, depth: 0.05 },
    scene,
  );
  conciergePlaque.position = new Vector3(-15.2, 0.62, -11.12);
  drawSignTexture(scene, conciergePlaque, 416, 64, (ctx) => {
    ctx.fillStyle = "#c9a14a";
    ctx.fillRect(0, 0, 416, 64);
    ctx.fillStyle = "#1f2d4a";
    ctx.font = "bold 40px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("CONCIERGE", 208, 34);
  });

  // Coffee table + sofas in lobby (Client Waiting Area): cream leather
  const sofaMat = mat("sofa", "#e8dcc4");
  const sofa1Seat = MeshBuilder.CreateBox(
    "sofa1Seat",
    { width: 1.2, height: 0.5, depth: 1.2 },
    scene,
  );
  sofa1Seat.position = new Vector3(-17, 0.4, -12);
  sofa1Seat.material = sofaMat;
  const sofa2Seat = sofa1Seat.clone("sofa2Seat");
  sofa2Seat.position = new Vector3(-14.0, 0.4, -12);
  const cTableTop = MeshBuilder.CreateBox(
    "cTableTop",
    { width: 1.6, height: 0.1, depth: 0.8 },
    scene,
  );
  cTableTop.position = new Vector3(-15.5, 0.45, -12.0);
  cTableTop.material = mat("cTable", "#2a2f3a");
  const cTableLeg = MeshBuilder.CreateBox(
    "cTableLeg",
    { width: 1.4, height: 0.4, depth: 0.6 },
    scene,
  );
  cTableLeg.position = new Vector3(-15.5, 0.2, -12.0);
  cTableLeg.material = mat("cTableLeg", "#c9a14a");

  // Additional waiting-area sofas across the front of the lobby
  const sofa3Seat = sofa1Seat.clone("sofa3Seat");
  sofa3Seat.position = new Vector3(2, 0.4, -12);
  const sofa4Seat = sofa1Seat.clone("sofa4Seat");
  sofa4Seat.position = new Vector3(5, 0.4, -12);
  const cTable2Top = MeshBuilder.CreateBox(
    "cTable2Top",
    { width: 1.6, height: 0.1, depth: 0.8 },
    scene,
  );
  cTable2Top.position = new Vector3(3.5, 0.45, -12.0);
  cTable2Top.material = mat("cTable", "#2a2f3a");
  const cTable2Leg = MeshBuilder.CreateBox(
    "cTable2Leg",
    { width: 1.4, height: 0.4, depth: 0.6 },
    scene,
  );
  cTable2Leg.position = new Vector3(3.5, 0.2, -12.0);
  cTable2Leg.material = mat("cTableLeg", "#c9a14a");

  // "CLIENT WAITING AREA" sign on the front-low wall (right side, faces the forecourt)
  const waitingSign = MeshBuilder.CreateBox(
    "waitingSign",
    { width: 4.2, height: 0.9, depth: 0.08 },
    scene,
  );
  waitingSign.position = new Vector3(11, 0.75, -15.2);
  drawSignTexture(scene, waitingSign, 640, 140, (ctx) => {
    ctx.fillStyle = "#1f2d4a";
    ctx.fillRect(0, 0, 640, 140);
    ctx.fillStyle = "#c9a14a";
    ctx.fillRect(0, 0, 640, 5);
    ctx.fillRect(0, 135, 640, 5);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 50px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("CLIENT WAITING", 320, 52);
    ctx.font = "bold 40px sans-serif";
    ctx.fillStyle = "#e7c872";
    ctx.fillText("LOUNGE", 320, 102);
  });

  // Lobby plants
  buildPlant(scene, mat, new Vector3(-18.5, 0, -11.5));
  buildPlant(scene, mat, new Vector3(-12.5, 0, -12.5));
  buildPlant(scene, mat, new Vector3(0.5, 0, -12.5));
  buildPlant(scene, mat, new Vector3(7.5, 0, -12.5));

  // Lobby decor — cushions on sofas, magazines on coffee table, a floor
  // lamp by the corner, a framed photo and a wall clock above reception.
  buildCushion(scene, mat, "lobbyCushion1", new Vector3(-17.3, 0.7, -12.2), "#1f2d4a");
  buildCushion(scene, mat, "lobbyCushion2", new Vector3(-16.7, 0.7, -11.8), "#c9a14a");
  buildCushion(scene, mat, "lobbyCushion3", new Vector3(-14.3, 0.7, -12.2), "#0f766e");
  buildCushion(scene, mat, "lobbyCushion4", new Vector3(-13.7, 0.7, -11.8), "#1f2d4a");
  buildCushion(scene, mat, "lobbyCushion5", new Vector3(1.7, 0.7, -12.2), "#c9a14a");
  buildCushion(scene, mat, "lobbyCushion6", new Vector3(2.3, 0.7, -11.8), "#1f2d4a");
  buildCushion(scene, mat, "lobbyCushion7", new Vector3(4.7, 0.7, -12.2), "#0f766e");
  buildCushion(scene, mat, "lobbyCushion8", new Vector3(5.3, 0.7, -11.8), "#c9a14a");
  buildMagazines(scene, mat, "lobbyMags", new Vector3(-15.5, 0.51, -12.0));
  buildMagazines(scene, mat, "lobbyMags2", new Vector3(3.5, 0.51, -12.0));
  buildFloorLamp(scene, mat, "lobbyFloorLamp", new Vector3(-19.0, 0, -12.6), "#ffb347");
  buildFloorLamp(scene, mat, "lobbyFloorLamp2", new Vector3(8.5, 0, -12.6), "#6ec1ff");

  // ----- Department grid -----
  // 8 dedicated departments arranged across the floor by team. Each role
  // gets its own coloured pod, framed by timber-and-glass screens, with a
  // labelled overhead sign that names the team it belongs to.
  //
  // Superannuation wing (front row, z = 0):
  //   Onboarding | Benefits | Transfers | Payments
  // Wealth Management wing (back row, z = 13):
  //   Head of Client Operations (corner) | Investments | Comms | Financial Crime
  // Right side: Member Lounge | Client Café | Staff Kitchen
  // Back-left: Investment Committee Room
  // Front (z < -7): Concierge + Client Waiting Lounge + Service counters
  //
  // Pods are 12 units apart across and 13 apart front to back so there is
  // room to walk around every desk.

  // ----- Department pods (front and back rows) -----
  const cubicles: CubicleSpec[] = [
    // Sign text is the department keyword only (no "Officer" /
    // "Coordinator" / "Investigator" suffixes) so the label stays large
    // and legible from the orbit camera. Accents are the canonical
    // department colours (matching each staff member's shirt).
    // Superannuation wing (front row, z = 0)
    { label: "onboarding", accent: "#0ea5e9", cx: -24, cz: 0, sign: "ONBOARDING", team: "super", screen: "case" },
    { label: "benefits",   accent: "#6366f1", cx: -12, cz: 0, sign: "BENEFITS",   team: "super", screen: "checklist" },
    { label: "transfers",  accent: "#10b981", cx:   0, cz: 0, sign: "TRANSFERS",  team: "super", screen: "tracker" },
    { label: "payments",   accent: "#a855f7", cx:  12, cz: 0, sign: "PAYMENTS",   team: "super", screen: "payment" },
    // Wealth Management wing (back row, z = 13) — the Head of Client
    // Operations gets the executive corner office at x = -24.
    { label: "investments",    accent: "#f59e0b", cx: -12, cz: 13, sign: "INVESTMENTS",     team: "wealth", screen: "chart" },
    { label: "communications", accent: "#ec4899", cx:   0, cz: 13, sign: "COMMS",           team: "wealth", screen: "letter" },
    { label: "finCrime",       accent: "#ef4444", cx:  12, cz: 13, sign: "FINANCIAL CRIME", team: "wealth", screen: "risk" },
  ];
  for (const c of cubicles) {
    buildDepartmentZone(scene, mat, c);
  }

  // ----- Head of Client Operations executive office (back-far-left) -----
  buildTeamLeaderOffice(scene, mat, new Vector3(-24, 0, 13));

  // ----- Client Meeting Suites (back, mid) -----
  // Two glass-walled suites sit side-by-side along the back of the office,
  // between the Wealth wing and the archive. The section is unified by a
  // shared accent floor strip and an overhead "CLIENT MEETING SUITES"
  // banner mounted on the back wall.
  buildMeetingRoomSection(scene, mat, new Vector3(2.5, 0, 26.5));

  // ----- Filing cabinets / archive shelves (along the back wall) -----
  for (let col = 0; col < 6; col++) {
    const x = -4.0 + col * 1.4;
    const cab = MeshBuilder.CreateBox(
      `cabinet_${col}`,
      { width: 1.2, height: 1.6, depth: 0.7 },
      scene,
    );
    cab.position = new Vector3(x, 0.8, 30.7);
    cab.material = mat("cabinet", "#3b4d72");
    for (let s = 0; s < 3; s++) {
      const drawer = MeshBuilder.CreateBox(
        `drawer_${col}_${s}`,
        { width: 1.0, height: 0.4, depth: 0.05 },
        scene,
      );
      drawer.position = new Vector3(x, 0.4 + s * 0.5, 30.34);
      drawer.material = mat("drawerFront", "#26334d");
    }
  }
  // Archive label rail along the top front edge of the cabinet bank —
  // one section per file type, sitting under the plants on top.
  buildArchiveLabels(scene, -0.5, 1.8, 30.33, 8.2, [
    "Advice (SOA)",
    "Member Files",
    "Nominations",
    "Closed Cases",
  ]);
  // Plants on top of cabinets
  for (let col = 0; col < 6; col += 2) {
    buildPlant(scene, mat, new Vector3(-4.0 + col * 1.4, 1.6, 30.7));
  }

  // ----- Water cooler near the identity wall -----
  const cooler = MeshBuilder.CreateBox(
    "cooler",
    { width: 0.6, height: 1.4, depth: 0.6 },
    scene,
  );
  cooler.position = new Vector3(-2.5, 0.7, 30);
  cooler.material = mat("cooler", "#bcd7ee");
  const coolerTop = MeshBuilder.CreateBox(
    "coolerTop",
    { width: 0.5, height: 0.5, depth: 0.5 },
    scene,
  );
  coolerTop.position = new Vector3(-2.5, 1.65, 30);
  coolerTop.material = mat("coolerTop", "#7fb6e3");

  // Printer station tucked alongside the right-hand walkway, between the
  // Financial Crime pod and the café zone.
  const printer = MeshBuilder.CreateBox(
    "printer",
    { width: 1.0, height: 0.7, depth: 0.7 },
    scene,
  );
  printer.position = new Vector3(21.0, 0.45, 13.0);
  printer.material = mat("printer", "#3a3a44");
  const printerTop = MeshBuilder.CreateBox(
    "printerTop",
    { width: 0.9, height: 0.1, depth: 0.6 },
    scene,
  );
  printerTop.position = new Vector3(21.0, 0.85, 13.0);
  printerTop.material = mat("printerTop", "#22252e");

  // ----- Client-facing service counters in the lobby -----
  buildLobbyCounter(scene, mat, "SUPER SERVICES",  -7.5, -9.0, "#0f766e");
  buildLobbyCounter(scene, mat, "WEALTH SERVICES", -3.5, -9.0, "#1f2d4a");
  buildLobbyCounter(scene, mat, "ADVISER DESK",     0.5, -9.0, "#6366f1");

  // ----- Right-side zones -----
  // Member lounge (front-right): seminar screen, armchairs, calculator kiosk
  buildMemberLounge(scene, mat, new Vector3(30, 0, 0));
  // Client café (mid-right): bistro tables and pendant lamps
  buildCafe(scene, mat, new Vector3(32, 0, 13));
  // Staff kitchen (back-right)
  buildKitchen(scene, mat, new Vector3(30, 0, 27));
  // Investment committee room (back-far-left)
  buildInvestmentCommittee(scene, mat, new Vector3(-30, 0, 27));

  // Closed-case credenza beside the Wealth wing, where Comms files each case.
  buildCaseCredenza(scene, mat, new Vector3(6.0, 0, 11.6));

  // Wall decor on the back wall — clock and framed art near the identity panel.
  buildWallClock(scene, mat, "recClock", new Vector3(-2.5, 3.6, 31.84));
  buildFramedArt(scene, mat, "recArt1", new Vector3(0.5, 3.0, 31.84), 1.6, 1.2, "#1f2d4a");
  buildFramedArt(scene, mat, "recArt2", new Vector3(2.5, 3.0, 31.84), 1.6, 1.2, "#c9a14a");

  // Decorative plants in walkways — placed in the gaps between pods and
  // along the circulation routes.
  for (const [px, pz] of [
    [-18, -4.5], [-6, -4.5], [6, -4.5], [18, -4.5],
    [-18, 6.6], [-6, 6.6], [6, 6.6], [18, 6.6],
    [-30, 4.5], [-30, 21], [22, 5], [34, -4], [-34, -4],
  ] as const) {
    buildPlant(scene, mat, new Vector3(px, 0, pz));
  }


  // The human floor turns to glass while the AI agent layer is revealed
  // (see agentLayer.ts): record every flat floor-level material (floor, rugs,
  // wing bands, pod accents, floor lettering) so it can be faded at runtime.
  const glassMaterials: GlassMaterial[] = [];
  for (const m of scene.meshes.slice(officeStart)) {
    if (!m.material) continue;
    m.computeWorldMatrix(true);
    if (
      m.getBoundingInfo().boundingBox.maximumWorld.y < 0.3 &&
      !glassMaterials.some((g) => g.material === m.material)
    ) {
      glassMaterials.push({ material: m.material, baseAlpha: m.material.alpha });
    }
  }

  return {
    glassMaterials,
    spawnPoint: new Vector3(0, 0, -18),
    entrancePoint: new Vector3(0, 0, -13.5),
    receptionPoint: new Vector3(-13.5, 0, -9.5),
    exitPoint: new Vector3(0, 0, -18),
    onboardingDeskPoint: new Vector3(-24, 0, -0.6),
    benefitsDeskPoint: new Vector3(-12, 0, -0.6),
    transfersDeskPoint: new Vector3(0, 0, -0.6),
    paymentsDeskPoint: new Vector3(12, 0, -0.6),
    investmentsDeskPoint: new Vector3(-12, 0, 12.4),
    communicationsDeskPoint: new Vector3(0, 0, 12.4),
    finCrimeDeskPoint: new Vector3(12, 0, 12.4),
    teamLeaderDeskPoint: new Vector3(-24, 0, 12.5),
    inboxPoint: new Vector3(-14.0, 1.25, -10.4),
    archivePoint: new Vector3(6.0, 1.4, 11.6),
  };
}

// ===== Helpers =====

/** Bake text/graphics onto the front face of a sign mesh via a DynamicTexture. */
function drawSignTexture(
  scene: Scene,
  mesh: Mesh,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): void {
  const tex = new DynamicTexture(`tex_${mesh.name}`, { width: w, height: h }, scene, false);
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  draw(ctx);
  tex.update();
  const m = new StandardMaterial(`signMat_${mesh.name}`, scene);
  m.diffuseTexture = tex;
  m.specularColor = new Color3(0.05, 0.05, 0.05);
  m.emissiveColor = new Color3(0.18, 0.18, 0.18);
  mesh.material = m;
}

/**
 * Flat plane carrying a drawn texture. It faces -z by default; rotate it to
 * hang on a side wall (rotation.y) or lie on the floor (rotation.x = π/2).
 */
function textPlane(
  scene: Scene,
  name: string,
  w: number,
  h: number,
  texW: number,
  texH: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
  transparent = false,
): Mesh {
  const plane = MeshBuilder.CreatePlane(name, { width: w, height: h }, scene);
  const tex = new DynamicTexture(`tex_${name}`, { width: texW, height: texH }, scene, false);
  draw(tex.getContext() as unknown as CanvasRenderingContext2D);
  tex.update();
  const m = new StandardMaterial(`planeMat_${name}`, scene);
  m.diffuseTexture = tex;
  m.specularColor = new Color3(0.05, 0.05, 0.05);
  m.emissiveColor = new Color3(0.3, 0.3, 0.3);
  if (transparent) {
    tex.hasAlpha = true;
    m.useAlphaFromDiffuseTexture = true;
  }
  plane.material = m;
  return plane;
}

/** Shared "view over the city" texture for the office windows. */
function skylineMaterial(scene: Scene, name: string): StandardMaterial {
  const w = 512;
  const h = 256;
  const tex = new DynamicTexture(`tex_${name}`, { width: w, height: h }, scene, false);
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#7fb8e8");
  sky.addColorStop(1, "#dcedf8");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillRect(60, 40, 110, 22);
  ctx.fillRect(90, 28, 70, 14);
  ctx.fillRect(330, 70, 130, 20);
  // Two layers of towers: pale and hazy at the back, bolder in front.
  let seed = 42;
  const rand = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (const [layerColour, minH, maxH, windowColour] of [
    ["#a9bfd9", 90, 190, "#c8d8ea"],
    ["#6f89ad", 50, 130, "#9db6d4"],
  ] as const) {
    let x = -10;
    while (x < w) {
      const bw = 34 + rand() * 40;
      const bh = minH + rand() * (maxH - minH);
      ctx.fillStyle = layerColour;
      ctx.fillRect(x, h - bh, bw, bh);
      ctx.fillStyle = windowColour;
      for (let wy = h - bh + 8; wy < h - 6; wy += 14) {
        for (let wx = x + 6; wx < x + bw - 8; wx += 12) {
          if (rand() < 0.6) ctx.fillRect(wx, wy, 5, 7);
        }
      }
      x += bw + 4 + rand() * 6;
    }
  }
  tex.update();
  const m = new StandardMaterial(`skylineMat_${name}`, scene);
  m.diffuseTexture = tex;
  m.specularColor = new Color3(0.05, 0.05, 0.05);
  m.emissiveColor = new Color3(0.45, 0.45, 0.45);
  return m;
}

/**
 * Label rail for the archive filing cabinets: a slim cream strip split into
 * equal sections, one per file type, each with auto-fitted text.
 */
function buildArchiveLabels(
  scene: Scene,
  cx: number,
  cy: number,
  cz: number,
  width: number,
  labels: string[],
): void {
  const rail = MeshBuilder.CreateBox(
    "archiveLabelRail",
    { width, height: 0.4, depth: 0.05 },
    scene,
  );
  rail.position = new Vector3(cx, cy, cz);
  const texW = 2048;
  const texH = 100;
  drawSignTexture(scene, rail, texW, texH, (ctx) => {
    ctx.fillStyle = "#f4ecdb";
    ctx.fillRect(0, 0, texW, texH);
    const sectionW = texW / labels.length;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < labels.length; i++) {
      // Thin navy dividers between sections, like drawer label holders.
      if (i > 0) {
        ctx.fillStyle = "#2a3a5c";
        ctx.fillRect(i * sectionW - 3, 0, 6, texH);
      }
      ctx.fillStyle = "#1c2230";
      let fontPx = 58;
      ctx.font = `bold ${fontPx}px sans-serif`;
      while (ctx.measureText(labels[i]).width > sectionW * 0.66 && fontPx > 24) {
        fontPx -= 2;
        ctx.font = `bold ${fontPx}px sans-serif`;
      }
      ctx.fillText(labels[i], i * sectionW + sectionW / 2, texH / 2 + 2);
    }
  });
}

type TeamWing = "super" | "wealth";

type ScreenKind = "case" | "checklist" | "tracker" | "payment" | "chart" | "letter" | "risk";

interface CubicleSpec {
  label: string;
  accent: string;
  cx: number;
  cz: number;
  sign: string;
  team: TeamWing;
  screen: ScreenKind;
}

/** Wing styling: sign colours, desk finish and the sign's team subtitle. */
const WING_STYLE: Record<
  TeamWing,
  { signBg: string; subColour: string; desk: string; glassFrame: string; subtitle: string }
> = {
  super: {
    signBg: "#0f766e",
    subColour: "#bff3ec",
    desk: "#cdb893",
    glassFrame: "#14b8a6",
    subtitle: "SUPERANNUATION TEAM",
  },
  wealth: {
    signBg: "#1f2d4a",
    subColour: "#e7c872",
    desk: "#6a4b34",
    glassFrame: "#c9a14a",
    subtitle: "WEALTH MANAGEMENT TEAM",
  },
};

/**
 * Build a single labelled department zone: a coloured floor accent, timber
 * and glass partitions on three sides, a labelled overhead sign naming the
 * team, and a desk with chair and props inside. Each role's accent colour
 * differentiates their zone from neighbouring departments.
 */
function buildDepartmentZone(
  scene: Scene,
  mat: MaterialFactory,
  spec: CubicleSpec,
): void {
  // Floor accent under the department zone
  const accent = MeshBuilder.CreateBox(
    `dept_floor_${spec.label}`,
    { width: 6.6, height: 0.05, depth: 5.4 },
    scene,
  );
  accent.position = new Vector3(spec.cx, 0.13, spec.cz + 0.5);
  accent.material = mat(`dept_floorMat_${spec.label}`, spec.accent);

  // Build the desk + screens via the cubicle helper
  buildCubicle(scene, mat, spec);
}

/** Build a single labelled pod: timber back screen, glass side screens, desk,
 *  monitor, chair, and overhead sign. Used by buildDepartmentZone. */
function buildCubicle(
  scene: Scene,
  mat: MaterialFactory,
  spec: CubicleSpec,
): void {
  const { label, cx, cz, team, screen } = spec;
  const signText = spec.sign;
  const accentHex = spec.accent;
  const wing = WING_STYLE[team];
  const cubicleWallMat = mat(`cub_${label}`, team === "wealth" ? "#7a5a42" : "#d8cdb5");
  const glassMat = mat(`cubGlass_${label}`, "#cfe7ff");
  glassMat.alpha = 0.38;
  const accentMat = mat(`cubAccent_${label}`, accentHex);
  const frameMat = mat(`cubFrame_${label}`, wing.glassFrame);
  const deskMat = mat(`desk_${label}`, wing.desk);
  const chairMat = mat(`chair_${label}`, "#1c2230");

  // Tall partitions — a solid timber back screen with frosted-glass side
  // screens (1.8m tall) so the pods feel open and light.
  const back = MeshBuilder.CreateBox(
    `cubBack_${label}`,
    { width: 6.0, height: 1.8, depth: 0.15 },
    scene,
  );
  back.position = new Vector3(cx, 0.9, cz + 2.6);
  back.material = cubicleWallMat;
  const left = MeshBuilder.CreateBox(
    `cubLeft_${label}`,
    { width: 0.15, height: 1.8, depth: 5.0 },
    scene,
  );
  left.position = new Vector3(cx - 2.95, 0.9, cz + 0.1);
  left.material = glassMat;
  const right = left.clone(`cubRight_${label}`);
  right.position.x = cx + 2.95;

  // Coloured stripe along the top of each screen for the dept accent, plus a
  // slim brass/teal frame rail along the glass bottom edge.
  const topStripeBack = MeshBuilder.CreateBox(
    `cubBackStripe_${label}`,
    { width: 6.04, height: 0.18, depth: 0.18 },
    scene,
  );
  topStripeBack.position = new Vector3(cx, 1.7, cz + 2.6);
  topStripeBack.material = accentMat;
  const topStripeLeft = MeshBuilder.CreateBox(
    `cubLeftStripe_${label}`,
    { width: 0.18, height: 0.18, depth: 5.04 },
    scene,
  );
  topStripeLeft.position = new Vector3(cx - 2.95, 1.7, cz + 0.1);
  topStripeLeft.material = accentMat;
  const topStripeRight = topStripeLeft.clone(`cubRightStripe_${label}`);
  topStripeRight.position.x = cx + 2.95;
  const railLeft = MeshBuilder.CreateBox(
    `cubLeftRail_${label}`,
    { width: 0.18, height: 0.1, depth: 5.04 },
    scene,
  );
  railLeft.position = new Vector3(cx - 2.95, 0.05, cz + 0.1);
  railLeft.material = frameMat;
  const railRight = railLeft.clone(`cubRightRail_${label}`);
  railRight.position.x = cx + 2.95;

  // Sign mounted ABOVE the back partition (top of partition is at y≈1.8;
  // the sign sits with its bottom edge resting on that lip and reads from
  // a distance). The sign is enlarged and tilted 30° upward so the face
  // angles toward the overhead orbit camera, making the department label
  // far easier to read from a distance.
  const sign = MeshBuilder.CreateBox(
    `cubSign_${label}`,
    { width: 9.0, height: 2.4, depth: 0.08 },
    scene,
  );
  // Tilt the sign's top backward so its front face aims up toward the
  // bird's-eye camera. With a 30° tilt the bottom edge of the sign moves
  // forward and the top edge moves back, so we offset the centre slightly
  // to keep the bottom resting just above the partition lip.
  sign.rotation.x = Math.PI / 6; // 30 degrees
  sign.position = new Vector3(cx, 3.0, cz + 2.3);
  drawSignTexture(scene, sign, 1440, 384, (ctx) => {
    ctx.fillStyle = wing.signBg;
    ctx.fillRect(0, 0, 1440, 384);
    // Department accent chip + brass rule frame the team-coloured sign.
    ctx.fillStyle = accentHex;
    ctx.fillRect(0, 0, 44, 384);
    ctx.fillStyle = "#c9a14a";
    ctx.fillRect(44, 0, 1396, 10);
    ctx.fillRect(44, 374, 1396, 10);
    ctx.fillStyle = "#ffffff";
    // Auto-fit text so labels of varying length (e.g. "COMMS" vs
    // "FINANCIAL CRIME") never clip on either side of the sign. Start at a
    // comfortable size and shrink only if the measured text would breach
    // the safe inner width.
    const safeWidth = 1300; // leave padding either side of the 1440 sign
    let fontPx = 210;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.font = `bold ${fontPx}px sans-serif`;
    while (ctx.measureText(signText).width > safeWidth && fontPx > 90) {
      fontPx -= 6;
      ctx.font = `bold ${fontPx}px sans-serif`;
    }
    ctx.fillText(signText, 742, 150);
    ctx.fillStyle = wing.subColour;
    ctx.font = "bold 78px sans-serif";
    ctx.fillText(wing.subtitle, 742, 302);
  });

  // Slim accent strip directly under the sign so the larger sign visually
  // ties back to the cubicle's accent colour. Widened to match the new
  // sign and kept flat on the partition top.
  const signUnderline = MeshBuilder.CreateBox(
    `cubSignAccent_${label}`,
    { width: 9.0, height: 0.1, depth: 0.1 },
    scene,
  );
  signUnderline.position = new Vector3(cx, 1.88, cz + 2.55);
  signUnderline.material = accentMat;

  // Desk against the back partition
  const desk = MeshBuilder.CreateBox(
    `desk_${label}`,
    { width: 3.4, height: 0.12, depth: 1.3 },
    scene,
  );
  desk.position = new Vector3(cx, 0.85, cz + 1.4);
  desk.material = deskMat;
  for (const lx of [-1.4, 1.4]) {
    const leg = MeshBuilder.CreateBox(
      `deskLeg_${label}_${lx}`,
      { width: 0.12, height: 0.85, depth: 1.0 },
      scene,
    );
    leg.position = new Vector3(cx + lx, 0.42, cz + 1.4);
    leg.material = deskMat;
  }

  // Monitor on desk — each department's screen shows its own workflow
  buildMonitor(scene, mat, new Vector3(cx - 0.6, 0.92, cz + 1.3), 0, screen);
  // Phone
  const phone = MeshBuilder.CreateBox(
    `phone_${label}`,
    { width: 0.35, height: 0.12, depth: 0.25 },
    scene,
  );
  phone.position = new Vector3(cx + 0.9, 0.97, cz + 1.5);
  phone.material = mat(`phoneMat_${label}`, "#1a1f2c");

  // Document tray
  const docTray = MeshBuilder.CreateBox(
    `docTray_${label}`,
    { width: 0.6, height: 0.06, depth: 0.4 },
    scene,
  );
  docTray.position = new Vector3(cx + 1.1, 0.95, cz + 1.1);
  docTray.material = mat(`docTrayMat_${label}`, "#f4ecdb");

  // Desk lamp, mug, and a small book stack — small voxel desktop props
  // inspired by the voxel-furniture-pack aesthetic. Colours are seeded
  // off the cubicle label so each desk feels a little different.
  const mugColors = ["#e8504c", "#ffb347", "#6ec1ff", "#2e8a6e", "#a06a4c", "#b56fbf"];
  const lampColors = ["#3a5fb0", "#e8504c", "#2e8a6e", "#ffb347", "#a06a4c", "#1a1f2c", "#b56fbf"];
  const seed = label.charCodeAt(0) + label.length;
  buildDeskLamp(
    scene,
    mat,
    `lamp_${label}`,
    new Vector3(cx + 1.35, 0.91, cz + 1.75),
    lampColors[seed % lampColors.length],
  );
  buildMug(
    scene,
    mat,
    `mug_${label}`,
    new Vector3(cx + 0.5, 0.92, cz + 1.65),
    mugColors[seed % mugColors.length],
  );
  buildBookStack(
    scene,
    mat,
    `books_${label}`,
    new Vector3(cx - 1.3, 0.92, cz + 1.65),
  );

  // Chair (in front of desk)
  const chairSeat = MeshBuilder.CreateBox(
    `chairSeat_${label}`,
    { width: 0.65, height: 0.12, depth: 0.65 },
    scene,
  );
  chairSeat.position = new Vector3(cx, 0.55, cz + 0.4);
  chairSeat.material = chairMat;
  const chairBack = MeshBuilder.CreateBox(
    `chairBack_${label}`,
    { width: 0.65, height: 0.8, depth: 0.12 },
    scene,
  );
  chairBack.position = new Vector3(cx, 1.0, cz + 0.1);
  chairBack.material = chairMat;
}

/** Build a small monitor (base + stem + screen) at the given desk position. */
function buildMonitor(
  scene: Scene,
  mat: MaterialFactory,
  base: Vector3,
  rotY: number,
  screenKind?: ScreenKind,
): void {
  const tag = `${base.x.toFixed(1)}_${base.z.toFixed(1)}`;
  const monBase = MeshBuilder.CreateBox(
    `monBase_${tag}`,
    { width: 0.4, height: 0.08, depth: 0.25 },
    scene,
  );
  monBase.position = new Vector3(base.x, base.y + 0.05, base.z);
  monBase.rotation.y = rotY;
  monBase.material = mat(`monBaseMat_${tag}`, "#1a1f2c");
  const stem = MeshBuilder.CreateBox(
    `monStem_${tag}`,
    { width: 0.08, height: 0.25, depth: 0.08 },
    scene,
  );
  stem.position = new Vector3(base.x, base.y + 0.22, base.z);
  stem.rotation.y = rotY;
  stem.material = mat(`monStemMat_${tag}`, "#1a1f2c");
  const monitor = MeshBuilder.CreateBox(
    `mon_${tag}`,
    { width: 0.95, height: 0.55, depth: 0.08 },
    scene,
  );
  monitor.position = new Vector3(base.x, base.y + 0.55, base.z);
  monitor.rotation.y = rotY;
  monitor.material = mat(`monMat_${tag}`, "#1a1f2c");
  const screen = MeshBuilder.CreateBox(
    `screen_${tag}`,
    { width: 0.85, height: 0.45, depth: 0.02 },
    scene,
  );
  screen.position = new Vector3(
    base.x + Math.sin(rotY) * 0.05,
    base.y + 0.55,
    base.z + Math.cos(rotY) * 0.05,
  );
  screen.rotation.y = rotY;
  screen.material = screenKind
    ? workflowScreenMaterial(scene, screenKind)
    : mat(`screenMat_${tag}`, "#bcd7ee");
}

const workflowScreens = new WeakMap<Scene, Map<ScreenKind, StandardMaterial>>();

/**
 * Simple workflow graphics for each department's monitor — a Member Case, a
 * NIGO/eligibility checklist, a rollover tracker, a payment breakdown, a
 * portfolio chart, a letter draft and a risk meter. Contains no real or
 * readable personal details.
 */
function workflowScreenMaterial(scene: Scene, kind: ScreenKind): StandardMaterial {
  let perScene = workflowScreens.get(scene);
  if (!perScene) {
    perScene = new Map();
    workflowScreens.set(scene, perScene);
  }
  const cached = perScene.get(kind);
  if (cached) return cached;

  const w = 256;
  const h = 144;
  const tex = new DynamicTexture(`workflowScreen_${kind}`, { width: w, height: h }, scene, false);
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = "#f4f7fb";
  ctx.fillRect(0, 0, w, h);
  const bar = (colour: string, title: string): void => {
    ctx.fillStyle = colour;
    ctx.fillRect(0, 0, w, 24);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(title, 8, 13);
  };
  const lines = (x: number, y: number, count: number, width: number): void => {
    ctx.fillStyle = "#c5cfdd";
    for (let i = 0; i < count; i++) ctx.fillRect(x, y + i * 14, width - (i % 2) * 24, 6);
  };

  switch (kind) {
    case "case":
      bar("#0ea5e9", "MEMBER CASE");
      ctx.fillStyle = "#9db6d4";
      ctx.fillRect(10, 36, 44, 44);
      lines(64, 38, 3, 170);
      lines(10, 92, 3, 232);
      break;
    case "checklist":
      bar("#6366f1", "ELIGIBILITY");
      for (let i = 0; i < 5; i++) {
        const y = 32 + i * 21;
        ctx.fillStyle = i === 3 ? "#f59e0b" : "#10b981";
        ctx.fillRect(10, y, 14, 14);
        ctx.fillStyle = "#c5cfdd";
        ctx.fillRect(34, y + 4, 150 - i * 12, 6);
      }
      break;
    case "tracker": {
      bar("#10b981", "ROLLOVER");
      ctx.fillStyle = "#c5cfdd";
      ctx.fillRect(20, 70, 216, 4);
      const colours = ["#10b981", "#10b981", "#f59e0b", "#c5cfdd"];
      colours.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(18 + i * 70, 60, 24, 24);
      });
      ctx.fillStyle = "#10b981";
      ctx.fillRect(20, 112, 120, 10);
      ctx.fillStyle = "#c5cfdd";
      ctx.fillRect(140, 112, 96, 10);
      break;
    }
    case "payment":
      bar("#a855f7", "PAYMENT");
      lines(12, 34, 1, 150);
      ctx.fillStyle = "#6366f1";
      ctx.fillRect(12, 54, 160, 12);
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(12, 74, 50, 12);
      ctx.fillStyle = "#10b981";
      ctx.fillRect(12, 94, 120, 12);
      ctx.beginPath();
      ctx.arc(214, 108, 14, 0, Math.PI * 2);
      ctx.fillStyle = "#f59e0b";
      ctx.fill();
      break;
    case "chart": {
      bar("#c9a14a", "PORTFOLIO");
      const heights = [30, 42, 36, 58, 52, 76, 70];
      heights.forEach((bh, i) => {
        ctx.fillStyle = i % 2 ? "#c9a14a" : "#1f2d4a";
        ctx.fillRect(14 + i * 22, 130 - bh, 16, bh);
      });
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(14, 96);
      ctx.lineTo(60, 78);
      ctx.lineTo(110, 86);
      ctx.lineTo(160, 58);
      ctx.lineTo(220, 44);
      ctx.stroke();
      break;
    }
    case "letter":
      bar("#ec4899", "CLIENT UPDATE");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(14, 34, 160, 96);
      ctx.strokeStyle = "#c5cfdd";
      ctx.strokeRect(14, 34, 160, 96);
      lines(24, 46, 5, 130);
      ctx.fillStyle = "#fbd5e8";
      ctx.fillRect(188, 54, 54, 40);
      ctx.fillStyle = "#ec4899";
      ctx.beginPath();
      ctx.moveTo(188, 54);
      ctx.lineTo(215, 78);
      ctx.lineTo(242, 54);
      ctx.fill();
      break;
    case "risk":
      bar("#ef4444", "RISK CHECK");
      ctx.lineWidth = 14;
      for (const [c, a0, a1] of [
        ["#10b981", Math.PI, Math.PI * 1.34],
        ["#f59e0b", Math.PI * 1.34, Math.PI * 1.67],
        ["#ef4444", Math.PI * 1.67, Math.PI * 2],
      ] as const) {
        ctx.strokeStyle = c;
        ctx.beginPath();
        ctx.arc(128, 118, 62, a0, a1);
        ctx.stroke();
      }
      ctx.strokeStyle = "#1f2d4a";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(128, 118);
      ctx.lineTo(160, 76);
      ctx.stroke();
      break;
  }
  tex.update();

  const m = new StandardMaterial(`workflowScreenMat_${kind}`, scene);
  m.diffuseTexture = tex;
  m.specularColor = new Color3(0.05, 0.05, 0.05);
  m.emissiveColor = new Color3(0.55, 0.55, 0.55);
  perScene.set(kind, m);
  return m;
}

/** A pot with cube of leaves on top — used liberally to break up the floor. */
function buildPlant(
  scene: Scene,
  mat: MaterialFactory,
  pos: Vector3,
): void {
  const tag = `${pos.x.toFixed(1)}_${pos.z.toFixed(1)}_${pos.y.toFixed(1)}`;
  const pot = MeshBuilder.CreateBox(
    `plantPot_${tag}`,
    { width: 0.55, height: 0.45, depth: 0.55 },
    scene,
  );
  pot.position = new Vector3(pos.x, pos.y + 0.22, pos.z);
  pot.material = mat(`plantPotMat_${tag}`, "#6a4a36");
  const leaves = MeshBuilder.CreateBox(
    `plantLeaves_${tag}`,
    { width: 0.95, height: 0.8, depth: 0.95 },
    scene,
  );
  leaves.position = new Vector3(pos.x, pos.y + 0.85, pos.z);
  leaves.material = mat(`plantLeavesMat_${tag}`, "#3f7a44");
}

/** Head of Client Operations office: large desk, big chair, executive sign. */
function buildTeamLeaderOffice(
  scene: Scene,
  mat: MaterialFactory,
  origin: Vector3,
): void {
  // Floor accent (dark wood)
  const accent = MeshBuilder.CreateBox(
    "tlFloor",
    { width: 6.5, height: 0.05, depth: 5.0 },
    scene,
  );
  accent.position = new Vector3(origin.x, 0.13, origin.z);
  accent.material = mat("tlFloor", "#3a2a20");

  // Glass partition (low) at the front
  const partition = MeshBuilder.CreateBox(
    "tlPart",
    { width: 6.5, height: 1.4, depth: 0.1 },
    scene,
  );
  partition.position = new Vector3(origin.x, 0.7, origin.z - 2.4);
  partition.material = mat("tlPartMat", "#cfe7ff");
  // Frame
  const partFrame = MeshBuilder.CreateBox(
    "tlPartFrame",
    { width: 6.5, height: 0.1, depth: 0.12 },
    scene,
  );
  partFrame.position = new Vector3(origin.x, 1.4, origin.z - 2.4);
  partFrame.material = mat("tlPartFrame", "#2a3a5c");

  // Sign above the front glass partition (faces outward toward the corridor)
  const sign = MeshBuilder.CreateBox(
    "tlSign",
    { width: 3.0, height: 0.5, depth: 0.05 },
    scene,
  );
  sign.position = new Vector3(origin.x, 1.9, origin.z - 2.4);
  drawSignTexture(scene, sign, 512, 96, (ctx) => {
    ctx.fillStyle = "#1f2d4a";
    ctx.fillRect(0, 0, 512, 96);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 38px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("HEAD OF CLIENT OPS", 256, 50);
  });

  // Overhead sign matching the other department zones so the executive
  // office is clearly labelled from the bird's-eye orbit camera. Mounted at
  // the back of the office, enlarged and tilted 30° upward so the face angles
  // toward the camera, with a slim gold accent strip underneath.
  const accentMat = mat("tlSignAccent", "#c9a14a");
  const overheadSign = MeshBuilder.CreateBox(
    "tlSignOverhead",
    { width: 9.0, height: 2.4, depth: 0.08 },
    scene,
  );
  overheadSign.rotation.x = Math.PI / 6; // 30 degrees
  overheadSign.position = new Vector3(origin.x, 3.0, origin.z + 2.3);
  drawSignTexture(scene, overheadSign, 1440, 384, (ctx) => {
    ctx.fillStyle = "#1f2d4a";
    ctx.fillRect(0, 0, 1440, 384);
    ctx.fillStyle = "#14b8a6";
    ctx.fillRect(0, 0, 44, 384);
    ctx.fillStyle = "#c9a14a";
    ctx.fillRect(44, 0, 1396, 10);
    ctx.fillRect(44, 374, 1396, 10);
    ctx.fillStyle = "#ffffff";
    const safeWidth = 1300;
    let fontPx = 180;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.font = `bold ${fontPx}px sans-serif`;
    const label = "HEAD OF CLIENT OPS";
    while (ctx.measureText(label).width > safeWidth && fontPx > 90) {
      fontPx -= 6;
      ctx.font = `bold ${fontPx}px sans-serif`;
    }
    ctx.fillText(label, 742, 150);
    ctx.fillStyle = "#e7c872";
    ctx.font = "bold 78px sans-serif";
    ctx.fillText("LEADS BOTH TEAMS", 742, 302);
  });

  const overheadUnderline = MeshBuilder.CreateBox(
    "tlSignOverheadAccent",
    { width: 9.0, height: 0.1, depth: 0.1 },
    scene,
  );
  overheadUnderline.position = new Vector3(origin.x, 1.88, origin.z + 2.55);
  overheadUnderline.material = accentMat;

  // Executive desk
  const desk = MeshBuilder.CreateBox(
    "tlDesk",
    { width: 3.4, height: 0.15, depth: 1.3 },
    scene,
  );
  desk.position = new Vector3(origin.x, 0.85, origin.z + 0.4);
  desk.material = mat("tlDeskMat", "#a06a4c");
  const deskBase = MeshBuilder.CreateBox(
    "tlDeskBase",
    { width: 3.2, height: 0.85, depth: 1.1 },
    scene,
  );
  deskBase.position = new Vector3(origin.x, 0.43, origin.z + 0.4);
  deskBase.material = mat("tlDeskBaseMat", "#7d4f33");

  // Monitor + executive chair
  buildMonitor(scene, mat, new Vector3(origin.x - 0.7, 0.93, origin.z + 0.3), 0);
  const chairSeat = MeshBuilder.CreateBox(
    "tlChair",
    { width: 0.75, height: 0.12, depth: 0.7 },
    scene,
  );
  chairSeat.position = new Vector3(origin.x, 0.55, origin.z + 1.3);
  chairSeat.material = mat("tlChairMat", "#1c2230");
  const chairBack = MeshBuilder.CreateBox(
    "tlChairBack",
    { width: 0.75, height: 1.0, depth: 0.15 },
    scene,
  );
  chairBack.position = new Vector3(origin.x, 1.05, origin.z + 1.6);
  chairBack.material = mat("tlChairBackMat", "#1c2230");

  // Bookshelf behind
  const shelf = MeshBuilder.CreateBox(
    "tlShelf",
    { width: 2.6, height: 1.6, depth: 0.4 },
    scene,
  );
  shelf.position = new Vector3(origin.x + 1.5, 0.8, origin.z + 2.6);
  shelf.material = mat("tlShelfMat", "#3a2a20");
  for (let s = 0; s < 3; s++) {
    const stripe = MeshBuilder.CreateBox(
      `tlShelfStripe_${s}`,
      { width: 2.62, height: 0.05, depth: 0.42 },
      scene,
    );
    stripe.position = new Vector3(origin.x + 1.5, 0.4 + s * 0.5, origin.z + 2.6);
    stripe.material = mat("tlShelfStripeMat", "#cdb497");
  }

  // Voxel-pack flair: rug under the desk, desk lamp + mug + books on the
  // executive desk, and a row of coloured books on each shelf level.
  buildRug(scene, mat, "tlRug", new Vector3(origin.x, 0.15, origin.z + 0.6), 4.0, 2.6, "#a06a4c");
  buildDeskLamp(scene, mat, "tlDeskLamp", new Vector3(origin.x + 1.4, 0.93, origin.z + 0.5), "#2a3a5c");
  buildMug(scene, mat, "tlDeskMug", new Vector3(origin.x + 0.8, 0.94, origin.z + 0.6), "#e8504c");
  buildBookStack(scene, mat, "tlDeskBooks", new Vector3(origin.x - 1.3, 0.93, origin.z + 0.6));
  for (let s = 0; s < 3; s++) {
    buildShelfBooks(
      scene,
      mat,
      `tlShelfRow_${s}`,
      new Vector3(origin.x + 1.5, 0.55 + s * 0.5, origin.z + 2.45),
      2.4,
    );
  }
  // Small framed photo on the bookshelf top
  buildFramedArt(
    scene,
    mat,
    "tlFrame",
    new Vector3(origin.x + 0.4, 1.85, origin.z + 2.6),
    0.7,
    0.55,
    "#e8504c",
  );
  buildPlant(scene, mat, new Vector3(origin.x + 2.6, 1.6, origin.z + 2.6));
}

/**
 * Build a section of two glass-walled client meeting suites side-by-side
 * along the back of the office, unified by a shared accent floor and an
 * overhead "CLIENT MEETING SUITES" banner. The Advice Suite hosts adviser and
 * client reviews; Case Conference is where the Team Leader brings the
 * specialists together on one case. Each suite has its own conference table,
 * chairs, wall display and pendant lamps. The section is positioned by its
 * mid-point; the two suites are placed symmetrically to its left and right.
 */
function buildMeetingRoomSection(
  scene: Scene,
  mat: MaterialFactory,
  origin: Vector3,
): void {
  // Shared accent floor under both rooms (navy) so the section reads
  // as one unified zone from the bird's-eye camera.
  const sectionFloor = MeshBuilder.CreateBox(
    "mrSectionFloor",
    { width: 16.4, height: 0.05, depth: 5.4 },
    scene,
  );
  sectionFloor.position = new Vector3(origin.x, 0.13, origin.z + 0.2);
  sectionFloor.material = mat("mrSectionFloorMat", "#2a3a5c");

  // Overhead "CLIENT MEETING SUITES" banner mounted on the back wall, above
  // the shared cabinet line, so the section is clearly labelled from a
  // distance.
  const banner = MeshBuilder.CreateBox(
    "mrSectionBanner",
    { width: 8.0, height: 0.9, depth: 0.08 },
    scene,
  );
  banner.position = new Vector3(origin.x, 4.1, 31.78);
  drawSignTexture(scene, banner, 1024, 140, (ctx) => {
    ctx.fillStyle = "#1f2d4a";
    ctx.fillRect(0, 0, 1024, 140);
    ctx.fillStyle = "#c9a14a";
    ctx.fillRect(0, 0, 1024, 6);
    ctx.fillRect(0, 134, 1024, 6);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 70px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("CLIENT MEETING SUITES", 512, 76);
  });

  // Two suites 9 units apart, centred on the section origin
  buildMeetingRoom(
    scene,
    mat,
    new Vector3(origin.x - 4.5, 0, origin.z),
    "mrA",
    "ADVICE SUITE",
  );
  buildMeetingRoom(
    scene,
    mat,
    new Vector3(origin.x + 4.5, 0, origin.z),
    "mrB",
    "CASE CONFERENCE",
  );
}

/** Glass-walled client meeting suite with a long table and chairs. */
function buildMeetingRoom(
  scene: Scene,
  mat: MaterialFactory,
  origin: Vector3,
  tag: string = "mr",
  title: string = "MEETING ROOM",
): void {
  const glass = mat(`${tag}Glass`, "#cfe7ff");
  const frame = mat(`${tag}Frame`, "#2a3a5c");

  // Glass walls (3 sides — back is the office wall)
  const front = MeshBuilder.CreateBox(
    `${tag}_front`,
    { width: 7.0, height: 2.4, depth: 0.1 },
    scene,
  );
  front.position = new Vector3(origin.x, 1.2, origin.z - 2.5);
  front.material = glass;
  const left = MeshBuilder.CreateBox(
    `${tag}_left`,
    { width: 0.1, height: 2.4, depth: 5.0 },
    scene,
  );
  left.position = new Vector3(origin.x - 3.5, 1.2, origin.z);
  left.material = glass;
  const right = MeshBuilder.CreateBox(
    `${tag}_right`,
    { width: 0.1, height: 2.4, depth: 5.0 },
    scene,
  );
  right.position = new Vector3(origin.x + 3.5, 1.2, origin.z);
  right.material = glass;

  // Frames
  const frontFrame = MeshBuilder.CreateBox(
    `${tag}_frontFrame`,
    { width: 7.0, height: 0.12, depth: 0.14 },
    scene,
  );
  frontFrame.position = new Vector3(origin.x, 2.4, origin.z - 2.5);
  frontFrame.material = frame;
  const leftFrame = MeshBuilder.CreateBox(
    `${tag}_leftFrame`,
    { width: 0.14, height: 0.12, depth: 5.0 },
    scene,
  );
  leftFrame.position = new Vector3(origin.x - 3.5, 2.4, origin.z);
  leftFrame.material = frame;
  const rightFrame = MeshBuilder.CreateBox(
    `${tag}_rightFrame`,
    { width: 0.14, height: 0.12, depth: 5.0 },
    scene,
  );
  rightFrame.position = new Vector3(origin.x + 3.5, 2.4, origin.z);
  rightFrame.material = frame;

  // Sign above
  const sign = MeshBuilder.CreateBox(
    `${tag}_sign`,
    { width: 3.2, height: 0.55, depth: 0.06 },
    scene,
  );
  sign.position = new Vector3(origin.x, 2.95, origin.z - 2.5);
  drawSignTexture(scene, sign, 512, 96, (ctx) => {
    ctx.fillStyle = "#2a3a5c";
    ctx.fillRect(0, 0, 512, 96);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 44px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(title, 256, 50);
  });

  // Conference table
  const table = MeshBuilder.CreateBox(
    `${tag}_table`,
    { width: 4.5, height: 0.15, depth: 1.6 },
    scene,
  );
  table.position = new Vector3(origin.x, 0.85, origin.z + 0.5);
  table.material = mat(`${tag}_tableMat`, "#bca78a");
  const tableBase = MeshBuilder.CreateBox(
    `${tag}_tableBase`,
    { width: 4.0, height: 0.85, depth: 0.5 },
    scene,
  );
  tableBase.position = new Vector3(origin.x, 0.43, origin.z + 0.5);
  tableBase.material = mat(`${tag}_tableBaseMat`, "#7d4f33");

  // Chairs around the table
  for (const cz of [-0.4, 1.4]) {
    for (const cx of [-1.5, 0, 1.5]) {
      const seat = MeshBuilder.CreateBox(
        `${tag}_chair_${cx}_${cz}`,
        { width: 0.55, height: 0.1, depth: 0.55 },
        scene,
      );
      seat.position = new Vector3(origin.x + cx, 0.55, origin.z + cz);
      seat.material = mat(`${tag}_chairMat`, "#1c2230");
      const back = MeshBuilder.CreateBox(
        `${tag}_chairBack_${cx}_${cz}`,
        { width: 0.55, height: 0.65, depth: 0.1 },
        scene,
      );
      back.position = new Vector3(
        origin.x + cx,
        0.93,
        origin.z + cz + (cz > 0 ? 0.25 : -0.25),
      );
      back.material = mat(`${tag}_chairBackMat`, "#1c2230");
    }
  }

  // Wall-mounted display on back wall
  const tv = MeshBuilder.CreateBox(
    `${tag}_tv`,
    { width: 3.0, height: 1.6, depth: 0.08 },
    scene,
  );
  tv.position = new Vector3(origin.x, 1.8, origin.z + 2.45);
  drawSignTexture(scene, tv, 512, 280, (ctx) => {
    ctx.fillStyle = "#1a1f2c";
    ctx.fillRect(0, 0, 512, 280);
    // Bar chart
    const bars = [70, 120, 90, 160, 110, 200];
    const barW = 50;
    for (let i = 0; i < bars.length; i++) {
      ctx.fillStyle = "#6ec1ff";
      ctx.fillRect(40 + i * (barW + 16), 240 - bars[i], barW, bars[i]);
    }
    ctx.strokeStyle = "#cfd8ee";
    ctx.beginPath();
    ctx.moveTo(20, 250);
    ctx.lineTo(500, 250);
    ctx.stroke();
  });

  // Voxel-pack flair: pendant lamp above the table, laptops + mugs at each
  // chair, and a centerpiece plant.
  buildPendantLamp(scene, mat, `${tag}_pendantA`, new Vector3(origin.x - 1.0, 3.6, origin.z + 0.5), "#ffb347");
  buildPendantLamp(scene, mat, `${tag}_pendantB`, new Vector3(origin.x + 1.0, 3.6, origin.z + 0.5), "#ffb347");
  const laptopColors = ["#3a5fb0", "#e8504c", "#2e8a6e", "#a06a4c", "#b56fbf", "#1a1f2c"];
  let i = 0;
  for (const cz of [-0.4, 1.4]) {
    for (const cx of [-1.5, 0, 1.5]) {
      buildLaptop(
        scene,
        mat,
        `${tag}_laptop_${cx}_${cz}`,
        new Vector3(origin.x + cx, 0.93, origin.z + cz + (cz > 0 ? -0.2 : 0.2)),
        cz > 0,
        laptopColors[i % laptopColors.length],
      );
      i++;
    }
  }
  buildPlant(scene, mat, new Vector3(origin.x, 0.93, origin.z + 0.5));
}

/**
 * Client-facing welcome counter: a coloured base + light top with a small
 * raised badge sign. Used to populate the lobby with multiple service points.
 */
function buildLobbyCounter(
  scene: Scene,
  mat: MaterialFactory,
  signText: string,
  cx: number,
  cz: number,
  accentHex: string,
): void {
  const tag = signText.replace(/\s+/g, "_").toLowerCase();
  // Base
  const base = MeshBuilder.CreateBox(
    `lc_base_${tag}`,
    { width: 3.0, height: 1.05, depth: 1.1 },
    scene,
  );
  base.position = new Vector3(cx, 0.525, cz);
  base.material = mat(`lc_baseMat_${tag}`, accentHex);

  // Top counter surface (slightly oversize for an overhang)
  const top = MeshBuilder.CreateBox(
    `lc_top_${tag}`,
    { width: 3.2, height: 0.12, depth: 1.3 },
    scene,
  );
  top.position = new Vector3(cx, 1.11, cz);
  top.material = mat(`lc_topMat_${tag}`, "#f4ecdb");

  // Front kick-plate accent stripe
  const stripe = MeshBuilder.CreateBox(
    `lc_stripe_${tag}`,
    { width: 3.0, height: 0.08, depth: 0.05 },
    scene,
  );
  stripe.position = new Vector3(cx, 0.18, cz - 0.55);
  stripe.material = mat(`lc_stripeMat_${tag}`, "#ffffff");

  // Standing badge sign on the counter top
  const sign = MeshBuilder.CreateBox(
    `lc_sign_${tag}`,
    { width: 1.6, height: 0.55, depth: 0.06 },
    scene,
  );
  sign.position = new Vector3(cx, 1.45, cz + 0.4);
  drawSignTexture(scene, sign, 512, 180, (ctx) => {
    ctx.fillStyle = accentHex;
    ctx.fillRect(0, 0, 512, 180);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // Shrink-to-fit so longer labels (e.g. "NEW ACCOUNTS") keep a margin.
    let fontPx = 56;
    ctx.font = `bold ${fontPx}px sans-serif`;
    while (ctx.measureText(signText).width > 460 && fontPx > 32) {
      fontPx -= 2;
      ctx.font = `bold ${fontPx}px sans-serif`;
    }
    ctx.fillText(signText, 256, 95);
  });

  // A small monitor and a clipboard tray on the counter
  buildMonitor(scene, mat, new Vector3(cx - 0.7, 1.17, cz - 0.1), 0);
  const tray = MeshBuilder.CreateBox(
    `lc_tray_${tag}`,
    { width: 0.55, height: 0.06, depth: 0.4 },
    scene,
  );
  tray.position = new Vector3(cx + 0.7, 1.2, cz - 0.1);
  tray.material = mat(`lc_trayMat_${tag}`, "#2a3a5c");

  // Stool on the staff side (behind the counter)
  const stool = MeshBuilder.CreateBox(
    `lc_stool_${tag}`,
    { width: 0.5, height: 0.1, depth: 0.5 },
    scene,
  );
  stool.position = new Vector3(cx, 0.7, cz + 0.95);
  stool.material = mat(`lc_stoolMat_${tag}`, "#1c2230");
}

/**
 * Kitchen / break-room: counter run with sink + stove markings, fridge,
 * microwave, and a small dining set with stools. Sits on the back-right
 * accent floor.
 */
function buildKitchen(
  scene: Scene,
  mat: MaterialFactory,
  origin: Vector3,
): void {
  const cabMat = mat("kitCab", "#3a5fb0");
  const counterMat = mat("kitCounter", "#e8e1cf");

  // Long counter run along the back of the kitchen zone
  const counterBase = MeshBuilder.CreateBox(
    "kitCounterBase",
    { width: 7.5, height: 0.95, depth: 1.0 },
    scene,
  );
  counterBase.position = new Vector3(origin.x, 0.475, origin.z + 2.5);
  counterBase.material = cabMat;
  const counterTop = MeshBuilder.CreateBox(
    "kitCounterTop",
    { width: 7.7, height: 0.12, depth: 1.15 },
    scene,
  );
  counterTop.position = new Vector3(origin.x, 1.01, origin.z + 2.5);
  counterTop.material = counterMat;

  // Sink basin (dark inset on the counter top)
  const sink = MeshBuilder.CreateBox(
    "kitSink",
    { width: 1.1, height: 0.05, depth: 0.7 },
    scene,
  );
  sink.position = new Vector3(origin.x - 1.8, 1.085, origin.z + 2.5);
  sink.material = mat("kitSinkMat", "#7a8aa6");
  // Faucet
  const faucet = MeshBuilder.CreateBox(
    "kitFaucet",
    { width: 0.08, height: 0.35, depth: 0.08 },
    scene,
  );
  faucet.position = new Vector3(origin.x - 1.8, 1.28, origin.z + 2.85);
  faucet.material = mat("kitFaucetMat", "#cdd5e0");

  // Stove (4 burners as small dark squares)
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      const burner = MeshBuilder.CreateBox(
        `kitBurner_${r}_${c}`,
        { width: 0.32, height: 0.04, depth: 0.32 },
        scene,
      );
      burner.position = new Vector3(
        origin.x + 0.7 + c * 0.45,
        1.085,
        origin.z + 2.3 + r * 0.45,
      );
      burner.material = mat("kitBurnerMat", "#1c2230");
    }
  }

  // Microwave on top of the counter
  const micro = MeshBuilder.CreateBox(
    "kitMicro",
    { width: 1.2, height: 0.6, depth: 0.7 },
    scene,
  );
  micro.position = new Vector3(origin.x + 2.8, 1.4, origin.z + 2.55);
  micro.material = mat("kitMicroMat", "#22252e");
  const microDoor = MeshBuilder.CreateBox(
    "kitMicroDoor",
    { width: 0.85, height: 0.45, depth: 0.05 },
    scene,
  );
  microDoor.position = new Vector3(origin.x + 2.7, 1.4, origin.z + 2.18);
  microDoor.material = mat("kitMicroDoorMat", "#6ec1ff");

  // Fridge (tall, on the right end of the run)
  const fridge = MeshBuilder.CreateBox(
    "kitFridge",
    { width: 1.4, height: 2.4, depth: 1.0 },
    scene,
  );
  fridge.position = new Vector3(origin.x + 4.4, 1.2, origin.z + 2.5);
  fridge.material = mat("kitFridgeMat", "#e1e6ec");
  const fridgeSeam = MeshBuilder.CreateBox(
    "kitFridgeSeam",
    { width: 1.42, height: 0.04, depth: 1.02 },
    scene,
  );
  fridgeSeam.position = new Vector3(origin.x + 4.4, 1.6, origin.z + 2.5);
  fridgeSeam.material = mat("kitFridgeSeamMat", "#a8b0bd");
  const fridgeHandle = MeshBuilder.CreateBox(
    "kitFridgeHandle",
    { width: 0.06, height: 1.6, depth: 0.06 },
    scene,
  );
  fridgeHandle.position = new Vector3(origin.x + 3.8, 1.4, origin.z + 1.95);
  fridgeHandle.material = mat("kitFridgeHandleMat", "#7a8aa6");

  // Wall sign
  const sign = MeshBuilder.CreateBox(
    "kitSign",
    { width: 2.6, height: 0.55, depth: 0.06 },
    scene,
  );
  sign.position = new Vector3(origin.x - 2.2, 2.4, origin.z + 3.05);
  drawSignTexture(scene, sign, 512, 110, (ctx) => {
    ctx.fillStyle = "#2e8a6e";
    ctx.fillRect(0, 0, 512, 110);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 56px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("STAFF KITCHEN", 256, 60);
  });

  // Dining bar (high counter) with stools — front of the kitchen zone
  const barTop = MeshBuilder.CreateBox(
    "kitBarTop",
    { width: 4.4, height: 0.12, depth: 0.9 },
    scene,
  );
  barTop.position = new Vector3(origin.x - 1.4, 1.01, origin.z - 1.5);
  barTop.material = mat("kitBarTopMat", "#a06a4c");
  const barBase = MeshBuilder.CreateBox(
    "kitBarBase",
    { width: 4.0, height: 0.9, depth: 0.4 },
    scene,
  );
  barBase.position = new Vector3(origin.x - 1.4, 0.45, origin.z - 1.55);
  barBase.material = mat("kitBarBaseMat", "#7d4f33");
  for (const sx of [-2.6, -1.4, -0.2]) {
    const stoolTop = MeshBuilder.CreateBox(
      `kitStool_${sx}`,
      { width: 0.45, height: 0.1, depth: 0.45 },
      scene,
    );
    stoolTop.position = new Vector3(origin.x + sx, 0.85, origin.z - 2.2);
    stoolTop.material = mat("kitStoolTopMat", "#1c2230");
    const stoolStem = MeshBuilder.CreateBox(
      `kitStoolStem_${sx}`,
      { width: 0.1, height: 0.8, depth: 0.1 },
      scene,
    );
    stoolStem.position = new Vector3(origin.x + sx, 0.4, origin.z - 2.2);
    stoolStem.material = mat("kitStoolStemMat", "#7a8aa6");
  }

  // A coffee machine on the bar
  const coffee = MeshBuilder.CreateBox(
    "kitCoffee",
    { width: 0.5, height: 0.55, depth: 0.45 },
    scene,
  );
  coffee.position = new Vector3(origin.x + 1.6, 1.34, origin.z - 1.5);
  coffee.material = mat("kitCoffeeMat", "#1a1f2c");
  const coffeeTop = MeshBuilder.CreateBox(
    "kitCoffeeTop",
    { width: 0.45, height: 0.1, depth: 0.4 },
    scene,
  );
  coffeeTop.position = new Vector3(origin.x + 1.6, 1.66, origin.z - 1.5);
  coffeeTop.material = mat("kitCoffeeTopMat", "#6ec1ff");

  // Voxel-pack accents: pendant lamp over the breakfast bar, fruit bowl on
  // the counter, mugs lined up by the coffee machine, and a wall clock.
  buildPendantLamp(scene, mat, "kitPendantA", new Vector3(origin.x - 2.2, 3.4, origin.z - 1.5), "#e8504c");
  buildPendantLamp(scene, mat, "kitPendantB", new Vector3(origin.x - 0.6, 3.4, origin.z - 1.5), "#2e8a6e");
  buildFruitBowl(scene, mat, "kitFruit", new Vector3(origin.x - 0.5, 1.08, origin.z + 2.5));
  for (const mx of [0.9, 1.2, 1.5]) {
    buildMug(scene, mat, `kitMug_${mx}`, new Vector3(origin.x + mx, 1.08, origin.z - 1.4), "#ffffff");
  }
  buildWallClock(scene, mat, "kitClock", new Vector3(origin.x + 1.5, 2.6, origin.z + 3.05));
}

/**
 * Café / coffee corner: two small bistro tables with stools and a tall plant,
 * tucked along the right-side accent floor.
 */
function buildCafe(
  scene: Scene,
  mat: MaterialFactory,
  origin: Vector3,
): void {
  const tableTopMat = mat("cafeTableTop", "#a06a4c");
  const tableLegMat = mat("cafeTableLeg", "#7d4f33");
  const stoolMat = mat("cafeStool", "#3a5fb0");

  for (const tz of [-1.6, 1.6]) {
    const top = MeshBuilder.CreateBox(
      `cafeTop_${tz}`,
      { width: 1.3, height: 0.1, depth: 1.3 },
      scene,
    );
    top.position = new Vector3(origin.x, 0.95, origin.z + tz);
    top.material = tableTopMat;
    const leg = MeshBuilder.CreateBox(
      `cafeLeg_${tz}`,
      { width: 0.18, height: 0.85, depth: 0.18 },
      scene,
    );
    leg.position = new Vector3(origin.x, 0.475, origin.z + tz);
    leg.material = tableLegMat;
    const base = MeshBuilder.CreateBox(
      `cafeBase_${tz}`,
      { width: 0.6, height: 0.05, depth: 0.6 },
      scene,
    );
    base.position = new Vector3(origin.x, 0.07, origin.z + tz);
    base.material = tableLegMat;
    // Two stools per table
    for (const sx of [-0.95, 0.95]) {
      const stoolTop = MeshBuilder.CreateBox(
        `cafeStoolTop_${tz}_${sx}`,
        { width: 0.45, height: 0.1, depth: 0.45 },
        scene,
      );
      stoolTop.position = new Vector3(origin.x + sx, 0.6, origin.z + tz);
      stoolTop.material = stoolMat;
      const stoolStem = MeshBuilder.CreateBox(
        `cafeStoolStem_${tz}_${sx}`,
        { width: 0.1, height: 0.55, depth: 0.1 },
        scene,
      );
      stoolStem.position = new Vector3(origin.x + sx, 0.28, origin.z + tz);
      stoolStem.material = mat("cafeStoolStemMat", "#7a8aa6");
    }
    // Coffee cup decoration
    const cup = MeshBuilder.CreateBox(
      `cafeCup_${tz}`,
      { width: 0.18, height: 0.18, depth: 0.18 },
      scene,
    );
    cup.position = new Vector3(origin.x + 0.2, 1.09, origin.z + tz);
    cup.material = mat("cafeCupMat", "#ffffff");
  }

  // Café sign on the right wall
  const sign = MeshBuilder.CreateBox(
    "cafeSign",
    { width: 0.08, height: 0.6, depth: 3.6 },
    scene,
  );
  sign.position = new Vector3(origin.x + 2.4, 2.5, origin.z);
  drawSignTexture(scene, sign, 768, 96, (ctx) => {
    ctx.fillStyle = "#a06a4c";
    ctx.fillRect(0, 0, 768, 96);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 48px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("CLIENT CAFÉ", 384, 50);
  });

  // Tall corner plant
  buildPlant(scene, mat, new Vector3(origin.x + 1.8, 0, origin.z - 2.5));

  // Voxel-pack accents: pendant lamps over each table.
  buildPendantLamp(scene, mat, "cafePendantA", new Vector3(origin.x, 3.2, origin.z - 1.6), "#a06a4c");
  buildPendantLamp(scene, mat, "cafePendantB", new Vector3(origin.x, 3.2, origin.z + 1.6), "#a06a4c");
}

/**
 * Member Lounge: a quiet seminar-style corner with a retirement-income
 * projection screen, cream armchairs and sofa around a brass coffee table,
 * a calculator kiosk and a brochure rack. Sits on the front-right navy floor.
 */
function buildMemberLounge(
  scene: Scene,
  mat: MaterialFactory,
  origin: Vector3,
): void {
  const cream = mat("loungeCream", "#e8dcc4");
  const navy = mat("loungeNavy", "#1f2d4a");
  const brass = mat("loungeBrass", "#c9a14a");

  // Rug under the seating group
  const rugBorder = MeshBuilder.CreateBox(
    "loungeRugBorder",
    { width: 6.6, height: 0.02, depth: 3.6 },
    scene,
  );
  rugBorder.position = new Vector3(origin.x - 0.8, 0.17, origin.z - 0.4);
  rugBorder.material = brass;
  const rug = MeshBuilder.CreateBox(
    "loungeRug",
    { width: 6.2, height: 0.025, depth: 3.2 },
    scene,
  );
  rug.position = new Vector3(origin.x - 0.8, 0.175, origin.z - 0.4);
  rug.material = mat("loungeRugFill", "#3a4c70");

  // Seminar screen on a low timber plinth against the back of the zone
  const plinth = MeshBuilder.CreateBox(
    "loungePlinth",
    { width: 6.0, height: 0.7, depth: 0.4 },
    scene,
  );
  plinth.position = new Vector3(origin.x - 0.8, 0.35, origin.z + 2.6);
  plinth.material = mat("loungePlinth", "#5a3d2b");
  const screen = MeshBuilder.CreateBox(
    "loungeScreen",
    { width: 5.6, height: 1.9, depth: 0.1 },
    scene,
  );
  screen.position = new Vector3(origin.x - 0.8, 1.7, origin.z + 2.5);
  drawSignTexture(scene, screen, 768, 260, (ctx) => {
    ctx.fillStyle = "#16213a";
    ctx.fillRect(0, 0, 768, 260);
    ctx.fillStyle = "#e7c872";
    ctx.font = "bold 34px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("RETIREMENT INCOME PROJECTION", 30, 48);
    ctx.fillStyle = "#b9c4dd";
    ctx.font = "22px sans-serif";
    ctx.fillText("Illustrative only — general information", 30, 80);
    // Rising balance bars with an income line
    for (let i = 0; i < 10; i++) {
      const bh = 40 + i * 14 - (i > 6 ? (i - 6) * 28 : 0);
      ctx.fillStyle = i < 7 ? "#c9a14a" : "#14b8a6";
      ctx.fillRect(40 + i * 62, 240 - bh, 44, bh);
    }
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(40, 180);
    ctx.lineTo(660, 170);
    ctx.stroke();
  });

  // Seating: a sofa and two armchairs facing the screen
  const buildSeat = (tag: string, x: number, z: number, w: number): void => {
    const seat = MeshBuilder.CreateBox(`${tag}_seat`, { width: w, height: 0.45, depth: 1.1 }, scene);
    seat.position = new Vector3(x, 0.4, z);
    seat.material = cream;
    const back = MeshBuilder.CreateBox(`${tag}_back`, { width: w, height: 0.7, depth: 0.25 }, scene);
    back.position = new Vector3(x, 0.85, z - 0.5);
    back.material = cream;
    for (const side of [-1, 1]) {
      const arm = MeshBuilder.CreateBox(`${tag}_arm${side}`, { width: 0.22, height: 0.6, depth: 1.1 }, scene);
      arm.position = new Vector3(x + side * (w / 2 - 0.11), 0.6, z);
      arm.material = cream;
    }
  };
  buildSeat("loungeSofa", origin.x - 0.8, origin.z - 1.4, 3.0);
  buildSeat("loungeChairL", origin.x - 3.8, origin.z - 0.2, 1.3);
  buildSeat("loungeChairR", origin.x + 2.2, origin.z - 0.2, 1.3);
  buildCushion(scene, mat, "loungeCushionA", new Vector3(origin.x - 1.6, 0.75, origin.z - 1.5), "#1f2d4a");
  buildCushion(scene, mat, "loungeCushionB", new Vector3(origin.x + 0.0, 0.75, origin.z - 1.5), "#c9a14a");

  // Brass-and-glass coffee table with a magazine
  const tableTop = MeshBuilder.CreateBox("loungeTableTop", { width: 1.8, height: 0.1, depth: 1.0 }, scene);
  tableTop.position = new Vector3(origin.x - 0.8, 0.5, origin.z - 0.1);
  tableTop.material = mat("loungeTableTop", "#2a2f3a");
  const tableBase = MeshBuilder.CreateBox("loungeTableBase", { width: 1.5, height: 0.4, depth: 0.7 }, scene);
  tableBase.position = new Vector3(origin.x - 0.8, 0.22, origin.z - 0.1);
  tableBase.material = brass;
  buildMagazines(scene, mat, "loungeMags", new Vector3(origin.x - 0.8, 0.56, origin.z - 0.1));

  // Retirement calculator kiosk: pedestal with an angled tablet
  const kioskBase = MeshBuilder.CreateBox("loungeKioskBase", { width: 0.7, height: 1.0, depth: 0.5 }, scene);
  kioskBase.position = new Vector3(origin.x + 4.0, 0.5, origin.z - 1.8);
  kioskBase.material = navy;
  const kioskScreen = MeshBuilder.CreateBox("loungeKioskScreen", { width: 0.9, height: 0.55, depth: 0.06 }, scene);
  kioskScreen.position = new Vector3(origin.x + 4.0, 1.25, origin.z - 1.85);
  kioskScreen.rotation.x = -Math.PI / 7;
  drawSignTexture(scene, kioskScreen, 256, 160, (ctx) => {
    ctx.fillStyle = "#f4f7fb";
    ctx.fillRect(0, 0, 256, 160);
    ctx.fillStyle = "#c9a14a";
    ctx.fillRect(0, 0, 256, 30);
    ctx.fillStyle = "#1f2d4a";
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("MY SUPER", 10, 21);
    ctx.fillStyle = "#14b8a6";
    ctx.fillRect(14, 52, 150, 16);
    ctx.fillStyle = "#c5cfdd";
    ctx.fillRect(14, 80, 200, 10);
    ctx.fillRect(14, 102, 170, 10);
    ctx.fillRect(14, 124, 120, 10);
  });

  // Brochure rack
  const rack = MeshBuilder.CreateBox("loungeRack", { width: 0.9, height: 1.5, depth: 0.3 }, scene);
  rack.position = new Vector3(origin.x - 4.4, 0.75, origin.z + 1.9);
  rack.material = mat("loungeRack", "#3a4c70");
  ["#0f766e", "#c9a14a", "#6366f1", "#ec4899"].forEach((hex, i) => {
    const leaflet = MeshBuilder.CreateBox(`loungeLeaflet_${i}`, { width: 0.7, height: 0.22, depth: 0.05 }, scene);
    leaflet.position = new Vector3(origin.x - 4.4, 0.35 + i * 0.32, origin.z + 1.72);
    leaflet.material = mat(`loungeLeaflet_${i}`, hex);
  });

  // Sign plaque tilted toward the overhead camera
  const sign = MeshBuilder.CreateBox("loungeSign", { width: 4.0, height: 0.75, depth: 0.06 }, scene);
  sign.rotation.x = Math.PI / 6;
  sign.position = new Vector3(origin.x - 0.8, 3.05, origin.z + 2.5);
  drawSignTexture(scene, sign, 640, 120, (ctx) => {
    ctx.fillStyle = "#1f2d4a";
    ctx.fillRect(0, 0, 640, 120);
    ctx.fillStyle = "#c9a14a";
    ctx.fillRect(0, 0, 640, 5);
    ctx.fillRect(0, 115, 640, 5);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 54px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("MEMBER LOUNGE", 320, 62);
  });

  buildFloorLamp(scene, mat, "loungeFloorLamp", new Vector3(origin.x + 4.3, 0, origin.z + 2.2), "#ffd166");
  buildPendantLamp(scene, mat, "loungePendant", new Vector3(origin.x - 0.8, 3.4, origin.z - 0.1), "#c9a14a");
  buildPlant(scene, mat, new Vector3(origin.x + 4.3, 0, origin.z + 0.9));
}

/**
 * Investment Committee Room: a glass-fronted boardroom with a walnut table,
 * leather chairs and a wall display of the asset-allocation view the
 * Wealth Management Team reviews. Sits on the back-far-left walnut floor.
 */
function buildInvestmentCommittee(
  scene: Scene,
  mat: MaterialFactory,
  origin: Vector3,
): void {
  const glass = mat("icGlass", "#cfe7ff");
  glass.alpha = 0.4;
  const frame = mat("icFrame", "#c9a14a");

  // Glass partition (front + right side, opens to the office)
  const front = MeshBuilder.CreateBox(
    "icFront",
    { width: 9.6, height: 2.6, depth: 0.1 },
    scene,
  );
  front.position = new Vector3(origin.x, 1.3, origin.z - 3.6);
  front.material = glass;
  const rightWall = MeshBuilder.CreateBox(
    "icRight",
    { width: 0.1, height: 2.6, depth: 7.4 },
    scene,
  );
  rightWall.position = new Vector3(origin.x + 4.8, 1.3, origin.z);
  rightWall.material = glass;
  const frontFrame = MeshBuilder.CreateBox(
    "icFrontFrame",
    { width: 9.6, height: 0.12, depth: 0.14 },
    scene,
  );
  frontFrame.position = new Vector3(origin.x, 2.6, origin.z - 3.6);
  frontFrame.material = frame;
  const rightFrame = MeshBuilder.CreateBox(
    "icRightFrame",
    { width: 0.14, height: 0.12, depth: 7.4 },
    scene,
  );
  rightFrame.position = new Vector3(origin.x + 4.8, 2.6, origin.z);
  rightFrame.material = frame;

  // Sign above the front glass
  const sign = MeshBuilder.CreateBox(
    "icSign",
    { width: 5.4, height: 0.6, depth: 0.06 },
    scene,
  );
  sign.position = new Vector3(origin.x, 3.15, origin.z - 3.6);
  drawSignTexture(scene, sign, 864, 96, (ctx) => {
    ctx.fillStyle = "#1f2d4a";
    ctx.fillRect(0, 0, 864, 96);
    ctx.fillStyle = "#c9a14a";
    ctx.fillRect(0, 0, 864, 4);
    ctx.fillRect(0, 92, 864, 4);
    ctx.fillStyle = "#e7c872";
    ctx.font = "bold 50px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("INVESTMENT COMMITTEE", 432, 50);
  });

  // Boardroom table (long axis along z) with brass trim
  const tableTop = MeshBuilder.CreateBox(
    "icTable",
    { width: 1.9, height: 0.14, depth: 5.4 },
    scene,
  );
  tableTop.position = new Vector3(origin.x, 0.85, origin.z + 0.2);
  tableTop.material = mat("icTableMat", "#8a6240");
  const tableInlay = MeshBuilder.CreateBox(
    "icTableInlay",
    { width: 0.12, height: 0.02, depth: 5.0 },
    scene,
  );
  tableInlay.position = new Vector3(origin.x, 0.93, origin.z + 0.2);
  tableInlay.material = mat("icTableInlay", "#c9a14a");
  for (const lz of [-2.0, 2.4]) {
    const leg = MeshBuilder.CreateBox(`icTableLeg_${lz}`, { width: 1.3, height: 0.85, depth: 0.3 }, scene);
    leg.position = new Vector3(origin.x, 0.42, origin.z + lz);
    leg.material = mat("icTableLeg", "#3a2a20");
  }

  // Chairs: four a side plus a chair at the head
  const chairMat = mat("icChair", "#1f2d4a");
  const buildChair = (tag: string, x: number, z: number, backSide: 1 | -1 | 0): void => {
    const seat = MeshBuilder.CreateBox(`icChairSeat_${tag}`, { width: 0.6, height: 0.12, depth: 0.6 }, scene);
    seat.position = new Vector3(x, 0.55, z);
    seat.material = chairMat;
    const back = MeshBuilder.CreateBox(
      `icChairBack_${tag}`,
      backSide === 0 ? { width: 0.6, height: 0.8, depth: 0.12 } : { width: 0.12, height: 0.8, depth: 0.6 },
      scene,
    );
    back.position =
      backSide === 0
        ? new Vector3(x, 0.95, z + 0.3)
        : new Vector3(x + backSide * 0.3, 0.95, z);
    back.material = chairMat;
  };
  [-1.8, -0.6, 0.6, 1.8].forEach((dz, i) => {
    buildChair(`L${i}`, origin.x - 1.4, origin.z + 0.2 + dz, -1);
    buildChair(`R${i}`, origin.x + 1.4, origin.z + 0.2 + dz, 1);
  });
  buildChair("head", origin.x, origin.z - 2.9, 0);

  // Wall display on the left wall: asset allocation donut and portfolio bars
  const display = textPlane(scene, "icDisplay", 5.6, 2.0, 896, 320, (ctx) => {
    ctx.fillStyle = "#16213a";
    ctx.fillRect(0, 0, 896, 320);
    ctx.fillStyle = "#e7c872";
    ctx.font = "bold 36px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("ASSET ALLOCATION — MODEL PORTFOLIOS", 28, 50);
    const slices: Array<[string, number]> = [
      ["#c9a14a", 0.36],
      ["#14b8a6", 0.28],
      ["#6366f1", 0.2],
      ["#b9c4dd", 0.16],
    ];
    let a = -Math.PI / 2;
    for (const [c, f] of slices) {
      ctx.beginPath();
      ctx.moveTo(200, 180);
      ctx.arc(200, 180, 100, a, a + f * Math.PI * 2);
      ctx.closePath();
      ctx.fillStyle = c;
      ctx.fill();
      a += f * Math.PI * 2;
    }
    ctx.beginPath();
    ctx.arc(200, 180, 46, 0, Math.PI * 2);
    ctx.fillStyle = "#16213a";
    ctx.fill();
    for (let i = 0; i < 6; i++) {
      const bh = 50 + i * 22;
      ctx.fillStyle = i % 2 ? "#c9a14a" : "#14b8a6";
      ctx.fillRect(420 + i * 70, 290 - bh, 48, bh);
    }
  });
  display.position = new Vector3(origin.x - 5.72, 2.3, origin.z + 0.2);
  display.rotation.y = -Math.PI / 2;

  buildPendantLamp(scene, mat, "icPendantA", new Vector3(origin.x, 4.2, origin.z - 1.0), "#c9a14a");
  buildPendantLamp(scene, mat, "icPendantB", new Vector3(origin.x, 4.2, origin.z + 1.8), "#c9a14a");
}

/**
 * Closed-case credenza: a low walnut cabinet with brass pulls and a
 * "CLOSED CASES" plaque. Client Communications files each finished case
 * folder on top of it.
 */
function buildCaseCredenza(
  scene: Scene,
  mat: MaterialFactory,
  origin: Vector3,
): void {
  const body = MeshBuilder.CreateBox(
    "credenza",
    { width: 2.8, height: 1.3, depth: 0.8 },
    scene,
  );
  body.position = new Vector3(origin.x, 0.65, origin.z);
  body.material = mat("credenzaMat", "#5a3d2b");
  const top = MeshBuilder.CreateBox(
    "credenzaTop",
    { width: 3.0, height: 0.1, depth: 0.9 },
    scene,
  );
  top.position = new Vector3(origin.x, 1.35, origin.z);
  top.material = mat("credenzaTopMat", "#e8dcc4");
  for (let i = 0; i < 3; i++) {
    const pull = MeshBuilder.CreateBox(
      `credenzaPull_${i}`,
      { width: 0.5, height: 0.06, depth: 0.05 },
      scene,
    );
    pull.position = new Vector3(origin.x - 0.9 + i * 0.9, 0.8, origin.z - 0.42);
    pull.material = mat("credenzaPull", "#c9a14a");
  }
  const plaque = MeshBuilder.CreateBox(
    "credenzaPlaque",
    { width: 1.6, height: 0.3, depth: 0.04 },
    scene,
  );
  plaque.position = new Vector3(origin.x, 0.38, origin.z - 0.43);
  drawSignTexture(scene, plaque, 384, 72, (ctx) => {
    ctx.fillStyle = "#c9a14a";
    ctx.fillRect(0, 0, 384, 72);
    ctx.fillStyle = "#1f2d4a";
    ctx.font = "bold 40px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("CLOSED CASES", 192, 38);
  });
}

// ===== Voxel-pack-inspired prop helpers =====
// These are small, blocky, colourful desktop/decor props built from
// primitives — taking stylistic inspiration from typical voxel furniture
// packs (lamps, mugs, books, cushions, rugs, frames, clocks, pendants).
// All meshes are static and named uniquely.

/** Tiny desk lamp: square base, slim stem, coloured shade. */
function buildDeskLamp(
  scene: Scene,
  mat: MaterialFactory,
  name: string,
  pos: Vector3,
  shadeHex: string,
): void {
  const base = MeshBuilder.CreateBox(
    `${name}_base`,
    { width: 0.28, height: 0.05, depth: 0.28 },
    scene,
  );
  base.position = new Vector3(pos.x, pos.y + 0.025, pos.z);
  base.material = mat(`${name}_baseMat`, "#22252e");
  const stem = MeshBuilder.CreateBox(
    `${name}_stem`,
    { width: 0.06, height: 0.4, depth: 0.06 },
    scene,
  );
  stem.position = new Vector3(pos.x, pos.y + 0.25, pos.z);
  stem.material = mat(`${name}_stemMat`, "#22252e");
  const shade = MeshBuilder.CreateBox(
    `${name}_shade`,
    { width: 0.34, height: 0.22, depth: 0.34 },
    scene,
  );
  shade.position = new Vector3(pos.x, pos.y + 0.55, pos.z);
  shade.material = mat(`${name}_shadeMat`, shadeHex);
  // A small "bulb glow" cube under the shade
  const glow = MeshBuilder.CreateBox(
    `${name}_glow`,
    { width: 0.18, height: 0.04, depth: 0.18 },
    scene,
  );
  glow.position = new Vector3(pos.x, pos.y + 0.42, pos.z);
  glow.material = mat(`${name}_glowMat`, "#fff4c2");
}

/** Coffee mug: short cube body + a thin handle on the side. */
function buildMug(
  scene: Scene,
  mat: MaterialFactory,
  name: string,
  pos: Vector3,
  bodyHex: string,
): void {
  const body = MeshBuilder.CreateBox(
    `${name}_body`,
    { width: 0.2, height: 0.22, depth: 0.2 },
    scene,
  );
  body.position = new Vector3(pos.x, pos.y + 0.11, pos.z);
  body.material = mat(`${name}_bodyMat`, bodyHex);
  const handle = MeshBuilder.CreateBox(
    `${name}_handle`,
    { width: 0.05, height: 0.14, depth: 0.05 },
    scene,
  );
  handle.position = new Vector3(pos.x + 0.13, pos.y + 0.13, pos.z);
  handle.material = mat(`${name}_handleMat`, bodyHex);
  const rim = MeshBuilder.CreateBox(
    `${name}_rim`,
    { width: 0.16, height: 0.02, depth: 0.16 },
    scene,
  );
  rim.position = new Vector3(pos.x, pos.y + 0.22, pos.z);
  rim.material = mat(`${name}_rimMat`, "#ffffff");
}

/** A short stack of three differently coloured books on a desk. */
function buildBookStack(
  scene: Scene,
  mat: MaterialFactory,
  name: string,
  pos: Vector3,
): void {
  const palette = ["#3a5fb0", "#e8504c", "#2e8a6e", "#ffb347", "#b56fbf", "#a06a4c"];
  const seed = name.length;
  for (let i = 0; i < 3; i++) {
    const book = MeshBuilder.CreateBox(
      `${name}_${i}`,
      { width: 0.5 - i * 0.05, height: 0.08, depth: 0.32 },
      scene,
    );
    book.position = new Vector3(pos.x, pos.y + 0.04 + i * 0.085, pos.z);
    book.material = mat(`${name}_${i}_mat`, palette[(seed + i) % palette.length]);
  }
}

/** A row of upright books along a shelf, alternating colours. */
function buildShelfBooks(
  scene: Scene,
  mat: MaterialFactory,
  name: string,
  pos: Vector3,
  width: number,
): void {
  const palette = ["#3a5fb0", "#e8504c", "#2e8a6e", "#ffb347", "#b56fbf", "#a06a4c", "#1a1f2c", "#6ec1ff"];
  const count = Math.max(1, Math.floor(width / 0.18));
  const startX = pos.x - width / 2 + 0.1;
  for (let i = 0; i < count; i++) {
    const w = 0.1 + ((i * 7) % 4) * 0.02;
    const h = 0.32 + ((i * 5) % 3) * 0.05;
    const book = MeshBuilder.CreateBox(
      `${name}_${i}`,
      { width: w, height: h, depth: 0.22 },
      scene,
    );
    book.position = new Vector3(startX + i * 0.18, pos.y + h / 2, pos.z);
    book.material = mat(`${name}_${i}_mat`, palette[(i * 3 + name.length) % palette.length]);
  }
}

/** Plush square cushion — a flat soft-coloured cube. */
function buildCushion(
  scene: Scene,
  mat: MaterialFactory,
  name: string,
  pos: Vector3,
  hex: string,
): void {
  const c = MeshBuilder.CreateBox(
    name,
    { width: 0.5, height: 0.18, depth: 0.5 },
    scene,
  );
  c.position = new Vector3(pos.x, pos.y, pos.z);
  c.material = mat(`${name}_mat`, hex);
}

/** Rectangular rug — a very thin coloured slab with a lighter border. */
function buildRug(
  scene: Scene,
  mat: MaterialFactory,
  name: string,
  pos: Vector3,
  width: number,
  depth: number,
  hex: string,
): void {
  const rug = MeshBuilder.CreateBox(
    name,
    { width, height: 0.04, depth },
    scene,
  );
  rug.position = new Vector3(pos.x, pos.y, pos.z);
  rug.material = mat(`${name}_mat`, hex);
  const border = MeshBuilder.CreateBox(
    `${name}_border`,
    { width: width - 0.3, height: 0.045, depth: depth - 0.3 },
    scene,
  );
  border.position = new Vector3(pos.x, pos.y + 0.005, pos.z);
  border.material = mat(`${name}_borderMat`, "#ffffff");
}

/** Floor lamp: square base, tall thin stem, a tapered shade on top. */
function buildFloorLamp(
  scene: Scene,
  mat: MaterialFactory,
  name: string,
  pos: Vector3,
  shadeHex: string,
): void {
  const base = MeshBuilder.CreateBox(
    `${name}_base`,
    { width: 0.5, height: 0.08, depth: 0.5 },
    scene,
  );
  base.position = new Vector3(pos.x, pos.y + 0.04, pos.z);
  base.material = mat(`${name}_baseMat`, "#22252e");
  const stem = MeshBuilder.CreateBox(
    `${name}_stem`,
    { width: 0.08, height: 1.7, depth: 0.08 },
    scene,
  );
  stem.position = new Vector3(pos.x, pos.y + 0.93, pos.z);
  stem.material = mat(`${name}_stemMat`, "#22252e");
  const shade = MeshBuilder.CreateBox(
    `${name}_shade`,
    { width: 0.6, height: 0.55, depth: 0.6 },
    scene,
  );
  shade.position = new Vector3(pos.x, pos.y + 2.05, pos.z);
  shade.material = mat(`${name}_shadeMat`, shadeHex);
  const shadeRim = MeshBuilder.CreateBox(
    `${name}_shadeRim`,
    { width: 0.66, height: 0.06, depth: 0.66 },
    scene,
  );
  shadeRim.position = new Vector3(pos.x, pos.y + 1.78, pos.z);
  shadeRim.material = mat(`${name}_shadeRimMat`, "#22252e");
}

/** Round-ish wall clock: dark frame, light face, four tick marks and hands. */
function buildWallClock(
  scene: Scene,
  mat: MaterialFactory,
  name: string,
  pos: Vector3,
): void {
  const frame = MeshBuilder.CreateBox(
    `${name}_frame`,
    { width: 0.85, height: 0.85, depth: 0.06 },
    scene,
  );
  frame.position = new Vector3(pos.x, pos.y, pos.z);
  frame.material = mat(`${name}_frameMat`, "#22252e");
  const face = MeshBuilder.CreateBox(
    `${name}_face`,
    { width: 0.7, height: 0.7, depth: 0.04 },
    scene,
  );
  face.position = new Vector3(pos.x, pos.y, pos.z - 0.04);
  drawSignTexture(scene, face, 256, 256, (ctx) => {
    ctx.fillStyle = "#f4ecdb";
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = "#22252e";
    // Tick marks at 12/3/6/9
    ctx.fillRect(120, 24, 16, 22);
    ctx.fillRect(120, 210, 16, 22);
    ctx.fillRect(24, 120, 22, 16);
    ctx.fillRect(210, 120, 22, 16);
    // Hour and minute hands
    ctx.fillRect(124, 70, 8, 60);
    ctx.fillRect(124, 124, 70, 8);
    // Centre dot
    ctx.beginPath();
    ctx.arc(128, 128, 8, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Wall-mounted framed art: dark frame around a coloured "canvas" panel. */
function buildFramedArt(
  scene: Scene,
  mat: MaterialFactory,
  name: string,
  pos: Vector3,
  width: number,
  height: number,
  hex: string,
): void {
  const frame = MeshBuilder.CreateBox(
    `${name}_frame`,
    { width, height, depth: 0.06 },
    scene,
  );
  frame.position = new Vector3(pos.x, pos.y, pos.z);
  frame.material = mat(`${name}_frameMat`, "#22252e");
  const canvas = MeshBuilder.CreateBox(
    `${name}_canvas`,
    { width: width - 0.18, height: height - 0.18, depth: 0.04 },
    scene,
  );
  canvas.position = new Vector3(pos.x, pos.y, pos.z - 0.04);
  drawSignTexture(scene, canvas, 256, 192, (ctx) => {
    // Sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, 192);
    grad.addColorStop(0, hex);
    grad.addColorStop(1, "#f4ecdb");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 192);
    // Pixel-art mountains
    ctx.fillStyle = "#2a3a5c";
    ctx.beginPath();
    ctx.moveTo(0, 150);
    ctx.lineTo(70, 80);
    ctx.lineTo(120, 120);
    ctx.lineTo(180, 60);
    ctx.lineTo(256, 130);
    ctx.lineTo(256, 192);
    ctx.lineTo(0, 192);
    ctx.closePath();
    ctx.fill();
    // Sun
    ctx.fillStyle = "#ffb347";
    ctx.beginPath();
    ctx.arc(196, 50, 18, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Hanging pendant lamp — cord + shade, ~0.8m drop. */
function buildPendantLamp(
  scene: Scene,
  mat: MaterialFactory,
  name: string,
  pos: Vector3,
  shadeHex: string,
): void {
  const cord = MeshBuilder.CreateBox(
    `${name}_cord`,
    { width: 0.04, height: 1.0, depth: 0.04 },
    scene,
  );
  cord.position = new Vector3(pos.x, pos.y + 0.5, pos.z);
  cord.material = mat(`${name}_cordMat`, "#22252e");
  const shade = MeshBuilder.CreateBox(
    `${name}_shade`,
    { width: 0.5, height: 0.35, depth: 0.5 },
    scene,
  );
  shade.position = new Vector3(pos.x, pos.y - 0.18, pos.z);
  shade.material = mat(`${name}_shadeMat`, shadeHex);
  const bulb = MeshBuilder.CreateBox(
    `${name}_bulb`,
    { width: 0.22, height: 0.06, depth: 0.22 },
    scene,
  );
  bulb.position = new Vector3(pos.x, pos.y - 0.4, pos.z);
  bulb.material = mat(`${name}_bulbMat`, "#fff4c2");
}

/** Open laptop on a table: dark base + lighter screen tilted up. */
function buildLaptop(
  scene: Scene,
  mat: MaterialFactory,
  name: string,
  pos: Vector3,
  facingPositiveZ: boolean,
  bodyHex: string,
): void {
  const dir = facingPositiveZ ? 1 : -1;
  const base = MeshBuilder.CreateBox(
    `${name}_base`,
    { width: 0.6, height: 0.04, depth: 0.4 },
    scene,
  );
  base.position = new Vector3(pos.x, pos.y + 0.02, pos.z);
  base.material = mat(`${name}_baseMat`, bodyHex);
  const screen = MeshBuilder.CreateBox(
    `${name}_screen`,
    { width: 0.6, height: 0.36, depth: 0.04 },
    scene,
  );
  screen.position = new Vector3(pos.x, pos.y + 0.2, pos.z + dir * 0.18);
  screen.material = mat(`${name}_screenMat`, "#1a1f2c");
  const screenFace = MeshBuilder.CreateBox(
    `${name}_screenFace`,
    { width: 0.52, height: 0.3, depth: 0.02 },
    scene,
  );
  screenFace.position = new Vector3(pos.x, pos.y + 0.2, pos.z + dir * 0.2);
  screenFace.material = mat(`${name}_screenFaceMat`, "#6ec1ff");
}

/** A small fruit bowl: shallow bowl + a few coloured fruit cubes inside. */
function buildFruitBowl(
  scene: Scene,
  mat: MaterialFactory,
  name: string,
  pos: Vector3,
): void {
  const bowl = MeshBuilder.CreateBox(
    `${name}_bowl`,
    { width: 0.6, height: 0.12, depth: 0.6 },
    scene,
  );
  bowl.position = new Vector3(pos.x, pos.y + 0.06, pos.z);
  bowl.material = mat(`${name}_bowlMat`, "#cdd5e0");
  const fruits = [
    { c: "#e8504c", dx: -0.12, dz: -0.08 },
    { c: "#ffb347", dx: 0.1, dz: -0.05 },
    { c: "#2e8a6e", dx: 0.0, dz: 0.12 },
    { c: "#b56fbf", dx: -0.05, dz: 0.06 },
  ];
  fruits.forEach((f, i) => {
    const fruit = MeshBuilder.CreateBox(
      `${name}_fruit_${i}`,
      { width: 0.16, height: 0.16, depth: 0.16 },
      scene,
    );
    fruit.position = new Vector3(pos.x + f.dx, pos.y + 0.2, pos.z + f.dz);
    fruit.material = mat(`${name}_fruitMat_${i}`, f.c);
  });
}

/** A pair of stacked magazines on a coffee table. */
function buildMagazines(
  scene: Scene,
  mat: MaterialFactory,
  name: string,
  pos: Vector3,
): void {
  const palette = ["#3a5fb0", "#e8504c", "#ffb347"];
  for (let i = 0; i < 2; i++) {
    const m = MeshBuilder.CreateBox(
      `${name}_${i}`,
      { width: 0.55, height: 0.04, depth: 0.36 },
      scene,
    );
    m.position = new Vector3(pos.x + i * 0.05, pos.y + 0.02 + i * 0.045, pos.z + i * 0.04);
    m.material = mat(`${name}_${i}_mat`, palette[i % palette.length]);
  }
}

/**
 * Spawn the wandering lobby staff (greeter, cleaner and courier).
 *
 * Reuses {@link NeighbourhoodAmbient} for the pedestrian animation. The
 * ambient instance ticks itself off `scene.onBeforeRenderObservable`
 * so callers don't have to thread an update callback through the
 * office layout return type.
 */
function buildOfficeAmbient(scene: Scene): void {
  const root = new TransformNode("office_ambient_root", scene);
  const ambient = new NeighbourhoodAmbient(scene, root);

  // ----- Ambient lobby cast -----
  // Three voxel staff wander inside the office to bring the space to life:
  //   • a Reception Greeter loops behind the lobby reception desk,
  //   • a Cleaner walks the central aisle between the front and back row
  //     of cubicles (z ≈ 5, well clear of all partition walls), and
  //   • a Parcel Courier paces the front aisle in front of the cubicles
  //     (z ≈ -5, between the cubicle openings and the lobby furniture).
  //
  // Routes were chosen so the walkers never cross any of:
  //   - outer walls (x = ±30, z = +25, front low walls at z = -15),
  //   - cubicle screen partitions (front row: z ∈ [-2.4, 2.6]; back row:
  //     z ∈ [7.6, 12.6]; side walls at cx ± 2.95 for each cubicle), or
  //   - the team-leader glass partition (z = 7.6, x ∈ [-24.25, -17.75]).
  // Each route stays inside an open corridor between those obstacles.
  const greeter = ambient.addPedestrian(
    "office_reception_greeter",
    "receptionGreeter",
    [
      [-17, -9.0],
      [-13, -9.0],
      [-13, -9.0],
      [-17, -9.0],
    ],
    1.1,
  );
  const cleaner = ambient.addPedestrian(
    "office_cleaner",
    "cleaner",
    [
      // Central aisle between the front-row (z=0) and back-row (z=13) pods.
      // z=6.6 is clear of every partition on either side.
      [-30, 6.6],
      [10, 6.6],
      [10, 6.6],
      [-30, 6.6],
    ],
    1.0,
  );
  const courier = ambient.addPedestrian(
    "office_parcel_courier",
    "parcelCourier",
    [
      // Front aisle between pods (front opening at z=-2.4) and lobby
      // furniture (sofas at z≈-12). z=-5 keeps clear of both.
      [-26, -5.0],
      [10, -5.0],
      [10, -5.0],
      [-26, -5.0],
    ],
    1.3,
  );

  // Visual props in their hands so each role reads at a glance.
  if (cleaner) {
    cleaner.root.scaling.setAll(OFFICE_CHARACTER_SCALE);
    attachMop(scene, cleaner);
  }
  if (courier) {
    courier.root.scaling.setAll(OFFICE_CHARACTER_SCALE);
    attachParcel(scene, courier);
  }
  if (greeter) {
    greeter.root.scaling.setAll(OFFICE_CHARACTER_SCALE);
    attachClipboard(scene, greeter);
  }

  // Tick the ambient movers each frame the office scene renders. We
  // use the engine's wall-clock delta (capped) so cars move at a
  // sensible speed regardless of frame rate. This intentionally is
  // not scaled by the simulation speed slider — the cars are pure
  // ambient scenery, not part of the case simulation.
  scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(0.1, scene.getEngine().getDeltaTime() / 1000);
    ambient.update(dt);
  });
}

/**
 * Attach a tiny voxel mop to the cleaner's right-hand anchor: a long pale
 * pole with a cube of mop "strands" at the bottom. Parented to the held-
 * item anchor so it walks with the cleaner.
 */
function attachMop(scene: Scene, ch: VoxelCharacter): void {
  const anchor = ch.getHandAnchor();
  const tag = ch.id;
  const poleMat = new StandardMaterial(`mopPole_${tag}`, scene);
  poleMat.diffuseColor = Color3.FromHexString("#cdb497");
  poleMat.specularColor = new Color3(0.05, 0.05, 0.05);
  const pole = MeshBuilder.CreateBox(
    `mopPole_${tag}`,
    { width: 0.07, height: 1.4, depth: 0.07 },
    scene,
  );
  pole.parent = anchor;
  pole.position = new Vector3(0.05, 0.7, 0);
  pole.material = poleMat;

  const headMat = new StandardMaterial(`mopHead_${tag}`, scene);
  headMat.diffuseColor = Color3.FromHexString("#f0e6c8");
  headMat.specularColor = new Color3(0.05, 0.05, 0.05);
  const head = MeshBuilder.CreateBox(
    `mopHead_${tag}`,
    { width: 0.45, height: 0.18, depth: 0.25 },
    scene,
  );
  head.parent = anchor;
  head.position = new Vector3(0.05, 0.05, 0);
  head.material = headMat;
}

/** Attach a brown cardboard parcel to the courier's right-hand anchor. */
function attachParcel(scene: Scene, ch: VoxelCharacter): void {
  const anchor = ch.getHandAnchor();
  const tag = ch.id;
  const boxMat = new StandardMaterial(`parcelBox_${tag}`, scene);
  boxMat.diffuseColor = Color3.FromHexString("#b88a64");
  boxMat.specularColor = new Color3(0.05, 0.05, 0.05);
  const box = MeshBuilder.CreateBox(
    `parcelBox_${tag}`,
    { width: 0.55, height: 0.45, depth: 0.5 },
    scene,
  );
  box.parent = anchor;
  box.position = new Vector3(0.0, 0.25, 0.05);
  box.material = boxMat;

  // Cross of packing tape on top.
  const tapeMat = new StandardMaterial(`parcelTape_${tag}`, scene);
  tapeMat.diffuseColor = Color3.FromHexString("#f4ecdb");
  tapeMat.specularColor = new Color3(0.05, 0.05, 0.05);
  const tapeX = MeshBuilder.CreateBox(
    `parcelTapeX_${tag}`,
    { width: 0.6, height: 0.02, depth: 0.08 },
    scene,
  );
  tapeX.parent = anchor;
  tapeX.position = new Vector3(0.0, 0.48, 0.05);
  tapeX.material = tapeMat;
  const tapeZ = MeshBuilder.CreateBox(
    `parcelTapeZ_${tag}`,
    { width: 0.08, height: 0.02, depth: 0.55 },
    scene,
  );
  tapeZ.parent = anchor;
  tapeZ.position = new Vector3(0.0, 0.48, 0.05);
  tapeZ.material = tapeMat;
}

/** Attach a small clipboard to the reception greeter's right-hand anchor. */
function attachClipboard(scene: Scene, ch: VoxelCharacter): void {
  const anchor = ch.getHandAnchor();
  const tag = ch.id;
  const boardMat = new StandardMaterial(`clipBoard_${tag}`, scene);
  boardMat.diffuseColor = Color3.FromHexString("#7a4f2a");
  boardMat.specularColor = new Color3(0.05, 0.05, 0.05);
  const board = MeshBuilder.CreateBox(
    `clipBoard_${tag}`,
    { width: 0.35, height: 0.05, depth: 0.45 },
    scene,
  );
  board.parent = anchor;
  board.position = new Vector3(0.05, 0.2, 0.05);
  board.material = boardMat;

  const paperMat = new StandardMaterial(`clipPaper_${tag}`, scene);
  paperMat.diffuseColor = Color3.FromHexString("#f4ecdb");
  paperMat.specularColor = new Color3(0.05, 0.05, 0.05);
  const paper = MeshBuilder.CreateBox(
    `clipPaper_${tag}`,
    { width: 0.3, height: 0.02, depth: 0.4 },
    scene,
  );
  paper.parent = anchor;
  paper.position = new Vector3(0.05, 0.235, 0.05);
  paper.material = paperMat;
}
