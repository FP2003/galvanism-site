"use server";

import { revalidatePath } from "next/cache";
import { eq, and, sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  facilities,
  facilityListings,
  facilityXpOfferings,
  facilityPerks,
  facilityPerkPurchases,
  facilityLevelContributions,
  players,
  characters,
  creditLedger,
  xpLedger,
  characterCards,
} from "@/lib/schema";
import { getViewerCharacterState } from "@/lib/characters";
import { effectiveResourceMaxes } from "@/lib/card-data";
import { findRefundablePurchase, getFacilityLevelPool } from "@/lib/facility-data";
import { applyXpSpend, clampResource, parseSignedInt, resilienceHpBonus } from "@/lib/ledger";
import {
  applyPurchase,
  applyStatBump,
  applyResourceRefill,
  applyLevelDonation,
  isCardLevelUnlocked,
} from "@/lib/facilities";

export type FormState = { ok?: boolean; error?: string; message?: string };

function textField(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

// Self-serve refund grace period: the client UI only offers a Refund button
// while the buyer hasn't navigated away from the facility page (its local
// action state resets on unmount/reload), but that's a client-side courtesy,
// not a security boundary — this window is the server-side backstop so the
// same request can't be replayed long after the fact.
const SELF_REFUND_WINDOW_MS = 15 * 60 * 1000;

// Instant facility purchase (Phase 6, absorbing Phase 4's requisitions
// purchase, no DM-approval step): atomically claims this appearance of the
// listing, debits the buyer, appends a credit-ledger row, and grants the card
// unequipped. The data-modifying CTEs all depend on the listing claim, and the
// final guard deliberately fails the statement unless every mutation landed;
// this makes two simultaneous buyers race on one conditional UPDATE, with
// exactly one winner and no partial charge. A restock clears the claim.
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
  if (listing.purchasedByCharacterId) {
    return { error: "This item is no longer in stock. It may return in a future rotation." };
  }

  const result = applyPurchase(player.credits, listing.card.priceCredits);
  if (!result.ok) return { error: result.error };

  try {
    const description = `Requisition: ${listing.card.title} (${listing.facility.name})`;
    await db.execute(sql`
      with claimed as (
        update facility_listings
        set purchased_by_character_id = ${character.id}, purchased_at = now()
        where id = ${listing.id}
          and card_id = ${listing.cardId}
          and purchased_by_character_id is null
        returning card_id
      ), debited as (
        update players
        set credits = credits - ${listing.card.priceCredits}, updated_at = now()
        where id = ${player.id}
          and credits >= ${listing.card.priceCredits}
          and exists (select 1 from claimed)
        returning credits
      ), granted as (
        insert into character_cards (character_id, card_id, equipped)
        select ${character.id}, claimed.card_id, false
        from claimed
        where exists (select 1 from debited)
        returning id
      ), ledgered as (
        insert into credit_ledger
          (player_id, description, delta, balance_after, ref_code, created_by_user_id)
        select
          ${player.id},
          ${description},
          ${-listing.card.priceCredits},
          debited.credits,
          ${listing.cardId},
          ${user.id}
        from debited
        where exists (select 1 from granted)
        returning id
      )
      select
        (select credits from debited) as balance_after,
        1 / (select count(*)::integer from ledgered) as purchase_guard
    `);
  } catch {
    // The common failure is another request winning the stock claim. Re-read
    // ownership so a same-character replay still gets the more useful label.
    try {
      const ownedNow = await db.query.characterCards.findFirst({
        where: and(
          eq(characterCards.characterId, character.id),
          eq(characterCards.cardId, listing.cardId),
        ),
      });
      if (ownedNow) return { error: "You already own this item." };
    } catch {
      // Fall through to the concurrency-safe generic message below.
    }
    return {
      error: "This item is no longer in stock, or your balance changed. Refresh and try again.",
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

// Undoes a card purchase (self-serve, within SELF_REFUND_WINDOW_MS of buying
// it): releases the stock claim, deletes the ownership row, and credits back
// exactly what the original purchase's ledger row debited, found via
// findRefundablePurchase rather than re-reading the listing's current price
// (which may have changed since).
export async function refundListing(
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

  const viewer = await getViewerCharacterState(user.id);
  if (viewer.kind !== "approved") {
    return { error: "You need an active character on file to refund a requisition." };
  }
  const { player, character } = viewer;

  const owned = await db.query.characterCards.findFirst({
    where: and(
      eq(characterCards.characterId, character.id),
      eq(characterCards.cardId, listing.cardId),
    ),
  });
  if (!owned) return { error: "You don't own this item." };
  if (listing.purchasedByCharacterId !== character.id) {
    return { error: "This listing has already changed and can no longer be refunded here." };
  }
  if (Date.now() - owned.acquiredAt.getTime() > SELF_REFUND_WINDOW_MS) {
    return { error: "Too much time has passed to refund this yourself — ask a DM to undo it." };
  }

  const entry = await findRefundablePurchase(player.id, listing.cardId);
  if (!entry) return { error: "No refundable purchase found for this item." };
  const refundAmount = -entry.delta;

  try {
    const description = `Refund: ${listing.card.title} (${listing.facility.name})`;
    await db.execute(sql`
      with released as (
        update facility_listings
        set purchased_by_character_id = null, purchased_at = null
        where id = ${listing.id}
          and card_id = ${listing.cardId}
          and purchased_by_character_id = ${character.id}
        returning id
      ), removed as (
        delete from character_cards
        where id = ${owned.id} and exists (select 1 from released)
        returning id
      ), credited as (
        update players
        set credits = credits + ${refundAmount}, updated_at = now()
        where id = ${player.id} and exists (select 1 from removed)
        returning credits
      ), ledgered as (
        insert into credit_ledger
          (player_id, description, delta, balance_after, ref_code, created_by_user_id)
        select
          ${player.id},
          ${description},
          ${refundAmount},
          credited.credits,
          ${listing.cardId},
          ${user.id}
        from credited
        returning id
      )
      select 1 / (select count(*)::integer from ledgered) as refund_guard
    `);
  } catch {
    return { error: "This item was already refunded, or the listing changed." };
  }

  revalidatePath("/facilities");
  revalidatePath(`/facilities/${listing.facilityId}`);
  revalidatePath("/roster");
  revalidatePath(`/roster/${character.slug}`);
  return { ok: true, message: `Refunded ${refundAmount} Cr.` };
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
// change land in one transactional operation.
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

    // Training up Resilience raises the effective max HP everywhere it's
    // read but never touches the stored hpCurrent — bump it by the same
    // delta here (preserving existing damage), same convention as the
    // admin sheet edit (admin/actions.ts's updateCharacter).
    const updates: Record<string, number> = {
      currencyXp: spend.value,
      [offering.targetKey]: newStat,
    };
    if (offering.targetKey === "statResilience") {
      const hpDelta = resilienceHpBonus(newStat) - resilienceHpBonus(currentValue);
      const maxes = await effectiveResourceMaxes(character.id, {
        hpMax: character.hpMax + resilienceHpBonus(newStat),
        energyMax: character.energyMax,
        ammoMax: character.ammoMax,
      });
      updates.hpCurrent = clampResource(character.hpCurrent + hpDelta, maxes.hpMax);
    }

    await db.batch([
      db
        .update(characters)
        .set({ ...updates, updatedAt: new Date() })
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
    revalidatePath("/");
    revalidatePath(`/admin/players/${player.id}`);
    return { ok: true, message: `${offering.name}: spent ${offering.cost} XP.` };
  }

  const result = applyPurchase(player.credits, offering.cost);
  if (!result.ok) return { error: result.error };
  const maxKey = RESOURCE_MAX_KEY[offering.targetKey];
  const maxes = await effectiveResourceMaxes(character.id, {
    hpMax: character.hpMax + resilienceHpBonus(character.statResilience),
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
  revalidatePath("/");
  revalidatePath(`/admin/players/${player.id}`);
  return { ok: true, message: `${offering.name}: spent ${offering.cost} Cr.` };
}

// Unlocks a facility perk (Phase 6 Step 3): debits Credits and records a
// permanent per-character ownership row — the DM manually honors the
// described effect at the table, no new mission-engine mechanic reads this.
// Unlike XP offerings, a perk is a one-time purchase per character (mirrors
// purchaseListing's ownership check), so the unique (perkId, characterId)
// index is the last line of defense against a duplicate under concurrency.
export async function purchasePerk(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const perkId = textField(formData, "perkId");
  if (!perkId) return { error: "Missing perk reference." };

  const db = getDb();
  const perk = await db.query.facilityPerks.findFirst({
    where: eq(facilityPerks.id, perkId),
    with: { facility: true },
  });
  if (!perk) return { error: "Perk not found." };
  if (!perk.facility.isOpen) return { error: "This facility is closed." };
  if (!perk.active) return { error: "This perk is no longer available." };
  if (perk.facility.level < perk.minLevel) {
    return { error: "This perk isn't unlocked at this facility's current level." };
  }

  const viewer = await getViewerCharacterState(user.id);
  if (viewer.kind !== "approved") {
    return { error: "You need an active character on file to unlock a perk." };
  }
  const { player, character } = viewer;

  const already = await db.query.facilityPerkPurchases.findFirst({
    where: and(
      eq(facilityPerkPurchases.perkId, perkId),
      eq(facilityPerkPurchases.characterId, character.id),
    ),
  });
  if (already) return { error: "You already unlocked this perk." };

  const result = applyPurchase(player.credits, perk.priceCredits);
  if (!result.ok) return { error: result.error };

  try {
    await db.batch([
      db
        .update(players)
        .set({ credits: result.value, updatedAt: new Date() })
        .where(eq(players.id, player.id)),
      db.insert(creditLedger).values({
        playerId: player.id,
        description: `${perk.name} (${perk.facility.name})`,
        delta: -perk.priceCredits,
        balanceAfter: result.value,
        refCode: perk.id,
        createdByUserId: user.id,
      }),
      db.insert(facilityPerkPurchases).values({
        perkId: perk.id,
        characterId: character.id,
      }),
    ]);
  } catch {
    return {
      error: "You already unlocked this perk, or a concurrent purchase just completed.",
    };
  }

  revalidatePath("/facilities");
  revalidatePath(`/facilities/${perk.facilityId}`);
  revalidatePath("/roster");
  revalidatePath(`/roster/${character.slug}`);
  return { ok: true, message: `Unlocked ${perk.name} for ${perk.priceCredits} Cr.` };
}

// Undoes a perk unlock (self-serve, within SELF_REFUND_WINDOW_MS) — same
// shape as refundListing, just against facility_perk_purchases instead of
// character_cards.
export async function refundPerk(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const perkId = textField(formData, "perkId");
  if (!perkId) return { error: "Missing perk reference." };

  const db = getDb();
  const perk = await db.query.facilityPerks.findFirst({
    where: eq(facilityPerks.id, perkId),
    with: { facility: true },
  });
  if (!perk) return { error: "Perk not found." };

  const viewer = await getViewerCharacterState(user.id);
  if (viewer.kind !== "approved") {
    return { error: "You need an active character on file to refund a perk." };
  }
  const { player, character } = viewer;

  const owned = await db.query.facilityPerkPurchases.findFirst({
    where: and(
      eq(facilityPerkPurchases.perkId, perkId),
      eq(facilityPerkPurchases.characterId, character.id),
    ),
  });
  if (!owned) return { error: "You haven't unlocked this perk." };
  if (Date.now() - owned.purchasedAt.getTime() > SELF_REFUND_WINDOW_MS) {
    return { error: "Too much time has passed to refund this yourself — ask a DM to undo it." };
  }

  const entry = await findRefundablePurchase(player.id, perk.id);
  if (!entry) return { error: "No refundable purchase found for this perk." };
  const refundAmount = -entry.delta;

  const [deleted] = await db
    .delete(facilityPerkPurchases)
    .where(eq(facilityPerkPurchases.id, owned.id))
    .returning({ id: facilityPerkPurchases.id });
  if (!deleted) return { error: "This perk was already refunded." };

  await db.batch([
    db
      .update(players)
      .set({ credits: player.credits + refundAmount, updatedAt: new Date() })
      .where(eq(players.id, player.id)),
    db.insert(creditLedger).values({
      playerId: player.id,
      description: `Refund: ${perk.name} (${perk.facility.name})`,
      delta: refundAmount,
      balanceAfter: player.credits + refundAmount,
      refCode: perk.id,
      createdByUserId: user.id,
    }),
  ]);

  revalidatePath("/facilities");
  revalidatePath(`/facilities/${perk.facilityId}`);
  revalidatePath("/roster");
  revalidatePath(`/roster/${character.slug}`);
  return { ok: true, message: `Refunded ${refundAmount} Cr.` };
}

// Donates Credits toward a Station facility's next-level cost (crowd-funded
// upgrade). Donations are final — no self-refund, unlike card/perk purchases,
// since they go into a shared pool rather than buying something back-outable.
// Once the pool reaches nextLevelCost, this request tries to level the
// facility up itself via a compare-and-swap UPDATE guarded on the level it
// read — under concurrent donations crossing the threshold at once, only the
// request whose guard still matches wins the bump, so the facility can't
// double-level from a race. Whatever perks/offerings/listings are gated at
// the new minLevel become visible immediately, with no new gating code.
export async function donateToFacilityLevel(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const facilityId = textField(formData, "facilityId");
  if (!facilityId) return { error: "Missing facility reference." };

  const db = getDb();
  const facility = await db.query.facilities.findFirst({
    where: eq(facilities.id, facilityId),
  });
  if (!facility) return { error: "Facility not found." };
  if (!facility.isOpen) return { error: "This facility is closed." };
  if (facility.kind !== "station") return { error: "This facility can't be upgraded." };
  if (facility.nextLevelCost == null) {
    return { error: "This facility has no upgrade in progress." };
  }

  const viewer = await getViewerCharacterState(user.id);
  if (viewer.kind !== "approved") {
    return { error: "You need an active character on file to donate here." };
  }
  const { player, character } = viewer;

  const parsed = parseSignedInt(formData.get("amount"));
  if (!parsed.ok) return { error: parsed.error };

  const result = applyLevelDonation(player.credits, parsed.value);
  if (!result.ok) return { error: result.error };

  const towardLevel = facility.level + 1;
  const description = `Facility upgrade donation: ${facility.name}`;
  await db.batch([
    db
      .update(players)
      .set({ credits: result.value, updatedAt: new Date() })
      .where(eq(players.id, player.id)),
    db.insert(creditLedger).values({
      playerId: player.id,
      description,
      delta: -parsed.value,
      balanceAfter: result.value,
      refCode: facility.id,
      createdByUserId: user.id,
    }),
    db.insert(facilityLevelContributions).values({
      facilityId: facility.id,
      characterId: character.id,
      towardLevel,
      amount: parsed.value,
    }),
  ]);

  const pool = await getFacilityLevelPool(facility.id, towardLevel);
  let leveledUp = false;
  if (pool.total >= facility.nextLevelCost) {
    const [leveled] = await db
      .update(facilities)
      .set({ level: towardLevel, nextLevelCost: null, updatedAt: new Date() })
      .where(and(eq(facilities.id, facility.id), eq(facilities.level, facility.level)))
      .returning({ id: facilities.id });
    leveledUp = Boolean(leveled);
  }

  revalidatePath("/facilities");
  revalidatePath(`/facilities/${facility.id}`);
  revalidatePath("/roster");
  revalidatePath(`/roster/${character.slug}`);
  return {
    ok: true,
    message: leveledUp
      ? `Donated ${parsed.value} Cr — ${facility.name} reached Level ${towardLevel}!`
      : `Donated ${parsed.value} Cr toward ${facility.name}'s next level.`,
  };
}
