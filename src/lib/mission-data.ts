import { eq, and, ne, asc, desc, inArray, notInArray } from "drizzle-orm";
import { getDb } from "./db";
import { missions, missionAssignments, characters } from "./schema";

/*
 * Mission read model (Phase 5). DB access only — the payout split and Urgent
 * countdown math live in lib/missions.ts, tested in isolation. Mirrors the
 * shape of lib/shop-data.ts.
 */

/** Every mission, newest first, with its interest/assignment rows — for the
 *  admin mission list (counts are derived from `assignments` by the caller). */
export async function getMissions() {
  const db = getDb();
  return db.query.missions.findMany({
    with: { assignments: true },
    orderBy: [desc(missions.createdAt)],
  });
}

/** One mission with its assignments joined to the character (+ owning player,
 *  needed for the credit payout) — the admin detail page and completeMission. */
export async function getMission(missionId: string) {
  const db = getDb();
  return db.query.missions.findFirst({
    where: eq(missions.id, missionId),
    with: {
      assignments: {
        with: { character: { with: { player: true } } },
        orderBy: [asc(missionAssignments.createdAt)],
      },
    },
  });
}

/** Non-terminal missions, urgent-first, for CommandDashboard's "Active
 *  Operations" panel (both the authenticated `/` and the mock `/preview`). */
export async function getMissionsForDashboard(limit = 5) {
  const db = getDb();
  return db.query.missions.findMany({
    where: inArray(missions.status, ["available", "active"]),
    with: { assignments: true },
    orderBy: [desc(missions.urgent), asc(missions.createdAt)],
    limit,
  });
}

/** Every mission, with assignments — the player-facing Missions list filters
 *  by status bucket client-side (mirrors getMissions) and computes the
 *  viewer's own interest/assigned state per mission by matching their
 *  characterId against `assignments`. */
export async function getMissionsForViewer() {
  const db = getDb();
  return db.query.missions.findMany({
    with: { assignments: true },
    orderBy: [desc(missions.urgent), asc(missions.createdAt)],
  });
}

/** Approved, non-KIA characters not already on this mission — feeds the
 *  admin's direct-assign picker (mirrors getEligibleListingCards). */
export async function getEligibleAssignees(missionId: string) {
  const db = getDb();
  const existing = await db.query.missionAssignments.findMany({
    where: eq(missionAssignments.missionId, missionId),
    columns: { characterId: true },
  });
  const existingIds = existing.map((a) => a.characterId);

  const eligible = and(eq(characters.approved, true), ne(characters.status, "kia"));
  return db.query.characters.findMany({
    where: existingIds.length > 0 ? and(eligible, notInArray(characters.id, existingIds)) : eligible,
    orderBy: [asc(characters.callsign)],
  });
}
