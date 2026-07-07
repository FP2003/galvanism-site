"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  shops,
  shopListings,
  shopRestockRules,
  cards,
  type NewShop,
  type NewShopListing,
  type NewShopRestockRule,
} from "@/lib/schema";
import { CARD_CATEGORIES, type CardCategory } from "@/lib/cards";
import { restockShop, pruneRotationSlots, ruleLabel } from "@/lib/shop-data";

/*
 * Shop CRUD + listing/restock-rule management (Phase 4, admin only). Mirrors
 * app/admin/card-actions.ts's shape: requireAdmin() -> validate -> mutate ->
 * revalidatePath. Listings and restock rules are independent rows with their
 * own lifecycle (unlike card effects, which save atomically with their
 * card), so each gets its own small action rather than a batched replace.
 */
export type FormState = { ok?: boolean; error?: string; message?: string };

function textField(formData: FormData, key: string, max?: number): string {
  const value = String(formData.get(key) ?? "").trim();
  return max ? value.slice(0, max) : value;
}

const NAME_MAX = 64;
const DESCRIPTION_MAX = 400;

function intField(formData: FormData, key: string, fallback: number): number {
  const raw = textField(formData, key);
  if (raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

function optionalIntField(formData: FormData, key: string): number | null {
  const raw = textField(formData, key);
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.floor(n) : NaN;
}

export async function createShop(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

  const name = textField(formData, "name", NAME_MAX);
  if (!name) return { error: "A shop name is required." };
  const description = textField(formData, "description", DESCRIPTION_MAX) || null;
  const isOpen = textField(formData, "isOpen") === "open";
  const rotatingSlotCount = intField(formData, "rotatingSlotCount", 4);
  if (rotatingSlotCount < 0) return { error: "Slot count must be zero or more." };
  const restockIntervalOps = optionalIntField(formData, "restockIntervalOps");
  if (Number.isNaN(restockIntervalOps) || (restockIntervalOps != null && restockIntervalOps < 1)) {
    return { error: "Restock interval must be a whole number of 1 or more." };
  }

  const values: NewShop = {
    name,
    description,
    isOpen,
    rotatingSlotCount,
    restockIntervalOps,
    createdByUserId: admin.id,
  };

  const db = getDb();
  await db.insert(shops).values(values);

  revalidatePath("/admin/shops");
  return { ok: true, message: `Shop "${name}" created.` };
}

export async function updateShop(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const shopId = textField(formData, "shopId");
  if (!shopId) return { error: "Missing shop reference." };

  const name = textField(formData, "name", NAME_MAX);
  if (!name) return { error: "A shop name is required." };
  const description = textField(formData, "description", DESCRIPTION_MAX) || null;
  const isOpen = textField(formData, "isOpen") === "open";
  const rotatingSlotCount = intField(formData, "rotatingSlotCount", 4);
  if (rotatingSlotCount < 0) return { error: "Slot count must be zero or more." };
  const restockIntervalOps = optionalIntField(formData, "restockIntervalOps");
  if (Number.isNaN(restockIntervalOps) || (restockIntervalOps != null && restockIntervalOps < 1)) {
    return { error: "Restock interval must be a whole number of 1 or more." };
  }

  const db = getDb();
  const [updated] = await db
    .update(shops)
    .set({ name, description, isOpen, rotatingSlotCount, restockIntervalOps, updatedAt: new Date() })
    .where(eq(shops.id, shopId))
    .returning({ id: shops.id });
  if (!updated) return { error: "Shop not found." };

  // Shrinking the slot count drops any rotation listings that no longer have
  // a slot immediately, rather than waiting for the next restock.
  await pruneRotationSlots(shopId, rotatingSlotCount);

  revalidatePath("/admin/shops");
  revalidatePath(`/admin/shops/${shopId}`);
  revalidatePath("/requisitions");
  return { ok: true, message: `Shop "${name}" updated.` };
}

export async function setShopOpen(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const shopId = textField(formData, "shopId");
  const isOpen = textField(formData, "isOpen") === "true";
  if (!shopId) return { error: "Missing shop reference." };

  const db = getDb();
  const [updated] = await db
    .update(shops)
    .set({ isOpen, updatedAt: new Date() })
    .where(eq(shops.id, shopId))
    .returning({ id: shops.id });
  if (!updated) return { error: "Shop not found." };

  revalidatePath("/admin/shops");
  revalidatePath("/requisitions");
  return { ok: true, message: isOpen ? "Shop opened." : "Shop closed." };
}

export async function deleteShop(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const shopId = textField(formData, "shopId");
  if (!shopId) return { error: "Missing shop reference." };

  const db = getDb();
  await db.delete(shops).where(eq(shops.id, shopId));

  revalidatePath("/admin/shops");
  revalidatePath("/requisitions");
  return { ok: true, message: "Shop deleted." };
}

// Adds a card to a shop's manual listings. The card must already carry a
// price (set in the Card Library) — a shop can't sell something with no
// price. onConflictDoNothing is a defense-in-depth safety net: the picker
// this feeds from (getEligibleListingCards) already excludes listed cards.
export async function addListing(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const shopId = textField(formData, "shopId");
  const cardId = textField(formData, "cardId");
  if (!shopId || !cardId) return { error: "Pick a card to list." };

  const db = getDb();
  const card = await db.query.cards.findFirst({
    where: eq(cards.id, cardId),
    columns: { priceCredits: true, title: true },
  });
  if (!card) return { error: "Card not found." };
  if (card.priceCredits == null) {
    return { error: "This card has no price set — set one in the Card Library first." };
  }

  const values: NewShopListing = { shopId, cardId, source: "manual" };
  await db.insert(shopListings).values(values).onConflictDoNothing();

  revalidatePath(`/admin/shops/${shopId}`);
  revalidatePath("/requisitions");
  return { ok: true, message: `${card.title} added to the shop.` };
}

// Removes a listing regardless of source — an admin can pull a rotation-
// picked card just as freely as a manually added one.
export async function removeListing(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const listingId = textField(formData, "listingId");
  if (!listingId) return { error: "Missing listing reference." };

  const db = getDb();
  const [row] = await db
    .delete(shopListings)
    .where(eq(shopListings.id, listingId))
    .returning({ shopId: shopListings.shopId });
  if (!row) return { error: "Listing not found." };

  revalidatePath(`/admin/shops/${row.shopId}`);
  revalidatePath("/requisitions");
  return { ok: true, message: "Listing removed." };
}

export async function addRestockRule(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const shopId = textField(formData, "shopId");
  if (!shopId) return { error: "Missing shop reference." };

  const categoryRaw = textField(formData, "category") as CardCategory;
  if (!CARD_CATEGORIES.includes(categoryRaw)) {
    return { error: "Pick a card category." };
  }
  const level = intField(formData, "level", 1);
  if (level < 1) return { error: "Level must be 1 or more." };
  const weight = intField(formData, "weight", 0);
  if (weight <= 0) return { error: "Weight must be a whole number greater than zero." };

  const values: NewShopRestockRule = { shopId, category: categoryRaw, level, weight };
  const db = getDb();
  await db.insert(shopRestockRules).values(values);

  revalidatePath(`/admin/shops/${shopId}`);
  return { ok: true, message: `Rule added: ${ruleLabel(categoryRaw, level)} (weight ${weight}).` };
}

export async function deleteRestockRule(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const ruleId = textField(formData, "ruleId");
  if (!ruleId) return { error: "Missing rule reference." };

  const db = getDb();
  const [row] = await db
    .delete(shopRestockRules)
    .where(eq(shopRestockRules.id, ruleId))
    .returning({ shopId: shopRestockRules.shopId });
  if (!row) return { error: "Rule not found." };

  revalidatePath(`/admin/shops/${row.shopId}`);
  return { ok: true, message: "Rule removed." };
}

// Runs a weighted restock immediately and always resets the ops counter to
// zero — a manual restock is a fresh baseline regardless of what triggered
// it, so the next mission payout doesn't immediately re-fire on top of it.
export async function restockNow(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const shopId = textField(formData, "shopId");
  if (!shopId) return { error: "Missing shop reference." };

  const outcome = await restockShop(shopId);

  const db = getDb();
  await db
    .update(shops)
    .set({ opsSinceRestock: 0, updatedAt: new Date() })
    .where(eq(shops.id, shopId));

  revalidatePath(`/admin/shops/${shopId}`);
  revalidatePath("/requisitions");

  const total = outcome.filled + outcome.skipped;
  const summary = `Restocked ${outcome.filled}/${total} slot${total === 1 ? "" : "s"}.`;
  const detail = outcome.reasons.length > 0 ? ` ${outcome.reasons.join(" ")}` : "";
  return { ok: true, message: `${summary}${detail}` };
}
