/*
 * Galvanism character-creation rules (Phase 2, application flow). Central home for
 * the game constants a new level-1 sheet starts from, so the player application
 * form, the submit action, and any future level-up logic agree on one source.
 */

// Fixed starting resources — the player doesn't set these on application.
export const BASE_HP = 12;
export const BASE_ENERGY = 8;
export const BASE_ENERGY_REGEN = 3; // display-only stat, no mechanical logic yet

// Movement: every character gets BASE_MOVEMENT_METERS of free movement, plus
// METERS_PER_EP for every Energy point committed to it (lib/ledger.ts
// movementMeters). movementBase is the per-character DM-set floor (defaults
// to this constant on creation); this constant is not itself stored anywhere.
export const BASE_MOVEMENT_METERS = 6;
export const METERS_PER_EP = 2;

// Immunity is a fixed 100% resist at creation; mod cards reduce it later (Phase 3),
// so it sits outside the point-buy.
export const IMMUNITY_BASE = 100;

// The five attributes a level-1 player distributes points into (Immunity excluded).
export const POINT_BUY_ATTRIBUTES = [
  { key: "statTech", label: "Tech", note: "ATK / DEF modifier" },
  { key: "statPrecision", label: "Precision", note: "Melee + ranged accuracy" },
  { key: "statStrength", label: "Strength", note: "Melee bonus damage" },
  { key: "statResilience", label: "Resilience", note: "Condition resist / +HP" },
  { key: "statAgility", label: "Agility", note: "Melee DEF rolls" },
] as const;

export type PointBuyKey = (typeof POINT_BUY_ATTRIBUTES)[number]["key"];

// Points a level-1 character allocates across the five point-buy attributes.
export const ATTRIBUTE_BUDGET = 6;

// Text-length caps for free-text fields. Enforced twice: as `maxLength` on the
// inputs (stops the layout-breaking / DB-bloating input before it's typed) and
// re-clamped server-side (the client can't be trusted). Headings that render
// these values still guard with `break-words` for any pre-existing long data.
export const TEXT_LIMITS = {
  callsign: 32,
  name: 64,
  rank: 48,
  role: 48,
  bio: 4000,
  ledgerDescription: 140,
  refCode: 32,
  missionTitle: 80,
  missionSector: 48,
  missionBriefing: 4000,
  ballotTitle: 80,
  ballotDescription: 2000,
  ballotOptionLabel: 60,
  registryName: 64,
  registryDescription: 4000,
  registryGmNotes: 4000,
  themeSongUrl: 200,
  themeSongTitle: 120,
} as const;

// Mission briefing photo attachments — bounded gallery, not an open-ended
// media manager. Kept low enough to comfortably clear both Next's
// bodySizeLimit and Vercel's platform-level 4.5MB request ceiling.
export const MAX_MISSION_ATTACHMENTS = 8;
export const MAX_ATTACHMENT_BYTES = 3.5 * 1024 * 1024;
export const ATTACHMENT_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

// Character mini portrait — GIF only (spinning HeroForge render), not the
// broader image set mission attachments accept. Uploaded directly
// browser-to-Blob (see app/api/portrait-upload/route.ts), not through a
// server action, so this cap is NOT bound by Vercel's 4.5MB serverless
// request-body ceiling the way MAX_ATTACHMENT_BYTES is. With ~9 rosters this
// season, the larger cap costs nothing meaningful in storage.
export const MAX_PORTRAIT_BYTES = 20 * 1024 * 1024;
export const PORTRAIT_MIME_TYPES = ["image/gif"] as const;

// A ballot's option list is bounded like mission attachments — a fixed
// admin-authored slate, not an open-ended list.
export const MAX_BALLOT_OPTIONS = 8;
