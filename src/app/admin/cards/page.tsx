import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Layers } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Panel } from "@/components/ui/panel";
import { GameCard } from "@/components/cards/game-card";
import { requireAdmin } from "@/lib/auth";
import { getCardLibrary, getAssignmentTargets } from "@/lib/card-data";
import { CardForm } from "./card-form";
import { CardMenu } from "./card-menu";

export const metadata: Metadata = { title: "Card Library — Personnel Command" };

// Admin card library (info/roadmap.md Phase 3). Authors card definitions and
// browses the deck. Cards can be assigned to an operator right from the grid,
// or from the fuller assign panel on that operator's player page.
export default async function AdminCardsPage() {
  await requireAdmin();
  const [library, targets] = await Promise.all([
    getCardLibrary(),
    getAssignmentTargets(),
  ]);

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

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
          <Panel title="Deck" meta={`${library.length} card${library.length === 1 ? "" : "s"}`}>
            {library.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <Layers size={28} className="text-steel-blue" aria-hidden="true" />
                <p className="font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink">
                  No cards authored yet
                </p>
                <p className="max-w-xs text-pretty text-xs text-muted-ink">
                  Create the first card with the builder on the right →
                </p>
              </div>
            ) : (
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {library.map((card) => (
                  <li key={card.id}>
                    <GameCard
                      card={card}
                      menu={
                        <CardMenu
                          cardId={card.id}
                          title={card.title}
                          targets={targets}
                        />
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="New Card">
            <CardForm />
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
