/**
 * v2 — "The Lakehouse" storybook, served at /v2 (see docs/storybook.md).
 *
 * A futuristic, casual lakehouse for a wealth business with two sides,
 * read from the top down:
 *   Level 3      the business owner's office and her idea (the brain)
 *   Level 2      two small teams, one for each side: Wealth Management and Superannuation
 *   Level 1      one group of Microsoft Foundry agents, dedicated to a side or shared by both
 *   Lower level  the engine room: Microsoft IQ and the Azure services under the waterline
 *
 * The storybook pages open one level at a time (the levels above lift away),
 * and the finale pulls the house apart to trace one member request from the
 * top of the house to the bottom and back.
 */
import {
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  GlowLayer,
  HemisphericLight,
  PointerEventTypes,
  Scene,
  Vector3,
  type AbstractMesh,
} from "@babylonjs/core";
import { CameraDirector } from "../cameraDirector";
import { STAFF_PERSONAS, type ScenarioId } from "../personaData";
import type { CharacterPickMetadata } from "../voxelCharacter";
import { buildExterior } from "./exterior";
import { inspectorView, tooltipText } from "./inspector";
import { Kit } from "./kit";
import { AGENTS, agentsUsing, type InfraId, type LevelId } from "./lakehouseData";
import { LevelStack } from "./levelStack";
import { buildAgentsLevel } from "./levels/agentsLevel";
import { buildEngineLevel } from "./levels/engineLevel";
import { buildIdeaLevel, buildRoof } from "./levels/ideaLevel";
import { buildPeopleLevel } from "./levels/peopleLevel";
import { RequestTrace, type TraceFocus, type TraceStep } from "./requestTrace";
import { Storybook } from "./storybook";
import { PAGES, pageIndex, type PageId, type StoryPage } from "./storyData";
import { Threads, type ThreadSpec } from "./threads";
import type { Anchor, Highlights, InspectTarget, LevelBuild, V2PickMetadata } from "./types";

const CORAL = "#ff8f6b";
const GOLD = "#ffc35a";
const VIOLET = "#a78bfa";

function bootstrap(): void {
  const canvas = document.getElementById("v2Canvas") as HTMLCanvasElement | null;
  if (!canvas) throw new Error("v2Canvas is missing from v2/index.html");

  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
    antialias: true,
    alpha: true,
    premultipliedAlpha: false,
  });
  const scene = new Scene(engine);
  // Transparent clear: the sky is a CSS gradient behind the canvas.
  scene.clearColor = new Color4(0, 0, 0, 0);
  scene.ambientColor = new Color3(0.55, 0.55, 0.62);
  scene.skipPointerMovePicking = true;

  const cover = PAGES[0].shot;
  const camera = new ArcRotateCamera("v2cam", cover.alpha, cover.beta, cover.radius, new Vector3(...cover.target), scene);
  camera.attachControl(canvas, true);
  camera.inputs.removeByType("ArcRotateCameraKeyboardMoveInput");
  camera.lowerRadiusLimit = 16;
  camera.upperRadiusLimit = 175;
  camera.lowerBetaLimit = 0.2;
  camera.upperBetaLimit = 1.47;
  camera.wheelPrecision = 12;
  camera.panningSensibility = 0;
  camera.minZ = 0.5;
  camera.maxZ = 1000;

  const hemi = new HemisphericLight("v2hemi", new Vector3(0.2, 1, -0.3), scene);
  hemi.intensity = 0.8;
  hemi.diffuse = new Color3(1, 0.97, 0.92);
  hemi.groundColor = new Color3(0.42, 0.46, 0.58);
  const sun = new DirectionalLight("v2sun", new Vector3(0.45, -1, 0.55), scene);
  sun.intensity = 0.72;
  sun.diffuse = new Color3(1, 0.9, 0.76);

  const glow = new GlowLayer("v2glow", scene, { blurKernelSize: 32, mainTextureRatio: 0.5 });
  glow.intensity = 0.55;

  /* ---------------- Build the lakehouse ---------------- */
  const kit = new Kit(scene);
  kit.glowLayer = glow;
  const exterior = buildExterior(kit);
  const levels: Record<LevelId, LevelBuild> = {
    idea: buildIdeaLevel(kit),
    people: buildPeopleLevel(kit),
    agents: buildAgentsLevel(kit),
    engine: buildEngineLevel(kit),
  };
  const roof = buildRoof(kit);
  const stack = new LevelStack({
    roof,
    idea: levels.idea.root,
    people: levels.people.root,
    agents: levels.agents.root,
    engine: levels.engine.root,
  });

  const anchors = new Map<string, Anchor>();
  for (const level of Object.values(levels)) for (const [key, a] of level.anchors) anchors.set(key, a);
  const anchor = (key: string): Anchor | undefined => anchors.get(key);

  // The whole house as one tree: idea → people → agents → Microsoft Foundry.
  const threads = new Threads(kit, stack);
  for (const p of STAFF_PERSONAS) {
    const person = anchor(`staff:${p.id}`);
    const agent = anchor(`agent:${p.id}`);
    const brain = anchor("brain");
    const foundry = anchor("infra:foundry");
    if (brain && person) threads.addStructure({ a: brain, b: person, color: GOLD });
    if (person && agent) threads.addStructure({ a: person, b: agent, color: CORAL });
    if (agent && foundry) threads.addStructure({ a: agent, b: foundry, color: VIOLET });
  }

  /* ---------------- Selection and highlights ---------------- */
  let selection: InspectTarget | null = null;
  let traceFocus: TraceFocus | null = null;

  const highlightsFor = (t: InspectTarget | null): Highlights => {
    const h = { owner: false, brain: false, staff: new Set<string>(), agents: new Set<string>(), infra: new Set<InfraId>() };
    if (!t) return h;
    switch (t.type) {
      case "owner":
        h.owner = true;
        h.brain = true;
        break;
      case "brain":
        h.brain = true;
        break;
      case "staff":
      case "agent":
        h.staff.add(t.id);
        h.agents.add(t.id);
        for (const i of AGENTS[t.id]?.uses ?? []) h.infra.add(i);
        break;
      case "infra":
        h.infra.add(t.id);
        for (const id of agentsUsing(t.id)) h.agents.add(id);
        break;
    }
    return h;
  };

  const linksFor = (t: InspectTarget | null): ThreadSpec[] => {
    const out: ThreadSpec[] = [];
    const link = (a: Anchor | undefined, b: Anchor | undefined, color: string): void => {
      if (a && b) out.push({ a, b, color });
    };
    if (!t) return out;
    switch (t.type) {
      case "owner":
      case "brain":
        for (const p of STAFF_PERSONAS) link(anchor("brain"), anchor(`staff:${p.id}`), GOLD);
        break;
      case "staff":
      case "agent":
        link(anchor(`staff:${t.id}`), anchor(`agent:${t.id}`), CORAL);
        for (const i of AGENTS[t.id]?.uses ?? []) link(anchor(`agent:${t.id}`), anchor(`infra:${i}`), VIOLET);
        break;
      case "infra":
        for (const id of agentsUsing(t.id)) {
          link(anchor(`infra:${t.id}`), anchor(`agent:${id}`), VIOLET);
          link(anchor(`agent:${id}`), anchor(`staff:${id}`), CORAL);
        }
        break;
    }
    return out;
  };

  const applyHighlights = (): void => {
    const h: Highlights = traceFocus
      ? {
          owner: false,
          brain: !!traceFocus.brain,
          staff: new Set(traceFocus.staff ? [traceFocus.staff] : []),
          agents: new Set(traceFocus.agent ? [traceFocus.agent] : []),
          infra: new Set(traceFocus.infra ?? []),
        }
      : highlightsFor(selection);
    for (const level of Object.values(levels)) level.setHighlights(h);
  };

  /* ---------------- Camera ---------------- */
  const director = new CameraDirector(camera);
  let cameraBusyUntil = 0;
  let coverSpin = true;
  const flyTo = (page: StoryPage, durationSec = 1.8): void => {
    const s = page.shot;
    // Take the shortest way round, however far the visitor has orbited.
    const twoPi = Math.PI * 2;
    camera.alpha = s.alpha + ((((camera.alpha - s.alpha) % twoPi) + 3 * Math.PI) % twoPi) - Math.PI;
    director.focus({ target: new Vector3(...s.target), radius: s.radius, alpha: s.alpha, beta: s.beta, durationSec });
    cameraBusyUntil = performance.now() + durationSec * 1000;
  };

  /* ---------------- The finale's request trace ---------------- */
  let scenario: ScenarioId = "retirement";
  let traceStep: TraceStep | null = null;
  let storybook: Storybook | null = null;
  const pushTraceState = (): void =>
    storybook?.setTrace({ scenario, step: traceStep, paused: trace.paused, speed: trace.speed, done: trace.done });
  const trace = new RequestTrace(kit, anchor, {
    step: (s) => {
      traceStep = s;
      pushTraceState();
    },
    focus: (f) => {
      traceFocus = f;
      applyHighlights();
    },
    done: () => pushTraceState(),
  });
  let pending: number | undefined;
  const startTrace = (id: ScenarioId): void => {
    window.clearTimeout(pending);
    scenario = id;
    traceStep = null;
    trace.start(id);
    pushTraceState();
  };

  /* ---------------- The storybook ---------------- */
  const select = (t: InspectTarget | null): void => {
    selection = t;
    threads.setSelection(linksFor(t));
    applyHighlights();
    if (t) storybook?.showInspector(inspectorView(t));
    else storybook?.hideInspector();
  };

  const onPage = (page: StoryPage): void => {
    stack.setMode(page.mode);
    // A focused chapter shows only its own level tag; the whole house shows them all.
    for (const [id, level] of Object.entries(levels) as [LevelId, LevelBuild][]) {
      level.tag.setEnabled(page.mode.kind !== "focus" || page.mode.level === id);
    }
    const looksUnderground = page.mode.kind === "exploded" || (page.mode.kind === "focus" && page.mode.level === "engine");
    exterior.setDeckVisible(!looksUnderground);
    flyTo(page);
    coverSpin = page.id === "cover";
    window.clearTimeout(pending);
    if (page.id === "finale") {
      pending = window.setTimeout(() => startTrace(scenario), 1700);
    } else {
      if (trace.active) trace.stop();
      traceFocus = null;
      applyHighlights();
      if (page.mode.kind === "focus") {
        const level = levels[page.mode.level];
        pending = window.setTimeout(() => level.intro(), 900);
      }
    }
    const url = new URL(window.location.href);
    if (page.id === "cover") url.searchParams.delete("page");
    else url.searchParams.set("page", page.id);
    history.replaceState(null, "", url);
  };

  const book = new Storybook({
    page: (page) => onPage(page),
    action: (a) => {
      if (a.page && a.page !== book.page.id) book.goTo(a.page);
      if (a.select) select(a.select);
    },
    closeInspector: () => select(null),
    scenario: (id) => startTrace(id),
    trace: (cmd) => {
      if (cmd === "toggle") trace.paused = !trace.paused;
      else if (cmd === "skip") trace.skip();
      else if (cmd === "speed") trace.speed = trace.speed === 1 ? 2 : trace.speed === 2 ? 4 : 1;
      else startTrace(scenario);
      pushTraceState();
    },
  });
  storybook = book;

  /* ---------------- Picking ---------------- */
  // Only the level being read is clickable, so a click on a floor never selects something hidden underneath.
  const pickable = (m: AbstractMesh): boolean => {
    if (!m.isPickable || !m.isEnabled()) return false;
    const mode = stack.current;
    return mode.kind !== "focus" || m.isDescendantOf(levels[mode.level].root);
  };
  const pickTarget = (x: number, y: number): InspectTarget | null => {
    const hit = scene.pick(x, y, pickable);
    const meta = hit?.pickedMesh?.metadata as V2PickMetadata | CharacterPickMetadata | undefined;
    if (!meta) return null;
    if (meta.kind === "v2") return meta.target;
    if (meta.kind === "character") return meta.id === "owner" ? { type: "owner" } : { type: "staff", id: meta.id };
    return null;
  };
  let hoverAt: { x: number; y: number } | null = null;
  let hoverClock = 0;
  scene.onPointerObservable.add((info) => {
    if (info.type === PointerEventTypes.POINTERMOVE) {
      hoverAt = { x: scene.pointerX, y: scene.pointerY };
    } else if (info.type === PointerEventTypes.POINTERDOWN) {
      coverSpin = false;
    } else if (info.type === PointerEventTypes.POINTERTAP) {
      const t = pickTarget(scene.pointerX, scene.pointerY);
      if (t) select(t);
      else if (selection) select(null);
    }
  });
  canvas.addEventListener("pointerleave", () => {
    hoverAt = null;
    book.hideTooltip();
    canvas.classList.remove("hover");
  });

  /* ---------------- First page ---------------- */
  const requested = new URLSearchParams(window.location.search).get("page") as PageId | null;
  const first = requested ? Math.max(0, pageIndex(requested)) : 0;
  book.goTo(first);
  if (first > 0) {
    // Deep link: open straight onto the chapter.
    scene.stopAnimation(camera);
    const s = PAGES[first].shot;
    camera.setTarget(new Vector3(...s.target));
    camera.alpha = s.alpha;
    camera.beta = s.beta;
    camera.radius = s.radius;
    stack.snap();
  }

  /* ---------------- Render loop ---------------- */
  const loading = document.getElementById("v2-loading");
  scene.executeWhenReady(() => loading?.classList.add("hidden"));
  let last = performance.now();
  let time = 0;
  engine.runRenderLoop(() => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    time += dt;
    if (coverSpin && book.page.id === "cover" && now > cameraBusyUntil) camera.alpha += dt * 0.035;
    stack.update(dt);
    exterior.update(dt, time);
    for (const level of Object.values(levels)) level.update(dt, time);
    threads.update(dt);
    trace.update(dt);
    hoverClock += dt;
    if (hoverAt && hoverClock > 0.06) {
      hoverClock = 0;
      const t = pickTarget(hoverAt.x, hoverAt.y);
      if (t) {
        book.showTooltip(tooltipText(t), hoverAt.x, hoverAt.y);
        canvas.classList.add("hover");
      } else {
        book.hideTooltip();
        canvas.classList.remove("hover");
      }
      hoverAt = null;
    }
    scene.render();
  });
  window.addEventListener("resize", () => engine.resize());
  if ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) {
    // Dev-only handle for inspecting the scene from the browser console.
    (window as unknown as { __v2: unknown }).__v2 = { scene, camera, stack, book };
  }
}

bootstrap();
