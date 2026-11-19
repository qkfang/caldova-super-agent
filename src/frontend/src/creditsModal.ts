/**
 * Credits modal — pays tribute to the people and tools that helped shape
 * Wealth Team in a Day. Opened from the "Credits" link in the footer.
 */
export class CreditsModal {
  private readonly overlay: HTMLDivElement;
  private opened = false;

  constructor() {
    const overlay = document.createElement("div");
    overlay.id = "credits-overlay";
    overlay.className = "modal-overlay hidden";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "credits-title");
    overlay.innerHTML = `
      <div class="modal-card credits-card" role="document">
        <header>
          <h2 id="credits-title">Credits</h2>
          <button class="close" aria-label="Close">×</button>
        </header>
        <div class="credits-body">
          <p class="credits-lead">
            <strong>Wealth Team in a Day</strong> — a Caldova Wealth demo —
            was brought to life with the help of a few standout collaborators.
          </p>

          <section class="credit-entry">
            <h3>GitHub Copilot Agent</h3>
            <p class="credit-role">Pair-programmer · Tireless collaborator</p>
            <p>
              For helping design, scaffold, and refine the frontend, agents,
              scenarios, and supporting infrastructure — turning ideas into
              working code at the speed of conversation.
            </p>
          </section>

          <section class="credit-entry">
            <h3>Hinesh</h3>
            <p class="credit-role">Creative spark · Voxel frontend concept</p>
            <p>
              For the brilliant idea of a voxel-styled, isometric operations
              office and neighbourhood — turning an enterprise operations
              workflow into something you can actually <em>see</em>. The
              entire visual metaphor of this demo started with that vision.
            </p>
          </section>

          <p class="credits-footer-note">
            Built with Babylon.js, TypeScript, Vite, .NET, and Microsoft
            Foundry. Thank you to everyone who contributed ideas, feedback,
            and encouragement along the way.
          </p>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    this.overlay = overlay;

    const close = (): void => this.close();
    overlay
      .querySelector(".close")
      ?.addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    document.addEventListener("keydown", (e) => {
      if (this.opened && e.key === "Escape") close();
    });
  }

  open(): void {
    this.overlay.classList.remove("hidden");
    this.opened = true;
  }

  close(): void {
    this.overlay.classList.add("hidden");
    this.opened = false;
  }
}
