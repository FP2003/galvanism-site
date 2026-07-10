"use server";

import { requireUser } from "@/lib/auth";
import { getPublicRegistryEntries } from "@/lib/registry-data";

/*
 * Feeds RegistryLinkPicker (components/registry/registry-link-picker.tsx),
 * embedded in every markdown textarea (mission briefing, bio, card text) so
 * an admin/player can insert a [Name](/registry/slug) link without leaving
 * the form. Only ever returns public entries — reuses the same query the
 * player-facing /registry list uses, so a hidden entry can never be
 * selected for linking into player-visible prose in the first place.
 */
export async function listPublicRegistryEntriesForPicker() {
  await requireUser();
  const entries = await getPublicRegistryEntries();
  return entries.map((e) => ({ slug: e.slug, name: e.name, type: e.type }));
}
