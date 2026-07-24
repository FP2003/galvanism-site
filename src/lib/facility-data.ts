import { eq, and, asc, desc, isNotNull, gte, lte, notInArray, inArray } from "drizzle-orm";
import { getDb } from "./db";
import {
  facilities,
  facilityListings,
  facilityListingPurchases,
  facilityRestockRules,
  facilityXpOfferings,
  facilityPerks,
  facilityPerkContributions,
  facilityOngoingEntries,
  characterSlotPurchases,
  characterOfferingPurchases,
  creditLedger,
  cards,
  cardEffects,
  type NewFacilityListing,
} from "./schema";
import { CARD_CATEGORY_META, ITEM_SUBCATEGORY_META, type CardCategory, type ItemSubcategory } from "./cards";
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

/** A character's perk contributions with the perk + facility joined in —
 *  feeds the admin player page's perk panel (mirrors getCharacterCards' role
 *  for card inventory). */
export async function getCharacterPerkContributions(characterId: string) {
  const db = getDb();
  return db.query.facilityPerkContributions.findMany({
    where: eq(facilityPerkContributions.characterId, characterId),
    with: { perk: { with: { facility: true } } },
    orderBy: [desc(facilityPerkContributions.createdAt)],
  });
}

export interface PerkPool {
  total: number;
  byCharacter: { callsign: string; amount: number }[];
}

/** Pooled contributions per perk, plus a per-character breakdown (sorted by
 *  amount desc) — feeds each perk row's progress bar and the facility-level
 *  rollup panel. Contribution rows are never deleted (creditLedger/xpLedger
 *  convention), so a perk's total only grows even past its price (funding
 *  stops mattering once `facilityPerks.fundedAt` is set, but the ledger keeps
 *  the full history). Always returns an entry for every requested id, even
 *  one with zero contributions. */
export async function getPerkContributionPools(perkIds: string[]): Promise<Map<string, PerkPool>> {
  const pools = new Map<string, PerkPool>(perkIds.map((id) => [id, { total: 0, byCharacter: [] }]));
  if (perkIds.length === 0) return pools;

  const db = getDb();
  const rows = await db.query.facilityPerkContributions.findMany({
    where: inArray(facilityPerkContributions.perkId, perkIds),
    with: { character: { columns: { callsign: true } } },
  });

  const byCharacter = new Map<string, Map<string, number>>();
  for (const r of rows) {
    pools.get(r.perkId)!.total += r.amount;
    let perCharacter = byCharacter.get(r.perkId);
    if (!perCharacter) {
      perCharacter = new Map();
      byCharacter.set(r.perkId, perCharacter);
    }
    perCharacter.set(r.character.callsign, (perCharacter.get(r.character.callsign) ?? 0) + r.amount);
  }
  for (const [perkId, perCharacter] of byCharacter) {
    pools.get(perkId)!.byCharacter = [...perCharacter.entries()]
      .map(([callsign, amount]) => ({ callsign, amount }))
      .sort((a, b) => b.amount - a.amount);
  }
  return pools;
}

/** How many times this character has already bought each of the given
 *  slot_upgrade offerings — feeds nextEscalatingOfferingCost (lib/facilities.ts)
 *  so the facility page can display and charge this character's actual next
 *  price, not the offering's flat base cost. Always returns an entry for
 *  every requested id, even one with zero prior purchases, same convention
 *  as getPerkContributionPools. */
export async function getSlotPurchaseCounts(
  characterId: string,
  offeringIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>(offeringIds.map((id) => [id, 0]));
  if (offeringIds.length === 0) return counts;

  const db = getDb();
  const rows = await db.query.characterSlotPurchases.findMany({
    where: and(
      eq(characterSlotPurchases.characterId, characterId),
      inArray(characterSlotPurchases.offeringId, offeringIds),
    ),
    columns: { offeringId: true },
  });
  for (const r of rows) {
    if (!r.offeringId) continue;
    counts.set(r.offeringId, (counts.get(r.offeringId) ?? 0) + 1);
  }
  return counts;
}

/** Same shape and purpose as getSlotPurchaseCounts, but for descriptive
 *  offerings — reads characterOfferingPurchases instead of
 *  characterSlotPurchases (descriptive offerings grant no game mechanic, so
 *  they get their own purchase-count ledger rather than sharing the
 *  slot-upgrade one). */
export async function getOfferingPurchaseCounts(
  characterId: string,
  offeringIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>(offeringIds.map((id) => [id, 0]));
  if (offeringIds.length === 0) return counts;

  const db = getDb();
  const rows = await db.query.characterOfferingPurchases.findMany({
    where: and(
      eq(characterOfferingPurchases.characterId, characterId),
      inArray(characterOfferingPurchases.offeringId, offeringIds),
    ),
    columns: { offeringId: true },
  });
  for (const r of rows) {
    if (!r.offeringId) continue;
    counts.set(r.offeringId, (counts.get(r.offeringId) ?? 0) + 1);
  }
  return counts;
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
 * still an unrefunded purchase (delta < 0). purchaseListing tags its debit
 * row's refCode with the purchased card's id, and a refund
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
 *  panel (replacing the mock fixture). `facilityId` lets that panel link
 *  each row straight through to /facilities/[id]. */
export async function getUnresolvedOngoingEntries(limit = 5) {
  const db = getDb();
  const rows = await db.query.facilityOngoingEntries.findMany({
    where: eq(facilityOngoingEntries.resolved, false),
    with: { facility: { columns: { name: true } } },
    orderBy: [desc(facilityOngoingEntries.createdAt)],
    limit,
  });
  return rows.map((r) => ({ facilityId: r.facilityId, facility: r.facility.name, label: r.label }));
}

export interface FacilityUpgradeProgress {
  facilityId: string;
  facilityName: string;
  level: number;
  totalCost: number;
  totalContributed: number;
  fundedCount: number;
  perkCount: number;
}

/** Station facilities whose next level-up has received at least one perk
 *  contribution, ranked by funding progress — feeds the command dashboard's
 *  "Facility Processes" panel, listed underneath the Ongoing entries. Mirrors
 *  the totalCost/totalContributed/fundedCount math in the facility detail
 *  page's LevelProgress panel (app/facilities/[id]/page.tsx), just rolled up
 *  across every station facility instead of one. */
export async function getFacilityUpgradesInProgress(): Promise<FacilityUpgradeProgress[]> {
  const db = getDb();
  const stationFacilities = await db.query.facilities.findMany({
    where: eq(facilities.kind, "station"),
    with: { perks: { where: eq(facilityPerks.active, true) } },
  });

  const byFacility = stationFacilities
    .map((facility) => ({
      facility,
      availablePerks: facility.perks.filter((p) => p.minLevel <= facility.level),
    }))
    .filter((f) => f.availablePerks.length > 0);

  const pools = await getPerkContributionPools(
    byFacility.flatMap((f) => f.availablePerks.map((p) => p.id)),
  );

  const progress: FacilityUpgradeProgress[] = [];
  for (const { facility, availablePerks } of byFacility) {
    const totalContributed = availablePerks.reduce(
      (sum, p) => sum + Math.min(pools.get(p.id)!.total, p.priceCredits),
      0,
    );
    if (totalContributed === 0) continue;
    progress.push({
      facilityId: facility.id,
      facilityName: facility.name,
      level: facility.level,
      totalCost: availablePerks.reduce((sum, p) => sum + p.priceCredits, 0),
      totalContributed,
      fundedCount: availablePerks.filter((p) => p.fundedAt != null).length,
      perkCount: availablePerks.length,
    });
  }
  return progress.sort((a, b) => b.totalContributed / b.totalCost - a.totalContributed / a.totalCost);
}

/** Library cards with a price set, at or below this facility's level, that
 *  aren't already listed here — feeds the admin "add manual listing" picker.
 *  An optional `category` narrows the pool further, reused by the "replace
 *  with N random cards of a category" action. */
export async function getEligibleListingCards(facilityId: string, category?: CardCategory) {
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

  const filters = [isNotNull(cards.priceCredits), lte(cards.level, facility.level)];
  if (category) filters.push(eq(cards.category, category));
  if (existingIds.length > 0) filters.push(notInArray(cards.id, existingIds));

  return db.query.cards.findMany({
    where: and(...filters),
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
      columns: { id: true, category: true, subcategory: true, level: true },
    }),
  ]);

  const rules: RestockRule[] = ruleRows.map((r) => ({
    id: r.id,
    category: r.category,
    subcategory: r.subcategory,
    level: r.level,
    weight: r.weight,
  }));
  const eligible: EligibleCard[] = priceableCards.map((c) => ({
    id: c.id,
    category: c.category,
    subcategory: c.subcategory,
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
        // The slot's card is changing, so any claims on its old card are
        // stale — clear them so the newly rolled card starts fully in stock
        // (rotation listings always keep quantityTotal at its default of 1).
        await db
          .delete(facilityListingPurchases)
          .where(eq(facilityListingPurchases.listingId, existingRow.id));
        await db
          .update(facilityListings)
          .set({ cardId: slot.cardId, quantitySold: 0, addedAt: new Date() })
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

/** Label for a restock rule row, e.g. "Tech · Level 2" or, for an item rule
 *  scoped to a subcategory, "Item · Rifle · Level 2". */
export function ruleLabel(
  category: CardCategory,
  level: number,
  subcategory?: ItemSubcategory | null,
): string {
  const categoryLabel = subcategory
    ? `${CARD_CATEGORY_META[category].label} · ${ITEM_SUBCATEGORY_META[subcategory].label}`
    : CARD_CATEGORY_META[category].label;
  return `${categoryLabel} · Level ${level}`;
}
