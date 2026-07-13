/*
 * Pure mission math (Phase 5). Kept free of DB/Clerk imports, same convention
 * as lib/ledger.ts and lib/facilities.ts, so the payout split and the Urgent
 * countdown — both called out in info/roadmap.md as logic worth testing — are
 * unit-testable in isolation (lib/missions.test.ts).
 */

/**
 * Splits a mission's total payout evenly across its assigned operators.
 * Floor-divides; any remainder from an uneven split is dropped rather than
 * distributed, same "acceptable soft imprecision" spirit as the facility restock
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

export type MissionStatusBucket = "incomplete" | "complete" | "failed";

/**
 * Groups a mission's raw status into the three buckets shown in the
 * All/Incomplete/Complete/Failed filter (available and active both read as
 * "incomplete" — still open, regardless of whether work has started).
 */
export function missionBucket(status: string): MissionStatusBucket {
  if (status === "complete") return "complete";
  if (status === "failed") return "failed";
  return "incomplete";
}

/**
 * Groups an assignment list's callsigns by state, alphabetically sorted
 * within each group — same aggregation shape as lib/ballots.ts's
 * votersByOption, reused here so the player-facing mission tab can show who
 * else has marked interest (or been assigned) alongside the admin view.
 */
export function callsignsByState(
  assignments: { state: "interested" | "assigned"; character: { callsign: string } }[],
): { interested: string[]; assigned: string[] } {
  const interested: string[] = [];
  const assigned: string[] = [];
  for (const a of assignments) {
    (a.state === "interested" ? interested : assigned).push(a.character.callsign);
  }
  interested.sort((a, b) => a.localeCompare(b));
  assigned.sort((a, b) => a.localeCompare(b));
  return { interested, assigned };
}

/**
 * Deterministic "stapled photo" tilt angle for a mission attachment, derived
 * from its id — same id always produces the same angle, so the gallery's
 * server-rendered tilt matches the client on hydration (no Math.random). The
 * magnitude is kept in 2..6deg so every photo visibly reads as tilted, sign
 * alternates by hash parity so adjacent photos don't cluster on one side.
 */
export function attachmentTiltDeg(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  const magnitude = 2 + (Math.abs(hash) % 5);
  return hash % 2 === 0 ? magnitude : -magnitude;
}
