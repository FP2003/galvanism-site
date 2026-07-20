/*
 * Pure ability-card equip-slot logic (Phase 8). No DB/React imports so it's
 * unit-testable in isolation (lib/card-slots.test.ts), mirroring lib/cards.ts
 * and lib/weapons.ts's convention.
 *
 * Model: one shared pool of BASE_ABILITY_SLOTS slots for the whole character,
 * usable by any card in a slot-limited category. A category-specific bonus
 * (from facility slot-upgrade purchases and/or an admin override, see
 * lib/card-data.ts getCharacterSlotBonuses) reserves extra slots usable only
 * by that category, on top of the shared pool. Equipping a new card of
 * category X requires BOTH:
 *   (a) per-category cap: equipped[X] + 1 <= BASE + bonus[X] — a category can
 *       never exceed the full shared base plus its own reserved bonus, which
 *       stops a bonus-less category from spending another category's
 *       reserved slots.
 *   (b) aggregate cap: sum(equipped) + 1 <= BASE + sum(bonus) — stops every
 *       category from independently claiming BASE + its own bonus at once,
 *       which would multiply the one shared pool across categories.
 * Neither constraint alone is correct; see card-slots.test.ts for the worked
 * counterexamples proving both are load-bearing.
 */
import type { CardCategory } from "./cards";

export const BASE_ABILITY_SLOTS = 3;

// Deliberately excludes "item" (unlimited, per the feature's requirement)
// and firearm_mod/melee_mod (governed by a weapon's own modSlots capacity,
// lib/weapons.ts) — those never consume an ability-card slot.
export type SlotLimitedCategory = Exclude<CardCategory, "item" | "firearm_mod" | "melee_mod">;

export const SLOT_LIMITED_CATEGORIES: SlotLimitedCategory[] = [
  "combat",
  "defense",
  "mod",
  "movement",
  "resilience",
  "tech",
  "ability",
];

export function isSlotLimitedCategory(c: CardCategory): c is SlotLimitedCategory {
  return (SLOT_LIMITED_CATEGORIES as CardCategory[]).includes(c);
}

export type SlotCountMap = Record<SlotLimitedCategory, number>;

export function emptySlotCountMap(): SlotCountMap {
  const map = {} as SlotCountMap;
  for (const c of SLOT_LIMITED_CATEGORIES) map[c] = 0;
  return map;
}

/** Adds two slot-count maps category-by-category. */
export function mergeSlotCountMaps(a: SlotCountMap, b: SlotCountMap): SlotCountMap {
  const merged = emptySlotCountMap();
  for (const c of SLOT_LIMITED_CATEGORIES) merged[c] = a[c] + b[c];
  return merged;
}

/** The structural shape this module needs from an owned card — mirrors the
 *  relevant slice of lib/card-data.ts's OwnedCard. */
export interface EquipStateFields {
  equipped: boolean;
  card: { category: CardCategory; takesSlot: boolean };
}

/** Tallies currently-equipped cards per slot-limited category. Non-limited
 *  categories (item, firearm_mod, melee_mod), cards flagged `takesSlot:
 *  false` (e.g. flavor cards an admin exempted), and unequipped cards are
 *  all ignored. */
export function tallyEquippedByCategory(owned: EquipStateFields[]): SlotCountMap {
  const tally = emptySlotCountMap();
  for (const o of owned) {
    if (!o.equipped) continue;
    if (!o.card.takesSlot) continue;
    if (!isSlotLimitedCategory(o.card.category)) continue;
    tally[o.card.category] += 1;
  }
  return tally;
}

function sum(map: SlotCountMap): number {
  return SLOT_LIMITED_CATEGORIES.reduce((total, c) => total + map[c], 0);
}

/**
 * Whether one more card of `category` can be equipped, given the character's
 * current equipped tally and bonus-slot map. Categories outside the
 * slot-limited set are always allowed (weapons/items/mods are governed by
 * their own separate systems, not this one), as is any card individually
 * flagged `takesSlot: false` by an admin.
 */
export function canEquipInCategory(
  category: CardCategory,
  equipped: SlotCountMap,
  bonus: SlotCountMap,
  takesSlot: boolean = true,
): boolean {
  if (!takesSlot) return true;
  if (!isSlotLimitedCategory(category)) return true;

  const perCategoryOk = equipped[category] + 1 <= BASE_ABILITY_SLOTS + bonus[category];
  const aggregateOk = sum(equipped) + 1 <= BASE_ABILITY_SLOTS + sum(bonus);
  return perCategoryOk && aggregateOk;
}

export interface CategorySlotUsage {
  category: SlotLimitedCategory;
  used: number;
  bonus: number;
  cap: number;
}

/** Per-category {used, bonus, cap} for display. `cap` is an upper bound, not
 *  a guaranteed allocation — the shared pool is still shared across
 *  categories, see sharedPoolRemaining. */
export function categorySlotUsage(
  equipped: SlotCountMap,
  bonus: SlotCountMap,
): CategorySlotUsage[] {
  return SLOT_LIMITED_CATEGORIES.map((category) => ({
    category,
    used: equipped[category],
    bonus: bonus[category],
    cap: BASE_ABILITY_SLOTS + bonus[category],
  }));
}

/** How much of the single shared pool (BASE_ABILITY_SLOTS, before any
 *  category-reserved bonus) is still unclaimed across all categories. */
export function sharedPoolRemaining(equipped: SlotCountMap, bonus: SlotCountMap): number {
  const totalCap = BASE_ABILITY_SLOTS + sum(bonus);
  return Math.max(0, totalCap - sum(equipped));
}

/**
 * The escalating per-character, per-offering price of a facility slot-upgrade
 * purchase: the base price plus one increment for every prior purchase of
 * this exact offering by this character. `costIncrement` of 0 gives a flat,
 * repeatable price (same as any other XP offering).
 */
export function nextSlotUpgradeCost(
  basePrice: number,
  costIncrement: number,
  priorPurchases: number,
): number {
  return basePrice + costIncrement * Math.max(0, Math.floor(priorPurchases));
}
