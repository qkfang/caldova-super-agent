import type { CaseSimulation, CharacterProfile } from "./caseSimulation";
import { renderCharacterFigureSvg } from "./characterFigure";

/**
 * Centered profile popup shown when a character is clicked.
 *
 * For staff it shows the human on the left and the AI agent working behind
 * them ("under the hood") on the right, with a link to the agent's page in
 * the backend. For clients it shows the person and their case.
 *
 * The popup re-queries the simulation once per second so live status (current
 * task, case number) stays current, but only re-renders when something
 * changed so links stay clickable. Closes on Escape, a click on the dimmed
 * backdrop, or the close button.
 */
export class ProfileCard {
  private readonly overlay: HTMLDivElement;
  private readonly el: HTMLDivElement;
  private currentId: string | null = null;
  private refreshHandle: number | null = null;
  private lastHtml = "";

  constructor(
    private readonly sim: CaseSimulation,
    private readonly onSelect?: (staffId: string | null) => void,
  ) {
    const overlay = document.createElement("div");
    overlay.id = "profile-overlay";
    overlay.className = "profile-overlay hidden";
    const el = document.createElement("div");
    el.id = "profile-card";
    el.className = "profile-card";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.tabIndex = -1;
    overlay.appendChild(el);
    document.body.appendChild(overlay);
    this.overlay = overlay;
    this.el = el;

    overlay.addEventListener("pointerdown", (ev) => {
      if (ev.target === overlay) this.close();
    });

    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && this.isOpen()) {
        this.close();
      }
    });
  }

  isOpen(): boolean {
    return this.currentId !== null;
  }

  open(characterId: string): void {
    const profile = this.sim.getCharacterProfile(characterId);
    if (!profile) return;
    this.currentId = characterId;
    this.lastHtml = "";
    this.render(profile);
    // Spotlight the agents behind a human; the spotlight stays on after the
    // popup closes, until another character is selected.
    this.onSelect?.(profile.kind === "staff" ? characterId : null);
    this.overlay.classList.remove("hidden");
    this.el.focus();
    if (this.refreshHandle === null) {
      this.refreshHandle = window.setInterval(() => this.refresh(), 1000);
    }
  }

  close(): void {
    if (!this.isOpen()) return;
    this.currentId = null;
    this.overlay.classList.add("hidden");
    if (this.refreshHandle !== null) {
      window.clearInterval(this.refreshHandle);
      this.refreshHandle = null;
    }
    this.sim.setHighlightedCharacter(null);
  }

  private refresh(): void {
    if (!this.currentId) return;
    const profile = this.sim.getCharacterProfile(this.currentId);
    if (!profile) {
      this.close();
      return;
    }
    this.render(profile);
  }

  private render(p: CharacterProfile): void {
    const escape = (s: string): string =>
      s.replace(/[&<>"']/g, (c) =>
        c === "&"
          ? "&amp;"
          : c === "<"
          ? "&lt;"
          : c === ">"
          ? "&gt;"
          : c === '"'
          ? "&quot;"
          : "&#39;",
      );

    const headerColor = p.color;
    const titleLine =
      p.kind === "staff"
        ? p.team
          ? `${p.role} · ${p.team}`
          : p.role
        : `Client — ${p.scenarioName}`;

    const responsibilities = p.responsibilities
      .map((r) => `<li>${escape(r)}</li>`)
      .join("");

    const casesList = p.cases
      .slice(0, 6)
      .map(
        (c) =>
          `<li><strong>${escape(c.id)}</strong> — ${escape(c.type)} <span class="status">${escape(
            c.status,
          )}</span></li>`,
      )
      .join("");

    const currentBlock = p.current
      ? `<div class="profile-current">
            <div class="label">Currently</div>
            <div class="value">${escape(p.current)}</div>
          </div>`
      : "";

    const handlerBlock =
      p.kind === "customer" && p.currentHandler
        ? `<div class="profile-current">
            <div class="label">With</div>
            <div class="value">${escape(p.currentHandler)}</div>
          </div>`
        : "";

    const caseBlock =
      p.kind === "customer" && p.activeCase
        ? `<div class="profile-current">
            <div class="label">Case</div>
            <div class="value"><strong>${escape(p.activeCase.id)}</strong> — ${escape(
              p.activeCase.type,
            )} · $${p.activeCase.amount.toLocaleString()} · ${escape(
            p.activeCase.status,
          )}</div>
          </div>`
        : "";

    const casesHeading = p.cases.length
      ? `<h3>Recent cases</h3><ul class="profile-cases">${casesList}</ul>`
      : "";

    const closeBtn = `<button class="close" aria-label="Close profile">×</button>`;

    let html: string;
    if (p.kind === "staff" && p.agent) {
      const subAgents = p.agent.subAgents
        .map(
          (a) =>
            `<li><strong>${escape(a.name)}</strong><span>${escape(a.description)}</span></li>`,
        )
        .join("");
      const firstName = p.name;
      const agentLink = p.agentUrl
        ? `<a class="profile-agent-link" href="${escape(p.agentUrl)}" target="_blank" rel="noopener noreferrer">
            Open ${escape(p.agent.name)} in the backend <span aria-hidden="true">↗</span>
          </a>`
        : "";
      html = `
        ${closeBtn}
        <div class="profile-columns">
          <section class="profile-human" style="--accent:${headerColor}">
            <div class="profile-badge">The human</div>
            <div class="profile-portrait">${renderCharacterFigureSvg(p.palette, headerColor)}</div>
            <div class="profile-name">${escape(p.name)}</div>
            <div class="profile-role">${escape(titleLine)}</div>
            ${currentBlock}
            <p class="profile-situation">${escape(p.situation)}</p>
            <p class="profile-personality">${escape(p.personality)}</p>
            ${p.typicalLine ? `<blockquote>“${escape(p.typicalLine)}”</blockquote>` : ""}
            ${responsibilities ? `<h3>Responsibilities</h3><ul>${responsibilities}</ul>` : ""}
            ${casesHeading}
          </section>
          <div class="profile-link-rail" aria-hidden="true"><span>works with</span></div>
          <section class="profile-agent" style="--accent:${headerColor}">
            <div class="profile-badge ai">The AI agent under the hood</div>
            <div class="profile-portrait agent">
              ${renderCharacterFigureSvg(p.palette, headerColor)}
              <span class="ai-tag">AI</span>
            </div>
            <div class="profile-name">${escape(p.agent.name)}</div>
            <div class="profile-role">Supports ${escape(firstName)}</div>
            <p class="profile-situation">${escape(p.agent.tagline)}</p>
            <h3>Sub-agents at work</h3>
            <ul class="profile-subagents">${subAgents}</ul>
            <p class="profile-oversight">The agent drafts, checks and recommends. ${escape(firstName)} makes the decision.</p>
            ${agentLink}
          </section>
        </div>
      `;
    } else {
      html = `
        ${closeBtn}
        <div class="profile-columns single">
          <section class="profile-human" style="--accent:${headerColor}">
            <div class="profile-badge">${p.kind === "customer" ? "The client" : "The human"}</div>
            <div class="profile-portrait">${renderCharacterFigureSvg(p.palette, headerColor)}</div>
            <div class="profile-name">${escape(p.name)}</div>
            <div class="profile-role">${escape(titleLine)}</div>
            ${currentBlock}
            ${handlerBlock}
            ${caseBlock}
            ${p.situation ? `<p class="profile-situation">${escape(p.situation)}</p>` : ""}
            <p class="profile-personality">${escape(p.personality)}</p>
            ${p.typicalLine ? `<blockquote>“${escape(p.typicalLine)}”</blockquote>` : ""}
            ${responsibilities ? `<h3>${p.kind === "customer" ? "What they need" : "Responsibilities"}</h3><ul>${responsibilities}</ul>` : ""}
            ${casesHeading}
          </section>
        </div>
      `;
    }

    // Skip identical re-renders so links and scroll position stay put.
    if (html === this.lastHtml) return;
    this.lastHtml = html;
    const scroll = this.el.scrollTop;
    this.el.innerHTML = html;
    this.el.scrollTop = scroll;

    const closeEl = this.el.querySelector(".close") as HTMLButtonElement | null;
    closeEl?.addEventListener("click", () => this.close(), { once: true });
  }
}
