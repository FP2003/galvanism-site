import type { Character } from "./schema";

/*
 * Shared character-status presentation (Phase 2). One source of truth for the
 * status→tone/label maps and the attribute metadata, consumed by the roster list,
 * the Case File, the admin sheet, and the command dashboard so they never drift.
 */
export type CharacterStatus = Character["status"]; // active | standby | injured | kia

export const CHARACTER_STATUSES: CharacterStatus[] = [
  "active",
  "standby",
  "injured",
  "kia",
];

// Dot/label tone for list + dashboard rows.
export const statusTone: Record<CharacterStatus, "live" | "critical" | "neutral"> =
  {
    active: "live",
    standby: "neutral",
    injured: "critical",
    kia: "critical",
  };

export const statusWord: Record<CharacterStatus, string> = {
  active: "Active",
  standby: "Standby",
  injured: "Injured",
  kia: "K.I.A.",
};

// Stamp styling for the Case File classification band.
export const stampStyle: Record<CharacterStatus, string> = {
  active: "bg-signal-cyan text-void-navy",
  standby: "bg-elevated-ledger text-muted-ink",
  injured: "bg-stamp-red text-case-file-white",
  kia: "bg-stamp-red text-case-file-white",
};

export const stampWord: Record<CharacterStatus, string> = {
  active: "Active Duty",
  standby: "Standby",
  injured: "Med Hold",
  kia: "K.I.A.",
};

// The six attributes, split into the Combat / Passive groups the Case File shows.
// `key` matches the `stat*` columns via the mapper in lib/characters.ts.
export const combatStats = [
  { key: "tech", label: "Tech", note: "ATK / DEF modifier" },
  { key: "precision", label: "Precision", note: "Melee + ranged accuracy" },
  { key: "strength", label: "Strength", note: "Melee bonus damage" },
] as const;

export const passiveStats = [
  { key: "immunity", label: "Immunity", note: "Resist mod-card rebuke", suffix: "%" },
  { key: "resilience", label: "Resilience", note: "Condition resist / +HP" },
  { key: "agility", label: "Agility", note: "Melee DEF rolls" },
] as const;

export type StatKey =
  | (typeof combatStats)[number]["key"]
  | (typeof passiveStats)[number]["key"];
