/**
 * Inspector card content for everything the visitor can click in the
 * lakehouse: Maya, the brain, each person, each agent and each of its roles,
 * each engine-room component, the front desk on the dock with whoever is
 * signing there and Amelia, its financial adviser, and the party on the roof
 * with each of its guests. Each card ends with actions that move up or down
 * the house along the same thread (person ↔ agent ↔ infrastructure). Cards
 * for Maya, people, agents, roles and guests stay short: one plain-English
 * line, then a few labelled facts, including what they are doing right now.
 * Cards for people, agents, roles, Amelia and engine-room components then
 * show "Across the house": a small cross-section of the house with the
 * person, their agent and its assistants, and what it runs on, where every
 * part is a link.
 */
import { renderCharacterFigureSvg } from "../characterFigure";
import { PALETTES } from "../characterPalettes";
import { CUSTOMER_PERSONAS, findStaffById, STAFF_PERSONAS, type ScenarioId, type StaffTeam } from "../personaData";
import { APP_BASE_URL } from "../agentStages";
import type { VisitorInfo } from "./dock";
import {
  ADVISER,
  AGENTS,
  DESK_ROLE,
  FRONT_DESK,
  HANDOFFS,
  IDEA,
  OWNER,
  PARTY,
  PARTY_GUESTS,
  SIDES,
  TIERS,
  agentsUsing,
  infraInfo,
  infraShort,
  levelInfo,
  roleInfo,
  rolesOf,
  sideBadge,
  teamSide,
  type InfraId,
  type LevelId,
  type SideId,
} from "./lakehouseData";
import { PARTY_SHOT, type CameraShot, type PageId } from "./storyData";
import type { InspectTarget } from "./types";

export interface InspectorAction {
  label: string;
  page?: PageId;
  select?: InspectTarget;
  href?: string;
  primary?: boolean;
  /** Replay this member's request in the finale. */
  scenario?: ScenarioId;
  /** Fly the camera here. */
  shot?: CameraShot;
}

export interface InspectorView {
  accent: string;
  html: string;
  actions: InspectorAction[];
  /** Where the clickable parts of the card's body go (the layer stack), by their `data-i`. */
  links: InspectorAction[];
}

/** What is happening in the house right now, for the cards' "Now" line. */
export interface Live {
  ownerTask(): string | null;
  staffTask(id: string): string | null;
  roleTask(id: string): string | null;
  visitor(): VisitorInfo | null;
  adviserTask(): string | null;
  partyNow(): string;
  guestTask(id: string): string | null;
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ESCAPES[c]);

const list = (items: string[]): string => `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;

const chip = (text: string, color: string): string => `<span style="--c:${color}">${esc(text)}</span>`;

/** A live "Now" value; main.ts refreshes the `[data-now]` text while the card is open. */
const now = (text: string | null | undefined): string =>
  text ? `<em class="insp-now" data-now>${esc(text)}</em>` : "";

const GOLD = "#ffc35a";

/** The "In the scenarios" note on a card: how this part of the storybook shows up in the scenarios the agents really run. */
function scenarioNote(text: string, color: string): string {
  return `<div class="insp-scenarios" style="--c:${color}"><b>In the scenarios</b>${esc(text)}</div>`;
}

/** What the target is doing right now, for the card's "Now" row. */
export function nowText(target: InspectTarget, live?: Live): string | null {
  if (!live) return null;
  switch (target.type) {
    case "owner":
      return live.ownerTask();
    case "staff":
      return live.staffTask(target.id);
    case "agent":
      return live.roleTask(`${target.id}:lead`);
    case "role":
      return live.roleTask(target.id);
    case "desk": {
      const v = live.visitor();
      return v ? `${v.name} · ${v.status}` : "Waiting for the next water taxi";
    }
    case "visitor":
      return live.visitor()?.status ?? null;
    case "adviser":
      return live.adviserTask();
    case "party":
      return live.partyNow();
    case "guest":
      return live.guestTask(target.id);
    default:
      return null;
  }
}

/** Labelled rows; values are HTML built from escaped parts, and empty rows are skipped. */
function facts(rows: Array<[label: string, html: string]>): string {
  const items = rows.filter(([, html]) => html).map(([label, html]) => `<dt>${esc(label)}</dt><dd class="insp-badges">${html}</dd>`);
  return `<dl class="insp-facts">${items.join("")}</dl>`;
}

/* ---------------- Across the house: the layer stack ---------------- */

/** Registers a clickable part of a card's body and returns the attributes that wire it up. */
type Linker = (a: InspectorAction) => string;

/** A layer of the stack that isn't a level of the house: the front desk out on the dock. */
interface Place {
  floor: string;
  name: string;
  accent: string;
}
// U+FE0E asks for the plain text anchor rather than the emoji.
const DOCK: Place = { floor: "⚓\uFE0E", name: "The front desk", accent: GOLD };

/** One level of the house (or the dock) in the stack, styled like its floor slab with the level's edge strip. */
function layer(level: LevelId | Place, here: boolean, body: string, aside = ""): string {
  const l = typeof level === "string" ? levelInfo(level) : level;
  return `<section class="stk-layer${here ? " here" : ""}" style="--c:${l.accent}">
    <b class="stk-floor">${esc(l.floor)}</b>
    <div class="stk-main"><div class="stk-kicker"><span>${esc(l.name)}</span>${aside}</div>${body}</div>
  </section>`;
}

/** The beam between two levels, in the colour it has in the lakehouse. */
function rung(text: string, level: LevelId): string {
  return `<div class="stk-rung" style="--c:${levelInfo(level).accent}">${esc(text)}</div>`;
}

function stackItem(title: string, sub: string, link: Linker, action?: InspectorAction): string {
  const inner = `<b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ""}`;
  return action
    ? `<button type="button" class="stk-item" ${link(action)} title="${esc(action.label)}">${inner}</button>`
    : `<div class="stk-item">${inner}</div>`;
}

function stackChip(text: string, color: string, link: Linker, action?: InspectorAction, on = false): string {
  return action && !on
    ? `<button type="button" class="stk-chip" style="--c:${color}" ${link(action)} title="${esc(action.label)}">${esc(text)}</button>`
    : `<span class="stk-chip${on ? " on" : ""}" style="--c:${color}">${esc(text)}</span>`;
}

const openInfra = (id: InfraId): InspectorAction => ({ label: `Open ${infraShort(id)}`, page: "engine", select: { type: "infra", id } });

/** The engine room's part of a stack: the Microsoft IQ components, then the Azure services. */
function engineBody(uses: InfraId[], link: Linker): string {
  return (["iq", "azure"] as const)
    .map((tier) => {
      const ids = uses.filter((id) => infraInfo(id).tier === tier);
      if (!ids.length) return "";
      const chips = ids.map((id) => stackChip(infraShort(id), infraInfo(id).color, link, openInfra(id))).join("");
      return `<div class="stk-tier" style="--c:${TIERS[tier].color}"><i>${esc(TIERS[tier].name)}</i><div class="stk-chips">${chips}</div></div>`;
    })
    .join("");
}

/**
 * One person's chain through the house, top to bottom: the person, their agent and its
 * assistants, and what it runs on in the engine room. `here` marks the card's own layer (and
 * assistant); every other part is a link.
 */
function chainHtml(staffId: string, here: "staff" | "agent" | { role: string }, link: Linker): string {
  const p = findStaffById(staffId);
  const agent = AGENTS[staffId];
  if (!p || !agent) return "";
  const role = typeof here === "object" ? here.role : null;
  const person = stackItem(p.name, here === "staff" ? p.team : p.role, link, here === "staff" ? undefined : { label: `Up to ${p.name}`, page: "people", select: { type: "staff", id: staffId } });
  const agentItem = stackItem(p.agent_name, "", link, here === "agent" ? undefined : { label: `Meet the ${p.agent_name}`, page: "agents", select: { type: "agent", id: staffId } });
  const assistants = rolesOf(staffId)
    .filter((r) => r.kind !== "lead")
    .map((r) => stackChip(r.short, p.color, link, { label: `Meet ${r.short}`, page: "agents", select: { type: "role", id: r.id } }, r.id === role))
    .join("");
  const side = `<span class="stk-side" style="--c:${SIDES[agent.side].color}">${esc(sideBadge(agent.side))}</span>`;
  return `<h4>Across the house</h4><div class="insp-stack">
    ${layer("people", here === "staff", person)}
    ${rung("supported by", "people")}
    ${layer("agents", here !== "staff", `${agentItem}<div class="stk-chips">${assistants}</div>`, side)}
    ${rung("runs on", "engine")}
    ${layer("engine", false, engineBody(agent.uses, link))}
  </div>`;
}

const meetStaff = (id: string, name: string): InspectorAction => ({ label: `Meet ${name}`, page: "people", select: { type: "staff", id } });

/** The whole house under Maya: both teams, the agents that support them, and what they run on. */
function ownerHtml(link: Linker): string {
  const teams = (["wealth", "super", "shared"] as const)
    .map((side) => {
      const people = STAFF_PERSONAS.filter((p) => teamSide(p.team) === side);
      if (!people.length) return "";
      const chips = people.map((p) => stackChip(p.name, p.color, link, meetStaff(p.id, p.name))).join("");
      const title = side === "shared" ? "Leading both teams" : SIDES[side].team;
      return `<div class="stk-tier" style="--c:${SIDES[side].color}"><i>${esc(title)}</i><div class="stk-chips">${chips}</div></div>`;
    })
    .join("");
  const zones = (["wealth", "shared", "super"] as const)
    .map((side) => {
      const n = Object.values(AGENTS).filter((a) => a.side === side).length;
      return stackChip(`${sideBadge(side)} · ${n}`, SIDES[side].color, link, { label: "Meet the agents", page: "agents" });
    })
    .join("");
  const uses = [...new Set(Object.values(AGENTS).flatMap((a) => a.uses))];
  return `<h4>Across the house</h4><div class="insp-stack">
    ${layer("idea", true, stackItem(OWNER.name, OWNER.badge, link))}
    ${rung("sets the goals for", "idea")}
    ${layer("people", false, teams)}
    ${rung("supported by", "people")}
    ${layer("agents", false, `${stackItem("One group of agents", "Each with its own assistants", link)}<div class="stk-chips">${zones}</div>`)}
    ${rung("runs on", "engine")}
    ${layer("engine", false, engineBody(uses, link))}
  </div>`;
}

/** The same cross-section for one engine-room component: who runs on it. */
function usersHtml(id: InfraId, link: Linker): string {
  const users = agentsUsing(id)
    .map((sid) => findStaffById(sid))
    .filter((p): p is NonNullable<typeof p> => !!p);
  const people = users.map((p) => stackChip(p.name, p.color, link, meetStaff(p.id, p.name))).join("");
  const agents =
    users.length === STAFF_PERSONAS.length
      ? stackItem("Every agent", "on both sides", link)
      : `<div class="stk-chips">${users
          .map((p) => stackChip(p.agent_name, p.color, link, { label: `Meet the ${p.agent_name}`, page: "agents", select: { type: "agent", id: p.id } }))
          .join("")}</div>`;
  const i = infraInfo(id);
  return `<h4>Across the house</h4><div class="insp-stack">
    ${layer("people", false, `<div class="stk-chips">${people}</div>`)}
    ${rung("supported by", "people")}
    ${layer("agents", false, agents)}
    ${rung("runs on", "engine")}
    ${layer("engine", true, stackItem(infraShort(id), TIERS[i.tier].name, link))}
  </div>`;
}

/** Amelia's cross-section: the front desk, the agents she links customers with, and what they run on. */
function adviserHtml(link: Linker): string {
  const chips = ADVISER.links
    .map((l) => {
      const p = findStaffById(l.id);
      // Short names keep the four on two rows; the layer already says they are agents.
      return p
        ? stackChip(p.agent_name.replace(/ Agent$/, ""), p.color, link, { label: `Meet the ${p.agent_name}. ${l.why}.`, page: "agents", select: { type: "agent", id: p.id } })
        : "";
    })
    .join("");
  const uses = [...new Set(ADVISER.links.flatMap((l) => AGENTS[l.id]?.uses ?? []))];
  const both = `<span class="stk-side" style="--c:${SIDES.shared.color}">${esc(SIDES.shared.name)}</span>`;
  return `<h4>Across the house</h4><div class="insp-stack">
    ${layer(DOCK, true, stackItem(ADVISER.name, `${ADVISER.role} · gives the advice`, link))}
    ${rung("links customers with", "agents")}
    ${layer("agents", false, `<div class="stk-chips">${chips}</div>`, both)}
    ${rung("runs on", "engine")}
    ${layer("engine", false, engineBody(uses, link))}
  </div>`;
}

function levelLine(id: LevelId, place?: string): string {
  const l = levelInfo(id);
  const text = place ?? `${l.floor === "B" ? "Lower level" : `Level ${l.floor}`} · ${l.name}`;
  return `<div class="insp-level" style="--c:${l.accent}">${esc(text)}</div>`;
}

/** The card's head. `link` is HTML for a link under the subtitle (see agentPageLink). */
function head(avatar: string, level: LevelId, title: string, subtitle: string, place?: string, link = ""): string {
  return `<header class="insp-head">
    <div class="insp-avatar">${avatar}</div>
    <div>${levelLine(level, place)}<h3>${esc(title)}</h3><div class="insp-role">${esc(subtitle)}</div>${link}</div>
  </header>`;
}

function robotSvg(color: string): string {
  return `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="40" height="40" rx="6" fill="rgba(255,255,255,0.04)"/>
    <rect x="19" y="3" width="2" height="5" fill="#dfeaf7"/><rect x="17.5" y="1.5" width="5" height="3" fill="#6ec1ff"/>
    <rect x="11" y="8" width="18" height="12" rx="2" fill="#dfeaf7"/>
    <rect x="13" y="11" width="14" height="5" fill="#16213a"/>
    <rect x="15" y="12.5" width="3" height="2" fill="#6ec1ff"/><rect x="22" y="12.5" width="3" height="2" fill="#6ec1ff"/>
    <rect x="9" y="21" width="22" height="13" rx="2" fill="${color}"/>
    <rect x="16" y="24" width="8" height="5" fill="#6ec1ff"/>
  </svg>`;
}

function badgeSvg(color: string, letter: string): string {
  return `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="40" height="40" rx="8" fill="${color}" opacity="0.9"/>
    <rect x="6" y="6" width="28" height="28" rx="4" fill="rgba(10,14,30,0.75)"/>
    <text x="20" y="27" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="17" font-weight="800" fill="${color}">${esc(letter)}</text>
  </svg>`;
}

/** Three voxel balloons and some confetti, for the party's card. */
function partySvg(): string {
  return `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="40" height="40" rx="8" fill="rgba(255,255,255,0.04)"/>
    <path d="M12 17 L19 34 M21 14 L19 34 M29 19 L19 34" stroke="#dfe6f2" stroke-width="1.2" fill="none"/>
    <rect x="6" y="6" width="11" height="12" rx="3" fill="#ffc35a"/>
    <rect x="15.5" y="3" width="11" height="12" rx="3" fill="#14b8a6"/>
    <rect x="24" y="8" width="11" height="12" rx="3" fill="#8b9cf7"/>
    <rect x="5" y="29" width="3" height="3" fill="#ff8f6b"/><rect x="31" y="27" width="3" height="3" fill="#5ce1ff"/>
    <rect x="27" y="33" width="3" height="3" fill="#ffc35a"/>
  </svg>`;
}

function agentHref(staffId: string): string | undefined {
  const p = findStaffById(staffId);
  return APP_BASE_URL && p ? `${APP_BASE_URL}/agents/${p.app_agent_id}` : undefined;
}

/** "Open the agent page ↗" under the name on the agent floor's cards: the agent's own backend page, in a new tab. */
function agentPageLink(staffId: string): string {
  const href = agentHref(staffId);
  const p = findStaffById(staffId);
  if (!href || !p) return "";
  return `<a class="btn insp-open" href="${esc(href)}" target="_blank" rel="noopener" title="Opens the ${esc(p.agent_name)} page in a new tab">Open the agent page ↗</a>`;
}

/** "Ivy, Felix and Cara" */
function teamNames(team: StaffTeam): string {
  const names = STAFF_PERSONAS.filter((p) => p.team === team).map((p) => p.name);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : (names[0] ?? "");
}

function sideRow(side: SideId, text: string): string {
  const s = SIDES[side];
  return `<div class="insp-goal side" style="--c:${s.color}"><b>${esc(s.name)}</b><span>${esc(text)}</span></div>`;
}

/** The two sides of the business, each with its products and its small team, and the agents between them. */
function sidesHtml(): string {
  const team = (side: "wealth" | "super"): string =>
    `${SIDES[side].products.join(" · ")}. A small expert team: ${teamNames(SIDES[side].team)}.`;
  const agents = `<div class="insp-goal side" style="--c:${SIDES.shared.color}"><b>One group of agents</b><span>Supports both teams: dedicated to a side where the work is specialised, shared where it isn’t, all grounded in Microsoft IQ.</span></div>`;
  return `<div class="insp-goals">${sideRow("wealth", team("wealth"))}${agents}${sideRow("super", team("super"))}</div>`;
}

/** "Benefits & Eligibility Agent, Financial Crime Agent" */
function agentNames(staffIds: string[]): string {
  return esc(
    staffIds
      .map((id) => findStaffById(id)?.agent_name)
      .filter((n): n is string => !!n)
      .join(", "),
  );
}

export function inspectorView(target: InspectTarget, live?: Live): InspectorView {
  const links: InspectorAction[] = [];
  const link: Linker = (a) => {
    links.push(a);
    return `data-insp="link" data-i="${links.length - 1}"`;
  };
  return { ...card(target, link, live), links };
}

function card(target: InspectTarget, link: Linker, live?: Live): Omit<InspectorView, "links"> {
  switch (target.type) {
    case "owner": {
      return {
        accent: OWNER.color,
        html: `${head(renderCharacterFigureSvg(OWNER.palette, OWNER.color), "idea", OWNER.name, OWNER.role)}
          <p class="insp-lede">${esc(OWNER.badge)}.</p>
          ${facts([
            ["Goals", esc(IDEA.goals.map((g) => g.title).join(", "))],
            ["Now", now(nowText(target, live))],
          ])}
          ${ownerHtml(link)}`,
        actions: [
          { label: "See her idea", select: { type: "brain" }, primary: true },
          { label: "Meet the team ↓", page: "people" },
        ],
      };
    }
    case "brain": {
      const goals = IDEA.goals
        .map((g) => `<div class="insp-goal"><b>${esc(g.title)}</b><span>${esc(g.text)}</span></div>`)
        .join("");
      const steps = IDEA.lifecycle.map((s, i) => `<span>${i + 1} ${esc(s)}</span>`).join("<i>›</i>");
      return {
        accent: OWNER.color,
        html: `${head(badgeSvg(OWNER.color, "✦"), "idea", "The idea", `${IDEA.name} · ${IDEA.era}`)}
          <p class="insp-lede">${esc(IDEA.statement)}</p>
          <h4>Two sides, one group of agents</h4>${sidesHtml()}
          <h4>The goals</h4><div class="insp-goals">${goals}</div>
          <h4>One lifecycle for every request</h4><div class="insp-steps">${steps}</div>
          <h4>A person always approves</h4>${list(IDEA.guardrails)}
          <p class="insp-note">${esc(IDEA.never)}</p>`,
        actions: [
          { label: "Meet the team ↓", page: "people", primary: true },
          { label: "Meet Maya", select: { type: "owner" } },
        ],
      };
    }
    case "staff": {
      const p = findStaffById(target.id);
      const agent = AGENTS[target.id];
      if (!p || !agent) break;
      return {
        accent: p.color,
        html: `${head(renderCharacterFigureSvg(PALETTES[p.palette], p.color), "people", p.name, p.role)}
          <p class="insp-lede">${esc(p.role_line)}</p>
          ${facts([["Now", now(nowText(target, live))]])}
          ${chainHtml(p.id, "staff", link)}`,
        actions: [
          { label: `Follow ${p.name} down to the agent ↓`, page: "agents", select: { type: "agent", id: p.id }, primary: true },
          ...(agentHref(p.id) ? [{ label: "Open the agent page ↗", href: agentHref(p.id) }] : []),
        ],
      };
    }
    case "agent": {
      const p = findStaffById(target.id);
      const agent = AGENTS[target.id];
      if (!p || !agent) break;
      const handsTo = HANDOFFS[target.id] ?? [];
      return {
        accent: p.color,
        html: `${head(robotSvg(p.color), "agents", p.agent_name, `Works for ${p.name}, who decides`, undefined, agentPageLink(p.id))}
          <p class="insp-lede">${esc(p.agent_tagline)}</p>
          ${facts([
            [target.id === "lead-1" ? "Coordinates" : "Hands off to", agentNames(handsTo)],
            ["Now", now(nowText(target, live))],
          ])}
          ${chainHtml(p.id, "agent", link)}`,
        actions: [
          { label: `Back up to ${p.name} ↑`, page: "people", select: { type: "staff", id: p.id } },
          { label: "What powers it ↓", page: "engine", select: { type: "agent", id: p.id }, primary: true },
        ],
      };
    }
    case "role": {
      const role = roleInfo(target.id);
      const p = role ? findStaffById(role.staffId) : undefined;
      const agent = role ? AGENTS[role.staffId] : undefined;
      if (!role || !p || !agent) break;
      return {
        accent: p.color,
        html: `${head(robotSvg(p.color), "agents", role.short, role.kind === "voice" ? `The voice of the ${p.agent_name}` : `Assistant to the ${p.agent_name}`, undefined, agentPageLink(p.id))}
          <p class="insp-lede">${esc(role.description)}</p>
          ${facts([
            ["Also", role.id === DESK_ROLE ? esc("Reads every signed form at the front desk") : ""],
            ["Now", now(nowText(target, live))],
          ])}
          ${chainHtml(p.id, { role: role.id }, link)}`,
        actions: [
          { label: `Meet the ${p.agent_name}`, select: { type: "agent", id: p.id }, primary: true },
          { label: `Up to ${p.name} ↑`, page: "people", select: { type: "staff", id: p.id } },
        ],
      };
    }
    case "desk": {
      const olivia = findStaffById(roleInfo(DESK_ROLE)?.staffId ?? "");
      const reader = roleInfo(DESK_ROLE);
      const visitor = live?.visitor() ?? null;
      const actions: InspectorAction[] = [];
      if (visitor) actions.push({ label: "Who is signing", select: { type: "visitor" }, primary: true });
      actions.push({ label: `Meet ${ADVISER.name}`, select: { type: "adviser" }, primary: !visitor });
      actions.push({ label: `Meet the ${reader?.short ?? "Form Extraction"} agent`, page: "agents", select: { type: "role", id: DESK_ROLE } });
      if (olivia) actions.push({ label: `Up to ${olivia.name} ↑`, page: "people", select: { type: "staff", id: olivia.id } });
      return {
        accent: GOLD,
        html: `${head(renderCharacterFigureSvg(PALETTES.receptionGreeter, GOLD), "agents", FRONT_DESK.name, "Where every request comes in", "On the dock · beside Level 1")}
          <p class="insp-lede">${esc(FRONT_DESK.summary)}</p>
          ${scenarioNote(FRONT_DESK.inScenarios, GOLD)}
          ${facts([
            ["Adviser", chip(`${ADVISER.name} · ${ADVISER.role}`, ADVISER.color)],
            ["Read by", reader && olivia ? chip(`${reader.short} · ${olivia.name}’s agent`, olivia.color) : ""],
            ["Now", now(nowText(target, live))],
          ])}`,
        actions,
      };
    }
    case "visitor": {
      const v = live?.visitor() ?? null;
      if (!v) {
        return {
          accent: GOLD,
          html: `${head(badgeSvg(GOLD, "⚓"), "agents", "Between visitors", "The front desk", "On the dock · beside Level 1")}
            <p class="insp-lede">The next water taxi is on its way.</p>`,
          actions: [{ label: "The front desk", select: { type: "desk" }, primary: true }],
        };
      }
      const side = SIDES[v.side];
      const member = v.kind === "member" ? CUSTOMER_PERSONAS.find((c) => c.id === v.scenario) : undefined;
      const color = v.kind === "impostor" ? "#ef4444" : (member?.color ?? side.color);
      const subtitle =
        v.kind === "member" ? `A ${side.name} member` : v.kind === "impostor" ? "Not who they say they are" : "A visitor to the front desk";
      return {
        accent: color,
        html: `${head(renderCharacterFigureSvg(v.palette, color), "agents", v.name, subtitle, "On the dock · the front desk")}
          <p class="insp-lede">${esc(v.summary)}</p>
          ${facts([
            ["Signing", esc(v.doc)],
            ["Side", chip(side.name, side.color)],
            ["Now", now(nowText(target, live))],
          ])}`,
        actions: [
          { label: "The front desk", select: { type: "desk" }, primary: true },
          { label: `Meet ${ADVISER.name}`, select: { type: "adviser" } },
        ],
      };
    }
    case "adviser": {
      const v = live?.visitor() ?? null;
      const actions: InspectorAction[] = [];
      if (v) actions.push({ label: "Who she’s helping", select: { type: "visitor" }, primary: true });
      actions.push({ label: "The front desk", select: { type: "desk" }, primary: !v });
      if (APP_BASE_URL) actions.push({ label: "Open the onboarding scenario ↗", href: `${APP_BASE_URL}/scenarios/new-client-onboarding` });
      return {
        accent: ADVISER.color,
        html: `${head(renderCharacterFigureSvg(ADVISER.palette, ADVISER.color), "agents", ADVISER.name, ADVISER.role, "On the dock · the front desk")}
          <p class="insp-lede">${esc(ADVISER.line)}</p>
          ${facts([
            ["Helping", v ? esc(v.name) : ""],
            ["Now", now(nowText(target, live))],
          ])}
          ${adviserHtml(link)}`,
        actions,
      };
    }
    case "party": {
      const george = PARTY_GUESTS.find((g) => g.id === "george");
      return {
        accent: GOLD,
        html: `${head(partySvg(), "idea", PARTY.name, "A party for Caldova’s customers", "On the roof")}
          <p class="insp-lede">${esc(PARTY.summary)}</p>
          ${facts([
            ["Guests", esc(PARTY.guests)],
            ["Now", now(nowText(target, live))],
          ])}`,
        actions: [
          { label: "Take a closer look", shot: PARTY_SHOT, primary: true },
          ...(george ? [{ label: `Meet ${george.name.split(" ")[0]}`, select: { type: "guest", id: george.id } as InspectTarget }] : []),
        ],
      };
    }
    case "guest": {
      const g = PARTY_GUESTS.find((x) => x.id === target.id);
      if (!g) break;
      const member = g.scenario ? CUSTOMER_PERSONAS.find((c) => c.id === g.scenario) : undefined;
      const color = member?.color ?? (g.side ? SIDES[g.side].color : GOLD);
      const actions: InspectorAction[] = [];
      if (g.scenario && g.story) actions.push({ label: g.story, page: "finale", scenario: g.scenario, primary: true });
      actions.push({ label: "The celebration", select: { type: "party" }, primary: !g.story });
      return {
        accent: color,
        html: `${head(renderCharacterFigureSvg(g.palette, color), "idea", g.name, g.role, "On the roof · the celebration")}
          <p class="insp-lede">${esc(g.line)}</p>
          ${facts([
            ["Side", g.side ? chip(SIDES[g.side].name, SIDES[g.side].color) : ""],
            [g.with?.[0] ?? "", g.with ? esc(g.with[1]) : ""],
            ["Now", now(nowText(target, live))],
          ])}`,
        actions,
      };
    }
    case "infra": {
      const i = infraInfo(target.id);
      const tier = TIERS[i.tier];
      const note = i.inScenarios ? scenarioNote(i.inScenarios, tier.color) : "";
      return {
        accent: i.color,
        html: `${head(badgeSvg(i.color, i.sign.charAt(0)), "engine", i.name, i.kind)}
          <div class="insp-badges"><span style="--c:${tier.color}">${esc(tier.name)} · ${esc(tier.tagline)}</span></div>
          <p class="insp-lede">${esc(i.summary)}</p>
          ${note}
          ${i.details.length ? `<h4>Technical details</h4>${list(i.details)}` : ""}
          <h4>Security and network</h4><p class="insp-note">${esc(i.security)}</p>
          ${usersHtml(i.id, link)}`,
        actions: [{ label: "Back up to the agents ↑", page: "agents", select: { type: "infra", id: i.id }, primary: true }],
      };
    }
  }
  return { accent: "#ffc35a", html: "", actions: [] };
}

/** Short hover label for the tooltip. */
export function tooltipText(target: InspectTarget, live?: Live): string {
  switch (target.type) {
    case "owner":
      return `${OWNER.name} · ${OWNER.badge}`;
    case "brain":
      return "The idea · click to see the goals";
    case "staff": {
      const p = findStaffById(target.id);
      return p ? `${p.name} · ${p.department}` : "";
    }
    case "agent": {
      const p = findStaffById(target.id);
      const agent = AGENTS[target.id];
      return p && agent ? `${p.agent_name} · ${sideBadge(agent.side)}` : "";
    }
    case "role": {
      const role = roleInfo(target.id);
      const p = role ? findStaffById(role.staffId) : undefined;
      return role && p ? `${role.short} · ${p.name}’s agent` : "";
    }
    case "infra": {
      const i = infraInfo(target.id);
      return `${i.name} · ${i.kind}`;
    }
    case "desk":
      return "The front desk · where requests come in";
    case "visitor": {
      const v = live?.visitor();
      return v ? `${v.name} · ${v.status}` : "A visitor at the front desk";
    }
    case "adviser":
      return `${ADVISER.name} · ${ADVISER.role} at the front desk`;
    case "party":
      return `${PARTY.name} · a party for Caldova’s customers`;
    case "guest": {
      const g = PARTY_GUESTS.find((x) => x.id === target.id);
      return g ? `${g.name} · ${g.role}` : "";
    }
  }
}
