"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getViewerCharacterState } from "@/lib/characters";
import { getDb } from "@/lib/db";
import { ballots, ballotOptions, ballotVotes } from "@/lib/schema";

export type FormState = { ok?: boolean; error?: string; message?: string };

function textField(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

// Casts or changes the caller's own vote (Phase 7 Step 2). Single-choice and
// changeable, so first vote and re-vote are the same action — an upsert on
// the (ballotId, characterId) unique index, never a second row. KIA
// characters aren't blocked: voting isn't fieldwork, so it follows
// facilities' unrestricted-purchase gate rather than missions' interest gate.
export async function castVote(_prev: FormState, formData: FormData): Promise<FormState> {
  const ballotId = textField(formData, "ballotId");
  const optionId = textField(formData, "optionId");
  if (!ballotId || !optionId) return { error: "Missing ballot or option reference." };

  const user = await requireUser();
  const viewer = await getViewerCharacterState(user.id);
  if (viewer.kind !== "approved") {
    return { error: "You need an active character on file to vote." };
  }
  const { character } = viewer;

  const db = getDb();
  const ballot = await db.query.ballots.findFirst({ where: eq(ballots.id, ballotId) });
  if (!ballot) return { error: "Ballot not found." };
  if (ballot.status !== "open") return { error: "This ballot is closed." };

  const option = await db.query.ballotOptions.findFirst({
    where: and(eq(ballotOptions.id, optionId), eq(ballotOptions.ballotId, ballotId)),
  });
  if (!option) return { error: "That option doesn't belong to this ballot." };

  await db
    .insert(ballotVotes)
    .values({ ballotId, optionId, characterId: character.id })
    .onConflictDoUpdate({
      target: [ballotVotes.ballotId, ballotVotes.characterId],
      set: { optionId, updatedAt: new Date() },
    });

  revalidatePath("/ballots");
  revalidatePath(`/ballots/${ballotId}`);
  revalidatePath("/admin/ballots");
  revalidatePath(`/admin/ballots/${ballotId}`);
  revalidatePath("/");
  return { ok: true, message: "Vote recorded." };
}
