/**
 * Lines between anchors on different levels.
 *  - Structure threads show the whole house as one tree when the levels are
 *    pulled apart: the idea → each person → their agent → Microsoft Foundry.
 *  - Selection beams trace whatever the visitor has clicked up and down the
 *    house. A beam is solid where it can be seen and dashed where it runs
 *    through a floor (an x-ray line drawn over everything else), with a dark
 *    outline so it reads on light and dark floors alike. Voxel packets run
 *    along it the way the work flows, and a node marks each end. An end on a
 *    level that has lifted away stays where that level would be.
 */
import { Color3, DynamicTexture, Material, Mesh, MeshBuilder, Quaternion, StandardMaterial, Texture, Vector3 } from "@babylonjs/core";
import type { Kit } from "./kit";
import { LEVELS } from "./lakehouseData";
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
}

interface Beam {
  a: Anchor;
  b: Anchor;
  /** Solid core and outline (hidden behind floors), then the dashed x-ray core and outline. */
  parts: Mesh[];
  dash: DynamicTexture;
  /** Materials and textures made for this beam alone. */
  owned: Array<{ dispose(): void }>;
  packets: Mesh[];
  phase: number;
}

interface EndNode {
  mesh: Mesh;
  phase: number;
  shown: boolean;
}

const UP = new Vector3(0, 1, 0);
/** Rendering group for the x-ray parts: drawn after everything else, so they show through floors. */
const XRAY = 1;
const INK = "#0b1220";
const CORE_D = 0.3;
const RIM_D = 0.54;
/** One dash plus one gap along an x-ray line, in world units. */
const DASH = 0.8;
/** How fast the dashes march along a beam, in world units per second. */
const FLOW = 1.6;
/** Seconds for a packet to run the length of a beam. */
const RUN = 2.4;
const PACKET = 0.42;
const NODE = 0.62;

/** Where a line attaches to an anchor right now. */
export function anchorPoint(stack: LevelStack, a: Anchor, out: Vector3): Vector3 {
  out.copyFrom(a.node.getAbsolutePosition());
  out.y += a.dy - stack.liftOf(a);
  return out;
}

/** The accent colour of an anchor's level. */
function accentOf(a: Anchor): string {
  return LEVELS.find((l) => l.id === a.group)?.accent ?? "#ffc35a";
}

export class Threads {
  private readonly structure: Link[] = [];
  private beams: Beam[] = [];
  private nodes = new Map<Anchor, EndNode>();
  private readonly outlines = new Map<string, StandardMaterial>();
  private t = 0;
  private readonly pa = new Vector3();
  private readonly pb = new Vector3();
  private readonly dir = new Vector3();
  private readonly mid = new Vector3();
  private readonly rot = new Quaternion();
  private len = 0;
  private towardTop = true;

  constructor(
    private readonly kit: Kit,
    private readonly stack: LevelStack,
  ) {}

  addStructure(spec: ThreadSpec): void {
    const tube = MeshBuilder.CreateCylinder("v2_threadStructure", { height: 1, diameter: 0.18, tessellation: 6 }, this.kit.scene);
    tube.material = this.kit.mat(spec.color, { unlit: true });
    tube.isPickable = false;
    tube.rotationQuaternion = new Quaternion();
    tube.setEnabled(false);
    this.structure.push({ a: spec.a, b: spec.b, tube });
  }

  setSelection(specs: ThreadSpec[]): void {
    for (const b of this.beams) {
      for (const m of [...b.parts, ...b.packets]) m.dispose();
      for (const o of b.owned) o.dispose();
    }
    for (const n of this.nodes.values()) n.mesh.dispose();
    this.nodes = new Map();
    this.beams = specs.map((s) => this.makeBeam(s));
    for (const s of specs) {
      for (const a of [s.a, s.b]) if (!this.nodes.has(a)) this.nodes.set(a, this.makeNode(a));
    }
  }

  /** Whether the selection shows a node at this anchor right now. */
  shows(a: Anchor): boolean {
    return this.nodes.get(a)?.shown ?? false;
  }

  update(dt: number): void {
    this.t += dt;
    const ex = this.stack.exploded;
    for (const l of this.structure) {
      const on = Math.min(this.stack.alpha(l.a.group), this.stack.alpha(l.b.group)) * ex > 0.6 && this.align(l.a, l.b);
      l.tube.setEnabled(on);
      if (on) this.fit(l.tube);
    }
    for (const n of this.nodes.values()) n.shown = false;
    for (const b of this.beams) this.placeBeam(b);
    for (const [a, n] of this.nodes) {
      n.mesh.setEnabled(n.shown);
      if (!n.shown) continue;
      anchorPoint(this.stack, a, n.mesh.position);
      n.mesh.position.y += Math.sin(this.t * 2.2 + n.phase) * 0.06;
      n.mesh.rotation.y = this.t * 0.9 + n.phase;
    }
  }

  private placeBeam(b: Beam): void {
    // An end on a lifted-away level still shows, as long as the other end is in view.
    const on = Math.max(this.stack.alpha(b.a.group), this.stack.alpha(b.b.group)) > 0.6 && this.align(b.a, b.b);
    for (const m of b.parts) m.setEnabled(on);
    for (const p of b.packets) p.setEnabled(on);
    if (!on) return;
    for (const a of [b.a, b.b]) {
      const n = this.nodes.get(a);
      if (n) n.shown = true;
    }
    for (const m of b.parts) this.fit(m);
    // The dashes march from a to b. The texture runs from the tube's bottom (v = 0) to its top.
    b.dash.vScale = this.len / DASH;
    const march = ((this.t * FLOW) / DASH) % 1;
    b.dash.vOffset = this.towardTop ? -march : march;
    b.packets.forEach((p, i) => {
      Vector3.LerpToRef(this.pa, this.pb, (this.t / RUN + b.phase + i / b.packets.length) % 1, p.position);
      p.rotation.set(this.t * 1.3 + i, this.t * 2 + i, 0);
    });
  }

  /** Lines a and b up for `fit()`; false when the ends are too close to draw a line. */
  private align(a: Anchor, b: Anchor): boolean {
    anchorPoint(this.stack, a, this.pa);
    anchorPoint(this.stack, b, this.pb);
    this.pb.subtractToRef(this.pa, this.dir);
    this.len = this.dir.length();
    if (this.len < 0.05) return false;
    this.mid.copyFrom(this.pa).addInPlace(this.pb).scaleInPlace(0.5);
    this.dir.scaleInPlace(1 / this.len);
    this.towardTop = this.dir.y >= 0;
    // A cylinder is symmetric, so always point it upwards (avoids the antiparallel case).
    if (this.dir.y < 0) this.dir.scaleInPlace(-1);
    Quaternion.FromUnitVectorsToRef(UP, this.dir, this.rot);
    return true;
  }

  /** Stretches a unit-height tube between the ends lined up by `align()`. */
  private fit(m: Mesh): void {
    m.position.copyFrom(this.mid);
    m.scaling.set(1, this.len, 1);
    m.rotationQuaternion!.copyFrom(this.rot);
  }

  /** Draws only the back faces of a slightly larger shell: an outline around whatever sits inside. */
  private outline(hex: string): StandardMaterial {
    const hit = this.outlines.get(hex);
    if (hit) return hit;
    const m = new StandardMaterial(`v2_outline_${hex}`, this.kit.scene);
    m.disableLighting = true;
    m.diffuseColor = Color3.Black();
    m.specularColor = Color3.Black();
    m.emissiveColor = Color3.FromHexString(hex);
    m.cullBackFaces = false;
    this.outlines.set(hex, m);
    return m;
  }

  private makeBeam(spec: ThreadSpec): Beam {
    const scene = this.kit.scene;
    const tube = (name: string, diameter: number, mat: Material, group: number): Mesh => {
      const m = MeshBuilder.CreateCylinder(name, { height: 1, diameter, tessellation: 10 }, scene);
      m.material = mat;
      m.isPickable = false;
      m.renderingGroupId = group;
      m.rotationQuaternion = new Quaternion();
      m.setEnabled(false);
      return m;
    };
    // Dashes: hard-edged, so they stay crisp at any distance.
    const dash = new DynamicTexture("v2_beamDash", { width: 4, height: 16 }, scene, false, Texture.NEAREST_SAMPLINGMODE);
    const ctx = dash.getContext();
    ctx.clearRect(0, 0, 4, 16);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 4, 9);
    dash.hasAlpha = true;
    dash.wrapV = Texture.WRAP_ADDRESSMODE;
    dash.update(false);
    const dashed = (hex: string, outline: boolean): StandardMaterial => {
      const m = new StandardMaterial("v2_beamXray", scene);
      m.disableLighting = true;
      m.diffuseColor = Color3.Black();
      m.specularColor = Color3.Black();
      m.emissiveColor = Color3.FromHexString(hex);
      m.diffuseTexture = dash;
      m.transparencyMode = Material.MATERIAL_ALPHATEST;
      m.cullBackFaces = !outline;
      return m;
    };
    const xCore = dashed(spec.color, false);
    const xRim = dashed(INK, true);
    const parts = [
      tube("v2_beam", CORE_D, this.kit.mat(spec.color, { unlit: true }), 0),
      tube("v2_beamRim", RIM_D, this.outline(INK), 0),
      tube("v2_beamXray", CORE_D, xCore, XRAY),
      tube("v2_beamXrayRim", RIM_D, xRim, XRAY),
    ];
    const packets = [0, 1].map(() => this.cube("v2_beamPacket", PACKET, "#ffffff", spec.color, 1.5));
    return { a: spec.a, b: spec.b, parts, dash, owned: [xCore, xRim, dash], packets, phase: Math.random() };
  }

  private makeNode(a: Anchor): EndNode {
    return { mesh: this.cube("v2_beamNode", NODE, accentOf(a), INK, 1.4), phase: Math.random() * 6, shown: false };
  }

  /** A voxel cube with an outline, drawn over everything. */
  private cube(name: string, size: number, fill: string, edge: string, rim: number): Mesh {
    const scene = this.kit.scene;
    const core = MeshBuilder.CreateBox(name, { size }, scene);
    core.material = this.kit.mat(fill, { unlit: true });
    const shell = MeshBuilder.CreateBox(`${name}Rim`, { size: size * rim }, scene);
    shell.material = this.outline(edge);
    shell.parent = core;
    for (const m of [core, shell]) {
      m.isPickable = false;
      m.renderingGroupId = XRAY;
    }
    core.setEnabled(false);
    return core;
  }
}
