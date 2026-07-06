import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Layers } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Panel } from "@/components/ui/panel";
import { requireAdmin } from "@/lib/auth";
import {
  getCardLibrary,
  getAssignmentTargets,
  getCardOwnershipMap,
} from "@/lib/card-data";
import { CardLibrary, type CardLibraryItem } from "./card-library";
import { NewCardDialog } from "./new-card-dialog";

export const metadata: Metadata = { title: "Card Library — Personnel Command" };

// Admin card library (info/roadmap.md Phase 3). Authors card definitions and
// browses the deck. Cards can be assigned to an operator right from the grid,
// or from the fuller assign panel on that operator's player page.
export default async function AdminCardsPage() {
  await requireAdmin();
  const [library, targets, ownership] = await Promise.all([
    getCardLibrary(),
    getAssignmentTargets(),
    getCardOwnershipMap(),
  ]);
  const items: CardLibraryItem[] = library.map((card) => ({
    card,
    targets: targets.map((t) => ({
      ...t,
      assignmentId: ownership.get(card.id)?.get(t.id) ?? null,
    })),
  }));

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
            Card Library
          </h1>
          <p className="mt-2 max-w-prose text-sm text-muted-ink">
            Author ability, mod, and item cards for the deck. Mechanical effects
            auto-apply to a sheet once equipped; descriptive cards read as
            feat-like text. Assign cards to operators from their case file.
          </p>
        </div>

        <Panel
          title="Deck"
          meta={
            <div className="flex items-center gap-3">
              <span className="font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.06em] text-muted-ink">
                {library.length} card{library.length === 1 ? "" : "s"}
              </span>
              <NewCardDialog />
            </div>
          }
        >
          {library.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <Layers size={28} className="text-steel-blue" aria-hidden="true" />
              <p className="font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink">
                No cards authored yet
              </p>
              <p className="max-w-xs text-pretty text-xs text-muted-ink">
                Use New Card above to create one.
              </p>
            </div>
          ) : (
            <CardLibrary items={items} />
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
