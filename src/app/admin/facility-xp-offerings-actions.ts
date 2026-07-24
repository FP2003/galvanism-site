"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { facilities, facilityXpOfferings, type NewFacilityXpOffering } from "@/lib/schema";
import {
  XP_OFFERING_TYPES,
  isValidOfferingTarget,
  type XpOfferingType,
  type OfferingCurrency,
} from "@/lib/facilities";

/*
 * Admin CRUD for a facility's XP-offering catalog (Phase 6 Step 2). Same
 * requireAdmin -> validate -> mutate -> revalidatePath shape as
 * facility-actions.ts. Offerings support in-place edit (unlike restock rules
 * and perks, which stay add/delete-only), plus an active toggle to retire one
 * without deleting it.
 */
export type FormState = { ok?: boolean; error?: string; message?: string };

function textField(formData: FormData, key: string, max?: number): string {
  const value = String(formData.get(key) ?? "").trim();
  return max ? value.slice(0, max) : value;
}

function intField(formData: FormData, key: string, fallback: number): number {
  const raw = textField(formData, key);
  if (raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

// Currency is fixed by type for stat_bump/resource_refill/slot_upgrade
// (server-enforced regardless of any submitted value) — a descriptive
// offering is the one type where the admin's form choice is honored.
function resolveCostCurrency(offeringType: XpOfferingType, formData: FormData): OfferingCurrency {
  if (offeringType === "resource_refill") return "credits";
  if (offeringType === "descriptive") {
    return textField(formData, "costCurrency") === "credits" ? "credits" : "xp";
  }
  return "xp";
}

const NAME_MAX = 64;
const DESCRIPTION_MAX = 400;

export async function addXpOffering(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const facilityId = textField(formData, "facilityId");
  if (!facilityId) return { error: "Missing facility reference." };

  const name = textField(formData, "name", NAME_MAX);
  if (!name) return { error: "A name is required." };
  const description = textField(formData, "description", DESCRIPTION_MAX) || null;

  const offeringType = textField(formData, "offeringType") as XpOfferingType;
  if (!XP_OFFERING_TYPES.includes(offeringType)) return { error: "Pick an offering type." };
  const isDescriptive = offeringType === "descriptive";

  const targetKey = isDescriptive ? "" : textField(formData, "targetKey");
  if (!isValidOfferingTarget(offeringType, targetKey)) {
    return { error: "Pick a target that matches the chosen offering type." };
  }

  const amount = isDescriptive ? 0 : intField(formData, "amount", 0);
  if (!isDescriptive && amount <= 0) {
    return { error: "Amount must be a whole number greater than zero." };
  }
  const costCurrency = resolveCostCurrency(offeringType, formData);
  const cost = intField(formData, "cost", 0);
  const currencyLabel = costCurrency === "xp" ? "XP" : "Credit";
  if (cost <= 0) return { error: `${currencyLabel} cost must be a whole number greater than zero.` };
  const costIncrement = intField(formData, "costIncrement", 0);
  if (costIncrement < 0) return { error: "Cost increment must be a whole number of 0 or more." };
  const minLevel = intField(formData, "minLevel", 1);
  if (minLevel < 1) return { error: "Min level must be 1 or more." };

  const db = getDb();
  const facility = await db.query.facilities.findFirst({
    where: eq(facilities.id, facilityId),
    columns: { id: true },
  });
  if (!facility) return { error: "Facility not found." };

  const values: NewFacilityXpOffering = {
    facilityId,
    name,
    description,
    offeringType,
    targetKey,
    amount,
    cost,
    costCurrency,
    costIncrement,
    minLevel,
  };
  await db.insert(facilityXpOfferings).values(values);

  revalidatePath(`/admin/facilities/${facilityId}`);
  revalidatePath(`/facilities/${facilityId}`);
  return { ok: true, message: `Offering "${name}" added.` };
}

export async function updateXpOffering(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const offeringId = textField(formData, "offeringId");
  if (!offeringId) return { error: "Missing offering reference." };

  const name = textField(formData, "name", NAME_MAX);
  if (!name) return { error: "A name is required." };
  const description = textField(formData, "description", DESCRIPTION_MAX) || null;

  const offeringType = textField(formData, "offeringType") as XpOfferingType;
  if (!XP_OFFERING_TYPES.includes(offeringType)) return { error: "Pick an offering type." };
  const isDescriptive = offeringType === "descriptive";

  const targetKey = isDescriptive ? "" : textField(formData, "targetKey");
  if (!isValidOfferingTarget(offeringType, targetKey)) {
    return { error: "Pick a target that matches the chosen offering type." };
  }

  const amount = isDescriptive ? 0 : intField(formData, "amount", 0);
  if (!isDescriptive && amount <= 0) {
    return { error: "Amount must be a whole number greater than zero." };
  }
  const costCurrency = resolveCostCurrency(offeringType, formData);
  const cost = intField(formData, "cost", 0);
  const currencyLabel = costCurrency === "xp" ? "XP" : "Credit";
  if (cost <= 0) return { error: `${currencyLabel} cost must be a whole number greater than zero.` };
  const costIncrement = intField(formData, "costIncrement", 0);
  if (costIncrement < 0) return { error: "Cost increment must be a whole number of 0 or more." };
  const minLevel = intField(formData, "minLevel", 1);
  if (minLevel < 1) return { error: "Min level must be 1 or more." };

  const db = getDb();
  const [updated] = await db
    .update(facilityXpOfferings)
    .set({
      name,
      description,
      offeringType,
      targetKey,
      amount,
      cost,
      costCurrency,
      costIncrement,
      minLevel,
      updatedAt: new Date(),
    })
    .where(eq(facilityXpOfferings.id, offeringId))
    .returning({ facilityId: facilityXpOfferings.facilityId });
  if (!updated) return { error: "Offering not found." };

  revalidatePath(`/admin/facilities/${updated.facilityId}`);
  revalidatePath(`/facilities/${updated.facilityId}`);
  return { ok: true, message: `Offering "${name}" updated.` };
}

export async function setXpOfferingActive(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const offeringId = textField(formData, "offeringId");
  const active = textField(formData, "active") === "true";
  if (!offeringId) return { error: "Missing offering reference." };

  const db = getDb();
  const [updated] = await db
    .update(facilityXpOfferings)
    .set({ active, updatedAt: new Date() })
    .where(eq(facilityXpOfferings.id, offeringId))
    .returning({ facilityId: facilityXpOfferings.facilityId });
  if (!updated) return { error: "Offering not found." };

  revalidatePath(`/admin/facilities/${updated.facilityId}`);
  revalidatePath(`/facilities/${updated.facilityId}`);
  return { ok: true, message: active ? "Offering activated." : "Offering deactivated." };
}

export async function deleteXpOffering(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const offeringId = textField(formData, "offeringId");
  if (!offeringId) return { error: "Missing offering reference." };

  const db = getDb();
  const [row] = await db
    .delete(facilityXpOfferings)
    .where(eq(facilityXpOfferings.id, offeringId))
    .returning({ facilityId: facilityXpOfferings.facilityId });
  if (!row) return { error: "Offering not found." };

  revalidatePath(`/admin/facilities/${row.facilityId}`);
  revalidatePath(`/facilities/${row.facilityId}`);
  return { ok: true, message: "Offering removed." };
}
