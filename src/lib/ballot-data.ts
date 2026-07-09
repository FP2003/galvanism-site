import { eq, asc, desc, sql } from "drizzle-orm";
import { getDb } from "./db";
import { ballots, ballotOptions } from "./schema";

/*
 * Ballot read model (Phase 7). DB access only — tally math and the ops
 * countdown live in lib/ballots.ts, tested in isolation. Mirrors the shape
 * of lib/mission-data.ts / lib/facility-data.ts.
 */

/** Every ballot, newest first, with its options and votes — for the admin
 *  list (tallies are derived from `votes` by the caller). */
export async function getBallots() {
  const db = getDb();
  return db.query.ballots.findMany({
    with: {
      options: { orderBy: [asc(ballotOptions.sortOrder)] },
      votes: true,
    },
    orderBy: [desc(ballots.createdAt)],
  });
}

/** One ballot with its options (sortOrder) and votes — the admin and player
 *  detail pages. */
export async function getBallot(ballotId: string) {
  const db = getDb();
  return db.query.ballots.findFirst({
    where: eq(ballots.id, ballotId),
    with: {
      options: { orderBy: [asc(ballotOptions.sortOrder)] },
      votes: true,
    },
  });
}

/** Every ballot with options and votes, for the player Ballots list — bucketed
 *  Open/Closed client-side (mirrors missionBucket's convention), with the
 *  viewer's own current pick computed by matching their characterId against
 *  `votes`. */
export async function getBallotsForViewer() {
  const db = getDb();
  return db.query.ballots.findMany({
    with: {
      options: { orderBy: [asc(ballotOptions.sortOrder)] },
      votes: true,
    },
    orderBy: [desc(ballots.createdAt)],
  });
}

/** Open ballots only, soonest-to-close first (null opsDeadline sorts last —
 *  no deadline means it won't close on its own) — feeds the command
 *  dashboard's "Open Ballot" panel. */
export async function getBallotsForDashboard(limit = 3) {
  const db = getDb();
  return db.query.ballots.findMany({
    where: eq(ballots.status, "open"),
    with: {
      options: { orderBy: [asc(ballotOptions.sortOrder)] },
      votes: true,
    },
    orderBy: [sql`${ballots.opsDeadline} IS NULL`, asc(ballots.opsDeadline), desc(ballots.createdAt)],
    limit,
  });
}
