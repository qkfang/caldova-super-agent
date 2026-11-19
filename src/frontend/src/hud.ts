import { AgentRole, SimLogger } from "./caseSimulation";
import { STAFF_TEAMS, type StaffTeam } from "./personaData";
import type { VoxelCharacterPalette } from "./voxelCharacter";
import { renderCharacterFigureSvg } from "./characterFigure";

/**
 * Wires the in-DOM HUD (top-bar metrics, agent panel, activity log) to the
 * simulation via the SimLogger contract.
 */
export class HudLogger implements SimLogger {
  private readonly metricEls: Record<string, HTMLElement>;
  private readonly logList: HTMLOListElement;
  private readonly agentList: HTMLUListElement;
  private readonly agentEls = new Map<string, HTMLLIElement>();
  private readonly teamHeadings = new Map<string, HTMLLIElement>();

  constructor() {
    this.metricEls = {
      submitted: HudLogger.must("metric-submitted"),
      processing: HudLogger.must("metric-processing"),
      approved: HudLogger.must("metric-approved"),
      rejected: HudLogger.must("metric-rejected"),
    };
    this.logList = HudLogger.must("log-list") as HTMLOListElement;
    this.agentList = HudLogger.must("agents-list") as HTMLUListElement;
    // One heading per team so the AI Agents panel mirrors the office wings.
    for (const team of STAFF_TEAMS) {
      const heading = document.createElement("li");
      heading.className = "agent-team";
      heading.style.setProperty("--team-color", team.color);
      heading.innerHTML = `<span class="team-name"></span><span class="team-blurb"></span>`;
      (heading.querySelector(".team-name") as HTMLElement).textContent = team.name;
      (heading.querySelector(".team-blurb") as HTMLElement).textContent = team.blurb;
      this.agentList.appendChild(heading);
      this.teamHeadings.set(team.name, heading);
    }
  }

  private static must(id: string): HTMLElement {
    const el = document.getElementById(id);
    if (!el) throw new Error(`HUD element #${id} not found`);
    return el;
  }

  setMetric(name: "submitted" | "processing" | "approved" | "rejected", value: number): void {
    this.metricEls[name].textContent = String(value);
  }

  /** Called when a staff card in the AI Agents panel is clicked (single) or double-clicked. */
  onAgentCard: ((id: string, double: boolean) => void) | null = null;
  private focusedId: string | null = null;

  /** Highlight (and scroll to) a staff card in the AI Agents panel, or clear with null. */
  focusAgent(id: string | null): void {
    if (this.focusedId) this.agentEls.get(this.focusedId)?.classList.remove("focused");
    this.focusedId = id;
    if (!id) return;
    const li = this.agentEls.get(id);
    li?.classList.add("focused");
    li?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  registerAgent(info: { id: string; name: string; role: AgentRole; team: StaffTeam; color: string; palette: VoxelCharacterPalette }): void {
    const li = document.createElement("li");
    li.className = "agent-card idle";
    li.dataset.id = info.id;
    li.addEventListener("click", () => this.onAgentCard?.(info.id, false));
    li.addEventListener("dblclick", () => this.onAgentCard?.(info.id, true));
    const figure = renderCharacterFigureSvg(info.palette, info.color);
    li.innerHTML = `
      <div class="figure">${figure}</div>
      <div>
        <div class="name"></div>
        <div class="role"></div>
      </div>
      <div class="status">Idle</div>
    `;
    (li.querySelector(".name") as HTMLElement).textContent = info.name;
    (li.querySelector(".role") as HTMLElement).textContent = info.role;
    // Slot the card under its team heading (just before the next team's heading).
    const teamIdx = STAFF_TEAMS.findIndex((t) => t.name === info.team);
    const nextHeading =
      teamIdx >= 0 && teamIdx + 1 < STAFF_TEAMS.length
        ? this.teamHeadings.get(STAFF_TEAMS[teamIdx + 1].name) ?? null
        : null;
    this.agentList.insertBefore(li, nextHeading);
    this.agentEls.set(info.id, li);
  }

  setAgentStatus(id: string, busy: boolean, activity: string): void {
    const li = this.agentEls.get(id);
    if (!li) return;
    li.classList.toggle("busy", busy);
    li.classList.toggle("idle", !busy);
    const status = li.querySelector(".status") as HTMLElement;
    status.textContent = activity;
  }

  log(message: string, kind: "info" | "good" | "bad" | "warn" = "info"): void {
    const li = document.createElement("li");
    if (kind !== "info") li.classList.add(kind);
    const t = document.createElement("time");
    const now = new Date();
    t.textContent = now.toLocaleTimeString();
    li.appendChild(t);
    li.appendChild(document.createTextNode(message));
    this.logList.insertBefore(li, this.logList.firstChild);
    // Cap log size.
    while (this.logList.children.length > 60) {
      this.logList.lastElementChild?.remove();
    }
  }
}

