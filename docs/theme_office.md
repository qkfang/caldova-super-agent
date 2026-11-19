# Operations Office Visual Theme

> Part of **Wealth Team in a Day** — the AI operations office demo for **Caldova Wealth**.

## Overview

The visual theme for *Wealth Team in a Day* is **Caldova Client Operations**: a voxel-style operations office for a Melbourne super and wealth platform, presented as a miniature isometric diorama. The office is **a modern office building set in a park**, organised into two teams: the **Superannuation Team** and the **Wealth Management Team**, led from a corner office by the Head of Client Operations. It should feel professional, organised, approachable, and busy but never chaotic.

This is an **operations office, not a trading floor**. The work on screen is about checking, verifying, calculating and communicating, not stock tickers. Every department shows people and AI agents working together on member and client requests.

---

## Office Atmosphere

The office should look like a miniature isometric diorama with:

- A private client lobby in dark slate stone with a brass inlay, a walnut **CONCIERGE** desk with a brand backdrop, and three service counters: **SUPER SERVICES**, **WEALTH SERVICES** and **ADVISER DESK**
- A **CLIENT WAITING LOUNGE** with cream leather sofas, a brass coffee table, rugs and plants
- Open walkways
- Two team wings, each with its own floor finish, floor lettering and wall banner: **SUPERANNUATION TEAM** (front) and **WEALTH MANAGEMENT TEAM** (back)
- Clearly labelled department pods, each with its sign, accent colour and team subtitle
- Staff working at desks, with monitors showing simple workflow screens: a Member Case, an eligibility checklist, a rollover tracker, a payment breakdown, a portfolio chart, a client update and a risk meter
- Some staff walking between departments carrying case folders
- Glass client meeting suites and an Investment Committee Room
- Floor-to-ceiling windows with a skyline view
- Plants, filing credenzas, headsets, application packs and monitors
- A **MEMBER LOUNGE** with a retirement-income screen and calculator kiosk, a **CLIENT CAFÉ** and a **STAFF KITCHEN**
- A **CALDOVA WEALTH** identity wall
- An **OUR PROCESS** board showing the request lifecycle
- A park setting outside: a stone forecourt with a water feature, gravel paths, a pond with a jetty, a gazebo, a picnic area, flower beds and trees

The office layout should feel:

- Professional
- Organised
- Approachable
- Busy but not chaotic
- Spacious enough for staff to move around
- Clearly divided into the two teams

---

## Floor Layout

The departments sit in two rows of pods, one row per team, separated by a central walkway, with the lobby at the front:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ INVESTMENT      │ CLIENT MEETING SUITES          │ Skyline     │ Staff       │
│ COMMITTEE       │ (Advice Suite · Case Conf.)    │ windows     │ Kitchen     │
├─────────────────┼────────────┬─────────────┬─────┴─────┬───────┴─────────────┤
│ HEAD OF CLIENT  │ INVESTMENTS│ COMMS       │ FINANCIAL │ Client Café         │  WEALTH MANAGEMENT
│ OPS  Theo       │ Ivy        │ Cara        │ CRIME     │                     │  TEAM (back row)
│ (corner office) │            │             │ Felix     │                     │
├─────────────────┼────────────┼─────────────┼───────────┼─────────────────────┤
│ ONBOARDING      │ BENEFITS   │ TRANSFERS   │ PAYMENTS  │ Member Lounge       │  SUPERANNUATION
│ Olivia          │ Ben        │ Rory        │ Penny     │                     │  TEAM (front row)
├─────────────────┴────────────┴─────────────┴───────────┴─────────────────────┤
│ LOBBY: SUPER SERVICES · WEALTH SERVICES · ADVISER DESK                      │
│ Concierge · CLIENT WAITING LOUNGE · entrance                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Superannuation Team (front row, closest to the lobby because it is member-facing):** ONBOARDING (Olivia), BENEFITS (Ben), TRANSFERS (Rory), PAYMENTS (Penny)
- **Wealth Management Team (back row, beside the meeting suites):** INVESTMENTS (Ivy), COMMS (Cara), FINANCIAL CRIME (Felix), with the HEAD OF CLIENT OPS corner office (Theo) leading both teams
- **Back wall:** the glass client meeting suites, the archive credenzas, skyline windows and the **CALDOVA WEALTH** identity wall
- **Left wall:** the two team banners and skyline windows
- **Right wall:** the **OUR PROCESS** board

---

## Office Departments

The office is arranged into visible, distinct zones:

| Department (UI) | Office sign | Team | Staff | Accent | What the desk shows |
|---|---|---|---|---|---|
| Onboarding & Requests | ONBOARDING | Superannuation | Olivia | `#0ea5e9` | A Member Case, application packs, the NIGO checklist ticking through |
| Benefits & Eligibility | BENEFITS | Superannuation | Ben | `#6366f1` | Rule books (PDS, trust deed), an eligibility checklist of passes, fails and warnings |
| Transfers & Rollovers | TRANSFERS | Superannuation | Rory | `#10b981` | A rollover tracker with arrows to other funds, a service-level timer |
| Payments | PAYMENTS | Superannuation | Penny | `#a855f7` | A payment breakdown (gross, tax, net), an approval light waiting for Teams |
| Investment Solutions | INVESTMENTS | Wealth Management | Ivy | `#f59e0b` | Model portfolio charts, a fee comparison in dollars, a workbook |
| Client Communications | COMMS | Wealth Management | Cara | `#ec4899` | A headset, letter drafts, an envelope and a speech bubble |
| Financial Crime | FINANCIAL CRIME | Wealth Management | Felix | `#ef4444` | An ID document under a magnifier, a risk meter, an activity timeline |
| Team Leader Office | HEAD OF CLIENT OPS | Leadership | Theo | `#14b8a6` | A floor dashboard, service-level and complaint clocks, an approvals tray |

The office also includes these supporting zones:

- Reception (concierge) and the lobby counters
- The Client Waiting Lounge
- The Client Meeting Suites
- The Investment Committee Room
- The Member Lounge
- The Document Archive and closed-case credenza
- The Client Café and the Staff Kitchen

Leave open walkways between departments so staff characters can move around and collaborate. The departments should never feel cramped.

---

## Lobby & Reception

The lobby is where requests enter the office.

- **Olivia** sits at the front of the Superannuation wing, next to the concierge desk.
- The three lobby counters sort requests as they arrive:
  - **SUPER SERVICES**: super applications, withdrawals, hardship, account security and death notifications
  - **WEALTH SERVICES**: advice, investment and portfolio requests
  - **ADVISER DESK**: requests that advisers submit for their clients
- The **CLIENT WAITING LOUNGE** has cream leather sofas, a brass coffee table, magazines and plants. It should feel calm and welcoming.
- A brand backdrop behind the concierge desk reads like a promise, not an advertisement.

---

## Top Bar & Scene Toggle

- **Top-bar metrics:** Received · In flight · Completed · Declined
- **Scene toggle:** "Operations Office" | "Neighbourhood". The neighbourhood is described in [theme_neighhood.md](theme_neighhood.md).

---

## Visual Direction

Use a voxel, isometric style.

Important visual characteristics:

- A bird's-eye or high isometric camera angle
- A miniature office diorama feeling
- Clear department signs, each with its accent colour
- A navy, brass and stone corporate palette — walnut timber, glass screens and cream leather — with the department accents as highlights; teal for the Superannuation wing and navy-and-gold for the Wealth Management wing
- Clean desk clusters
- Monitors showing simple workflow screens: cases, checklists, trackers, payments, portfolio charts and risk meters
- Staff seated and working
- Some staff walking between departments
- Glass client meeting suites
- Plants and filing storage for warmth and realism
- A document archive zone with credenzas and labelled shelving
- A professional but approachable atmosphere

Avoid:

- Overly chaotic office layouts
- Dense, unreadable clutter
- Trading-floor clichés such as stock tickers, flashing prices or bells
- Real company logos, including those of real platforms, funds or banks
- Readable personal or financial details on screens. TFNs, if ever shown, must be masked (`*** *** 123`)
- A hyper-realistic photo style for the final theme

---

## Staff Lockers

A small bank of staff lockers should appear near the reception or staff entrance, giving the office a lived-in, human feel.

The locker area should:

- Sit just off the main walkway, not inside a department zone
- Show a tidy row or two of tall, narrow lockers in the corporate palette
- Include small details such as name labels, padlocks, a bench or a coat hook
- Occasionally show a staff character collecting or stowing a bag
- Stay visually quiet so it doesn't compete with the working departments

---

## Document Archive

A dedicated document archive should be visible in the office. It reinforces that super and wealth operations depend on real records: applications, member files and nominations that must be kept carefully and found quickly.

The archive should:

- Occupy a clearly defined zone along the back wall, behind the client meeting suites and beside the Wealth Management wing
- Contain rows of filing cabinets with a labelled rail, plus a closed-case credenza beside the Wealth wing where Comms files each finished case
- Use these category labels: ***Advice (SOA)***, ***Member Files***, ***Nominations*** and ***Closed Cases***
- Occasionally feature a staff character filing or retrieving a folder. Ben fetching a nomination is a nice touch.
- Use the same navy, brass and stone palette as the rest of the office

The archive should feel organised and well kept, never dusty or chaotic. It signals that records are managed carefully and can be accessed by the appropriate AI agents when needed. It is the visual stand-in for the `wealth_knowledge` index that the agents cite.

---

## Client Meeting Suites & Investment Committee Room

Two glass-walled suites sit at the back of the office under a **CLIENT MEETING SUITES** banner: the **ADVICE SUITE** for adviser and client reviews, and **CASE CONFERENCE**.

- Case Conference is where Theo brings the specialists together on one case. This is the visual home of the multi-agent **group chat**.
- Show a conference table, chairs and a wall screen with a single case on it.

The **INVESTMENT COMMITTEE** room sits at the back-left, beside Theo's corner office. It has a walnut boardroom table, leather chairs and a wall display of the asset-allocation view across the model portfolios that Ivy maintains.

---

## Park Setting

The office sits in a green park, not a street or a lawn of nothing. Outside the walls:

- A stone forecourt with a water feature, hedges, benches and a **CALDOVA WEALTH** monolith sign beside the entrance path
- Gravel paths looping around the building, with lampposts, benches and flower beds
- A pond with a jetty, reeds and lily pads on the right; a gazebo on the left; a picnic area at the back
- Plenty of trees, kept sparse and low at the front so they never hide the office floor from the default camera
- Strollers and joggers on the paths

Inside, windows show the same skyline. There are no high rises, roads or cars in the background.

---

## Process Board

A visible **OUR PROCESS** board hangs in the office, showing the request lifecycle:

1. **Request**: the request is received and captured in a Member Case (ONBOARDING)
2. **Verify**: it is in good order and genuine (ONBOARDING, FINANCIAL CRIME)
3. **Assess**: the rules and the portfolio are checked (BENEFITS, INVESTMENTS)
4. **Action**: money is moved or paid with the right approval (TRANSFERS, PAYMENTS)
5. **Confirm**: the member and adviser are told what happened and what is next (COMMS)

The TEAM LEADER office (Head of Client Operations) oversees every step across both teams.
