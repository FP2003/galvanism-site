/*
 * Pure gold-ledger and resource math (Phase 2). Kept free of DB/Clerk imports so
 * it's unit-testable in isolation — the roadmap calls out the gold/stat ledger as
 * logic that's expensive to get wrong silently, so its rules live here behind
 * tests (lib/ledger.test.ts) and the server actions only orchestrate I/O.
 */

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export const MAX_GOLD = 100_000_000; // sanity ceiling; guards fat-fingered deltas

/**
 * Validates a gold adjustment against the current balance and returns the new
 * balance. Delta must be a non-zero integer; the result may not go negative
 * (an operator can't owe the treasury) nor exceed MAX_GOLD.
 */
export function applyGoldDelta(current: number, delta: number): Result<number> {
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
  if (next > MAX_GOLD) {
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

/** Clamps a resource's current value into [0, max]. Used for HP/Energy/Ammo. */
export function clampResource(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  const m = Math.max(0, Math.floor(max));
  return Math.max(0, Math.min(m, Math.floor(value)));
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
