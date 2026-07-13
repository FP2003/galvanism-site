/*
 * Pure facility logic (Phase 6, absorbing Phase 4's shop logic). No DB/Clerk/
 * React imports so it's unit-testable in isolation, same rationale as
 * lib/ledger.ts/lib/cards.ts — the weighted restock draw, the credit-debit
 * purchase, and the XP-offering math are exactly the kind of logic that's
 * expensive to get wrong silently. Server actions and DB helpers
 * (lib/facility-data.ts) only orchestrate I/O around these functions.
 */
import { clampResource, type Result } from "./ledger";
import type { facilityKind, xpOfferingType } from "./schema";
import { STAT_TARGETS, type CardCategory } from "./cards";

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

/** Validates a donation toward a facility's next-level cost — same shape as
 *  applyPurchase (positive integer, must be affordable). */
export function applyLevelDonation(currentCredits: number, amount: number): Result<number> {
  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, error: "Enter a whole number of credits greater than zero." };
  }
  const next = currentCredits - amount;
  if (next < 0) {
    return {
      ok: false,
      error: `Not enough credits (balance ${currentCredits}, donation ${amount}).`,
    };
  }
  return { ok: true, value: next };
}

export type FacilityListingState = "available" | "owned" | "bought";

/**
 * Player-facing state for one appearance of a card in facility stock. The
 * buyer sees their claimed listing as Owned; everyone else sees it as Bought
 * until restock clears `purchasedByCharacterId`.
 */
export function facilityListingState(
  purchasedByCharacterId: string | null,
  viewerCharacterId: string,
): FacilityListingState {
  if (purchasedByCharacterId == null) return "available";
  return purchasedByCharacterId === viewerCharacterId ? "owned" : "bought";
}

export interface RestockRule {
  id: string;
  category: CardCategory;
  level: number;
  weight: number;
}

export interface EligibleCard {
  id: string;
  category: CardCategory;
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

/**
 * Plans a shop restock: for each of `slotCount` slots, weighted-picks a rule
 * then uniformly picks one eligible card matching that rule's (category,
 * level) that isn't already listed (or picked by an earlier slot in this
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
      (c) => c.category === rule.category && c.level === rule.level && !excluded.has(c.id),
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
// XP offerings (Step 2). A facility's training catalog: each entry is either
// a permanent stat bump (priced in Currency XP) or a one-off current-resource
// refill (priced in Credits, like any other facility purchase). `targetKey`
// matches a `characters` DB column, same convention as cardEffects.effectTarget
// (lib/cards.ts) — reusing STAT_TARGETS for the bump side keeps the two
// catalogs' stat keys/labels in lockstep.
// ---------------------------------------------------------------------------
export type XpOfferingType = (typeof xpOfferingType.enumValues)[number];
export const XP_OFFERING_TYPES: XpOfferingType[] = ["stat_bump", "resource_refill"];

export type OfferingCurrency = "xp" | "credits";

/** The currency an offering's `cost` is charged in — fixed by its type, not a
 *  per-row choice: permanent training costs XP, a resource top-up costs
 *  Credits like any other facility purchase. */
export function offeringCostCurrency(type: XpOfferingType): OfferingCurrency {
  return type === "stat_bump" ? "xp" : "credits";
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

export function offeringTargetsFor(type: XpOfferingType): OfferingTarget[] {
  return type === "stat_bump" ? STAT_BUMP_TARGETS : RESOURCE_REFILL_TARGETS;
}

export function isValidOfferingTarget(type: XpOfferingType, targetKey: string): boolean {
  return offeringTargetsFor(type).some((t) => t.key === targetKey);
}

export function offeringTargetLabel(type: XpOfferingType, targetKey: string): string {
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
