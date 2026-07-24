/*
 * Pure facility logic (Phase 6, absorbing Phase 4's shop logic). No DB/Clerk/
 * React imports so it's unit-testable in isolation, same rationale as
 * lib/ledger.ts/lib/cards.ts — the weighted restock draw, the credit-debit
 * purchase, and the XP-offering math are exactly the kind of logic that's
 * expensive to get wrong silently. Server actions and DB helpers
 * (lib/facility-data.ts) only orchestrate I/O around these functions.
 */
import { clampResource, type Result } from "./ledger";
import type { facilityKind, xpOfferingType, offeringCurrency } from "./schema";
import { STAT_TARGETS, CARD_CATEGORY_META, type CardCategory, type ItemSubcategory } from "./cards";
import { SLOT_LIMITED_CATEGORIES } from "./card-slots";

export type FacilityKind = (typeof facilityKind.enumValues)[number];
export const FACILITY_KINDS: FacilityKind[] = ["station", "field"];

/** Validates a facility purchase: price must be a positive integer and the
 *  buyer must be able to afford it. Returns the buyer's new credit balance. */
export function applyPurchase(
  currentCredits: number,
  priceCredits: number,
): Result<number> {
  if (!Number.isInteger(priceCredits) || priceCredits <= 0) {
    return { ok: false, error: "This listing has no valid price." };
  }
  const next = currentCredits - priceCredits;
  if (next < 0) {
    return {
      ok: false,
      error: `Not enough credits (balance ${currentCredits}, price ${priceCredits}).`,
    };
  }
  return { ok: true, value: next };
}

/** Validates a contribution toward crowd-funding a facility perk — same
 *  shape as applyPurchase (positive integer, must be affordable). */
export function applyPerkContribution(currentCredits: number, amount: number): Result<number> {
  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, error: "Enter a whole number of credits greater than zero." };
  }
  const next = currentCredits - amount;
  if (next < 0) {
    return {
      ok: false,
      error: `Not enough credits (balance ${currentCredits}, contribution ${amount}).`,
    };
  }
  return { ok: true, value: next };
}

/** True once a perk's pooled contributions have reached its price. */
export function isPerkFunded(totalContributed: number, priceCredits: number): boolean {
  return totalContributed >= priceCredits;
}

export type FacilityListingState = "available" | "owned" | "sold_out";

/** How many units of a listing's stock are still unclaimed. Never negative,
 *  even if a listing's quantityTotal was lowered below its purchase count
 *  (updateListingQuantity guards against that going forward, but this stays
 *  defensive for any row that predates the guard). */
export function facilityListingRemaining(quantityTotal: number, purchaseCount: number): number {
  return Math.max(0, quantityTotal - purchaseCount);
}

/** Player-facing state for one listing. The buyer sees their own claimed
 *  unit as Owned; everyone else sees Available while stock remains, or Sold
 *  Out once every unit is claimed — a restock (or a self-serve refund)
 *  frees units back up. */
export function facilityListingState(
  remaining: number,
  alreadyOwned: boolean,
): FacilityListingState {
  if (alreadyOwned) return "owned";
  return remaining > 0 ? "available" : "sold_out";
}

export interface RestockRule {
  id: string;
  category: CardCategory;
  // Missing/null means the rule draws from every subcategory of `category`
  // (and is always unset when category isn't "item").
  subcategory?: ItemSubcategory | null;
  level: number;
  weight: number;
}

export interface EligibleCard {
  id: string;
  category: CardCategory;
  subcategory?: ItemSubcategory | null;
  level: number;
}

export interface RestockSlotResult {
  slotIndex: number;
  cardId: string | null;
  ruleId: string | null;
}

/** Picks one rule by weight / sum-of-weights. `rng` returns a value in
 *  [0, 1); injectable so restock draws are deterministic under test.
 *  Returns null when every rule has non-positive weight (or there are none). */
export function pickWeightedRule(
  rules: RestockRule[],
  rng: () => number = Math.random,
): RestockRule | null {
  const positive = rules.filter((r) => r.weight > 0);
  const total = positive.reduce((sum, r) => sum + r.weight, 0);
  if (total <= 0) return null;
  let roll = rng() * total;
  for (const rule of positive) {
    if (roll < rule.weight) return rule;
    roll -= rule.weight;
  }
  return positive[positive.length - 1]; // float-rounding fallback
}

/** Uniformly picks one candidate. Returns null when there are none. */
export function pickRandomCard<T>(
  candidates: T[],
  rng: () => number = Math.random,
): T | null {
  if (candidates.length === 0) return null;
  return candidates[Math.min(Math.floor(rng() * candidates.length), candidates.length - 1)];
}

/** Uniformly picks up to `count` distinct candidates without replacement —
 *  the manual "replace with N random cards" admin action's draw. Returns
 *  fewer than `count` if the pool runs out, same honest-partial-fill
 *  convention as planRestock, rather than erroring or padding with repeats. */
export function pickRandomCards<T>(
  candidates: T[],
  count: number,
  rng: () => number = Math.random,
): T[] {
  const pool = [...candidates];
  const picked: T[] = [];
  while (picked.length < count && pool.length > 0) {
    const index = Math.min(Math.floor(rng() * pool.length), pool.length - 1);
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
}

/**
 * Plans a shop restock: for each of `slotCount` slots, weighted-picks a rule
 * then uniformly picks one eligible card matching that rule's (category,
 * subcategory, level) that isn't already listed (or picked by an earlier slot in this
 * same call — `alreadyListedCardIds` is never mutated by the caller, so this
 * function tracks picks internally). A slot whose rule pool has no cards, or
 * for which no rule exists at all, gets `cardId: null` — the caller should
 * leave that slot's existing listing untouched rather than clearing it. Pure
 * and deterministic given a seeded `rng`.
 */
export function planRestock(
  rules: RestockRule[],
  eligibleCards: EligibleCard[],
  alreadyListedCardIds: Iterable<string>,
  slotCount: number,
  rng: () => number = Math.random,
): RestockSlotResult[] {
  const excluded = new Set(alreadyListedCardIds);
  const results: RestockSlotResult[] = [];
  for (let slotIndex = 0; slotIndex < slotCount; slotIndex++) {
    const rule = pickWeightedRule(rules, rng);
    if (!rule) {
      results.push({ slotIndex, cardId: null, ruleId: null });
      continue;
    }
    const candidates = eligibleCards.filter(
      (c) =>
        c.category === rule.category &&
        c.level === rule.level &&
        (rule.subcategory == null || c.subcategory === rule.subcategory) &&
        !excluded.has(c.id),
    );
    const picked = pickRandomCard(candidates, rng);
    if (!picked) {
      results.push({ slotIndex, cardId: null, ruleId: rule.id });
      continue;
    }
    excluded.add(picked.id);
    results.push({ slotIndex, cardId: picked.id, ruleId: rule.id });
  }
  return results;
}

/** True iff a card of `cardLevel` is purchasable/rollable at a facility of
 *  `facilityLevel` — a facility's level is a ceiling, never a floor. */
export function isCardLevelUnlocked(cardLevel: number, facilityLevel: number): boolean {
  return cardLevel <= facilityLevel;
}

// ---------------------------------------------------------------------------
// XP offerings (Step 2). A facility's training catalog: each entry is a
// permanent stat bump (priced in Currency XP), a one-off current-resource
// refill (priced in Credits, like any other facility purchase), a purely
// descriptive entry (touches no character column — the DM manually honors
// the effect, e.g. the Communication Center's "Called Extraction time
// reduction" — priced in either Currency XP or Credits, the admin's choice
// per row, optionally escalating like a slot upgrade), or a slot upgrade
// (priced in Currency XP, grants a reserved ability-card equip slot for a
// specific card category — a real mechanical effect, individually repeatable
// per character at an escalating price, see nextEscalatingOfferingCost
// below). `targetKey` matches a `characters` DB column for
// stat_bump/resource_refill, same convention as cardEffects.effectTarget
// (lib/cards.ts) — reusing STAT_TARGETS for the bump side keeps the two
// catalogs' stat keys/labels in lockstep. For slot_upgrade, `targetKey`
// instead holds a cardCategory value. A descriptive offering has no
// target/amount at all.
// ---------------------------------------------------------------------------
export type XpOfferingType = (typeof xpOfferingType.enumValues)[number];
export const XP_OFFERING_TYPES: XpOfferingType[] = [
  "stat_bump",
  "resource_refill",
  "descriptive",
  "slot_upgrade",
];

export type OfferingCurrency = (typeof offeringCurrency.enumValues)[number];

/** The currency an offering's `cost` is charged in. Fixed by type for
 *  stat_bump/slot_upgrade (XP) and resource_refill (Credits, like any other
 *  facility purchase) — a descriptive offering is the one type where the
 *  admin picks the currency per row, stored on `costCurrency`. */
export function offeringCostCurrency(offering: {
  offeringType: XpOfferingType;
  costCurrency: OfferingCurrency;
}): OfferingCurrency {
  if (offering.offeringType === "resource_refill") return "credits";
  if (offering.offeringType === "descriptive") return offering.costCurrency;
  return "xp";
}

/**
 * The escalating per-character, per-offering price of a repeatable facility
 * offering: the base price plus one increment for every prior purchase of
 * this exact offering by this character. `costIncrement` of 0 gives a flat,
 * repeatable price. Used by both slot_upgrade (tracked via
 * characterSlotPurchases) and descriptive (tracked via
 * characterOfferingPurchases) offerings.
 */
export function nextEscalatingOfferingCost(
  basePrice: number,
  costIncrement: number,
  priorPurchases: number,
): number {
  return basePrice + costIncrement * Math.max(0, Math.floor(priorPurchases));
}

export interface OfferingTarget {
  key: string;
  label: string;
}

export const STAT_BUMP_TARGETS: OfferingTarget[] = STAT_TARGETS.map(({ key, label }) => ({
  key,
  label,
}));

// Current-resource keys, distinct from cards.ts's RESOURCE_TARGETS (which
// target *Max — card effects boost ceilings, not fill the pool). Net-new:
// nothing else in the app treats hpCurrent/energyCurrent/ammoCurrent as a
// selectable target key today.
export const RESOURCE_REFILL_TARGETS: OfferingTarget[] = [
  { key: "hpCurrent", label: "HP" },
  { key: "energyCurrent", label: "Energy" },
  { key: "ammoCurrent", label: "Ammo" },
];

// The card categories a slot-upgrade offering can reserve a slot for — every
// slot-limited category (lib/card-slots.ts), labeled via CARD_CATEGORY_META.
export const SLOT_UPGRADE_TARGETS: OfferingTarget[] = SLOT_LIMITED_CATEGORIES.map((c) => ({
  key: c,
  label: CARD_CATEGORY_META[c].label,
}));

export function offeringTargetsFor(type: XpOfferingType): OfferingTarget[] {
  if (type === "stat_bump") return STAT_BUMP_TARGETS;
  if (type === "resource_refill") return RESOURCE_REFILL_TARGETS;
  if (type === "slot_upgrade") return SLOT_UPGRADE_TARGETS;
  return [];
}

/** A descriptive offering has no target column to validate — `targetKey` is
 *  always the empty string for it. */
export function isValidOfferingTarget(type: XpOfferingType, targetKey: string): boolean {
  if (type === "descriptive") return targetKey === "";
  return offeringTargetsFor(type).some((t) => t.key === targetKey);
}

export function offeringTargetLabel(type: XpOfferingType, targetKey: string): string {
  if (type === "descriptive") return "";
  return offeringTargetsFor(type).find((t) => t.key === targetKey)?.label ?? targetKey;
}

/** Permanent stat bump: a straight, uncapped addition onto a base stat —
 *  mirrors how admin stat edits (app/admin/actions.ts) have no upper ceiling. */
export function applyStatBump(current: number, amount: number): number {
  return current + amount;
}

/** One-off current-resource refill, clamped to (possibly card-boosted) max —
 *  delegates to the same clampResource used by resource-tracking edits. */
export function applyResourceRefill(current: number, max: number, amount: number): number {
  return clampResource(current + amount, max);
}
