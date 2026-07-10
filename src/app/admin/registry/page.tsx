import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Panel } from "@/components/ui/panel";
import { requireAdmin } from "@/lib/auth";
import { getRegistryEntries } from "@/lib/registry-data";
import { NewRegistryEntryDialog } from "./new-registry-entry-dialog";
import { RegistryList } from "./registry-list";

export const metadata: Metadata = { title: "Registry — Personnel Command" };

// Admin registry list (info/roadmap.md Phase 8). A DM-authored lore
// glossary — NPCs, locations, factions, items, events — that other
// free-text fields (mission briefings, bios, card text) can link to.
export default async function AdminRegistryPage() {
  await requireAdmin();
  const entries = await getRegistryEntries();

  return (
    <AppShell>
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:py-8">
        <Link
          href="/admin"
          className="mb-5 inline-flex items-center gap-2 font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink transition-colors hover:text-signal-cyan pointer-coarse:min-h-11"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Personnel Command
        </Link>

        <div className="mb-6 border-b border-ledger-teal pb-5">
          <h1 className="font-[family-name:var(--font-rajdhani)] text-3xl font-bold uppercase leading-none tracking-[0.02em] text-case-file-white sm:text-4xl">
            Registry
          </h1>
          <p className="mt-2 max-w-prose text-sm text-muted-ink">
            NPCs, locations, factions, items, and events. Public entries are
            browsable by players and linkable from mission briefings, bios,
            and card text; GM Notes on any entry stay admin-only.
          </p>
        </div>

        <Panel
          title="All Entries"
          meta={
            <div className="flex items-center gap-3">
              <span className="font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.06em] text-muted-ink">
                {entries.length} entr{entries.length === 1 ? "y" : "ies"}
              </span>
              <NewRegistryEntryDialog />
            </div>
          }
          bodyClassName="p-0"
        >
          <RegistryList entries={entries} />
        </Panel>
      </div>
    </AppShell>
  );
}
