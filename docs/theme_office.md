# Operations Office Visual Theme

> Part of **Wealth Team in a Day** — the AI operations office demo for **Caldova Wealth**.

## Overview

The visual theme for *Wealth Team in a Day* is **Caldova Client Operations**: a voxel-style operations office for a Melbourne super and wealth platform, presented as a miniature isometric diorama. The office should feel professional, organised, approachable, and busy but never chaotic.

This is an **operations office, not a trading floor**. The work on screen is about checking, verifying, calculating and communicating, not stock tickers. Every department shows people and AI agents working together on member requests.

---

## Office Atmosphere

The office should look like a miniature isometric diorama with:

- A reception lobby with three service counters: **NEW ACCOUNTS**, **MEMBER HELP** and **ADVISER DESK**
- A **CLIENT WAITING AREA** with sofas, a coffee table and plants
- Open walkways
- Clearly labelled departments, each with its sign and accent colour
- Staff working at desks, with monitors showing simple workflow screens: a Member Case, a NIGO checklist, a rollover tracker, a payment approval
- Some staff walking between departments carrying case folders
- Glass meeting rooms
- Plants, filing cabinets, headsets, application packs and monitors
- Staff lockers near the entrance for personal belongings
- A document archive with rows of labelled shelves and archive boxes
- A **CLIENT / OPERATIONS** identity wall
- An **OUR PROCESS** board showing the request lifecycle
- Back-wall windows with a hint of a Melbourne laneway, such as Flinders Lane, outside

The office layout should feel:

- Professional
- Organised
- Approachable
- Busy but not chaotic
- Spacious enough for staff to move around
- Clearly divided into functional departments

---

## Floor Layout

The geometry matches the original diorama; only the labels change. The departments sit in two rows of booths separated by tall partitions, with the lobby at the front:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ IT / Cloud Room              │ MEETING ROOMS (A + B)          │ Kitchen     │
├─────────────────┬────────────┼──────────────┬─────────────────┼─────────────┤
│ TEAM LEADER     │ BENEFITS   │ INVESTMENTS  │ FINANCIAL CRIME │ Coffee Area │  back row
│ Theo            │ Ben        │ Ivy          │ Felix           │             │
│ (corner office) │            │              │                 │             │
├─────────────────┼────────────┼──────────────┼─────────────────┼─────────────┤
│ ONBOARDING      │ TRANSFERS  │ PAYMENTS     │ COMMS           │ Play Area   │  front row
│ Olivia          │ Rory       │ Penny        │ Cara            │             │
│ (at reception)  │            │              │                 │             │
├─────────────────┴────────────┴──────────────┴─────────────────┴─────────────┤
│ LOBBY: NEW ACCOUNTS · MEMBER HELP · ADVISER DESK                            │
│ Reception (Olivia) · CLIENT WAITING AREA · entrance                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Front row:** ONBOARDING (Olivia, at reception), TRANSFERS (Rory), PAYMENTS (Penny), COMMS (Cara)
- **Back row:** TEAM LEADER (Theo, in the corner office), BENEFITS (Ben), INVESTMENTS (Ivy), FINANCIAL CRIME (Felix)
- **Back wall:** filing cabinets and the archive shelves, the glass meeting rooms, and the **CLIENT / OPERATIONS** identity wall
- **Right wall:** the **OUR PROCESS** board

---

## Office Departments

The office is arranged into visible, distinct zones:

| Department (UI) | Office sign | Staff | Accent | What the desk shows |
|---|---|---|---|---|
| Onboarding & Requests | ONBOARDING | Olivia | `#0ea5e9` | Application packs, an inbox tray, the NIGO checklist ticking through |
| Benefits & Eligibility | BENEFITS | Ben | `#6366f1` | Rule books (PDS, trust deed), an eligibility checklist of passes, fails and warnings |
| Investment Solutions | INVESTMENTS | Ivy | `#f59e0b` | Model portfolio charts, a fee comparison in dollars, a workbook |
| Financial Crime | FINANCIAL CRIME | Felix | `#ef4444` | An ID document under a magnifier, a risk meter, an activity timeline |
| Transfers & Rollovers | TRANSFERS | Rory | `#10b981` | A rollover tracker with arrows to other funds, a service-level timer |
| Payments | PAYMENTS | Penny | `#a855f7` | A payment breakdown (gross, tax, net), an approval light waiting for Teams |
| Client Communications | COMMS | Cara | `#ec4899` | A headset, letter drafts, an envelope and a speech bubble |
| Team Leader Office | TEAM LEADER | Theo | `#14b8a6` | A floor dashboard, service-level and complaint clocks, an approvals tray |

The office also includes these supporting zones:

- Reception and the lobby counters
- The Client Waiting Area
- The Meeting Rooms
- The Staff Locker Area
- The Document Archive
- The kitchen, coffee and play areas

Leave open walkways between departments so staff characters can move around and collaborate. The departments should never feel cramped.

---

## Lobby & Reception

The lobby is where requests enter the office.

- **Olivia** sits at reception, at the front of the ONBOARDING zone.
- The three lobby counters sort requests as they arrive:
  - **NEW ACCOUNTS**: applications and consolidations
  - **MEMBER HELP**: withdrawals, hardship, account security and death notifications
  - **ADVISER DESK**: requests that advisers submit for their clients
- The **CLIENT WAITING AREA** has sofas, a coffee table, magazines and plants. It should feel calm and welcoming.
- A small welcome sign by the door reads like a promise, not an advertisement.

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
- A blue and neutral corporate palette, with the department accents as highlights
- Clean desk clusters
- Monitors showing simple workflow screens: cases, checklists, trackers and approvals
- Staff seated and working
- Some staff walking between departments
- Glass meeting rooms
- Plants and filing storage for warmth and realism
- Banks of staff lockers as a small, tidy backdrop element
- A document archive zone with shelving units, archive boxes and folder spines
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

- Occupy a clearly defined zone along the back wall, near BENEFITS and the TEAM LEADER office
- Contain rows of shelving units filled with labelled archive boxes and binders
- Use these category labels: ***Applications***, ***Member Files***, ***Nominations*** and ***Closed Cases***
- Show a rolling ladder, step stool or trolley to suggest active retrieval
- Occasionally feature a staff character filing or retrieving a box. Ben fetching a nomination is a nice touch.
- Use the same blue and neutral corporate palette as the rest of the office

The archive should feel organised and well kept, never dusty or chaotic. It signals that records are managed carefully and can be accessed by the appropriate AI agents when needed. It is the visual stand-in for the `wealth_knowledge` index that the agents cite.

---

## Meeting Rooms

Two glass-walled meeting rooms sit at the back of the office under a **MEETING ROOMS** banner.

- They host case conferences, where Theo brings the specialists together on one case. This is the visual home of the multi-agent **group chat**.
- Show a conference table, chairs and a wall screen with a single case on it.

---

## Process Board

A visible **OUR PROCESS** board hangs in the office, showing the request lifecycle:

1. **Request**: the request is received and captured in a Member Case (ONBOARDING)
2. **Verify**: it is in good order and genuine (ONBOARDING, FINANCIAL CRIME)
3. **Assess**: the rules and the portfolio are checked (BENEFITS, INVESTMENTS)
4. **Action**: money is moved or paid with the right approval (TRANSFERS, PAYMENTS)
5. **Confirm**: the member and adviser are told what happened and what is next (COMMS)

The TEAM LEADER office oversees every step.
