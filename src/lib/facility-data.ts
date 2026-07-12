import { eq, and, asc, desc, isNotNull, gte, lte, notInArray } from "drizzle-orm";
import { getDb } from "./db";
import {
  facilities,
  facilityListings,
  facilityRestockRules,
  facilityXpOfferings,
  facilityPerks,
  facilityPerkPurchases,
  facilityOngoingEntries,
  creditLedger,
  cards,
  cardEffects,
  type NewFacilityListing,
} from "./schema";
import { CARD_CATEGORY_META, type CardCategory } from "./cards";
import { planRestock, type EligibleCard, type RestockRule } from "./facilities";

/*
 * Facility read/write model (Phase 6, absorbing Phase 4's shop model). DB
 * access + the restock orchestration around the pure logic in
 * lib/facilities.ts — this file only fetches rows and applies the plan; the
 * weighted-draw rules themselves live there, tested in isolation.
 */

/** Every facility, newest first — for the admin and player facility lists.
 *  Ongoing entries are pre-filtered to unresolved so both list pages can
 *  surface an active status line (e.g. "Cards are 15% off today!") without a
 *  second query. */
export async function getFacilities() {
  const db = getDb();
  return db.query.facilities.findMany({
    with: {
      listings: true,
      restockRules: true,
      ongoingEntries: {
        where: eq(facilityOngoingEntries.resolved, false),
        orderBy: [desc(facilityOngoingEntries.createdAt)],
      },
    },
    orderBy: [desc(facilities.createdAt)],
  });
}

/** One facility with its listings (joined to their card + effects — GameCard
 *  needs the effects to render its body, same shape as getCardLibrary),
 *  restock rules, XP offerings, perks, and ongoing entries. Used by both the
 *  admin detail page (effects/inactive rows shown for management) and the
 *  player detail page (rows filtered to active + unlocked, effects required),
 *  so one query serves both. */
export async function getFacility(facilityId: string) {
  const db = getDb();
  return db.query.facilities.findFirst({
    where: eq(facilities.id, facilityId),
    with: {
      listings: {
        with: { card: { with: { effects: { orderBy: [asc(cardEffects.sortOrder)] } } } },
        orderBy: [asc(facilityListings.sortOrder)],
      },
      restockRules: { orderBy: [asc(facilityRestockRules.sortOrder)] },
      xpOfferings: { orderBy: [asc(facilityXpOfferings.sortOrder)] },
      perks: { orderBy: [asc(facilityPerks.sortOrder)] },
      ongoingEntries: { orderBy: [desc(facilityOngoingEntries.createdAt)] },
    },
  });
}

/** The perk ids a character already owns, across every facility — feeds the
 *  player detail page's Owned/Buy button state (mirrors getCharacterCards'
 *  ownership-set role for the card shop). */
export async function getOwnedPerkIds(characterId: string): Promise<Set<string>> {
  const db = getDb();
  const rows = await db.query.facilityPerkPurchases.findMany({
    where: eq(facilityPerkPurchases.characterId, characterId),
    columns: { perkId: true },
  });
  return new Set(rows.map((r) => r.perkId));
}

/** A character's unlocked perks with the perk + facility joined in — feeds
 *  the admin player page's perk panel (mirrors getCharacterCards' role for
 *  card inventory). */
export async function getCharacterPerkPurchases(characterId: string) {
  const db = getDb();
  return db.query.facilityPerkPurchases.findMany({
    where: eq(facilityPerkPurchases.characterId, characterId),
    with: { perk: { with: { facility: true } } },
    orderBy: [desc(facilityPerkPurchases.purchasedAt)],
  });
}

/** Every refCode for this player whose most recent credit_ledger row is still
 *  negative — i.e. every card/perk purchase not yet refunded. Powers the
 *  admin player page's per-row Refund buttons; findRefundablePurchase does
 *  the same check for one refCode at a time. */
export async function getRefundableRefCodes(playerId: string): Promise<Set<string>> {
  const db = getDb();
  const rows = await db.query.creditLedger.findMany({
    where: and(eq(creditLedger.playerId, playerId), isNotNull(creditLedger.refCode)),
    orderBy: [desc(creditLedger.createdAt)],
    columns: { refCode: true, delta: true },
  });
  const seen = new Set<string>();
  const refundable = new Set<string>();
  for (const row of rows) {
    const code = row.refCode!;
    if (seen.has(code)) continue; // a later row for this refCode already settled it
    seen.add(code);
    if (row.delta < 0) refundable.add(code);
  }
  return refundable;
}

/**
 * The most recent credit_ledger row tagged `refCode` for this player, if it's
 * still an unrefunded purchase (delta < 0). purchaseListing/purchasePerk tag
 * their debit row's refCode with the purchased card/perk id, and a refund
 * posts its own row with that same refCode — so the latest matching row's
 * sign tells the whole story (positive = already refunded) without a
 * separate status column. Relies on the app's 1:1 player↔character
 * relationship: a refCode is only ever purchased by one character, so scoping
 * by playerId can't cross wires between characters.
 */
export async function findRefundablePurchase(playerId: string, refCode: string) {
  const db = getDb();
  const [latest] = await db.query.creditLedger.findMany({
    where: and(eq(creditLedger.playerId, playerId), eq(creditLedger.refCode, refCode)),
    orderBy: [desc(creditLedger.createdAt)],
    limit: 1,
  });
  return latest && latest.delta < 0 ? latest : null;
}

/** Unresolved ongoing entries across every facility, newest first, joined to
 *  their facility name — feeds the command dashboard's "Facility Processes"
 *  panel (replacing the mock fixture). */
export async function getUnresolvedOngoingEntries(limit = 5) {
  const db = getDb();
  const rows = await db.query.facilityOngoingEntries.findMany({
    where: eq(facilityOngoingEntries.resolved, false),
    with: { facility: { columns: { name: true } } },
    orderBy: [desc(facilityOngoingEntries.createdAt)],
    limit,
  });
  return rows.map((r) => ({ facility: r.facility.name, label: r.label }));
}

/** Library cards with a price set, at or below this facility's level, that
 *  aren't already listed here — feeds the admin "add manual listing" picker. */
export async function getEligibleListingCards(facilityId: string) {
  const db = getDb();
  const [facility, existing] = await Promise.all([
    db.query.facilities.findFirst({
      where: eq(facilities.id, facilityId),
      columns: { level: true },
    }),
    db.query.facilityListings.findMany({
      where: eq(facilityListings.facilityId, facilityId),
      columns: { cardId: true },
    }),
  ]);
  if (!facility) return [];
  const existingIds = existing.map((l) => l.cardId);

  const levelFilter = and(isNotNull(cards.priceCredits), lte(cards.level, facility.level));
  return db.query.cards.findMany({
    where: existingIds.length > 0 ? and(levelFilter, notInArray(cards.id, existingIds)) : levelFilter,
    orderBy: [asc(cards.title)],
  });
}

export interface RestockOutcome {
  filled: number;
  skipped: number;
  reasons: string[];
}

/**
 * Restocks a facility's rotating slots per its configured restock rules (see
 * lib/facilities.ts planRestock), only ever drawing cards at or below the
 * facility's level. Each slot is upserted independently in a try/catch so
 * one failing write doesn't abort the rest — a slot with no matching rule or
 * no eligible card is left with its prior listing untouched and reported
 * back as a skip reason, never emptied or crashed on.
 */
export async function restockFacility(facilityId: string): Promise<RestockOutcome> {
  const db = getDb();
  const facility = await db.query.facilities.findFirst({ where: eq(facilities.id, facilityId) });
  if (!facility) return { filled: 0, skipped: 0, reasons: [] };

  const [ruleRows, existingListings, priceableCards] = await Promise.all([
    db.query.facilityRestockRules.findMany({
      where: eq(facilityRestockRules.facilityId, facilityId),
    }),
    db.query.facilityListings.findMany({ where: eq(facilityListings.facilityId, facilityId) }),
    db.query.cards.findMany({
      where: and(isNotNull(cards.priceCredits), lte(cards.level, facility.level)),
      columns: { id: true, category: true, level: true },
    }),
  ]);

  const rules: RestockRule[] = ruleRows.map((r) => ({
    id: r.id,
    category: r.category,
    level: r.level,
    weight: r.weight,
  }));
  const eligible: EligibleCard[] = priceableCards.map((c) => ({
    id: c.id,
    category: c.category,
    level: c.level,
  }));
  const existingBySlot = new Map(
    existingListings
      .filter((l) => l.slotIndex != null)
      .map((l) => [l.slotIndex as number, l]),
  );
  // Every rotation slot is re-rolled by this call, so a card currently
  // sitting in one is fair game to be picked again (especially when it's
  // the only eligible match) — only *manual* listings are permanent and
  // must never be duplicated into a rotation slot.
  const alreadyListedCardIds = existingListings
    .filter((l) => l.source === "manual")
    .map((l) => l.cardId);

  const plan = planRestock(rules, eligible, alreadyListedCardIds, facility.rotatingSlotCount);

  let filled = 0;
  let skipped = 0;
  const reasons: string[] = [];

  for (const slot of plan) {
    if (!slot.cardId) {
      skipped++;
      reasons.push(
        slot.ruleId
          ? `Slot ${slot.slotIndex + 1}: no eligible cards for the drawn rule`
          : `Slot ${slot.slotIndex + 1}: no restock rules configured`,
      );
      continue;
    }
    try {
      const existingRow = existingBySlot.get(slot.slotIndex);
      if (existingRow) {
        await db
          .update(facilityListings)
          .set({ cardId: slot.cardId, addedAt: new Date() })
          .where(eq(facilityListings.id, existingRow.id));
      } else {
        const row: NewFacilityListing = {
          facilityId,
          cardId: slot.cardId,
          source: "rotation",
          slotIndex: slot.slotIndex,
        };
        await db.insert(facilityListings).values(row);
      }
      filled++;
    } catch (err) {
      skipped++;
      reasons.push(`Slot ${slot.slotIndex + 1}: write failed`);
      console.error(`Facility restock failed for facility ${facilityId}, slot ${slot.slotIndex}:`, err);
    }
  }

  return { filled, skipped, reasons };
}

/** Deletes rotation-sourced listings whose slot no longer exists, called
 *  immediately when an admin shrinks a facility's rotatingSlotCount so the
 *  change takes effect right away rather than waiting for the next restock. */
export async function pruneRotationSlots(facilityId: string, newSlotCount: number): Promise<void> {
  const db = getDb();
  await db
    .delete(facilityListings)
    .where(
      and(
        eq(facilityListings.facilityId, facilityId),
        eq(facilityListings.source, "rotation"),
        gte(facilityListings.slotIndex, newSlotCount),
      ),
    );
}

/** Label for a restock rule row, e.g. "Tech · Level 2". */
export function ruleLabel(category: CardCategory, level: number): string {
  return `${CARD_CATEGORY_META[category].label} · Level ${level}`;
}
