import { eq, and, asc, desc, isNotNull, gte, notInArray } from "drizzle-orm";
import { getDb } from "./db";
import {
  shops,
  shopListings,
  shopRestockRules,
  cards,
  cardEffects,
  type NewShopListing,
} from "./schema";
import { CARD_CATEGORY_META, type CardCategory } from "./cards";
import { planRestock, type EligibleCard, type RestockRule } from "./shops";

/*
 * Shop read/write model (Phase 4). DB access + the restock orchestration
 * around the pure logic in lib/shops.ts — this file only fetches rows and
 * applies the plan; the weighted-draw rules themselves live there, tested in
 * isolation.
 */

/** Every shop, newest first — for the admin shop list. */
export async function getShops() {
  const db = getDb();
  return db.query.shops.findMany({
    with: { listings: true, restockRules: true },
    orderBy: [desc(shops.createdAt)],
  });
}

/** One shop with its listings (joined to their card) and restock rules. */
export async function getShop(shopId: string) {
  const db = getDb();
  return db.query.shops.findFirst({
    where: eq(shops.id, shopId),
    with: {
      listings: { with: { card: true }, orderBy: [asc(shopListings.sortOrder)] },
      restockRules: { orderBy: [asc(shopRestockRules.sortOrder)] },
    },
  });
}

/** Open shops with their listings (joined to their card + effects, price
 *  included) — the player-facing Requisitions view; GameCard needs the
 *  card's effects to render its body, same shape as getCardLibrary. */
export async function getOpenShopsWithListings() {
  const db = getDb();
  return db.query.shops.findMany({
    where: eq(shops.isOpen, true),
    with: {
      listings: {
        with: { card: { with: { effects: { orderBy: [asc(cardEffects.sortOrder)] } } } },
        orderBy: [asc(shopListings.sortOrder)],
      },
    },
    orderBy: [asc(shops.name)],
  });
}

/** Library cards with a price set that aren't already listed in this shop —
 *  feeds the admin "add manual listing" picker. */
export async function getEligibleListingCards(shopId: string) {
  const db = getDb();
  const existing = await db.query.shopListings.findMany({
    where: eq(shopListings.shopId, shopId),
    columns: { cardId: true },
  });
  const existingIds = existing.map((l) => l.cardId);

  return db.query.cards.findMany({
    where: existingIds.length > 0
      ? and(isNotNull(cards.priceCredits), notInArray(cards.id, existingIds))
      : isNotNull(cards.priceCredits),
    orderBy: [asc(cards.title)],
  });
}

export interface RestockOutcome {
  filled: number;
  skipped: number;
  reasons: string[];
}

/**
 * Restocks a shop's rotating slots per its configured restock rules (see
 * lib/shops.ts planRestock). Each slot is upserted independently in a
 * try/catch so one failing write doesn't abort the rest — a slot with no
 * matching rule or no eligible card is left with its prior listing untouched
 * and reported back as a skip reason, never emptied or crashed on.
 */
export async function restockShop(shopId: string): Promise<RestockOutcome> {
  const db = getDb();
  const shop = await db.query.shops.findFirst({ where: eq(shops.id, shopId) });
  if (!shop) return { filled: 0, skipped: 0, reasons: [] };

  const [ruleRows, existingListings, priceableCards] = await Promise.all([
    db.query.shopRestockRules.findMany({ where: eq(shopRestockRules.shopId, shopId) }),
    db.query.shopListings.findMany({ where: eq(shopListings.shopId, shopId) }),
    db.query.cards.findMany({
      where: isNotNull(cards.priceCredits),
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

  const plan = planRestock(rules, eligible, alreadyListedCardIds, shop.rotatingSlotCount);

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
          .update(shopListings)
          .set({ cardId: slot.cardId, addedAt: new Date() })
          .where(eq(shopListings.id, existingRow.id));
      } else {
        const row: NewShopListing = {
          shopId,
          cardId: slot.cardId,
          source: "rotation",
          slotIndex: slot.slotIndex,
        };
        await db.insert(shopListings).values(row);
      }
      filled++;
    } catch (err) {
      skipped++;
      reasons.push(`Slot ${slot.slotIndex + 1}: write failed`);
      console.error(`Shop restock failed for shop ${shopId}, slot ${slot.slotIndex}:`, err);
    }
  }

  return { filled, skipped, reasons };
}

/** Deletes rotation-sourced listings whose slot no longer exists, called
 *  immediately when an admin shrinks a shop's rotatingSlotCount so the
 *  change takes effect right away rather than waiting for the next restock. */
export async function pruneRotationSlots(shopId: string, newSlotCount: number): Promise<void> {
  const db = getDb();
  await db
    .delete(shopListings)
    .where(
      and(
        eq(shopListings.shopId, shopId),
        eq(shopListings.source, "rotation"),
        gte(shopListings.slotIndex, newSlotCount),
      ),
    );
}

/** Label for a restock rule row, e.g. "Tech · Level 2". */
export function ruleLabel(category: CardCategory, level: number): string {
  return `${CARD_CATEGORY_META[category].label} · Level ${level}`;
}
