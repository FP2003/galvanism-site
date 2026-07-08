/*
 * Pure mission math (Phase 5). Kept free of DB/Clerk imports, same convention
 * as lib/ledger.ts and lib/shops.ts, so the payout split and the Urgent
 * countdown — both called out in info/roadmap.md as logic worth testing — are
 * unit-testable in isolation (lib/missions.test.ts).
 */

/**
 * Splits a mission's total payout evenly across its assigned operators.
 * Floor-divides; any remainder from an uneven split is dropped rather than
 * distributed, same "acceptable soft imprecision" spirit as the shop restock
 * tick's non-transactional cross-row writes. Caller is responsible for
 * rejecting `operatorCount <= 0` before calling.
 */
export function splitPayoutEvenly(
  totalCredits: number,
  operatorCount: number,
): { perOperator: number; remainder: number } {
  const perOperator = Math.floor(totalCredits / operatorCount);
  const remainder = totalCredits - perOperator * operatorCount;
  return { perOperator, remainder };
}

/**
 * Decrements an Urgent mission's deadline by one op (another mission
 * completing). Hitting zero or below means the mission auto-fails without
 * ever having been completed. The mission that is itself completing is
 * excluded from this tick by the caller, so a deadline of 1 succeeds rather
 * than failing when that mission finishes on time.
 */
export function tickUrgentDeadline(deadline: number): {
  nextDeadline: number;
  failed: boolean;
} {
  const nextDeadline = deadline - 1;
  return { nextDeadline, failed: nextDeadline <= 0 };
}
