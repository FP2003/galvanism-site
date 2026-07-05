"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { characters, characterCards } from "@/lib/schema";
import { clampResource } from "@/lib/ledger";
import { effectiveResourceMaxes } from "@/lib/card-data";
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
  // Clamp each current value to its effective max — base plus any equipped
  // resource-modifier cards — so a +Max HP card lets the player fill past the
  // base. Players adjust current only; base maxes are DM-set on the admin sheet.
  const read = (key: string, fallback: number) => {
    const raw = String(formData.get(key) ?? "").trim();
    if (raw === "") return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  };

  const max = await effectiveResourceMaxes(characterId, {
    hpMax: c.hpMax,
    energyMax: c.energyMax,
    ammoMax: c.ammoMax,
  });

  await auth.db
    .update(characters)
    .set({
      hpCurrent: clampResource(read("hpCurrent", c.hpCurrent), max.hpMax),
      energyCurrent: clampResource(read("energyCurrent", c.energyCurrent), max.energyMax),
      ammoCurrent: clampResource(read("ammoCurrent", c.ammoCurrent), max.ammoMax),
      updatedAt: new Date(),
    })
    .where(eq(characters.id, characterId));

  revalidatePath(`/roster/${c.slug}`);
  return { ok: true, message: "Resources updated." };
}

// Equip / unequip a card the character owns (Phase 3). Owner or admin only. Only
// equipped cards contribute to effective stats; the modifier is computed at read
// time, so toggling is lossless (lib/card-data computeLoadout). The assignment
// must belong to this character — a caller can't equip someone else's card.
export async function setCardEquipped(
  _prev: SheetState,
  formData: FormData,
): Promise<SheetState> {
  const characterId = String(formData.get("characterId") ?? "");
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const equipped = String(formData.get("equipped") ?? "") === "true";
  const auth = await authorizeEdit(characterId);
  if ("error" in auth) return { error: auth.error };

  const [row] = await auth.db
    .update(characterCards)
    .set({ equipped })
    .where(
      and(
        eq(characterCards.id, assignmentId),
        eq(characterCards.characterId, characterId),
      ),
    )
    .returning({ id: characterCards.id });
  if (!row) return { error: "Card not found in this inventory." };

  revalidatePath(`/roster/${auth.character.slug}`);
  return { ok: true, message: equipped ? "Card equipped." : "Card unequipped." };
}
