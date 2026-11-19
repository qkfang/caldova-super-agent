/**
 * Inspector card content for everything the visitor can click in the
 * lakehouse: Maya, the brain, each person, each agent and each engine-room
 * component. Each card ends with actions that move up or down the house
 * along the same thread (person ↔ agent ↔ infrastructure).
 */
import { renderCharacterFigureSvg } from "../characterFigure";
import { PALETTES } from "../characterPalettes";
import { findStaffById, STAFF_PERSONAS, type StaffTeam } from "../personaData";
import { APP_BASE_URL, STAGE_CONFIG } from "../stepGate";
import {
  AGENTS,
  IDEA,
  OWNER,
  SIDES,
  TIERS,
  agentsUsing,
  infraInfo,
  levelInfo,
  sideBadge,
  teamSide,
  type LevelId,
  type SideId,
} from "./lakehouseData";
import type { PageId } from "./storyData";
import type { InspectTarget } from "./types";

export interface InspectorAction {
  label: string;
  page?: PageId;
  select?: InspectTarget;
  href?: string;
  primary?: boolean;
}

export interface InspectorView {
  accent: string;
  html: string;
  actions: InspectorAction[];
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ESCAPES[c]);

const list = (items: string[]): string => `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;

function levelLine(id: LevelId): string {
  const l = levelInfo(id);
  return `<div class="insp-level" style="--c:${l.accent}">${l.floor === "B" ? "Lower level" : `Level ${l.floor}`} · ${esc(l.name)}</div>`;
}

function head(avatar: string, level: LevelId, title: string, subtitle: string): string {
  return `<header class="insp-head">
    <div class="insp-avatar">${avatar}</div>
    <div>${levelLine(level)}<h3>${esc(title)}</h3><div class="insp-role">${esc(subtitle)}</div></div>
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

function agentHref(staffId: string): string | undefined {
  const p = findStaffById(staffId);
  return APP_BASE_URL && p ? `${APP_BASE_URL}/agents/${p.app_agent_id}` : undefined;
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

/** The two sides of the business, each with its products and its small team. */
function sidesHtml(withAgents: boolean): string {
  const team = (side: "wealth" | "super"): string =>
    `${SIDES[side].products.join(" · ")}. A small expert team: ${teamNames(SIDES[side].team)}.`;
  const agents = withAgents
    ? `<div class="insp-goal side" style="--c:${SIDES.shared.color}"><b>One group of agents</b><span>Supports both teams: dedicated to a side where the work is specialised, shared where it isn’t, all grounded in Microsoft IQ.</span></div>`
    : "";
  return `<div class="insp-goals">${sideRow("wealth", team("wealth"))}${agents}${sideRow("super", team("super"))}</div>`;
}

const SIDE_SHORT: Record<SideId, string> = { wealth: "Wealth", super: "Super", shared: "Shared" };

export function inspectorView(target: InspectTarget): InspectorView {
  switch (target.type) {
    case "owner": {
      return {
        accent: OWNER.color,
        html: `${head(renderCharacterFigureSvg(OWNER.palette, OWNER.color), "idea", OWNER.name, OWNER.role)}
          <div class="insp-badges"><span style="--c:${OWNER.color}">${esc(OWNER.badge)}</span></div>
          <p class="insp-lede">${esc(OWNER.summary)}</p>
          <blockquote>“${esc(OWNER.typical_line)}”</blockquote>
          <h4>Her two sides</h4>${sidesHtml(false)}
          <h4>What Maya owns</h4>${list(OWNER.owns)}
          <p class="insp-note">${esc(OWNER.personality)}</p>`,
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
          <h4>Two sides, one group of agents</h4>${sidesHtml(true)}
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
      const team = SIDES[teamSide(p.team)];
      const agentSide = SIDES[agent.side];
      return {
        accent: p.color,
        html: `${head(renderCharacterFigureSvg(PALETTES[p.palette], p.color), "people", p.name, p.role)}
          <div class="insp-badges"><span style="--c:${p.color}">${esc(p.department)}</span><span style="--c:${team.color}">${esc(p.team)}</span></div>
          <p class="insp-lede">${esc(p.role_short)}</p>
          <blockquote>“${esc(p.typical_line)}”</blockquote>
          <h4>What ${esc(p.name)} does</h4>${list(p.responsibilities)}
          <h4>Their agent, one floor down</h4>
          <div class="insp-link-row" style="--c:${p.color}"><b>${esc(p.agent_name)}</b><code>${esc(agent.foundryId)}</code></div>
          <div class="insp-badges"><span style="--c:${agentSide.color}">${esc(sideBadge(agent.side))}</span></div>
          <p class="insp-note">${esc(agent.sideNote)}</p>
          <p class="insp-note">${esc(p.personality)}</p>`,
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
      const subs = Object.values(STAGE_CONFIG).find((s) => s.role === p.role)?.agents ?? [];
      const assistants = subs
        .map((s) => `<div class="insp-goal"><b>${esc(s.name)}</b><span>${esc(s.description)}</span></div>`)
        .join("");
      const deps = agent.uses
        .map((id) => {
          const i = infraInfo(id);
          return `<span style="--c:${i.color}">${esc(i.name)}</span>`;
        })
        .join("");
      const voice = agent.voiceId
        ? `<div class="insp-link-row" style="--c:${p.color}"><b>Voice agent</b><code>${esc(agent.voiceId)}</code></div>`
        : "";
      const side = SIDES[agent.side];
      return {
        accent: p.color,
        html: `${head(robotSvg(p.color), "agents", p.agent_name, `Works for ${p.name} · ${p.department}`)}
          <div class="insp-badges"><span style="--c:${side.color}">${esc(sideBadge(agent.side))}</span><span style="--c:${SIDES[teamSide(p.team)].color}">${esc(p.name)} · ${esc(p.team)}</span></div>
          <p class="insp-note">${esc(agent.sideNote)}</p>
          <div class="insp-link-row" style="--c:${p.color}"><b>Foundry agent</b><code>${esc(agent.foundryId)}</code></div>${voice}
          <p class="insp-lede">${esc(p.agent_tagline)} ${esc(agent.signatureLine)}</p>
          <h4>Two specialised assistants</h4><div class="insp-goals">${assistants}</div>
          <h4>What it runs on, one floor down</h4><div class="insp-badges">${deps}</div>
          <p class="insp-note">Agents recommend; ${esc(p.name)} decides. Agents never give personal financial advice.</p>`,
        actions: [
          { label: `Back up to ${p.name} ↑`, page: "people", select: { type: "staff", id: p.id } },
          { label: "What powers it ↓", page: "engine", select: { type: "agent", id: p.id }, primary: true },
          ...(agentHref(p.id) ? [{ label: "Open the agent page ↗", href: agentHref(p.id) }] : []),
        ],
      };
    }
    case "infra": {
      const i = infraInfo(target.id);
      const tier = TIERS[i.tier];
      const users = agentsUsing(i.id);
      const usedBy =
        users.length === STAFF_PERSONAS.length
          ? `<span style="--c:${i.color}">Every agent, on both sides</span>`
          : users
              .map((id) => {
                const p = findStaffById(id);
                const side = AGENTS[id]?.side;
                return p && side ? `<span style="--c:${p.color}">${esc(p.agent_name)} · ${SIDE_SHORT[side]}</span>` : "";
              })
              .join("");
      const demo = i.demo ? `<div class="insp-demo" style="--c:${tier.color}"><b>In this demo</b>${esc(i.demo)}</div>` : "";
      return {
        accent: i.color,
        html: `${head(badgeSvg(i.color, i.sign.charAt(0)), "engine", i.name, i.kind)}
          <div class="insp-badges"><span style="--c:${tier.color}">${esc(tier.name)} · ${esc(tier.tagline)}</span></div>
          <p class="insp-lede">${esc(i.summary)}</p>
          ${demo}
          ${i.details.length ? `<h4>Technical details</h4>${list(i.details)}` : ""}
          <h4>Security and network</h4><p class="insp-note">${esc(i.security)}</p>
          <h4>Used by</h4><div class="insp-badges">${usedBy}</div>`,
        actions: [{ label: "Back up to the agents ↑", page: "agents", select: { type: "infra", id: i.id }, primary: true }],
      };
    }
  }
  return { accent: "#ffc35a", html: "", actions: [] };
}

/** Short hover label for the tooltip. */
export function tooltipText(target: InspectTarget): string {
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
    case "infra": {
      const i = infraInfo(target.id);
      return `${i.name} · ${i.kind}`;
    }
  }
}
