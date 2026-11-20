/**
 * Lines between anchors on different levels.
 *  - Structure threads show the whole house as one tree when the levels are
 *    pulled apart: the idea → each person → their agent → Microsoft Foundry.
 *  - Selection beams trace whatever the visitor has clicked up and down the
 *    house. A beam is a solid line with a dark outline where it can be seen,
 *    and dashed where it runs behind or through a floor. The dashed part is a
 *    camera-facing ribbon drawn over the floors but under the signs, so it
 *    never hides a label. The dashes and a few voxel packets run the way the
 *    work flows, and a node marks each end. An end on a level that has lifted
 *    away stays where that level would be, and its beam then shows only where
 *    it can be seen (an x-ray line to a level that isn't there would mislead).
 *  - Live beams show what is happening right now: Amelia, at the front desk,
 *    linking a visitor with the agents that get them started. They look like
 *    selection beams, without the end nodes.
 *  - Lines keep roughly the same thickness on screen at any zoom.
 */
import {
  Color3,
  Constants,
  DynamicTexture,
  Material,
  Mesh,
  MeshBuilder,
  Quaternion,
  StandardMaterial,
  Texture,
  Vector3,
  VertexBuffer,
  VertexData,
} from "@babylonjs/core";
import type { Kit } from "./kit";
import { LEVELS } from "./lakehouseData";
import type { LevelStack } from "./levelStack";
import type { Anchor } from "./types";

export interface ThreadSpec {
  a: Anchor;
  b: Anchor;
  color: string;
}

interface Line {
  a: Anchor;
  b: Anchor;
  core: Mesh;
  rim: Mesh;
}

interface Beam extends Line {
  ribbon: Mesh;
  uvs: Float32Array;
  packets: Mesh[];
  phase: number;
}

interface EndNode {
  mesh: Mesh;
  phase: number;
  shown: boolean;
}

const UP = new Vector3(0, 1, 0);
/** Rendering group for the end nodes and packets: drawn after everything else, so they show through floors. */
const ON_TOP = 1;
const INK = "#0b1220";
/** The coloured core's share of a line's width; the rest is the dark outline. */
const CORE = 0.56;
/** A selection beam's width per unit of distance from the camera (about 9 px at the default framing). */
const BEAM_W: [number, number, number] = [0.0085, 0.22, 0.62];
const THREAD_W: [number, number, number] = [0.0045, 0.14, 0.42];
const NODE_S: [number, number, number] = [0.014, 0.45, 1.1];
const PACKET_S: [number, number, number] = [0.0095, 0.3, 0.8];
/** One dash plus one gap along a beam, in world units. */
const DASH = 0.8;
/** How fast the dashes march along a beam, in world units per second. */
const FLOW = 1.6;
/** Seconds for a packet to run the length of a beam. */
const RUN = 2.4;

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

/** A size that scales with distance from the camera, so it stays about the same on screen. */
const sized = (dist: number, [k, min, max]: [number, number, number]): number => Math.min(max, Math.max(min, dist * k));

export class Threads {
  private readonly structure: Line[] = [];
  private beams: Beam[] = [];
  private live: Beam[] = [];
  private nodes = new Map<Anchor, EndNode>();
  private readonly outlines = new Map<string, StandardMaterial>();
  private readonly ribbons = new Map<string, StandardMaterial>();
  private t = 0;
  private readonly pa = new Vector3();
  private readonly pb = new Vector3();
  private readonly dir = new Vector3();
  private readonly axis = new Vector3();
  private readonly mid = new Vector3();
  private readonly toCam = new Vector3();
  private readonly right = new Vector3();
  private readonly normal = new Vector3();
  private readonly rot = new Quaternion();
  private len = 0;
  private dist = 50;

  constructor(
    private readonly kit: Kit,
    private readonly stack: LevelStack,
  ) {}

  addStructure(spec: ThreadSpec): void {
    this.structure.push({ a: spec.a, b: spec.b, ...this.line(spec.color, 0) });
  }

  setSelection(specs: ThreadSpec[]): void {
    for (const b of this.beams) this.disposeBeam(b);
    for (const n of this.nodes.values()) n.mesh.dispose();
    this.nodes = new Map();
    this.beams = specs.map((s) => this.makeBeam(s));
    for (const s of specs) {
      for (const a of [s.a, s.b]) if (!this.nodes.has(a)) this.nodes.set(a, this.makeNode(a));
    }
  }

  /** Beams for what is happening right now (Amelia linking a visitor with agents): drawn like the selection's, without end nodes. */
  setLive(specs: ThreadSpec[]): void {
    for (const b of this.live) this.disposeBeam(b);
    this.live = specs.map((s) => this.makeBeam(s));
  }

  /** Whether the selection shows a node at this anchor right now. */
  shows(a: Anchor): boolean {
    return this.nodes.get(a)?.shown ?? false;
  }

  update(dt: number): void {
    this.t += dt;
    const camera = this.kit.scene.activeCamera;
    if (!camera) return;
    const eye = camera.globalPosition;
    const ex = this.stack.exploded;
    for (const l of this.structure) {
      const on = Math.min(this.stack.alpha(l.a.group), this.stack.alpha(l.b.group)) * ex > 0.6 && this.align(l.a, l.b, eye);
      l.core.setEnabled(on);
      l.rim.setEnabled(on);
      if (on) this.fit(l, sized(this.dist, THREAD_W));
    }
    for (const n of this.nodes.values()) n.shown = false;
    for (const b of this.beams) this.placeBeam(b, eye, true);
    for (const b of this.live) this.placeBeam(b, eye, false);
    for (const [a, n] of this.nodes) {
      n.mesh.setEnabled(n.shown);
      if (!n.shown) continue;
      anchorPoint(this.stack, a, n.mesh.position);
      n.mesh.position.y += Math.sin(this.t * 2.2 + n.phase) * 0.06;
      n.mesh.rotation.y = this.t * 0.9 + n.phase;
      n.mesh.scaling.setAll(sized(Vector3.Distance(eye, n.mesh.position), NODE_S));
    }
  }

  private placeBeam(b: Beam, eye: Vector3, ends: boolean): void {
    // An end on a lifted-away level still shows, as long as the other end is in view.
    const on = Math.max(this.stack.alpha(b.a.group), this.stack.alpha(b.b.group)) > 0.6 && this.align(b.a, b.b, eye);
    for (const m of [b.core, b.rim, b.ribbon, ...b.packets]) m.setEnabled(on);
    if (!on) return;
    for (const a of ends ? [b.a, b.b] : []) {
      const n = this.nodes.get(a);
      if (n) n.shown = true;
    }
    const w = sized(this.dist, BEAM_W);
    this.fit(b, w);
    // The ribbon lies along the beam (a to b) and turns to face the camera.
    Vector3.CrossToRef(this.axis, this.toCam, this.right);
    const rl = this.right.length();
    const ribbonOn = Math.min(this.stack.alpha(b.a.group), this.stack.alpha(b.b.group)) > 0.6;
    if (rl < 1e-3 || !ribbonOn) {
      b.ribbon.setEnabled(false);
    } else {
      this.right.scaleInPlace(1 / rl);
      Vector3.CrossToRef(this.right, this.axis, this.normal);
      Quaternion.RotationQuaternionFromAxisToRef(this.right, this.axis, this.normal, b.ribbon.rotationQuaternion!);
      b.ribbon.position.copyFrom(this.mid);
      b.ribbon.scaling.set(w, this.len, 1);
      // The dashes march from a to b.
      const march = ((this.t * FLOW) / DASH) % 1;
      const v0 = -march;
      const v1 = this.len / DASH - march;
      b.uvs[1] = v0;
      b.uvs[3] = v0;
      b.uvs[5] = v1;
      b.uvs[7] = v1;
      b.ribbon.updateVerticesData(VertexBuffer.UVKind, b.uvs);
    }
    const ps = sized(this.dist, PACKET_S);
    b.packets.forEach((p, i) => {
      Vector3.LerpToRef(this.pa, this.pb, (this.t / RUN + b.phase + i / b.packets.length) % 1, p.position);
      p.rotation.set(this.t * 1.3 + i, this.t * 2 + i, 0);
      p.scaling.setAll(ps);
    });
  }

  /** Lines a and b up for `fit()`; false when the ends are too close to draw a line. */
  private align(a: Anchor, b: Anchor, eye: Vector3): boolean {
    anchorPoint(this.stack, a, this.pa);
    anchorPoint(this.stack, b, this.pb);
    this.pb.subtractToRef(this.pa, this.axis);
    this.len = this.axis.length();
    if (this.len < 0.05) return false;
    this.axis.scaleInPlace(1 / this.len);
    this.mid.copyFrom(this.pa).addInPlace(this.pb).scaleInPlace(0.5);
    eye.subtractToRef(this.mid, this.toCam);
    this.dist = this.toCam.length();
    this.toCam.scaleInPlace(1 / Math.max(1e-6, this.dist));
    // A cylinder is symmetric, so always point it upwards (avoids the antiparallel case).
    this.dir.copyFrom(this.axis);
    if (this.dir.y < 0) this.dir.scaleInPlace(-1);
    Quaternion.FromUnitVectorsToRef(UP, this.dir, this.rot);
    return true;
  }

  /** Stretches a line's tubes between the ends lined up by `align()`, `w` wide in all. */
  private fit(l: Line, w: number): void {
    for (const [m, d] of [
      [l.core, w * CORE],
      [l.rim, w],
    ] as const) {
      m.position.copyFrom(this.mid);
      m.scaling.set(d, this.len, d);
      m.rotationQuaternion!.copyFrom(this.rot);
    }
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

  /**
   * The dashed ribbon for a colour: dark edges and a coloured middle, like the solid line. It is
   * alpha-tested, so it draws after the solid scene and before the signs, and it ignores depth,
   * so it shows through floors without ever covering a label.
   */
  private ribbonMat(hex: string): StandardMaterial {
    const hit = this.ribbons.get(hex);
    if (hit) return hit;
    const scene = this.kit.scene;
    const w = 32;
    const h = 32;
    const tex = new DynamicTexture(`v2_ribbon_${hex}`, { width: w, height: h }, scene, true, Texture.TRILINEAR_SAMPLINGMODE);
    const ctx = tex.getContext();
    ctx.clearRect(0, 0, w, h);
    const edge = Math.round((w * (1 - CORE)) / 2);
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, w, 18);
    ctx.fillStyle = hex;
    ctx.fillRect(edge, 0, w - edge * 2, 18);
    tex.hasAlpha = true;
    tex.wrapU = Texture.CLAMP_ADDRESSMODE;
    tex.wrapV = Texture.WRAP_ADDRESSMODE;
    tex.update(true);
    const m = new StandardMaterial(`v2_ribbonMat_${hex}`, scene);
    m.disableLighting = true;
    m.diffuseColor = Color3.Black();
    m.specularColor = Color3.Black();
    m.emissiveColor = Color3.White();
    m.diffuseTexture = tex;
    // The discard reads the texture's alpha only with this on.
    m.useAlphaFromDiffuseTexture = true;
    m.transparencyMode = Material.MATERIAL_ALPHATEST;
    m.backFaceCulling = false;
    m.disableDepthWrite = true;
    m.depthFunction = Constants.ALWAYS;
    this.ribbons.set(hex, m);
    return m;
  }

  /** A unit tube and its outline, for `fit()` to stretch. */
  private line(color: string, group: number): { core: Mesh; rim: Mesh } {
    const scene = this.kit.scene;
    const tube = (name: string, mat: Material): Mesh => {
      const m = MeshBuilder.CreateCylinder(name, { height: 1, diameter: 1, tessellation: 10 }, scene);
      m.material = mat;
      m.isPickable = false;
      m.renderingGroupId = group;
      m.rotationQuaternion = new Quaternion();
      m.setEnabled(false);
      return m;
    };
    return { core: tube("v2_line", this.kit.mat(color, { unlit: true })), rim: tube("v2_lineRim", this.outline(INK)) };
  }

  private makeBeam(spec: ThreadSpec): Beam {
    const scene = this.kit.scene;
    const ribbon = new Mesh("v2_beamRibbon", scene);
    const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
    const vd = new VertexData();
    vd.positions = [-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0];
    vd.normals = [0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1];
    vd.indices = [0, 1, 2, 0, 2, 3];
    vd.uvs = uvs;
    vd.applyToMesh(ribbon, true);
    ribbon.material = this.ribbonMat(spec.color);
    ribbon.isPickable = false;
    ribbon.rotationQuaternion = new Quaternion();
    ribbon.setEnabled(false);
    const packets = [0, 1].map(() => this.cube("v2_beamPacket", "#ffffff", spec.color, 1.5));
    return { a: spec.a, b: spec.b, ...this.line(spec.color, 0), ribbon, uvs, packets, phase: Math.random() };
  }

  private makeNode(a: Anchor): EndNode {
    return { mesh: this.cube("v2_beamNode", accentOf(a), INK, 1.4), phase: Math.random() * 6, shown: false };
  }

  private disposeBeam(b: Beam): void {
    for (const m of [b.core, b.rim, b.ribbon, ...b.packets]) m.dispose();
  }

  /** A unit voxel cube with an outline, drawn over everything. */
  private cube(name: string, fill: string, edge: string, rim: number): Mesh {
    const scene = this.kit.scene;
    const core = MeshBuilder.CreateBox(name, { size: 1 }, scene);
    core.material = this.kit.mat(fill, { unlit: true });
    const shell = MeshBuilder.CreateBox(`${name}Rim`, { size: rim }, scene);
    shell.material = this.outline(edge);
    shell.parent = core;
    for (const m of [core, shell]) {
      m.isPickable = false;
      m.renderingGroupId = ON_TOP;
    }
    core.setEnabled(false);
    return core;
  }
}
