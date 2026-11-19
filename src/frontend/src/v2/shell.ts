/**
 * The building shell shared by every level: floor slab with a glowing edge
 * strip in the level's accent, solid timber and concrete walls at the back
 * and left, open sides onto the lake and the right (no glass, so nothing
 * blurs the view in) with a slim corner column and, on raised floors, a
 * steel guard rail, the lift core, and the floating level tag.
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
  /** Sides with no wall (default: the lake side and the right). */
  open?: Side[];
  /** A steel guard rail along the open sides, for raised floors. */
  rail?: boolean;
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
  const led = kit.mat(level.accent, { unlit: true });

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

  // Walls: solid at the back and left, open to the lake and the right.
  const open = new Set<Side>(s.open ?? ["front", "right"]);
  const ww = walls.x1 - walls.x0;
  const wd = walls.z1 - walls.z0;
  const wcx = (walls.x0 + walls.x1) / 2;
  const wcz = (walls.z0 + walls.z1) / 2;
  const t = 0.3;
  if (!open.has("back")) kit.block(root, wcx, y, walls.z1 - t / 2, ww, h, t, s.back);
  if (!open.has("left")) kit.block(root, walls.x0 + t / 2, y, wcz, t, h, wd, concrete);
  if (!open.has("front")) kit.block(root, wcx, y, walls.z0 + t / 2, ww, h, t, concrete);
  if (!open.has("right")) kit.block(root, walls.x1 - t / 2, y, wcz, t, h, wd, concrete);
  // A slim column holds up the open corner.
  if (open.has("front") && open.has("right")) kit.block(root, walls.x1 - 0.2, y, walls.z0 + 0.2, 0.32, h, 0.32, steel);

  if (s.rail) {
    const posts = (n: number, at: (f: number) => [number, number]): void => {
      for (let i = 0; i <= n; i++) {
        const [px, pz] = at(i / n);
        kit.block(root, px, y, pz, 0.1, 1.1, 0.1, steel);
      }
    };
    if (open.has("front")) {
      const z = walls.z0 + 0.12;
      kit.block(root, wcx, y + 1.08, z, ww, 0.08, 0.1, steel);
      kit.block(root, wcx, y + 0.55, z, ww, 0.05, 0.05, steel);
      posts(Math.round(ww / 3), (f) => [walls.x0 + ww * f, z]);
    }
    if (open.has("right")) {
      const x = walls.x1 - 0.12;
      kit.block(root, x, y + 1.08, wcz, 0.1, 0.08, wd, steel);
      kit.block(root, x, y + 0.55, wcz, 0.05, 0.05, wd, steel);
      posts(Math.round(wd / 3), (f) => [x, walls.z0 + wd * f]);
    }
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
    bg: "rgba(12,20,36,0.94)",
    accent: level.accent,
    bar: "top",
    billboard: true,
  });
  // Just in front of the slab's front-left corner, so the side wall never cuts across it.
  if (s.tagAt) tag.position.set(...s.tagAt);
  else tag.position.set(slab.x0 - 5.2, y + 2.6, slab.z0 - 1);
  return { tag };
}
