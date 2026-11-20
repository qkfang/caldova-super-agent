# AGENTS.md

## Project Name

The project is called **Wealth Team in a Day**. It is built for **Caldova Wealth** (short name **Caldova**), a fictional super and wealth platform. Caldova is headquartered in Melbourne and works mainly through financial advisers. Use these names consistently across all UI, documentation, and demo narration.

## Demo Purpose

**Wealth Team in a Day** shows how an AI-powered operations office could work at **Caldova Wealth**, inside Australia's superannuation and wealth platform industry. The goal is a realistic, easy-to-understand operations environment where each staff role is supported by a specialised AI agent.

The demo shows that platform operations is the engine room of wealth management, not a separate business. Something starts each piece of work: an adviser recommends a strategy, or a member's life changes (a new job, retirement, hardship or a death in the family). The operations team turns that into a completed, compliant transaction. It opens accounts, checks eligibility, moves money between funds, pays benefits, and keeps members and advisers informed.

Caldova's fictional products are:

- **Caldova Super** and **Caldova Pension**, in the Caldova Superannuation Master Fund
- **Caldova Wrap**, an investor-directed portfolio service (IDPS)
- **Caldova Managed Portfolios**, a range of model portfolios
- the **Caldova Cash Account**, which sits inside every account

For the industry background, see [docs/background.md](docs/background.md).

---

## Core Concept

The demo shows Caldova Wealth as a voxel **lakehouse**: a casual, futuristic house on a lake on the edge of Melbourne, read from the top down.

- **Level 3, the idea:** the business owner's office and her idea for running Caldova in the agentic era.
- **Level 2, the people:** **Caldova Client Operations**, two small teams, one for each side of the business (Wealth Management and Superannuation), with one team leader between them. Each role is a real platform operations function.
- **Level 1, the agents:** one group of AI agents that supports both teams. Each staff member is supported by an AI agent that drafts, checks, calculates, summarises and recommends. Humans approve.
- **The engine room:** Microsoft IQ and the Azure services underneath.

Out front, members, clients and advisers arrive by water taxi at the front desk on the dock, where requests come in. Every request follows one lifecycle:

> **Request → Verify → Assess → Action → Confirm**

For the setting, the cast, every page and the visual direction, see [docs/storybook.md](docs/storybook.md).

---

## Target Story

The demo should communicate this story:

> A member, client or their adviser needs something done: open an account, roll over super, start a pension, release money in hardship, or pay a death benefit. Inside Caldova Client Operations, specialist agents take the request from receipt through verification, eligibility, investment, financial-crime checks, transfers, payment and communication. Humans approve every decision that matters.

The experience should make super and wealth operations feel tangible and understandable.

---

## Key Request Journey

The demo should broadly follow this flow:

1. A member, client or adviser submits a request.
2. **Onboarding & Requests** captures it, runs the NIGO (not in good order) checklist and opens the Member Case.
3. **Benefits & Eligibility** checks the request against the PDS, trust deed and super law, and cites each rule.
4. **Investment Solutions** checks portfolio fit, shows fees in dollars and plans income or redemptions.
5. **Financial Crime** verifies identity and documents, and screens for fraud, scams and AML/CTF risk.
6. **Transfers & Rollovers** moves money between Caldova and other funds, SMSFs and the ATO.
7. **Payments** calculates tax components and withholding, gets approval and releases payment.
8. **Client Communications** keeps the member and their adviser informed in plain English.
9. **Team Leader Office** monitors workload, SLAs, IDR (complaint) clocks, approvals and quality.

The eight departments and their canonical names:

| # | Department (UI) | Staff and role | Agent | Route id | Foundry agent id |
|---|---|---|---|---|---|
| 1 | Onboarding & Requests | Olivia, Onboarding & Requests Officer | Onboarding Agent | `onboarding` | `onboarding-agent` |
| 2 | Benefits & Eligibility | Ben, Benefits & Eligibility Assessor | Benefits & Eligibility Agent | `benefits-eligibility` | `benefits-eligibility-agent` |
| 3 | Investment Solutions | Ivy, Investment Analyst | Investment Analyst Agent | `investment-analyst` | `investment-analyst-agent` |
| 4 | Financial Crime | Felix, Financial Crime Investigator | Financial Crime Agent | `financial-crime` | `financial-crime-agent` |
| 5 | Transfers & Rollovers | Rory, Transfers & Rollovers Coordinator | Transfers & Rollovers Agent | `transfers-rollovers` | `transfers-rollovers-agent` |
| 6 | Payments | Penny, Payments Officer | Payments Agent | `payments` | `payments-agent` |
| 7 | Client Communications | Cara, Client Communications Specialist | Client Communications Agent | `client-communications` | `client-communications-agent` |
| 8 | Team Leader Office | Theo, Client Operations Team Leader | Team Leader Agent | `team-leader` | `team-leader-agent` |

Cara also has a voice agent, `client-communications-voice-agent`, built on Voice Live. Theo runs a group chat that coordinates the other seven agents on one case.

How the departments map to the lifecycle:

| Stage | Departments |
|---|---|
| **Request** | Onboarding & Requests |
| **Verify** | Onboarding & Requests (NIGO), Financial Crime |
| **Assess** | Benefits & Eligibility, Investment Solutions |
| **Action** | Transfers & Rollovers, Payments |
| **Confirm** | Client Communications |
| All stages | Team Leader Office |

For detailed AI agent capabilities, tools and approval rules, see [docs/foundry_agents.md](docs/foundry_agents.md).

---

## Staff and Client Characters

**Staff.** The demo has eight staff characters. Each name starts with the same letter as a keyword in the role:

- **O**livia: **O**nboarding & Requests Officer
- **B**en: **B**enefits & Eligibility Assessor
- **I**vy: **I**nvestment Analyst
- **F**elix: **F**inancial Crime Investigator
- **R**ory: Transfers & **R**ollovers Coordinator
- **P**enny: **P**ayments Officer
- **C**ara: Client **C**ommunications Specialist
- **T**heo: Client Operations **T**eam Leader

**Clients.** There are five client personas, one for each scenario:

| Client | Scenario |
|---|---|
| Priya Natarajan | New client onboarding and super consolidation |
| Grace Williams | Identity takeover and a fake SMSF rollover, blocked |
| George Papadopoulos | Retirement and an account-based pension |
| Tom Bradley | Financial hardship early release |
| Robert Chen | Death benefit under a binding nomination |

**Advisers.** Two fictional advisers appear:

- Hannah Lewis, Yarra Private Wealth
- Marcus Tan, Bayside Financial Partners

For full character profiles, personalities, situations and example dialogue, see [docs/characters.md](docs/characters.md). For the scenarios, see the `docs/scenario-*.md` files listed under Reference Documents.

---

## Product Message

The demo should show that AI agents are not one generic chatbot. The system works like a coordinated digital operations department: each agent has a clear role, supports a named human, and covers a specific part of the request lifecycle.

The intended message is:

> Super and wealth operations are complex and heavily regulated, but they can be made clearer, faster and more consistent by assigning specialised AI agents to each stage of the request lifecycle, with people approving every decision that matters.

---

## Tone

Use language that is:

- Clear
- Practical
- Business-friendly
- Realistic
- Empathetic, especially for hardship, scams and bereavement
- Not overly technical
- Suitable for an Australian superannuation, wealth platform and financial adviser audience

---

## GitHub Copilot Guidance

When you generate code, content, UI components, or documentation for this demo, follow these rules.

**Metaphor and roles**

- Preserve the lakehouse metaphor (the idea, the people, the agents and the engine room, read from the top down), with **Caldova Client Operations** as the team, and keep the **Request → Verify → Assess → Action → Confirm** lifecycle visible.
- Represent each AI agent as a specialised role that supports a named human staff member.
- Show AI supporting, triaging, drafting, summarising, checking, calculating and recommending. Humans approve, override and finalise. Never make the system appear to replace human judgement.

**Advice and approvals**

- Agents **never give personal financial advice**. That is the adviser's job. Agents explain rules, check eligibility, calculate, draft and recommend for human approval.
- Always require human approval for:
  - declines and partial approvals
  - blocking a request on financial-crime grounds
  - suspicious matter reports (SMRs)
  - a single payment of $250,000 or more, and any death benefit
  - pension commencements of $1,000,000 or more
  - hardship releases
  - complaint responses
  - any communication to a fraud victim or a bereaved family

**Terminology**

- Use realistic Australian super and wealth terminology. Examples: NIGO, KYC, AML/CTF, SMR, SuperStream, rollover, USI, SMSF, ESA, SMSF verification service (SVS), Payday Super, condition of release, preservation age, transfer balance cap, account-based pension, minimum drawdown, reversionary beneficiary, BDBN, SIS dependant, tax-free and taxable components, PAYG withholding, Statement of Advice, s99FA fee consent, TMD, IDR and AFCA.
- Use this core vocabulary:

| Concept | Use |
|---|---|
| Unit of work | A **request** becomes a **case**, the **Member Case**, numbered `REQ-YYYYMMDD-XXXXXX` |
| People | **member** for super and pension; **client** generically; **adviser** as the second audience |
| Accounts | **account**, with member numbers `CS-…` for super and `CP-…` for pension |
| Other terms | **eligibility**, **payment**, **counterparty**, **financial crime** |
| Outcomes | **completed**, **declined**, **blocked** or **partially approved** |

- Don't use insurance-claims language: claim or claims (except in the phrase "death benefit claim"), insurance policy, excess, loss adjuster, supplier, settlement or repairer. Insurance *inside* super, such as death and TPD cover, may be mentioned where it is relevant.
- Never call anything on screen a "demo": not in labels, buttons, status lines, letters or case numbers. Say "scenario" or "use case" instead, or "offline" for the scripted fallback when Foundry isn't configured. The five scenario cases are numbered `REQ-YYYYMMDD-OPS001` to `OPS005`.
- Use the department names exactly as listed above, consistently across UI, code and documentation.
- Use Australian English (organise, licence, colour, judgement) and Australian conventions: AUD amounts, Australian date formats, and the FY2026-27 rules and numbers in [docs/background.md](docs/background.md).

**Accuracy and care**

- Never invent figures or rules. Cite the PDS, trust deed or rule document from the `wealth_knowledge` Azure AI Search index by its title.
- Never accuse a member of fraud.
- Protect privacy: mask TFNs as `*** *** 123`.
- Flag vulnerable members (hardship, bereavement, scams, age, cognitive decline) for human handling.
- Keep client-facing language empathetic and plain English.

**Presentation**

- Keep visual elements aligned with the voxel lakehouse in [docs/storybook.md](docs/storybook.md): sharp and readable, one accent colour per level and one colour per side of the business.
- Prefer structured layouts with departments, cards, panels, checklists or workflow stages.
- Make the demo feel like an enterprise wealth-platform operations product, not a consumer chatbot.

**Fiction and sources**

- All people, advice practices, external funds and Caldova products are fictional. Don't use real platform, fund or adviser names, logos, product names or addresses in the UI or docs. The only exception is the presenter notes in [docs/background.md](docs/background.md).
- Reference the docs files for character details, scenarios, rules and agent capabilities instead of duplicating that content.

---

## Reference Documents

- [docs/background.md](docs/background.md): primer on super and wealth platforms, covering products, the member lifecycle, the request lifecycle, FY2026-27 rules and numbers, regulators, and presenter notes.
- [docs/characters.md](docs/characters.md): staff and client character profiles, supporting AI agents, and dialogue.
- [docs/process.md](docs/process.md): operations process detail and AI agent capabilities for each role.
- [docs/foundry_agents.md](docs/foundry_agents.md): Foundry agent design, covering the Member Case, inputs, tools, outputs, handoffs and human approval.
- [docs/agent-demo.md](docs/agent-demo.md): the presenter click-path and 10-minute golden path.
- [docs/storybook.md](docs/storybook.md): the Lakehouse storybook, the frontend at `/`. Caldova is shown as a wealth business for the agentic era with two sides, Wealth Management and Superannuation. The house is read from the top down: the business owner's idea, two small teams, one group of agents (dedicated to a side or shared by both, with each agent's specialised assistants as their own roles), and Microsoft IQ and the Azure services in the engine room. Out front, visitors arrive by water taxi and sign at the front desk on the dock, where a Caldova financial adviser links them with the agents that get them started, and on the roof Caldova throws a party for its customers. The doc covers the setting, the business owner and front-desk adviser characters, the visual direction and every page.
- Scenarios:
  - [docs/scenario-1-new-client-onboarding.md](docs/scenario-1-new-client-onboarding.md) (Priya)
  - [docs/scenario-2-account-takeover.md](docs/scenario-2-account-takeover.md) (Grace)
  - [docs/scenario-3-retirement-pension.md](docs/scenario-3-retirement-pension.md) (George)
  - [docs/scenario-4-financial-hardship.md](docs/scenario-4-financial-hardship.md) (Tom)
  - [docs/scenario-5-death-benefit.md](docs/scenario-5-death-benefit.md) (Robert)

---

## Project Name

The demo is called **Wealth Team in a Day**. The fictional business it represents is **Caldova Wealth**. Always refer to the demo by this name. Don't introduce alternative or legacy names.

---

## Summary

**Wealth Team in a Day** presents **Caldova Wealth** as a voxel lakehouse. Its operations team, **Caldova Client Operations**, works on one floor, and each staff member is supported by a specialised AI agent on the floor below. The purpose is to explain and visualise how AI can assist with:

- onboarding and requests
- benefits and eligibility
- investment solutions
- financial crime
- transfers and rollovers
- payments
- client communications
- team leadership

The final experience should help viewers quickly understand how super and wealth platform operations work, and how a coordinated set of AI agents can support the full request lifecycle: **Request → Verify → Assess → Action → Confirm**.

For all detailed character, process, rule and visual content, see the [docs/](docs/) folder.
