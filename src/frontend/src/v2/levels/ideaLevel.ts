/**
 * Level 3 · The Idea — Maya Ashworth's office on the top floor, and the roof.
 *
 * Maya is the business owner for both sides of Caldova. The voxel brain
 * floating above the round table is "the idea": one hemisphere for Wealth
 * Management, one for Superannuation, joined by what they share. Goal tiles
 * orbit it, a vision board on the back wall spells out two small teams and
 * one group of agents, and the terrace and balcony give the lakehouse its
 * casual feel.
 */
import { Color3, Mesh, MeshBuilder, TransformNode } from "@babylonjs/core";
import { VoxelCharacter } from "../../voxelCharacter";
import { Batch, Kit, rng } from "../kit";
import { IDEA, OWNER, SIDES, levelInfo } from "../lakehouseData";
import { CHARACTER_SCALE, FLOOR_Y, ROOF, ROOF_Y, SLABS, WALLS, faceAngle } from "../layout";
import { buildShell } from "../shell";
import type { Anchor, Highlights, LevelBuild } from "../types";

const GOLD = Color3.FromHexString("#ffc35a");

export function buildIdeaLevel(kit: Kit): LevelBuild {
  const scene = kit.scene;
  const root = new TransformNode("v2_lvl_idea", scene);
  const batch = new Batch(kit, root, "idea");
  kit.useBatch(batch);
  const y = FLOOR_Y.idea;
  const info = levelInfo("idea");
  const r = rng(3);

  const oak = kit.mat("#ffffff", { texture: "oak" });
  const cedar = kit.mat("#ffffff", { texture: "cedar" });
  const walnut = kit.mat("#ffffff", { texture: "walnut" });
  const white = kit.mat("#f4f1ea");
  const steel = kit.mat("#2b3240", { specular: 0.25 });
  const railGlass = kit.mat("#cfefff", { alpha: 0.22, specular: 0.25 });
  const leaf = kit.mat("#5ea347");
  const leafDark = kit.mat("#3f7f3a");
  const pot = kit.mat("#d8d2c6");
  const { tag } = buildShell(kit, { root, level: info, floorY: y, slab: SLABS.idea, walls: WALLS.idea, floor: oak, back: cedar });

  // Terrace and balcony decking outside the glass, with a glass balustrade.
  kit.block(root, 14.5, y, -2, 12.9, 0.05, 21.9, cedar);
  kit.block(root, -6.5, y, -11.5, 28.9, 0.05, 2.9, cedar);
  const slab = SLABS.idea;
  const balustrade = (x0: number, x1: number, z0: number, z1: number): void => {
    const w = Math.max(0.06, x1 - x0);
    const d = Math.max(0.06, z1 - z0);
    kit.block(root, (x0 + x1) / 2, y, (z0 + z1) / 2, w, 1.1, d, railGlass);
    kit.block(root, (x0 + x1) / 2, y + 1.1, (z0 + z1) / 2, w + 0.06, 0.08, d + 0.06, steel);
  };
  balustrade(slab.x0 + 0.1, slab.x1 - 0.1, slab.z0 + 0.1, slab.z0 + 0.16);
  balustrade(slab.x1 - 0.16, slab.x1 - 0.1, slab.z0 + 0.1, slab.z1 - 0.1);
  balustrade(slab.x0 + 0.1, slab.x0 + 0.16, slab.z0 + 0.1, slab.z1 - 0.1);
  balustrade(slab.x0 + 0.1, slab.x1 - 0.1, slab.z1 - 0.16, slab.z1 - 0.1);

  const plant = (x: number, z: number, s = 1): void => {
    kit.block(root, x, y, z, 0.9 * s, 0.8 * s, 0.9 * s, pot);
    kit.block(root, x, y + 0.8 * s, z, 1.2 * s, 1.0 * s, 1.2 * s, leaf);
    kit.block(root, x + 0.15, y + 1.7 * s, z - 0.1, 0.7 * s, 0.7 * s, 0.7 * s, leafDark);
  };

  /* ---------------- The idea table and the brain ---------------- */
  const tableX = -5;
  const tableZ = -2;
  kit.cyl(root, tableX, y, tableZ, 1.2, 1.0, white, { tess: 20 });
  kit.cyl(root, tableX, y + 1.0, tableZ, 4.8, 0.16, kit.mat("#f8f6f1", { specular: 0.3 }), { tess: 32 });
  const projector = MeshBuilder.CreateTorus("v2_projector", { diameter: 3.4, thickness: 0.12, tessellation: 40 }, scene);
  projector.position.set(tableX, y + 1.24, tableZ);
  kit.finish(projector, root, kit.mat("#ffc35a", { unlit: true, glow: true }), true);
  const beamMat = kit.mat("#ffd98a", { unlit: true, alpha: 0.09 });
  kit.cyl(root, tableX, y + 1.2, tableZ, 3.2, 1.0, beamMat, { top: 2.2, tess: 32, dynamic: true });

  const brain = new TransformNode("v2_brain", scene);
  const brainBatch = new Batch(kit, brain, "brain");
  const prev = kit.useBatch(brainBatch);
  // One idea, two sides: a Wealth Management hemisphere and a Superannuation hemisphere, joined by what they share.
  const hemisphere = (hexes: string[]) => hexes.map((hex) => kit.mat(hex, { emissive: 0.42, glow: true }));
  const wealthMats = hemisphere(["#f2b84b", "#d99a2b", "#ffe1a1"]);
  const superMats = hemisphere(["#2dd4bf", "#14a796", "#a7f3e7"]);
  const sharedMat = kit.mat(SIDES.shared.color, { emissive: 0.5, glow: true });
  const s = 0.3;
  for (let i = -6; i <= 6; i++) {
    for (let j = -4; j <= 4; j++) {
      for (let k = -5; k <= 5; k++) {
        const bx = i * s;
        const by = j * s;
        const bz = k * s;
        const q = (bx * bx) / (1.45 * 1.45) + (by * by) / (1.05 * 1.05) + (bz * bz) / (1.2 * 1.2);
        if (q > 1 || q < 0.6) continue;
        if (i === 0 && j > -2) continue; // the fissure between the hemispheres
        const tone = Math.abs(i * 7 + j * 13 + k * 5) % 3;
        const m = i === 0 ? sharedMat : i < 0 ? wealthMats[tone] : superMats[tone];
        kit.block(brain, bx, by - s / 2, bz, s * 0.9, s * 0.9, s * 0.9, m);
      }
    }
  }
  kit.useBatch(prev);
  brainBatch.flush();
  brain.parent = root;
  brain.position.set(tableX, y + 3.25, tableZ);
  kit.hitbox(root, tableX, y + 1.0, tableZ, 3.6, 3.6, 3.6, { type: "brain" });

  const sparks: Mesh[] = [];
  const sparkMat = kit.mat("#fff4c2", { unlit: true, glow: true });
  for (let i = 0; i < 8; i++) {
    sparks.push(kit.block(brain, 0, 0, 0, 0.16, 0.16, 0.16, sparkMat, { dynamic: true }));
  }

  // Goal tiles orbiting the brain.
  const tiles = new TransformNode("v2_ideaTiles", scene);
  tiles.parent = root;
  tiles.position.set(tableX, y + 3.2, tableZ);
  const tileMeshes = IDEA.goals.map((g, i) => {
    const m = kit.label(tiles, {
      lines: [{ text: g.tile, size: 54, weight: 800, color: "#ffd98a" }],
      width: 3.1,
      px: 420,
      pxHeight: 96,
      bg: "rgba(20,16,40,0.82)",
    });
    m.billboardMode = Mesh.BILLBOARDMODE_ALL;
    const a = (i / IDEA.goals.length) * Math.PI * 2;
    m.position.set(Math.cos(a) * 3.3, 0, Math.sin(a) * 3.3);
    return m;
  });

  const brainRing = MeshBuilder.CreateTorus("v2_brainRing", { diameter: 6.2, thickness: 0.2, tessellation: 48 }, scene);
  brainRing.position.set(tableX, y + 0.12, tableZ);
  kit.finish(brainRing, root, kit.mat("#ffc35a", { unlit: true, glow: true }), true);
  brainRing.setEnabled(false);

  /* ---------------- Maya ---------------- */
  const maya = new VoxelCharacter(scene, OWNER.id, OWNER.palette);
  maya.root.parent = root;
  maya.root.scaling.setAll(CHARACTER_SCALE);
  maya.root.position.set(-1.7, y, 0.3);
  const mayaFacing = faceAngle(0.6, -0.8);
  maya.root.rotation.y = mayaFacing;

  /* ---------------- Maya's desk and the North Star screen ---------------- */
  const deskX = 4;
  const deskZ = 3.6;
  kit.block(root, deskX, y + 1.08, deskZ, 4.4, 0.12, 1.9, walnut);
  kit.block(root, deskX - 2.0, y, deskZ, 0.14, 1.08, 1.7, steel);
  kit.block(root, deskX + 2.0, y, deskZ, 0.14, 1.08, 1.7, steel);
  const dash = kit.canvas("v2_northStar", 512, 300, (ctx, w, h) => {
    ctx.fillStyle = "#0f1a2e";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#ffc35a";
    ctx.font = '800 34px "Segoe UI", sans-serif';
    ctx.fillText("NORTH STAR", 26, 50);
    const bars = [0.86, 0.72, 0.93, 1];
    IDEA.goals.forEach((g, i) => {
      const by = 88 + i * 52;
      ctx.fillStyle = "#c6d2e6";
      ctx.font = '600 24px "Segoe UI", sans-serif';
      ctx.fillText(g.title, 26, by + 20);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(220, by, 260, 26);
      ctx.fillStyle = ["#5ce1ff", "#34d399", "#a78bfa", "#ffc35a"][i];
      ctx.fillRect(220, by, 260 * bars[i], 26);
    });
  });
  const monitor = MeshBuilder.CreatePlane("v2_northStarScreen", { width: 2.3, height: 1.35 }, scene);
  monitor.position.set(deskX, y + 2.05, deskZ - 0.35);
  kit.finish(monitor, root, kit.screen(dash));
  kit.block(root, deskX, y + 1.2, deskZ - 0.3, 2.45, 1.55, 0.06, steel);
  kit.block(root, deskX + 1.5, y + 1.2, deskZ - 0.2, 0.3, 0.32, 0.3, kit.mat("#ffffff"));
  const chairLeather = kit.mat("#1f2d4a");
  kit.block(root, deskX, y + 0.55, deskZ + 1.45, 1.3, 0.25, 1.2, chairLeather);
  kit.block(root, deskX, y + 0.8, deskZ + 2.0, 1.3, 1.4, 0.2, chairLeather);
  kit.cyl(root, deskX, y, deskZ + 1.45, 0.2, 0.55, steel, { tess: 8 });

  /* ---------------- Vision board, bookshelf, lounge ---------------- */
  const board = kit.canvas("v2_visionBoard", 1024, 440, (ctx, w, h) => {
    ctx.fillStyle = "#fbfaf6";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#c9a14a";
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, w - 10, h - 10);
    ctx.fillStyle = "#0f1a2e";
    ctx.font = '700 30px "Segoe UI", sans-serif';
    ctx.fillText(`THE IDEA · ${IDEA.era.toUpperCase()}`, 48, 68);
    ctx.font = '800 72px "Iowan Old Style", "Palatino Linotype", Georgia, serif';
    ctx.fillText(IDEA.name, 48, 150);
    // Two sides and the one group of agents between them.
    const cols = [
      { title: SIDES.wealth.name.toUpperCase(), sub: "a small expert team", color: SIDES.wealth.color },
      { title: "ONE GROUP OF AGENTS", sub: "dedicated + shared", color: SIDES.shared.color },
      { title: SIDES.super.name.toUpperCase(), sub: "a small expert team", color: SIDES.super.color },
    ];
    const colW = (w - 96 - 2 * 24) / 3;
    cols.forEach((c, i) => {
      const x = 48 + i * (colW + 24);
      ctx.fillStyle = c.color;
      ctx.fillRect(x, 196, colW, 132);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillRect(x + 8, 204, colW - 16, 116);
      ctx.fillStyle = "#0f1a2e";
      ctx.font = '800 30px "Segoe UI", sans-serif';
      ctx.fillText(c.title, x + 22, 252, colW - 40);
      ctx.fillStyle = "#53607a";
      ctx.font = '600 26px "Segoe UI", sans-serif';
      ctx.fillText(c.sub, x + 22, 296, colW - 40);
    });
    ctx.fillStyle = "#53607a";
    ctx.font = '600 28px "Segoe UI", sans-serif';
    ctx.fillText("Grounded in Microsoft IQ on Azure · agents recommend, people approve", 48, 392, w - 96);
  });
  const boardPlane = MeshBuilder.CreatePlane("v2_visionBoardPlane", { width: 7.2, height: 3.1 }, scene);
  boardPlane.position.set(-4.2, y + 2.75, WALLS.idea.z1 - 0.32);
  kit.finish(boardPlane, root, kit.screen(board));

  kit.block(root, -13, y, 6.35, 6.6, 3.8, 0.7, walnut);
  const bookTones = ["#c0392b", "#2e86de", "#f1c40f", "#27ae60", "#8e44ad", "#e67e22", "#ecf0f1", "#16a085"].map((hex) =>
    kit.mat(hex),
  );
  for (let shelf = 0; shelf < 4; shelf++) {
    let bx = -16.1;
    while (bx < -10.2) {
      const bw = 0.18 + r() * 0.16;
      const bh = 0.5 + r() * 0.25;
      kit.block(root, bx + bw / 2, y + 0.18 + shelf * 0.9, 5.98, bw, bh, 0.5, bookTones[Math.floor(r() * bookTones.length)]);
      bx += bw + 0.03;
    }
  }

  const sofa = kit.mat("#d9cbb3");
  const cushion = kit.mat("#c9a14a");
  kit.block(root, -15.6, y, -6.2, 7.6, 0.06, 5.6, kit.mat("#efe4cf"));
  kit.block(root, -18.9, y, -6, 1.5, 0.75, 6.2, sofa);
  kit.block(root, -19.5, y + 0.75, -6, 0.4, 0.95, 6.2, sofa);
  kit.block(root, -16.2, y, -8.6, 4.0, 0.75, 1.5, sofa);
  kit.block(root, -16.2, y + 0.75, -9.2, 4.0, 0.95, 0.4, sofa);
  kit.block(root, -18.6, y + 0.75, -4.4, 0.6, 0.6, 1.0, cushion);
  kit.block(root, -15.4, y, -5.4, 2.0, 0.6, 1.4, walnut);
  kit.block(root, -15.4, y + 0.6, -5.2, 0.5, 0.06, 0.7, kit.mat("#ffffff"));
  kit.block(root, -19.2, y, -1.8, 0.14, 2.8, 0.14, steel);
  kit.block(root, -19.2, y + 2.6, -1.8, 0.8, 0.5, 0.8, kit.mat("#ffe7b0", { unlit: true, glow: true }));
  plant(-19.2, 2.2, 1.1);
  plant(7.2, -9.2, 1.0);
  plant(7.2, 6.2, 1.2);

  // Biscuit, the office dog, asleep on her bed.
  const dogFur = kit.mat("#d9a35b");
  const dogDark = kit.mat("#b07a3a");
  kit.cyl(root, -9.2, y, -7.4, 2.0, 0.26, kit.mat("#1f3a5f"), { tess: 20 });
  kit.block(root, -9.3, y + 0.26, -7.4, 1.35, 0.55, 0.62, dogFur);
  kit.block(root, -8.4, y + 0.3, -7.4, 0.55, 0.5, 0.56, dogFur);
  kit.block(root, -8.0, y + 0.32, -7.4, 0.3, 0.24, 0.32, kit.mat("#e9c48a"));
  kit.block(root, -8.45, y + 0.6, -7.68, 0.18, 0.3, 0.1, dogDark);
  kit.block(root, -8.45, y + 0.6, -7.12, 0.18, 0.3, 0.1, dogDark);
  const tail = new TransformNode("v2_dogTail", scene);
  tail.parent = root;
  tail.position.set(-10.0, y + 0.55, -7.4);
  kit.block(tail, -0.32, -0.06, 0, 0.6, 0.12, 0.12, dogFur, { dynamic: true });

  /* ---------------- Terrace and balcony furniture ---------------- */
  const lounger = (x: number, z: number): void => {
    kit.block(root, x, y + 0.3, z, 1.2, 0.2, 2.6, kit.mat("#f4f6fb"));
    const back = kit.block(root, x, y + 0.4, z + 1.25, 1.2, 1.0, 0.16, kit.mat("#f4f6fb"));
    back.rotation.x = 0.55;
    kit.block(root, x, y, z - 1.0, 1.1, 0.3, 0.1, steel);
    kit.block(root, x, y, z + 1.0, 1.1, 0.3, 0.1, steel);
  };
  lounger(11.8, -7.5);
  lounger(14.6, -7.5);
  kit.block(root, 13.2, y, -9.4, 0.8, 0.7, 0.8, white);
  kit.block(root, 18.2, y, -4.6, 0.14, 2.8, 0.14, white);
  kit.cyl(root, 18.2, y + 2.6, -4.6, 3.6, 0.5, kit.mat("#f3e6c4"), { top: 0.3, tess: 10 });
  // Outdoor sofa around a fire table.
  kit.block(root, 13.5, y, 5.8, 5.2, 0.7, 1.3, kit.mat("#b7c4b1"));
  kit.block(root, 13.5, y + 0.7, 6.4, 5.2, 0.8, 0.3, kit.mat("#b7c4b1"));
  kit.block(root, 13.5, y, 3.4, 2.4, 0.6, 1.3, kit.mat("#4b5563"));
  kit.block(root, 13.5, y + 0.6, 3.4, 1.8, 0.12, 0.7, kit.mat("#ff9a3c", { unlit: true, glow: true }));
  // A telescope pointed at the lake.
  kit.block(root, 18.8, y, -11.4, 0.1, 1.5, 0.1, steel, { rotY: 0.4 });
  kit.block(root, 18.5, y, -11.1, 0.1, 1.5, 0.1, steel, { rotY: -0.4 });
  const scope = kit.cyl(root, 18.6, y + 1.5, -11.5, 0.32, 1.6, kit.mat("#e5e7eb"), { tess: 10 });
  scope.rotation.x = -1.15;
  for (const x of [12, 16, 19.6]) {
    kit.block(root, x, y, 8.2, 2.6, 0.7, 0.9, kit.mat("#8b5e3c"));
    kit.block(root, x, y + 0.7, 8.2, 2.4, 0.5, 0.7, leaf);
  }
  for (const z of [-11, -6, -1]) {
    kit.block(root, 20.2, y, z, 0.9, 0.7, 3.2, kit.mat("#8b5e3c"));
    kit.block(root, 20.2, y + 0.7, z, 0.7, 0.6, 3.0, leaf);
  }
  for (const x of [-9.2, -5.8]) {
    kit.block(root, x, y + 0.42, -11.6, 1.1, 0.14, 1.1, kit.mat("#9cc5a1"));
    kit.block(root, x, y + 0.5, -11.05, 1.1, 0.9, 0.12, kit.mat("#9cc5a1"));
    kit.block(root, x, y, -11.6, 0.12, 0.42, 0.12, steel);
  }
  kit.block(root, -7.5, y, -11.7, 0.8, 0.6, 0.8, white);

  kit.useBatch(null);
  batch.flush();

  const anchors = new Map<string, Anchor>([
    ["owner", { node: maya.root, group: "idea", dy: 2.4 }],
    ["brain", { node: brain, group: "idea", dy: 0 }],
  ]);

  let highlight = { owner: false, brain: false };
  let introT = -1;
  return {
    id: "idea",
    root,
    tag,
    anchors,
    update(dt: number, t: number): void {
      maya.update(dt);
      maya.root.rotation.y = mayaFacing + Math.sin(t * 0.5) * 0.12;
      const lit = highlight.brain || introT >= 0;
      if (introT >= 0) {
        introT += dt;
        if (introT > 2.4) introT = -1;
      }
      const pulse = 1 + Math.sin(t * 2.2) * 0.025 + (lit ? 0.07 + Math.sin(t * 6) * 0.03 : 0);
      brain.rotation.y += dt * (lit ? 0.9 : 0.35);
      brain.scaling.setAll(pulse);
      brain.position.y = y + 3.25 + Math.sin(t * 1.1) * 0.12;
      sparks.forEach((sp, i) => {
        const a = t * (1.6 + i * 0.17) + i * 0.8;
        sp.position.set(Math.cos(a) * 0.9, Math.sin(a * 1.3) * 0.55, Math.sin(a) * 0.75);
      });
      tiles.rotation.y = t * 0.25;
      tileMeshes.forEach((m, i) => {
        m.position.y = Math.sin(t * 1.4 + i * 1.6) * 0.25;
      });
      projector.scaling.setAll(1 + Math.sin(t * 3) * 0.04);
      if (brainRing.isEnabled()) brainRing.scaling.setAll(1 + Math.sin(t * 4) * 0.06);
      tail.rotation.y = Math.sin(t * 5) * 0.5;
    },
    setHighlights(h: Highlights): void {
      highlight = { owner: h.owner, brain: h.brain };
      maya.setHighlight(h.owner, GOLD);
      brainRing.setEnabled(h.brain);
    },
    intro(): void {
      introT = 0;
    },
  };
}

/** The roof: a green roof, a skylight over the brain and a solar array. */
export function buildRoof(kit: Kit): TransformNode {
  const scene = kit.scene;
  const root = new TransformNode("v2_roof", scene);
  const batch = new Batch(kit, root, "roof");
  kit.useBatch(batch);
  const y = ROOF_Y;
  const w = ROOF.x1 - ROOF.x0;
  const d = ROOF.z1 - ROOF.z0;
  const cx = (ROOF.x0 + ROOF.x1) / 2;
  const cz = (ROOF.z0 + ROOF.z1) / 2;
  const concrete = kit.mat("#ffffff", { texture: "concrete" });
  kit.block(root, cx, y, cz, w, 0.5, d, concrete);
  kit.block(root, cx, y + 0.15, ROOF.z0 - 0.05, w + 0.1, 0.14, 0.1, kit.mat("#ffc35a", { unlit: true, glow: true }));
  kit.block(root, ROOF.x1 + 0.05, y + 0.15, cz, 0.1, 0.14, d + 0.1, kit.mat("#ffc35a", { unlit: true, glow: true }));
  // Green roof on the left, a skylight over the brain, solar panels on the right.
  kit.block(root, -15.5, y + 0.5, cz, 11.5, 0.18, d - 1.2, kit.mat("#ffffff", { texture: "grass" }));
  kit.block(root, -5, y + 0.5, -2, 5.4, 0.1, 5.4, kit.mat("#cfefff", { alpha: 0.35, specular: 0.8 }));
  const steel = kit.mat("#2b3240", { specular: 0.25 });
  for (const [fx, fz, fw, fd] of [
    [-5, -4.75, 5.6, 0.14],
    [-5, 0.75, 5.6, 0.14],
    [-7.75, -2, 0.14, 5.6],
    [-2.25, -2, 0.14, 5.6],
  ] as const) {
    kit.block(root, fx, y + 0.5, fz, fw, 0.22, fd, steel);
  }
  const panel = kit.mat("#1e3a8a", { specular: 0.7 });
  const frame = kit.mat("#cbd5e1");
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const px = 0.4 + col * 2.2;
      const pz = -9.2 + row * 3.6;
      kit.block(root, px, y + 0.5, pz + 0.6, 0.1, 0.5, 0.1, frame);
      const p = kit.block(root, px, y + 0.8, pz, 2.0, 0.08, 1.4, panel);
      p.rotation.x = -0.32;
    }
  }
  kit.block(root, -12, y + 0.5, 6.2, 1.6, 1.2, 1.6, kit.mat("#9aa6b8"));
  kit.useBatch(null);
  batch.flush();
  return root;
}
