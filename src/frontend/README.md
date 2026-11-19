# Wealth Team in a Day — Web Demo (`src/frontend`)

A browser demo for **Caldova Wealth**, a fictional Melbourne adviser-led super & wealth
platform. It visualises **Caldova Client Operations** — an operations office staffed by
people who are each supported by a specialised AI agent. Clients (voxel characters) start
at a Melbourne life event in the neighbourhood, their request travels to the office, and the
team — Olivia, Ben, Ivy, Felix, Rory, Penny, Cara and Theo — verifies, assesses, actions and
confirms it. The AI agents draft, check, summarise and recommend; people make the decisions.

The 3D scene is built with **Babylon.js** in an isometric voxel style: a blocky open-plan
office floor with department pods split into a Superannuation wing and a Wealth Management
wing, set in a park, plus a voxel Melbourne neighbourhood — Docklands, the
airport, Oakleigh, Lygon St and Box Hill — complete with a green-and-gold tram on Collins St.

## Tech stack

- [Babylon.js](https://www.babylonjs.com/) (`@babylonjs/core`) for 3D rendering
- [Vite](https://vitejs.dev/) + TypeScript for the dev server / build pipeline
- Pure-CSS HUD overlay for metrics, the AI Agents panel, the activity log and modals

Characters, vehicles and buildings are constructed at runtime from `MeshBuilder` primitives
to keep the demo dependency-light and instantly runnable. Agents move with simple kinematic
XZ steering — no physics engine is shipped to the browser.

## Running locally

```bash
cd src/frontend
npm install
npm run dev
```

Then open the URL Vite prints (defaults to <http://localhost:5173>).

To produce a production build (type-check + bundle):

```bash
npm run build
npm run preview
```

The "See how this team uses these agents" links point at the companion Blazor site in
`src/backend` (`/agents/{route id}`). Its base URL comes from `VITE_APP_BASE_URL` in `.env`
(override with `.env.local`, or via `.github/workflows/21_deploy_frontend.yml`).

## v2 — The Lakehouse storybook (`/v2`)

Open <http://localhost:5173/v2/> for v2. It shows the same team as a storybook you read from the
top of a futuristic voxel lakehouse to the bottom. Caldova is a wealth business for the agentic
era with two sides, Wealth Management and Superannuation:

- **Level 3 · The Idea** is business owner Maya Ashworth's office, with her idea floating
  above the table as a voxel brain (one half for each side).
- **Level 2 · The People** holds two small teams: Wealth Management on the left and
  Superannuation on the right, with Theo leading both from the middle.
- **Level 1 · The Agents** is one group of Microsoft Foundry agents, with a bay under every desk,
  in three zones: dedicated to Wealth, shared by both sides, and dedicated to Super. Each agent
  and each of its two specialised assistants is its own robot (25 roles, with Cara's voice agent).
- **The Engine Room** sits under the waterline. Microsoft IQ (Work IQ, Fabric IQ, Foundry IQ and
  Web IQ) stands on a raised deck behind Microsoft Foundry, with the Azure services around it.

People and agents walk about their floors on errands, with a speech bubble saying what each is
doing. Out front, visitors arrive by water taxi and sign at the front desk on the dock, and up on
the roof Caldova throws a party for its customers under a big CALDOVA WEALTH sign. Each
chapter lifts the levels above it out of the way. Clicking anything follows its thread up or
down the house. The finale starts at the dock with the member signing, then pulls the house apart
and traces one of the five scenarios from top to bottom. The story, the cast and every page are
in [docs/storybook.md](../../docs/storybook.md).
Pages have deep links (`/v2/?page=idea|people|agents|engine|finale`).

v2 is a second Vite page (`v2/index.html`, listed in `vite.config.ts`). It reuses the v1 cast,
assistants and scenario JSON. In production, `pm2 serve --spa` answers `/v2` with the v1
`index.html`, so a one-line guard at the top of that file forwards it to `/v2/index.html`.

## What you see

- **Neighbourhood** — a voxel Melbourne with five life-event zones, each a map-pin label:
  *Docklands — New Job (Priya)*, *Airport — Overseas Trip (Grace)*,
  *Oakleigh — Retirement (George)*, *Lygon St — Café Closed (Tom)* and
  *Box Hill — Family Home (Robert)*. *Caldova Wealth — Client Operations* sits in the centre.
  Streets are signed Collins St, Flinders Lane, Lygon St, Chapel St, Swan St, Glenferrie Rd
  and Toorak Rd; a tram, delivery vans, cyclists, pedestrians and pets keep it moving.
- **Lobby** — glass front doors, a walnut concierge desk with the Onboarding inbox, the *Super
  Services*, *Wealth Services* and *Adviser Desk* counters, and the *Client Waiting Lounge*.
- **Operations floor** — one pod per department, organised by team. The **Superannuation
  Team** wing sits at the front: **ONBOARDING** (Olivia), **BENEFITS** (Ben), **TRANSFERS**
  (Rory), **PAYMENTS** (Penny). The **Wealth Management Team** wing sits behind it:
  **INVESTMENTS** (Ivy), **COMMS** (Cara), **FINANCIAL CRIME** (Felix), with **HEAD OF CLIENT
  OPS** (Theo) in the corner office leading both teams. Each wing has its own floor finish,
  floor lettering and wall banner, and each pod's monitor shows its own workflow screen. The
  *Caldova Wealth* identity wall, the *Our Process* board (1 Request · 2 Verify · 3 Assess ·
  4 Action · 5 Confirm), the archive cabinets (*Advice (SOA)*, *Member Files*, *Nominations*,
  *Closed Cases*), the *Client Meeting Suites*, the *Investment Committee* room, the *Member
  Lounge*, *Client Café* and *Staff Kitchen* complete the floor.
- **Two layers** — the office is one level by default. **Single-click a person** (or their
  card in the left panel) to focus them: their card is highlighted and the floor turns to
  glass, revealing the **AI agent layer** (`src/agentLayer.ts`) underneath. Each staff member
  has an agent bay directly below their desk with their sub-agents (small robots) at work,
  linked up by a data beam; the selected person's agents are spotlit (a cone of light down to
  the bay, a pulsing ring, name tags, other agents dimmed). Click the same person again or
  press Esc to go back to one level.
- **Park setting** — the office sits in a green park: a stone forecourt with a water
  feature, gravel paths, a pond with a jetty, a gazebo, a picnic area, flower beds and
  trees (`src/parkSurroundings.ts`).
- **HUD**:
  - Top bar shows live counts (**Received · In flight · Completed · Declined**) and the
    **Office | Neighbourhood** scene toggle.
  - Left panel lists each staff member with their role and current activity.
  - Right panel streams the activity log in real time.
  - **Submit a request** opens the scenario picker; x1 / x2 / x5 sets the simulation speed.
  - **Double-click** any character (or a card in the left panel) to open a centered popup. For
    staff it shows the human on the left and
    the AI agent under the hood on the right (its sub-agents and a link to the agent's page in
    the backend); clients show their person and case.

## The team

| Staff | Team | Role | Department | Agent page |
|---|---|---|---|---|
| Olivia | Superannuation | Onboarding & Requests Officer | Onboarding & Requests | `/agents/onboarding` |
| Ben | Superannuation | Benefits & Eligibility Assessor | Benefits & Eligibility | `/agents/benefits-eligibility` |
| Rory | Superannuation | Transfers & Rollovers Coordinator | Transfers & Rollovers | `/agents/transfers-rollovers` |
| Penny | Superannuation | Payments Officer | Payments | `/agents/payments` |
| Ivy | Wealth Management | Investment Analyst | Investment Solutions | `/agents/investment-analyst` |
| Cara | Wealth Management | Client Communications Specialist | Client Communications | `/agents/client-communications` |
| Felix | Wealth Management | Financial Crime Investigator | Financial Crime | `/agents/financial-crime` |
| Theo | Leadership (both teams) | Client Operations Team Leader | Team Leader Office | `/agents/team-leader` |

The AI Agents panel groups the cast by team, and each profile card shows the staff member's
team. Olivia, Ben, Penny and Cara work every case; Ivy, Felix, Rory and Theo join scripted
cases as specialist consultations and otherwise rotate through their own work at their desks.

## Scripted scenarios

Five client scenarios can be launched from **Submit a request** (dates are November 2026):

| # | Client | Life event (zone) | Request | Case | Who works the case | Outcome |
|---|---|---|---|---|---|---|
| 1 | Priya Natarajan | New job (Docklands) | New account & consolidation — $138,200 from two old funds | `REQ-20261103-DEMO01` | Olivia → Felix → Ben → Rory → Ivy → Penny → Cara | Completed — account opened; BDBN needs re-signing, Southern Cross rollover held for the insurance-loss check |
| 2 | Grace Williams | Overseas trip (Airport) | Rollover out to SMSF — full $612,400 balance | `REQ-20261106-DEMO02` | Olivia → Ben → Felix → Rory → Theo → Penny → Cara | Blocked — identity takeover stopped, no funds leave the account |
| 3 | George Papadopoulos | Retirement (Oakleigh) | Pension commencement — $1,250,000, $78,000 a year | `REQ-20261109-DEMO03` | Olivia → Ben → Ivy → Rory → Penny → Cara | Completed — pension starts 16 Nov 2026 |
| 4 | Tom Bradley | Café closed (Lygon St) | Financial hardship release — $15,000 requested | `REQ-20261111-DEMO04` | Olivia → Ben → Theo → Ivy → Penny → Cara | Partially approved — $10,000 gross, $7,932 net |
| 5 | Robert Chen | Family home (Box Hill) | Death benefit under a binding nomination — $486,200 | `REQ-20261113-DEMO05` | Olivia → Theo → Felix → Ben → Ivy → Penny → Cara | Completed — paid 50/50 to Robert and Lily |

Each scenario is defined in `src/scenarios/<id>.json` and mirrors
`docs/scenario-N-*.md`. Case numbers match the cases seeded by the backend `CaseStore`.

## Simulation flow

1. A client starts at their neighbourhood life-event zone while a short life-event animation
   plays (confetti for a new job, a red alert ring for an identity-takeover attempt, a
   retirement banner and confetti, a soft grey cloud over the closed café, a calm warm glow
   at the family home), then heads to Caldova Client Operations.
2. The request is lodged at the **reception** inbox.
3. **Olivia** (Onboarding & Requests) picks it up, runs the NIGO checklist, opens the case
   and routes it to Benefits & Eligibility.
4. Optional **pre-assessment consultations** run next (e.g. Felix's KYC/AML screen, Theo's
   compassionate oversight).
5. **Ben** (Benefits & Eligibility) applies the trust deed, PDS and super law.
6. Optional **post-assessment consultations** follow (Felix, Rory, Ivy and/or Theo).
7. Ben hands the case to **Penny** (Payments), who records the outcome — completed,
   partially approved, declined or blocked — and releases money only after approval.
8. **Cara** (Client Communications) contacts the client (and adviser) in plain English and
   closes the case; a result banner and a scenario summary of every step and AI sub-agent
   follow.

Each step pauses on a **step gate** that names the staff member and the AI sub-agents
delegated to the step (tick *Auto-play* in the picker, or press *Auto-play rest*, to run
straight through). Between scripted runs, unscripted clients keep arriving so the office
always feels busy.

### Editing a scenario

Everything a run shows comes from its JSON file, so one edit changes both the narration and
the simulation:

- `amount` / `paidAmount` — the requested amount and the gross amount actioned at Payments.
- `approveAtBenefits` and `outcome` (`approved`, `rejected` — shown as *blocked* when
  `result.status` is `blocked` — or `partial`).
- `preBenefits` / `postBenefits` — specialist consultations (role, narration, dwell seconds)
  before and after the Benefits & Eligibility assessment.
- `beats` — banner and step-gate narration for each stage, in order.
- `narrations` — activity-log lines for the Benefits, Payments and Comms steps.
- `result` — status, headline, figure and icon for the result banner and summary.
- `reset` — how the office is cleared before the run starts.

Personas (names, roles, situations, request types and palettes) live in `personaData.ts`.

## File map

```
src/frontend
├── index.html                  # Page shell + HUD markup (and the /v2 forwarder for static hosting)
├── v2/index.html               # v2 page shell: the Lakehouse storybook
├── package.json                # Vite + Babylon dependencies
├── tsconfig.json
├── vite.config.ts              # Two pages: / (v1) and /v2/ (v2)
├── public/                     # favicon.svg / favicon.png (Caldova "C")
└── src
    ├── main.ts                 # Engine bootstrap, cameras, lights, render loop, HUD wiring
    ├── styles.css              # HUD styling (panels, metrics, log, modals)
    ├── officeScene.ts          # Voxel operations office geometry and signage
    ├── neighbourhoodScene.ts   # Voxel Melbourne neighbourhood and life-event zones
    ├── neighbourhoodAmbient.ts # Trams, traffic, pedestrians, pets and life-event animations
    ├── voxelCharacter.ts       # Box-built voxel humanoid + walk animation + agent bulbs
    ├── characterPalettes.ts    # Per-persona colour palettes and looks
    ├── characterFigure.ts      # SVG figure used by the HUD and profile cards
    ├── personaData.ts          # Single source of truth for staff and client personas
    ├── caseSimulation.ts       # Staff state machines + Member Case lifecycle
    ├── scenarioPicker.ts       # "Submit a request" scenario selector
    ├── scenarioRunner.ts       # Scripted scenario orchestration (neighbourhood → office)
    ├── scenarioNumbers.ts      # Scenario id → docs/scenario-N number
    ├── scenarioSummary.ts      # Result banner + end-of-scenario summary modal
    ├── stepGate.ts             # Per-step pause modal + AI sub-agents per stage
    ├── activityPanel.ts        # "Currently working" panel during scripted runs
    ├── profileCard.ts          # Character profile pop-up
    ├── hud.ts                  # DOM HUD wired to the SimLogger contract
    ├── cameraDirector.ts       # Smooth camera focus for scripted beats
    ├── collapsiblePanels.ts    # Collapsible HUD side panels
    ├── scenarios/              # Scenario JSON (onboarding, protection, retirement, hardship, bereavement)
    └── v2/                     # The Lakehouse storybook (docs/storybook.md)
        ├── main.ts             # Bootstrap, camera, picking, selection threads, page wiring
        ├── storyData.ts        # Storybook pages: text, camera shots, stack modes
        ├── lakehouseData.ts    # The two sides, the business owner, the idea, agent sides and roles, handoffs, the front desk and its visitors, Microsoft IQ and Azure components
        ├── storybook.ts        # Cover, page card, lift panel, inspector, trace panel, keyboard
        ├── inspector.ts        # Card content for the owner, brain, people, agents, roles, components, the front desk and visitors
        ├── levelStack.ts       # House / focus / exploded arrangements of the levels
        ├── threads.ts          # Glowing threads between levels
        ├── requestTrace.ts     # Finale: a scenario's request, from the front desk through the house
        ├── wander.ts           # Walking: errands for people, Maya and the agents' roles, with speech bubbles
        ├── dock.ts             # The dock: front desk, greeter, water taxi and visitors who sign there
        ├── party.ts            # The roof: the customers' party, the CALDOVA WEALTH sign, DJ, toasts and fireworks
        ├── exterior.ts         # Floating island, lake, deck, jetty, trees, boats, clouds, drone
        ├── shell.ts            # Shared floor slab, walls, steel rails, lift core and level tag
        ├── kit.ts              # Voxel kit: materials, textures, blocks, labels, batching
        ├── layout.ts           # World layout: floor heights, footprints, desk/pod stations, wings and zones
        ├── types.ts
        ├── v2.css              # Storybook HUD styling
        └── levels/             # ideaLevel (+ roof), peopleLevel, agentsLevel, engineLevel
```
