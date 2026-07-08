"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { facilities, facilityOngoingEntries, type NewFacilityOngoingEntry } from "@/lib/schema";

/*
 * Admin CRUD for a facility's manual "Ongoing" status lines (Phase 6 Step 4).
 * No timers — an admin posts a free-text label and later resolves it by hand.
 * "Resolve" toggles `resolved` (keeps history for the dashboard); delete is a
 * separate escape hatch for correcting a typo'd entry outright.
 */
export type FormState = { ok?: boolean; error?: string; message?: string };

function textField(formData: FormData, key: string, max?: number): string {
  const value = String(formData.get(key) ?? "").trim();
  return max ? value.slice(0, max) : value;
}

const LABEL_MAX = 120;

export async function addOngoingEntry(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const facilityId = textField(formData, "facilityId");
  if (!facilityId) return { error: "Missing facility reference." };

  const label = textField(formData, "label", LABEL_MAX);
  if (!label) return { error: "A label is required (e.g. \"Ammo Resupply: 2 days\")." };

  const db = getDb();
  const facility = await db.query.facilities.findFirst({
    where: eq(facilities.id, facilityId),
    columns: { id: true },
  });
  if (!facility) return { error: "Facility not found." };

  const values: NewFacilityOngoingEntry = { facilityId, label, createdByUserId: admin.id };
  await db.insert(facilityOngoingEntries).values(values);

  revalidatePath(`/admin/facilities/${facilityId}`);
  revalidatePath(`/facilities/${facilityId}`);
  revalidatePath("/");
  return { ok: true, message: "Ongoing entry posted." };
}

export async function setOngoingResolved(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const entryId = textField(formData, "entryId");
  const resolved = textField(formData, "resolved") === "true";
  if (!entryId) return { error: "Missing entry reference." };

  const db = getDb();
  const [updated] = await db
    .update(facilityOngoingEntries)
    .set({ resolved, resolvedAt: resolved ? new Date() : null })
    .where(eq(facilityOngoingEntries.id, entryId))
    .returning({ facilityId: facilityOngoingEntries.facilityId });
  if (!updated) return { error: "Entry not found." };

  revalidatePath(`/admin/facilities/${updated.facilityId}`);
  revalidatePath(`/facilities/${updated.facilityId}`);
  revalidatePath("/");
  return { ok: true, message: resolved ? "Marked resolved." : "Reopened." };
}

export async function deleteOngoingEntry(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const entryId = textField(formData, "entryId");
  if (!entryId) return { error: "Missing entry reference." };

  const db = getDb();
  const [row] = await db
    .delete(facilityOngoingEntries)
    .where(eq(facilityOngoingEntries.id, entryId))
    .returning({ facilityId: facilityOngoingEntries.facilityId });
  if (!row) return { error: "Entry not found." };

  revalidatePath(`/admin/facilities/${row.facilityId}`);
  revalidatePath(`/facilities/${row.facilityId}`);
  revalidatePath("/");
  return { ok: true, message: "Entry removed." };
}
