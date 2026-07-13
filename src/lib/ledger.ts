/*
 * Pure credit-ledger and resource math (Phase 2). Kept free of DB/Clerk imports
 * so it's unit-testable in isolation — the roadmap calls out the credit/stat
 * ledger as logic that's expensive to get wrong silently, so its rules live
 * here behind tests (lib/ledger.test.ts) and the server actions only
 * orchestrate I/O.
 */
import { METERS_PER_EP } from "./game-rules";

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export const MAX_CREDITS = 100_000_000; // sanity ceiling; guards fat-fingered deltas

/**
 * Validates a credit adjustment against the current balance and returns the new
 * balance. Delta must be a non-zero integer; the result may not go negative
 * (an operator can't owe the treasury) nor exceed MAX_CREDITS.
 */
export function applyCreditsDelta(current: number, delta: number): Result<number> {
  if (!Number.isInteger(delta)) {
    return { ok: false, error: "Amount must be a whole number." };
  }
  if (delta === 0) {
    return { ok: false, error: "Amount must not be zero." };
  }
  const next = current + delta;
  if (next < 0) {
    return {
      ok: false,
      error: `Adjustment would overdraw the account (balance ${current}, change ${delta}).`,
    };
  }
  if (next > MAX_CREDITS) {
    return { ok: false, error: "Adjustment exceeds the maximum balance." };
  }
  return { ok: true, value: next };
}

/**
 * Validates a level-1 attribute point-buy: every value a non-negative integer,
 * summing to exactly `budget`. Returns the values on success. Enforced on submit
 * so a tampered client can't over-allocate.
 */
export function validateAttributeAllocation(
  values: number[],
  budget: number,
): Result<number[]> {
  if (values.some((v) => !Number.isInteger(v) || v < 0)) {
    return { ok: false, error: "Each attribute must be a whole number ≥ 0." };
  }
  const total = values.reduce((sum, v) => sum + v, 0);
  if (total !== budget) {
    return {
      ok: false,
      error: `Allocate exactly ${budget} points (you used ${total}).`,
    };
  }
  return { ok: true, value: values };
}

export const MAX_XP = 100_000_000; // sanity ceiling, mirrors MAX_CREDITS

/**
 * Applies an admin XP grant. Grants are additive-only (never negative) — Total
 * XP is cumulative and must never decrease, so a "correction" is a fresh
 * reversing grant recorded in the ledger, not a negative amount here. Currency
 * XP rises by the same amount since a grant is newly-earned spendable XP.
 */
export function applyXpGrant(
  totalXp: number,
  currencyXp: number,
  amount: number,
): Result<{ totalXp: number; currencyXp: number }> {
  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, error: "Amount must be a whole number greater than zero." };
  }
  const nextTotal = totalXp + amount;
  if (nextTotal > MAX_XP) {
    return { ok: false, error: "Grant would exceed the maximum XP total." };
  }
  return { ok: true, value: { totalXp: nextTotal, currencyXp: currencyXp + amount } };
}

/**
 * Validates a Currency XP spend (Phase 6 facility XP offerings) against the
 * current balance — the debit-only counterpart to applyXpGrant. Touches only
 * Currency XP; Total XP never decreases, so a spend is never "corrected" by
 * going negative here, only by a fresh admin grant.
 */
export function applyXpSpend(currencyXp: number, cost: number): Result<number> {
  if (!Number.isInteger(cost) || cost <= 0) {
    return { ok: false, error: "This offering has no valid XP cost." };
  }
  const next = currencyXp - cost;
  if (next < 0) {
    return {
      ok: false,
      error: `Not enough Currency XP (balance ${currencyXp}, cost ${cost}).`,
    };
  }
  return { ok: true, value: next };
}

/** Clamps a resource's current value into [0, max]. Used for HP/Energy/Ammo. */
export function clampResource(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  const m = Math.max(0, Math.floor(max));
  return Math.max(0, Math.min(m, Math.floor(value)));
}

/** Floors Temp HP at 0 with no ceiling — unlike clampResource, a player may
 *  set any amount of temporary HP a source grants them. */
export function clampTempHp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

/** Moves current HP by the same delta as max HP, preserving the amount of
 * damage already taken. For example, 9/13 becomes 10/14, while 13/13 becomes
 * 14/14. The result is clamped for max reductions. */
export function adjustCurrentForMaxChange(
  current: number,
  previousMax: number,
  nextMax: number,
): number {
  return clampResource(current + (nextMax - previousMax), nextMax);
}

/** +2 max HP per point of Resilience (info/galvanism_prep.md's "Bonus HP"
 *  rule). Computed, never stored on its own — folded into hpMax wherever the
 *  effective max is assembled, same convention as the card resource_modifier
 *  deltas it sits alongside. */
export function resilienceHpBonus(resilience: number): number {
  return Math.max(0, Math.floor(resilience)) * 2;
}

/** +1 base movement per 2 points of Agility. Computed, never stored on its
 *  own — folded into movementBase before it feeds {@link movementMeters}. */
export function agilityMovementBonus(agility: number): number {
  return Math.floor(Math.max(0, Math.floor(agility)) / 2);
}

/** Effective movement in meters: a free base plus METERS_PER_EP per Energy
 *  point currently committed to it. Computed, never stored on its own. */
export function movementMeters(base: number, epSpent: number): number {
  const b = Math.max(0, Math.floor(base));
  const spent = Math.max(0, Math.floor(epSpent));
  return b + METERS_PER_EP * spent;
}

/**
 * Clamps how much Energy is committed to movement so it never exceeds what's
 * actually available: `energyCurrent + spent` must not exceed `energyMax`.
 * Also floors at 0. Used both by the player's live resource tracker and the
 * admin sheet, same "server clamps, client re-baselines" convention as
 * {@link clampResource}.
 */
export function clampMovementSpend(
  spent: number,
  energyCurrent: number,
  energyMax: number,
): number {
  const s = Math.max(0, Math.floor(Number.isFinite(spent) ? spent : 0));
  const current = Math.max(0, Math.floor(Number.isFinite(energyCurrent) ? energyCurrent : 0));
  const max = Math.max(0, Math.floor(energyMax));
  return Math.max(0, Math.min(s, max - current));
}

/**
 * Parses a signed integer from free-form form input (e.g. "+400", "-60", "300").
 * Rejects blanks, non-numerics, and decimals so a bad field never silently
 * becomes 0 and corrupts a balance.
 */
export function parseSignedInt(raw: unknown): Result<number> {
  const s = String(raw ?? "").trim().replace(/^\+/, "");
  if (s === "" || s === "-") return { ok: false, error: "Enter an amount." };
  if (!/^-?\d+$/.test(s)) {
    return { ok: false, error: "Enter a whole number (no decimals)." };
  }
  return { ok: true, value: Number(s) };
}
