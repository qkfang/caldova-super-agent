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
import { NeighbourhoodAmbient } from "./neighbourhoodAmbient";

/**
 * The parkland around the Caldova Wealth office.
 *
 * The office sits in a green park: a stone forecourt with a water feature at
 * the front door, gravel paths looping around the building, a pond with a
 * jetty and ducks, a gazebo, a picnic area, flower beds, benches, lampposts
 * and plenty of trees. Trees stay low and thin near the front so they never
 * hide the office floor from the default camera.
 *
 * Coordinates: the office footprint is x∈[-30, 30], z∈[-15, 25]. Clients
 * arrive from (0, -18), so the entrance path runs down the x = 0 axis.
 */
export function buildPark(scene: Scene): void {
  const matCache = new Map<string, StandardMaterial>();
  const colour = (hex: string): StandardMaterial => {
    let m = matCache.get(hex);
    if (!m) {
      m = new StandardMaterial(`park_${hex}`, scene);
      m.diffuseColor = Color3.FromHexString(hex);
      m.specularColor = new Color3(0.04, 0.04, 0.04);
      matCache.set(hex, m);
    }
    return m;
  };

  const box = (
    name: string,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    hex: string,
  ): Mesh => {
    const m = MeshBuilder.CreateBox(`park_${name}`, { width: w, height: h, depth: d }, scene);
    m.position.set(x, y, z);
    m.material = colour(hex);
    return m;
  };

  const slab = (
    name: string,
    x0: number,
    x1: number,
    z0: number,
    z1: number,
    top: number,
    hex: string,
  ): Mesh => box(name, x1 - x0, top, z1 - z0, (x0 + x1) / 2, top / 2, (z0 + z1) / 2, hex);

  // ----- Lawn -----
  const ground = MeshBuilder.CreateBox("ground", { width: 340, depth: 340, height: 0.4 }, scene);
  ground.position.y = -0.2;
  ground.material = colour("#6aa84f");
  // Slightly lighter mown stripes across the near lawn.
  for (let i = -8; i <= 8; i++) {
    if (i % 2) continue;
    slab(`mow_${i}`, i * 14 - 7, i * 14 + 7, -80, 90, 0.015, "#73b057");
  }

  // ----- Paths -----
  const PATH = "#d9d3c1";
  const EDGE = "#b9b29c";
  const path = (name: string, x0: number, x1: number, z0: number, z1: number): void => {
    slab(`${name}_edge`, x0 - 0.25, x1 + 0.25, z0 - 0.25, z1 + 0.25, 0.03, EDGE);
    slab(name, x0, x1, z0, z1, 0.05, PATH);
  };
  // Entrance path from the front door out to the park loop.
  path("entrance", -1.8, 1.8, -34, -15);
  // Loop around the building.
  path("loop_front", -40, 40, -36, -33);
  path("loop_back", -40, 40, 29, 32);
  path("loop_left", -42, -39, -36, 32);
  path("loop_right", 39, 42, -36, 32);
  // Spur out to the pond and the gazebo.
  path("spur_pond", 42, 58, 8, 11);
  path("spur_gazebo", -58, -42, -22, -19);
  // Stone apron in front of the doors and the forecourt plaza.
  slab("apron", -4.5, 4.5, -23, -15, 0.06, "#e9e4d6");
  slab("plaza", -26, -10, -30, -17, 0.06, "#e4dfd0");

  // ----- Props -----
  const tree = (x: number, z: number, scale = 1, leaf = "#3f7a44", top = "#4f8a4a"): void => {
    const tag = `tree_${x.toFixed(1)}_${z.toFixed(1)}`;
    box(`${tag}_trunk`, 0.45 * scale, 1.3 * scale, 0.45 * scale, x, 0.65 * scale, z, "#7a4f2a");
    box(`${tag}_leaves`, 1.7 * scale, 1.5 * scale, 1.7 * scale, x, 1.9 * scale, z, leaf);
    box(`${tag}_top`, 1.1 * scale, 0.8 * scale, 1.1 * scale, x, 3.0 * scale, z, top);
  };

  const lamppost = (x: number, z: number): void => {
    const tag = `lamp_${x}_${z}`;
    box(`${tag}_post`, 0.2, 3.0, 0.2, x, 1.5, z, "#2f3340");
    box(`${tag}_arm`, 0.7, 0.12, 0.12, x + 0.35, 2.95, z, "#2f3340");
    const head = box(`${tag}_head`, 0.45, 0.2, 0.45, x + 0.7, 2.85, z, "#ffe6a8");
    (head.material as StandardMaterial).emissiveColor = Color3.FromHexString("#ffd066");
  };

  /** Park bench facing -z (the seat back is on the +z side). */
  const bench = (x: number, z: number): void => {
    const tag = `bench_${x}_${z}`;
    box(`${tag}_seat`, 2.0, 0.14, 0.6, x, 0.5, z, "#7a4f2a");
    box(`${tag}_back`, 2.0, 0.55, 0.1, x, 0.85, z + 0.28, "#7a4f2a");
    box(`${tag}_l`, 0.15, 0.45, 0.5, x - 0.8, 0.25, z, "#2f3340");
    box(`${tag}_r`, 0.15, 0.45, 0.5, x + 0.8, 0.25, z, "#2f3340");
  };

  const flowerBed = (x: number, z: number, w: number, d: number, colours: string[]): void => {
    const tag = `bed_${x}_${z}`;
    box(`${tag}_soil`, w, 0.12, d, x, 0.06, z, "#5a4636");
    let i = 0;
    for (let fx = -w / 2 + 0.4; fx <= w / 2 - 0.3; fx += 0.7) {
      for (let fz = -d / 2 + 0.4; fz <= d / 2 - 0.3; fz += 0.7) {
        box(`${tag}_f${i}`, 0.3, 0.35, 0.3, x + fx, 0.3, z + fz, colours[i % colours.length]);
        i++;
      }
    }
  };

  const rock = (x: number, z: number, s = 1): void => {
    box(`rock_${x}_${z}_a`, 0.9 * s, 0.5 * s, 0.9 * s, x, 0.25 * s, z, "#8a8576");
    box(`rock_${x}_${z}_b`, 0.5 * s, 0.35 * s, 0.5 * s, x + 0.4 * s, 0.18 * s, z + 0.2 * s, "#9a958a");
  };

  // Water feature on the forecourt plaza.
  {
    const px = -18;
    const pz = -23.5;
    box("fountain_base", 6, 0.3, 6, px, 0.2, pz, "#9a9486");
    box("fountain_rim", 5.6, 0.45, 5.6, px, 0.35, pz, "#d9d4c7");
    box("fountain_water", 4.8, 0.1, 4.8, px, 0.58, pz, "#5fa8d6");
    box("fountain_stone", 1.0, 1.1, 1.0, px, 1.0, pz, "#d9d4c7");
    box("fountain_spray", 0.4, 0.5, 0.4, px, 1.7, pz, "#cfe7ff");
  }

  // Brass-and-navy monolith announcing the tenant, facing the path.
  {
    const mx = 7;
    const mz = -21;
    box("mono_base", 5.2, 0.5, 1.3, mx, 0.25, mz, "#d9d4c7");
    const slabMesh = box("mono_slab", 4.8, 2.4, 0.35, mx, 1.7, mz, "#1f2d4a");
    paint(scene, slabMesh, 768, 360, (ctx) => {
      ctx.fillStyle = "#1f2d4a";
      ctx.fillRect(0, 0, 768, 360);
      ctx.fillStyle = "#c9a14a";
      ctx.fillRect(40, 36, 688, 6);
      ctx.fillRect(40, 318, 688, 6);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#e7c872";
      ctx.font = "bold 112px sans-serif";
      ctx.fillText("CALDOVA", 384, 120);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 70px sans-serif";
      ctx.fillText("WEALTH", 384, 208);
      ctx.fillStyle = "#b9c4dd";
      ctx.font = "34px sans-serif";
      ctx.fillText("SUPER & WEALTH MANAGEMENT  ·  LEVEL 12", 384, 272);
    });
  }

  // Hedges framing the entrance path and the forecourt.
  for (const [x, z, w, d] of [
    [-7.5, -19.5, 6, 1.2],
    [-7.5, -27, 6, 1.2],
  ] as const) {
    box(`hedge_${x}_${z}_base`, w, 0.4, d, x, 0.2, z, "#9a9486");
    box(`hedge_${x}_${z}`, w - 0.2, 0.8, d - 0.2, x, 0.8, z, "#3f7a44");
  }
  for (const x of [-26, -10, 14, 26]) bench(x, -30.8);

  // Lampposts along the entrance path and the loop.
  for (const z of [-18, -26, -31]) {
    lamppost(-3.4, z);
    lamppost(3.4, z);
  }
  for (const x of [-34, -20, 20, 34]) lamppost(x, -37.5);
  for (const z of [-20, 0, 20]) {
    lamppost(-43.5, z);
    lamppost(43.5, z);
  }

  // Flower beds beside the path and the plaza.
  flowerBed(-12, -38.8, 8, 1.6, ["#e8504c", "#ffd166", "#f4a3c7", "#f0f0f0"]);
  flowerBed(12, -38.8, 8, 1.6, ["#b56fbf", "#ffd166", "#f0f0f0", "#e8504c"]);
  flowerBed(-31.5, -26, 1.6, 8, ["#ffd166", "#f4a3c7", "#f0f0f0"]);
  flowerBed(-36, 12, 1.6, 8, ["#e8504c", "#f0f0f0", "#b56fbf"]);
  flowerBed(36, -4, 1.6, 8, ["#f4a3c7", "#ffd166", "#e8504c"]);
  flowerBed(-12, 34, 8, 1.6, ["#ffd166", "#b56fbf", "#f0f0f0"]);
  flowerBed(12, 34, 8, 1.6, ["#e8504c", "#f4a3c7", "#ffd166"]);

  // Benches along the loop paths.
  for (const [x, z] of [
    [-24, -38],
    [24, -38],
    [-37, -4],
    [-37, 16],
    [37, -10],
    [-24, 28],
    [24, 28],
  ] as const) {
    bench(x, z);
  }

  // ----- Pond with a jetty and ducks (right side) -----
  {
    const cx = 62;
    const cz = 20;
    box("pond_bank", 24, 0.12, 20, cx, 0.06, cz, "#c8b88a");
    box("pond_a", 22, 0.16, 16, cx, 0.1, cz, "#5fa8d6");
    box("pond_b", 18, 0.17, 19, cx + 1, 0.1, cz, "#5fa8d6");
    box("pond_deep", 12, 0.18, 10, cx, 0.1, cz, "#4a93c4");
    // Jetty reaching out from the spur path.
    box("jetty", 8, 0.2, 1.8, cx - 12, 0.3, 9.5, "#8a6240");
    for (let i = 0; i < 4; i++) {
      box(`jetty_post_${i}`, 0.2, 0.6, 0.2, cx - 15 + i * 2.2, 0.2, 8.5, "#5a3d2b");
      box(`jetty_post_b_${i}`, 0.2, 0.6, 0.2, cx - 15 + i * 2.2, 0.2, 10.5, "#5a3d2b");
    }
    // Reeds and lily pads.
    for (const [rx, rz] of [[-10, -8], [-9, 6], [10, -9], [12, 7], [0, -9.8]] as const) {
      box(`reed_${rx}_${rz}`, 0.2, 1.0, 0.2, cx + rx, 0.6, cz + rz, "#5d8a3a");
      box(`reed_b_${rx}_${rz}`, 0.2, 0.8, 0.2, cx + rx + 0.35, 0.5, cz + rz + 0.2, "#4f7a32");
    }
    for (const [lx, lz] of [[-3, 2], [3, -3], [5, 4], [-5, -4]] as const) {
      box(`lily_${lx}_${lz}`, 0.9, 0.03, 0.9, cx + lx, 0.2, cz + lz, "#3f8a44");
    }
  }

  // ----- Gazebo (left side, at the end of its spur) -----
  {
    const gx = -52;
    const gz = -20.5;
    box("gazebo_floor", 6.4, 0.3, 6.4, gx, 0.15, gz, "#d9d3c1");
    for (const [dx, dz] of [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]] as const) {
      box(`gazebo_post_${dx}_${dz}`, 0.3, 3.0, 0.3, gx + dx, 1.8, gz + dz, "#f4f0e6");
    }
    box("gazebo_roof_a", 7.2, 0.3, 7.2, gx, 3.45, gz, "#2f7d3a");
    box("gazebo_roof_b", 4.8, 0.5, 4.8, gx, 3.85, gz, "#2f7d3a");
    box("gazebo_roof_c", 2.2, 0.6, 2.2, gx, 4.3, gz, "#e8b84a");
    bench(gx, gz + 2.0);
  }

  // ----- Picnic area (back left) -----
  {
    const px = -52;
    const pz = 18;
    box("picnic_rug", 5, 0.04, 4, px, 0.04, pz, "#c0392b");
    box("picnic_rug_b", 4.4, 0.05, 3.4, px, 0.045, pz, "#f4f0e6");
    box("picnic_basket", 0.8, 0.5, 0.6, px + 0.4, 0.3, pz, "#a06a4c");
    for (const [dx, dz] of [[-1.6, -1], [1.6, 1]] as const) {
      box(`picnic_cushion_${dx}`, 0.9, 0.2, 0.9, px + dx, 0.15, pz + dz, "#3a8fd6");
    }
    // Wooden picnic table
    box("table_top", 3.0, 0.15, 1.2, px + 7, 0.95, pz - 1, "#8a6240");
    box("table_bench_a", 3.0, 0.12, 0.45, px + 7, 0.55, pz - 2.1, "#7a4f2a");
    box("table_bench_b", 3.0, 0.12, 0.45, px + 7, 0.55, pz + 0.1, "#7a4f2a");
    for (const dx of [-1.2, 1.2]) box(`table_leg_${dx}`, 0.2, 0.9, 1.6, px + 7 + dx, 0.45, pz - 1, "#5a3d2b");
  }

  // ----- Trees -----
  // Deterministic scatter so the park looks the same on every load. Trees are
  // kept off the office footprint, the paths and the pond, and are thinner
  // on the camera-facing front-right side.
  let seed = 7;
  const rand = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const clear = (x: number, z: number): boolean => {
    if (x > -36 && x < 36 && z > -40 && z < 36) return false; // office + loop paths
    if (x > 42 && x < 90 && z > 2 && z < 40) return false; // pond
    if (x < -44 && x > -60 && z > -26 && z < -14) return false; // gazebo
    if (x < -44 && x > -66 && z > 12 && z < 24) return false; // picnic
    if (x > 42 && x < 60 && z > 6 && z < 13) return false; // pond spur
    if (x < -42 && x > -60 && z > -23 && z < -18) return false; // gazebo spur
    return true;
  };
  const palettes: Array<[string, string]> = [
    ["#3f7a44", "#4f8a4a"],
    ["#4a8a3c", "#5a9a4a"],
    ["#2f6a3a", "#3f7a44"],
    ["#6b9a3a", "#7aaa48"],
    ["#c8782a", "#d98a3a"], // a few autumn trees
  ];
  let placed = 0;
  let attempts = 0;
  while (placed < 150 && attempts < 2000) {
    attempts++;
    const x = -110 + rand() * 220;
    const z = -80 + rand() * 170;
    if (!clear(x, z)) continue;
    // Front-right (the camera side): keep it sparse and low.
    const frontRight = x > 10 && z < -38;
    if (frontRight && rand() < 0.7) continue;
    const [leaf, top] = palettes[Math.floor(rand() * (palettes.length - (rand() < 0.8 ? 1 : 0)))];
    tree(x, z, (frontRight ? 0.8 : 0.9) + rand() * 0.5, leaf, top);
    placed++;
  }
  // A few hand-placed specimen trees framing the entrance.
  tree(-6, -37, 1.1);
  tree(6, -37, 1.1);
  tree(-31, -20, 1.0);
  tree(31, -20, 1.0);

  rock(-48, -8, 1.2);
  rock(46, -12, 1.0);
  rock(-46, 30, 1.1);
  rock(36, 38, 0.9);

  // ----- Strollers and joggers on the paths -----
  const root = new TransformNode("park_ambient_root", scene);
  const ambient = new NeighbourhoodAmbient(scene, root);
  const walkers: Array<[string, "cityCommuter" | "cityStudent" | "cityJogger", [number, number][], number]> = [
    ["front_a", "cityCommuter", [[-36, -34.5], [-12, -34.5], [-12, -34.5], [-36, -34.5]], 1.1],
    ["front_b", "cityStudent", [[36, -34.5], [14, -34.5], [14, -34.5], [36, -34.5]], 1.0],
    ["entrance_a", "cityCommuter", [[-0.8, -33], [-0.8, -22], [-0.8, -22], [-0.8, -33]], 1.2],
    ["jogger_a", "cityJogger", [[-40.5, -34.5], [40.5, -34.5], [40.5, 30.5], [-40.5, 30.5]], 2.4],
    ["left_a", "cityStudent", [[-40.5, -14], [-40.5, 22], [-40.5, 22], [-40.5, -14]], 1.0],
    ["right_a", "cityCommuter", [[40.5, 22], [40.5, -14], [40.5, -14], [40.5, 22]], 1.1],
  ];
  for (const [id, palette, route, speed] of walkers) {
    ambient.addPedestrian(`park_${id}`, palette, route, speed);
  }

  scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(0.1, scene.getEngine().getDeltaTime() / 1000);
    ambient.update(dt);
  });
}

/** Bake a drawing onto a box mesh (the -z face carries the readable text). */
function paint(
  scene: Scene,
  mesh: Mesh,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): void {
  const tex = new DynamicTexture(`park_tex_${mesh.name}`, { width: w, height: h }, scene, false);
  draw(tex.getContext() as unknown as CanvasRenderingContext2D);
  tex.update();
  const m = new StandardMaterial(`park_texmat_${mesh.name}`, scene);
  m.diffuseTexture = tex;
  m.specularColor = new Color3(0.05, 0.05, 0.05);
  m.emissiveColor = new Color3(0.2, 0.2, 0.2);
  mesh.material = m;
}
