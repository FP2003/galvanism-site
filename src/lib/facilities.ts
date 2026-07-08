/*
 * Pure shop logic (Phase 4). No DB/Clerk/React imports so it's unit-testable in
 * isolation, same rationale as lib/ledger.ts/lib/cards.ts — the weighted
 * restock draw and the credit-debit purchase are exactly the kind of logic
 * that's expensive to get wrong silently. Server actions and DB helpers
 * (lib/shop-data.ts) only orchestrate I/O around these functions.
 */
import type { Result } from "./ledger";
import type { CardCategory } from "./cards";

/** Validates a shop purchase: price must be a positive integer and the buyer
 *  must be able to afford it. Returns the buyer's new credit balance. */
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
