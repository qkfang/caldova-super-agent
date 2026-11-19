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
}

export const PAGES: StoryPage[] = [
  {
    id: "cover",
    chapter: "Cover",
    floor: "⌂",
    kicker: "Wealth Team in a Day · The Lakehouse",
    title: "One house, four levels",
    body: [
      "Caldova Wealth runs its client operations from a lakehouse on the edge of Melbourne. Read it from the top down.",
      "Upstairs is the idea. Below it are the people who own the decisions, then the AI agents that do the heavy lifting, and under the waterline, the engine room that keeps it all running.",
    ],
    hint: "Drag to look around. Press Begin, or take the lift on the right.",
    accent: "#ffc35a",
    mode: { kind: "house" },
    shot: { target: [-1, 4, -6], radius: 96, alpha: -1.02, beta: 1.16 },
  },
  {
    id: "idea",
    chapter: "Chapter 1",
    floor: "3",
    kicker: "Level 3 · The business owner’s office",
    title: "The idea",
    body: [
      "This is Maya Ashworth’s office. Maya is Caldova’s managing director and the business owner for Client Operations.",
      "Her idea: give every person in the team a specialised AI agent for their part of the request lifecycle, so requests become clearer, faster and more consistent, while people still approve every decision that matters. The brain above her table holds that idea, with the goals and guardrails the whole house works to.",
    ],
    hint: "Click the brain to see the goals and guardrails, or click Maya to meet her.",
    accent: "#ffc35a",
    mode: { kind: "focus", level: "idea" },
    shot: { target: [-5, 12.6, -2.5], radius: 46, alpha: -1.05, beta: 0.9 },
  },
  {
    id: "people",
    chapter: "Chapter 2",
    floor: "2",
    kicker: "Level 2 · Caldova Client Operations",
    title: "The people",
    body: [
      "One floor down, the idea becomes a team. Eight people run Caldova Client Operations: the Superannuation Team at the front, the Wealth Management Team behind them, and Theo leading both.",
      "They talk to members and advisers, weigh the evidence and make the calls. Every request follows one lifecycle: Request, Verify, Assess, Action, Confirm.",
    ],
    hint: "Click a person to meet them, then follow them down to their agent.",
    accent: "#ff8f6b",
    mode: { kind: "focus", level: "people" },
    shot: { target: [0, 7, -2.5], radius: 56, alpha: -1.02, beta: 0.88 },
  },
  {
    id: "agents",
    chapter: "Chapter 3",
    floor: "1",
    kicker: "Level 1 · Microsoft Foundry agents",
    title: "The agents",
    body: [
      "Directly under each desk sits that person’s AI agent: a Microsoft Foundry agent with two specialised assistants. Cara also has a voice agent.",
      "Agents read forms, check the rules, calculate, draft and recommend. They all work on one shared Member Case in the middle of the floor, and they report back to their human, who decides.",
    ],
    hint: "Click an agent to see its assistants and tools, or follow it down to the engine room.",
    accent: "#5ce1ff",
    mode: { kind: "focus", level: "agents" },
    shot: { target: [0, 1.5, -2.5], radius: 56, alpha: -1.02, beta: 0.88 },
  },
  {
    id: "engine",
    chapter: "Chapter 4",
    floor: "B",
    kicker: "Lower level · Infrastructure and network",
    title: "The engine room",
    body: [
      "Below the waterline is the platform. Microsoft Foundry hosts the agents and the gpt-5.4 model. Azure AI Search grounds every answer in the wealth_knowledge index, and MCP tools let agents act on systems.",
      "Microsoft Teams carries approvals back to people. Entra ID, Key Vault and Application Insights keep it secure and observable, and every connection runs over HTTPS.",
    ],
    hint: "Click a component to see which agents depend on it and how it is secured.",
    accent: "#a78bfa",
    mode: { kind: "focus", level: "engine" },
    shot: { target: [0, -4.6, -3], radius: 54, alpha: -1.02, beta: 0.84 },
  },
  {
    id: "finale",
    chapter: "Finale",
    floor: "⇅",
    kicker: "All four levels",
    title: "One request, top to bottom",
    body: [
      "Now watch a real request travel through the house. Each step starts with a person, dips down to their agent and the engine room, and comes back up for a human decision. The result rises to the top floor, where Maya’s idea is measured.",
    ],
    hint: "Pick a member to replay their request. Pause or skip at any time.",
    accent: "#ffc35a",
    mode: { kind: "exploded" },
    shot: { target: [0, 17, -2], radius: 122, alpha: -0.98, beta: 1.12 },
  },
];

export function pageIndex(id: PageId): number {
  return PAGES.findIndex((p) => p.id === id);
}
