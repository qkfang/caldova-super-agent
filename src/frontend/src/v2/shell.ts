/**
 * The building shell shared by every level: floor slab with a glowing edge
 * strip in the level's accent, glass curtain walls on the lake and right
 * sides, solid timber and concrete walls at the back and left, the lift
 * core, and the floating level tag.
 */
import { Mesh, StandardMaterial, TransformNode } from "@babylonjs/core";
import type { Kit } from "./kit";
import type { LevelInfo } from "./lakehouseData";
import { CORE, SLAB, STOREY, type Rect } from "./layout";

export type Side = "front" | "right" | "left" | "back";

export interface ShellSpec {
  root: TransformNode;
  level: LevelInfo;
  floorY: number;
  slab: Rect;
  walls: Rect;
  /** Floor finish on top of the slab. */
  floor: StandardMaterial;
  /** Inside finish of the back wall. */
  back: StandardMaterial;
  /** Glass sides (default front and right); the others are solid. */
  glass?: Side[];
  /** Sides with no wall at all. */
  open?: Side[];
  core?: boolean;
  height?: number;
  /** Where the floating level tag goes (default: beside the slab's front-left corner). */
  tagAt?: [number, number, number];
}

export function buildShell(kit: Kit, s: ShellSpec): { tag: Mesh } {
  const { root, floorY: y, slab, walls, level } = s;
  const h = s.height ?? STOREY;
  const concrete = kit.mat("#ffffff", { texture: "concrete" });
  const steel = kit.mat("#2b3240", { specular: 0.25 });
  const glass = kit.mat("#bfe6ff", { alpha: 0.2, specular: 0.25 });
  const led = kit.mat(level.accent, { unlit: true, glow: true });

  // Slab, floor finish and the glowing edge strip.
  const sw = slab.x1 - slab.x0;
  const sd = slab.z1 - slab.z0;
  const scx = (slab.x0 + slab.x1) / 2;
  const scz = (slab.z0 + slab.z1) / 2;
  kit.block(root, scx, y - SLAB, scz, sw, SLAB - 0.06, sd, concrete);
  kit.block(root, scx, y - 0.06, scz, sw - 0.08, 0.06, sd - 0.08, s.floor);
  const ledY = y - SLAB * 0.6;
  kit.block(root, scx, ledY, slab.z0 - 0.04, sw + 0.12, 0.12, 0.08, led);
  kit.block(root, slab.x1 + 0.04, ledY, scz, 0.08, 0.12, sd + 0.12, led);
  kit.block(root, slab.x0 - 0.04, ledY, scz, 0.08, 0.12, sd + 0.12, led);

  // Walls.
  const glassSides = new Set<Side>(s.glass ?? ["front", "right"]);
  const open = new Set<Side>(s.open ?? []);
  const ww = walls.x1 - walls.x0;
  const wd = walls.z1 - walls.z0;
  const wcx = (walls.x0 + walls.x1) / 2;
  const wcz = (walls.z0 + walls.z1) / 2;
  const t = 0.3;

  const glassAlongX = (z: number): void => {
    kit.block(root, wcx, y + 0.12, z, ww, h - 0.24, 0.08, glass);
    kit.block(root, wcx, y, z, ww, 0.14, 0.18, steel);
    kit.block(root, wcx, y + h - 0.14, z, ww, 0.14, 0.18, steel);
    const n = Math.max(1, Math.round(ww / 4));
    for (let i = 0; i <= n; i++) {
      kit.block(root, walls.x0 + (ww * i) / n, y, z, 0.14, h, 0.16, steel);
    }
  };
  const glassAlongZ = (x: number): void => {
    kit.block(root, x, y + 0.12, wcz, 0.08, h - 0.24, wd, glass);
    kit.block(root, x, y, wcz, 0.18, 0.14, wd, steel);
    kit.block(root, x, y + h - 0.14, wcz, 0.18, 0.14, wd, steel);
    const n = Math.max(1, Math.round(wd / 4));
    for (let i = 0; i <= n; i++) {
      kit.block(root, x, y, walls.z0 + (wd * i) / n, 0.16, h, 0.14, steel);
    }
  };

  if (!open.has("back")) {
    if (glassSides.has("back")) glassAlongX(walls.z1);
    else kit.block(root, wcx, y, walls.z1 - t / 2, ww, h, t, s.back);
  }
  if (!open.has("left")) {
    if (glassSides.has("left")) glassAlongZ(walls.x0);
    else kit.block(root, walls.x0 + t / 2, y, wcz, t, h, wd, concrete);
  }
  if (!open.has("front")) {
    if (glassSides.has("front")) glassAlongX(walls.z0);
    else kit.block(root, wcx, y, walls.z0 + t / 2, ww, h, t, concrete);
  }
  if (!open.has("right")) {
    if (glassSides.has("right")) glassAlongZ(walls.x1);
    else kit.block(root, walls.x1 - t / 2, y, wcz, t, h, wd, concrete);
  }

  // Lift core with doors facing into the room and the floor number above them.
  if (s.core !== false) {
    const cw = CORE.x1 - CORE.x0;
    const cd = CORE.z1 - CORE.z0;
    const ccz = (CORE.z0 + CORE.z1) / 2;
    kit.block(root, (CORE.x0 + CORE.x1) / 2, y, ccz, cw, h, cd, concrete);
    const door = kit.mat("#9aa6b8", { specular: 0.5 });
    kit.block(root, CORE.x1 + 0.03, y, ccz - 0.5, 0.06, 2.9, 0.98, door);
    kit.block(root, CORE.x1 + 0.03, y, ccz + 0.5, 0.06, 2.9, 0.98, door);
    kit.block(root, CORE.x1 + 0.04, y + 2.9, ccz, 0.08, 0.16, 2.2, steel);
    const sign = kit.label(root, {
      lines: [{ text: level.floor, size: 120, weight: 800, color: level.accent }],
      width: 0.9,
      px: 160,
      pxHeight: 160,
      bg: "rgba(14,22,38,0.92)",
    });
    sign.position.set(CORE.x1 + 0.08, y + 3.7, ccz);
    sign.rotation.y = -Math.PI / 2;
  }

  // Floating level tag beside the building.
  const tag = kit.label(root, {
    lines: [
      { text: level.floor === "B" ? "LOWER LEVEL" : `LEVEL ${level.floor}`, size: 34, color: level.accent, weight: 700 },
      { text: level.name.toUpperCase(), size: 64, weight: 800, serif: true },
      { text: level.caption, size: 32, color: "#c6d2e6", weight: 500 },
    ],
    width: 8.4,
    px: 640,
    bg: "rgba(12,20,36,0.88)",
    accent: level.accent,
    bar: "top",
    billboard: true,
  });
  if (s.tagAt) tag.position.set(...s.tagAt);
  else tag.position.set(slab.x0 - 5.2, y + 2.6, slab.z0 + 4);
  return { tag };
}
