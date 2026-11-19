/**
 * Visual palettes & style options for the voxel cast.
 *
 * Each entry maps to a persona in `personaData.ts` (staff and clients of
 * Caldova Wealth Client Operations). Style options
 * (hair, glasses, beard, lower body shape, etc.) let the simple block
 * character read as a distinct individual — inspired by Mojang-style
 * voxel character packs.
 */

export type HairStyle =
  | "short"
  | "afro"
  | "ponytail"
  | "bun"
  | "bald"
  | "cap"
  | "hat"
  | "hood"
  | "crown"
  | "beanie"
  | "long";

export type FacialHair = "none" | "stubble" | "beard" | "moustache";

export type LowerBody = "pants" | "skirt" | "dress";

export interface VoxelCharacterPalette {
  /** Skin tone (face, hands). */
  skin: string;
  /** Hair / hat / hood color. */
  hair: string;
  /** Torso + arm color. */
  shirt: string;
  /** Pants / skirt / dress color. */
  pants: string;
  /** Shoe color. */
  shoes: string;
  /** Optional accent color used for tie / scarf / shirt logo / hat band. */
  accent?: string;
  /** Hair / headwear shape. Defaults to "short". */
  hairStyle?: HairStyle;
  /** Optional facial hair. */
  facial?: FacialHair;
  /** Render glasses on the face. */
  glasses?: boolean;
  /** Lower body shape. Defaults to "pants". */
  lowerBody?: LowerBody;
  /** Draw a small accent square logo on the chest. */
  shirtLogo?: boolean;
  /** Eye color. Defaults to dark brown. */
  eye?: string;
}

export const PALETTES: Record<string, VoxelCharacterPalette> = {
  // ----- Clients (one per scripted scenario in personaData.ts) -----
  // Priya Natarajan (34) — new job at a Docklands fintech; young
  // professional in a smart blue blazer with a ponytail.
  customerOnboarding: {
    skin: "#c68e6a", hair: "#1a1410", shirt: "#3a8fd6", pants: "#2a3344",
    shoes: "#1a1a1a", accent: "#ffd166", hairStyle: "ponytail",
  },
  // Grace Williams (63) — retired school principal travelling in Italy;
  // grey bun, cardigan and a bright travel scarf.
  customerProtection: {
    skin: "#f3c79b", hair: "#c9c6c0", shirt: "#5a7fa8", pants: "#3a3a44",
    shoes: "#3a2a20", accent: "#e8a33d", hairStyle: "bun", lowerBody: "skirt",
  },
  // George Papadopoulos (66) — retired electrical contractor; grey hair,
  // glasses, moustache and his favourite mustard polo.
  customerRetirement: {
    skin: "#d9a37e", hair: "#bdbab4", shirt: "#d9a03a", pants: "#2d3344",
    shoes: "#3a2a20", hairStyle: "short", glasses: true, facial: "moustache",
  },
  // Tom Bradley (47) — former Lygon St café owner; beanie and beard.
  customerHardship: {
    skin: "#f5d2b3", hair: "#7a5a3a", shirt: "#6f8f6a", pants: "#2a3344",
    shoes: "#1a1a1a", accent: "#e8e2d6", hairStyle: "beanie", facial: "beard",
  },
  // Robert Chen (52) — acting for the family after his mother's death;
  // quiet, dark formal suit, glasses.
  customerBereavement: {
    skin: "#e8c69a", hair: "#1f1a18", shirt: "#33353f", pants: "#1c1c22",
    shoes: "#1a1a1a", accent: "#22252e", hairStyle: "short", glasses: true,
  },

  // ----- Staff (Caldova Client Operations team) -----
  // Staff shirts are deliberately matched to each department's accent
  // colour (see `cubicles` in officeScene.ts and the canon accents) so each
  // role reads visually with their department zone at a glance.
  // Olivia — Onboarding & Requests Officer (onboarding sky-blue cubicle)
  onboardingOfficer: {
    skin: "#f3c79b", hair: "#3a2418", shirt: "#0ea5e9", pants: "#1e3a5f",
    shoes: "#1a1a1a", accent: "#ffd166", hairStyle: "ponytail",
    lowerBody: "dress",
  },
  // Ben — Benefits & Eligibility Assessor (benefits indigo cubicle)
  benefitsAssessor: {
    skin: "#e8b48a", hair: "#1a1a1a", shirt: "#6366f1", pants: "#2d3344",
    shoes: "#1a1a1a", accent: "#1c2230", hairStyle: "short", glasses: true,
    shirtLogo: true,
  },
  // Ivy — Investment Analyst (investments amber cubicle); Wealth Management
  // Team look: tailored navy trousers with a gold-trimmed amber blouse.
  investmentAnalyst: {
    skin: "#d9a37e", hair: "#2d1a10", shirt: "#f59e0b", pants: "#1f2d4a",
    shoes: "#1a1a1a", accent: "#c9a14a", hairStyle: "bun",
  },
  // Felix — Financial Crime Investigator (financial-crime red cubicle)
  finCrimeInvestigator: {
    skin: "#e8b48a", hair: "#1a1a1a", shirt: "#ef4444", pants: "#1c2230",
    shoes: "#1a1a1a", accent: "#1c2230", hairStyle: "short", facial: "stubble",
  },
  // Rory — Transfers & Rollovers Coordinator (transfers emerald cubicle)
  transfersCoord: {
    skin: "#f3c79b", hair: "#b5562a", shirt: "#10b981", pants: "#3a3a44",
    shoes: "#1a1a1a", accent: "#ffffff", hairStyle: "short", shirtLogo: true,
  },
  // Penny — Payments Officer (payments purple cubicle)
  paymentsOfficer: {
    skin: "#f5d2b3", hair: "#6a3a1e", shirt: "#a855f7", pants: "#2a2440",
    shoes: "#1a1a1a", accent: "#ffd166", hairStyle: "long", lowerBody: "skirt",
  },
  // Cara — Client Communications Specialist (comms pink cubicle); Wealth
  // Management Team look: pink blouse with a navy skirt and gold accent.
  commsSpecialist: {
    skin: "#8d5a3b", hair: "#1a1410", shirt: "#ec4899", pants: "#1f2d4a",
    shoes: "#1a1a1a", accent: "#c9a14a", hairStyle: "afro", lowerBody: "skirt",
  },
  // Theo — Client Operations Team Leader: navy suit, gold tie, beard.
  teamLeader: {
    skin: "#e8b48a", hair: "#5a4a35", shirt: "#26324f", pants: "#1c2438",
    shoes: "#1a1a1a", accent: "#c9a14a", hairStyle: "short", facial: "beard",
    shirtLogo: true,
  },

  // ----- Ambient lobby cast (visual-only background staff) -----
  // Reception greeter — front-of-house in the lobby, smart navy dress,
  // long hair, friendly accent scarf. Distinct from onboardingOfficer so
  // the two read as different roles when visible together.
  receptionGreeter: {
    skin: "#f0c8a4", hair: "#2a1a12", shirt: "#2a3a5c", pants: "#2a3a5c",
    shoes: "#1a1a1a", accent: "#ffd166", hairStyle: "long",
    lowerBody: "dress", shirtLogo: true,
  },
  // Cleaner — teal cleaner's smock, hair tied up in a bun, sturdy shoes.
  cleaner: {
    skin: "#e8b48a", hair: "#3a2418", shirt: "#2e8a6e", pants: "#3a3a44",
    shoes: "#5a3a25", accent: "#ffd166", hairStyle: "bun",
  },
  // Parcel courier — brown delivery uniform, cap, short beard.
  parcelCourier: {
    skin: "#d9a37e", hair: "#3a2418", shirt: "#7a4f2a", pants: "#3a2a20",
    shoes: "#1a1a1a", accent: "#ffb347", hairStyle: "cap", facial: "beard",
    shirtLogo: true,
  },

  // ----- Ambient Melbourne street cast (neighbourhood pedestrians) -----
  // CBD commuter — charcoal suit, glasses, red tie.
  cityCommuter: {
    skin: "#e8c69a", hair: "#2a2420", shirt: "#3a4150", pants: "#22252e",
    shoes: "#1a1a1a", accent: "#c44a3a", hairStyle: "short", glasses: true,
  },
  // Uni student — oversized hoodie, hood up.
  cityStudent: {
    skin: "#c68e6a", hair: "#4a5a7a", shirt: "#4a5a7a", pants: "#2d3344",
    shoes: "#f4f0e6", hairStyle: "hood",
  },
  // Weekend jogger — bright running top, cap, black shorts.
  cityJogger: {
    skin: "#f5d2b3", hair: "#c8a050", shirt: "#f59e0b", pants: "#1c1c22",
    shoes: "#f4f0e6", accent: "#1c2230", hairStyle: "cap",
  },
};
