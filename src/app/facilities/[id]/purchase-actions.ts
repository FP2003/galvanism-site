"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  facilityListings,
  facilityXpOfferings,
  players,
  characters,
  creditLedger,
  xpLedger,
  characterCards,
} from "@/lib/schema";
import { getViewerCharacterState } from "@/lib/characters";
import { effectiveResourceMaxes } from "@/lib/card-data";
import { applyXpSpend } from "@/lib/ledger";
import {
  applyPurchase,
  applyStatBump,
  applyResourceRefill,
  isCardLevelUnlocked,
} from "@/lib/facilities";

export type FormState = { ok?: boolean; error?: string; message?: string };

function textField(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

// Instant facility purchase (Phase 6, absorbing Phase 4's requisitions
// purchase, no DM-approval step): debits the buyer's credits, appends a
// credit_ledger row, and grants the card to their character's inventory
// (unequipped) — all in one db.batch, which the Neon HTTP driver runs as a
// real transaction, so a duplicate-ownership conflict rolls back the credit
// debit too. No stock limit: a listing stays for sale until an admin/
// rotation removes it, so other characters can still buy it.
export async function purchaseListing(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const listingId = textField(formData, "listingId");
  if (!listingId) return { error: "Missing listing reference." };

  const db = getDb();
  const listing = await db.query.facilityListings.findFirst({
    where: eq(facilityListings.id, listingId),
    with: { facility: true, card: true },
  });
  if (!listing) return { error: "Listing not found." };
  if (!listing.facility.isOpen) return { error: "This facility is closed." };
  if (listing.card.priceCredits == null) return { error: "This item has no price set." };
  // Re-checked at purchase time (not just at listing-add time) so lowering a
  // facility's level after the fact immediately blocks over-level gear,
  // rather than leaving a stale listing purchasable until an admin notices.
  if (!isCardLevelUnlocked(listing.card.level, listing.facility.level)) {
    return { error: "This item's level is above what this facility currently has unlocked." };
  }

  const viewer = await getViewerCharacterState(user.id);
  if (viewer.kind !== "approved") {
    return { error: "You need an active character on file to make a requisition." };
  }
  const { player, character } = viewer;

  const already = await db.query.characterCards.findFirst({
    where: and(
      eq(characterCards.characterId, character.id),
      eq(characterCards.cardId, listing.cardId),
    ),
  });
  if (already) return { error: "You already own this item." };

  const result = applyPurchase(player.credits, listing.card.priceCredits);
  if (!result.ok) return { error: result.error };

  try {
    await db.batch([
      db
        .update(players)
        .set({ credits: result.value, updatedAt: new Date() })
        .where(eq(players.id, player.id)),
      db.insert(creditLedger).values({
        playerId: player.id,
        description: `Requisition — ${listing.card.title} (${listing.facility.name})`,
        delta: -listing.card.priceCredits,
        balanceAfter: result.value,
        createdByUserId: user.id,
      }),
      db.insert(characterCards).values({
        characterId: character.id,
        cardId: listing.cardId,
        equipped: false,
      }),
    ]);
  } catch {
    return {
      error: "You already own this item, or a concurrent purchase just completed.",
    };
  }

  revalidatePath("/facilities");
  revalidatePath(`/facilities/${listing.facilityId}`);
  revalidatePath("/roster");
  revalidatePath(`/roster/${character.slug}`);
  return {
    ok: true,
    message: `Purchased ${listing.card.title} for ${listing.card.priceCredits} Cr.`,
  };
}

// A resource_refill offering's targetKey names the *Current column to update;
// this is the matching *Max column effectiveResourceMaxes needs to compute
// the (possibly card-boosted) ceiling to clamp the refill against.
const RESOURCE_MAX_KEY: Record<string, "hpMax" | "energyMax" | "ammoMax"> = {
  hpCurrent: "hpMax",
  energyCurrent: "energyMax",
  ammoCurrent: "ammoMax",
};

// Spends on a facility's training/refill offering (Phase 6 Step 2): a stat
// bump costs Currency XP (ledgered in xp_ledger); a resource refill costs
// Credits (ledgered in credit_ledger) like any other facility purchase — see
// offeringCostCurrency. Either way the balance debit and the stat/resource
// change land in one db.batch, same transactional shape as purchaseListing.
// Offerings are repeatable (no ownership row, unlike cards/perks) — training
// again or healing again is the point.
export async function purchaseXpOffering(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const offeringId = textField(formData, "offeringId");
  if (!offeringId) return { error: "Missing offering reference." };

  const db = getDb();
  const offering = await db.query.facilityXpOfferings.findFirst({
    where: eq(facilityXpOfferings.id, offeringId),
    with: { facility: true },
  });
  if (!offering) return { error: "Offering not found." };
  if (!offering.facility.isOpen) return { error: "This facility is closed." };
  if (!offering.active) return { error: "This offering is no longer available." };
  if (offering.facility.level < offering.minLevel) {
    return { error: "This offering isn't unlocked at this facility's current level." };
  }

  const viewer = await getViewerCharacterState(user.id);
  if (viewer.kind !== "approved") {
    return { error: "You need an active character on file to train here." };
  }
  const { player, character } = viewer;
  const characterFields = character as unknown as Record<string, number>;
  const currentValue = characterFields[offering.targetKey];

  if (offering.offeringType === "stat_bump") {
    const spend = applyXpSpend(character.currencyXp, offering.cost);
    if (!spend.ok) return { error: spend.error };
    const newStat = applyStatBump(currentValue, offering.amount);

    await db.batch([
      db
        .update(characters)
        .set({ currencyXp: spend.value, [offering.targetKey]: newStat, updatedAt: new Date() })
        .where(eq(characters.id, character.id)),
      db.insert(xpLedger).values({
        characterId: character.id,
        description: `${offering.name} (${offering.facility.name})`,
        delta: -offering.cost,
        totalXpAfter: character.totalXp,
        currencyXpAfter: spend.value,
        createdByUserId: user.id,
      }),
    ]);

    revalidatePath("/facilities");
    revalidatePath(`/facilities/${offering.facilityId}`);
    revalidatePath("/roster");
    revalidatePath(`/roster/${character.slug}`);
    return { ok: true, message: `${offering.name} — spent ${offering.cost} XP.` };
  }

  const result = applyPurchase(player.credits, offering.cost);
  if (!result.ok) return { error: result.error };
  const maxKey = RESOURCE_MAX_KEY[offering.targetKey];
  const maxes = await effectiveResourceMaxes(character.id, {
    hpMax: character.hpMax,
    energyMax: character.energyMax,
    ammoMax: character.ammoMax,
  });
  const newValue = applyResourceRefill(currentValue, maxes[maxKey], offering.amount);

  await db.batch([
    db
      .update(characters)
      .set({ [offering.targetKey]: newValue, updatedAt: new Date() })
      .where(eq(characters.id, character.id)),
    db
      .update(players)
      .set({ credits: result.value, updatedAt: new Date() })
      .where(eq(players.id, player.id)),
    db.insert(creditLedger).values({
      playerId: player.id,
      description: `${offering.name} (${offering.facility.name})`,
      delta: -offering.cost,
      balanceAfter: result.value,
      createdByUserId: user.id,
    }),
  ]);

  revalidatePath("/facilities");
  revalidatePath(`/facilities/${offering.facilityId}`);
  revalidatePath("/roster");
  revalidatePath(`/roster/${character.slug}`);
  return { ok: true, message: `${offering.name} — spent ${offering.cost} Cr.` };
}
