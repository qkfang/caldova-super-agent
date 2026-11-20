/**
 * Voxel construction kit for the lakehouse.
 *
 * - `mat()` caches flat-shaded materials, optionally multiplied with a tiny
 *   pixel-noise texture (grass, timber, stone…) that tiles in world units.
 * - `block()` / `cyl()` build primitives that sit on a floor (y is the bottom).
 * - `label()` paints text onto a DynamicTexture plane for signs and tags.
 * - `bubble()` floats a small speech bubble over a walker to say what it is doing.
 * - `hitbox()` adds an invisible click target for the inspector.
 * - `Batch` merges static decor by material, so each level costs only a
 *   handful of draw calls. Anything that animates is built with
 *   `{ dynamic: true }` (or outside a batch) and stays a separate mesh.
 * - No glow or bloom: "lit" parts (signs, screens, edge strips) are plain unlit
 *   colours, and text textures use anisotropic filtering, so everything stays
 *   sharp and readable at any angle.
 */
import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector4,
} from "@babylonjs/core";
import type { InspectTarget, V2PickMetadata } from "./types";

export type TextureKey =
  | "grass"
  | "dirt"
  | "stone"
  | "sand"
  | "gravel"
  | "concrete"
  | "oak"
  | "cedar"
  | "walnut";

export interface MatOptions {
  /** Self-illumination as a fraction of the colour (0–1). */
  emissive?: number;
  alpha?: number;
  /** Pixel texture multiplied with the colour (use "#ffffff" to show it as painted). */
  texture?: TextureKey;
  /** Ignore the scene lights and show the colour as-is. */
  unlit?: boolean;
  /** Specular strength (0–1). */
  specular?: number;
  /** A material of its own, outside the cache, for colours that change at runtime. */
  unique?: boolean;
}

export interface BlockOptions {
  /** World size of one texture tile (defaults to 2 for textured materials). */
  tile?: number;
  rotY?: number;
  name?: string;
  /** Keep the mesh out of the current batch (it animates or changes). */
  dynamic?: boolean;
}

export interface LabelLine {
  text: string;
  /** Font size in texture pixels. */
  size: number;
  color?: string;
  weight?: number;
  serif?: boolean;
}

export interface LabelSpec {
  lines: LabelLine[];
  /** World width of the plane. */
  width: number;
  /** Texture width in pixels (default 512). */
  px?: number;
  /** Fixed texture height in pixels (default: fitted to the lines). */
  pxHeight?: number;
  bg?: string;
  accent?: string;
  bar?: "left" | "top" | "none";
  align?: "left" | "center";
  billboard?: boolean;
}

type Ctx2D = CanvasRenderingContext2D;

const SANS = '"Segoe UI", system-ui, -apple-system, sans-serif';
const SERIF = '"Iowan Old Style", "Palatino Linotype", Georgia, serif';
/** Keeps signs and floor lettering sharp when seen at a glancing angle. */
const TEXT_ANISOTROPY = 16;

/** Deterministic PRNG so the procedural textures and props are the same on every load. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TONES: Record<TextureKey, string[]> = {
  grass: ["#5f9e3f", "#67a845", "#579537", "#6fb04c", "#4f8a33", "#62a142"],
  dirt: ["#8a5a35", "#7d5030", "#94643c", "#734a2b", "#9c6b42"],
  stone: ["#8b9097", "#7f848b", "#979ca3", "#737880", "#a1a6ad"],
  sand: ["#e9d6a6", "#dfca97", "#f1dfb1", "#d8c38e"],
  gravel: ["#cfc8ba", "#c3bcae", "#d9d2c4", "#b7b0a2"],
  concrete: ["#dedbd4", "#d6d3cc", "#e4e1da", "#d1cec6"],
  oak: ["#c9955c", "#c18d55", "#d19e66", "#b9844d", "#cc9a60"],
  cedar: ["#a8683c", "#9d5f35", "#b27244", "#93572f", "#ad6c3f"],
  walnut: ["#6b4429", "#5f3c24", "#77502f", "#563520"],
};

function paintTexture(key: TextureKey, ctx: Ctx2D, size: number): void {
  const r = rng(key.length * 9973 + key.charCodeAt(0) * 31);
  const tones = TONES[key];
  const pick = (): string => tones[Math.floor(r() * tones.length)];
  if (key === "oak" || key === "cedar" || key === "walnut") {
    // Planks with staggered joints, a little grain and a dark seam.
    const rows = 8;
    const ph = size / rows;
    for (let row = 0; row < rows; row++) {
      ctx.fillStyle = pick();
      ctx.fillRect(0, row * ph, size, ph);
      for (let i = 0; i < size; i++) {
        if (r() < 0.22) {
          ctx.fillStyle = pick();
          ctx.fillRect(i, row * ph + Math.floor(r() * ph), 2, 1);
        }
      }
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(0, row * ph + ph - 1, size, 1);
      ctx.fillRect(Math.floor(r() * size), row * ph, 1, ph);
    }
    return;
  }
  const cell = 2;
  for (let y = 0; y < size; y += cell) {
    for (let x = 0; x < size; x += cell) {
      ctx.fillStyle = pick();
      ctx.fillRect(x, y, cell, cell);
    }
  }
}

function roundRect(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export class Kit {
  private readonly mats = new Map<string, StandardMaterial>();
  private readonly textures = new Map<TextureKey, Texture>();
  private batch: Batch | null = null;
  private counter = 0;

  constructor(readonly scene: Scene) {}

  /** Route subsequent static blocks into `batch` (null stops batching). Returns the previous batch. */
  useBatch(batch: Batch | null): Batch | null {
    const prev = this.batch;
    this.batch = batch;
    return prev;
  }

  texture(key: TextureKey): Texture {
    const hit = this.textures.get(key);
    if (hit) return hit;
    const size = 32;
    const tex = new DynamicTexture(
      `v2tex_${key}`,
      { width: size, height: size },
      this.scene,
      false,
      Texture.NEAREST_SAMPLINGMODE,
    );
    paintTexture(key, tex.getContext() as unknown as Ctx2D, size);
    tex.update(false);
    tex.wrapU = Texture.WRAP_ADDRESSMODE;
    tex.wrapV = Texture.WRAP_ADDRESSMODE;
    this.textures.set(key, tex);
    return tex;
  }

  mat(hex: string, o: MatOptions = {}): StandardMaterial {
    const key = [
      hex,
      o.emissive ?? 0,
      o.alpha ?? 1,
      o.texture ?? "",
      o.unlit ? 1 : 0,
      o.specular ?? 0,
    ].join("|");
    const hit = o.unique ? undefined : this.mats.get(key);
    if (hit) return hit;
    const m = new StandardMaterial(o.unique ? `v2mat_u${this.counter++}` : `v2mat_${this.mats.size}`, this.scene);
    const c = Color3.FromHexString(hex);
    m.diffuseColor = c;
    m.specularColor = Color3.White().scale(o.specular ?? 0.04);
    if (o.texture) m.diffuseTexture = this.texture(o.texture);
    if (o.emissive) m.emissiveColor = c.scale(o.emissive);
    if (o.unlit) {
      m.disableLighting = true;
      m.emissiveColor = c.clone();
    }
    if (o.alpha !== undefined && o.alpha < 1) {
      // Glass and water: blend without writing depth so overlapping panes stay visible.
      m.alpha = o.alpha;
      m.disableDepthWrite = true;
    }
    if (!o.unique) this.mats.set(key, m);
    return m;
  }

  /** A box whose bottom sits at `y`. */
  block(
    parent: TransformNode | null,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat: StandardMaterial,
    o: BlockOptions = {},
  ): Mesh {
    const t = o.tile ?? (mat.diffuseTexture ? 2 : undefined);
    const faceUV = t
      ? [
          new Vector4(0, 0, w / t, h / t),
          new Vector4(0, 0, w / t, h / t),
          new Vector4(0, 0, d / t, h / t),
          new Vector4(0, 0, d / t, h / t),
          new Vector4(0, 0, w / t, d / t),
          new Vector4(0, 0, w / t, d / t),
        ]
      : undefined;
    const m = MeshBuilder.CreateBox(
      o.name ?? `v2b${this.counter++}`,
      { width: w, height: h, depth: d, faceUV, wrap: true },
      this.scene,
    );
    m.position.set(x, y + h / 2, z);
    if (o.rotY) m.rotation.y = o.rotY;
    return this.finish(m, parent, mat, o.dynamic);
  }

  /** A cylinder (or cone, with `top`) whose bottom sits at `y`. */
  cyl(
    parent: TransformNode | null,
    x: number,
    y: number,
    z: number,
    diameter: number,
    h: number,
    mat: StandardMaterial,
    o: { top?: number; tess?: number; name?: string; dynamic?: boolean } = {},
  ): Mesh {
    const m = MeshBuilder.CreateCylinder(
      o.name ?? `v2c${this.counter++}`,
      {
        height: h,
        diameterTop: o.top ?? diameter,
        diameterBottom: diameter,
        tessellation: o.tess ?? 16,
      },
      this.scene,
    );
    m.position.set(x, y + h / 2, z);
    return this.finish(m, parent, mat, o.dynamic);
  }

  /** Register a mesh built elsewhere (torus, disc…) with the parent and batch. */
  finish(m: Mesh, parent: TransformNode | null, mat: StandardMaterial, dynamic = false): Mesh {
    m.material = mat;
    m.parent = parent;
    m.isPickable = false;
    if (this.batch && !dynamic) this.batch.add(m);
    return m;
  }

  /** Invisible click target for the inspector. */
  hitbox(
    parent: TransformNode,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    target: InspectTarget,
  ): Mesh {
    const m = MeshBuilder.CreateBox(`v2hit${this.counter++}`, { width: w, height: h, depth: d }, this.scene);
    m.position.set(x, y + h / 2, z);
    m.parent = parent;
    m.visibility = 0;
    m.isPickable = true;
    m.metadata = { kind: "v2", target } satisfies V2PickMetadata;
    return m;
  }

  /** Text painted on a plane. A plane reads correctly from -z; rotate it to face elsewhere. */
  label(parent: TransformNode | null, spec: LabelSpec, name = "v2label"): Mesh {
    const px = spec.px ?? 512;
    const pad = Math.round(px * 0.045);
    const gap = 1.22;
    const textH = spec.lines.reduce((s, l) => s + l.size * gap, 0);
    const pxH = spec.pxHeight ?? Math.ceil(textH + pad * 1.6);
    const id = this.counter++;
    const tex = new DynamicTexture(`${name}_tex${id}`, { width: px, height: pxH }, this.scene, true);
    tex.hasAlpha = true;
    tex.anisotropicFilteringLevel = TEXT_ANISOTROPY;
    const ctx = tex.getContext() as unknown as Ctx2D;
    ctx.clearRect(0, 0, px, pxH);
    const bar = spec.bar ?? (spec.accent ? "left" : "none");
    if (spec.bg) {
      ctx.save();
      roundRect(ctx, 0, 0, px, pxH, Math.min(pxH * 0.22, 36));
      ctx.fillStyle = spec.bg;
      ctx.fill();
      ctx.clip();
      if (spec.accent && bar === "left") {
        ctx.fillStyle = spec.accent;
        ctx.fillRect(0, 0, Math.max(10, px * 0.022), pxH);
      } else if (spec.accent && bar === "top") {
        ctx.fillStyle = spec.accent;
        ctx.fillRect(0, 0, px, Math.max(8, pxH * 0.07));
      }
      ctx.restore();
    }
    const align = spec.align ?? "center";
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    const x = align === "center" ? px / 2 : pad + (bar === "left" ? px * 0.03 : 0);
    let y = (pxH - textH) / 2;
    for (const line of spec.lines) {
      const h = line.size * gap;
      ctx.font = `${line.weight ?? 600} ${line.size}px ${line.serif ? SERIF : SANS}`;
      ctx.fillStyle = line.color ?? "#ffffff";
      ctx.fillText(line.text, x, y + h / 2, px - pad * 2 - (bar === "left" ? px * 0.03 : 0));
      y += h;
    }
    tex.update(true);
    const mat = new StandardMaterial(`${name}_mat${id}`, this.scene);
    mat.diffuseTexture = tex;
    mat.useAlphaFromDiffuseTexture = true;
    mat.emissiveColor = Color3.White();
    mat.disableLighting = true;
    mat.specularColor = Color3.Black();
    mat.backFaceCulling = false;
    const plane = MeshBuilder.CreatePlane(
      `${name}${id}`,
      { width: spec.width, height: spec.width * (pxH / px) },
      this.scene,
    );
    plane.material = mat;
    plane.parent = parent;
    plane.isPickable = false;
    if (spec.billboard) plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
    return plane;
  }

  /** A canvas-backed texture for screens and decals that the caller paints. */
  canvas(
    name: string,
    width: number,
    height: number,
    paint: (ctx: Ctx2D, w: number, h: number) => void,
  ): DynamicTexture {
    const tex = new DynamicTexture(`${name}${this.counter++}`, { width, height }, this.scene, true);
    tex.anisotropicFilteringLevel = TEXT_ANISOTROPY;
    paint(tex.getContext() as unknown as Ctx2D, width, height);
    tex.update(true);
    return tex;
  }

  /** An unlit material showing a canvas texture (screens, posters, floor lettering). */
  screen(tex: DynamicTexture, alpha = false): StandardMaterial {
    const m = new StandardMaterial(`v2screen${this.counter++}`, this.scene);
    m.diffuseTexture = tex;
    m.emissiveColor = Color3.White();
    m.disableLighting = true;
    m.specularColor = Color3.Black();
    if (alpha) {
      tex.hasAlpha = true;
      m.useAlphaFromDiffuseTexture = true;
      m.backFaceCulling = false;
    }
    return m;
  }

  /**
   * A speech bubble floating `y` above a walker, sized in world units whatever
   * the walker's own scale. Hidden until `say()` is called.
   */
  bubble(parent: TransformNode, y: number, accent: string, parentScale = 1): Bubble {
    const id = this.counter++;
    const tex = new DynamicTexture(`v2bubble_tex${id}`, { width: BUBBLE_PX, height: BUBBLE_PX_H }, this.scene, true);
    tex.hasAlpha = true;
    tex.anisotropicFilteringLevel = TEXT_ANISOTROPY;
    // Upload the blank texture now: a DynamicTexture isn't ready until its first update, and
    // the scene waits for every mesh, hidden bubbles included, before it reports ready.
    tex.getContext().clearRect(0, 0, BUBBLE_PX, BUBBLE_PX_H);
    tex.update(true);
    const mat = new StandardMaterial(`v2bubble_mat${id}`, this.scene);
    mat.diffuseTexture = tex;
    mat.useAlphaFromDiffuseTexture = true;
    mat.emissiveColor = Color3.White();
    mat.disableLighting = true;
    mat.specularColor = Color3.Black();
    mat.backFaceCulling = false;
    const width = 2.8;
    const plane = MeshBuilder.CreatePlane(
      `v2bubble${id}`,
      { width, height: width * (BUBBLE_PX_H / BUBBLE_PX) },
      this.scene,
    );
    plane.material = mat;
    plane.parent = parent;
    plane.isPickable = false;
    plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
    plane.position.y = y;
    plane.scaling.setAll(1 / parentScale);
    plane.isVisible = false;
    return new Bubble(plane, tex, accent);
  }
}

const BUBBLE_PX = 512;
const BUBBLE_PX_H = 104;

/** A speech bubble that floats over a walker and says what it is doing. */
export class Bubble {
  private text = "";

  constructor(
    readonly mesh: Mesh,
    private readonly tex: DynamicTexture,
    private readonly accent: string,
  ) {}

  say(text: string): void {
    if (text !== this.text) {
      this.text = text;
      this.paint();
    }
    this.mesh.isVisible = true;
  }

  hide(): void {
    this.mesh.isVisible = false;
  }

  private paint(): void {
    const ctx = this.tex.getContext() as unknown as Ctx2D;
    const w = BUBBLE_PX;
    const body = 84;
    ctx.clearRect(0, 0, w, BUBBLE_PX_H);
    // Shrink long lines until they fit.
    let size = 34;
    ctx.font = `600 ${size}px ${SANS}`;
    while (size > 20 && ctx.measureText(this.text).width > w - 96) {
      size -= 2;
      ctx.font = `600 ${size}px ${SANS}`;
    }
    const tw = Math.min(w - 96, ctx.measureText(this.text).width);
    const bw = tw + 78;
    const x0 = (w - bw) / 2;
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    roundRect(ctx, x0, 4, bw, body - 8, 30);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w / 2 - 12, body - 6);
    ctx.lineTo(w / 2 + 12, body - 6);
    ctx.lineTo(w / 2, BUBBLE_PX_H - 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = this.accent;
    ctx.beginPath();
    ctx.arc(x0 + 30, body / 2, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#172033";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(this.text, x0 + 50, body / 2 + 1, w - 96);
    this.tex.update(true);
  }
}

/**
 * Collects static meshes and merges them by material. Merging bakes world
 * transforms, so flush while `parent` is still at the origin; the merged
 * meshes are then re-parented and move with it.
 */
export class Batch {
  private readonly groups = new Map<StandardMaterial, Mesh[]>();

  constructor(
    private readonly parent: TransformNode,
    private readonly name: string,
  ) {}

  add(m: Mesh): void {
    const mat = m.material as StandardMaterial | null;
    if (!mat) return;
    const list = this.groups.get(mat);
    if (list) list.push(m);
    else this.groups.set(mat, [m]);
  }

  /** Merges the collected meshes by material and returns the resulting meshes. */
  flush(): Mesh[] {
    const out: Mesh[] = [];
    let i = 0;
    for (const [mat, list] of this.groups) {
      // Opaque decor blocks clicks, so nothing hidden behind a floor or wall can be picked.
      const blocker = mat.alpha >= 1;
      let mesh: Mesh;
      if (list.length === 1) {
        // Keep the world transform while moving it under the batch's group, as merging would.
        mesh = list[0];
        if (mesh.parent !== this.parent) mesh.setParent(this.parent);
      } else {
        const merged = Mesh.MergeMeshes(list, true, true);
        if (!merged) continue;
        mesh = merged;
        mesh.name = `${this.name}_m${i++}`;
        mesh.material = mat;
        mesh.parent = this.parent;
      }
      mesh.isPickable = blocker;
      out.push(mesh);
    }
    this.groups.clear();
    return out;
  }
}
