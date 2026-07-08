"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { facilities, facilityPerks, type NewFacilityPerk } from "@/lib/schema";

/*
 * Admin CRUD for a facility's descriptive-perk catalog (Phase 6 Step 3). Same
 * requireAdmin -> validate -> mutate -> revalidatePath shape as
 * facility-xp-offerings-actions.ts. Perks are add/delete rows (no in-place
 * edit), plus an active toggle to retire one without deleting it.
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

const NAME_MAX = 64;
const DESCRIPTION_MAX = 400;

export async function addPerk(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const facilityId = textField(formData, "facilityId");
  if (!facilityId) return { error: "Missing facility reference." };

  const name = textField(formData, "name", NAME_MAX);
  if (!name) return { error: "A name is required." };
  const description = textField(formData, "description", DESCRIPTION_MAX) || null;

  const priceCredits = intField(formData, "priceCredits", 0);
  if (priceCredits <= 0) return { error: "Price must be a whole number greater than zero." };
  const minLevel = intField(formData, "minLevel", 1);
  if (minLevel < 1) return { error: "Min level must be 1 or more." };

  const db = getDb();
  const facility = await db.query.facilities.findFirst({
    where: eq(facilities.id, facilityId),
    columns: { id: true },
  });
  if (!facility) return { error: "Facility not found." };

  const values: NewFacilityPerk = { facilityId, name, description, priceCredits, minLevel };
  await db.insert(facilityPerks).values(values);

  revalidatePath(`/admin/facilities/${facilityId}`);
  revalidatePath(`/facilities/${facilityId}`);
  return { ok: true, message: `Perk "${name}" added.` };
}

export async function setPerkActive(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const perkId = textField(formData, "perkId");
  const active = textField(formData, "active") === "true";
  if (!perkId) return { error: "Missing perk reference." };

  const db = getDb();
  const [updated] = await db
    .update(facilityPerks)
    .set({ active, updatedAt: new Date() })
    .where(eq(facilityPerks.id, perkId))
    .returning({ facilityId: facilityPerks.facilityId });
  if (!updated) return { error: "Perk not found." };

  revalidatePath(`/admin/facilities/${updated.facilityId}`);
  revalidatePath(`/facilities/${updated.facilityId}`);
  return { ok: true, message: active ? "Perk activated." : "Perk deactivated." };
}

export async function deletePerk(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const perkId = textField(formData, "perkId");
  if (!perkId) return { error: "Missing perk reference." };

  const db = getDb();
  const [row] = await db
    .delete(facilityPerks)
    .where(eq(facilityPerks.id, perkId))
    .returning({ facilityId: facilityPerks.facilityId });
  if (!row) return { error: "Perk not found." };

  revalidatePath(`/admin/facilities/${row.facilityId}`);
  revalidatePath(`/facilities/${row.facilityId}`);
  return { ok: true, message: "Perk removed." };
}
