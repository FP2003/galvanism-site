/*
 * Pure card logic (Phase 3). No DB/Clerk/React imports so it's unit-testable in
 * isolation — the roadmap calls out the effect builder as logic that's expensive
 * to get wrong silently, so its rules (valid targets, effect summaries, and the
 * effective-stat computation) live here behind tests (lib/cards.test.ts). Server
 * actions and pages only orchestrate I/O around these functions.
 */
import type { Result } from "./ledger";
import type {
  cardCategory,
  cardActivation,
  cardEffectKind,
  cardEffectType,
  cardTrigger,
} from "./schema";

export type CardCategory = (typeof cardCategory.enumValues)[number];
export type CardActivation = (typeof cardActivation.enumValues)[number];
export type CardEffectKind = (typeof cardEffectKind.enumValues)[number];
export type CardEffectType = (typeof cardEffectType.enumValues)[number];
export type CardTrigger = (typeof cardTrigger.enumValues)[number];

// ---------------------------------------------------------------------------
// Category presentation. Colors are the muted "Committed exception" hexes from
// globals.css (@theme) — the on-site cards are deliberately quieter than the
// bright reference PNGs (DESIGN.md). `icon` is a key the GameCard maps to a
// lucide component (kept out of this file so it stays React-free/testable).
// ---------------------------------------------------------------------------
export interface CardCategoryMeta {
  label: string;
  color: string; // hex accent for frame/badge; overridable per card
  icon: string;
}

export const CARD_CATEGORY_META: Record<CardCategory, CardCategoryMeta> = {
  combat: { label: "Combat", color: "#4a3b7a", icon: "combat" },
  defense: { label: "Defense", color: "#34506e", icon: "defense" },
  mod: { label: "Mod", color: "#3f6b4a", icon: "mod" },
  movement: { label: "Movement", color: "#a9691f", icon: "movement" },
  resilience: { label: "Resilience", color: "#7a2942", icon: "resilience" },
  tech: { label: "Tech", color: "#8c3f66", icon: "tech" },
  // Generic cards aren't among DESIGN.md's six sanctioned card hues, so they take
  // the neutral structural Steel Blue token rather than a bespoke color — their
  // title bar ("ABILITY"/"ITEM") does the distinguishing.
  ability: { label: "Ability", color: "#1481ba", icon: "ability" },
  item: { label: "Item", color: "#1481ba", icon: "item" },
};

export const CARD_CATEGORIES = Object.keys(
  CARD_CATEGORY_META,
) as CardCategory[];

/** The accent hex a card renders with: its override, else the category preset. */
export function cardAccent(
  category: CardCategory,
  colorOverride?: string | null,
): string {
  return colorOverride && isHexColor(colorOverride)
    ? colorOverride
    : CARD_CATEGORY_META[category].color;
}

// ---------------------------------------------------------------------------
// Mechanical effect targets. Stat modifiers hit the six attribute columns;
// resource modifiers hit the *max* of a resource (current is player-tracked).
// `key` matches the `characters` DB column so effects sum straight onto base.
// ---------------------------------------------------------------------------
export interface EffectTarget {
  key: string;
  label: string;
  kind: CardEffectType;
}

export const STAT_TARGETS: EffectTarget[] = [
  { key: "statTech", label: "Tech", kind: "stat_modifier" },
  { key: "statPrecision", label: "Precision", kind: "stat_modifier" },
  { key: "statStrength", label: "Strength", kind: "stat_modifier" },
  { key: "statImmunity", label: "Immunity", kind: "stat_modifier" },
  { key: "statResilience", label: "Resilience", kind: "stat_modifier" },
  { key: "statAgility", label: "Agility", kind: "stat_modifier" },
];

export const RESOURCE_TARGETS: EffectTarget[] = [
  { key: "hpMax", label: "Max HP", kind: "resource_modifier" },
  { key: "energyMax", label: "Max Energy", kind: "resource_modifier" },
  { key: "ammoMax", label: "Max Ammo", kind: "resource_modifier" },
];

export const EFFECT_TARGETS: EffectTarget[] = [
  ...STAT_TARGETS,
  ...RESOURCE_TARGETS,
];

export function targetsFor(type: CardEffectType): EffectTarget[] {
  return type === "stat_modifier" ? STAT_TARGETS : RESOURCE_TARGETS;
}

export function targetLabel(key: string): string {
  return EFFECT_TARGETS.find((t) => t.key === key)?.label ?? key;
}

export const TRIGGER_LABELS: Record<CardTrigger, string> = {
  on_equip: "On equip",
  on_use: "On use",
  passive: "Passive",
};

export const CARD_TEXT_LIMITS = {
  title: 48,
  description: 400,
  descriptiveText: 600,
  levelMax: 20,
  effectAmountAbs: 999,
} as const;

// ---------------------------------------------------------------------------
// Roman numerals for the level pip (I, II, III…). Levels are small; this covers
// well past any realistic card level and clamps out-of-range input safely.
// ---------------------------------------------------------------------------
const ROMAN: [number, string][] = [
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

export function toRoman(n: number): string {
  let value = Math.max(1, Math.min(CARD_TEXT_LIMITS.levelMax, Math.floor(n)));
  let out = "";
  for (const [num, sym] of ROMAN) {
    while (value >= num) {
      out += sym;
      value -= num;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Effect summaries + effective-stat computation.
// ---------------------------------------------------------------------------

/** The minimal card shape the effect functions need (a subset of the DB row). */
export interface CardEffectFields {
  effectKind: CardEffectKind;
  effectType: CardEffectType | null;
  effectTarget: string | null;
  effectAmount: number | null;
  trigger: CardTrigger | null;
}

/** e.g. "+1 Tech" / "−10 Immunity". Null for descriptive or incomplete cards. */
export function effectSummary(card: CardEffectFields): string | null {
  if (card.effectKind !== "mechanical") return null;
  if (card.effectAmount == null || !card.effectTarget) return null;
  const sign = card.effectAmount >= 0 ? "+" : "−";
  return `${sign}${Math.abs(card.effectAmount)} ${targetLabel(card.effectTarget)}`;
}

/**
 * Whether a mechanical effect contributes to effective stats *while equipped*.
 * on_equip + passive are persistent buffs; on_use is a momentary, table-side
 * action and never auto-modifies the sheet.
 */
export function isPersistentEffect(card: CardEffectFields): boolean {
  return (
    card.effectKind === "mechanical" &&
    card.effectAmount != null &&
    !!card.effectTarget &&
    (card.trigger === "on_equip" || card.trigger === "passive")
  );
}

export interface Modifier {
  target: string;
  amount: number;
}

/**
 * Sums the persistent modifiers from a set of *equipped* cards into a
 * per-target delta map. Callers pass only equipped cards; on_use and descriptive
 * cards are filtered out here.
 */
export function accumulateModifiers(equipped: CardEffectFields[]): Modifier[] {
  const totals = new Map<string, number>();
  for (const card of equipped) {
    if (!isPersistentEffect(card)) continue;
    totals.set(
      card.effectTarget!,
      (totals.get(card.effectTarget!) ?? 0) + card.effectAmount!,
    );
  }
  return [...totals].map(([target, amount]) => ({ target, amount }));
}

/**
 * Applies modifiers onto a base map (character column → value) and returns the
 * effective values plus the applied deltas. Base is never mutated. A resource
 * max can't be driven below zero by a negative card.
 */
export function applyModifiers(
  base: Record<string, number>,
  mods: Modifier[],
): { effective: Record<string, number>; deltas: Record<string, number> } {
  const effective = { ...base };
  const deltas: Record<string, number> = {};
  for (const { target, amount } of mods) {
    if (!(target in effective)) continue;
    deltas[target] = (deltas[target] ?? 0) + amount;
    effective[target] = Math.max(0, effective[target] + amount);
  }
  return { effective, deltas };
}

// ---------------------------------------------------------------------------
// Validation (used by the create-card server action; the client can't be
// trusted). Mirrors the two-sided enforcement the rest of the app uses.
// ---------------------------------------------------------------------------
export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

export interface MechanicalInput {
  effectType: CardEffectType;
  effectTarget: string;
  effectAmount: number;
  trigger: CardTrigger;
}

/** Validates the structured effect of a mechanical card. */
export function validateMechanicalEffect(
  input: MechanicalInput,
): Result<MechanicalInput> {
  const allowed = targetsFor(input.effectType).map((t) => t.key);
  if (!allowed.includes(input.effectTarget)) {
    return {
      ok: false,
      error: "Pick a target that matches the chosen effect type.",
    };
  }
  if (!Number.isInteger(input.effectAmount) || input.effectAmount === 0) {
    return { ok: false, error: "Effect amount must be a non-zero whole number." };
  }
  if (Math.abs(input.effectAmount) > CARD_TEXT_LIMITS.effectAmountAbs) {
    return { ok: false, error: "Effect amount is out of range." };
  }
  return { ok: true, value: input };
}
