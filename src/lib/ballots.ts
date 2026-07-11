/*
 * Pure ballot math (Phase 7). Kept free of DB/Clerk imports, same convention
 * as lib/missions.ts and lib/facilities.ts, so vote tallying and the ops
 * countdown — both called out in info/roadmap.md as logic worth testing —
 * are unit-testable in isolation (lib/ballots.test.ts).
 */

/**
 * Decrements a ballot's ops deadline by one op (a mission completing).
 * Deliberately not a reuse of missions.ts's tickUrgentDeadline — that models
 * mission failure, a different concept from a ballot simply closing for
 * display, and duplicating this 5-line pure function keeps each phase's lib
 * file self-contained. Hitting zero or below just means the ballot
 * auto-closes; there is no failure state here.
 */
export function tickBallotDeadline(deadline: number): {
  nextDeadline: number;
  closed: boolean;
} {
  const nextDeadline = deadline - 1;
  return { nextDeadline, closed: nextDeadline <= 0 };
}

export interface BallotOptionInput {
  id: string;
  label: string;
}

export interface BallotOptionTally {
  optionId: string;
  label: string;
  votes: number;
  pct: number;
}

/**
 * Tallies one vote per character across a ballot's options. Pure aggregation
 * over already-fetched rows — the caller (lib/ballot-data.ts) owns the query.
 * Options with zero votes still appear in the result (pct 0), so the tally UI
 * never has to special-case an unpicked option.
 */
export function tallyVotes(
  options: BallotOptionInput[],
  votes: { optionId: string }[],
): { totalVotes: number; results: BallotOptionTally[] } {
  const counts = new Map<string, number>();
  for (const o of options) counts.set(o.id, 0);
  for (const v of votes) counts.set(v.optionId, (counts.get(v.optionId) ?? 0) + 1);

  const totalVotes = votes.length;
  const results = options.map((o) => {
    const voteCount = counts.get(o.id) ?? 0;
    const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
    return { optionId: o.id, label: o.label, votes: voteCount, pct };
  });
  return { totalVotes, results };
}

/**
 * Groups voter callsigns by the option they picked, so the tally UI can show
 * who voted for what alongside the counts from tallyVotes. Options with no
 * votes still get an (empty) entry, mirroring tallyVotes's convention.
 */
export function votersByOption(
  options: BallotOptionInput[],
  votes: { optionId: string; callsign: string }[],
): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};
  for (const o of options) grouped[o.id] = [];
  for (const v of votes) {
    grouped[v.optionId]?.push(v.callsign);
  }
  for (const callsigns of Object.values(grouped)) callsigns.sort((a, b) => a.localeCompare(b));
  return grouped;
}

/**
 * The option id(s) currently tied for the most votes. Empty when nobody's
 * voted yet — the "leading option" display should treat that as no leader,
 * not a tie among every option at zero.
 */
export function leadingOptionIds(results: BallotOptionTally[]): string[] {
  if (results.length === 0) return [];
  const max = Math.max(...results.map((r) => r.votes));
  if (max === 0) return [];
  return results.filter((r) => r.votes === max).map((r) => r.optionId);
}
