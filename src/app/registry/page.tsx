import type { Metadata } from "next";
import { AppShell } from "@/components/shell/app-shell";
import { RegistryTerminalFrame } from "@/components/registry/registry-terminal-frame";
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
      <div className="mx-auto max-w-[1500px] px-3 py-5 sm:px-6 sm:py-7 lg:py-9">
        <RegistryTerminalFrame
          variant="index"
          systemLabel="F.C.B. public archive"
          meta={`${String(entries.length).padStart(2, "0")} ${entries.length === 1 ? "record" : "records"}`}
          status="Read only"
        >
          <div className="border-b border-elevated-ledger px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            <h1 className="font-[family-name:var(--font-orbitron)] text-2xl font-semibold uppercase leading-tight tracking-[0.08em] text-case-file-white sm:text-3xl lg:text-4xl">
              Registry
            </h1>
            <p className="mt-3 max-w-2xl font-[family-name:var(--font-inter)] text-sm leading-relaxed text-muted-ink">
              Search released intelligence on known personnel, locations, factions,
              assets, and recorded events.
            </p>
          </div>

          <RegistryBrowser entries={entries} />
        </RegistryTerminalFrame>
      </div>
    </AppShell>
  );
}
