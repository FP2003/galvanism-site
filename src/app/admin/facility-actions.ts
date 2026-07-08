"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  facilities,
  facilityListings,
  facilityRestockRules,
  cards,
  type NewFacility,
  type NewFacilityListing,
  type NewFacilityRestockRule,
} from "@/lib/schema";
import { CARD_CATEGORIES, type CardCategory } from "@/lib/cards";
import { FACILITY_KINDS, isCardLevelUnlocked, type FacilityKind } from "@/lib/facilities";
import { restockFacility, pruneRotationSlots, ruleLabel } from "@/lib/facility-data";

/*
 * Facility CRUD + listing/restock-rule management (Phase 6, admin only,
 * absorbing Phase 4's shop-actions). Mirrors app/admin/card-actions.ts's
 * shape: requireAdmin() -> validate -> mutate -> revalidatePath. Listings and
 * restock rules are independent rows with their own lifecycle (unlike card
 * effects, which save atomically with their card), so each gets its own
 * small action rather than a batched replace.
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

export async function createFacility(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

  const name = textField(formData, "name", NAME_MAX);
  if (!name) return { error: "A facility name is required." };
  const description = textField(formData, "description", DESCRIPTION_MAX) || null;
  const isOpen = textField(formData, "isOpen") === "open";
  const kindRaw = textField(formData, "kind") as FacilityKind;
  if (!FACILITY_KINDS.includes(kindRaw)) return { error: "Pick a facility kind." };
  const level = intField(formData, "level", 1);
  if (level < 1) return { error: "Level must be 1 or more." };
  const rotatingSlotCount = intField(formData, "rotatingSlotCount", 4);
  if (rotatingSlotCount < 0) return { error: "Slot count must be zero or more." };
  const restockIntervalOps = optionalIntField(formData, "restockIntervalOps");
  if (Number.isNaN(restockIntervalOps) || (restockIntervalOps != null && restockIntervalOps < 1)) {
    return { error: "Restock interval must be a whole number of 1 or more." };
  }

  const values: NewFacility = {
    name,
    description,
    isOpen,
    kind: kindRaw,
    level,
    rotatingSlotCount,
    restockIntervalOps,
    createdByUserId: admin.id,
  };

  const db = getDb();
  await db.insert(facilities).values(values);

  revalidatePath("/admin/facilities");
  return { ok: true, message: `Facility "${name}" created.` };
}

export async function updateFacility(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const facilityId = textField(formData, "facilityId");
  if (!facilityId) return { error: "Missing facility reference." };

  const name = textField(formData, "name", NAME_MAX);
  if (!name) return { error: "A facility name is required." };
  const description = textField(formData, "description", DESCRIPTION_MAX) || null;
  const isOpen = textField(formData, "isOpen") === "open";
  const kindRaw = textField(formData, "kind") as FacilityKind;
  if (!FACILITY_KINDS.includes(kindRaw)) return { error: "Pick a facility kind." };
  const level = intField(formData, "level", 1);
  if (level < 1) return { error: "Level must be 1 or more." };
  const rotatingSlotCount = intField(formData, "rotatingSlotCount", 4);
  if (rotatingSlotCount < 0) return { error: "Slot count must be zero or more." };
  const restockIntervalOps = optionalIntField(formData, "restockIntervalOps");
  if (Number.isNaN(restockIntervalOps) || (restockIntervalOps != null && restockIntervalOps < 1)) {
    return { error: "Restock interval must be a whole number of 1 or more." };
  }

  const db = getDb();
  const [updated] = await db
    .update(facilities)
    .set({
      name,
      description,
      isOpen,
      kind: kindRaw,
      level,
      rotatingSlotCount,
      restockIntervalOps,
      updatedAt: new Date(),
    })
    .where(eq(facilities.id, facilityId))
    .returning({ id: facilities.id });
  if (!updated) return { error: "Facility not found." };

  // Shrinking the slot count drops any rotation listings that no longer have
  // a slot immediately, rather than waiting for the next restock.
  await pruneRotationSlots(facilityId, rotatingSlotCount);

  revalidatePath("/admin/facilities");
  revalidatePath(`/admin/facilities/${facilityId}`);
  revalidatePath("/facilities");
  revalidatePath(`/facilities/${facilityId}`);
  return { ok: true, message: `Facility "${name}" updated.` };
}

export async function setFacilityOpen(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const facilityId = textField(formData, "facilityId");
  const isOpen = textField(formData, "isOpen") === "true";
  if (!facilityId) return { error: "Missing facility reference." };

  const db = getDb();
  const [updated] = await db
    .update(facilities)
    .set({ isOpen, updatedAt: new Date() })
    .where(eq(facilities.id, facilityId))
    .returning({ id: facilities.id });
  if (!updated) return { error: "Facility not found." };

  revalidatePath("/admin/facilities");
  revalidatePath("/facilities");
  revalidatePath(`/facilities/${facilityId}`);
  return { ok: true, message: isOpen ? "Facility opened." : "Facility closed." };
}

export async function deleteFacility(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const facilityId = textField(formData, "facilityId");
  if (!facilityId) return { error: "Missing facility reference." };

  const db = getDb();
  await db.delete(facilities).where(eq(facilities.id, facilityId));

  revalidatePath("/admin/facilities");
  revalidatePath("/facilities");
  return { ok: true, message: "Facility deleted." };
}

// Adds a card to a facility's manual listings. The card must already carry a
// price (set in the Card Library) and be at or below the facility's level —
// a facility can't sell something with no price, or gear above what it's
// leveled to unlock. onConflictDoNothing is a defense-in-depth safety net:
// the picker this feeds from (getEligibleListingCards) already excludes
// listed/over-level cards.
export async function addListing(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const facilityId = textField(formData, "facilityId");
  const cardId = textField(formData, "cardId");
  if (!facilityId || !cardId) return { error: "Pick a card to list." };

  const db = getDb();
  const [facility, card] = await Promise.all([
    db.query.facilities.findFirst({ where: eq(facilities.id, facilityId), columns: { level: true } }),
    db.query.cards.findFirst({
      where: eq(cards.id, cardId),
      columns: { priceCredits: true, title: true, level: true },
    }),
  ]);
  if (!facility) return { error: "Facility not found." };
  if (!card) return { error: "Card not found." };
  if (card.priceCredits == null) {
    return { error: "This card has no price set — set one in the Card Library first." };
  }
  if (!isCardLevelUnlocked(card.level, facility.level)) {
    return { error: "This card's level is above what this facility has unlocked." };
  }

  const values: NewFacilityListing = { facilityId, cardId, source: "manual" };
  await db.insert(facilityListings).values(values).onConflictDoNothing();

  revalidatePath(`/admin/facilities/${facilityId}`);
  revalidatePath(`/facilities/${facilityId}`);
  return { ok: true, message: `${card.title} added to the facility.` };
}

// Removes a listing regardless of source — an admin can pull a rotation-
// picked card just as freely as a manually added one.
export async function removeListing(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const listingId = textField(formData, "listingId");
  if (!listingId) return { error: "Missing listing reference." };

  const db = getDb();
  const [row] = await db
    .delete(facilityListings)
    .where(eq(facilityListings.id, listingId))
    .returning({ facilityId: facilityListings.facilityId });
  if (!row) return { error: "Listing not found." };

  revalidatePath(`/admin/facilities/${row.facilityId}`);
  revalidatePath(`/facilities/${row.facilityId}`);
  return { ok: true, message: "Listing removed." };
}

export async function addRestockRule(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const facilityId = textField(formData, "facilityId");
  if (!facilityId) return { error: "Missing facility reference." };

  const categoryRaw = textField(formData, "category") as CardCategory;
  if (!CARD_CATEGORIES.includes(categoryRaw)) {
    return { error: "Pick a card category." };
  }
  const level = intField(formData, "level", 1);
  if (level < 1) return { error: "Level must be 1 or more." };
  const weight = intField(formData, "weight", 0);
  if (weight <= 0) return { error: "Weight must be a whole number greater than zero." };

  const db = getDb();
  const facility = await db.query.facilities.findFirst({
    where: eq(facilities.id, facilityId),
    columns: { level: true },
  });
  if (!facility) return { error: "Facility not found." };
  if (!isCardLevelUnlocked(level, facility.level)) {
    return { error: `This facility is only level ${facility.level} — it can't roll level ${level} cards yet.` };
  }

  const values: NewFacilityRestockRule = { facilityId, category: categoryRaw, level, weight };
  await db.insert(facilityRestockRules).values(values);

  revalidatePath(`/admin/facilities/${facilityId}`);
  return { ok: true, message: `Rule added: ${ruleLabel(categoryRaw, level)} (weight ${weight}).` };
}

export async function deleteRestockRule(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const ruleId = textField(formData, "ruleId");
  if (!ruleId) return { error: "Missing rule reference." };

  const db = getDb();
  const [row] = await db
    .delete(facilityRestockRules)
    .where(eq(facilityRestockRules.id, ruleId))
    .returning({ facilityId: facilityRestockRules.facilityId });
  if (!row) return { error: "Rule not found." };

  revalidatePath(`/admin/facilities/${row.facilityId}`);
  return { ok: true, message: "Rule removed." };
}

// Runs a weighted restock immediately and always resets the ops counter to
// zero — a manual restock is a fresh baseline regardless of what triggered
// it, so the next mission payout doesn't immediately re-fire on top of it.
export async function restockNow(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const facilityId = textField(formData, "facilityId");
  if (!facilityId) return { error: "Missing facility reference." };

  const outcome = await restockFacility(facilityId);

  const db = getDb();
  await db
    .update(facilities)
    .set({ opsSinceRestock: 0, updatedAt: new Date() })
    .where(eq(facilities.id, facilityId));

  revalidatePath(`/admin/facilities/${facilityId}`);
  revalidatePath(`/facilities/${facilityId}`);

  const total = outcome.filled + outcome.skipped;
  const summary = `Restocked ${outcome.filled}/${total} slot${total === 1 ? "" : "s"}.`;
  const detail = outcome.reasons.length > 0 ? ` ${outcome.reasons.join(" ")}` : "";
  return { ok: true, message: `${summary}${detail}` };
}
