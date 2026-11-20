/**
 * The v2 storybook pages, read from the top of the house down.
 * Keep the text in sync with docs/storybook.md, which is the source of truth.
 */
import type { StackMode } from "./types";

export type PageId = "cover" | "idea" | "people" | "agents" | "engine" | "finale";

export interface CameraShot {
  target: [number, number, number];
  radius: number;
  alpha: number;
  beta: number;
}

export interface StoryPage {
  id: PageId;
  chapter: string;
  /** Lift display label. */
  floor: string;
  kicker: string;
  title: string;
  body: string[];
  hint: string;
  accent: string;
  mode: StackMode;
  shot: CameraShot;
  /** The finale only: where it opens, on the dock, while the member signs at the front desk. */
  dock?: CameraShot;
}

export const PAGES: StoryPage[] = [
  {
    id: "cover",
    chapter: "Cover",
    floor: "⌂",
    kicker: "Wealth Team in a Day · The Lakehouse",
    title: "One business, two sides, four levels",
    body: [
      "Caldova Wealth is a wealth management business built for the agentic era. It has two sides, Wealth Management and Superannuation, and runs both from a lakehouse on the edge of Melbourne.",
      "Read it from the top down: the owner’s idea, two small teams, one group of AI agents that supports both and, under the waterline, Microsoft IQ and the Azure services that power it all. Out front, members and clients arrive by water taxi and sign in at the front desk on the dock, where Amelia, Caldova’s financial adviser, gets them started. Up on the roof, Caldova throws a party for them.",
    ],
    hint: "Drag to look around. Press Begin, or take the lift on the right.",
    accent: "#ffc35a",
    mode: { kind: "house" },
    shot: { target: [-12, 3, -13], radius: 90, alpha: -1.02, beta: 1.16 },
  },
  {
    id: "idea",
    chapter: "Chapter 1",
    floor: "3",
    kicker: "Level 3 · The business owner’s office",
    title: "The idea",
    body: [
      "This is Maya Ashworth’s office. Maya is Caldova’s managing director and the business owner for both sides: Wealth Management (Caldova Wrap and the managed portfolios) and Superannuation (Caldova Super and Caldova Pension).",
      "Her idea for the agentic era: run each side with a small expert team, supported by one group of AI agents that are dedicated where the work is specialised and shared where it isn’t. People still approve every decision that matters. The brain above her table holds the idea, one half for each side.",
    ],
    hint: "Click the brain to see the goals and guardrails, or click Maya to meet her.",
    accent: "#ffc35a",
    mode: { kind: "focus", level: "idea" },
    shot: { target: [-7.6, 12.2, -4.8], radius: 38, alpha: -1.05, beta: 0.78 },
  },
  {
    id: "people",
    chapter: "Chapter 2",
    floor: "2",
    kicker: "Level 2 · Two small teams",
    title: "The people",
    body: [
      "One floor down, the idea becomes two small teams. On the left, the Wealth Management Team: Ivy runs the model portfolios, while Cara and Felix handle client communications and financial crime for both sides. On the right, the Superannuation Team: Olivia, Ben, Rory and Penny.",
      "Theo sits between them and leads both teams. People talk to members, clients and advisers, weigh the evidence and make the calls, and both sides follow one lifecycle: Request, Verify, Assess, Action, Confirm. Nobody is stuck at a desk: they meet at the huddle table, check the process board and drop by each other’s desks.",
    ],
    hint: "Click a person to meet them and see what they are doing, then follow them down to their agent.",
    accent: "#ff8f6b",
    mode: { kind: "focus", level: "people" },
    shot: { target: [-2.4, 6.8, -5.2], radius: 50, alpha: -1.02, beta: 0.8 },
  },
  {
    id: "agents",
    chapter: "Chapter 3",
    floor: "1",
    kicker: "Level 1 · One group of agents",
    title: "The agents",
    body: [
      "Under the desks is one group of Microsoft Foundry agents that supports both teams. Each person has an agent, and each agent has two specialised assistants: 25 roles in all, counting Cara’s voice agent. They move about as they work, between their bays, the Member Case hub, the Foundry uplink and the MCP tool bench.",
      "Some agents are dedicated to one side: four on the Super side, and the Investment Analyst on the Wealth side. Financial Crime, Client Communications and the Team Leader agent are shared by both. They hand work to each other on one Member Case, and a person always decides.",
    ],
    hint: "Click an agent or one of its assistants to see what it does and what it is doing now, or follow it down to the engine room.",
    accent: "#5ce1ff",
    mode: { kind: "focus", level: "agents" },
    shot: { target: [-2.4, 1.3, -5.2], radius: 50, alpha: -1.02, beta: 0.8 },
  },
  {
    id: "engine",
    chapter: "Chapter 4",
    floor: "B",
    kicker: "Lower level · Microsoft IQ and Azure",
    title: "The engine room",
    body: [
      "Below the waterline is the platform. Microsoft Foundry is the core: it runs every agent on the gpt-5.4 model. On the raised deck behind it is Microsoft IQ, the context layer every agent shares: Work IQ, Fabric IQ, Foundry IQ and Web IQ.",
      "Around them are the Azure services. Along the glass are the ones particular agents call: MCP tools, Teams approvals, Content Understanding and Voice Live. Behind, Entra ID, Key Vault, Storage, App Service and Application Insights keep it all secure, hosted and observable over HTTPS.",
    ],
    hint: "Click a component to see which agents use it, how it is secured and how the scenarios use it today.",
    accent: "#a78bfa",
    mode: { kind: "focus", level: "engine" },
    shot: { target: [-2.6, -4.8, -4.6], radius: 44, alpha: -1.02, beta: 0.78 },
  },
  {
    id: "finale",
    chapter: "Finale",
    floor: "⇅",
    kicker: "From the dock, through all four levels",
    title: "One request, top to bottom",
    body: [
      "Now watch a real member request travel through the house. It starts at the dock: the member arrives by water taxi and signs at the front desk, where Amelia links them with the Onboarding Agent and Olivia’s Form Extraction agent comes out to read the form.",
      "Then the house pulls apart. Each step starts with a person, dips down to their agent and the engine room, and comes back up for a human decision. These are Super requests: they use the Super side’s agents and the shared ones, and call in the Wealth side’s Investment Analyst when they need an investment view. The result rises to Maya’s floor.",
    ],
    hint: "Pick a member to replay their request. Pause or skip at any time.",
    accent: "#ffc35a",
    mode: { kind: "exploded" },
    shot: { target: [-4, 16, -7], radius: 112, alpha: -0.98, beta: 1.12 },
    dock: { target: [0.2, 0.8, -21], radius: 34, alpha: -1.2, beta: 1.0 },
  },
];

export function pageIndex(id: PageId): number {
  return PAGES.findIndex((p) => p.id === id);
}

/** A closer look at the party on the roof, with the house together (from the party's card). */
export const PARTY_SHOT: CameraShot = { target: [0.5, 19.8, -2.0], radius: 54, alpha: -1.42, beta: 1.02 };
