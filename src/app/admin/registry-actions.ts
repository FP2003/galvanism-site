"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { registryEntries, type NewRegistryEntry } from "@/lib/schema";
import { REGISTRY_TYPES, slugifyRegistryName, type RegistryEntryType } from "@/lib/registry";
import { TEXT_LIMITS } from "@/lib/game-rules";

/*
 * Registry entry CRUD (Phase 8, admin only). Mirrors
 * app/admin/facility-actions.ts's shape: requireAdmin() -> validate ->
 * mutate -> revalidatePath, hand-written field validators, no zod.
 */
export type FormState = { ok?: boolean; error?: string; message?: string };

function textField(formData: FormData, key: string, max?: number): string {
  const value = String(formData.get(key) ?? "").trim();
  return max ? value.slice(0, max) : value;
}

async function uniqueSlugFor(name: string, excludeId?: string): Promise<string> {
  const base = slugifyRegistryName(name) || "entry";
  const db = getDb();
  let slug = base;
  let suffix = 2;
  // Small campaign roster — a handful of collisions at most, so a simple
  // read-then-check loop is fine (same tradeoff as characters.slugifyCallsign's
  // caller, no need for a batched uniqueness query).
  for (;;) {
    const existing = await db.query.registryEntries.findFirst({
      where: eq(registryEntries.slug, slug),
      columns: { id: true },
    });
    if (!existing || existing.id === excludeId) return slug;
    slug = `${base}-${suffix++}`;
  }
}

export async function createRegistryEntry(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

  const name = textField(formData, "name", TEXT_LIMITS.registryName);
  if (!name) return { error: "A name is required." };
  const typeRaw = textField(formData, "type") as RegistryEntryType;
  if (!REGISTRY_TYPES.includes(typeRaw)) return { error: "Pick an entry type." };
  const visibility = textField(formData, "visibility") === "hidden" ? "hidden" : "public";
  const description = textField(formData, "description", TEXT_LIMITS.registryDescription) || null;
  const gmNotes = textField(formData, "gmNotes", TEXT_LIMITS.registryGmNotes) || null;

  const slug = await uniqueSlugFor(name);
  const values: NewRegistryEntry = {
    slug,
    name,
    type: typeRaw,
    visibility,
    description,
    gmNotes,
    createdByUserId: admin.id,
  };

  const db = getDb();
  await db.insert(registryEntries).values(values);

  revalidatePath("/admin/registry");
  revalidatePath("/registry");
  return { ok: true, message: `"${name}" added to the registry.` };
}

export async function updateRegistryEntry(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const entryId = textField(formData, "entryId");
  if (!entryId) return { error: "Missing entry reference." };

  const name = textField(formData, "name", TEXT_LIMITS.registryName);
  if (!name) return { error: "A name is required." };
  const typeRaw = textField(formData, "type") as RegistryEntryType;
  if (!REGISTRY_TYPES.includes(typeRaw)) return { error: "Pick an entry type." };
  const visibility = textField(formData, "visibility") === "hidden" ? "hidden" : "public";
  const description = textField(formData, "description", TEXT_LIMITS.registryDescription) || null;
  const gmNotes = textField(formData, "gmNotes", TEXT_LIMITS.registryGmNotes) || null;

  const existing = await getDb().query.registryEntries.findFirst({
    where: eq(registryEntries.id, entryId),
    columns: { slug: true, name: true },
  });
  if (!existing) return { error: "Entry not found." };
  const slug = name === existing.name ? existing.slug : await uniqueSlugFor(name, entryId);

  const db = getDb();
  const [updated] = await db
    .update(registryEntries)
    .set({ name, slug, type: typeRaw, visibility, description, gmNotes, updatedAt: new Date() })
    .where(eq(registryEntries.id, entryId))
    .returning({ id: registryEntries.id });
  if (!updated) return { error: "Entry not found." };

  revalidatePath("/admin/registry");
  revalidatePath(`/admin/registry/${entryId}`);
  revalidatePath("/registry");
  revalidatePath(`/registry/${slug}`);
  return { ok: true, message: `"${name}" updated.` };
}

export async function setRegistryVisibility(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const entryId = textField(formData, "entryId");
  if (!entryId) return { error: "Missing entry reference." };
  const visibility = textField(formData, "visibility") === "hidden" ? "hidden" : "public";

  const db = getDb();
  const [updated] = await db
    .update(registryEntries)
    .set({ visibility, updatedAt: new Date() })
    .where(eq(registryEntries.id, entryId))
    .returning({ id: registryEntries.id, slug: registryEntries.slug });
  if (!updated) return { error: "Entry not found." };

  revalidatePath("/admin/registry");
  revalidatePath(`/admin/registry/${entryId}`);
  revalidatePath("/registry");
  revalidatePath(`/registry/${updated.slug}`);
  return { ok: true, message: visibility === "hidden" ? "Hidden from players." : "Made public." };
}

export async function deleteRegistryEntry(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const entryId = textField(formData, "entryId");
  if (!entryId) return { error: "Missing entry reference." };

  const db = getDb();
  await db.delete(registryEntries).where(eq(registryEntries.id, entryId));

  revalidatePath("/admin/registry");
  revalidatePath("/registry");
  return { ok: true, message: "Entry deleted." };
}
