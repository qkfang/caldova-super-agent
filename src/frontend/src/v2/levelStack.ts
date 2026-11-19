/**
 * Arranges the level groups for the three stack modes:
 *  - house: everything in place (the cover);
 *  - focus: the levels above the chosen one lift away and fade out, so the
 *    camera can look straight into it (one chapter per level);
 *  - exploded: the levels are pulled apart so the whole stack, and the
 *    threads between the levels, read at once (the finale).
 */
import type { AbstractMesh, TransformNode } from "@babylonjs/core";
import type { Anchor, GroupId, StackMode } from "./types";

/** Top to bottom. */
export const GROUP_ORDER: GroupId[] = ["roof", "idea", "people", "agents", "engine"];
/** Vertical gap added between levels in the exploded view. */
export const EXPLODE_GAP = 10;
/** How far a level lifts before it has faded out. */
const LIFT = 24;

interface GroupState {
  root: TransformNode;
  offset: number;
  alpha: number;
  targetOffset: number;
  targetAlpha: number;
  meshes: AbstractMesh[];
}

export class LevelStack {
  private readonly groups = new Map<GroupId, GroupState>();
  private readonly base = new WeakMap<AbstractMesh, number>();
  private explode = 0;
  private explodeTarget = 0;
  private mode: StackMode = { kind: "house" };

  constructor(roots: Record<GroupId, TransformNode>) {
    for (const id of GROUP_ORDER) {
      this.groups.set(id, {
        root: roots[id],
        offset: 0,
        alpha: 1,
        targetOffset: 0,
        targetAlpha: 1,
        meshes: [],
      });
    }
    this.collect();
  }

  get current(): StackMode {
    return this.mode;
  }

  /** 0 when the levels are together, 1 when fully pulled apart. */
  get exploded(): number {
    return this.explode;
  }

  /** Current fade (0–1) of a group. */
  alpha(id: GroupId): number {
    return this.groups.get(id)?.alpha ?? 1;
  }

  /**
   * How far an anchor's level is lifted out of the way right now: 0 while the level is in view,
   * or when the anchor doesn't move with a level (the dock). Beams use it to keep an end where
   * its level would be while that level is lifted away.
   */
  liftOf(a: Anchor): number {
    const g = this.groups.get(a.group);
    if (!g || g.alpha >= 0.999 || !a.node.isDescendantOf(g.root)) return 0;
    return g.offset;
  }

  setMode(mode: StackMode): void {
    this.mode = mode;
    this.collect();
    this.explodeTarget = mode.kind === "exploded" ? 1 : 0;
    const focus = mode.kind === "focus" ? GROUP_ORDER.indexOf(mode.level) : -1;
    GROUP_ORDER.forEach((id, i) => {
      const g = this.groups.get(id);
      if (!g) return;
      if (mode.kind === "house") {
        g.targetOffset = 0;
        g.targetAlpha = 1;
      } else if (mode.kind === "focus") {
        const above = focus - i;
        g.targetOffset = above > 0 ? LIFT * above : 0;
        g.targetAlpha = above > 0 ? 0 : 1;
      } else {
        const fromBottom = GROUP_ORDER.length - 1 - i;
        g.targetOffset = fromBottom * EXPLODE_GAP + (id === "roof" ? LIFT : 0);
        g.targetAlpha = id === "roof" ? 0 : 1;
      }
      if (g.targetAlpha > 0) g.root.setEnabled(true);
    });
  }

  /** Jump straight to the target arrangement (deep links skip the animation). */
  snap(): void {
    this.explode = this.explodeTarget;
    for (const g of this.groups.values()) {
      g.offset = g.targetOffset;
      g.root.position.y = g.offset;
      g.alpha = g.targetAlpha;
      this.applyAlpha(g);
    }
  }

  update(dt: number): void {
    const k = 1 - Math.exp(-dt * 3.2);
    const ka = 1 - Math.exp(-dt * 4.5);
    this.explode += (this.explodeTarget - this.explode) * k;
    if (Math.abs(this.explodeTarget - this.explode) < 0.002) this.explode = this.explodeTarget;
    for (const g of this.groups.values()) {
      if (g.offset !== g.targetOffset) {
        g.offset += (g.targetOffset - g.offset) * k;
        if (Math.abs(g.targetOffset - g.offset) < 0.01) g.offset = g.targetOffset;
        g.root.position.y = g.offset;
      }
      if (g.alpha !== g.targetAlpha) {
        g.alpha += (g.targetAlpha - g.alpha) * ka;
        if (Math.abs(g.targetAlpha - g.alpha) < 0.01) g.alpha = g.targetAlpha;
        this.applyAlpha(g);
      }
    }
  }

  private applyAlpha(g: GroupState): void {
    g.root.setEnabled(g.alpha > 0.01);
    for (const m of g.meshes) m.visibility = (this.base.get(m) ?? 1) * g.alpha;
  }

  /** Refresh each group's mesh list, remembering each mesh's own visibility the first time it is seen. */
  private collect(): void {
    for (const g of this.groups.values()) {
      g.meshes = g.root.getChildMeshes(false);
      for (const m of g.meshes) if (!this.base.has(m)) this.base.set(m, m.visibility);
    }
  }
}
