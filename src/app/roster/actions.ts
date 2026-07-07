"use server";

import { revalidatePath } from "next/cache";
import { eq, and, ne, inArray, isNotNull } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { characters, characterCards } from "@/lib/schema";
import { clampResource } from "@/lib/ledger";
import { effectiveResourceMaxes } from "@/lib/card-data";
import { TEXT_LIMITS } from "@/lib/game-rules";
import { isWeaponSubcategory, type WeaponSlotName } from "@/lib/cards";
import {
  WEAPON_SLOTS,
  resolveWeaponSlotAssignment,
  type OccupiedSlots,
} from "@/lib/weapons";

/*
 * Player self-service on the Case File (Phase 2): a player edits their own bio
 * and tracks their own resources (HP/Energy/Ammo). The DM can do the same on any
 * sheet. Base stats are otherwise admin-only (app/admin/actions.ts) — spending
 * Currency XP against a purchase catalog is Phase 6 (Facilities), not here.
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

// Assign / clear a weapon's primary/secondary/tertiary slot (pre-Phase 4). A
// dedicated action rather than an extension of setCardEquipped: this path
// needs the card's subcategory/handedness plus the character's other occupied
// slots to run resolveWeaponSlotAssignment, and may issue a second clearing
// UPDATE (e.g. auto-unequipping Secondary when a 2H weapon takes Primary).
export async function setWeaponSlot(
  _prev: SheetState,
  formData: FormData,
): Promise<SheetState> {
  const characterId = String(formData.get("characterId") ?? "");
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const slotRaw = String(formData.get("slot") ?? "");
  const auth = await authorizeEdit(characterId);
  if ("error" in auth) return { error: auth.error };
  const { db } = auth;

  if (slotRaw === "") {
    const [row] = await db
      .update(characterCards)
      .set({ weaponSlot: null, equipped: false })
      .where(
        and(
          eq(characterCards.id, assignmentId),
          eq(characterCards.characterId, characterId),
        ),
      )
      .returning({ id: characterCards.id });
    if (!row) return { error: "Weapon not found in this inventory." };
    revalidatePath(`/roster/${auth.character.slug}`);
    revalidatePath(`/admin/players/${auth.character.playerId}`);
    return { ok: true, message: "Weapon unequipped." };
  }

  if (!WEAPON_SLOTS.includes(slotRaw as WeaponSlotName)) {
    return { error: "Invalid weapon slot." };
  }
  const targetSlot = slotRaw as WeaponSlotName;

  const assignment = await db.query.characterCards.findFirst({
    where: and(
      eq(characterCards.id, assignmentId),
      eq(characterCards.characterId, characterId),
    ),
    with: { card: true },
  });
  if (!assignment) return { error: "Weapon not found in this inventory." };
  const { card } = assignment;
  if (card.category !== "item" || !isWeaponSubcategory(card.subcategory) || !card.handedness) {
    return { error: "That card isn't a weapon." };
  }

  const occupiedRows = await db.query.characterCards.findMany({
    where: and(
      eq(characterCards.characterId, characterId),
      isNotNull(characterCards.weaponSlot),
    ),
    with: { card: true },
  });
  const occupied: OccupiedSlots = {};
  for (const row of occupiedRows) {
    if (!row.weaponSlot || !isWeaponSubcategory(row.card.subcategory) || !row.card.handedness) {
      continue;
    }
    occupied[row.weaponSlot] = {
      assignmentId: row.id,
      subcategory: row.card.subcategory,
      handedness: row.card.handedness,
    };
  }

  const plan = resolveWeaponSlotAssignment(
    { subcategory: card.subcategory, handedness: card.handedness },
    assignmentId,
    targetSlot,
    occupied,
  );
  if (!plan.ok) return { error: plan.error };

  // Evict whatever currently occupies the target slot (a different
  // assignment) plus any slots the plan says to cascade-clear (e.g. Secondary
  // when a 2H weapon takes Primary) — the partial unique index on
  // (characterId, weaponSlot) means the target slot must be vacated first.
  const clearSlots = [...new Set([...plan.value.slotsToClear, targetSlot])];
  await db
    .update(characterCards)
    .set({ weaponSlot: null, equipped: false })
    .where(
      and(
        eq(characterCards.characterId, characterId),
        inArray(characterCards.weaponSlot, clearSlots),
        ne(characterCards.id, assignmentId),
      ),
    );

  await db
    .update(characterCards)
    .set({ weaponSlot: targetSlot, equipped: true })
    .where(
      and(
        eq(characterCards.id, assignmentId),
        eq(characterCards.characterId, characterId),
      ),
    );

  revalidatePath(`/roster/${auth.character.slug}`);
  revalidatePath(`/admin/players/${auth.character.playerId}`);
  return {
    ok: true,
    message: `${card.title} equipped to ${targetSlot[0].toUpperCase()}${targetSlot.slice(1)}.`,
  };
}

