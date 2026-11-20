/**
 * The v2 storybook HUD: the cover, the page card with each chapter's text
 * and navigation, the lift panel, the arrows that slide the view left or
 * right, the inspector card, the finale's request trace panel and the hover
 * tooltip. DOM only — main.ts drives the 3D.
 */
import { CUSTOMER_PERSONAS, type ScenarioId } from "../personaData";
import type { InspectorAction, InspectorView } from "./inspector";
import { LEVELS } from "./lakehouseData";
import type { TraceStep } from "./requestTrace";
import { PAGES, pageIndex, type PageId, type StoryPage } from "./storyData";

export interface StorybookHooks {
  page(page: StoryPage, index: number): void;
  action(action: InspectorAction): void;
  closeInspector(): void;
  /** An arrow is pressed (-1 left, 1 right) or let go (0). */
  pan(dir: -1 | 0 | 1): void;
  scenario(id: ScenarioId): void;
  trace(cmd: "toggle" | "skip" | "speed" | "replay"): void;
}

export interface TraceState {
  scenario: ScenarioId;
  step: TraceStep | null;
  paused: boolean;
  speed: number;
  done: boolean;
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ESCAPES[c]);

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} is missing from index.html`);
  return el as T;
}

/** Short name for navigation buttons and the lift. */
function shortTitle(p: StoryPage): string {
  if (p.id === "cover") return "The Lakehouse";
  if (p.id === "finale") return "Top to bottom";
  return LEVELS.find((l) => l.id === p.id)?.name ?? p.title;
}

export class Storybook {
  private index = 0;
  private collapsed = false;
  private actions: InspectorAction[] = [];
  private links: InspectorAction[] = [];
  private trace: TraceState | null = null;
  private readonly cover = byId<HTMLElement>("v2-cover");
  private readonly card = byId<HTMLElement>("v2-page");
  private readonly lift = byId<HTMLElement>("v2-lift");
  private readonly pan = byId<HTMLElement>("v2-pan");
  private readonly inspector = byId<HTMLElement>("v2-inspector");
  private readonly tooltip = byId<HTMLElement>("v2-tooltip");
  private readonly pill = byId<HTMLButtonElement>("v2-pill");

  constructor(private readonly hooks: StorybookHooks) {
    this.renderCover();
    this.renderLift();
    this.renderPan();
    this.card.addEventListener("click", (e) => this.onCardClick(e));
    this.inspector.addEventListener("click", (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-insp]");
      if (!el) return;
      if (el.dataset.insp === "close") this.hooks.closeInspector();
      else if (el.dataset.insp === "act" || el.dataset.insp === "link") {
        const a = (el.dataset.insp === "act" ? this.actions : this.links)[Number(el.dataset.i)];
        if (a) this.hooks.action(a);
      }
    });
    this.pill.addEventListener("click", () => this.setCollapsed(false));
    window.addEventListener("keydown", (e) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        this.step(1);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        this.step(-1);
      } else if (e.key === "Home") {
        this.goTo(0);
      } else if (e.key === "End") {
        this.goTo(PAGES.length - 1);
      } else if (e.key === "Escape") {
        this.hooks.closeInspector();
      }
    });
  }

  get page(): StoryPage {
    return PAGES[this.index];
  }

  goTo(target: number | PageId): void {
    const i = typeof target === "number" ? target : pageIndex(target);
    if (i < 0 || i >= PAGES.length) return;
    const from = this.index;
    this.index = i;
    this.renderPage();
    this.updateLift(from);
    this.hooks.page(PAGES[i], i);
  }

  step(delta: number): void {
    const i = Math.max(0, Math.min(PAGES.length - 1, this.index + delta));
    if (i !== this.index) this.goTo(i);
  }

  setCollapsed(collapsed: boolean): void {
    this.collapsed = collapsed;
    this.renderPage();
  }

  showInspector(view: InspectorView): void {
    this.actions = view.actions;
    this.links = view.links;
    this.inspector.style.setProperty("--accent", view.accent);
    const buttons = view.actions
      .map((a, i) => {
        const cls = `btn ${a.primary ? "primary" : "ghost"}`;
        return a.href
          ? `<a class="${cls}" href="${esc(a.href)}" target="_blank" rel="noopener">${esc(a.label)}</a>`
          : `<button type="button" class="${cls}" data-insp="act" data-i="${i}">${esc(a.label)}</button>`;
      })
      .join("");
    this.inspector.innerHTML = `
      <button type="button" class="insp-close" data-insp="close" aria-label="Close">×</button>
      <div class="insp-body">${view.html}</div>
      <div class="insp-actions">${buttons}</div>`;
    this.inspector.classList.remove("hidden");
    this.inspector.scrollTop = 0;
    document.body.classList.add("inspecting");
  }

  hideInspector(): void {
    this.inspector.classList.add("hidden");
    document.body.classList.remove("inspecting");
  }

  /** Refresh the open card's live "Now" line without re-rendering it. */
  setInspectorNow(text: string | null): void {
    if (!text || this.inspector.classList.contains("hidden")) return;
    const el = this.inspector.querySelector<HTMLElement>("[data-now]");
    if (el && el.textContent !== text) el.textContent = text;
  }

  showTooltip(text: string, x: number, y: number): void {
    this.tooltip.textContent = text;
    this.tooltip.style.transform = `translate(${Math.round(x + 16)}px, ${Math.round(y + 18)}px)`;
    this.tooltip.classList.remove("hidden");
  }

  hideTooltip(): void {
    this.tooltip.classList.add("hidden");
  }

  setTrace(state: TraceState | null): void {
    this.trace = state;
    this.renderTrace();
  }

  /* ---------------- rendering ---------------- */

  private renderCover(): void {
    const p = PAGES[0];
    const levels = LEVELS.map(
      (l) =>
        `<li style="--c:${l.accent}"><b>${esc(l.floor)}</b><span>${esc(l.name)}</span><em>${esc(l.caption)}</em></li>`,
    ).join("");
    this.cover.innerHTML = `
      <div class="cover-card">
        <div class="cover-kicker">${esc(p.kicker)}</div>
        <h1>The Lakehouse</h1>
        <p class="cover-title">${esc(p.title)}</p>
        ${p.body.map((b) => `<p class="cover-lede">${esc(b)}</p>`).join("")}
        <ol class="cover-levels">${levels}</ol>
        <div class="cover-actions">
          <button type="button" class="btn primary" data-cover="begin">Begin the story ›</button>
          <button type="button" class="btn ghost" data-cover="explore">Explore freely</button>
        </div>
        <p class="cover-hint">${esc(p.hint)}</p>
      </div>`;
    this.cover.addEventListener("click", (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-cover]");
      if (el?.dataset.cover === "begin") this.goTo(1);
      else if (el?.dataset.cover === "explore") this.setCollapsed(true);
    });
  }

  private renderLift(): void {
    const buttons = PAGES.map((p, i) => {
      const label = shortTitle(p);
      return `<button type="button" class="lift-btn" data-page="${i}" style="--c:${p.accent}" title="${esc(label)}"><b>${esc(p.floor)}</b><span>${esc(label)}</span></button>`;
    }).join("");
    this.lift.innerHTML = `
      <div class="lift-display" aria-hidden="true"><span class="lift-arrow"></span><span class="lift-floor">${esc(PAGES[0].floor)}</span></div>
      ${buttons}`;
    this.lift.addEventListener("click", (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-page]");
      if (el) this.goTo(Number(el.dataset.page));
    });
    this.updateLift(0);
  }

  /** Two arrows that slide the view left or right: a press moves a step, and holding keeps it moving. */
  private renderPan(): void {
    const arrow = (dir: -1 | 1, label: string, path: string): string =>
      `<button type="button" class="pan-btn" data-pan="${dir}" title="${label}" aria-label="${label}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg></button>`;
    this.pan.innerHTML = arrow(-1, "Move the view left", "M14.5 5 7.5 12l7 7") + arrow(1, "Move the view right", "M9.5 5l7 7-7 7");
    const button = (e: Event): HTMLElement | null => (e.target as HTMLElement).closest<HTMLElement>("[data-pan]");
    this.pan.addEventListener("pointerdown", (e) => {
      const b = button(e);
      if (!b || e.button !== 0) return;
      e.preventDefault();
      // Keep hold of the pointer, so letting go anywhere stops the glide.
      b.setPointerCapture(e.pointerId);
      this.hooks.pan(Number(b.dataset.pan) as -1 | 1);
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
      this.pan.addEventListener(type, () => this.hooks.pan(0));
    }
    // Enter or Space on an arrow moves one step (a mouse press is handled on pointerdown).
    this.pan.addEventListener("click", (e) => {
      const b = button(e);
      if (!b || e.detail !== 0) return;
      this.hooks.pan(Number(b.dataset.pan) as -1 | 1);
      this.hooks.pan(0);
    });
  }

  private updateLift(from: number): void {
    const p = PAGES[this.index];
    this.lift.style.setProperty("--accent", p.accent);
    this.pan.style.setProperty("--accent", p.accent);
    this.lift.querySelectorAll<HTMLElement>(".lift-btn").forEach((b) => {
      const on = Number(b.dataset.page) === this.index;
      b.classList.toggle("on", on);
      if (on) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
    const floor = this.lift.querySelector<HTMLElement>(".lift-floor");
    if (floor) floor.textContent = p.floor;
    const arrow = this.lift.querySelector<HTMLElement>(".lift-arrow");
    if (arrow) {
      arrow.textContent = this.index > from ? "▼" : this.index < from ? "▲" : "";
      arrow.classList.remove("moving");
      void arrow.offsetWidth;
      arrow.classList.add("moving");
    }
  }

  private renderPage(): void {
    const p = PAGES[this.index];
    const onCover = this.index === 0;
    document.body.dataset.page = p.id;
    this.cover.classList.toggle("hidden", !onCover || this.collapsed);
    this.card.classList.toggle("hidden", onCover || this.collapsed);
    this.pill.classList.toggle("hidden", !this.collapsed);
    if (onCover) return;
    const prev = PAGES[this.index - 1];
    const next = PAGES[this.index + 1];
    const dots = PAGES.map(
      (q, k) =>
        `<li><button type="button" data-pc="dot" data-i="${k}" class="${k === this.index ? "on" : ""}" aria-label="${esc(shortTitle(q))}"></button></li>`,
    ).join("");
    this.card.style.setProperty("--accent", p.accent);
    this.card.innerHTML = `
      <div class="pc-head">
        <span class="pc-floor">${esc(p.floor)}</span>
        <div class="pc-titles">
          <div class="pc-kicker">${esc(p.chapter)} · ${esc(p.kicker)}</div>
          <h2>${esc(p.title)}</h2>
        </div>
        <button type="button" class="pc-collapse" data-pc="collapse" aria-label="Hide the storybook" title="Hide the storybook">–</button>
      </div>
      <div class="pc-body">${p.body.map((b) => `<p>${esc(b)}</p>`).join("")}</div>
      ${p.id === "finale" ? `<div class="pc-trace"></div>` : ""}
      <p class="pc-hint"><span aria-hidden="true">👆</span>${esc(p.hint)}</p>
      <nav class="pc-nav" aria-label="Storybook pages">
        <button type="button" class="btn ghost" data-pc="prev">‹ ${esc(prev ? shortTitle(prev) : "")}</button>
        <ol class="pc-dots">${dots}</ol>
        <button type="button" class="btn primary" data-pc="next">${next ? `${esc(shortTitle(next))} ›` : "Back to the cover ↺"}</button>
      </nav>`;
    this.renderTrace();
  }

  private renderTrace(): void {
    const box = this.card.querySelector<HTMLElement>(".pc-trace");
    if (!box) return;
    const st = this.trace;
    const chips = CUSTOMER_PERSONAS.map(
      (c) =>
        `<button type="button" class="chip ${st?.scenario === c.id ? "on" : ""}" data-scenario="${c.id}" style="--c:${c.color}"><b>${esc(c.name.split(" ")[0])}</b><span>${esc(c.request_type)}</span></button>`,
    ).join("");
    const step = st?.step;
    const stepHtml = step
      ? `<div class="trace-step" style="--c:${step.color}">
          <div class="trace-progress">Step ${step.index + 1} of ${step.total}</div>
          <div class="trace-who">${esc(step.who)}</div>
          ${step.side ? `<span class="trace-side" style="--s:${step.side.color}">${esc(step.side.label)}</span>` : ""}
          <div class="trace-route">${step.route.map(esc).join("<i>→</i>")}</div>
          <p class="trace-text">${esc(step.text)}</p>
        </div>`
      : `<div class="trace-step idle"><p class="trace-text">The request is on its way to the house…</p></div>`;
    const play = st?.done ? "↺ Replay" : st?.paused ? "▶ Play" : "⏸ Pause";
    box.innerHTML = `
      <div class="trace-members" role="group" aria-label="Choose a member">${chips}</div>
      ${stepHtml}
      <div class="trace-controls">
        <button type="button" class="btn ghost" data-trace="${st?.done ? "replay" : "toggle"}">${play}</button>
        <button type="button" class="btn ghost" data-trace="skip" ${st?.done ? "disabled" : ""}>⏭ Next step</button>
        <button type="button" class="btn ghost" data-trace="speed" title="Playback speed">x${st?.speed ?? 1}</button>
      </div>`;
  }

  private onCardClick(e: MouseEvent): void {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-pc],[data-trace],[data-scenario]");
    if (!el) return;
    if (el.dataset.scenario) {
      this.hooks.scenario(el.dataset.scenario as ScenarioId);
      return;
    }
    if (el.dataset.trace) {
      this.hooks.trace(el.dataset.trace as "toggle" | "skip" | "speed" | "replay");
      return;
    }
    switch (el.dataset.pc) {
      case "collapse":
        this.setCollapsed(true);
        break;
      case "prev":
        this.step(-1);
        break;
      case "next":
        if (this.index === PAGES.length - 1) this.goTo(0);
        else this.step(1);
        break;
      case "dot":
        this.goTo(Number(el.dataset.i));
        break;
    }
  }
}
