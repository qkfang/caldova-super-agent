# Melbourne Neighbourhood Visual Theme

> Part of **Wealth Team in a Day** — the AI operations office demo for **Caldova Wealth**.

## Overview

The neighbourhood is **where every request begins** in *Wealth Team in a Day*. Before any AI agent or operations officer is involved, something happens in everyday life:

- a new job
- a long-planned trip overseas
- a retirement
- a business closing
- a death in the family

Then a member, a client or their adviser needs **Caldova Wealth** to act.

The neighbourhood theme shows these moments: ordinary Melburnians in familiar places, at the life events that **trigger** requests to Caldova's operations office.

It is a **voxel-style miniature Melbourne**, sitting alongside the office diorama. People and their requests travel by footpath, tram line and laneway towards **Caldova Wealth — Client Operations** at the centre of the neighbourhood.

---

## Narrative Purpose

The neighbourhood exists to answer one question:

> "Where do requests actually come from?"

It anchors the demo visually by showing:

- The **life event** happening in real life
- The **reaction**: excitement, worry, urgency or grief
- The **journey to Client Operations**: the hand-off into the AI-assisted operations workflow

Once a request reaches the office door, the office theme takes over and the specialised AI agents begin their work.

---

## Neighbourhood Atmosphere

The neighbourhood should feel:

- Recognisably Melbourne, but stylised rather than realistic
- Friendly and approachable
- Calm overall, with small pockets of "something just happened"
- Diverse: apartments, suburban homes, a café strip, a waterfront office precinct and an airport gate

It should look like a **miniature voxel Melbourne** with:

- **Trams.** A heritage-style tram (think Melbourne's classic W-class) on a city loop, and modern trams on the main roads, with overhead wires and tram stops.
- **Laneways.** A narrow Flinders Lane-style laneway with café tables and a splash of street art.
- **The Yarra River**, winding gently through, in its familiar soft green-brown, with a low arched bridge.
- **Southbank and Docklands**, with glassy towers and a waterfront promenade.
- **Suburban streets** with gum trees, brick homes, front gardens, driveways and wheelie bins.
- **A café strip** with awnings and outdoor seating.
- **Street signs**: COLLINS ST, FLINDERS LANE, LYGON ST, CHAPEL ST, SWAN ST, GLENFERRIE RD and TOORAK RD.
- **Caldova Wealth — Client Operations** at the centre as the destination. Its sign reads **"CALDOVA Wealth"**, with the **"C"** logo.

Optional set dressing that ties in the advisers:

- A Collins St office tower for **Yarra Private Wealth** (Hannah Lewis)
- A bayside strip of colourful bathing boxes near **Bayside Financial Partners** in Brighton (Marcus Tan)

Advisers often send requests to Caldova on their clients' behalf.

The neighbourhood layout should feel:

- Walkable and tram-connected
- Clearly zoned: city, waterfront, suburbs, high street and airport
- Spacious enough to show movement
- Easy to read at a glance from a bird's-eye view

---

## Life-Event Zones

The neighbourhood is organised into **life-event zones**. Each is tied to a client persona and a demo scenario, and each acts as a **trigger** for a request that flows into the office.

| Zone (ScenarioId) | Map label | Client | Visual cue | Marker |
|---|---|---|---|---|
| `onboarding` | Docklands — New Job (Priya) | Priya Natarajan | Celebratory sparkle and confetti | 💼 |
| `protection` | Airport — Overseas Trip (Grace) | Grace Williams | Red pulsing alert ring with a phone and shield glyph | 🛡️ |
| `retirement` | Oakleigh — Retirement (George) | George Papadopoulos | "Happy Retirement" banner and confetti | 🎉 |
| `hardship` | Lygon St — Café Closed (Tom) | Tom Bradley | "CLOSED" sign with a gentle grey cloud or dim pulse | 🤝 |
| `bereavement` | Box Hill — Family Home (Robert) | Robert Chen | A calm, warm glow, respectful, with no alarm | ♥ |

### 1. Docklands — New Job (Priya)

- A glassy waterfront office precinct, with a building sign reading **"DOCKLANDS FINTECH HQ"**
- Life event: Priya starts a new job and decides, with her adviser, to bring her super together in one place
- Visual cues: a celebratory sparkle and a shower of confetti, and Priya with a new lanyard and laptop bag, heading home towards Southbank
- Scenario: [New client onboarding & super consolidation](scenario-1-new-client-onboarding.md)

### 2. Airport — Overseas Trip (Grace)

- A small airport gate with a plane taking off. Grace left Melbourne Airport for Italy on 18 Oct 2026.
- Life event: while Grace is away, someone tries to take over her account and move her super to a fake SMSF
- Visual cues: a **red pulsing alert ring** with a **phone and shield** glyph that signals an identity-takeover attempt. It is protective, not frightening.
- Scenario: [Identity takeover & fake SMSF rollover blocked](scenario-2-account-takeover.md)

### 3. Oakleigh — Retirement (George)

- A suburban brick home with a garden, and a work ute parked in the driveway, its tools finally put away
- Life event: after forty years as an electrical contractor, George retires and starts a pension
- Visual cues: a **"Happy Retirement"** banner across the front fence, confetti, and Helen in the garden
- Scenario: [Retirement: starting an account-based pension](scenario-3-retirement-pension.md)

### 4. Lygon St — Café Closed (Tom)

- A café strip with awnings, on Lygon Street, Carlton
- Life event: Tom's café has closed and he is struggling with bills
- Visual cues: a **"CLOSED"** sign in the café window and a gentle grey cloud or dim pulse. No smoke, fire or emergency vehicles. The mood is "a hard time", not "a disaster".
- Scenario: [Financial hardship early release](scenario-4-financial-hardship.md)

### 5. Box Hill — Family Home (Robert)

- A calm, respectful family home, set slightly apart on a quiet Box Hill street
- Life event: Robert's mother, Mei, has died, and Robert is handling her super for himself and his sister Lily
- Visual cues: a **calm, warm glow** in the windows and a family car in the driveway. No alarm, no police tape and no chaos. It is handled with care and gentle tone.
- Scenario: [Death benefit under a binding nomination](scenario-5-death-benefit.md)

Each zone should be visually distinct but stylistically consistent, so the whole map reads as one place.

---

## The Request Journey Through the Neighbourhood

Each request follows a simple, readable path on screen:

1. **The life event happens** in its zone, and a small marker appears.
2. **The person reacts**: phone in hand, an email to their adviser, a quick look at their account.
3. **The request sets off**, on foot, by tram or along a laneway, or via the adviser's office.
4. **It travels** along Melbourne streets towards Caldova Wealth — Client Operations.
5. **It arrives** at one of the lobby counters, and the story is handed to the AI-assisted operations team:
   - **NEW ACCOUNTS** for applications
   - **ADVISER DESK** for adviser-submitted requests
   - **MEMBER HELP** for withdrawals, hardship, account security and bereavement

This journey should feel like a tiny living diorama, with several requests in motion at once, each carrying its own story towards the same destination.

---

## Visual Direction

Use the same **voxel, isometric style** as the operations office, so the two scenes feel like one connected world.

Important visual characteristics:

- A bird's-eye or high isometric camera angle
- A miniature voxel Melbourne diorama feeling
- A soft, friendly palette: greens, warm neutrals and sky blues, plus the Yarra's soft green-brown
- Clear silhouettes for homes, towers, trams, cafés and people
- Small, readable life-event markers
- Voxel client characters that match the staff style of the office
- Visible roads, tram lines and walkways connecting every zone to the office
- **Caldova Wealth — Client Operations** as the most prominent building and the visual anchor

Avoid:

- Graphic or distressing depictions of any event
- Any depiction of the deceased, or funeral imagery
- Real company brands or logos, including real platforms, banks, super funds and employers
- Overly dark, dramatic or disaster-movie aesthetics
- Crowds or chaotic street scenes
- Photo-realistic rendering

The tone should always stay **calm, hopeful and solvable**. The message is: "life changed, and help is just down the street." Bereavement in particular is handled gently: quiet, warm and respectful.

---

## Life-Event Markers

Each active life event has a small, consistent marker so viewers can quickly spot what is going on:

- A floating **bubble** above the affected home, building, café or person
- An **icon** for the type of request:
  - 💼 New job: onboarding and consolidation
  - 🛡️ Shield: account protection (identity takeover blocked)
  - 🎉 Celebration: retirement and starting a pension
  - 🤝 Handshake: hardship support
  - ♥ Soft heart: bereavement and death benefit
- A subtle **path line** showing the request's route to Client Operations

Markers should be informative, never alarming. Even Grace's alert ring should read as "we're protecting you".

---

## Connection to the Operations Office

The neighbourhood and the office are designed to be viewed together:

- **Caldova Wealth — Client Operations** sits at the centre of the neighbourhood.
- Requests are shown travelling towards it on foot, by tram or through an adviser's office.
- When a request enters the building, the camera can switch to the **Operations Office** scene (see [theme_office.md](theme_office.md)), where the AI agents take over.
- A scene toggle switches between **"Operations Office"** and **"Neighbourhood"**.
- The neighbourhood is the **trigger**; the office is the **response**.

Together they tell the whole story:

> Life happens out here → requests are handled in there.

---

## Suggested On-Screen Labels

To help viewers read the scene at a glance, use light, friendly labels:

- "Docklands — New Job"
- "Airport — Overseas Trip"
- "Oakleigh — Retirement"
- "Lygon St — Café Closed"
- "Box Hill — Family Home"
- "Caldova Wealth — Client Operations"

When a scenario is active, add the client's first name in brackets, for example "Oakleigh — Retirement (George)". Labels should read like map pins, not advertising.

---

## Summary

The neighbourhood theme is the **origin point** of every request in the demo. It shows real-feeling Melburnians at moments that matter (a new job, an overseas trip, a retirement, a hard time and a family loss) and the short journey from those moments to Caldova Wealth — Client Operations. It gives the demo a clear, human starting point and sets up the hand-off into the operations office, where each specialised agent begins its work.
