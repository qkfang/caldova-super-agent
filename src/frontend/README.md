# Wealth Team in a Day — Frontend (`src/frontend`)

The frontend for **Caldova Wealth**, a fictional Melbourne adviser-led super and wealth
platform. It is a voxel storybook, **The Lakehouse**, that you read from the top of a
futuristic lakehouse to the bottom. Caldova is a wealth business for the agentic era with two
sides, Wealth Management and Superannuation:

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
doing. Out front, visitors arrive by water taxi and sign at the front desk on the dock, where
Amelia, Caldova's financial adviser, links them with the agents that get them started. Up on
the roof Caldova throws a party for its customers under a big CALDOVA WEALTH sign. Each
chapter lifts the levels above it out of the way. Clicking anything follows its thread up or
down the house. The finale starts at the dock with the member signing, then pulls the house apart
and traces one of the five scenarios from top to bottom. The story, the cast, the controls and
every page are in [docs/storybook.md](../../docs/storybook.md).

## Tech stack

- [Babylon.js](https://www.babylonjs.com/) (`@babylonjs/core`) for 3D rendering
- [Vite](https://vitejs.dev/) + TypeScript for the dev server and build
- A plain-CSS overlay for the storybook card, lift panel, view arrows, inspector and trace panel

The house, characters, boats and props are built at runtime from `MeshBuilder` boxes, so there
are no model files to load. Characters walk with simple kinematic steering; no physics engine is
shipped to the browser.

## Running locally

```bash
cd src/frontend
npm install
npm run dev
```

Then open <http://localhost:5173>. Each page has a deep link:
`/?page=idea|people|agents|engine|finale`.

To produce a production build (type-check + bundle):

```bash
npm run build
npm run preview
```

The **Open the agent page ↗** links point at the companion Blazor site in `src/backend`
(`/agents/{route id}`) and open in a new tab. They sit at the bottom of the people cards and under
the name on the agent, assistant and voice-agent cards. Their base URL comes from `VITE_APP_BASE_URL`, set in
a local `.env` or `.env.local` (both git-ignored), or by `.github/workflows/21_deploy_frontend.yml`
for deployments. Without it, the cards leave those links out.

In production, `pm2 serve --spa` answers every path with `index.html`, so old `/v2` links still
open the storybook, and the page tidies the address back to `/`.

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

Each person's agent works in a bay on Level 1, directly under their desk, with two specialised
assistants named in `src/agentStages.ts`. Some agents are dedicated to one side and some are
shared by both; [docs/storybook.md](../../docs/storybook.md) has the full split.

## Scenarios

Pick a member's chip on the finale page to trace one of the five client scenarios (dates are
November 2026):

| # | Client | Request | Case | Who works the case | Outcome |
|---|---|---|---|---|---|
| 1 | Priya Natarajan | New account & consolidation — $138,200 from two old funds | `REQ-20261103-OPS001` | Olivia → Felix → Ben → Rory → Ivy → Penny → Cara | Completed — account opened; BDBN needs re-signing, Southern Cross rollover held for the insurance-loss check |
| 2 | Grace Williams | Rollover out to SMSF — full $612,400 balance | `REQ-20261106-OPS002` | Olivia → Ben → Felix → Rory → Theo → Penny → Cara | Blocked — identity takeover stopped, no funds leave the account |
| 3 | George Papadopoulos | Pension commencement — $1,250,000, $78,000 a year | `REQ-20261109-OPS003` | Olivia → Ben → Ivy → Rory → Penny → Cara | Completed — pension starts 16 Nov 2026 |
| 4 | Tom Bradley | Financial hardship release — $15,000 requested | `REQ-20261111-OPS004` | Olivia → Ben → Theo → Ivy → Penny → Cara | Partially approved — $10,000 gross, $7,932 net |
| 5 | Robert Chen | Death benefit under a binding nomination — $486,200 | `REQ-20261113-OPS005` | Olivia → Theo → Felix → Ben → Ivy → Penny → Cara | Completed — paid 50/50 to Robert and Lily |

The member arrives by water taxi and signs at the front desk. The request then sets off: each
step starts with a person on Level 2, dips down to their agent on Level 1 and the engine-room
component that agent leans on, then comes back up for the human decision. The result rises to
the brain on Level 3, where Maya's idea is measured.

### Editing a scenario

Each scenario is defined in `src/scenarios/<id>.json` and mirrors `docs/scenario-N-*.md`. Case
numbers match the cases seeded by the backend `CaseStore`.

- `beats` — the narration for every step, in order. The `lodge-at-reception` beat opens the
  trace; every staff beat (`at` is the person's role) becomes a stop, and one person's
  consecutive beats merge into one stop.
- `result` — `icon`, `headline` and `summary` make the last stop; `status` and `figure` record
  the outcome.
- `caseId`, `amount`, `paidAmount` and `outcome` — the case facts.

Personas (names, roles, situations and palettes) live in `src/personaData.ts`. Content only the
storybook needs (the sides, the agents' roles and props, the front desk, Amelia and the
visitors, Microsoft IQ and the Azure components) lives in `src/v2/lakehouseData.ts`.

## File map

```
src/frontend
├── index.html                  # Page shell: canvas, storybook HUD, lift panel and view arrows
├── package.json                # Vite + Babylon dependencies
├── tsconfig.json
├── vite.config.ts              # Single page; dev server on port 5173
├── public/                     # favicon.svg / favicon.png (Caldova "C")
└── src
    ├── personaData.ts          # Single source of truth for staff and client personas
    ├── agentStages.ts          # Each agent's specialised assistants, and the backend base URL
    ├── characterPalettes.ts    # Per-persona colour palettes and looks
    ├── characterFigure.ts      # SVG figure for the people cards
    ├── voxelCharacter.ts       # Box-built voxel humanoid + walk animation
    ├── cameraDirector.ts       # Eased camera moves for page turns and selections
    ├── scenarios/              # Scenario JSON (onboarding, protection, retirement, hardship, bereavement)
    └── v2/                     # The Lakehouse storybook (docs/storybook.md)
        ├── main.ts             # Bootstrap, camera, picking, selection threads, page wiring
        ├── storyData.ts        # Storybook pages: text, camera shots, stack modes
        ├── lakehouseData.ts    # The two sides, the business owner, the idea, agent sides and roles, handoffs, the front desk, Amelia and the visitors, Microsoft IQ and Azure components
        ├── storybook.ts        # Cover, page card, lift panel, view arrows, inspector, trace panel, keyboard
        ├── inspector.ts        # Card content for the owner, brain, people, agents, roles, components, the front desk, Amelia and visitors
        ├── levelStack.ts       # House / focus / exploded arrangements of the levels
        ├── threads.ts          # Lines between levels: the finale's tree, the selection's beams, and Amelia's live links
        ├── callouts.ts         # Labels on the far ends of the selection's beams
        ├── requestTrace.ts     # Finale: a scenario's request, from the front desk through the house
        ├── wander.ts           # Walking: errands for people, Maya and the agents' roles, with speech bubbles
        ├── dock.ts             # The dock: front desk, greeter, Amelia the adviser, water taxi and visitors who sign there
        ├── party.ts            # The roof: the customers' party, the CALDOVA WEALTH sign, DJ, toasts and fireworks
        ├── exterior.ts         # Floating island, lake, deck, jetty, trees, boats, clouds, drone
        ├── shell.ts            # Shared floor slab, walls, steel rails, lift core and level tag
        ├── kit.ts              # Voxel kit: materials, textures, blocks, labels, batching
        ├── layout.ts           # World layout: floor heights, footprints, desk/pod stations, wings and zones
        ├── types.ts
        ├── v2.css              # Storybook HUD styling
        └── levels/             # ideaLevel (+ roof), peopleLevel, agentsLevel, engineLevel
```
