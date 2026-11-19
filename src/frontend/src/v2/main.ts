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
 * The storybook pages open one level at a time (the levels above lift away).
 * Out front, visitors arrive by water taxi and sign at the front desk on the
 * dock. The finale starts there: the member signs, then the house pulls apart
 * to trace their request from the top of the house to the bottom and back.
 */
import {
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  PointerEventTypes,
  Scene,
  Vector3,
  type AbstractMesh,
} from "@babylonjs/core";
import { CameraDirector } from "../cameraDirector";
import { findStaffById, STAFF_PERSONAS, type ScenarioId } from "../personaData";
import type { CharacterPickMetadata } from "../voxelCharacter";
import { Callouts, type CalloutSpec } from "./callouts";
import { buildDock } from "./dock";
import { buildExterior } from "./exterior";
import { inspectorView, nowText, tooltipText, type InspectorAction, type Live } from "./inspector";
import { Kit } from "./kit";
import {
  AGENTS,
  DESK_ROLE,
  TIERS,
  agentsUsing,
  infraInfo,
  infraShort,
  levelInfo,
  roleInfo,
  type InfraId,
  type LevelId,
} from "./lakehouseData";
import { LevelStack } from "./levelStack";
import { buildAgentsLevel } from "./levels/agentsLevel";
import { buildEngineLevel } from "./levels/engineLevel";
import { buildIdeaLevel, buildRoof } from "./levels/ideaLevel";
import { buildPeopleLevel } from "./levels/peopleLevel";
import { buildParty } from "./party";
import { RequestTrace, type TraceFocus, type TraceStep } from "./requestTrace";
import { Storybook } from "./storybook";
import { PAGES, pageIndex, type CameraShot, type PageId, type StoryPage } from "./storyData";
import { Threads, type ThreadSpec } from "./threads";
import type { Anchor, Highlights, InspectTarget, LevelBuild, StackMode, V2PickMetadata } from "./types";

const CORAL = "#ff8f6b";
const GOLD = "#ffc35a";
const VIOLET = "#a78bfa";

function bootstrap(): void {
  const canvas = document.getElementById("v2Canvas") as HTMLCanvasElement | null;
  if (!canvas) throw new Error("v2Canvas is missing from v2/index.html");

  // Render at the screen's own pixel density (capped at 2x) so signs and floor lettering stay
  // crisp on high-DPI screens instead of being upscaled.
  const engine = new Engine(
    canvas,
    true,
    {
      preserveDrawingBuffer: true,
      stencil: true,
      antialias: true,
      alpha: true,
      premultipliedAlpha: false,
      limitDeviceRatio: 2,
    },
    true,
  );
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
  // The page shots are framed for 16:9. On a narrower window, widen the view (up to a point, to
  // avoid a fisheye look) rather than crop the sides, so level tags and desks stay on screen.
  const baseFov = camera.fov;
  const fitView = (): void => {
    const wide = 16 / 9;
    const aspect = engine.getAspectRatio(camera);
    const fitted = 2 * Math.atan((Math.tan(baseFov / 2) * wide) / aspect);
    camera.fov = aspect >= wide ? baseFov : Math.min(1.2, fitted);
  };
  fitView();

  const hemi = new HemisphericLight("v2hemi", new Vector3(0.2, 1, -0.3), scene);
  hemi.intensity = 0.8;
  hemi.diffuse = new Color3(1, 0.97, 0.92);
  hemi.groundColor = new Color3(0.42, 0.46, 0.58);
  const sun = new DirectionalLight("v2sun", new Vector3(0.45, -1, 0.55), scene);
  sun.intensity = 0.72;
  sun.diffuse = new Color3(1, 0.9, 0.76);
  // No glow layer or bloom: lit parts are plain unlit colours, so every sign stays sharp.

  /* ---------------- Build the lakehouse ---------------- */
  const kit = new Kit(scene);
  const exterior = buildExterior(kit);
  const ideaLevel = buildIdeaLevel(kit);
  const peopleLevel = buildPeopleLevel(kit);
  const agentsLevel = buildAgentsLevel(kit);
  const levels: Record<LevelId, LevelBuild> = {
    idea: ideaLevel,
    people: peopleLevel,
    agents: agentsLevel,
    engine: buildEngineLevel(kit),
  };
  const roof = buildRoof(kit);
  // Up on the roof, Caldova throws a party for its customers. Built before the stack, so it
  // lifts away and fades with the roof.
  const party = buildParty(kit, roof);
  const stack = new LevelStack({
    roof,
    idea: levels.idea.root,
    people: levels.people.root,
    agents: levels.agents.root,
    engine: levels.engine.root,
  });
  // The dock out front: visitors arrive by water taxi and sign at the front desk, where the
  // Form Extraction agent comes out to read what they signed.
  const dock = buildDock(kit, exterior.deck, {
    callAgent: () => agentsLevel.callToDesk(),
    releaseAgent: () => agentsLevel.releaseDesk(),
    agentReady: () => agentsLevel.deskReady(),
  });
  let deckShown = true;
  const setDeck = (on: boolean): void => {
    deckShown = on;
    exterior.setDeckVisible(on);
    dock.setActive(on);
  };

  const anchors = new Map<string, Anchor>();
  for (const level of Object.values(levels)) for (const [key, a] of level.anchors) anchors.set(key, a);
  for (const [key, a] of dock.anchors) anchors.set(key, a);
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
    const h = {
      owner: false,
      brain: false,
      desk: false,
      staff: new Set<string>(),
      agents: new Set<string>(),
      roles: new Set<string>(),
      infra: new Set<InfraId>(),
      party: false,
      guests: new Set<string>(),
    };
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
      case "role": {
        const role = roleInfo(t.id);
        if (!role) break;
        h.roles.add(role.id);
        h.staff.add(role.staffId);
        h.infra.add("foundry");
        h.desk = role.id === DESK_ROLE;
        break;
      }
      case "infra":
        h.infra.add(t.id);
        for (const id of agentsUsing(t.id)) h.agents.add(id);
        break;
      case "desk":
      case "visitor": {
        h.desk = true;
        h.roles.add(DESK_ROLE);
        const reader = roleInfo(DESK_ROLE);
        if (reader) h.staff.add(reader.staffId);
        break;
      }
      case "party":
        h.party = true;
        break;
      case "guest":
        h.guests.add(t.id);
        break;
    }
    return h;
  };

  // Beams meet a person just above their head, clear of their desk sign.
  const heads = new Map<string, Anchor>();
  const end = (key: string): Anchor | undefined => {
    const a = anchor(key);
    if (!a || !key.startsWith("staff:")) return a;
    let e = heads.get(key);
    if (!e) {
      e = { ...a, dy: 3.15 };
      heads.set(key, e);
    }
    return e;
  };
  /** The beams for a selection, and a label for each far end the visitor may not see. */
  const relationFor = (t: InspectTarget | null): { links: ThreadSpec[]; callouts: CalloutSpec[] } => {
    const links: ThreadSpec[] = [];
    const callouts: CalloutSpec[] = [];
    const link = (a: Anchor | undefined, b: Anchor | undefined, color: string): void => {
      if (a && b) links.push({ a, b, color });
    };
    const label = (key: string, level: LevelId, text: string, action?: InspectorAction): void => {
      const a = end(key);
      const l = levelInfo(level);
      if (a) callouts.push({ anchor: a, floor: l.floor, text, color: l.accent, action });
    };
    const staffLabel = (id: string): void => {
      const p = findStaffById(id);
      if (p) label(`staff:${id}`, "people", p.name, { label: `Meet ${p.name}`, page: "people", select: { type: "staff", id } });
    };
    const agentLabel = (id: string): void => {
      const p = findStaffById(id);
      if (p) label(`agent:${id}`, "agents", p.agent_name, { label: `Meet the ${p.agent_name}`, page: "agents", select: { type: "agent", id } });
    };
    // What an agent runs on: one beam to Microsoft IQ as a whole, and one to each Azure service.
    const runsOn = (from: Anchor | undefined, uses: InfraId[]): void => {
      for (const id of uses) {
        if (infraInfo(id).tier === "iq") continue;
        link(from, end(`infra:${id}`), VIOLET);
        label(`infra:${id}`, "engine", infraShort(id), { label: `Open ${infraShort(id)}`, page: "engine", select: { type: "infra", id } });
      }
      if (uses.some((id) => infraInfo(id).tier === "iq")) {
        link(from, end("iq"), VIOLET);
        label("iq", "engine", TIERS.iq.name, { label: "Down to the engine room", page: "engine" });
      }
    };
    if (!t) return { links, callouts };
    switch (t.type) {
      case "owner":
      case "brain":
        for (const p of STAFF_PERSONAS) link(end("brain"), end(`staff:${p.id}`), GOLD);
        break;
      case "staff":
      case "agent":
        link(end(`staff:${t.id}`), end(`agent:${t.id}`), CORAL);
        runsOn(end(`agent:${t.id}`), AGENTS[t.id]?.uses ?? []);
        if (t.type === "staff") agentLabel(t.id);
        else staffLabel(t.id);
        break;
      case "role": {
        const role = roleInfo(t.id);
        if (!role) break;
        link(end(`staff:${role.staffId}`), end(`role:${role.id}`), CORAL);
        link(end(`role:${role.id}`), end("infra:foundry"), VIOLET);
        if (role.id === DESK_ROLE) link(end("desk"), end(`role:${role.id}`), GOLD);
        staffLabel(role.staffId);
        label("infra:foundry", "engine", infraShort("foundry"), { label: "Open Microsoft Foundry", page: "engine", select: { type: "infra", id: "foundry" } });
        break;
      }
      case "infra": {
        const users = agentsUsing(t.id);
        for (const id of users) {
          link(end(`infra:${t.id}`), end(`agent:${id}`), VIOLET);
          link(end(`agent:${id}`), end(`staff:${id}`), CORAL);
        }
        // Name the agents when there are only a few; a fan to every agent speaks for itself.
        if (users.length <= 3) users.forEach(agentLabel);
        break;
      }
      case "desk":
      case "visitor": {
        const reader = roleInfo(DESK_ROLE);
        link(end("desk"), end(`role:${DESK_ROLE}`), GOLD);
        if (!reader) break;
        link(end(`role:${DESK_ROLE}`), end(`staff:${reader.staffId}`), CORAL);
        label(`role:${DESK_ROLE}`, "agents", reader.short, { label: `Meet the ${reader.short} agent`, page: "agents", select: { type: "role", id: DESK_ROLE } });
        staffLabel(reader.staffId);
        break;
      }
    }
    return { links, callouts };
  };

  const applyHighlights = (): void => {
    const h: Highlights = traceFocus
      ? {
          owner: false,
          brain: !!traceFocus.brain,
          desk: !!traceFocus.desk,
          staff: new Set(traceFocus.staff ? [traceFocus.staff] : []),
          agents: new Set(traceFocus.agent ? [traceFocus.agent] : []),
          roles: new Set(traceFocus.desk ? [DESK_ROLE] : []),
          infra: new Set(traceFocus.infra ?? []),
          party: false,
          guests: new Set<string>(),
        }
      : highlightsFor(selection);
    for (const level of Object.values(levels)) level.setHighlights(h);
    dock.setHighlights(h);
    party.setHighlights(h);
  };

  /* ---------------- Camera ---------------- */
  const director = new CameraDirector(camera);
  let cameraBusyUntil = 0;
  let coverSpin = true;
  let flyingTo: CameraShot | null = null;
  const flyTo = (s: CameraShot, durationSec = 1.8): void => {
    // Already on the way there: let the flight finish.
    if (flyingTo === s && performance.now() < cameraBusyUntil) return;
    flyingTo = s;
    // Take the shortest way round, however far the visitor has orbited.
    const twoPi = Math.PI * 2;
    camera.alpha = s.alpha + ((((camera.alpha - s.alpha) % twoPi) + 3 * Math.PI) % twoPi) - Math.PI;
    director.focus({ target: new Vector3(...s.target), radius: s.radius, alpha: s.alpha, beta: s.beta, durationSec });
    cameraBusyUntil = performance.now() + durationSec * 1000;
  };

  const setMode = (mode: StackMode): void => {
    stack.setMode(mode);
    // A focused chapter shows only its own level tag; the whole house shows them all.
    for (const [id, level] of Object.entries(levels) as [LevelId, LevelBuild][]) {
      level.tag.setEnabled(mode.kind !== "focus" || mode.level === id);
    }
    setDeck(!(mode.kind === "exploded" || (mode.kind === "focus" && mode.level === "engine")));
  };

  /* ---------------- The finale's request trace ---------------- */
  const finale = PAGES[pageIndex("finale")];
  let scenario: ScenarioId = "retirement";
  let traceStep: TraceStep | null = null;
  let storybook: Storybook | null = null;
  const pushTraceState = (): void =>
    storybook?.setTrace({ scenario, step: traceStep, paused: trace.paused, speed: trace.speed, done: trace.done });
  const trace = new RequestTrace(
    kit,
    anchor,
    {
      step: (s) => {
        traceStep = s;
        pushTraceState();
      },
      focus: (f) => {
        traceFocus = f;
        applyHighlights();
      },
      // The finale opens at the dock with the house together, then pulls it apart once the member has signed.
      stage: (s) => {
        if (storybook?.page.id !== "finale") return;
        if (s === "dock") {
          setMode({ kind: "house" });
          flyTo(finale.dock ?? finale.shot);
        } else {
          setMode(finale.mode);
          flyTo(finale.shot, 2.2);
        }
      },
      done: () => pushTraceState(),
    },
    dock,
  );
  let pending: number | undefined;
  const startTrace = (id: ScenarioId): void => {
    window.clearTimeout(pending);
    scenario = id;
    traceStep = null;
    // The member is down at the dock now, not up at the party.
    party.setAway(id);
    trace.start(id);
    pushTraceState();
  };

  /* ---------------- The storybook ---------------- */
  // What everyone is doing right now, for the inspector card's "Now" line.
  const live: Live = {
    ownerTask: () => ideaLevel.ownerTask(),
    staffTask: (id) => peopleLevel.task(id),
    roleTask: (id) => agentsLevel.roleTask(id),
    visitor: () => dock.visitor(),
    partyNow: () => party.now(),
    guestTask: (id) => party.guestTask(id),
  };
  let shownVisitor: string | null = null;
  const renderInspector = (): void => {
    if (!selection) return;
    shownVisitor = dock.visitor()?.name ?? null;
    storybook?.showInspector(inspectorView(selection, live));
  };
  // Labels for the far ends of the selection's beams; clicking one goes there.
  const callouts = new Callouts(
    scene,
    stack,
    document.getElementById("v2-callouts") as HTMLElement,
    (a) => threads.shows(a),
    (a) => runAction(a),
  );
  const select = (t: InspectTarget | null): void => {
    selection = t;
    const relation = relationFor(t);
    threads.setSelection(relation.links);
    callouts.set(relation.callouts);
    applyHighlights();
    if (t) renderInspector();
    else storybook?.hideInspector();
  };

  const onPage = (page: StoryPage): void => {
    window.clearTimeout(pending);
    coverSpin = page.id === "cover";
    if (page.id === "finale") {
      // Open at the dock, where the member's water taxi is coming in.
      setMode({ kind: "house" });
      flyTo(page.dock ?? page.shot);
      pending = window.setTimeout(() => startTrace(scenario), 600);
    } else {
      setMode(page.mode);
      flyTo(page.shot);
      if (trace.active) trace.stop();
      party.setAway(null);
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

  const runAction = (a: InspectorAction): void => {
    // A guest's card can replay their request: the finale picks it up from `scenario`.
    if (a.scenario) {
      scenario = a.scenario;
      select(null);
    }
    if (a.page && a.page !== book.page.id) book.goTo(a.page);
    else if (a.scenario && book.page.id === "finale") startTrace(a.scenario);
    if (a.shot) {
      // A closer look needs the house together, as on the cover.
      if (stack.current.kind !== "house") book.goTo("cover");
      coverSpin = false;
      flyTo(a.shot);
    }
    if (a.select) select(a.select);
  };

  const book = new Storybook({
    page: (page) => onPage(page),
    action: (a) => runAction(a),
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
  // Only the level being read is clickable, so a click on a floor never selects something hidden
  // underneath. The dock is out front, so it stays clickable whenever it is showing.
  const pickable = (m: AbstractMesh): boolean => {
    if (!m.isPickable || !m.isEnabled()) return false;
    if (m.isDescendantOf(dock.root)) return deckShown;
    const mode = stack.current;
    return mode.kind !== "focus" || m.isDescendantOf(levels[mode.level].root);
  };
  const pickTarget = (x: number, y: number): InspectTarget | null => {
    const hit = scene.pick(x, y, pickable);
    const meta = hit?.pickedMesh?.metadata as V2PickMetadata | CharacterPickMetadata | undefined;
    if (!meta) return null;
    if (meta.kind === "v2") return meta.target;
    if (meta.kind === "character") {
      if (meta.id === "owner") return { type: "owner" };
      if (meta.id === "greeter") return { type: "desk" };
      if (meta.id.startsWith("visitor:")) return { type: "visitor" };
      if (meta.id.startsWith("guest:")) return { type: "guest", id: meta.id.slice("guest:".length) };
      if (meta.id.startsWith("party:")) return { type: "party" };
      return { type: "staff", id: meta.id };
    }
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
    // Deep link: open straight onto the chapter (the finale opens at the dock).
    scene.stopAnimation(camera);
    const s = PAGES[first].dock ?? PAGES[first].shot;
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
  let nowClock = 0;
  engine.runRenderLoop(() => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    time += dt;
    if (coverSpin && book.page.id === "cover" && now > cameraBusyUntil) camera.alpha += dt * 0.035;
    stack.update(dt);
    exterior.update(dt, time);
    for (const level of Object.values(levels)) level.update(dt, time);
    dock.update(dt);
    // The party only runs while the roof is showing.
    if (stack.alpha("roof") > 0.01) party.update(dt);
    threads.update(dt);
    trace.update(dt);
    nowClock += dt;
    if (selection && nowClock > 0.4) {
      nowClock = 0;
      // A new visitor at the front desk gets a fresh card; otherwise just the "Now" line moves on.
      if ((selection.type === "visitor" || selection.type === "desk") && (dock.visitor()?.name ?? null) !== shownVisitor) {
        renderInspector();
      } else {
        book.setInspectorNow(nowText(selection, live));
      }
    }
    hoverClock += dt;
    if (hoverAt && hoverClock > 0.06) {
      hoverClock = 0;
      const t = pickTarget(hoverAt.x, hoverAt.y);
      if (t) {
        book.showTooltip(tooltipText(t, live), hoverAt.x, hoverAt.y);
        canvas.classList.add("hover");
      } else {
        book.hideTooltip();
        canvas.classList.remove("hover");
      }
      hoverAt = null;
    }
    scene.render();
    callouts.update();
  });
  window.addEventListener("resize", () => {
    engine.resize();
    fitView();
  });
  if ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) {
    // Dev-only handle for inspecting the scene from the browser console.
    (window as unknown as { __v2: unknown }).__v2 = { scene, camera, stack, book, dock, party, trace, levels, select, threads };
  }
}

bootstrap();
