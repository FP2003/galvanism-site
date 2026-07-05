"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { characters } from "@/lib/schema";
import { clampResource } from "@/lib/ledger";
import { TEXT_LIMITS } from "@/lib/game-rules";

/*
 * Player self-service on the Case File (Phase 2): a player edits their own bio
 * and tracks their own resources (HP/Energy/Ammo). The DM can do the same on any
 * sheet. Stats, level, and gold are admin-only and live in app/admin/actions.ts.
 */
export type SheetState = { ok?: boolean; error?: string; message?: string };

// Loads the character and confirms the caller may edit it (owner or admin).
// Returns the row plus its slug for revalidation, or an error state.
async function authorizeEdit(characterId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." as const };

  const db = getDb();
  const character = await db.query.characters.findFirst({
    where: eq(characters.id, characterId),
    with: { player: true },
  });
  if (!character) return { error: "Character not found." as const };

  const isOwner = character.player.userId === user.id;
  if (!isOwner && user.role !== "admin") {
    return { error: "You can only edit your own case file." as const };
  }
  return { db, character };
}

export async function updateBio(
  _prev: SheetState,
  formData: FormData,
): Promise<SheetState> {
  const characterId = String(formData.get("characterId") ?? "");
  const auth = await authorizeEdit(characterId);
  if ("error" in auth) return { error: auth.error };

  const bio = String(formData.get("bio") ?? "").trim().slice(0, TEXT_LIMITS.bio);

  await auth.db
    .update(characters)
    .set({ bio: bio || null, updatedAt: new Date() })
    .where(eq(characters.id, characterId));

  revalidatePath(`/roster/${auth.character.slug}`);
  return { ok: true, message: "Service record saved." };
}

export async function updateResources(
  _prev: SheetState,
  formData: FormData,
): Promise<SheetState> {
  const characterId = String(formData.get("characterId") ?? "");
  const auth = await authorizeEdit(characterId);
  if ("error" in auth) return { error: auth.error };

  const c = auth.character;
  // Clamp each current value to its (immutable-here) max; players adjust current
  // resources only — maxes are set by the DM on the admin sheet.
  const read = (key: string, fallback: number) => {
    const raw = String(formData.get(key) ?? "").trim();
    if (raw === "") return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  };

  await auth.db
    .update(characters)
    .set({
      hpCurrent: clampResource(read("hpCurrent", c.hpCurrent), c.hpMax),
      energyCurrent: clampResource(read("energyCurrent", c.energyCurrent), c.energyMax),
      ammoCurrent: clampResource(read("ammoCurrent", c.ammoCurrent), c.ammoMax),
      updatedAt: new Date(),
    })
    .where(eq(characters.id, characterId));

  revalidatePath(`/roster/${c.slug}`);
  return { ok: true, message: "Resources updated." };
}
