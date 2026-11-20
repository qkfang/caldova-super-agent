/**
 * Labels for the far ends of a selection's beams: small chips beside each
 * end's node, so a beam that dives through a floor still says where it goes
 * ("1 · Benefits & Eligibility Agent", "B · Microsoft Foundry"). They are
 * HTML, so they stay sharp at any zoom, and clicking one goes there.
 */
import { Matrix, Vector3, type Scene } from "@babylonjs/core";
import type { InspectorAction } from "./inspector";
import type { LevelStack } from "./levelStack";
import { anchorPoint } from "./threads";
import type { Anchor } from "./types";

export interface CalloutSpec {
  anchor: Anchor;
  /** The level badge: 3, 2, 1 or B. */
  floor: string;
  text: string;
  /** The level's accent colour. */
  color: string;
  action?: InspectorAction;
}

interface Item {
  spec: CalloutSpec;
  el: HTMLElement;
  w: number;
  h: number;
}

interface Placed {
  item: Item;
  x: number;
  y: number;
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** Gap between a node and its chip, in CSS pixels. */
const GAP = 14;

export class Callouts {
  private items: Item[] = [];
  private readonly world = new Vector3();
  private readonly screen = new Vector3();

  constructor(
    private readonly scene: Scene,
    private readonly stack: LevelStack,
    private readonly layer: HTMLElement,
    /** Whether the beams show a node at this anchor right now. */
    private readonly shown: (a: Anchor) => boolean,
    onAction: (a: InspectorAction) => void,
  ) {
    layer.addEventListener("click", (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-i]");
      const a = el ? this.items[Number(el.dataset.i)]?.spec.action : undefined;
      if (a) onAction(a);
    });
  }

  set(specs: CalloutSpec[]): void {
    this.layer.innerHTML = specs
      .map((s, i) => {
        const inner = `<b>${esc(s.floor)}</b>${esc(s.text)}`;
        const title = s.action ? ` title="${esc(s.action.label)}"` : "";
        return s.action
          ? `<button type="button" class="v2-callout" data-i="${i}" style="--c:${s.color}"${title}>${inner}</button>`
          : `<div class="v2-callout" data-i="${i}" style="--c:${s.color}">${inner}</div>`;
      })
      .join("");
    const els = [...this.layer.children] as HTMLElement[];
    this.items = specs.map((spec, i) => ({ spec, el: els[i], w: els[i].offsetWidth, h: els[i].offsetHeight }));
  }

  /**
   * Moves each chip beside its node; call once per frame, after the scene has rendered. A chip
   * that would run under `avoid` (the open card) goes on the other side of its node.
   */
  update(avoid: DOMRect | null): void {
    if (!this.items.length) return;
    const engine = this.scene.getEngine();
    const camera = this.scene.activeCamera;
    if (!camera) return;
    const k = engine.getHardwareScalingLevel();
    const viewport = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
    const transform = this.scene.getTransformMatrix();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const placed: Placed[] = [];
    for (const item of this.items) {
      const a = item.spec.anchor;
      let on = this.shown(a);
      if (on) {
        anchorPoint(this.stack, a, this.world);
        Vector3.ProjectToRef(this.world, Matrix.IdentityReadOnly, transform, viewport, this.screen);
        const x = this.screen.x * k;
        const y = this.screen.y * k;
        on = this.screen.z > 0 && this.screen.z < 1 && x > -40 && x < vw + 40 && y > -40 && y < vh + 40;
        if (on) {
          const top = y - item.h / 2;
          const under = (x0: number): boolean =>
            !!avoid && x0 < avoid.right && x0 + item.w > avoid.left && top < avoid.bottom && top + item.h > avoid.top;
          const rightX = x + GAP;
          const leftX = x - GAP - item.w;
          const fitsRight = rightX + item.w <= vw - 8 && !under(rightX);
          placed.push({ item, x: fitsRight || under(leftX) ? rightX : leftX, y: top });
        }
      }
      if (!on) item.el.style.visibility = "hidden";
    }
    // Nudge overlapping chips apart, top to bottom.
    placed.sort((p, q) => p.y - q.y);
    placed.forEach((p, i) => {
      for (let j = 0; j < i; j++) {
        const q = placed[j];
        const overlapX = p.x < q.x + q.item.w && q.x < p.x + p.item.w;
        if (overlapX && p.y < q.y + q.item.h + 4) p.y = q.y + q.item.h + 4;
      }
      p.item.el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
      p.item.el.style.visibility = "visible";
    });
  }
}
