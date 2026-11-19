/**
 * End-of-scenario UI: a client result animation (completed / partially
 * approved / declined / blocked) shown above the comms area, plus a
 * summary modal that lists every staff member, the AI sub-agents involved,
 * and the client outcome.
 */

import type { CustomerPersona } from "./personaData";
import type { ScenarioResultJson } from "./scenarios";
import type { StageInfo } from "./stepGate";

export type ScenarioOutcome = "approved" | "rejected" | "partial";

export interface ScenarioSummary {
  scenarioNumber: number;
  persona: CustomerPersona;
  caseId: string;
  /** Amount requested on the case. */
  amount: number;
  /** Gross amount paid / invested / commenced. */
  paidAmount: number;
  outcome: ScenarioOutcome;
  /** Scenario-specific wording (scripted runs). */
  result?: ScenarioResultJson;
  /** Steps actually executed during the scenario, in order. */
  steps: StageInfo[];
}

const money = (amount: number): string => `$${amount.toLocaleString()}`;

/** CSS modifier for an outcome — financial-crime blocks get their own style. */
function outcomeClass(outcome: ScenarioOutcome, result?: ScenarioResultJson): string {
  return result?.status === "blocked" ? "blocked" : outcome;
}

/** Brief overlay above the canvas showing the client outcome. */
export class CustomerResultBanner {
  private readonly el: HTMLDivElement;

  constructor() {
    const el = document.createElement("div");
    el.id = "customer-result";
    el.className = "customer-result hidden";
    el.innerHTML = `
      <div class="cr-card">
        <div class="cr-avatar"></div>
        <div class="cr-body">
          <div class="cr-name"></div>
          <div class="cr-headline"></div>
          <div class="cr-amount"></div>
        </div>
        <div class="cr-icon" aria-hidden="true"></div>
      </div>
    `;
    document.body.appendChild(el);
    this.el = el;
  }

  show(
    persona: CustomerPersona,
    outcome: ScenarioOutcome,
    paidAmount: number,
    result?: ScenarioResultJson,
  ): void {
    this.el.classList.remove("approved", "rejected", "partial", "blocked");
    this.el.classList.add(outcomeClass(outcome, result));
    (this.el.querySelector(".cr-avatar") as HTMLElement).style.background =
      persona.color;
    (this.el.querySelector(".cr-name") as HTMLElement).textContent =
      persona.name;
    const headline =
      result?.headline ??
      (outcome === "approved"
        ? "Request completed — payment on its way"
        : outcome === "partial"
          ? "Request partially approved"
          : "Request declined — next steps explained");
    (this.el.querySelector(".cr-headline") as HTMLElement).textContent = headline;
    const amountEl = this.el.querySelector(".cr-amount") as HTMLElement;
    const figure =
      result?.figure ?? (outcome === "rejected" ? "" : money(paidAmount));
    amountEl.textContent = figure;
    amountEl.style.display = figure ? "block" : "none";
    (this.el.querySelector(".cr-icon") as HTMLElement).textContent =
      result?.icon ?? (outcome === "rejected" ? "✕" : "✅");

    this.el.classList.remove("hidden");
    // Force reflow so the CSS animation re-runs each time.
    void this.el.offsetWidth;
    this.el.classList.add("playing");
  }

  hide(): void {
    this.el.classList.add("hidden");
    this.el.classList.remove("playing");
  }
}

/** Final summary modal — staff, AI agents, outcome. */
export class ScenarioSummaryModal {
  private readonly overlay: HTMLDivElement;
  private onClose: (() => void) | null = null;

  constructor() {
    const overlay = document.createElement("div");
    overlay.id = "scenario-summary-overlay";
    overlay.className = "modal-overlay hidden";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML = `
      <div class="modal-card summary-card" role="document">
        <header>
          <h2>Scenario summary</h2>
          <button class="close" aria-label="Close">×</button>
        </header>
        <section class="summary-customer">
          <div class="summary-customer-dot"></div>
          <div class="summary-customer-text">
            <div class="summary-customer-name"></div>
            <div class="summary-customer-case"></div>
            <div class="summary-customer-outcome"></div>
          </div>
        </section>
        <section class="summary-section">
          <h3>Steps & staff</h3>
          <ol class="summary-steps"></ol>
        </section>
        <footer>
          <button type="button" class="summary-done">Done</button>
        </footer>
      </div>
    `;
    document.body.appendChild(overlay);
    this.overlay = overlay;

    const dismiss = (): void => {
      this.close();
      const cb = this.onClose;
      this.onClose = null;
      cb?.();
    };
    overlay.querySelector(".close")!.addEventListener("click", dismiss);
    overlay
      .querySelector(".summary-done")!
      .addEventListener("click", dismiss);
    overlay.addEventListener("click", (ev) => {
      if (ev.target === overlay) dismiss();
    });
  }

  open(summary: ScenarioSummary, onClose: () => void): void {
    this.onClose = onClose;
    const o = this.overlay;
    (o.querySelector(".summary-customer-dot") as HTMLElement).style.background =
      summary.persona.color;
    (o.querySelector(".summary-customer-name") as HTMLElement).textContent =
      `Scenario #${summary.scenarioNumber} — ${summary.persona.name}`;
    (o.querySelector(".summary-customer-case") as HTMLElement).textContent =
      `${summary.persona.request_type} • Case ${summary.caseId} • ${money(summary.amount)}`;

    const outcomeLine =
      summary.result?.summary ??
      (summary.outcome === "approved"
        ? `Outcome: COMPLETED — ${money(summary.paidAmount)} paid`
        : summary.outcome === "partial"
          ? `Outcome: PARTIALLY APPROVED — ${money(summary.paidAmount)} of ${money(summary.amount)} paid`
          : "Outcome: DECLINED");
    const oc = o.querySelector(".summary-customer-outcome") as HTMLElement;
    oc.textContent = outcomeLine;
    oc.classList.remove("approved", "rejected", "partial", "blocked");
    oc.classList.add(outcomeClass(summary.outcome, summary.result));

    const stepsList = o.querySelector(".summary-steps") as HTMLOListElement;
    stepsList.innerHTML = "";
    for (const step of summary.steps) {
      const li = document.createElement("li");
      li.className = "summary-step";
      li.innerHTML = `
        <div class="summary-step-head">
          <span class="summary-step-dot"></span>
          <strong class="summary-step-title"></strong>
          <span class="summary-step-staff"></span>
        </div>
        <ul class="summary-step-agents"></ul>
      `;
      (li.querySelector(".summary-step-dot") as HTMLElement).style.background =
        step.staffColor;
      (li.querySelector(".summary-step-title") as HTMLElement).textContent =
        step.title;
      (li.querySelector(".summary-step-staff") as HTMLElement).textContent =
        ` — ${step.staffName} (${step.staffRole})`;
      const aul = li.querySelector(".summary-step-agents") as HTMLUListElement;
      for (const a of step.agents) {
        const ali = document.createElement("li");
        ali.innerHTML = `<span class="bulb">💡</span> <strong></strong> <span class="muted"></span>`;
        (ali.querySelector("strong") as HTMLElement).textContent = a.name;
        (ali.querySelector(".muted") as HTMLElement).textContent =
          ` — ${a.description}`;
        aul.appendChild(ali);
      }
      stepsList.appendChild(li);
    }

    o.classList.remove("hidden");
  }

  close(): void {
    this.overlay.classList.add("hidden");
  }
}
