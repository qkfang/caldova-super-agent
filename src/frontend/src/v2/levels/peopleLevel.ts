/**
 * Level 2 · The People — two small teams, one for each side of the
 * business, at standing desks: the Wealth Management Team on the left, the
 * Superannuation Team on the right, and Theo in the middle leading both.
 * Every desk sits directly above that person's agent bay on Level 1, so the
 * thread between a person and their agent runs straight down through the
 * floor. Through the day people move about the floor: to the huddle table
 * where both teams meet, the coffee bar, the printer and the team boards,
 * and to each other's desks.
 */
import { Color3, Mesh, MeshBuilder, TransformNode } from "@babylonjs/core";
import { PALETTES } from "../../characterPalettes";
import { STAFF_PERSONAS, findStaffById } from "../../personaData";
import { VoxelCharacter } from "../../voxelCharacter";
import { Batch, type Kit, rng } from "../kit";
import { IDEA, SIDES, levelInfo } from "../lakehouseData";
import { CENTRE_CELL, CHARACTER_SCALE, FLOOR_Y, SLABS, STATIONS, WALLS, WINGS } from "../layout";
import { buildShell } from "../shell";
import type { Anchor, Highlights, LevelBuild } from "../types";
import { SpotBook, Wanderer, type Outing, type Pt, type Spot } from "../wander";

const CORAL = Color3.FromHexString("#ff8f6b");
const LEAD = "#6b7fb0";
/** The aisle between the two rows of desks. */
const CZ = -1.5;

type Errand = "coffee" | "huddle" | "printer" | "process" | "wealthBoard" | "superBoard" | "lookout" | `visit:${string}`;

/** Where each person likes to go, and how often (the visits are to their own teammates and Theo). */
const ERRANDS: Record<string, Array<[Errand, number]>> = {
  "onboarding-1": [["printer", 2], ["huddle", 2], ["coffee", 2], ["visit:benefits-1", 1], ["visit:lead-1", 1], ["visit:fincrime-1", 1], ["superBoard", 1], ["lookout", 1]],
  "benefits-1": [["huddle", 2], ["superBoard", 2], ["coffee", 1], ["visit:onboarding-1", 1], ["visit:payments-1", 1], ["visit:investments-1", 1]],
  "transfers-1": [["visit:payments-1", 2], ["coffee", 2], ["huddle", 1], ["superBoard", 1], ["lookout", 1]],
  "payments-1": [["visit:lead-1", 2], ["coffee", 2], ["printer", 1], ["visit:transfers-1", 1], ["superBoard", 1]],
  "investments-1": [["wealthBoard", 2], ["visit:comms-1", 1], ["visit:benefits-1", 1], ["huddle", 1], ["coffee", 1], ["lookout", 1]],
  "comms-1": [["huddle", 2], ["visit:onboarding-1", 1], ["visit:investments-1", 1], ["visit:payments-1", 1], ["coffee", 1], ["wealthBoard", 1]],
  "fincrime-1": [["visit:lead-1", 2], ["visit:onboarding-1", 1], ["printer", 1], ["lookout", 1], ["coffee", 1]],
  "lead-1": [["huddle", 2], ["process", 2], ["visit:onboarding-1", 1], ["visit:benefits-1", 1], ["visit:investments-1", 1], ["visit:payments-1", 1], ["visit:comms-1", 1], ["coffee", 1], ["lookout", 1]],
};

export interface PeopleLevelBuild extends LevelBuild {
  /** What a person is doing right now, for the inspector. */
  task(id: string): string | null;
}

export function buildPeopleLevel(kit: Kit): PeopleLevelBuild {
  const scene = kit.scene;
  const root = new TransformNode("v2_lvl_people", scene);
  const batch = new Batch(root, "people");
  kit.useBatch(batch);
  const y = FLOOR_Y.people;
  const info = levelInfo("people");

  const oak = kit.mat("#fff4e2", { texture: "oak" });
  const cedar = kit.mat("#ffffff", { texture: "cedar" });
  const walnut = kit.mat("#ffffff", { texture: "walnut" });
  const white = kit.mat("#f4f1ea");
  const steel = kit.mat("#2b3240", { specular: 0.25 });
  const leaf = kit.mat("#5ea347");
  const leafDark = kit.mat("#3f7f3a");
  const pot = kit.mat("#d8d2c6");
  const { tag } = buildShell(kit, {
    root,
    level: info,
    floorY: y,
    slab: SLABS.people,
    walls: WALLS.people,
    floor: oak,
    back: cedar,
    rail: true,
  });

  /* ---------------- The two wings ---------------- */
  // Mid-tone rugs (each side's colour, about L* 64 once lit): pale ones wash out to white under the
  // sun and sky, and then the white desks and everything else on the floor disappears into them.
  const rugZ0 = -10.2;
  const rugZ1 = 7.8;
  const rug = (x0: number, x1: number, hex: string): void => {
    kit.block(root, (x0 + x1) / 2, y, (rugZ0 + rugZ1) / 2, x1 - x0 - 0.3, 0.05, rugZ1 - rugZ0, kit.mat(hex));
  };
  rug(WINGS.wealth.x0, WINGS.wealth.x1, "#86734d");
  rug(WINGS.lead.x0, WINGS.lead.x1, "#707da7");
  rug(WINGS.super.x0, WINGS.super.x1, "#3a8787");
  const floorText = (text: string, x: number, z: number, width: number, color: string): void => {
    const decal = kit.label(root, {
      lines: [{ text, size: 60, weight: 800, color }],
      width,
      px: 1024,
      pxHeight: 100,
    });
    decal.rotation.x = Math.PI / 2;
    decal.position.set(x, y + 0.07, z);
  };
  const wealthX = (WINGS.wealth.x0 + WINGS.wealth.x1) / 2;
  const superX = (WINGS.super.x0 + WINGS.super.x1) / 2;
  floorText("WEALTH MANAGEMENT TEAM", wealthX, -8.6, 12, "#3d2b06");
  floorText("SUPERANNUATION TEAM", superX, -8.6, 11, "#053b36");
  floorText("LEADING BOTH TEAMS", 0, 1.0, 6.4, "#1c2550");

  // A sign for each side on the back wall: the side's name and its products.
  const sideSign = (side: "wealth" | "super", x: number, ink: string): void => {
    const s = SIDES[side];
    const sign = kit.label(root, {
      lines: [
        { text: s.name.toUpperCase(), size: 60, weight: 800, color: ink },
        { text: s.products.join(" · "), size: 32, weight: 600, color: "#3b4557" },
      ],
      width: 6.6,
      px: 768,
      bg: "rgba(255,251,242,0.94)",
      accent: s.color,
      bar: "top",
    });
    sign.position.set(x, y + 3.35, WALLS.people.z1 - 0.32);
  };
  sideSign("wealth", wealthX + 0.4, "#8a6a1f");
  sideSign("super", superX - 0.4, "#0f766e");

  // One process for both sides, on the back wall behind Theo.
  const process = kit.canvas("v2_processBoard", 1024, 300, (ctx, w, h) => {
    ctx.fillStyle = "#0f1a2e";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#ffc35a";
    ctx.font = '800 40px "Segoe UI", sans-serif';
    ctx.fillText("ONE PROCESS FOR BOTH SIDES", 40, 64);
    const colW = (w - 80) / IDEA.lifecycle.length;
    IDEA.lifecycle.forEach((step, i) => {
      const x = 40 + i * colW;
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(x, 104, colW - 18, 150);
      ctx.fillStyle = ["#0ea5e9", "#ef4444", "#6366f1", "#a855f7", "#ec4899"][i];
      ctx.fillRect(x, 104, colW - 18, 10);
      ctx.fillStyle = "#ffffff";
      ctx.font = '800 64px "Segoe UI", sans-serif';
      ctx.fillText(String(i + 1), x + 18, 194);
      ctx.font = '700 34px "Segoe UI", sans-serif';
      ctx.fillText(step, x + 18, 238);
    });
  });
  const board = MeshBuilder.CreatePlane("v2_processBoardPlane", { width: 7.6, height: 2.2 }, scene);
  board.position.set(0, y + 3.2, WALLS.people.z1 - 0.32);
  kit.finish(board, root, kit.screen(process));

  /* ---------------- Desks and the two teams ---------------- */
  const deskTop = kit.mat("#f8f4ec");
  const laptop = kit.mat("#c7ccd6", { specular: 0.4 });
  const dark = kit.mat("#1f2937");
  const paper = kit.mat("#ffffff");
  const characters = new Map<string, VoxelCharacter>();
  const rings = new Map<string, Mesh>();
  const anchors = new Map<string, Anchor>();
  for (const p of STAFF_PERSONAS) {
    const st = STATIONS[p.id];
    if (!st) continue;
    const dz = st.z - 0.4;
    const accent = kit.mat(p.color);
    kit.block(root, st.x, y + 1.5, dz, 3.6, 0.12, 1.3, deskTop);
    kit.block(root, st.x - 1.65, y, dz, 0.14, 1.5, 1.2, white);
    kit.block(root, st.x + 1.65, y, dz, 0.14, 1.5, 1.2, white);
    kit.block(root, st.x, y + 0.3, dz - 0.62, 3.3, 1.1, 0.06, accent);
    const nameTag = kit.label(root, {
      lines: [
        { text: p.name.toUpperCase(), size: 62, weight: 800 },
        { text: p.department, size: 32, weight: 600, color: "#e6ecf5" },
      ],
      width: 3.0,
      px: 512,
      bg: "rgba(10,18,34,0.94)",
      accent: p.color,
      bar: "top",
    });
    nameTag.position.set(st.x, y + 0.86, dz - 0.67);
    // Laptop: the lid faces the person, so the camera sees its back.
    const top = y + 1.62;
    kit.block(root, st.x - 0.3, top, dz + 0.1, 0.95, 0.05, 0.62, laptop);
    const lid = kit.block(root, st.x - 0.3, top, dz - 0.22, 0.95, 0.64, 0.05, laptop);
    lid.rotation.x = -0.22;
    // A desk prop that says something about the role.
    const px = st.x + 1.05;
    switch (p.id) {
      case "onboarding-1":
        kit.block(root, px, top, dz, 0.9, 0.12, 0.7, dark);
        for (let i = 0; i < 4; i++) kit.block(root, px, top + 0.12 + i * 0.05, dz, 0.75, 0.04, 0.55, paper);
        break;
      case "benefits-1":
        ["#6366f1", "#0ea5e9", "#f59e0b"].forEach((hex, i) =>
          kit.block(root, px, top + i * 0.2, dz, 0.8, 0.18, 0.6, kit.mat(hex)),
        );
        break;
      case "transfers-1":
        kit.cyl(root, px, top, dz, 0.2, 0.25, steel, { tess: 8 });
        kit.block(root, px, top + 0.25, dz, 0.55, 0.55, 0.55, kit.mat("#38bdf8"));
        kit.block(root, px, top + 0.4, dz, 0.6, 0.25, 0.6, kit.mat("#34d399"));
        break;
      case "payments-1":
        kit.block(root, px, top, dz, 0.6, 0.12, 0.8, dark);
        kit.block(root, px, top + 0.12, dz - 0.18, 0.45, 0.03, 0.3, kit.mat("#a7f3d0", { unlit: true }));
        break;
      case "investments-1":
        [0.3, 0.55, 0.42, 0.75].forEach((h, i) =>
          kit.block(root, px - 0.3 + i * 0.2, top, dz, 0.15, h, 0.3, kit.mat(i === 3 ? "#f59e0b" : "#fcd34d")),
        );
        break;
      case "comms-1":
        kit.block(root, px, top, dz, 0.12, 0.45, 0.12, steel);
        kit.block(root, px, top + 0.45, dz, 0.7, 0.12, 0.16, dark);
        kit.block(root, px - 0.32, top + 0.25, dz, 0.16, 0.28, 0.28, kit.mat("#ec4899"));
        kit.block(root, px + 0.32, top + 0.25, dz, 0.16, 0.28, 0.28, kit.mat("#ec4899"));
        break;
      case "fincrime-1":
        kit.block(root, px, top, dz, 0.7, 0.04, 0.9, paper);
        kit.cyl(root, px + 0.1, top + 0.06, dz - 0.1, 0.5, 0.06, kit.mat("#bfe6ff", { specular: 0.8 }), { tess: 16 });
        kit.block(root, px + 0.4, top + 0.06, dz + 0.22, 0.4, 0.08, 0.1, dark, { rotY: 0.7 });
        break;
      case "lead-1":
        kit.block(root, st.x + 1.1, top, dz + 0.15, 0.14, 0.9, 0.14, steel);
        kit.block(root, st.x + 1.1, top + 0.9, dz + 0.1, 1.3, 0.8, 0.08, dark);
        kit.block(root, st.x + 1.1, top + 0.98, dz + 0.05, 1.12, 0.62, 0.02, kit.mat("#14b8a6", { unlit: true }));
        break;
    }
    const ch = new VoxelCharacter(scene, p.id, PALETTES[p.palette]);
    ch.root.parent = root;
    ch.root.scaling.setAll(CHARACTER_SCALE);
    ch.root.position.set(st.x, y, st.z + 0.75);
    ch.root.rotation.y = Math.PI;
    characters.set(p.id, ch);
    anchors.set(`staff:${p.id}`, { node: ch.root, group: "people", dy: 2.5 });
    // The selection ring walks with the person.
    const ring = MeshBuilder.CreateTorus(`v2_staffRing_${p.id}`, { diameter: 1.9, thickness: 0.11, tessellation: 40 }, scene);
    ring.position.y = 0.08;
    kit.finish(ring, ch.root, kit.mat("#ffe08a", { unlit: true }), true);
    ring.setEnabled(false);
    rings.set(p.id, ring);
  }

  /* ---------------- The huddle table, where both teams meet ---------------- */
  const hx = CENTRE_CELL.x;
  const hz = CENTRE_CELL.z;
  kit.cyl(root, hx, y, hz, 0.5, 1.4, steel, { tess: 10 });
  kit.cyl(root, hx, y + 1.4, hz, 2.8, 0.12, white, { tess: 28 });
  const huddleRing = MeshBuilder.CreateTorus("v2_huddleRing", { diameter: 2.5, thickness: 0.06, tessellation: 36 }, scene);
  huddleRing.position.set(hx, y + 1.53, hz);
  kit.finish(huddleRing, root, kit.mat(LEAD, { unlit: true }));
  kit.block(root, hx + 0.6, y + 1.52, hz - 0.3, 0.7, 0.04, 0.5, dark, { rotY: 0.3 });
  for (const [sx, sz] of [[-1.9, -0.9], [1.9, -0.9], [-1.9, 1.0], [1.9, 1.0]] as const) {
    kit.cyl(root, hx + sx, y, hz + sz, 0.12, 0.95, steel, { tess: 8 });
    kit.cyl(root, hx + sx, y + 0.95, hz + sz, 0.75, 0.12, kit.mat(sx < 0 ? SIDES.wealth.color : SIDES.super.color), { tess: 12 });
  }
  const huddleCase = kit.block(root, hx, y + 2.0, hz, 0.5, 0.5, 0.5, kit.mat("#ffc35a", { emissive: 0.55 }), {
    dynamic: true,
  });
  const huddleTag = kit.label(root, {
    lines: [{ text: "both teams meet here", size: 40, weight: 700, color: "#dfe5f7" }],
    width: 2.6,
    px: 420,
    pxHeight: 70,
    bg: "rgba(10,18,34,0.94)",
  });
  huddleTag.billboardMode = Mesh.BILLBOARDMODE_Y;
  huddleTag.position.set(hx, y + 3.1, hz);

  /* ---------------- Coffee bar, lounge corner and plants ---------------- */
  kit.block(root, 19.4, y, 1, 2.0, 1.5, 7.0, walnut);
  kit.block(root, 19.4, y + 1.5, 1, 2.3, 0.1, 7.3, white);
  kit.block(root, 19.7, y + 1.6, 3.4, 0.9, 1.1, 0.8, dark);
  kit.block(root, 19.24, y + 2.1, 3.4, 0.06, 0.2, 0.4, kit.mat("#ffc35a", { unlit: true }));
  for (const z of [-1.4, 0.3]) {
    kit.cyl(root, 17.9, y, z, 0.14, 1.0, steel, { tess: 8 });
    kit.cyl(root, 17.9, y + 1.0, z, 0.75, 0.14, kit.mat("#ff8f6b"), { tess: 12 });
  }
  kit.block(root, -18.6, y, -2.4, 1.5, 0.8, 1.5, kit.mat("#ff8f6b"));
  kit.block(root, -18.8, y, -0.4, 1.5, 0.8, 1.5, kit.mat("#14b8a6"));
  // The printer by the left wall, with a paper tray.
  kit.block(root, -19.5, y, -6.6, 1.3, 1.1, 1.2, kit.mat("#e5e7eb"));
  kit.block(root, -19.5, y + 1.1, -6.6, 1.1, 0.2, 1.0, kit.mat("#9ca3af"));
  kit.block(root, -18.86, y + 0.8, -6.6, 0.14, 0.05, 0.7, kit.mat("#ffffff"));
  kit.block(root, -19.0, y + 1.32, -6.9, 0.2, 0.06, 0.2, kit.mat("#34d399", { unlit: true }));
  for (const [x, z] of [[-20.2, -12.2], [20.2, -12.2], [20.2, 8.2], [-16, 8.2]] as const) {
    kit.block(root, x, y, z, 0.9, 0.8, 0.9, pot);
    kit.block(root, x, y + 0.8, z, 1.2, 1.1, 1.2, leaf);
    kit.block(root, x + 0.15, y + 1.8, z - 0.1, 0.7, 0.7, 0.7, leafDark);
  }

  /* ---------------- The idea drops in (chapter intro) ---------------- */
  const sparkMat = kit.mat("#ffd98a", { unlit: true });
  const sparks: Mesh[] = STAFF_PERSONAS.map(() => {
    const m = kit.block(root, 0, 0, 0, 0.42, 0.42, 0.42, sparkMat, { dynamic: true });
    m.setEnabled(false);
    return m;
  });

  kit.useBatch(null);
  batch.flush();

  /* ---------------- Moving about the floor ---------------- */
  const r = rng(47);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(r() * list.length)];
  const between = (a: number, b: number): number => a + (b - a) * r();
  const book = new SpotBook();
  const homes = new Map<string, Spot>();
  for (const p of STAFF_PERSONAS) {
    const st = STATIONS[p.id];
    if (!st) continue;
    const at: Pt = [st.x, st.z + 0.75];
    // Back-row people leave by the side of their desk nearer the middle.
    const side = st.x > 0 ? -2.6 : 2.6;
    const via: Pt[] = st.z < 0 ? [[st.x, CZ]] : [[st.x + side, CZ], [st.x + side, at[1]]];
    homes.set(p.id, { at, face: Math.PI, via });
  }
  const spot = (at: Pt, face: number, via: Pt[], key: string): Spot => ({ at, face, via, key });
  const toward = (from: Pt, to: Pt): number => Math.atan2(to[0] - from[0], to[1] - from[1]);
  const places: Record<Exclude<Errand, `visit:${string}`>, { spots: Spot[]; where: string; tasks: string[] }> = {
    coffee: {
      spots: [spot([16.9, -0.4], Math.PI / 2, [[16.9, CZ]], "coffee:0"), spot([16.4, 1.3], Math.PI / 2, [[16.4, CZ]], "coffee:1")],
      where: "the coffee bar",
      tasks: ["Grabbing a flat white", "Coffee break"],
    },
    huddle: {
      spots: [
        spot([-2.7, -4.3], toward([-2.7, -4.3], [hx, hz]), [[-2.7, CZ]], "huddle:w"),
        spot([2.7, -4.3], toward([2.7, -4.3], [hx, hz]), [[2.7, CZ]], "huddle:e"),
        spot([0, -3.2], Math.PI, [[0, CZ]], "huddle:n"),
      ],
      where: "the huddle table",
      tasks: ["Case huddle", "Talking through a case"],
    },
    printer: {
      spots: [spot([-17.4, -6.6], -Math.PI / 2, [[-17.2, CZ]], "printer")],
      where: "the printer",
      tasks: ["Collecting printouts", "Printing a member pack"],
    },
    process: {
      spots: [spot([-2.0, 7.4], 0, [[-3.75, CZ], [-3.75, 7.4]], "process")],
      where: "the process board",
      tasks: ["Checking the process board"],
    },
    wealthBoard: {
      spots: [spot([-11.0, 7.4], 0, [[-11.25, CZ], [-11.25, 7.4]], "wealthBoard")],
      where: "the team board",
      tasks: ["Checking the team board"],
    },
    superBoard: {
      spots: [spot([11.0, 7.4], 0, [[11.25, CZ], [11.25, 7.4]], "superBoard")],
      where: "the team board",
      tasks: ["Checking the team board"],
    },
    lookout: {
      spots: [spot([-11.25, -12.0], Math.PI, [[-11.25, CZ]], "look:w"), spot([3.75, -12.0], Math.PI, [[3.75, CZ]], "look:e")],
      where: "the rail",
      tasks: ["Taking in the lake view", "A quick stretch"],
    },
  };
  /** Standing beside a colleague's desk, on the side nearer the middle. */
  const visitSpot = (id: string): Spot | null => {
    const home = homes.get(id);
    if (!home) return null;
    const [x, z] = home.at;
    const sx = x > 0 ? x - 2.4 : x < 0 ? x + 2.4 : -2.4;
    const at: Pt = [sx, z + 0.35];
    return spot(at, toward(at, home.at), [[sx, CZ]], `visit:${id}`);
  };
  const wanderers = new Map<string, Wanderer>();
  for (const p of STAFF_PERSONAS) {
    const ch = characters.get(p.id);
    const home = homes.get(p.id);
    if (!ch || !home) continue;
    const errands = ERRANDS[p.id] ?? [];
    const total = errands.reduce((s, [, w]) => s + w, 0);
    const plan = (): Outing | null => {
      let roll = r() * total;
      const errand = errands.find(([, w]) => (roll -= w) <= 0)?.[0];
      if (!errand) return null;
      if (errand.startsWith("visit:")) {
        const id = errand.slice(6);
        const s = visitSpot(id);
        const colleague = findStaffById(id);
        // Only drop by when they're at their desk.
        if (!s || !colleague || !wanderers.get(id)?.isHome) return null;
        return { spot: s, task: pick([`Checking in with ${colleague.name}`, `A quick question for ${colleague.name}`]), where: `${colleague.name}’s desk`, dwell: between(4, 8) };
      }
      const place = places[errand as keyof typeof places];
      const free = place.spots.filter((s) => book.free(s.key));
      if (!free.length) return null;
      return { spot: pick(free), task: pick(place.tasks), where: place.where, dwell: between(5, 9) };
    };
    wanderers.set(
      p.id,
      new Wanderer({
        body: { root: ch.root, walk: (on) => ch.setWalking(on) },
        home,
        homeName: "the desk",
        plan,
        homeTask: () => pick(p.ambient),
        homeDwell: [9, 22],
        speed: 2.2,
        book,
        rand: r,
        bubble: kit.bubble(ch.root, 2.45, p.color, CHARACTER_SCALE),
        sway: 0.14,
      }),
    );
  }

  let selected: ReadonlySet<string> = new Set();
  const flash = new Map<string, number>();
  let introT = -1;
  const ids = STAFF_PERSONAS.map((p) => p.id);

  const applyHighlight = (id: string): void => {
    characters.get(id)?.setHighlight(selected.has(id) || (flash.get(id) ?? 0) > 0, CORAL);
    rings.get(id)?.setEnabled(selected.has(id));
  };

  return {
    id: "people",
    root,
    tag,
    anchors,
    update(dt: number, t: number): void {
      huddleCase.rotation.y = t * 0.9;
      huddleCase.position.y = y + 2.25 + Math.sin(t * 1.7) * 0.1;
      for (const id of selected) rings.get(id)?.scaling.setAll(1 + Math.sin(t * 5) * 0.06);
      ids.forEach((id) => {
        const ch = characters.get(id);
        if (!ch) return;
        wanderers.get(id)?.update(dt);
        ch.update(dt);
        const f = flash.get(id);
        if (f !== undefined) {
          const left = f - dt;
          if (left <= 0) flash.delete(id);
          else flash.set(id, left);
          applyHighlight(id);
        }
      });
      if (introT >= 0) {
        introT += dt;
        let running = false;
        ids.forEach((id, i) => {
          const spark = sparks[i];
          const ch = characters.get(id);
          const local = (introT - i * 0.14) / 1.3;
          if (!ch || local < 0 || local > 1) {
            if (local > 1 && spark.isEnabled()) {
              spark.setEnabled(false);
              flash.set(id, 1.1);
              applyHighlight(id);
            }
            if (local <= 1) running = true;
            return;
          }
          running = true;
          spark.setEnabled(true);
          const e = local * local * (3 - 2 * local);
          const tx = ch.root.position.x;
          const tz = ch.root.position.z;
          spark.position.set(-5 + (tx + 5) * e, y + 5.2 - 2.4 * e + Math.sin(Math.PI * e) * 1.2, -2 + (tz + 2) * e);
          spark.rotation.y = t * 4;
        });
        if (!running) introT = -1;
      }
    },
    setHighlights(h: Highlights): void {
      selected = h.staff;
      ids.forEach(applyHighlight);
      // Someone selected, or working on the finale's request, heads back to their desk.
      for (const [id, w] of wanderers) w.hold(selected.has(id));
    },
    intro(): void {
      introT = 0;
    },
    task(id: string): string | null {
      return wanderers.get(id)?.task ?? null;
    },
  };
}
