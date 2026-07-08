"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { players, missionAssignments, type NewMissionAssignment } from "@/lib/schema";

/*
 * Player-side mission interest (Phase 5): a player marks/withdraws interest
 * in a mission for their own character. DM confirmation into a real
 * assignment is admin-only (app/admin/mission-actions.ts). Mirrors
 * app/roster/actions.ts's owner-scoped auth check.
 */
export type FormState = { ok?: boolean; error?: string; message?: string };

// Loads the caller's own approved character, if any.
async function requireOwnCharacter() {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." as const };

  const db = getDb();
  const player = await db.query.players.findFirst({
    where: eq(players.userId, user.id),
    with: { character: true },
  });
  if (!player?.character?.approved) {
    return { error: "No approved character on file." as const };
  }
  if (player.character.status === "kia") {
    return { error: "K.I.A. operators can't take missions." as const };
  }
  return { db, character: player.character };
}

export async function markInterested(_prev: FormState, formData: FormData): Promise<FormState> {
  const missionId = String(formData.get("missionId") ?? "");
  if (!missionId) return { error: "Missing mission reference." };

  const auth = await requireOwnCharacter();
  if ("error" in auth) return { error: auth.error };

  const values: NewMissionAssignment = {
    missionId,
    characterId: auth.character.id,
    state: "interested",
  };
  await auth.db.insert(missionAssignments).values(values).onConflictDoNothing();

  revalidatePath("/missions");
  revalidatePath(`/missions/${missionId}`);
  return { ok: true, message: "Marked interested." };
}

export async function withdrawInterest(_prev: FormState, formData: FormData): Promise<FormState> {
  const assignmentId = String(formData.get("assignmentId") ?? "");
  if (!assignmentId) return { error: "Missing assignment reference." };

  const auth = await requireOwnCharacter();
  if ("error" in auth) return { error: auth.error };

  // Ownership + state scoped directly into the WHERE — a caller can only ever
  // delete their own not-yet-confirmed interest row, never someone else's or
  // an already-assigned one.
  const [row] = await auth.db
    .delete(missionAssignments)
    .where(
      and(
        eq(missionAssignments.id, assignmentId),
        eq(missionAssignments.characterId, auth.character.id),
        eq(missionAssignments.state, "interested"),
      ),
    )
    .returning({ missionId: missionAssignments.missionId });
  if (!row) return { error: "Interest not found." };

  revalidatePath("/missions");
  revalidatePath(`/missions/${row.missionId}`);
  return { ok: true, message: "Withdrew interest." };
}
