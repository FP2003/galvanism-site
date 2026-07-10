import { eq, and, asc, desc } from "drizzle-orm";
import { getDb } from "./db";
import { registryEntries } from "./schema";

/*
 * Registry read model (Phase 8). Unlike facility-data.ts/ballot-data.ts,
 * admin and player reads are deliberately NOT one shared query filtered
 * downstream in the component — a registry entry's `gmNotes` and, for
 * `hidden` entries, its entire row are meant to be a real confidentiality
 * boundary, not a UI convenience. So the "public" functions below explicitly
 * select only player-safe columns and rows; they never fetch gmNotes at all.
 */

/** Every entry, newest first — admin list. Full row, every visibility. */
export async function getRegistryEntries() {
  const db = getDb();
  return db.query.registryEntries.findMany({
    orderBy: [desc(registryEntries.createdAt)],
  });
}

/** One entry by id, full row (incl. gmNotes) — admin detail/edit. */
export async function getRegistryEntry(id: string) {
  const db = getDb();
  return db.query.registryEntries.findFirst({
    where: eq(registryEntries.id, id),
  });
}

const PUBLIC_COLUMNS = {
  id: true,
  slug: true,
  name: true,
  type: true,
  description: true,
} as const;

/** Public entries only, name-sorted — player browse list, and the source
 *  list for the inline-link picker embedded in player-visible markdown
 *  fields (mission briefing/bio/card text) so a hidden entry can never be
 *  selected for linking into player-visible prose in the first place. */
export async function getPublicRegistryEntries() {
  const db = getDb();
  return db.query.registryEntries.findMany({
    where: eq(registryEntries.visibility, "public"),
    columns: PUBLIC_COLUMNS,
    orderBy: [asc(registryEntries.name)],
  });
}

/** One public entry by slug — player detail page. Returns undefined (caller
 *  should notFound()) for a missing OR hidden entry; gmNotes is structurally
 *  absent from this query's column selection, not merely unrendered. */
export async function getPublicRegistryEntryBySlug(slug: string) {
  const db = getDb();
  return db.query.registryEntries.findFirst({
    where: and(eq(registryEntries.slug, slug), eq(registryEntries.visibility, "public")),
    columns: PUBLIC_COLUMNS,
  });
}
