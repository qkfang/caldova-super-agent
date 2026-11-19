/**
 * Level 1 · The Agents — one Microsoft Foundry agent under each person.
 *
 * Every pod sits directly under its human's desk on Level 2 and holds the
 * agent's two specialised assistants (small voxel robots, named in
 * stepGate.ts). In the middle of the floor is the shared Member Case that
 * every agent reads from and writes to, wired to the pods by glowing traces
 * that carry data packets back and forth.
 */
import { Color3, Mesh, MeshBuilder, StandardMaterial, Texture, TransformNode, Vector3 } from "@babylonjs/core";
import { STAFF_PERSONAS } from "../../personaData";
import { STAGE_CONFIG } from "../../stepGate";
import { Batch, Kit } from "../kit";
import { AGENTS, levelInfo } from "../lakehouseData";
import { FLOOR_Y, SLABS, STATIONS, WALLS } from "../layout";
import { buildShell } from "../shell";
import type { Anchor, Highlights, LevelBuild } from "../types";

const HUB = { x: 0, z: -1.25 };
const BUS_Z = -1.25;

interface Robot {
  node: TransformNode;
  tip: Mesh;
  phase: number;
}

interface Pod {
  id: string;
  node: TransformNode;
  robots: Robot[];
  ring: Mesh;
  pad: StandardMaterial;
  padBase: Color3;
  power: number;
}

interface Packet {
  mesh: Mesh;
  path: Vector3[];
  length: number;
  speed: number;
  offset: number;
}

/** A small voxel robot (one of an agent's assistants), merged into a few meshes. */
function buildRobot(kit: Kit, accent: string, tag: string): Robot {
  const node = new TransformNode(`v2_robot_${tag}`, kit.scene);
  const rb = new Batch(kit, node, `robot_${tag}`);
  const prev = kit.useBatch(rb);
  const metal = kit.mat("#dfeaf7", { emissive: 0.25 });
  const dark = kit.mat("#16213a");
  const body = kit.mat(accent, { emissive: 0.35 });
  const glow = kit.mat("#6ec1ff", { unlit: true, glow: true });
  kit.block(node, -0.18, 0, 0, 0.28, 0.55, 0.3, dark);
  kit.block(node, 0.18, 0, 0, 0.28, 0.55, 0.3, dark);
  kit.block(node, 0, 0.55, 0, 0.8, 0.75, 0.48, body);
  kit.block(node, 0, 0.8, -0.26, 0.32, 0.28, 0.06, glow);
  kit.block(node, -0.52, 0.6, 0, 0.2, 0.62, 0.22, metal);
  kit.block(node, 0.52, 0.6, 0, 0.2, 0.62, 0.22, metal);
  kit.block(node, 0, 1.27, 0, 0.62, 0.5, 0.52, metal);
  kit.block(node, 0, 1.42, -0.27, 0.5, 0.2, 0.06, dark);
  kit.block(node, -0.12, 1.46, -0.31, 0.1, 0.08, 0.04, glow);
  kit.block(node, 0.12, 1.46, -0.31, 0.1, 0.08, 0.04, glow);
  kit.block(node, 0, 1.77, 0, 0.06, 0.3, 0.06, metal);
  kit.useBatch(prev);
  rb.flush();
  const tip = kit.block(node, 0, 2.03, 0, 0.16, 0.16, 0.16, glow, { dynamic: true });
  return { node, tip, phase: Math.random() * 6 };
}

export function buildAgentsLevel(kit: Kit): LevelBuild {
  const scene = kit.scene;
  const root = new TransformNode("v2_lvl_agents", scene);
  const batch = new Batch(kit, root, "agents");
  kit.useBatch(batch);
  const y = FLOOR_Y.agents;
  const info = levelInfo("agents");

  // Glowing grid floor, one cell every two units.
  const gridTex = kit.canvas("v2_agentGrid", 128, 128, (ctx, w, h) => {
    ctx.fillStyle = "#13233f";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(110,193,255,0.55)";
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, w, h);
  });
  gridTex.wrapU = Texture.WRAP_ADDRESSMODE;
  gridTex.wrapV = Texture.WRAP_ADDRESSMODE;
  const gridMat = new StandardMaterial("v2_agentGridMat", scene);
  gridMat.diffuseTexture = gridTex;
  gridMat.emissiveColor = new Color3(0.42, 0.48, 0.6);
  gridMat.specularColor = Color3.Black();
  buildShell(kit, {
    root,
    level: info,
    floorY: y,
    slab: SLABS.agents,
    walls: WALLS.agents,
    floor: gridMat,
    back: kit.mat("#1b2740"),
  });

  const back = kit.label(root, {
    lines: [
      { text: "MICROSOFT FOUNDRY AGENTS", size: 64, weight: 800, color: "#5ce1ff" },
      { text: "One agent for every person · one shared Member Case", size: 34, weight: 500, color: "#c6d2e6" },
    ],
    width: 13,
    px: 1024,
  });
  back.position.set(0, y + 3.9, WALLS.agents.z1 - 0.2);

  const frameMat = kit.mat("#6ec1ff", { unlit: true, glow: true });
  const traceMat = kit.mat("#2e7fbf", { emissive: 0.6 });
  const pods: Pod[] = [];
  const anchors = new Map<string, Anchor>();

  /* ---------------- Agent pods ---------------- */
  for (const p of STAFF_PERSONAS) {
    const st = STATIONS[p.id];
    const agent = AGENTS[p.id];
    if (!st || !agent) continue;
    const cz = st.z + 0.2;
    const padMat = new StandardMaterial(`v2_pad_${p.id}`, scene);
    const padBase = Color3.FromHexString(p.color);
    padMat.diffuseColor = padBase.scale(0.6);
    padMat.emissiveColor = padBase.scale(0.35);
    padMat.specularColor = Color3.Black();
    kit.block(root, st.x, y, cz, 6.2, 0.06, 5.0, padMat);
    for (const [fw, fd, fx, fz] of [
      [6.2, 0.14, 0, -2.5],
      [6.2, 0.14, 0, 2.5],
      [0.14, 5.0, -3.1, 0],
      [0.14, 5.0, 3.1, 0],
    ] as const) {
      kit.block(root, st.x + fx, y + 0.02, cz + fz, fw, 0.08, fd, frameMat);
    }
    // Trace from the Member Case bus to the pod's edge.
    const edge = st.z < 0 ? cz + 2.5 : cz - 2.5;
    const zMid = (BUS_Z + edge) / 2;
    kit.block(root, st.x, y + 0.01, zMid, 0.14, 0.04, Math.abs(edge - BUS_Z), traceMat);

    const node = new TransformNode(`v2_pod_${p.id}`, scene);
    node.parent = root;
    node.position.set(st.x, y, cz);
    anchors.set(`agent:${p.id}`, { node, group: "agents", dy: 2.1 });

    const subAgents = Object.values(STAGE_CONFIG).find((s) => s.role === p.role)?.agents ?? [];
    const robots: Robot[] = [];
    const count = Math.max(1, subAgents.length);
    for (let i = 0; i < count; i++) {
      const robot = buildRobot(kit, p.color, `${p.id}_${i}`);
      robot.node.parent = node;
      robot.node.scaling.setAll(1.25);
      robot.node.position.set((i - (count - 1) / 2) * 2.7, 0, 0.2);
      robots.push(robot);
    }

    const panel = kit.label(node, {
      lines: [
        { text: p.agent_name, size: 46, weight: 800, color: p.color },
        { text: agent.foundryId, size: 34, weight: 600, color: "#9fd4ff" },
        { text: `${subAgents.length} assistants · works for ${p.name}`, size: 28, weight: 500, color: "#c6d2e6" },
      ],
      width: 5.0,
      px: 640,
      bg: "rgba(10,20,40,0.82)",
      accent: p.color,
      bar: "left",
      align: "left",
    });
    panel.billboardMode = Mesh.BILLBOARDMODE_Y;
    panel.position.set(0, 4.05, 1.9);

    const ring = MeshBuilder.CreateTorus(`v2_podRing_${p.id}`, { diameter: 7.4, thickness: 0.2, tessellation: 48 }, scene);
    ring.position.set(st.x, y + 0.14, cz);
    kit.finish(ring, root, kit.mat("#ffe08a", { unlit: true, glow: true }), true);
    ring.setEnabled(false);
    kit.hitbox(root, st.x, y, cz, 6.2, 3.8, 5.0, { type: "agent", id: p.id });
    pods.push({ id: p.id, node, robots, ring, pad: padMat, padBase, power: 1 });
  }

  // The bus that links every pod to the Member Case.
  const xs = Object.values(STATIONS).map((s) => s.x);
  const busX0 = Math.min(...xs);
  const busX1 = Math.max(...xs);
  kit.block(root, (busX0 + busX1) / 2, y + 0.01, BUS_Z, busX1 - busX0 + 0.14, 0.04, 0.14, traceMat);

  /* ---------------- Cara's voice agent and Theo's group chat ---------------- */
  const cara = STATIONS["comms-1"];
  const eqBars: Mesh[] = [];
  const eqMat = kit.mat("#ec4899", { unlit: true, glow: true });
  for (let i = 0; i < 5; i++) {
    eqBars.push(kit.block(root, cara.x + 2.0 + i * 0.22, y + 0.1, cara.z + 2.2, 0.14, 1, 0.14, eqMat, { dynamic: true }));
  }
  const voiceTag = kit.label(root, {
    lines: [{ text: "voice agent", size: 40, weight: 700, color: "#fbcfe8" }],
    width: 1.9,
    px: 320,
    pxHeight: 70,
    bg: "rgba(10,20,40,0.82)",
  });
  voiceTag.billboardMode = Mesh.BILLBOARDMODE_Y;
  voiceTag.position.set(cara.x + 2.45, y + 2.2, cara.z + 2.2);

  const theo = STATIONS["lead-1"];
  const chatRing = MeshBuilder.CreateTorus("v2_groupChat", { diameter: 5.6, thickness: 0.08, tessellation: 40 }, scene);
  chatRing.position.set(theo.x, y + 3.2, theo.z + 0.2);
  kit.finish(chatRing, root, kit.mat("#14b8a6", { unlit: true, glow: true }), true);
  const chatTag = kit.label(root, {
    lines: [{ text: "group chat", size: 40, weight: 700, color: "#99f6e4" }],
    width: 1.9,
    px: 320,
    pxHeight: 70,
    bg: "rgba(10,20,40,0.82)",
  });
  chatTag.billboardMode = Mesh.BILLBOARDMODE_Y;
  chatTag.position.set(theo.x - 2.6, y + 3.4, theo.z + 0.2);

  /* ---------------- The Member Case hub ---------------- */
  const steel = kit.mat("#1e2433", { specular: 0.3 });
  kit.cyl(root, HUB.x, y, HUB.z, 2.6, 0.7, steel, { tess: 24 });
  const hubRingFloor = MeshBuilder.CreateTorus("v2_hubFloorRing", { diameter: 2.4, thickness: 0.1, tessellation: 32 }, scene);
  hubRingFloor.position.set(HUB.x, y + 0.72, HUB.z);
  kit.finish(hubRingFloor, root, kit.mat("#ffc35a", { unlit: true, glow: true }));
  const hub = new TransformNode("v2_memberCase", scene);
  hub.parent = root;
  hub.position.set(HUB.x, y + 1.9, HUB.z);
  const caseCube = kit.block(hub, 0, -0.55, 0, 1.1, 1.1, 1.1, kit.mat("#ffc35a", { emissive: 0.55, glow: true }), {
    dynamic: true,
  });
  kit.block(caseCube, 0.22, 0.55, 0, 0.5, 0.14, 0.9, kit.mat("#fff1c9", { emissive: 0.6 }), { dynamic: true });
  const hubRings = [1.9, 2.5].map((d, i) => {
    const ring = MeshBuilder.CreateTorus(`v2_hubRing${i}`, { diameter: d, thickness: 0.07, tessellation: 40 }, scene);
    kit.finish(ring, hub, kit.mat("#5ce1ff", { unlit: true, glow: true }), true);
    return ring;
  });
  const hubTag = kit.label(root, {
    lines: [
      { text: "MEMBER CASE", size: 52, weight: 800, color: "#ffd98a" },
      { text: "the one record every agent shares", size: 30, weight: 500, color: "#c6d2e6" },
    ],
    width: 4.2,
    px: 560,
    bg: "rgba(10,20,40,0.82)",
  });
  hubTag.billboardMode = Mesh.BILLBOARDMODE_Y;
  hubTag.position.set(HUB.x, y + 3.75, HUB.z);
  anchors.set("hub", { node: hub, group: "agents", dy: 0 });

  /* ---------------- Data packets ---------------- */
  const packetMat = kit.mat("#ffffff", { unlit: true, glow: true });
  const packets: Packet[] = [];
  for (const [i, p] of STAFF_PERSONAS.entries()) {
    const st = STATIONS[p.id];
    const cz = st.z + 0.2;
    const edge = st.z < 0 ? cz + 2.5 : cz - 2.5;
    const path = [
      new Vector3(HUB.x + (st.x > 0 ? 1.3 : -1.3), y + 0.2, BUS_Z),
      new Vector3(st.x, y + 0.2, BUS_Z),
      new Vector3(st.x, y + 0.2, edge),
    ];
    let length = 0;
    for (let k = 1; k < path.length; k++) length += Vector3.Distance(path[k - 1], path[k]);
    for (let j = 0; j < 2; j++) {
      const mesh = kit.block(root, 0, 0, 0, 0.28, 0.16, 0.28, packetMat, { dynamic: true });
      packets.push({ mesh, path, length, speed: 3 + (i % 3) * 0.6, offset: j * 0.5 + i * 0.13 });
    }
  }

  kit.useBatch(null);
  batch.flush();

  let selected: ReadonlySet<string> = new Set();
  let introT = -1;
  const pointOnPath = (pk: Packet, f: number, out: Vector3): void => {
    // Ping-pong along the polyline so packets go out to the pod and come back.
    const u = f < 0.5 ? f * 2 : 2 - f * 2;
    let d = u * pk.length;
    for (let k = 1; k < pk.path.length; k++) {
      const seg = Vector3.Distance(pk.path[k - 1], pk.path[k]);
      if (d <= seg || k === pk.path.length - 1) {
        Vector3.LerpToRef(pk.path[k - 1], pk.path[k], Math.min(1, d / seg), out);
        return;
      }
      d -= seg;
    }
  };

  return {
    id: "agents",
    root,
    anchors,
    update(dt: number, t: number): void {
      if (introT >= 0) introT += dt;
      pods.forEach((pod, i) => {
        const on = selected.has(pod.id);
        // Pods power up one after another during the chapter intro.
        const target = introT >= 0 ? Math.min(1, Math.max(0, (introT - i * 0.18) / 0.5)) : 1;
        pod.power = target;
        const glow = (0.12 + 0.28 * pod.power) * (on ? 1.6 : 1);
        pod.pad.emissiveColor.copyFrom(pod.padBase).scaleInPlace(glow);
        pod.robots.forEach((rb, k) => {
          const amp = on ? 0.3 : 0.08;
          const speed = on ? 5 : 1.8;
          rb.node.position.y = Math.abs(Math.sin(t * speed + rb.phase + k)) * amp * pod.power;
          rb.tip.scaling.setAll(1 + 0.35 * Math.sin(t * 5 + k + rb.phase));
        });
        if (on) pod.ring.scaling.setAll(1 + Math.sin(t * 5) * 0.05);
      });
      if (introT > 3) introT = -1;
      hub.rotation.y = t * 0.8;
      caseCube.rotation.y = t * 0.6;
      caseCube.position.y = Math.sin(t * 1.8) * 0.12;
      hubRings[0].rotation.x = t * 1.1;
      hubRings[1].rotation.z = t * 0.9;
      const tmp = new Vector3();
      for (const pk of packets) {
        const f = ((t * pk.speed) / (pk.length * 2) + pk.offset) % 1;
        pointOnPath(pk, f, tmp);
        pk.mesh.position.copyFrom(tmp);
      }
      eqBars.forEach((bar, i) => {
        bar.scaling.y = 0.4 + Math.abs(Math.sin(t * (4 + i * 0.7) + i)) * 1.4;
        bar.position.y = y + 0.1 + bar.scaling.y / 2;
      });
      chatRing.rotation.y = t * 0.6;
      chatRing.position.y = y + 3.2 + Math.sin(t * 1.5) * 0.1;
    },
    setHighlights(h: Highlights): void {
      selected = h.agents;
      for (const pod of pods) pod.ring.setEnabled(selected.has(pod.id));
    },
    intro(): void {
      introT = 0;
    },
  };
}
