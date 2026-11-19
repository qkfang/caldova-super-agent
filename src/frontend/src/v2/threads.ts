/**
 * Glowing threads between anchors on different levels.
 *  - Structure threads show the whole house as one tree when the levels are
 *    pulled apart: the idea → each person → their agent → Microsoft Foundry.
 *  - Selection threads trace whatever the visitor has clicked up and down
 *    the house, with a bead running along each one to show the direction.
 */
import { Mesh, MeshBuilder, Quaternion, Vector3 } from "@babylonjs/core";
import type { Kit } from "./kit";
import type { LevelStack } from "./levelStack";
import type { Anchor } from "./types";

export interface ThreadSpec {
  a: Anchor;
  b: Anchor;
  color: string;
}

interface Link {
  a: Anchor;
  b: Anchor;
  tube: Mesh;
  bead: Mesh | null;
  phase: number;
}

const UP = new Vector3(0, 1, 0);

export class Threads {
  private readonly structure: Link[] = [];
  private selection: Link[] = [];
  private t = 0;
  private readonly pa = new Vector3();
  private readonly pb = new Vector3();
  private readonly dir = new Vector3();

  constructor(
    private readonly kit: Kit,
    private readonly stack: LevelStack,
  ) {}

  addStructure(spec: ThreadSpec): void {
    this.structure.push(this.make(spec, true));
  }

  setSelection(specs: ThreadSpec[]): void {
    for (const l of this.selection) {
      l.tube.dispose();
      l.bead?.dispose();
    }
    this.selection = specs.map((s) => this.make(s, false));
  }

  update(dt: number): void {
    this.t += dt;
    const ex = this.stack.exploded;
    for (const l of this.structure) this.place(l, ex);
    for (const l of this.selection) this.place(l, 1);
  }

  private make(spec: ThreadSpec, structure: boolean): Link {
    const scene = this.kit.scene;
    const tube = MeshBuilder.CreateCylinder(
      structure ? "v2_threadStructure" : "v2_threadSelect",
      { height: 1, diameter: structure ? 0.18 : 0.24, tessellation: 6 },
      scene,
    );
    tube.material = this.kit.mat(spec.color, { unlit: true, glow: true, alpha: structure ? 0.75 : 0.95 });
    tube.isPickable = false;
    tube.rotationQuaternion = new Quaternion();
    tube.setEnabled(false);
    this.kit.track(tube);
    let bead: Mesh | null = null;
    if (!structure) {
      bead = MeshBuilder.CreateSphere("v2_threadBead", { diameter: 0.55, segments: 8 }, scene);
      bead.material = this.kit.mat("#ffffff", { unlit: true, glow: true });
      bead.isPickable = false;
      bead.setEnabled(false);
      this.kit.track(bead);
    }
    return { a: spec.a, b: spec.b, tube, bead, phase: Math.random() };
  }

  private place(l: Link, factor: number): void {
    const on = Math.min(this.stack.alpha(l.a.group), this.stack.alpha(l.b.group)) * factor > 0.6;
    l.tube.setEnabled(on);
    l.bead?.setEnabled(on);
    if (!on) return;
    this.pa.copyFrom(l.a.node.getAbsolutePosition());
    this.pa.y += l.a.dy;
    this.pb.copyFrom(l.b.node.getAbsolutePosition());
    this.pb.y += l.b.dy;
    this.pb.subtractToRef(this.pa, this.dir);
    const len = this.dir.length();
    if (len < 0.05) {
      l.tube.setEnabled(false);
      l.bead?.setEnabled(false);
      return;
    }
    l.tube.position.set((this.pa.x + this.pb.x) / 2, (this.pa.y + this.pb.y) / 2, (this.pa.z + this.pb.z) / 2);
    l.tube.scaling.set(1, len, 1);
    this.dir.scaleInPlace(1 / len);
    // A cylinder is symmetric, so always point it upwards (avoids the antiparallel case).
    if (this.dir.y < 0) this.dir.scaleInPlace(-1);
    Quaternion.FromUnitVectorsToRef(UP, this.dir, l.tube.rotationQuaternion!);
    if (l.bead) Vector3.LerpToRef(this.pa, this.pb, (this.t * 0.55 + l.phase) % 1, l.bead.position);
  }
}
