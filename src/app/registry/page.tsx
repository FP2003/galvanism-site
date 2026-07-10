import type { Metadata } from "next";
import { AppShell } from "@/components/shell/app-shell";
import { Panel } from "@/components/ui/panel";
import { requireUser } from "@/lib/auth";
import { getPublicRegistryEntries } from "@/lib/registry-data";
import { RegistryBrowser } from "./registry-browser";

export const metadata: Metadata = { title: "Registry" };

// Player-facing registry browse (Phase 8). Pure lore reading, not tied to a
// character — no approved-character gate, same reasoning as the plain
// /facilities browse list (only purchasing/training there needs a
// character; browsing doesn't). getPublicRegistryEntries already excludes
// gmNotes and hidden entries at the query layer.
export default async function RegistryPage() {
  await requireUser();
  const entries = await getPublicRegistryEntries();

  return (
    <AppShell>
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:py-8">
        <div className="mb-6 border-b border-ledger-teal pb-5">
          <h1 className="font-[family-name:var(--font-rajdhani)] text-3xl font-bold uppercase leading-none tracking-[0.02em] text-case-file-white sm:text-4xl">
            Registry
          </h1>
          <p className="mt-2 max-w-prose text-sm text-muted-ink">
            NPCs, locations, factions, items, and events on record.
          </p>
        </div>

        <Panel title="All Entries" bodyClassName="p-0">
          <RegistryBrowser entries={entries} />
        </Panel>
      </div>
    </AppShell>
  );
}
