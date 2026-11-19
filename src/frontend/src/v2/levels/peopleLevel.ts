/**
 * Level 2 · The People — the eight-person Caldova Client Operations team at
 * standing desks: the Superannuation Team on the front row, and Theo with
 * the Wealth Management Team on the back row. Every desk sits directly
 * above that person's agent pod on Level 1, so the thread between a person
 * and their agent runs straight down through the floor.
 */
import { Color3, Mesh, MeshBuilder, TransformNode } from "@babylonjs/core";
import { PALETTES } from "../../characterPalettes";
import { STAFF_PERSONAS } from "../../personaData";
import { VoxelCharacter } from "../../voxelCharacter";
import { Batch, Kit } from "../kit";
import { IDEA, levelInfo } from "../lakehouseData";
import { CHARACTER_SCALE, FLOOR_Y, SLABS, STATIONS, WALLS } from "../layout";
import { buildShell } from "../shell";
import type { Anchor, Highlights, LevelBuild } from "../types";

const CORAL = Color3.FromHexString("#ff8f6b");

interface Leg {
  x: number;
  z: number;
  pause: number;
  face?: number;
}

/** Walks a character round a loop of waypoints, pausing at some of them. */
class Walker {
  private i = 0;
  private wait: number;

  constructor(
    private readonly ch: VoxelCharacter,
    private readonly path: Leg[],
  ) {
    this.wait = path[0].pause;
  }

  update(dt: number): void {
    const root = this.ch.root;
    if (this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        this.i = (this.i + 1) % this.path.length;
        this.ch.setWalking(true);
      }
      return;
    }
    const target = this.path[this.i];
    const dx = target.x - root.position.x;
    const dz = target.z - root.position.z;
    const dist = Math.hypot(dx, dz);
    const step = 2.2 * dt;
    if (dist <= step) {
      root.position.x = target.x;
      root.position.z = target.z;
      if (target.pause > 0) {
        this.wait = target.pause;
        this.ch.setWalking(false);
        if (target.face !== undefined) root.rotation.y = target.face;
      } else {
        this.i = (this.i + 1) % this.path.length;
      }
      return;
    }
    root.position.x += (dx / dist) * step;
    root.position.z += (dz / dist) * step;
    root.rotation.y = Math.atan2(dx, dz);
  }
}

export function buildPeopleLevel(kit: Kit): LevelBuild {
  const scene = kit.scene;
  const root = new TransformNode("v2_lvl_people", scene);
  const batch = new Batch(kit, root, "people");
  kit.useBatch(batch);
  const y = FLOOR_Y.people;
  const info = levelInfo("people");

  const oak = kit.mat("#fff4e2", { texture: "oak" });
  const cedar = kit.mat("#ffffff", { texture: "cedar" });
  const walnut = kit.mat("#ffffff", { texture: "walnut" });
  const white = kit.mat("#f4f1ea");
  const steel = kit.mat("#2b3240", { specular: 0.25 });
  const leaf = kit.mat("#5ea347");
  const leafDark = kit.mat("#3f7f3a");
  const pot = kit.mat("#d8d2c6");
  buildShell(kit, { root, level: info, floorY: y, slab: SLABS.people, walls: WALLS.people, floor: oak, back: cedar });

  // Team rugs and floor lettering.
  kit.block(root, 0, y, -6.1, 36.5, 0.05, 7.0, kit.mat("#d3efe9"));
  kit.block(root, 0, y, 3.5, 36.5, 0.05, 7.0, kit.mat("#f4e9cc"));
  const floorText = (text: string, x: number, z: number, width: number, color: string): void => {
    const decal = kit.label(root, {
      lines: [{ text, size: 60, weight: 800, color }],
      width,
      px: 1024,
      pxHeight: 100,
    });
    decal.rotation.x = Math.PI / 2;
    decal.position.set(x, y + 0.07, z);
  };
  floorText("SUPERANNUATION TEAM", 0, -8.9, 13, "#0f766e");
  floorText("WEALTH MANAGEMENT TEAM", 4.5, 1.05, 12, "#8a6a1f");
  floorText("LEADING BOTH TEAMS", -13.5, 1.05, 6.5, "#0f766e");

  // The process board on the back wall.
  const process = kit.canvas("v2_processBoard", 1024, 300, (ctx, w, h) => {
    ctx.fillStyle = "#0f1a2e";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#ffc35a";
    ctx.font = '800 44px "Segoe UI", sans-serif';
    ctx.fillText("OUR PROCESS", 40, 66);
    const colW = (w - 80) / IDEA.lifecycle.length;
    IDEA.lifecycle.forEach((step, i) => {
      const x = 40 + i * colW;
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(x, 104, colW - 18, 150);
      ctx.fillStyle = ["#0ea5e9", "#ef4444", "#6366f1", "#a855f7", "#ec4899"][i];
      ctx.fillRect(x, 104, colW - 18, 10);
      ctx.fillStyle = "#ffffff";
      ctx.font = '800 64px "Segoe UI", sans-serif';
      ctx.fillText(String(i + 1), x + 18, 194);
      ctx.font = '700 34px "Segoe UI", sans-serif';
      ctx.fillText(step, x + 18, 238);
    });
  });
  const board = MeshBuilder.CreatePlane("v2_processBoardPlane", { width: 11, height: 3.2 }, scene);
  board.position.set(1, y + 2.7, WALLS.people.z1 - 0.2);
  kit.finish(board, root, kit.screen(process));

  /* ---------------- Desks and the team ---------------- */
  const deskTop = kit.mat("#f8f4ec");
  const laptop = kit.mat("#c7ccd6", { specular: 0.4 });
  const dark = kit.mat("#1f2937");
  const paper = kit.mat("#ffffff");
  const characters = new Map<string, VoxelCharacter>();
  const anchors = new Map<string, Anchor>();
  for (const p of STAFF_PERSONAS) {
    const st = STATIONS[p.id];
    if (!st) continue;
    const dz = st.z - 0.4;
    const accent = kit.mat(p.color);
    kit.block(root, st.x, y + 1.5, dz, 3.6, 0.12, 1.3, deskTop);
    kit.block(root, st.x - 1.65, y, dz, 0.14, 1.5, 1.2, white);
    kit.block(root, st.x + 1.65, y, dz, 0.14, 1.5, 1.2, white);
    kit.block(root, st.x, y + 0.3, dz - 0.62, 3.3, 1.1, 0.06, accent);
    const tag = kit.label(root, {
      lines: [
        { text: p.name.toUpperCase(), size: 62, weight: 800 },
        { text: p.department, size: 32, weight: 600, color: "#e6ecf5" },
      ],
      width: 3.0,
      px: 512,
      bg: "rgba(10,18,34,0.8)",
      accent: p.color,
      bar: "top",
    });
    tag.position.set(st.x, y + 0.86, dz - 0.67);
    // Laptop: the lid faces the person, so the camera sees its back.
    const top = y + 1.62;
    kit.block(root, st.x - 0.3, top, dz + 0.1, 0.95, 0.05, 0.62, laptop);
    const lid = kit.block(root, st.x - 0.3, top, dz - 0.22, 0.95, 0.64, 0.05, laptop);
    lid.rotation.x = -0.22;
    // A desk prop that says something about the role.
    const px = st.x + 1.05;
    switch (p.id) {
      case "onboarding-1":
        kit.block(root, px, top, dz, 0.9, 0.12, 0.7, dark);
        for (let i = 0; i < 4; i++) kit.block(root, px, top + 0.12 + i * 0.05, dz, 0.75, 0.04, 0.55, paper);
        break;
      case "benefits-1":
        ["#6366f1", "#0ea5e9", "#f59e0b"].forEach((hex, i) =>
          kit.block(root, px, top + i * 0.2, dz, 0.8, 0.18, 0.6, kit.mat(hex)),
        );
        break;
      case "transfers-1":
        kit.cyl(root, px, top, dz, 0.2, 0.25, steel, { tess: 8 });
        kit.block(root, px, top + 0.25, dz, 0.55, 0.55, 0.55, kit.mat("#38bdf8"));
        kit.block(root, px, top + 0.4, dz, 0.6, 0.25, 0.6, kit.mat("#34d399"));
        break;
      case "payments-1":
        kit.block(root, px, top, dz, 0.6, 0.12, 0.8, dark);
        kit.block(root, px, top + 0.12, dz - 0.18, 0.45, 0.03, 0.3, kit.mat("#a7f3d0", { unlit: true }));
        break;
      case "investments-1":
        [0.3, 0.55, 0.42, 0.75].forEach((h, i) =>
          kit.block(root, px - 0.3 + i * 0.2, top, dz, 0.15, h, 0.3, kit.mat(i === 3 ? "#f59e0b" : "#fcd34d")),
        );
        break;
      case "comms-1":
        kit.block(root, px, top, dz, 0.12, 0.45, 0.12, steel);
        kit.block(root, px, top + 0.45, dz, 0.7, 0.12, 0.16, dark);
        kit.block(root, px - 0.32, top + 0.25, dz, 0.16, 0.28, 0.28, kit.mat("#ec4899"));
        kit.block(root, px + 0.32, top + 0.25, dz, 0.16, 0.28, 0.28, kit.mat("#ec4899"));
        break;
      case "fincrime-1":
        kit.block(root, px, top, dz, 0.7, 0.04, 0.9, paper);
        kit.cyl(root, px + 0.1, top + 0.06, dz - 0.1, 0.5, 0.06, kit.mat("#bfe6ff", { specular: 0.8 }), { tess: 16 });
        kit.block(root, px + 0.4, top + 0.06, dz + 0.22, 0.4, 0.08, 0.1, dark, { rotY: 0.7 });
        break;
      case "lead-1":
        kit.block(root, st.x + 1.1, top, dz + 0.15, 0.14, 0.9, 0.14, steel);
        kit.block(root, st.x + 1.1, top + 0.9, dz + 0.1, 1.3, 0.8, 0.08, dark);
        kit.block(root, st.x + 1.1, top + 0.98, dz + 0.05, 1.12, 0.62, 0.02, kit.mat("#14b8a6", { unlit: true }));
        break;
    }
    const ch = new VoxelCharacter(scene, p.id, PALETTES[p.palette]);
    ch.root.parent = root;
    ch.root.scaling.setAll(CHARACTER_SCALE);
    ch.root.position.set(st.x, y, st.z + 0.75);
    ch.root.rotation.y = Math.PI;
    characters.set(p.id, ch);
    anchors.set(`staff:${p.id}`, { node: ch.root, group: "people", dy: 2.5 });
  }

  /* ---------------- Coffee bar, lounge corner and plants ---------------- */
  kit.block(root, 19.4, y, 1, 2.0, 1.5, 7.0, walnut);
  kit.block(root, 19.4, y + 1.5, 1, 2.3, 0.1, 7.3, white);
  kit.block(root, 19.7, y + 1.6, 3.4, 0.9, 1.1, 0.8, dark);
  kit.block(root, 19.24, y + 2.1, 3.4, 0.06, 0.2, 0.4, kit.mat("#ffc35a", { unlit: true, glow: true }));
  for (const z of [-1.2, 1.0, 3.2]) {
    kit.cyl(root, 17.7, y, z, 0.14, 1.0, steel, { tess: 8 });
    kit.cyl(root, 17.7, y + 1.0, z, 0.75, 0.14, kit.mat("#ff8f6b"), { tess: 12 });
  }
  kit.block(root, -18.6, y, -2.4, 1.5, 0.8, 1.5, kit.mat("#ff8f6b"));
  kit.block(root, -18.8, y, -0.4, 1.5, 0.8, 1.5, kit.mat("#14b8a6"));
  for (const [x, z] of [[-20.2, -12.2], [20.2, -12.2], [20.2, 8.2], [-16, 8.2]] as const) {
    kit.block(root, x, y, z, 0.9, 0.8, 0.9, pot);
    kit.block(root, x, y + 0.8, z, 1.2, 1.1, 1.2, leaf);
    kit.block(root, x + 0.15, y + 1.8, z - 0.1, 0.7, 0.7, 0.7, leafDark);
  }

  /* ---------------- The idea drops in (chapter intro) ---------------- */
  const sparkMat = kit.mat("#ffd98a", { unlit: true, glow: true });
  const sparks: Mesh[] = STAFF_PERSONAS.map(() => {
    const m = kit.block(root, 0, 0, 0, 0.42, 0.42, 0.42, sparkMat, { dynamic: true });
    m.setEnabled(false);
    return m;
  });

  kit.useBatch(null);
  batch.flush();

  const theo = characters.get("lead-1");
  const walker = theo
    ? new Walker(theo, [
        { x: -13.5, z: 4.25, pause: 9, face: Math.PI },
        { x: -10.8, z: 4.25, pause: 0 },
        { x: -10, z: 0.6, pause: 0 },
        { x: -1, z: -2.2, pause: 0 },
        { x: 8, z: -2.2, pause: 3.5, face: Math.PI },
        { x: -1, z: -2.2, pause: 0 },
        { x: -10, z: 0.6, pause: 0 },
        { x: -10.8, z: 4.25, pause: 0 },
      ])
    : null;

  let selected: ReadonlySet<string> = new Set();
  const flash = new Map<string, number>();
  let introT = -1;
  const ids = STAFF_PERSONAS.map((p) => p.id);
  const phases = ids.map((_, i) => i * 1.3);

  const applyHighlight = (id: string): void => {
    characters.get(id)?.setHighlight(selected.has(id) || (flash.get(id) ?? 0) > 0, CORAL);
  };

  return {
    id: "people",
    root,
    anchors,
    update(dt: number, t: number): void {
      walker?.update(dt);
      ids.forEach((id, i) => {
        const ch = characters.get(id);
        if (!ch) return;
        ch.update(dt);
        if (id !== "lead-1") ch.root.rotation.y = Math.PI + Math.sin(t * 0.6 + phases[i]) * 0.14;
        const f = flash.get(id);
        if (f !== undefined) {
          const left = f - dt;
          if (left <= 0) flash.delete(id);
          else flash.set(id, left);
          applyHighlight(id);
        }
      });
      if (introT >= 0) {
        introT += dt;
        let running = false;
        ids.forEach((id, i) => {
          const spark = sparks[i];
          const ch = characters.get(id);
          const local = (introT - i * 0.14) / 1.3;
          if (!ch || local < 0 || local > 1) {
            if (local > 1 && spark.isEnabled()) {
              spark.setEnabled(false);
              flash.set(id, 1.1);
              applyHighlight(id);
            }
            if (local <= 1) running = true;
            return;
          }
          running = true;
          spark.setEnabled(true);
          const e = local * local * (3 - 2 * local);
          const tx = ch.root.position.x;
          const tz = ch.root.position.z;
          spark.position.set(-5 + (tx + 5) * e, y + 5.2 - 2.4 * e + Math.sin(Math.PI * e) * 1.2, -2 + (tz + 2) * e);
          spark.rotation.y = t * 4;
        });
        if (!running) introT = -1;
      }
    },
    setHighlights(h: Highlights): void {
      selected = h.staff;
      ids.forEach(applyHighlight);
    },
    intro(): void {
      introT = 0;
    },
  };
}
