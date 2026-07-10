/*
 * Pure registry logic (Phase 8). No DB/Clerk/React imports so it's unit-
 * testable in isolation, same rationale as lib/cards.ts. `icon` is a string
 * key (not a lucide component) for the same reason CARD_CATEGORY_META keeps
 * icons out of this file — the actual component mapping lives at the UI layer
 * (components/registry/registry-type-icon.tsx).
 */
import type { registryEntryType } from "./schema";

export type RegistryEntryType = (typeof registryEntryType.enumValues)[number];

export interface RegistryTypeMeta {
  label: string;
  icon: string;
}

export const REGISTRY_TYPE_META: Record<RegistryEntryType, RegistryTypeMeta> = {
  npc: { label: "NPC", icon: "npc" },
  location: { label: "Location", icon: "location" },
  faction: { label: "Faction", icon: "faction" },
  item: { label: "Item", icon: "item" },
  event: { label: "Event", icon: "event" },
};

export const REGISTRY_TYPES = Object.keys(
  REGISTRY_TYPE_META,
) as RegistryEntryType[];

/**
 * URL-safe slug from an entry name, same shape as slugifyCallsign
 * (lib/characters.ts) — uniqueness is enforced by the DB (registryEntries.slug
 * unique) and the caller surfaces a clash as a validation error.
 */
export function slugifyRegistryName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function registryHref(slug: string): string {
  return `/registry/${slug}`;
}
