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
import { PALETTES } from "./characterPalettes";
import {
  NeighbourhoodAmbient,
  buildCarMeshes,
  buildVanMeshes,
  buildJeepMeshes,
  makeCalmGlowIncident,
  makeCelebrationIncident,
  makeHardshipCloudIncident,
  makeIdentityAlertIncident,
  makeRetirementIncident,
} from "./neighbourhoodAmbient";
import type { ScenarioId } from "./personaData";
import { VoxelCharacter } from "./voxelCharacter";

/**
 * Build the voxel Melbourne neighbourhood around Caldova Wealth — Client
 * Operations, as described in `docs/theme_neighhood.md`.
 *
 * The neighbourhood is the **starting point** of every request. It contains
 * five life-event zones, one per scripted client scenario:
 *
 *   - Docklands — new job (Priya: new account & super consolidation)
 *   - Airport   — overseas trip (Grace: identity-takeover attempt)
 *   - Oakleigh  — retirement (George: account-based pension)
 *   - Lygon St  — café closed (Tom: financial hardship release)
 *   - Box Hill  — family home (Robert: death benefit)
 *
 * The Caldova Wealth — Client Operations building sits at the centre as the
 * visual anchor. Roads connect every zone to the office door so clients
 * can be seen "heading to the office".
 *
 * The function is intentionally side-effect-only: it adds meshes to the
 * provided `scene`. All pieces are parented to a single root TransformNode
 * (returned) so callers can dispose them as a unit if needed.
 */
/**
 * Anchor points exported alongside the neighbourhood scene so the
 * scenario runner can place the client voxel character at the right
 * life-event zone, focus the camera there, and walk them along the path
 * toward the office front door.
 */
export interface IncidentZones {
  /** Position in front of the office door (where the route ends). */
  officeDoor: Vector3;
  /** Per-scenario life-event anchor (where the client spawns). */
  onboarding: Vector3;
  protection: Vector3;
  retirement: Vector3;
  hardship: Vector3;
  bereavement: Vector3;
}

export interface NeighbourhoodResult {
  root: TransformNode;
  zones: IncidentZones;
  /** Per-frame tick — drives ambient cars/people/pets and active life events. */
  update(dtSec: number): void;
  /** Play the scripted life-event animation for the given scenario. */
  playIncident(id: ScenarioId): void;
  /** Stop any in-flight life-event animation (e.g. on cancel). */
  clearIncident(): void;
}

export function buildNeighbourhood(scene: Scene): NeighbourhoodResult {
  const root = new TransformNode("neighbourhood", scene);

  const matCache = new Map<string, StandardMaterial>();
  const mat = (name: string, hex: string): StandardMaterial => {
    const key = `${name}:${hex}`;
    let m = matCache.get(key);
    if (!m) {
      m = new StandardMaterial(`nh_${name}`, scene);
      m.diffuseColor = Color3.FromHexString(hex);
      m.specularColor = new Color3(0.05, 0.05, 0.05);
      matCache.set(key, m);
    }
    return m;
  };

  const attach = (m: Mesh): Mesh => {
    m.parent = root;
    return m;
  };

  // ----- Ground (grass park) -----
  const grass = MeshBuilder.CreateBox(
    "nh_grass",
    { width: 80, depth: 80, height: 0.4 },
    scene,
  );
  grass.position = new Vector3(0, -0.2, 0);
  grass.material = mat("grass", "#9bcb7a");
  attach(grass);

  // Subtle grass tone patches for variety
  const grassDark = mat("grassDark", "#8abf68");
  for (const [x, z, w, d] of [
    [-22, -22, 14, 10],
    [22, 18, 12, 14],
    [-18, 20, 10, 12],
    [20, -20, 14, 10],
  ] as Array<[number, number, number, number]>) {
    const patch = MeshBuilder.CreateBox(
      `nh_grass_patch_${x}_${z}`,
      { width: w, height: 0.05, depth: d },
      scene,
    );
    patch.position = new Vector3(x, 0.03, z);
    patch.material = grassDark;
    attach(patch);
  }

  // ----- Roads -----
  // The roads form a plus shape around the central office, plus a small
  // ring/roundabout at the central crossroads.
  const roadMat = mat("road", "#4a4d55");
  const roadLine = mat("roadLine", "#f4e8a8");

  const makeRoad = (
    name: string,
    width: number,
    depth: number,
    pos: Vector3,
  ): void => {
    const road = MeshBuilder.CreateBox(
      name,
      { width, height: 0.06, depth },
      scene,
    );
    road.position = pos;
    road.material = roadMat;
    attach(road);
  };

  // Horizontal main road (east-west) running across the town
  makeRoad("nh_road_h", 80, 5, new Vector3(0, 0.05, 0));
  // Vertical road (north-south)
  makeRoad("nh_road_v", 5, 80, new Vector3(0, 0.05, 0));

  // Dashed center lines along the horizontal road. We skip dashes that
  // would land inside the central roundabout or on the asphalt of any
  // crossing side street so dashes don't visually float on top of the
  // side-road tarmac.
  for (let x = -38; x <= 38; x += 4) {
    if (Math.abs(x) < 4) continue; // skip intersection
    if (x > -28 && x < -24) continue; // Flinders Lane crossing
    if (x > 31 && x < 35) continue; // Toorak Rd crossing
    const dash = MeshBuilder.CreateBox(
      `nh_dash_h_${x}`,
      { width: 1.6, height: 0.02, depth: 0.18 },
      scene,
    );
    dash.position = new Vector3(x, 0.09, 0);
    dash.material = roadLine;
    attach(dash);
  }
  for (let z = -38; z <= 38; z += 4) {
    if (Math.abs(z) < 4) continue;
    if (z > -12 && z < -8) continue; // Collins St crossing
    if (z > 18 && z < 22) continue; // Glenferrie Rd crossing
    const dash = MeshBuilder.CreateBox(
      `nh_dash_v_${z}`,
      { width: 0.18, height: 0.02, depth: 1.6 },
      scene,
    );
    dash.position = new Vector3(0, 0.09, z);
    dash.material = roadLine;
    attach(dash);
  }

  // Roundabout at the centre crossroads — circular island with grass
  const roundabout = MeshBuilder.CreateCylinder(
    "nh_roundabout",
    { diameter: 6, height: 0.18 },
    scene,
  );
  roundabout.position = new Vector3(0, 0.1, 0);
  roundabout.material = mat("roundaboutTrim", "#9a968a");
  attach(roundabout);

  const roundaboutGrass = MeshBuilder.CreateCylinder(
    "nh_roundabout_grass",
    { diameter: 4, height: 0.22 },
    scene,
  );
  roundaboutGrass.position = new Vector3(0, 0.12, 0);
  roundaboutGrass.material = mat("grass", "#9bcb7a");
  attach(roundaboutGrass);

  // ----- Reusable builders -----

  const makeBox = (
    name: string,
    w: number,
    h: number,
    d: number,
    pos: Vector3,
    color: string,
  ): Mesh => {
    const m = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
    m.position = pos;
    m.material = mat(name, color);
    attach(m);
    return m;
  };

  /**
   * Build a properly-modelled static voxel vehicle (sedan, jeep or van)
   * with cabin, windscreen and wheels — reusing the same mesh recipes as
   * the ambient traffic so parked cars (Docklands kerbside, the family
   * car in Box Hill, the apartment resident's sedan) read as real
   * vehicles instead of plain coloured boxes.
   *
   * The ambient builders model the car along local +Z. `rotY` rotates the
   * parent so the long axis can be aligned along X (rotY = π/2) for cars
   * parked along an east-west road.
   */
  const makeStaticVehicle = (
    name: string,
    kind: "car" | "jeep" | "van",
    pos: Vector3,
    rotY: number,
    bodyHex: string,
    topHex: string,
  ): TransformNode => {
    const node = new TransformNode(name, scene);
    node.parent = root;
    node.position = pos.clone();
    node.rotation.y = rotY;
    if (kind === "jeep") {
      buildJeepMeshes(scene, node, bodyHex, topHex);
    } else if (kind === "van") {
      buildVanMeshes(scene, node, bodyHex, topHex);
    } else {
      buildCarMeshes(scene, node, bodyHex, topHex);
    }
    return node;
  };

  // (Legacy `makeRoof` removed — all roofs now use `makeGableRoof` /
  // `makeSuburbanHouse`, which produce a chunky stepped pitched roof
  // instead of a 45°-rotated diamond box that read as "fake".)

  // A proper stepped voxel gable roof — chunkier and more "real suburb"
  // looking than a 45°-rotated diamond box. The ridge runs along the Z
  // (front-to-back) axis, narrowing in X each step. Used for standalone
  // roofs (the named houses); makeSuburbanHouse inlines the same recipe.
  const makeGableRoof = (
    name: string,
    w: number,
    d: number,
    cx: number,
    cz: number,
    baseY: number,
    color: string,
    eaveColor = "#c8b896",
  ): void => {
    const steps = 4;
    const stepH = 0.32;
    const eaveOverhang = 0.4;
    const roofMat = mat(`${name}_roof`, color);
    const eaveMat = mat(`${name}_eave`, eaveColor);
    const eave = MeshBuilder.CreateBox(
      `${name}_eaveSlab`,
      { width: w + eaveOverhang, height: 0.15, depth: d + eaveOverhang },
      scene,
    );
    eave.position = new Vector3(cx, baseY + 0.075, cz);
    eave.material = eaveMat;
    attach(eave);
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const layerW = w * (1 - t * 0.78);
      const layerD = d + eaveOverhang * (1 - t);
      const layer = MeshBuilder.CreateBox(
        `${name}_layer_${i}`,
        { width: layerW, height: stepH, depth: layerD },
        scene,
      );
      layer.position = new Vector3(cx, baseY + 0.15 + stepH * (i + 0.5), cz);
      layer.material = roofMat;
      attach(layer);
    }
    const ridge = MeshBuilder.CreateBox(
      `${name}_ridge`,
      { width: 0.4, height: 0.18, depth: d + eaveOverhang * 0.3 },
      scene,
    );
    ridge.position = new Vector3(cx, baseY + 0.15 + stepH * steps + 0.09, cz);
    ridge.material = mat(`${name}_ridgeMat`, "#3a2a20");
    attach(ridge);
  };

  // Voxel chimney — a small brick stack on top of a roof.
  const makeChimney = (
    cx: number,
    cz: number,
    baseY: number,
    color = "#a23a2c",
  ): void => {
    const stack = MeshBuilder.CreateBox(
      `nh_chim_${cx}_${cz}`,
      { width: 0.55, height: 1.4, depth: 0.55 },
      scene,
    );
    stack.position = new Vector3(cx, baseY + 0.7, cz);
    stack.material = mat(`chim_${color}`, color);
    attach(stack);
    const cap = MeshBuilder.CreateBox(
      `nh_chim_cap_${cx}_${cz}`,
      { width: 0.7, height: 0.12, depth: 0.7 },
      scene,
    );
    cap.position = new Vector3(cx, baseY + 1.46, cz);
    cap.material = mat("chim_cap", "#3a3a3a");
    attach(cap);
  };

  // A windowpane with mullions — a small flat panel of glass divided by
  // thin frame strips. Faces along -Z by default; rotate the host as needed.
  const makeMullionedWindow = (
    name: string,
    cx: number,
    cy: number,
    cz: number,
    w: number,
    h: number,
    facing: "south" | "north" | "east" | "west" = "south",
  ): void => {
    const depthOffset = 0.06;
    const sign = facing === "south" || facing === "east" ? -1 : 1;
    const isXFace = facing === "south" || facing === "north";
    const pane = MeshBuilder.CreateBox(
      `${name}_pane`,
      isXFace
        ? { width: w, height: h, depth: 0.05 }
        : { width: 0.05, height: h, depth: w },
      scene,
    );
    pane.position = new Vector3(
      cx + (isXFace ? 0 : sign * depthOffset),
      cy,
      cz + (isXFace ? sign * depthOffset : 0),
    );
    pane.material = mat("nh_glass", "#cfe7ff");
    attach(pane);

    const frameMat = mat("nh_winFrame", "#f4f0e6");
    // Outer frame (top, bottom, left, right).
    const frameThickness = 0.08;
    const frames: Array<[number, number, number, number]> = [
      // [w, h, dx, dy]
      [w + 0.16, frameThickness, 0, h / 2 + frameThickness / 2],
      [w + 0.16, frameThickness, 0, -h / 2 - frameThickness / 2],
      [frameThickness, h + 0.16, -w / 2 - frameThickness / 2, 0],
      [frameThickness, h + 0.16, w / 2 + frameThickness / 2, 0],
      // mullions: vertical & horizontal cross
      [frameThickness * 0.7, h, 0, 0],
      [w, frameThickness * 0.7, 0, 0],
    ];
    for (let i = 0; i < frames.length; i++) {
      const [fw, fh, dx, dy] = frames[i];
      const f = MeshBuilder.CreateBox(
        `${name}_f_${i}`,
        isXFace
          ? { width: fw, height: fh, depth: 0.07 }
          : { width: 0.07, height: fh, depth: fw },
        scene,
      );
      f.position = new Vector3(
        cx + (isXFace ? dx : sign * (depthOffset + 0.005)),
        cy + dy,
        cz + (isXFace ? sign * (depthOffset + 0.005) : dx),
      );
      f.material = frameMat;
      attach(f);
    }
  };

  // A short run of picket fence in front of a house, between (x1, z) and
  // (x2, z) along the X axis, with optional rotation.
  const makePicketFence = (
    x1: number,
    x2: number,
    z: number,
    rotY = 0,
    color = "#f4f0e6",
  ): void => {
    const length = Math.abs(x2 - x1);
    const cx = (x1 + x2) / 2;
    // Rail
    const rail = MeshBuilder.CreateBox(
      `nh_fence_rail_${cx}_${z}`,
      { width: length, height: 0.08, depth: 0.06 },
      scene,
    );
    rail.position = new Vector3(cx, 0.55, z);
    rail.rotation.y = rotY;
    rail.material = mat("fenceRail", color);
    attach(rail);
    // Pickets
    const pickets = Math.max(2, Math.floor(length / 0.45));
    for (let i = 0; i < pickets; i++) {
      const t = pickets === 1 ? 0.5 : i / (pickets - 1);
      const px = x1 + (x2 - x1) * t;
      const cosR = Math.cos(rotY);
      const sinR = Math.sin(rotY);
      const wx = cx + (px - cx) * cosR;
      const wz = z + (px - cx) * sinR;
      const picket = MeshBuilder.CreateBox(
        `nh_fence_p_${cx}_${z}_${i}`,
        { width: 0.12, height: 0.7, depth: 0.08 },
        scene,
      );
      picket.position = new Vector3(wx, 0.45, wz);
      picket.rotation.y = rotY;
      picket.material = mat("fencePicket", color);
      attach(picket);
    }
  };

  // A flagstone front path leading from a sidewalk point to a doorstep.
  const makeFrontPath = (
    name: string,
    fromX: number,
    fromZ: number,
    toX: number,
    toZ: number,
  ): void => {
    const dx = toX - fromX;
    const dz = toZ - fromZ;
    const dist = Math.hypot(dx, dz);
    const tiles = Math.max(2, Math.floor(dist / 0.7));
    const stoneMat = mat("path_stone", "#d8c9a2");
    for (let i = 0; i < tiles; i++) {
      const t = (i + 0.5) / tiles;
      const px = fromX + dx * t;
      const pz = fromZ + dz * t;
      const tile = MeshBuilder.CreateBox(
        `${name}_${i}`,
        { width: 0.55, height: 0.06, depth: 0.55 },
        scene,
      );
      tile.position = new Vector3(px, 0.085, pz);
      tile.material = stoneMat;
      attach(tile);
    }
  };

  // A simple voxel mailbox by the kerb.
  const makeMailbox = (x: number, z: number): void => {
    makeBox(`nh_mb_post_${x}_${z}`, 0.1, 0.9, 0.1, new Vector3(x, 0.45, z), "#5a3a22");
    makeBox(`nh_mb_box_${x}_${z}`, 0.45, 0.3, 0.6, new Vector3(x, 1.0, z), "#3a5fb0");
    makeBox(`nh_mb_flag_${x}_${z}`, 0.05, 0.18, 0.05, new Vector3(x + 0.25, 1.1, z), "#c44a3a");
  };

  // A pale concrete kerb / sidewalk strip alongside a road. Useful to
  // visually separate the asphalt from the verge.
  const makeKerb = (
    name: string,
    width: number,
    depth: number,
    pos: Vector3,
  ): void => {
    const k = MeshBuilder.CreateBox(
      name,
      { width, height: 0.12, depth },
      scene,
    );
    k.position = pos;
    k.material = mat("kerb", "#9a968a");
    attach(k);
  };

  // A zebra-stripe pedestrian crossing across a road.
  const makeCrosswalk = (
    name: string,
    cx: number,
    cz: number,
    orient: "ew" | "ns",
    span = 4.6,
  ): void => {
    const stripeMat = mat("crosswalkStripe", "#f4f0e6");
    const stripeCount = 5;
    for (let i = 0; i < stripeCount; i++) {
      const t = (i - (stripeCount - 1) / 2) / stripeCount;
      const offset = t * 1.6;
      const stripe = MeshBuilder.CreateBox(
        `${name}_s_${i}`,
        orient === "ew"
          ? { width: 0.4, height: 0.03, depth: span }
          : { width: span, height: 0.03, depth: 0.4 },
        scene,
      );
      stripe.position =
        orient === "ew"
          ? new Vector3(cx + offset, 0.095, cz)
          : new Vector3(cx, 0.095, cz + offset);
      stripe.material = stripeMat;
      attach(stripe);
    }
  };

  // Shrink a bold font until `text` fits within `maxWidth` texture pixels.
  const fitFont = (
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    startPx: number,
    minPx = 24,
  ): void => {
    let px = startPx;
    ctx.font = `bold ${px}px sans-serif`;
    while (ctx.measureText(text).width > maxWidth && px > minPx) {
      px -= 2;
      ctx.font = `bold ${px}px sans-serif`;
    }
  };

  // A small street-name sign at the corner of an intersection.
  const makeStreetSign = (
    x: number,
    z: number,
    text: string,
    color = "#3a5fb0",
  ): void => {
    const pole = MeshBuilder.CreateBox(
      `nh_st_pole_${x}_${z}`,
      { width: 0.12, height: 2.4, depth: 0.12 },
      scene,
    );
    pole.position = new Vector3(x, 1.2, z);
    pole.material = mat("streetSignPole", "#5a5d65");
    attach(pole);
    const blade = MeshBuilder.CreateBox(
      `nh_st_blade_${x}_${z}`,
      { width: 2.2, height: 0.45, depth: 0.08 },
      scene,
    );
    blade.position = new Vector3(x, 2.3, z);
    attach(blade);
    const tex = new DynamicTexture(
      `nh_st_tex_${x}_${z}`,
      { width: 512, height: 96 },
      scene,
      false,
    );
    const c = tex.getContext() as CanvasRenderingContext2D;
    c.fillStyle = color;
    c.fillRect(0, 0, 512, 96);
    c.fillStyle = "#ffffff";
    fitFont(c, text, 470, 48);
    c.textBaseline = "middle";
    c.textAlign = "center";
    c.fillText(text, 256, 50);
    tex.update();
    const m = new StandardMaterial(`nh_st_mat_${x}_${z}`, scene);
    m.diffuseTexture = tex;
    m.emissiveColor = new Color3(0.5, 0.5, 0.5);
    m.specularColor = new Color3(0, 0, 0);
    blade.material = m;
  };

  // Build a richer voxel suburban house. The footprint sits centered on
  // (cx, cz). The front of the house faces -Z (south), so the door, path,
  // and mailbox all appear on that side.
  type SuburbanHouseOpts = {
    width?: number;
    depth?: number;
    storeys?: 1 | 2;
    wall: string;
    roof: string;
    trim?: string;
    door?: string;
    chimney?: boolean;
    fence?: boolean;
    fenceColor?: string;
    mailbox?: boolean;
    /** Sidewalk Z line — the front path runs from the door out to here. */
    sidewalkZ?: number;
  };
  const makeSuburbanHouse = (
    name: string,
    cx: number,
    cz: number,
    opts: SuburbanHouseOpts,
  ): void => {
    const width = opts.width ?? 5.2;
    const depth = opts.depth ?? 4.0;
    const storeys = opts.storeys ?? 1;
    const wallH = storeys === 2 ? 4.4 : 2.6;
    const trim = opts.trim ?? "#f4f0e6";
    const door = opts.door ?? "#5a3a22";

    // Foundation slab (a touch wider than the walls).
    makeBox(
      `${name}_found`,
      width + 0.4,
      0.4,
      depth + 0.4,
      new Vector3(cx, 0.2, cz),
      "#9a8f7a",
    );

    // Walls.
    makeBox(
      `${name}_walls`,
      width,
      wallH,
      depth,
      new Vector3(cx, 0.4 + wallH / 2, cz),
      opts.wall,
    );

    // Trim band beneath the eaves.
    makeBox(
      `${name}_trim`,
      width + 0.2,
      0.18,
      depth + 0.2,
      new Vector3(cx, 0.4 + wallH - 0.09, cz),
      trim,
    );

    // Roof (real gable, not a diamond) — inlined to avoid relying on
    // a separate root node for the named house.
    const steps = 4;
    const stepH = 0.32;
    const roofMat = mat(`${name}_roofMat`, opts.roof);
    const eaveMat = mat(`${name}_eaveMat`, trim);
    const roofBaseY = 0.4 + wallH;
    // Eave slab.
    {
      const eave = MeshBuilder.CreateBox(
        `${name}_eave`,
        { width: width + 0.6, height: 0.15, depth: depth + 0.6 },
        scene,
      );
      eave.position = new Vector3(cx, roofBaseY + 0.075, cz);
      eave.material = eaveMat;
      attach(eave);
    }
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const layerW = width * (1 - t * 0.8);
      const layerD = depth + 0.4 * (1 - t);
      const layer = MeshBuilder.CreateBox(
        `${name}_rl_${i}`,
        { width: layerW, height: stepH, depth: layerD },
        scene,
      );
      layer.position = new Vector3(cx, roofBaseY + 0.15 + stepH * (i + 0.5), cz);
      layer.material = roofMat;
      attach(layer);
    }
    // Ridge cap.
    const ridge = MeshBuilder.CreateBox(
      `${name}_ridge`,
      { width: 0.36, height: 0.16, depth: depth + 0.2 },
      scene,
    );
    ridge.position = new Vector3(
      cx,
      roofBaseY + 0.15 + stepH * steps + 0.08,
      cz,
    );
    ridge.material = mat(`${name}_ridgeMat`, "#3a2a20");
    attach(ridge);

    // Door + step.
    makeBox(
      `${name}_door`,
      0.95,
      1.7,
      0.16,
      new Vector3(cx, 0.4 + 0.85, cz - depth / 2 - 0.05),
      door,
    );
    makeBox(
      `${name}_doorstep`,
      1.4,
      0.16,
      0.5,
      new Vector3(cx, 0.5, cz - depth / 2 - 0.3),
      "#cfc8b4",
    );

    // Mullioned windows on the front face (one each side of the door, and
    // a row on the upper storey for two-storey houses).
    makeMullionedWindow(
      `${name}_winL`,
      cx - width * 0.3,
      0.4 + wallH * 0.55,
      cz - depth / 2,
      1.0,
      0.85,
      "south",
    );
    makeMullionedWindow(
      `${name}_winR`,
      cx + width * 0.3,
      0.4 + wallH * 0.55,
      cz - depth / 2,
      1.0,
      0.85,
      "south",
    );
    if (storeys === 2) {
      makeMullionedWindow(
        `${name}_winUL`,
        cx - width * 0.3,
        0.4 + wallH * 0.85,
        cz - depth / 2,
        0.9,
        0.7,
        "south",
      );
      makeMullionedWindow(
        `${name}_winUR`,
        cx + width * 0.3,
        0.4 + wallH * 0.85,
        cz - depth / 2,
        0.9,
        0.7,
        "south",
      );
      makeMullionedWindow(
        `${name}_winUC`,
        cx,
        0.4 + wallH * 0.85,
        cz - depth / 2,
        0.9,
        0.7,
        "south",
      );
    }
    // Side windows.
    makeMullionedWindow(
      `${name}_winSideE`,
      cx + width / 2,
      0.4 + wallH * 0.55,
      cz,
      0.85,
      0.85,
      "east",
    );
    makeMullionedWindow(
      `${name}_winSideW`,
      cx - width / 2,
      0.4 + wallH * 0.55,
      cz,
      0.85,
      0.85,
      "west",
    );

    // Chimney (offset toward the back-right of the roof).
    if (opts.chimney) {
      makeChimney(
        cx + width * 0.28,
        cz + depth * 0.15,
        roofBaseY + 0.4,
      );
    }

    // Front path from door out to the kerb / sidewalk.
    if (opts.sidewalkZ !== undefined) {
      makeFrontPath(
        `${name}_path`,
        cx,
        cz - depth / 2 - 0.3,
        cx,
        opts.sidewalkZ,
      );
      if (opts.mailbox) {
        makeMailbox(cx + 1.2, opts.sidewalkZ + 0.3);
      }
    }

    // Picket fence along the front of the lot.
    if (opts.fence) {
      const fz = (opts.sidewalkZ ?? cz - depth / 2 - 1.5) + 0.5;
      makePicketFence(
        cx - width / 2 - 0.6,
        cx - 0.9,
        fz,
        0,
        opts.fenceColor,
      );
      makePicketFence(
        cx + 0.9,
        cx + width / 2 + 0.6,
        fz,
        0,
        opts.fenceColor,
      );
    }
  };

  // Small voxel tree
  const makeTree = (x: number, z: number, scale = 1): void => {
    makeBox(
      `nh_tree_trunk_${x}_${z}`,
      0.4 * scale,
      1.2 * scale,
      0.4 * scale,
      new Vector3(x, 0.6 * scale, z),
      "#7a4f2a",
    );
    makeBox(
      `nh_tree_leaves_${x}_${z}`,
      1.4 * scale,
      1.4 * scale,
      1.4 * scale,
      new Vector3(x, 1.7 * scale, z),
      "#5fa657",
    );
  };

  // Small voxel person — used so the streets feel alive. We don't animate
  // them; the office scene has the live agent simulation. Here they're
  // built with the **same** `VoxelCharacter` class the office uses, so a
  // client in the neighbourhood looks identical to the same persona
  // when they arrive at the office reception. `paletteKey` selects one
  // of the entries in `PALETTES` (e.g. "customerRetirement", "onboardingOfficer").
  const makePerson = (
    x: number,
    z: number,
    paletteKey: keyof typeof PALETTES = "cityCommuter",
    faceTowards?: { x: number; z: number },
  ): void => {
    const palette = PALETTES[paletteKey];
    const id = `${paletteKey}_${x.toFixed(1)}_${z.toFixed(1)}`;
    const c = new VoxelCharacter(scene, `nh_${id}`, palette);
    c.root.parent = root;
    c.root.position = new Vector3(x, 0, z);
    if (faceTowards) {
      c.root.rotation.y = Math.atan2(faceTowards.x - x, faceTowards.z - z);
    }
  };

  // Life-event marker — a floating glyph bubble above each zone. Only the
  // identity-takeover alert carries a "!" — the other life events are
  // milestones, not alarms.
  const makeIncidentMarker = (
    x: number,
    y: number,
    z: number,
    icon: "briefcase" | "shield" | "party" | "handshake" | "heart",
  ): void => {
    const bubble = MeshBuilder.CreateBox(
      `nh_marker_${x}_${z}`,
      { width: 0.9, height: 0.9, depth: 0.18 },
      scene,
    );
    bubble.position = new Vector3(x, y, z);
    attach(bubble);

    const tex = new DynamicTexture(
      `nh_marker_tex_${x}_${z}`,
      { width: 128, height: 128 },
      scene,
      false,
    );
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    ctx.fillStyle = "#fff5d6";
    ctx.fillRect(0, 0, 128, 128);

    const symbols: Record<typeof icon, { color: string; glyph: string; alert?: boolean }> = {
      briefcase: { color: "#3a8fd6", glyph: "💼" },
      shield: { color: "#d9534f", glyph: "🛡️", alert: true },
      party: { color: "#e8a33d", glyph: "🎉" },
      handshake: { color: "#e07a2c", glyph: "🤝" },
      heart: { color: "#c2566f", glyph: "♥" },
    };
    const sym = symbols[icon];
    ctx.fillStyle = sym.color;
    ctx.font = "bold 96px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(sym.glyph, 64, sym.alert ? 70 : 66);
    if (sym.alert) {
      // exclamation mark above
      ctx.fillStyle = "#1c2230";
      ctx.font = "bold 38px sans-serif";
      ctx.fillText("!", 64, 22);
    }
    tex.update();

    const faceMat = new StandardMaterial(`nh_marker_face_${x}_${z}`, scene);
    faceMat.diffuseTexture = tex;
    faceMat.emissiveColor = new Color3(0.6, 0.6, 0.6);
    faceMat.specularColor = new Color3(0, 0, 0);
    bubble.material = faceMat;
  };

  // A small map-pin label that sits above a zone.
  const makeLabel = (
    x: number,
    z: number,
    text: string,
    color = "#1c2230",
  ): void => {
    // Measure text first so the sign and texture are sized to fit the
    // label exactly — no fixed-width signs that look stretched on short
    // labels or clipped on long ones.
    const fontSize = 60;
    const padLeft = 44;
    const padRight = 28;
    const texHeight = 168;
    const measureCanvas = document.createElement("canvas");
    const measureCtx = measureCanvas.getContext("2d");
    let textWidth = 400;
    if (measureCtx) {
      measureCtx.font = `bold ${fontSize}px sans-serif`;
      textWidth = Math.ceil(measureCtx.measureText(text).width);
    }
    const texWidth = padLeft + textWidth + padRight;
    // World units per texture pixel — keeps every sign at the same
    // physical text height, just with variable width.
    const unitsPerPixel = 1.5 / texHeight;
    const signWidth = texWidth * unitsPerPixel;
    const signHeight = 1.5;

    const sign = MeshBuilder.CreateBox(
      `nh_label_${x}_${z}`,
      { width: signWidth, height: signHeight, depth: 0.18 },
      scene,
    );
    sign.position = new Vector3(x, 5.6, z);
    // Rotate around Y so the sign faces the camera, then tilt the top
    // forward a little so the face angles up toward the bird's-eye view.
    sign.rotation.y = -Math.PI / 6;
    sign.rotation.x = Math.PI / 9;
    attach(sign);

    const tex = new DynamicTexture(
      `nh_label_tex_${x}_${z}`,
      { width: texWidth, height: texHeight },
      scene,
      false,
    );
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    ctx.fillStyle = "#fff8e6";
    ctx.fillRect(0, 0, texWidth, texHeight);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 18, texHeight);
    ctx.fillStyle = "#1c2230";
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textBaseline = "middle";
    ctx.fillText(text, padLeft, texHeight / 2);
    tex.update();

    const m = new StandardMaterial(`nh_label_mat_${x}_${z}`, scene);
    m.diffuseTexture = tex;
    m.emissiveColor = new Color3(0.55, 0.55, 0.55);
    m.specularColor = new Color3(0, 0, 0);
    sign.material = m;

    // Tiny pole under the sign
    const pole = MeshBuilder.CreateBox(
      `nh_label_pole_${x}_${z}`,
      { width: 0.18, height: 5.0, depth: 0.18 },
      scene,
    );
    pole.position = new Vector3(x, 2.5, z);
    pole.material = mat("labelPole", "#7a7a7a");
    attach(pole);
  };

  // ----- Construction-pack-style prop builders -----
  // These are original procedural voxel meshes inspired by the look of
  // generic MagicaVoxel construction packs (striped barriers, traffic
  // cones, timber/brick stacks, cement mixer, tipper truck). They dress the
  // builder's yard and the roadworks on the east side of town.

  // Striped traffic barrier (white body with red ends).
  const makeBarrier = (x: number, z: number, rotY = 0): void => {
    const body = MeshBuilder.CreateBox(
      `nh_barrier_body_${x}_${z}`,
      { width: 2.4, height: 0.5, depth: 0.2 },
      scene,
    );
    body.position = new Vector3(x, 0.55, z);
    body.rotation.y = rotY;
    body.material = mat("barrierBody", "#f4f0e6");
    attach(body);
    for (const dx of [-1.0, 1.0]) {
      const cap = MeshBuilder.CreateBox(
        `nh_barrier_cap_${x}_${z}_${dx}`,
        { width: 0.4, height: 0.5, depth: 0.22 },
        scene,
      );
      const cz = Math.sin(rotY) * dx;
      const cx = Math.cos(rotY) * dx;
      cap.position = new Vector3(x + cx, 0.55, z + cz);
      cap.rotation.y = rotY;
      cap.material = mat("barrierCap", "#c44a3a");
      attach(cap);
    }
    // Trestle legs
    for (const dx of [-0.9, 0.9]) {
      const leg = MeshBuilder.CreateBox(
        `nh_barrier_leg_${x}_${z}_${dx}`,
        { width: 0.12, height: 0.6, depth: 0.5 },
        scene,
      );
      const cz = Math.sin(rotY) * dx;
      const cx = Math.cos(rotY) * dx;
      leg.position = new Vector3(x + cx, 0.3, z + cz);
      leg.rotation.y = rotY;
      leg.material = mat("barrierLeg", "#3a3a3a");
      attach(leg);
    }
  };

  // Small traffic cone — orange with a white reflective stripe.
  const makeCone = (x: number, z: number): void => {
    const base = MeshBuilder.CreateBox(
      `nh_cone_base_${x}_${z}`,
      { width: 0.4, height: 0.08, depth: 0.4 },
      scene,
    );
    base.position = new Vector3(x, 0.04, z);
    base.material = mat("coneBase", "#3a3a3a");
    attach(base);
    const body = MeshBuilder.CreateBox(
      `nh_cone_body_${x}_${z}`,
      { width: 0.28, height: 0.45, depth: 0.28 },
      scene,
    );
    body.position = new Vector3(x, 0.32, z);
    body.material = mat("coneBody", "#e07a2c");
    attach(body);
    const stripe = MeshBuilder.CreateBox(
      `nh_cone_stripe_${x}_${z}`,
      { width: 0.3, height: 0.08, depth: 0.3 },
      scene,
    );
    stripe.position = new Vector3(x, 0.36, z);
    stripe.material = mat("coneStripe", "#fff5d6");
    attach(stripe);
  };

  // Stack of timber planks.
  const makeTimberStack = (x: number, z: number): void => {
    for (let i = 0; i < 4; i++) {
      const plank = MeshBuilder.CreateBox(
        `nh_timber_${x}_${z}_${i}`,
        { width: 2.4, height: 0.18, depth: 0.6 },
        scene,
      );
      plank.position = new Vector3(x, 0.12 + i * 0.2, z);
      plank.material = mat(
        i % 2 === 0 ? "timberA" : "timberB",
        i % 2 === 0 ? "#c98a4a" : "#a86a3a",
      );
      attach(plank);
    }
  };

  // Pile of bricks.
  const makeBrickPile = (x: number, z: number): void => {
    for (let row = 0; row < 3; row++) {
      const offset = row * 0.05;
      for (let col = -1; col <= 1; col++) {
        const b = MeshBuilder.CreateBox(
          `nh_brick_${x}_${z}_${row}_${col}`,
          { width: 0.55, height: 0.22, depth: 0.32 },
          scene,
        );
        b.position = new Vector3(x + col * 0.6 + offset, 0.13 + row * 0.24, z);
        b.material = mat("brick", row === 1 ? "#a23a2c" : "#b04a3a");
        attach(b);
      }
    }
  };

  // Cement mixer — drum on a small wheeled chassis.
  const makeCementMixer = (x: number, z: number): void => {
    // Frame
    makeBox(`nh_mixer_frame_${x}_${z}`, 1.2, 0.25, 0.7, new Vector3(x, 0.15, z), "#e07a2c");
    // Drum (rotated box for a chunky barrel look)
    const drum = MeshBuilder.CreateBox(
      `nh_mixer_drum_${x}_${z}`,
      { width: 1.0, height: 0.9, depth: 0.9 },
      scene,
    );
    drum.position = new Vector3(x, 0.85, z);
    drum.rotation.z = Math.PI / 8;
    drum.material = mat("mixerDrum", "#ffd166");
    attach(drum);
    // Wheels
    for (const dx of [-0.45, 0.45]) {
      const w = MeshBuilder.CreateBox(
        `nh_mixer_wheel_${x}_${z}_${dx}`,
        { width: 0.18, height: 0.3, depth: 0.3 },
        scene,
      );
      w.position = new Vector3(x + dx, 0.15, z + 0.3);
      w.material = mat("mixerWheel", "#1c2230");
      attach(w);
    }
    // Handle / spout
    makeBox(`nh_mixer_handle_${x}_${z}`, 0.1, 0.7, 0.1, new Vector3(x - 0.6, 0.6, z), "#3a3a3a");
  };

  // Builder's tipper truck — cab + open tipping bin with a load of gravel.
  const makeBuilderTruck = (x: number, z: number): void => {
    makeBox(`nh_btruck_chassis_${x}_${z}`, 3.4, 0.3, 1.4, new Vector3(x, 0.35, z), "#1c2230");
    makeBox(`nh_btruck_cab_${x}_${z}`, 1.2, 1.0, 1.3, new Vector3(x - 1.0, 1.0, z), "#3a8fd6");
    makeBox(`nh_btruck_cabwin_${x}_${z}`, 1.0, 0.45, 1.32, new Vector3(x - 1.0, 1.2, z), "#cfe7ff");
    makeBox(`nh_btruck_bin_${x}_${z}`, 2.0, 0.9, 1.3, new Vector3(x + 0.6, 0.95, z), "#c44a3a");
    // Gravel mound on top
    makeBox(`nh_btruck_load_${x}_${z}`, 1.7, 0.3, 1.1, new Vector3(x + 0.6, 1.55, z), "#9aa0a8");
    // Wheels
    for (const dx of [-1.0, 0.2, 1.4]) {
      makeBox(
        `nh_btruck_wheel_${x}_${z}_${dx}`,
        0.4,
        0.4,
        0.3,
        new Vector3(x + dx, 0.2, z + 0.65),
        "#1c2230",
      );
      makeBox(
        `nh_btruck_wheel2_${x}_${z}_${dx}`,
        0.4,
        0.4,
        0.3,
        new Vector3(x + dx, 0.2, z - 0.65),
        "#1c2230",
      );
    }
  };

  // ----- Side streets, sidewalks, and crossings -----
  // Adding more streets so the neighbourhood reads as a real suburb with
  // a connected road grid, not just a single cross-shape. Each side
  // street has its own kerbs (sidewalks), centre dashes, and a named
  // street sign at the corner.
  const sideRoadDash = (
    name: string,
    along: "x" | "z",
    fixed: number,
    from: number,
    to: number,
  ): void => {
    for (let v = from; v <= to; v += 3.2) {
      // Skip dashes that fall inside the central main-road asphalt at the
      // intersection. The main horizontal road occupies z∈[-2.5, 2.5] and
      // the main vertical road occupies x∈[-2.5, 2.5]; with a small kerb
      // buffer of ±0.6 a side-road dash anywhere in |v|<3.1 of the cross
      // axis lands on the main road's tarmac and reads as an extra
      // "floating" dotted line on top of the intersection.
      if (along === "x") {
        // Side road runs east-west at z=fixed; it crosses the main vertical
        // road at x≈0. Skip dashes that would sit on the main vertical
        // road's asphalt.
        if (Math.abs(v) < 3.1) continue;
      } else {
        // Side road runs north-south at x=fixed; it crosses the main
        // horizontal road at z≈0.
        if (Math.abs(v) < 3.1) continue;
      }
      const dash = MeshBuilder.CreateBox(
        `${name}_${v}`,
        along === "x"
          ? { width: 1.2, height: 0.02, depth: 0.16 }
          : { width: 0.16, height: 0.02, depth: 1.2 },
        scene,
      );
      dash.position =
        along === "x"
          ? new Vector3(v, 0.085, fixed)
          : new Vector3(fixed, 0.085, v);
      dash.material = roadLine;
      attach(dash);
    }
  };

  // Glenferrie Rd — east-west residential street running through the
  // northern half, in front of George's place in Oakleigh. Extended west
  // across the main vertical road (now reaches x≈-14) so the upper
  // neighbourhood is no longer split in two. Stops short of the airport
  // terminal (x≈-16) so it doesn't slice through that building.
  makeRoad("nh_road_maple", 48, 3.5, new Vector3(10, 0.05, 20));
  sideRoadDash("nh_dash_maple", "x", 20, -12, 32);
  // Side kerbs (sidewalks) along Glenferrie Rd.
  makeKerb("nh_kerb_maple_n", 48, 0.9, new Vector3(10, 0.07, 22.2));
  makeKerb("nh_kerb_maple_s", 48, 0.9, new Vector3(10, 0.07, 17.8));

  // Collins St — the long east-west tram street across the south of the
  // map, between the central road and Lygon St. Tram tracks run down the
  // middle instead of a painted centre line.
  makeRoad("nh_road_birch", 66, 3.5, new Vector3(5, 0.05, -10));
  makeBox("nh_tram_rail_n", 66, 0.03, 0.08, new Vector3(5, 0.095, -9.6), "#8a8d94");
  makeBox("nh_tram_rail_s", 66, 0.03, 0.08, new Vector3(5, 0.095, -10.4), "#8a8d94");
  makeKerb("nh_kerb_birch_n", 66, 0.9, new Vector3(5, 0.07, -7.8));
  makeKerb("nh_kerb_birch_s", 66, 0.9, new Vector3(5, 0.07, -12.2));

  // Toorak Rd — north-south street on the east side, connecting
  // Glenferrie Rd to the main road. Placed at x=33 so it sits clear of the
  // Docklands fintech HQ at x≈23-29.
  makeRoad("nh_road_oak", 3.5, 28, new Vector3(33, 0.05, 8));
  sideRoadDash("nh_dash_oak", "z", 33, -6, 22);
  makeKerb("nh_kerb_oak_e", 0.9, 28, new Vector3(35.2, 0.07, 8));
  makeKerb("nh_kerb_oak_w", 0.9, 28, new Vector3(30.8, 0.07, 8));

  // Flinders Lane — short north-south street west of the office, linking
  // the airport to the main road.
  makeRoad("nh_road_cedar", 3.5, 22, new Vector3(-26, 0.05, 8));
  sideRoadDash("nh_dash_cedar", "z", -26, -2, 18);
  makeKerb("nh_kerb_cedar_e", 0.9, 22, new Vector3(-23.8, 0.07, 8));
  makeKerb("nh_kerb_cedar_w", 0.9, 22, new Vector3(-28.2, 0.07, 8));

  // Sidewalks along the main east-west and north-south roads. They sit
  // just outside the asphalt (which is 5 wide centred on 0).
  makeKerb("nh_kerb_main_n", 80, 0.9, new Vector3(0, 0.07, 2.95));
  makeKerb("nh_kerb_main_s", 80, 0.9, new Vector3(0, 0.07, -2.95));
  makeKerb("nh_kerb_main_e", 0.9, 80, new Vector3(2.95, 0.07, 0));
  makeKerb("nh_kerb_main_w", 0.9, 80, new Vector3(-2.95, 0.07, 0));

  // Zebra crossings around the central roundabout — four approaches.
  // Shifted out from ±4.6 to ±5.5 so the stripes sit cleanly on the road
  // asphalt rather than overlapping the cream-coloured roundabout disc
  // (radius 3) which previously looked like extra white blobs hugging the
  // roundabout. Span shortened to 2.4 to keep the stripes inside the 5-wide
  // road and avoid spilling onto the kerbs / grass.
  // Crosswalks around the central roundabout removed — the four white
  // stripe pads were reading as odd boxes against the asphalt.

  // Street name signs at the corners of the new streets.
  makeStreetSign(7.0, 22.5, "GLENFERRIE RD", "#3a8fd6");
  makeStreetSign(7.0, -12.5, "COLLINS ST", "#5a8a4a");
  makeStreetSign(36.5, 6.0, "TOORAK RD", "#c44a3a");
  makeStreetSign(-29.5, 6.0, "FLINDERS LANE", "#7a4f9c");

  // Chapel St — south-side east-west connector at z=-22. Threads between
  // the south-west mid-rise cluster, the apartment block, and the
  // builder's yard so those outlying lots are no longer dead-ended.
  makeRoad("nh_road_willow", 48, 3.5, new Vector3(8, 0.05, -22));
  sideRoadDash("nh_dash_willow", "x", -22, -14, 30);
  makeKerb("nh_kerb_willow_n", 48, 0.9, new Vector3(8, 0.07, -19.8));
  makeKerb("nh_kerb_willow_s", 48, 0.9, new Vector3(8, 0.07, -24.2));
  makeStreetSign(-15.0, -19.0, "CHAPEL ST", "#5a8a4a");

  // Swan St — short north-south spur at x=22 linking Collins St (z=-10)
  // to Chapel St (z=-22), down to the builder's yard end of town.
  makeRoad("nh_road_elm", 3.5, 14, new Vector3(22, 0.05, -16));
  sideRoadDash("nh_dash_elm", "z", 22, -22, -10);
  makeKerb("nh_kerb_elm_e", 0.9, 14, new Vector3(24.2, 0.07, -16));
  makeKerb("nh_kerb_elm_w", 0.9, 14, new Vector3(19.8, 0.07, -16));
  makeStreetSign(24.6, -12.0, "SWAN ST", "#7a4a3a");

  // Lygon St — short north-south spur at x=-10 linking Collins St (z=-10)
  // down to Chapel St (z=-22), past Tom's old café.
  makeRoad("nh_road_pine", 3.5, 12, new Vector3(-10, 0.05, -16));
  sideRoadDash("nh_dash_pine", "z", -10, -22, -10);
  makeKerb("nh_kerb_pine_e", 0.9, 12, new Vector3(-7.8, 0.07, -16));
  makeKerb("nh_kerb_pine_w", 0.9, 12, new Vector3(-12.2, 0.07, -16));
  makeStreetSign(-12.4, -12.0, "LYGON ST", "#3a5fb0");

  // Extra suburban houses lining the new streets — these use the full
  // makeSuburbanHouse recipe so the grid reads as a real neighbourhood
  // rather than scattered boxes.
  // Glenferrie Rd (north side, facing south onto the street). The
  // centre Z is chosen so foundation/eaves sit clear of the north kerb
  // at z≈22.65 (kerb_maple_n centred at 22.2 with depth 0.9).
  makeSuburbanHouse("nh_maple_a", 12, 25.6, {
    wall: "#e7d6c0", roof: "#7a4a3a", chimney: true, fence: true,
    mailbox: true, sidewalkZ: 22.8, storeys: 1,
  });
  makeSuburbanHouse("nh_maple_b", 22, 25.6, {
    wall: "#cfe1f0", roof: "#3a5fb0", chimney: true, fence: true,
    mailbox: true, sidewalkZ: 22.8, storeys: 2,
    fenceColor: "#e7d8c0",
  });
  makeSuburbanHouse("nh_maple_c", 30, 25.6, {
    wall: "#f0d6b0", roof: "#5a6a7c", chimney: true, fence: true,
    mailbox: true, sidewalkZ: 22.8, storeys: 1,
  });
  // (A previous back row of silhouettes used to sit on z=17.6 but that
  // band overlaps both the south kerb of Glenferrie Rd and the back of the
  // Oakleigh houses at z=14, so it was removed in favour of clean grass.)

  // Collins St (north side, facing south). Houses are now placed clear
  // of the north kerb (kerb_birch_n covers z≈-7.35..-8.25) so the
  // foundation and front step sit on grass / sidewalk rather than the
  // road surface.
  makeSuburbanHouse("nh_birch_a", -22, -5.0, {
    wall: "#e7d6c0", roof: "#5a4a3a", chimney: true, fence: true,
    mailbox: true, sidewalkZ: -7.2, storeys: 1,
  });
  makeSuburbanHouse("nh_birch_b", 12, -5.0, {
    wall: "#f0d6b0", roof: "#7a4a3a", chimney: true, fence: true,
    mailbox: true, sidewalkZ: -7.2, storeys: 1,
  });

  // Toorak Rd (east side, facing west — built as a custom rotated frame).
  // ox is chosen so the foundation (width 4.6) starts east of the east
  // kerb (kerb_oak_e covers x≈34.75..35.65) — the front step lands on
  // the sidewalk rather than overlapping the kerb stripe.
  for (const [oz, owall, oroof] of [
    [16, "#cfe1f0", "#3a5fb0"],
    [6, "#f0e6d2", "#5a6a7c"],
    [-2, "#e7c8a0", "#7a4a3a"],
  ] as Array<[number, string, string]>) {
    const ox = 38.2;
    makeBox(`nh_oak_found_${oz}`, 4.6, 0.4, 4.0, new Vector3(ox, 0.2, oz), "#9a8f7a");
    makeBox(`nh_oak_walls_${oz}`, 4.2, 2.6, 3.6, new Vector3(ox, 1.7, oz), owall);
    makeGableRoof(`nh_oak_roof_${oz}`, 4.0, 3.6, ox, oz, 3.0, oroof, "#f4f0e6");
    makeChimney(ox - 1.0, oz - 0.5, 3.4, "#7a4a3a");
    // Door + windows face west toward the street.
    makeBox(`nh_oak_door_${oz}`, 0.16, 1.7, 0.95, new Vector3(ox - 2.15, 0.85, oz), "#5a3a22");
    makeBox(`nh_oak_step_${oz}`, 0.5, 0.16, 1.4, new Vector3(ox - 2.4, 0.5, oz), "#cfc8b4");
    makeMullionedWindow(`nh_oak_winN_${oz}`, ox - 2.1, 1.7, oz - 1.2, 0.85, 0.85, "west");
    makeMullionedWindow(`nh_oak_winS_${oz}`, ox - 2.1, 1.7, oz + 1.2, 0.85, 0.85, "west");
    makeFrontPath(`nh_oak_path_${oz}`, ox - 2.6, oz, 35.5, oz);
    makeMailbox(35.6, oz - 1.6);
  }

  // ----- Caldova Wealth — Client Operations (central anchor) -----
  // The office sits just north-west of the roundabout so the front door
  // faces the central crossroads.
  const officeRoot = new TransformNode("nh_office_root", scene);
  officeRoot.parent = root;
  // Shifted slightly west (was -7) so the right-hand wall clears the
  // central north-south asphalt (which spans x=-2.5..2.5). Keeps the
  // front door facing the roundabout for the client walk-in path.
  officeRoot.position = new Vector3(-10, 0, 8);

  const officeBase = MeshBuilder.CreateBox(
    "nh_office_base",
    { width: 12, height: 6.0, depth: 8 },
    scene,
  );
  officeBase.position = new Vector3(0, 3.0, 0);
  officeBase.material = mat("officeBase", "#efe0c8");
  officeBase.parent = officeRoot;

  // Floor-divider band between the two storeys — a thin trim that visually
  // separates ground floor (door + sign) from the upper floor windows.
  const officeBand = MeshBuilder.CreateBox(
    "nh_office_band",
    { width: 12.2, height: 0.2, depth: 8.2 },
    scene,
  );
  officeBand.position = new Vector3(0, 3.0, 0);
  officeBand.material = mat("officeBand", "#d8c9a2");
  officeBand.parent = officeRoot;

  // Pitched (gable) roof — replaces the previous flat slab so the office
  // reads as a small two-storey building rather than a shoebox. Ridge runs
  // along the Z (front-to-back) axis so the gable face is visible from the
  // street side.
  makeGableRoof("nh_office_roof", 12, 8, 0, 0, 6.0, "#3a5fb0", "#cfd6e6");
  // makeGableRoof attaches to scene root, so reparent its created meshes
  // (eave slab + 4 layers + ridge) under the officeRoot transform so the
  // roof moves with the rest of the office.
  for (const n of [
    "nh_office_roof_eaveSlab",
    "nh_office_roof_layer_0",
    "nh_office_roof_layer_1",
    "nh_office_roof_layer_2",
    "nh_office_roof_layer_3",
    "nh_office_roof_ridge",
  ]) {
    const m = scene.getMeshByName(n);
    if (m) m.parent = officeRoot;
  }

  // Office sign
  const officeSign = MeshBuilder.CreateBox(
    "nh_office_sign",
    { width: 8, height: 1.4, depth: 0.2 },
    scene,
  );
  officeSign.position = new Vector3(0, 2.55, -4.05);
  officeSign.parent = officeRoot;

  const signTex = new DynamicTexture(
    "nh_office_sign_tex",
    { width: 1024, height: 200 },
    scene,
    false,
  );
  const sctx = signTex.getContext() as CanvasRenderingContext2D;
  sctx.fillStyle = "#2a3a5c";
  sctx.fillRect(0, 0, 1024, 200);
  sctx.fillStyle = "#ffb347";
  sctx.fillRect(20, 30, 140, 140);
  sctx.fillStyle = "#1c2230";
  sctx.font = "bold 110px sans-serif";
  sctx.textBaseline = "middle";
  sctx.textAlign = "center";
  sctx.fillText("C", 90, 106);
  sctx.textAlign = "left";
  // "CALDOVA" in bold white with "Wealth" in the brand amber, shrunk
  // together if needed so the pair always fits beside the logo tile.
  let brandPx = 92;
  const brandWidth = (): number => {
    sctx.font = `bold ${brandPx}px sans-serif`;
    const w1 = sctx.measureText("CALDOVA ").width;
    sctx.font = `600 ${Math.round(brandPx * 0.85)}px sans-serif`;
    return w1 + sctx.measureText("Wealth").width;
  };
  while (brandWidth() > 790 && brandPx > 50) brandPx -= 2;
  sctx.fillStyle = "#ffffff";
  sctx.font = `bold ${brandPx}px sans-serif`;
  sctx.fillText("CALDOVA", 196, 110);
  const caldovaWidth = sctx.measureText("CALDOVA ").width;
  sctx.fillStyle = "#ffd166";
  sctx.font = `600 ${Math.round(brandPx * 0.85)}px sans-serif`;
  sctx.fillText("Wealth", 196 + caldovaWidth, 112);
  signTex.update();

  const signMat = new StandardMaterial("nh_office_sign_mat", scene);
  signMat.diffuseTexture = signTex;
  signMat.emissiveColor = new Color3(0.4, 0.4, 0.4);
  signMat.specularColor = new Color3(0, 0, 0);
  officeSign.material = signMat;

  // Front door
  const door = MeshBuilder.CreateBox(
    "nh_office_door",
    { width: 1.6, height: 2.4, depth: 0.18 },
    scene,
  );
  door.position = new Vector3(0, 1.2, -4.02);
  door.material = mat("officeDoor", "#7a4f2a");
  door.parent = officeRoot;

  // Office windows — upper storey (front face) sits above the floor band.
  // The ground floor face is taken up by the entrance + signage so windows
  // there would overlap the sign.
  const winMat = mat("officeWin", "#cfe7ff");
  for (const wx of [-4.4, -2.2, 2.2, 4.4]) {
    const w = MeshBuilder.CreateBox(
      `nh_office_winU_${wx}`,
      { width: 1.4, height: 1.2, depth: 0.1 },
      scene,
    );
    w.position = new Vector3(wx, 4.6, -4.03);
    w.material = winMat;
    w.parent = officeRoot;
  }
  // Side windows (east + west) on the upper storey so the building doesn't
  // look blank from the roundabout / pathway sides.
  for (const wz of [-2.2, 0, 2.2]) {
    const wE = MeshBuilder.CreateBox(
      `nh_office_winE_${wz}`,
      { width: 0.1, height: 1.2, depth: 1.2 },
      scene,
    );
    wE.position = new Vector3(6.03, 4.6, wz);
    wE.material = winMat;
    wE.parent = officeRoot;
    const wW = MeshBuilder.CreateBox(
      `nh_office_winW_${wz}`,
      { width: 0.1, height: 1.2, depth: 1.2 },
      scene,
    );
    wW.position = new Vector3(-6.03, 4.6, wz);
    wW.material = winMat;
    wW.parent = officeRoot;
  }

  // Small pathway from the office door to the roundabout
  const path = MeshBuilder.CreateBox(
    "nh_office_path",
    { width: 1.6, height: 0.05, depth: 6 },
    scene,
  );
  path.position = new Vector3(-10, 0.08, 4.5);
  path.material = mat("path", "#d8c9a2");
  attach(path);

  // Office label
  makeLabel(-10, 13, "Caldova Wealth — Client Operations", "#2a3a5c");

  // ----- Captures: scenery referenced by the life-event animations -----
  // These are populated as each zone is built below, then handed to the
  // ambient controller at the very end so each scenario can replay its
  // life-event animation when started.
  let retirementBanner: Mesh | null = null;
  let retirementConfettiAt: Vector3 | null = null;
  const retirementBalloons: Mesh[] = [];
  let newJobConfettiAt: Vector3 | null = null;
  let cafeCloudAt: Vector3 | null = null;
  let cafeFrontAt: Vector3 | null = null;
  let graceAlertAt: Vector3 | null = null;
  let familyHomeCenter: Vector3 | null = null;

  // A flat box sign with centred, auto-fitted text on its front face.
  const makeTextSign = (
    name: string,
    w: number,
    h: number,
    pos: Vector3,
    text: string,
    opts: { bg: string; fg: string; texW?: number; texH?: number; fontPx?: number },
  ): Mesh => {
    const sign = MeshBuilder.CreateBox(name, { width: w, height: h, depth: 0.08 }, scene);
    sign.position = pos;
    attach(sign);
    const texW = opts.texW ?? 512;
    const texH = opts.texH ?? 96;
    const tex = new DynamicTexture(`${name}_tex`, { width: texW, height: texH }, scene, false);
    const c = tex.getContext() as CanvasRenderingContext2D;
    c.fillStyle = opts.bg;
    c.fillRect(0, 0, texW, texH);
    c.fillStyle = opts.fg;
    fitFont(c, text, texW * 0.9, opts.fontPx ?? Math.round(texH * 0.55));
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(text, texW / 2, texH / 2 + 2);
    tex.update();
    const m = new StandardMaterial(`${name}_mat`, scene);
    m.diffuseTexture = tex;
    m.emissiveColor = new Color3(0.5, 0.5, 0.5);
    m.specularColor = new Color3(0, 0, 0);
    sign.material = m;
    return sign;
  };

  // ----- Zone 1: Oakleigh — Retirement (George) -----
  // North-east quadrant. George's family home is dressed for his
  // retirement: a "Happy Retirement" banner across the front wall and
  // balloons tied to the front fence.
  {
    const zx = 16;
    const zz = 14;

    // George's house — full suburban look: foundation, mullioned windows,
    // chimney, pitched gable roof, picket fence, front path.
    makeBox("nh_home_h1_found", 5.4, 0.4, 4.4, new Vector3(zx, 0.2, zz), "#9a8f7a");
    makeBox("nh_home_h1_base", 5, 2.6, 4, new Vector3(zx, 1.7, zz), "#e7c8a0");
    makeBox(
      "nh_home_h1_trim",
      5.2,
      0.18,
      4.2,
      new Vector3(zx, 2.91, zz),
      "#f4f0e6",
    );
    makeGableRoof("nh_home_h1_roof", 4.8, 4, zx, zz, 3.0, "#b04a3a", "#f4f0e6");
    makeChimney(zx + 1.4, zz + 0.6, 3.4, "#a23a2c");
    makeBox("nh_home_h1_door", 0.95, 1.7, 0.16, new Vector3(zx, 0.85, zz - 2.05), "#5a3a22");
    makeBox("nh_home_h1_step", 1.4, 0.16, 0.5, new Vector3(zx, 0.5, zz - 2.3), "#cfc8b4");
    makeMullionedWindow("nh_home_h1_winL", zx - 1.55, 1.7, zz - 2.0, 1.0, 0.85, "south");
    makeMullionedWindow("nh_home_h1_winR", zx + 1.55, 1.7, zz - 2.0, 1.0, 0.85, "south");
    makeMullionedWindow("nh_home_h1_winE", zx + 2.5, 1.7, zz, 0.9, 0.85, "east");
    // Garden / driveway
    makeBox("nh_home_h1_drive", 2.4, 0.05, 3, new Vector3(zx, 0.06, zz - 4), "#b8b0a0");
    makeFrontPath("nh_home_h1_path", zx, zz - 2.6, zx, zz - 5.4);
    makePicketFence(zx - 3.0, zx - 1.2, zz - 5.6);
    makePicketFence(zx + 1.2, zx + 3.0, zz - 5.6);
    makeMailbox(zx + 2.6, zz - 5.3);

    // "HAPPY RETIREMENT, GEORGE!" banner across the front wall, between
    // the windows and the eaves, with a strip of bunting along the top.
    const banner = MeshBuilder.CreateBox(
      "nh_retire_banner",
      { width: 4.6, height: 0.55, depth: 0.06 },
      scene,
    );
    banner.position = new Vector3(zx, 2.55, zz - 2.12);
    attach(banner);
    const btex = new DynamicTexture(
      "nh_retire_banner_tex",
      { width: 1024, height: 124 },
      scene,
      false,
    );
    const bctx = btex.getContext() as CanvasRenderingContext2D;
    bctx.fillStyle = "#ffd166";
    bctx.fillRect(0, 0, 1024, 124);
    const flagColors = ["#d9534f", "#3a8fd6", "#10b981", "#ffffff", "#a855f7"];
    for (let i = 0; i < 16; i++) {
      bctx.fillStyle = flagColors[i % flagColors.length];
      bctx.beginPath();
      bctx.moveTo(i * 64, 0);
      bctx.lineTo(i * 64 + 64, 0);
      bctx.lineTo(i * 64 + 32, 26);
      bctx.closePath();
      bctx.fill();
    }
    bctx.fillStyle = "#1c2230";
    const bannerText = "HAPPY RETIREMENT, GEORGE!";
    fitFont(bctx, bannerText, 960, 64, 36);
    bctx.textAlign = "center";
    bctx.textBaseline = "middle";
    bctx.fillText(bannerText, 512, 76);
    btex.update();
    const bmat = new StandardMaterial("nh_retire_banner_mat", scene);
    bmat.diffuseTexture = btex;
    bmat.emissiveColor = new Color3(0.5, 0.5, 0.5);
    bmat.specularColor = new Color3(0, 0, 0);
    banner.material = bmat;
    retirementBanner = banner;
    retirementConfettiAt = new Vector3(zx, 3.2, zz - 3.4);

    // Balloon bunches tied to the gate posts — they bob in the breeze
    // (animated once the ambient controller exists, below).
    const balloonColors = ["#d9534f", "#ffd166", "#3a8fd6", "#ffffff", "#e8a33d", "#10b981"];
    let bi = 0;
    for (const bx of [zx - 1.2, zx + 1.2]) {
      for (let k = 0; k < 3; k++) {
        const ox = (k - 1) * 0.34;
        const top = 1.9 + (k % 2) * 0.35;
        makeBox(
          `nh_balloon_string_${bi}`,
          0.03,
          top - 0.5,
          0.03,
          new Vector3(bx + ox * 0.5, 0.5 + (top - 0.5) / 2, zz - 5.6),
          "#f4f0e6",
        );
        retirementBalloons.push(
          makeBox(
            `nh_balloon_${bi}`,
            0.42,
            0.5,
            0.42,
            new Vector3(bx + ox, top + 0.2, zz - 5.6),
            balloonColors[bi % balloonColors.length],
          ),
        );
        bi++;
      }
    }

    // Neighbouring house — also gets a real gable roof + chimney.
    makeBox("nh_home_h2_found", 4.6, 0.4, 4.0, new Vector3(zx + 8, 0.2, zz), "#9a8f7a");
    makeBox("nh_home_h2_base", 4.2, 2.4, 3.6, new Vector3(zx + 8, 1.6, zz), "#f0d6b0");
    makeBox(
      "nh_home_h2_trim",
      4.4,
      0.18,
      3.8,
      new Vector3(zx + 8, 2.71, zz),
      "#f4f0e6",
    );
    makeGableRoof("nh_home_h2_roof", 4.0, 3.6, zx + 8, zz, 2.8, "#7a4a3a", "#e7d8c0");
    makeChimney(zx + 9.2, zz + 0.5, 3.2, "#7a4a3a");
    makeBox("nh_home_h2_door", 0.85, 1.6, 0.16, new Vector3(zx + 8, 0.8, zz - 1.85), "#5a3a22");
    makeBox("nh_home_h2_step", 1.3, 0.16, 0.5, new Vector3(zx + 8, 0.5, zz - 2.1), "#cfc8b4");
    makeMullionedWindow("nh_home_h2_winL", zx + 6.8, 1.7, zz - 1.8, 0.9, 0.8, "south");
    makeMullionedWindow("nh_home_h2_winR", zx + 9.2, 1.7, zz - 1.8, 0.9, 0.8, "south");
    makeFrontPath("nh_home_h2_path", zx + 8, zz - 2.4, zx + 8, zz - 5.0);
    makePicketFence(zx + 5.4, zx + 7.4, zz - 5.6, 0, "#e7d8c0");
    makePicketFence(zx + 8.6, zx + 10.6, zz - 5.6, 0, "#e7d8c0");

    // Trees
    makeTree(zx - 3.5, zz + 2);
    makeTree(zx + 5.5, zz + 2.5);
    makeTree(zx + 11, zz - 2);

    // George on his front path.
    makePerson(zx - 0.2, zz - 4.6, "customerRetirement", { x: -10, z: 4 });

    // Party marker over the house (🎉)
    makeIncidentMarker(zx, 5.2, zz, "party");

    makeLabel(zx + 4, zz + 4, "Oakleigh — Retirement (George)", "#e8a33d");
  }

  // ----- Zone 2: Docklands — New Job (Priya) -----
  // East side, on the main road: Priya's new employer, a glassy fintech
  // office, with everyday cars parked along the kerb.
  {
    const zx = 22;
    const zz = 0;

    // Two cars parked well apart along the south kerb — just street life.
    // The ambient car builder models the car along local +Z, so we rotate
    // by π/2 to lay the long axis along the east-west main road.
    makeStaticVehicle(
      "nh_dock_car1",
      "car",
      new Vector3(zx - 2, 0, zz - 1.9),
      Math.PI / 2,
      "#c44a3a",
      "#a23a2c",
    );
    makeStaticVehicle(
      "nh_dock_car2",
      "car",
      new Vector3(zx + 5.5, 0, zz - 1.9),
      Math.PI / 2,
      "#3a6dc4",
      "#2a55a0",
    );

    // Docklands fintech HQ — a three-storey office with glass bands on the
    // street and east faces, an entrance canopy and a big name sign.
    const gx = zx + 4;
    const gz = zz + 8;
    makeBox("nh_hq_base", 6.0, 5.2, 4.4, new Vector3(gx, 2.6, gz), "#dfe7ee");
    makeBox("nh_hq_roof", 6.4, 0.35, 4.8, new Vector3(gx, 5.375, gz), "#2a3a5c");
    for (const gy of [2.4, 3.9]) {
      makeBox(`nh_hq_glassS_${gy}`, 5.4, 0.8, 0.08, new Vector3(gx, gy, gz - 2.24), "#7fb6e3");
      makeBox(`nh_hq_glassE_${gy}`, 0.08, 0.8, 3.8, new Vector3(gx + 3.04, gy, gz), "#7fb6e3");
    }
    makeBox("nh_hq_lobby", 2.6, 1.3, 0.08, new Vector3(gx + 1.4, 0.95, gz - 2.24), "#9fcbe8");
    makeBox("nh_hq_door", 1.4, 1.7, 0.12, new Vector3(gx - 1.4, 0.85, gz - 2.26), "#2a3a5c");
    makeBox("nh_hq_canopy", 2.2, 0.12, 1.0, new Vector3(gx - 1.4, 1.85, gz - 2.7), "#2a3a5c");
    makeTextSign(
      "nh_hq_sign",
      5.4,
      0.6,
      new Vector3(gx, 4.75, gz - 2.28),
      "DOCKLANDS FINTECH HQ",
      { bg: "#1c2230", fg: "#6ec1ff", texW: 1024, texH: 112, fontPx: 64 },
    );

    // Priya outside her new office.
    makePerson(zx + 4.6, zz + 4.6, "customerOnboarding", { x: -10, z: 4 });
    newJobConfettiAt = new Vector3(zx + 2.5, 2.4, zz + 4.6);

    // Briefcase marker (💼)
    makeIncidentMarker(zx + 1.2, 3.4, zz + 4.8, "briefcase");

    makeLabel(zx + 3, zz + 4, "Docklands — New Job (Priya)", "#3a8fd6");
  }

  // ----- Zone 3: Lygon St — Café Closed (Tom) -----
  // South-west quadrant: a row of three shopfronts. Tom's café in the
  // middle has closed — windows papered over, a CLOSED sign on the door and
  // a FOR LEASE board out front.
  {
    const zx = -18;
    const zz = -14;

    const shops: Array<[string, string]> = [
      ["#e7c8a0", "BAKERY"],
      ["#cfe1f0", "TOM'S CAFÉ"],
      ["#d8d2c0", "BOOKS"],
    ];
    for (let i = 0; i < shops.length; i++) {
      const [color, label] = shops[i];
      const sx = zx + i * 4.4;
      const closed = i === 1;
      makeBox(`nh_shop_base_${i}`, 4.0, 2.6, 3.6, new Vector3(sx, 1.3, zz), color);
      makeBox(
        `nh_shop_awning_${i}`,
        4.2,
        0.2,
        1.0,
        new Vector3(sx, 2.3, zz - 2.0),
        closed ? "#8a8f98" : "#3a5fb0",
      );
      makeBox(`nh_shop_door_${i}`, 0.9, 1.6, 0.12, new Vector3(sx, 0.8, zz - 1.85), "#5a3a22");
      makeBox(
        `nh_shop_win_${i}`,
        2.6,
        1.0,
        0.1,
        new Vector3(sx, 1.7, zz - 1.85),
        closed ? "#d8cfb8" : "#cfe7ff",
      );
      makeTextSign(`nh_shop_sign_${i}`, 3.6, 0.5, new Vector3(sx, 2.7, zz - 1.85), label, {
        bg: "#1c2230",
        fg: closed ? "#b8bec6" : "#ffd166",
        fontPx: 56,
      });
    }

    const cafeX = zx + 4.4;
    // "CLOSED" sign hanging on the café door.
    makeTextSign("nh_closed_sign", 0.9, 0.4, new Vector3(cafeX, 1.4, zz - 1.95), "CLOSED", {
      bg: "#c44a3a",
      fg: "#ffffff",
      texW: 256,
      texH: 112,
      fontPx: 64,
    });

    // "FOR LEASE" agent's board on two posts at the kerb.
    const leaseX = cafeX + 1.5;
    const leaseZ = zz - 3.0;
    for (const dx of [-0.55, 0.55]) {
      makeBox(`nh_lease_post_${dx}`, 0.08, 1.3, 0.08, new Vector3(leaseX + dx, 0.65, leaseZ + 0.05), "#5a5d65");
    }
    const lease = MeshBuilder.CreateBox(
      "nh_lease_board",
      { width: 1.5, height: 0.9, depth: 0.06 },
      scene,
    );
    lease.position = new Vector3(leaseX, 1.5, leaseZ);
    attach(lease);
    const ltex = new DynamicTexture("nh_lease_board_tex", { width: 384, height: 230 }, scene, false);
    const lctx = ltex.getContext() as CanvasRenderingContext2D;
    lctx.fillStyle = "#ffffff";
    lctx.fillRect(0, 0, 384, 230);
    lctx.fillStyle = "#e07a2c";
    lctx.fillRect(0, 0, 384, 120);
    lctx.textAlign = "center";
    lctx.textBaseline = "middle";
    lctx.fillStyle = "#ffffff";
    fitFont(lctx, "FOR LEASE", 350, 72);
    lctx.fillText("FOR LEASE", 192, 64);
    lctx.fillStyle = "#1c2230";
    fitFont(lctx, "Lygon St shopfront", 340, 36, 20);
    lctx.fillText("Lygon St shopfront", 192, 172);
    ltex.update();
    const lmat = new StandardMaterial("nh_lease_board_mat", scene);
    lmat.diffuseTexture = ltex;
    lmat.emissiveColor = new Color3(0.5, 0.5, 0.5);
    lmat.specularColor = new Color3(0, 0, 0);
    lease.material = lmat;

    // A couple of street trees along the footpath.
    makeTree(zx - 2.6, zz - 3.4, 0.75);
    makeTree(zx + 11.2, zz - 3.4, 0.75);

    // Tom outside his old café.
    makePerson(cafeX - 1.5, zz - 4.5, "customerHardship", { x: -10, z: 4 });
    cafeCloudAt = new Vector3(cafeX, 4.4, zz);
    cafeFrontAt = new Vector3(cafeX, 0, zz - 3.4);

    // Handshake marker (🤝)
    makeIncidentMarker(cafeX, 3.4, zz, "handshake");

    makeLabel(zx + 4, zz - 5.5, "Lygon St — Café Closed (Tom)", "#e07a2c");
  }

  // ----- Zone 4: Airport — Overseas Trip (Grace) -----
  // Far north-west corner — the airport Grace flew out of for her trip
  // through Italy, pushed onto the open grass beside the back-left skyline
  // tower. Sits west of Flinders Lane (kerb at x≈-28.65).
  {
    const zx = -32;
    const zz = 18;

    // Small terminal building
    makeBox("nh_term_base", 8, 3.0, 5, new Vector3(zx, 1.5, zz), "#cfe1f0");
    makeBox("nh_term_roof", 8.4, 0.4, 5.4, new Vector3(zx, 3.2, zz), "#3a5fb0");
    makeBox("nh_term_win", 6.0, 1.4, 0.1, new Vector3(zx, 1.8, zz - 2.55), "#cfe7ff");
    makeBox("nh_term_door", 1.6, 1.8, 0.15, new Vector3(zx + 2.5, 0.9, zz - 2.55), "#3a5fb0");

    // Terminal sign
    makeTextSign("nh_term_sign", 6, 0.7, new Vector3(zx, 3.55, zz - 2.6), "✈  MELBOURNE AIRPORT", {
      bg: "#1c2230",
      fg: "#ffffff",
      fontPx: 54,
    });

    // Tarmac
    makeBox("nh_tarmac", 12, 0.05, 5, new Vector3(zx - 1, 0.07, zz - 4), "#5a5d65");
    // Stripe
    makeBox("nh_tarmac_stripe", 8, 0.02, 0.2, new Vector3(zx - 1, 0.1, zz - 4), "#f4e8a8");

    // Tiny plane parked
    makeBox("nh_plane_body", 4.0, 0.7, 0.9, new Vector3(zx - 1, 0.55, zz - 4), "#ffffff");
    makeBox("nh_plane_tail", 0.6, 1.0, 0.2, new Vector3(zx + 0.8, 1.0, zz - 4), "#3a5fb0");
    makeBox("nh_plane_wing", 0.8, 0.15, 3.2, new Vector3(zx - 1, 0.7, zz - 4), "#dcdcdc");

    // Baggage trolley stacked with suitcases, ready for departure
    makeBox("nh_lug_trolley", 2.4, 0.3, 1.0, new Vector3(zx + 2, 0.25, zz - 1.5), "#7a7a7a");
    makeBox("nh_lug_case1", 0.8, 0.5, 0.6, new Vector3(zx + 2.8, 0.65, zz - 1.5), "#b03a6f");
    makeBox("nh_lug_case2", 0.8, 0.5, 0.6, new Vector3(zx + 2.0, 0.65, zz - 1.5), "#3a6dc4");
    makeBox("nh_lug_case3", 0.8, 0.5, 0.6, new Vector3(zx + 1.2, 0.65, zz - 1.5), "#5a8a4a");

    // Grace with her phone, about to fly out
    makePerson(zx + 1, zz - 0.5, "customerProtection", { x: -10, z: 4 });
    graceAlertAt = new Vector3(zx + 1, 0, zz - 0.5);

    // Shield marker (🛡️) — her account is being protected
    makeIncidentMarker(zx + 2, 2.4, zz - 1.5, "shield");

    // Pushed south-east of the terminal so the label sits on open grass
    // between the airport and the main road, instead of running off the
    // western edge of the map.
    makeLabel(zx + 2, zz - 12, "Airport — Overseas Trip (Grace)", "#d9534f");
  }

  // ----- Zone 5: Box Hill — Family Home (Robert) -----
  // South-east quadrant — handled with a calm, respectful tone.
  {
    const zx = 16;
    const zz = -16;
    familyHomeCenter = new Vector3(zx, 0.1, zz);

    // The family home, set apart — full suburban detail with a slate gable
    // roof, a chimney, mullioned windows, and a soft front path.
    makeBox("nh_life_found", 5.0, 0.4, 4.4, new Vector3(zx, 0.2, zz), "#9a8f7a");
    makeBox("nh_life_base", 4.6, 2.6, 4, new Vector3(zx, 1.7, zz), "#f0e6d2");
    makeBox(
      "nh_life_trim",
      4.8,
      0.18,
      4.2,
      new Vector3(zx, 2.91, zz),
      "#fff8e6",
    );
    makeGableRoof("nh_life_roof", 4.6, 4, zx, zz, 3.0, "#5a6a7c", "#dcd0bc");
    makeChimney(zx - 1.4, zz + 0.5, 3.4, "#7a6a5c");
    makeBox("nh_life_door", 0.95, 1.7, 0.16, new Vector3(zx, 0.85, zz - 2.05), "#3a3a3a");
    makeBox("nh_life_step", 1.4, 0.16, 0.5, new Vector3(zx, 0.5, zz - 2.3), "#cfc8b4");
    makeMullionedWindow("nh_life_winL", zx - 1.55, 1.7, zz - 2.0, 1.0, 0.85, "south");
    makeMullionedWindow("nh_life_winR", zx + 1.55, 1.7, zz - 2.0, 1.0, 0.85, "south");
    makeMullionedWindow("nh_life_winE", zx + 2.3, 1.7, zz, 0.9, 0.85, "east");

    // Driveway with parked family car — a proper voxel sedan.
    makeBox("nh_life_drive", 2.6, 0.05, 4, new Vector3(zx - 3.5, 0.07, zz - 1), "#b8b0a0");
    makeStaticVehicle(
      "nh_life_car",
      "car",
      new Vector3(zx - 3.5, 0, zz - 1),
      0,
      "#5a6a7c",
      "#3a4a5c",
    );

    // Garden — flowerbed (no alarm symbols)
    makeBox("nh_life_bed", 3.0, 0.1, 0.6, new Vector3(zx, 0.12, zz + 2.4), "#7a4f2a");
    for (let i = -1; i <= 1; i++) {
      makeBox(
        `nh_life_flower_${i}`,
        0.3,
        0.4,
        0.3,
        new Vector3(zx + i * 1.0, 0.35, zz + 2.4),
        i === 0 ? "#f4a3c7" : "#ffd166",
      );
    }

    // Trees nearby
    makeTree(zx + 4, zz - 3);
    makeTree(zx - 6, zz + 3, 0.9);

    // A small remembrance wreath at the door — gentle, no alarm symbols.
    makeBox("nh_life_wreath_outer", 0.7, 0.7, 0.08, new Vector3(zx, 1.6, zz - 2.1), "#5fa657");
    makeBox("nh_life_wreath_inner", 0.4, 0.4, 0.06, new Vector3(zx, 1.6, zz - 2.08), "#fff8e6");
    makeBox("nh_life_wreath_ribbon", 0.18, 0.55, 0.06, new Vector3(zx, 1.25, zz - 2.08), "#c2566f");

    // Robert walking calmly down the path
    makePerson(zx - 2.5, zz - 4, "customerBereavement", { x: -10, z: 4 });

    // Soft heart marker (gentle)
    makeIncidentMarker(zx, 4.6, zz, "heart");

    makeLabel(zx, zz + 5, "Box Hill — Family Home (Robert)", "#6e7a8a");
  }

  // ----- Apartment block (south-west corner) -----
  // A three-storey walk-up on the far left edge of the map — everyday
  // residential scenery that keeps the corner from reading as empty while
  // leaving the foreground clear toward the central roundabout.
  {
    const zx = -32;
    const zz = -28;

    // Three-storey apartment block
    makeBox("nh_apt_base", 7.0, 7.5, 5.0, new Vector3(zx, 3.75, zz), "#cfbfa8");
    makeBox("nh_apt_roof", 7.4, 0.4, 5.4, new Vector3(zx, 7.7, zz), "#5a4a3a");
    // Entry stoop
    makeBox("nh_apt_stoop", 2.6, 0.2, 1.4, new Vector3(zx, 0.2, zz - 2.85), "#b8b0a0");

    // Windows in a 3x3 grid on the front face
    const aptWin = mat("aptWin", "#cfe7ff");
    for (let row = 0; row < 3; row++) {
      for (let col = -1; col <= 1; col++) {
        const w = MeshBuilder.CreateBox(
          `nh_apt_win_${row}_${col}`,
          { width: 1.0, height: 0.8, depth: 0.1 },
          scene,
        );
        w.position = new Vector3(zx + col * 2.2, 1.6 + row * 2.2, zz - 2.55);
        w.material = aptWin;
        attach(w);
      }
    }

    // Front door
    makeBox("nh_apt_door", 1.0, 1.8, 0.16, new Vector3(zx, 0.95, zz - 2.55), "#5a3a22");

    // A resident's car parked out front — proper voxel sedan.
    makeStaticVehicle(
      "nh_apt_car",
      "car",
      new Vector3(zx + 5, 0, zz - 3.5),
      0,
      "#2a3a5c",
      "#1c2230",
    );

    // Trees / planter beside the building
    makeTree(zx - 5, zz - 1, 0.9);
    makeTree(zx + 5.5, zz + 2, 0.9);
  }

  // ----- Voxel-city downtown strip -----
  // A small cluster of mid-rise voxel buildings on the western edge so the
  // neighbourhood reads as more than just suburbs. Style is inspired by
  // generic MagicaVoxel city packs: chunky flat-roofed buildings with
  // banded windows. Geometry is original / procedural.
  const makeMidRise = (
    cx: number,
    cz: number,
    storeys: number,
    baseColor: string,
    bandColor: string,
    width = 5.0,
    depth = 4.0,
  ): void => {
    const storeyH = 1.6;
    const totalH = storeys * storeyH;
    // Main shaft
    const shaft = MeshBuilder.CreateBox(
      `nh_dt_shaft_${cx}_${cz}`,
      { width, height: totalH, depth },
      scene,
    );
    shaft.position = new Vector3(cx, totalH / 2, cz);
    shaft.material = mat(`dtBase_${baseColor}`, baseColor);
    attach(shaft);
    // Window bands on the front face (south)
    const bandMat = mat(`dtBand_${bandColor}`, bandColor);
    for (let s = 0; s < storeys; s++) {
      const y = s * storeyH + 1.0;
      const band = MeshBuilder.CreateBox(
        `nh_dt_band_${cx}_${cz}_${s}`,
        { width: width - 0.6, height: 0.5, depth: 0.08 },
        scene,
      );
      band.position = new Vector3(cx, y, cz - depth / 2 - 0.04);
      band.material = bandMat;
      attach(band);
      // East / west window bands too
      const bandE = MeshBuilder.CreateBox(
        `nh_dt_bandE_${cx}_${cz}_${s}`,
        { width: 0.08, height: 0.5, depth: depth - 0.6 },
        scene,
      );
      bandE.position = new Vector3(cx + width / 2 + 0.04, y, cz);
      bandE.material = bandMat;
      attach(bandE);
      const bandW = MeshBuilder.CreateBox(
        `nh_dt_bandW_${cx}_${cz}_${s}`,
        { width: 0.08, height: 0.5, depth: depth - 0.6 },
        scene,
      );
      bandW.position = new Vector3(cx - width / 2 - 0.04, y, cz);
      bandW.material = bandMat;
      attach(bandW);
    }
    // Roof parapet
    makeBox(
      `nh_dt_parapet_${cx}_${cz}`,
      width + 0.2,
      0.3,
      depth + 0.2,
      new Vector3(cx, totalH + 0.15, cz),
      "#5a5d65",
    );
    // Roof HVAC box
    makeBox(
      `nh_dt_hvac_${cx}_${cz}`,
      1.4,
      0.5,
      1.0,
      new Vector3(cx - 1.0, totalH + 0.55, cz + 0.6),
      "#9aa0a8",
    );
    // Ground-floor entrance
    makeBox(
      `nh_dt_door_${cx}_${cz}`,
      1.2,
      1.4,
      0.12,
      new Vector3(cx, 0.7, cz - depth / 2 - 0.06),
      "#1c2230",
    );
  };

  // Place the downtown strip in the south-west outer area, off the main road.
  // The two tallest blocks have been relocated to the far back-left and far
  // back-right corners so they read as "downtown skyline" silhouettes
  // instead of standing in front of (and visually blocking) the lower
  // suburban buildings nearer the camera.
  makeMidRise(-26, -18, 4, "#e7c8a0", "#a23a2c", 4.6, 4.0);
  makeMidRise(-20, -22, 3, "#cfe1f0", "#1c2230", 5.4, 4.4);
  // Far back-right corner skyline tower
  makeMidRise(36, 30, 5, "#cfd6dc", "#3a5fb0", 5.0, 4.2);
  // Far back-left corner skyline tower
  makeMidRise(-36, 30, 6, "#dcdcdc", "#2a3a5c", 4.4, 4.0);
  // A tiny park bench in front of the downtown strip
  makeBox("nh_dt_bench", 1.6, 0.15, 0.4, new Vector3(-28, 0.45, -12), "#7a4f2a");
  makeBox("nh_dt_bench_back", 1.6, 0.5, 0.1, new Vector3(-28, 0.7, -12.18), "#7a4f2a");
  makeTree(-30, -12, 0.85);
  makeTree(-24, -14, 0.85);

  // ----- Builder's Yard -----
  // A small construction-supplies depot on the eastern edge — everyday
  // scenery that ties the construction-pack-style props together.
  {
    const yx = 32;
    const yz = -18;
    // Fenced yard pad
    makeBox("nh_yard_pad", 12, 0.05, 9, new Vector3(yx, 0.06, yz), "#b8b0a0");
    // Storage shed
    makeBox("nh_yard_shed", 4.5, 2.6, 3.5, new Vector3(yx + 3, 1.3, yz - 2.5), "#e07a2c");
    makeBox("nh_yard_shed_roof", 4.7, 0.3, 3.7, new Vector3(yx + 3, 2.75, yz - 2.5), "#1c2230");
    makeBox("nh_yard_shed_door", 1.2, 1.6, 0.12, new Vector3(yx + 3, 0.8, yz - 4.3), "#3a3a3a");
    // Yard contents
    makeTimberStack(yx - 3.5, yz);
    makeTimberStack(yx - 3.5, yz + 1.5);
    makeBrickPile(yx, yz + 2.5);
    makeBrickPile(yx + 1.5, yz + 2.5);
    makeCementMixer(yx - 2.5, yz - 2.5);
    makeBuilderTruck(yx + 0.5, yz - 1);
    // Cones at the gate
    makeCone(yx - 6, yz + 4);
    makeCone(yx - 5, yz + 4);
  }

  // ----- Greenspaces: parks, playground, and a small river -----
  // Fills out the empty grass so the neighbourhood feels lived-in rather
  // than vacant between zones. Each piece is purely decorative.
  const makeParkPad = (cx: number, cz: number, w: number, d: number): void => {
    const pad = MeshBuilder.CreateBox(
      `nh_park_pad_${cx}_${cz}`,
      { width: w, height: 0.06, depth: d },
      scene,
    );
    pad.position = new Vector3(cx, 0.04, cz);
    pad.material = mat("parkPad", "#7faf5c");
    attach(pad);
  };
  const makeBench = (cx: number, cz: number): void => {
    makeBox(`nh_bench_seat_${cx}_${cz}`, 1.6, 0.15, 0.4, new Vector3(cx, 0.45, cz), "#7a4f2a");
    makeBox(`nh_bench_back_${cx}_${cz}`, 1.6, 0.5, 0.1, new Vector3(cx, 0.7, cz - 0.18), "#7a4f2a");
  };
  const makePondPatch = (cx: number, cz: number, w: number, d: number): void => {
    const pond = MeshBuilder.CreateBox(
      `nh_pond_${cx}_${cz}`,
      { width: w, height: 0.05, depth: d },
      scene,
    );
    pond.position = new Vector3(cx, 0.05, cz);
    pond.material = mat("pondWater", "#5fa8d6");
    attach(pond);
  };
  const makeSwingSet = (cx: number, cz: number): void => {
    makeBox(`nh_swing_postL_${cx}_${cz}`, 0.18, 1.6, 0.18, new Vector3(cx - 0.9, 0.8, cz), "#7a4a3a");
    makeBox(`nh_swing_postR_${cx}_${cz}`, 0.18, 1.6, 0.18, new Vector3(cx + 0.9, 0.8, cz), "#7a4a3a");
    makeBox(`nh_swing_top_${cx}_${cz}`, 2.0, 0.16, 0.18, new Vector3(cx, 1.55, cz), "#7a4a3a");
    makeBox(`nh_swing_seatA_${cx}_${cz}`, 0.5, 0.1, 0.25, new Vector3(cx - 0.45, 0.55, cz), "#c44a3a");
    makeBox(`nh_swing_seatB_${cx}_${cz}`, 0.5, 0.1, 0.25, new Vector3(cx + 0.45, 0.55, cz), "#3a8fd6");
  };
  const makeSlide = (cx: number, cz: number): void => {
    // Ladder + platform + slope
    makeBox(`nh_slide_lad_${cx}_${cz}`, 0.5, 1.4, 0.2, new Vector3(cx - 0.9, 0.7, cz), "#cfc8b4");
    makeBox(`nh_slide_pad_${cx}_${cz}`, 1.2, 0.18, 1.0, new Vector3(cx - 0.4, 1.45, cz), "#ffd166");
    const slope = MeshBuilder.CreateBox(
      `nh_slide_slope_${cx}_${cz}`,
      { width: 0.7, height: 0.12, depth: 1.8 },
      scene,
    );
    slope.position = new Vector3(cx + 0.6, 0.95, cz);
    slope.rotation.x = -0.55;
    slope.material = mat("slideSlope", "#3a8fd6");
    attach(slope);
  };
  const makeSandbox = (cx: number, cz: number): void => {
    makeBox(`nh_sand_${cx}_${cz}`, 2.4, 0.08, 2.4, new Vector3(cx, 0.06, cz), "#e8d8a0");
    makeBox(`nh_sand_rimN_${cx}_${cz}`, 2.6, 0.18, 0.18, new Vector3(cx, 0.13, cz - 1.2), "#7a4a3a");
    makeBox(`nh_sand_rimS_${cx}_${cz}`, 2.6, 0.18, 0.18, new Vector3(cx, 0.13, cz + 1.2), "#7a4a3a");
    makeBox(`nh_sand_rimE_${cx}_${cz}`, 0.18, 0.18, 2.6, new Vector3(cx + 1.2, 0.13, cz), "#7a4a3a");
    makeBox(`nh_sand_rimW_${cx}_${cz}`, 0.18, 0.18, 2.6, new Vector3(cx - 1.2, 0.13, cz), "#7a4a3a");
  };

  // North-east corner park — fills the empty grass behind the residential zone
  {
    const px = 32;
    const pz = 32;
    makeParkPad(px, pz, 12, 10);
    makePondPatch(px - 2, pz + 1, 4.0, 2.6);
    makeTree(px + 3, pz - 2, 0.95);
    makeTree(px + 4.5, pz + 3, 0.85);
    makeTree(px - 4, pz - 3, 0.9);
    makeBench(px + 1.5, pz - 3.6);
  }

  // South-central playground — between Lygon St and Swan St on Chapel St
  {
    const px = 6;
    const pz = -28;
    makeParkPad(px, pz, 12, 7);
    makeSwingSet(px - 3.5, pz);
    makeSlide(px + 0.5, pz);
    makeSandbox(px + 4, pz);
    makeBench(px - 1, pz + 2.6);
    makeTree(px - 5.5, pz + 2.5, 0.8);
    makeTree(px + 5.5, pz - 2.5, 0.8);
  }

  // North-back river — winding strip along the back of the map between the
  // airport and the Glenferrie Rd skyline. Pure scenery; no road
  // crossings (it sits behind the houses).
  {
    const riverY = 0.05;
    const segments: Array<[number, number, number, number]> = [
      // [cx, cz, width, depth]
      [-6, 33, 14, 1.8],
      [4, 34, 8, 1.8],
      [12, 33, 10, 1.8],
      [20, 32, 8, 1.8],
      [27, 33, 6, 1.8],
    ];
    for (const [cx, cz, w, d] of segments) {
      const seg = MeshBuilder.CreateBox(
        `nh_river_${cx}_${cz}`,
        { width: w, height: 0.05, depth: d },
        scene,
      );
      seg.position = new Vector3(cx, riverY, cz);
      seg.material = mat("riverWater", "#4a9bd0");
      attach(seg);
      // Sandy bank on the north edge
      const bank = MeshBuilder.CreateBox(
        `nh_river_bank_${cx}_${cz}`,
        { width: w + 0.4, height: 0.07, depth: 0.5 },
        scene,
      );
      bank.position = new Vector3(cx, 0.06, cz + d / 2 + 0.2);
      bank.material = mat("riverBank", "#d8c896");
      attach(bank);
    }
    // A tiny voxel footbridge over the river
    makeBox("nh_bridge_deck", 1.6, 0.15, 3.0, new Vector3(8, 0.25, 33), "#a07a4a");
    makeBox("nh_bridge_railL", 1.6, 0.4, 0.1, new Vector3(8, 0.55, 31.6), "#7a4f2a");
    makeBox("nh_bridge_railR", 1.6, 0.4, 0.1, new Vector3(8, 0.55, 34.4), "#7a4f2a");
  }

  // Small western pocket park — fills empty grass between the relocated
  // mid-rises and Flinders Lane.
  {
    const px = -32;
    const pz = -2;
    makeParkPad(px, pz, 8, 8);
    makeTree(px - 2, pz - 2, 0.9);
    makeTree(px + 2, pz + 2, 0.9);
    makeTree(px + 2.5, pz - 2.5, 0.85);
    makeBench(px, pz);
  }

  // ----- Roadworks -----
  // A short stretch of barriers + cones along the eastern road, hinting
  // that work is ongoing across the neighbourhood.
  for (const rz of [-8, -5]) {
    makeBarrier(28, rz);
  }
  makeCone(26, -3);
  makeCone(26, -1);
  makeCone(26, 1);

  // ----- Background filler: a few generic suburban houses -----
  // These now use the full suburban-house recipe so they don't read as
  // "fake" boxes. Each gets a foundation, mullioned windows, gable roof,
  // chimney, picket fence, and a front path. Positions chosen so they
  // line a side street or sit on an unused verge — clear of the other
  // zones and the new streets above.
  const fillers: Array<{
    cx: number;
    cz: number;
    wall: string;
    roof: string;
    storeys?: 1 | 2;
    sidewalkZ: number;
    fenceColor?: string;
  }> = [
    // West side, between Flinders Lane and the main road.
    { cx: -22, cz: 6, wall: "#e7c8a0", roof: "#7a4a3a", sidewalkZ: 4.4 },
    // West side, south of the main road. Centre Z is well clear of the
    // main south kerb (z≈-3.4) so the foundation no longer sits in the
    // road asphalt.
    { cx: -22, cz: -5.5, wall: "#f0d6b0", roof: "#5a6a7c", sidewalkZ: -3.6 },
    // North-east, on Glenferrie Rd (a two-storey home). Centre Z lifted
    // so the foundation sits clear of the north kerb at z≈22.65.
    { cx: 4, cz: 25.6, wall: "#cfe1f0", roof: "#3a5fb0", sidewalkZ: 22.8,
      storeys: 2, fenceColor: "#e7d8c0" },
  ];
  for (const f of fillers) {
    makeSuburbanHouse(`nh_filler_${f.cx}_${f.cz}`, f.cx, f.cz, {
      wall: f.wall,
      roof: f.roof,
      storeys: f.storeys,
      chimney: true,
      fence: true,
      mailbox: true,
      sidewalkZ: f.sidewalkZ,
      fenceColor: f.fenceColor,
    });
  }

  // ----- Streetlights & post boxes along the main road -----
  const lampMat = mat("lamp", "#3a3a3a");
  const lampHead = mat("lampHead", "#fff5d6");
  const lampPositions: Array<[number, number]> = [
    // Lamp in front of the Caldova office shifted left by 10 units
    // so it no longer sits directly in front of the entrance/sign.
    [-22, 3],
    [12, 3],
    [-12, -3],
    [12, -3],
    [-26, 3],
    [26, 3],
    [-26, -3],
    [26, -3],
  ];
  for (const [lx, lz] of lampPositions) {
    const pole = MeshBuilder.CreateBox(
      `nh_lamp_${lx}_${lz}`,
      { width: 0.18, height: 2.6, depth: 0.18 },
      scene,
    );
    pole.position = new Vector3(lx, 1.3, lz);
    pole.material = lampMat;
    attach(pole);
    const head = MeshBuilder.CreateBox(
      `nh_lamphead_${lx}_${lz}`,
      { width: 0.5, height: 0.4, depth: 0.5 },
      scene,
    );
    head.position = new Vector3(lx, 2.7, lz);
    head.material = lampHead;
    attach(head);
  }

  // A few extra trees along the edges of the streets
  for (const [tx, tz] of [
    [-9, 5],
    [9, 5],
    [-9, -5],
    [9, -5],
    [-17, 4],
    [17, 4],
    [-17, -4],
    [17, -4],
    [-3, 14],
    [3, 14],
    [-3, -14],
    [3, -14],
  ] as Array<[number, number]>) {
    makeTree(tx, tz, 0.85);
  }

  // Decorative trail: Caldova staff out and about, heading to the office ---
  // The Caldova Wealth — Client Operations building sits at world (-10, 0, 8)
  // with its south-facing entrance at z≈4. Trail figures face that doorway
  // so the visual reads as "everyone heading into the Caldova building".
  const office = { x: -10, z: 4 };
  makePerson(-4.2, -7, "onboardingOfficer", office);
  makePerson(8, -2, "transfersCoord", office);
  makePerson(-3, 6, "benefitsAssessor", office);
  makePerson(-2, -3, "investmentAnalyst", office);
  // Extra figures along the side streets to make the suburb feel lived-in.
  makePerson(18, 20, "commsSpecialist", office);
  makePerson(26, 16, "paymentsOfficer", office);
  makePerson(-12, -19, "finCrimeInvestigator", office);
  makePerson(30, 6, "teamLeader", office);

  const zones: IncidentZones = {
    // Office front door — the Caldova Wealth — Client Operations building
    // sits at world (-10, 0, 8) with its south-facing entrance at z≈4.
    // Routing the client to (-10, 0, 5) puts them at the doorway threshold,
    // so the last walk segment visibly carries them up the office walkway
    // and INTO the building before the scene fades to the office.
    officeDoor: new Vector3(-10, 0, 5),
    // Each zone anchor is where the client voxel character begins their
    // walk toward the office — on a path or forecourt beside the life-event
    // scenery rather than inside a building.
    onboarding: new Vector3(24.5, 0, 4.4),
    protection: new Vector3(-32 + 8, 0, 18 - 4),
    retirement: new Vector3(16 - 2, 0, 14 - 4),
    hardship: new Vector3(-18 + 1, 0, -14 + 2),
    bereavement: new Vector3(16 - 1, 0, -16 + 2),
  };

  // ----- Ambient life: trams, cars, pedestrians, pets, and life events -----
  // Mirrors the "always animated" feel of the office scene, where staff and
  // clients are constantly moving around. Routes are picked to avoid the
  // static scenery (parked cars, street signs, shopfront boards etc.).
  const ambient = new NeighbourhoodAmbient(scene, root);

  // Cars looping along the side streets. Each route gets a different
  // vehicle type so the neighbourhood reads as a real mixed-traffic
  // street rather than a row of identical sedans.
  // Glenferrie Rd (z=20) — runs east-west; lanes at z=19 (eastbound) and z=21 (westbound).
  ambient.addCar(
    "maple_e",
    [
      [8, 19],
      [32, 19],
    ],
    { type: "jeep", bodyColor: "#5fa657", topColor: "#3a7a3a", speed: 4.5 },
  );
  ambient.addCar(
    "maple_w",
    [
      [32, 21],
      [8, 21],
    ],
    { type: "mini", bodyColor: "#c188d4", topColor: "#3a3a3a", speed: 4.0 },
  );
  // Collins St (z=-10) — a green-and-gold Melbourne tram glides along the
  // tracks down the middle of the street.
  ambient.addCar(
    "collins_tram",
    [
      [-27, -10],
      [37, -10],
    ],
    { type: "tram", bodyColor: "#2f7d3a", topColor: "#e8b84a", speed: 3.2 },
  );
  // Toorak Rd (x=33) — north-south on the east side of town.
  ambient.addCar(
    "oak_n",
    [
      [34, -4],
      [34, 20],
    ],
    { type: "jeep", bodyColor: "#3a8fd6", topColor: "#1f5fa0", speed: 4.0 },
  );
  // Flinders Lane (x=-26) — north-south on the west side.
  ambient.addCar(
    "cedar_s",
    [
      [-27, 18],
      [-27, -1],
    ],
    { type: "mini", bodyColor: "#e84b3a", topColor: "#1c1c1c", speed: 4.0 },
  );

  // Bicycles and scooters share the quieter lanes for a bit of light traffic.
  ambient.addCar(
    "maple_bike",
    [
      [10, 20],
      [30, 20],
    ],
    { type: "bicycle", bodyColor: "#2b6cb0", topColor: "#f08a3a", speed: 2.6 },
  );
  ambient.addCar(
    "vert_scooter",
    [
      [3, 8],
      [3, -8],
    ],
    { type: "scooter", bodyColor: "#e84b3a", topColor: "#f8d34a", speed: 3.2 },
  );
  ambient.addCar(
    "collins_bike_w",
    [
      [6, -8.8],
      [-26, -8.8],
    ],
    { type: "bicycle", bodyColor: "#4a8a4a", topColor: "#ffd166", speed: 2.4 },
  );

  // Delivery vans doing the rounds on Toorak Rd and Chapel St.
  ambient.addCar(
    "toorak_van",
    [
      [32, 20],
      [32, -4],
    ],
    { type: "van", bodyColor: "#f4f0e6", topColor: "#d9534f", speed: 3.6 },
  );
  ambient.addCar(
    "chapel_van",
    [
      [-15, -21.2],
      [31, -21.2],
    ],
    { type: "van", bodyColor: "#ffd166", topColor: "#3a3a44", speed: 3.8 },
  );

  // Wandering pedestrians on sidewalks. Routes hug the kerbs so the
  // walkers stay clear of the road centres and the static personas.
  ambient.addPedestrian(
    "main_n_walker",
    "cityCommuter",
    [
      [-30, 3.4],
      [-10, 3.4],
      [-10, 3.4],
      [-30, 3.4],
    ],
    1.5,
  );
  ambient.addPedestrian(
    "main_s_walker",
    "cityJogger",
    [
      [10, -3.4],
      [30, -3.4],
      [30, -3.4],
      [10, -3.4],
    ],
    1.4,
  );
  ambient.addPedestrian(
    "maple_walker",
    "cityStudent",
    [
      [10, 17.4],
      [30, 17.4],
    ],
    1.3,
  );
  ambient.addPedestrian(
    "vert_walker",
    "parcelCourier",
    [
      [3.4, 14],
      [3.4, 28],
      [3.4, 28],
      [3.4, 14],
    ],
    1.4,
  );

  // Friendly pets bumbling around grass patches well clear of the roads
  // and life-event scenery (corners of the map are mostly empty grass). A
  // mix of dogs, cats, and a rabbit so the neighbourhood has more life.
  ambient.addPet(
    "nw_dog",
    { cx: -30, cz: 28, radius: 3.0 },
    { type: "dog", furColor: "#c8a878" },
  );
  ambient.addPet(
    "se_cat",
    { cx: 30, cz: -28, radius: 3.0 },
    { type: "cat", furColor: "#3a3a3a" },
  );
  ambient.addPet(
    "ne_dog",
    { cx: 30, cz: 30, radius: 2.5 },
    { type: "dog", furColor: "#e7c8a0" },
  );
  ambient.addPet(
    "sw_rabbit",
    { cx: -30, cz: -26, radius: 2.5 },
    { type: "rabbit", furColor: "#bfa68a" },
  );
  ambient.addPet(
    "n_cat",
    { cx: -8, cz: 30, radius: 2.5 },
    { type: "cat", furColor: "#e0a060" },
  );

  // Birds gliding overhead in lazy loops above the roads.
  ambient.addBird(
    "bird_loop_n",
    [
      [-28, 26],
      [28, 26],
      [28, 8],
      [-28, 8],
    ],
    { bodyColor: "#3a4a52", wingColor: "#1c2a32", altitude: 8, speed: 6.0 },
  );
  ambient.addBird(
    "bird_loop_s",
    [
      [28, -26],
      [-28, -26],
      [-28, -6],
      [28, -6],
    ],
    { bodyColor: "#c44a3a", wingColor: "#7a2a20", altitude: 7, speed: 5.5 },
  );
  ambient.addBird(
    "bird_high",
    [
      [-20, -10],
      [20, 10],
      [-20, 18],
      [20, -18],
    ],
    { bodyColor: "#f4d36a", wingColor: "#b89a3a", altitude: 10, speed: 7.0 },
  );

  // Retirement balloons on George's gate posts bob and sway gently in the
  // breeze — always on, independent of any scenario.
  if (retirementBalloons.length > 0) {
    const balloonBase = retirementBalloons.map((b) => b.position.clone());
    let breeze = 0;
    ambient.addAnimation((dt) => {
      breeze += dt;
      for (let i = 0; i < retirementBalloons.length; i++) {
        const b = retirementBalloons[i];
        b.position.y = balloonBase[i].y + Math.sin(breeze * 1.8 + i * 1.3) * 0.06;
        b.position.x = balloonBase[i].x + Math.sin(breeze * 1.1 + i) * 0.04;
        b.rotation.z = Math.sin(breeze * 1.4 + i * 0.7) * 0.08;
      }
    });
  }

  // Register the per-scenario life-event animations.
  if (newJobConfettiAt) {
    ambient.registerIncident(
      "onboarding",
      makeCelebrationIncident(scene, root, newJobConfettiAt),
    );
  }
  if (graceAlertAt) {
    ambient.registerIncident(
      "protection",
      makeIdentityAlertIncident(scene, root, graceAlertAt),
    );
  }
  if (retirementBanner && retirementConfettiAt) {
    ambient.registerIncident(
      "retirement",
      makeRetirementIncident(scene, root, retirementBanner, retirementConfettiAt),
    );
  }
  if (cafeCloudAt && cafeFrontAt) {
    ambient.registerIncident(
      "hardship",
      makeHardshipCloudIncident(scene, root, cafeCloudAt, cafeFrontAt),
    );
  }
  if (familyHomeCenter) {
    ambient.registerIncident(
      "bereavement",
      makeCalmGlowIncident(scene, root, familyHomeCenter),
    );
  }

  return {
    root,
    zones,
    update: (dt) => ambient.update(dt),
    playIncident: (id) => ambient.playIncident(id),
    clearIncident: () => ambient.clearIncident(),
  };
}
