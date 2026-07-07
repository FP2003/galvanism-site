"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { shopListings, players, creditLedger, characterCards } from "@/lib/schema";
import { getViewerCharacterState } from "@/lib/characters";
import { applyPurchase } from "@/lib/shops";

export type FormState = { ok?: boolean; error?: string; message?: string };

function textField(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

// Instant shop purchase (Phase 4, no DM-approval step): debits the buyer's
// credits, appends a credit_ledger row, and grants the card to their
// character's inventory (unequipped) — all in one db.batch, which the Neon
// HTTP driver runs as a real transaction, so a duplicate-ownership conflict
// rolls back the credit debit too. No stock limit: a listing stays for sale
// until an admin/rotation removes it, so other characters can still buy it.
export async function purchaseListing(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const listingId = textField(formData, "listingId");
  if (!listingId) return { error: "Missing listing reference." };

  const db = getDb();
  const listing = await db.query.shopListings.findFirst({
    where: eq(shopListings.id, listingId),
    with: { shop: true, card: true },
  });
  if (!listing) return { error: "Listing not found." };
  if (!listing.shop.isOpen) return { error: "This shop is closed." };
  if (listing.card.priceCredits == null) return { error: "This item has no price set." };

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
        description: `Requisition — ${listing.card.title} (${listing.shop.name})`,
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

  revalidatePath("/requisitions");
  revalidatePath("/roster");
  revalidatePath(`/roster/${character.slug}`);
  return {
    ok: true,
    message: `Purchased ${listing.card.title} for ${listing.card.priceCredits} Cr.`,
  };
}
