import {
  AbstractMesh,
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import type { CaseSimulation } from "./caseSimulation";
import type { GlassMaterial } from "./officeScene";
import { STAFF_PERSONAS } from "./personaData";
import { STAGE_CONFIG } from "./stepGate";
import { OFFICE_CHARACTER_SCALE } from "./voxelCharacter";
import { OFFICE_PIT } from "./parkSurroundings";

/** Alpha of the human floor while the agent layer is revealed. */
const GLASS_ALPHA = 0.38;

/**
 * The second layer of the office: the AI agent team.
 *
 * By default the office is a single level. When a human is selected the floor
 * fades to glass and the second level appears underneath: in the cut-away under
 * the building each staff member has an "agent bay" directly under their desk
 * with their sub-agents (small voxel robots) at work, linked up to the human
 * by a pulsing data beam. The agents working under the hood for the selected
 * human are spotlit — a cone of light from the person down to the agent bay —
 * and the other agents are dimmed.
 */
export class AgentLayer {
  private readonly groups = new Map<string, AgentGroup>();
  private readonly layerMeshes: AbstractMesh[] = [];
  private readonly cover: Mesh;
  private selected: string | null = null;
  private layerOn = false;
  private glassAlpha = 1;
  private time = 0;

  constructor(
    private readonly scene: Scene,
    sim: CaseSimulation,
    private readonly glass: GlassMaterial[],
  ) {
    const floorY = -OFFICE_PIT.depth;
    const firstMesh = scene.meshes.length;
    this.buildShell(floorY);

    const palette = new Map<string, StandardMaterial>();
    const colour = (hex: string, emissive = 0): StandardMaterial => {
      const key = `${hex}_${emissive}`;
      let m = palette.get(key);
      if (!m) {
        m = new StandardMaterial(`agent_${key}`, scene);
        m.diffuseColor = Color3.FromHexString(hex);
        m.emissiveColor = Color3.FromHexString(hex).scale(emissive);
        m.specularColor = new Color3(0.05, 0.05, 0.05);
        palette.set(key, m);
      }
      return m;
    };

    for (const persona of STAFF_PERSONAS) {
      const staff = sim.getStaff(persona.id);
      if (!staff) continue;
      const home = staff.homePoint;
      const subAgents =
        Object.values(STAGE_CONFIG).find((s) => s.role === persona.role)?.agents ?? [];
      this.groups.set(
        persona.id,
        this.buildGroup(persona.id, persona.name, persona.color, home, subAgents, floorY, colour),
      );
    }

    this.buildLayerLabels(floorY);

    // Everything built above belongs to the second level and stays hidden
    // until a human is selected. A thin cover hides the pit meanwhile.
    this.layerMeshes.push(...scene.meshes.slice(firstMesh));
    const P = OFFICE_PIT;
    this.cover = MeshBuilder.CreateBox(
      "agent_pitCover",
      { width: P.x1 - P.x0, depth: P.z1 - P.z0, height: 0.1 },
      scene,
    );
    this.cover.position.set((P.x0 + P.x1) / 2, -0.15, (P.z0 + P.z1) / 2);
    const coverMat = new StandardMaterial("agent_pitCoverMat", scene);
    coverMat.diffuseColor = Color3.FromHexString("#4d7a3a");
    coverMat.specularColor = Color3.Black();
    this.cover.material = coverMat;
    this.cover.isPickable = false;
    this.applyVisibility();

    scene.onBeforeRenderObservable.add(() => {
      const dt = Math.min(0.1, scene.getEngine().getDeltaTime() / 1000);
      this.update(dt);
    });
  }

  /**
   * Select a staff member: reveal the second level and spotlight the agents
   * working for them. Pass null to hide the second level again.
   */
  spotlight(staffId: string | null): void {
    this.selected = staffId && this.groups.has(staffId) ? staffId : null;
    this.layerOn = this.selected !== null;
    this.applyVisibility();
  }

  private applyVisibility(): void {
    for (const m of this.layerMeshes) m.setEnabled(this.layerOn);
    this.cover.setEnabled(!this.layerOn);
    for (const [id, g] of this.groups) {
      const on = this.layerOn && id === this.selected;
      const dim = this.layerOn && !on;
      g.cone.setEnabled(on);
      g.ring.setEnabled(on);
      for (const m of g.dimmable) m.visibility = dim ? 0.3 : 1;
      for (const r of g.robots) r.label.setEnabled(on);
    }
  }

  private update(dt: number): void {
    this.time += dt;
    const t = this.time;

    // Fade the human floor to glass while the second level is shown.
    const target = this.layerOn ? GLASS_ALPHA : 1;
    if (Math.abs(this.glassAlpha - target) > 0.002) {
      this.glassAlpha += (target - this.glassAlpha) * Math.min(1, dt * 6);
      for (const g of this.glass) {
        g.material.alpha = Math.min(g.baseAlpha, this.glassAlpha);
      }
    }
    if (!this.layerOn) return;

    for (const [id, g] of this.groups) {
      const on = id === this.selected;
      g.robots.forEach((r, i) => {
        const amp = on ? 0.28 : 0.06;
        const speed = on ? 4.5 : 1.6;
        r.node.position.y = g.floorY + Math.abs(Math.sin(t * speed + g.phase + i * 1.7)) * amp;
        r.tip.scaling.setAll(1 + 0.35 * Math.sin(t * 5 + i + g.phase));
      });
      // Data beam: slow pulse normally, bright and fast while selected.
      const pulse = 0.5 + 0.5 * Math.sin(t * (on ? 6 : 2) + g.phase);
      g.beamMat.alpha = on ? 0.4 + 0.3 * pulse : 0.2 + 0.18 * pulse;
      if (on) {
        g.coneMat.alpha = 0.3 + 0.15 * pulse;
        g.ring.scaling.x = g.ring.scaling.z = 1 + 0.12 * Math.sin(t * 5);
      }
    }
  }

  /** Pit walls, the glowing agent floor and the "AI AGENT TEAM" lettering. */
  private buildShell(floorY: number): void {
    const scene = this.scene;
    const P = OFFICE_PIT;
    const w = P.x1 - P.x0;
    const d = P.z1 - P.z0;
    const wallMat = new StandardMaterial("agentPitWall", scene);
    wallMat.diffuseColor = Color3.FromHexString("#1d2b4a");
    wallMat.emissiveColor = Color3.FromHexString("#0e1a33");
    wallMat.specularColor = Color3.Black();
    const wall = (name: string, ww: number, dd: number, x: number, z: number): void => {
      const m = MeshBuilder.CreateBox(`agent_${name}`, { width: ww, depth: dd, height: -floorY }, scene);
      m.position.set(x, floorY / 2, z);
      m.material = wallMat;
    };
    wall("pit_l", 0.4, d + 0.8, P.x0 - 0.2, (P.z0 + P.z1) / 2);
    wall("pit_r", 0.4, d + 0.8, P.x1 + 0.2, (P.z0 + P.z1) / 2);
    wall("pit_f", w, 0.4, (P.x0 + P.x1) / 2, P.z0 - 0.2);
    wall("pit_b", w, 0.4, (P.x0 + P.x1) / 2, P.z1 + 0.2);

    // Glowing grid floor
    const tex = new DynamicTexture("agentFloorTex", { width: 1024, height: 700 }, scene, true);
    const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
    ctx.fillStyle = "#35557f";
    ctx.fillRect(0, 0, 1024, 700);
    ctx.strokeStyle = "rgba(110,193,255,0.55)";
    ctx.lineWidth = 2;
    for (let x = 0; x <= 1024; x += 34) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 700);
      ctx.stroke();
    }
    for (let y = 0; y <= 700; y += 34) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "#6ec1ff";
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 1016, 692);
    tex.update();
    const floorMat = new StandardMaterial("agentFloorMat", scene);
    floorMat.diffuseTexture = tex;
    floorMat.emissiveColor = new Color3(0.5, 0.55, 0.65);
    floorMat.specularColor = Color3.Black();
    const slab = MeshBuilder.CreateBox("agent_floor", { width: w, depth: d, height: 0.2 }, scene);
    slab.position.set((P.x0 + P.x1) / 2, floorY - 0.1, (P.z0 + P.z1) / 2);
    slab.material = floorMat;
  }

  private buildGroup(
    id: string,
    name: string,
    accent: string,
    home: Vector3,
    subAgents: { name: string; description: string }[],
    floorY: number,
    colour: (hex: string, emissive?: number) => StandardMaterial,
  ): AgentGroup {
    const scene = this.scene;
    const cx = home.x;
    const cz = home.z + 0.6;
    const dimmable: Mesh[] = [];
    const track = <T extends Mesh>(m: T): T => {
      dimmable.push(m);
      return m;
    };

    // Agent bay: a glowing accent pad with a bright frame.
    const pad = MeshBuilder.CreateBox(`agent_pad_${id}`, { width: 6.2, depth: 5.0, height: 0.06 }, scene);
    pad.position.set(cx, floorY + 0.03, cz);
    pad.material = colour(accent, 0.8);
    track(pad);
    for (const [fw, fd, fx, fz] of [
      [6.2, 0.14, 0, -2.5],
      [6.2, 0.14, 0, 2.5],
      [0.14, 5.0, -3.1, 0],
      [0.14, 5.0, 3.1, 0],
    ] as const) {
      const edge = MeshBuilder.CreateBox(`agent_edge_${id}_${fx}_${fz}`, { width: fw, depth: fd, height: 0.1 }, scene);
      edge.position.set(cx + fx, floorY + 0.06, cz + fz);
      edge.material = colour("#6ec1ff", 1);
      track(edge);
    }

    // Robots (the sub-agents) standing in the bay.
    const robots: Robot[] = [];
    const count = Math.max(1, subAgents.length);
    for (let i = 0; i < count; i++) {
      const sub = subAgents[i];
      const x = cx + (i - (count - 1) / 2) * 3.0;
      const robot = this.buildRobot(`${id}_${i}`, accent, colour, sub?.name ?? `Agent ${name} #${i + 1}`, track);
      robot.node.position.set(x, floorY, cz);
      robots.push(robot);
    }

    // Data beam linking the human desk to the agent bay.
    const beamMat = new StandardMaterial(`agent_beamMat_${id}`, scene);
    beamMat.diffuseColor = Color3.FromHexString("#6ec1ff");
    beamMat.emissiveColor = Color3.FromHexString("#6ec1ff");
    beamMat.disableLighting = true;
    beamMat.alpha = 0.15;
    const beam = MeshBuilder.CreateCylinder(
      `agent_beam_${id}`,
      { diameter: 0.5, height: -floorY, tessellation: 12 },
      scene,
    );
    beam.position.set(cx, floorY / 2, cz);
    beam.material = beamMat;
    beam.isPickable = false;
    track(beam);

    // Spotlight: a cone of light from the human down to the agent bay, plus a
    // pulsing ring on the agent floor. Hidden until the human is selected.
    const coneMat = new StandardMaterial(`agent_coneMat_${id}`, scene);
    coneMat.diffuseColor = Color3.FromHexString("#fff3c4");
    coneMat.emissiveColor = Color3.FromHexString("#fff3c4");
    coneMat.disableLighting = true;
    coneMat.alpha = 0.22;
    const coneTop = 3.6;
    const cone = MeshBuilder.CreateCylinder(
      `agent_cone_${id}`,
      { diameterTop: 0.5, diameterBottom: 8, height: coneTop - floorY, tessellation: 24 },
      scene,
    );
    cone.position.set(cx, (coneTop + floorY) / 2, cz);
    cone.material = coneMat;
    cone.isPickable = false;
    cone.setEnabled(false);
    const ring = MeshBuilder.CreateTorus(
      `agent_ring_${id}`,
      { diameter: 6.4, thickness: 0.18, tessellation: 40 },
      scene,
    );
    ring.position.set(cx, floorY + 0.15, cz);
    ring.material = colour("#ffe08a", 1);
    ring.isPickable = false;
    ring.setEnabled(false);

    return {
      robots,
      dimmable,
      beamMat,
      cone,
      coneMat,
      ring,
      floorY,
      phase: Math.random() * 6,
    };
  }

  /** A small voxel robot with a floating name tag. */
  private buildRobot(
    tag: string,
    accent: string,
    colour: (hex: string, emissive?: number) => StandardMaterial,
    fullName: string,
    track: <T extends Mesh>(m: T) => T,
  ): Robot {
    const scene = this.scene;
    const node = new TransformNode(`agent_robot_${tag}`, scene);
    node.scaling.setAll(OFFICE_CHARACTER_SCALE * 1.3);
    const part = (
      name: string,
      w: number,
      h: number,
      d: number,
      y: number,
      mat: StandardMaterial,
      x = 0,
      z = 0,
    ): Mesh => {
      const m = MeshBuilder.CreateBox(`agent_${tag}_${name}`, { width: w, height: h, depth: d }, scene);
      m.parent = node;
      m.position.set(x, y, z);
      m.material = mat;
      m.isPickable = false;
      return track(m);
    };
    const metal = colour("#dfeaf7", 0.35);
    const dark = colour("#16213a", 0.1);
    const body = colour(accent, 0.45);
    const glow = colour("#6ec1ff", 1);
    part("legL", 0.28, 0.55, 0.3, 0.28, dark, -0.18);
    part("legR", 0.28, 0.55, 0.3, 0.28, dark, 0.18);
    part("body", 0.8, 0.75, 0.48, 0.92, body);
    part("chest", 0.32, 0.28, 0.06, 0.95, glow, 0, -0.26);
    part("armL", 0.2, 0.62, 0.22, 0.9, metal, -0.52);
    part("armR", 0.2, 0.62, 0.22, 0.9, metal, 0.52);
    part("head", 0.62, 0.5, 0.52, 1.52, metal);
    part("visor", 0.5, 0.2, 0.06, 1.54, dark, 0, -0.27);
    part("eyeL", 0.1, 0.08, 0.04, 1.54, glow, -0.12, -0.31);
    part("eyeR", 0.1, 0.08, 0.04, 1.54, glow, 0.12, -0.31);
    part("mast", 0.06, 0.3, 0.06, 1.9, metal);
    const tip = part("tip", 0.16, 0.16, 0.16, 2.1, glow);

    // Name tag: billboard plane painted with the agent's name and role.
    const [agent, role] = fullName.split(" — ");
    const plane = MeshBuilder.CreatePlane(`agent_tag_${tag}`, { width: 4.2, height: 1.1 }, scene);
    plane.parent = node;
    plane.position.y = 2.7;
    plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
    plane.isPickable = false;
    const tex = new DynamicTexture(`agent_tagTex_${tag}`, { width: 512, height: 135 }, scene, false);
    const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
    ctx.fillStyle = "rgba(16,26,48,0.92)";
    ctx.fillRect(0, 0, 512, 135);
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, 14, 135);
    ctx.fillStyle = "#6ec1ff";
    ctx.fillRect(14, 0, 498, 4);
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 44px sans-serif";
    ctx.fillText(agent, 34, 46);
    ctx.fillStyle = "#9fd4ff";
    ctx.font = "34px sans-serif";
    ctx.fillText(role ?? "AI agent", 34, 98);
    tex.update();
    const tagMat = new StandardMaterial(`agent_tagMat_${tag}`, scene);
    tagMat.diffuseTexture = tex;
    tagMat.emissiveColor = new Color3(0.9, 0.9, 0.9);
    tagMat.specularColor = Color3.Black();
    tagMat.disableLighting = true;
    plane.material = tagMat;
    // Hidden until the human above is selected; then it floats above the
    // human layer at the top of the spotlight cone.
    plane.scaling.setAll(0.55);
    plane.position.y = (4.9 + OFFICE_PIT.depth) / node.scaling.y;
    plane.setEnabled(false);

    return { node, tip, label: plane };
  }

  /** Floating "HUMAN TEAM" / "AI AGENT TEAM" layer markers at the left edge. */
  private buildLayerLabels(floorY: number): void {
    const scene = this.scene;
    const label = (text: string, sub: string, hex: string, y: number): void => {
      const plane = MeshBuilder.CreatePlane(`agent_layerLabel_${text}`, { width: 9, height: 2.1 }, scene);
      plane.position.set(-42, y, 8);
      plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
      plane.isPickable = false;
      const tex = new DynamicTexture(`agent_layerTex_${text}`, { width: 768, height: 180 }, scene, false);
      const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
      ctx.fillStyle = "rgba(16,26,48,0.94)";
      ctx.fillRect(0, 0, 768, 180);
      ctx.fillStyle = hex;
      ctx.fillRect(0, 0, 768, 10);
      ctx.fillRect(0, 170, 768, 10);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 66px sans-serif";
      ctx.fillText(text, 384, 76);
      ctx.fillStyle = "#b9c4dd";
      ctx.font = "34px sans-serif";
      ctx.fillText(sub, 384, 134);
      tex.update();
      const m = new StandardMaterial(`agent_layerMat_${text}`, scene);
      m.diffuseTexture = tex;
      m.emissiveColor = new Color3(0.9, 0.9, 0.9);
      m.specularColor = Color3.Black();
      m.disableLighting = true;
      plane.material = m;
    };
    label("HUMAN TEAM", "Caldova Client Operations", "#c9a14a", 5.2);
    label("AI AGENT TEAM", "Foundry agents under the hood", "#6ec1ff", floorY + 5);
  }
}

interface Robot {
  node: TransformNode;
  tip: Mesh;
  label: Mesh;
}

interface AgentGroup {
  robots: Robot[];
  dimmable: Mesh[];
  beamMat: StandardMaterial;
  cone: Mesh;
  coneMat: StandardMaterial;
  ring: Mesh;
  floorY: number;
  phase: number;
}
