import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Panel } from "@/components/ui/panel";
import { StatusLabel } from "@/components/ui/status-dot";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { players, goldLedger } from "@/lib/schema";
import { toCharacterView } from "@/lib/characters";
import { PlayerForm } from "./player-form";
import { GoldForm } from "./gold-form";
import { CharacterForm } from "./character-form";
import { DeleteAccount } from "./delete-account";
import { ApplicationActions } from "../../application-actions";

// Admin player-management console (info/roadmap.md Phase 2). Full CRUD for one
// player: account info, gold ledger, and the character sheet.
export default async function AdminPlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const db = getDb();
  const player = await db.query.players.findFirst({
    where: eq(players.id, id),
    with: { user: true, character: true },
  });
  if (!player) notFound();

  const ledger = await db.query.goldLedger.findMany({
    where: eq(goldLedger.playerId, id),
    orderBy: [desc(goldLedger.createdAt)],
    limit: 50,
  });

  const characterView = player.character
    ? toCharacterView(player.character, player)
    : null;
  const displayName = player.name || player.user?.displayName || player.user?.email || "Operator";

  return (
    <AppShell>
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:py-8">
        <Link
          href="/admin"
          className="mb-5 inline-flex items-center gap-2 font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink transition-colors hover:text-signal-cyan pointer-coarse:min-h-11"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Personnel Command
        </Link>

        <div className="mb-6 flex flex-col gap-3 border-b border-ledger-teal pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-[family-name:var(--font-rajdhani)] text-3xl font-bold uppercase leading-none tracking-[0.02em] text-case-file-white break-words sm:text-4xl">
              {displayName}
            </h1>
            <p className="mt-2 text-sm text-muted-ink break-words">
              {player.user?.email}
              {characterView && (
                <>
                  {" · "}
                  <span className="font-[family-name:var(--font-chakra)] uppercase tracking-[0.06em] text-signal-cyan">
                    {characterView.callsign}
                  </span>
                </>
              )}
            </p>
          </div>
          {characterView && (
            <Link
              href={`/roster/${characterView.slug}`}
              className="inline-flex items-center gap-2 border border-steel-blue px-3 py-2 font-[family-name:var(--font-chakra)] text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-signal-cyan transition-colors hover:bg-elevated-ledger hover:text-live-cyan pointer-coarse:py-2.5"
            >
              View case file <ExternalLink size={13} aria-hidden="true" />
            </Link>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Character sheet CRUD */}
          <Panel
            title={characterView ? "Character Sheet" : "Provision Character"}
            meta={
              characterView && !characterView.approved ? (
                <StatusLabel tone="live" pulse>
                  Pending review
                </StatusLabel>
              ) : !characterView ? (
                <span className="font-[family-name:var(--font-jetbrains)] text-[0.625rem] uppercase text-muted-ink">
                  Unassigned
                </span>
              ) : undefined
            }
          >
            {!characterView && (
              <p className="mb-5 border border-signal-cyan/40 bg-signal-cyan/10 px-3 py-2 font-[family-name:var(--font-inter)] text-[0.8125rem] text-muted-ink">
                This operator has no character yet. Fill in the sheet to bring them
                online.
              </p>
            )}
            {characterView && !characterView.approved && (
              <div className="mb-5 flex flex-col gap-3 border border-signal-cyan/40 bg-signal-cyan/5 p-4">
                <p className="font-[family-name:var(--font-inter)] text-[0.8125rem] text-muted-ink">
                  This is a submitted application. Approve to add it to the roster,
                  or deny to remove it (the player can then re-apply). You may edit
                  the sheet below before approving.
                </p>
                <ApplicationActions characterId={characterView.id} />
              </div>
            )}
            <CharacterForm playerId={player.id} character={characterView} />
          </Panel>

          {/* Right rail: account + gold */}
          <div className="flex flex-col gap-6">
            <Panel title="Account">
              <PlayerForm
                playerId={player.id}
                name={player.name ?? ""}
                email={player.user?.email ?? ""}
              />
            </Panel>

            <Panel title="Gold Ledger">
              <GoldForm playerId={player.id} balance={player.gold} />
            </Panel>

            <Panel title="Ledger History" bodyClassName="p-0">
              {ledger.length === 0 ? (
                <p className="px-5 py-6 text-center font-[family-name:var(--font-inter)] text-sm text-muted-ink">
                  No gold movement recorded yet.
                </p>
              ) : (
                <div className="overflow-x-auto bg-void-navy">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-elevated-ledger text-left font-[family-name:var(--font-chakra)] text-[0.5625rem] font-semibold uppercase tracking-[0.08em] text-muted-ink">
                      <th scope="col" className="px-4 py-2 font-semibold">Entry</th>
                      <th scope="col" className="px-4 py-2 text-right font-semibold">Δ</th>
                      <th scope="col" className="px-4 py-2 text-right font-semibold">Bal</th>
                    </tr>
                  </thead>
                  <tbody className="font-[family-name:var(--font-jetbrains)] text-xs">
                    {ledger.map((e) => (
                      <tr
                        key={e.id}
                        className="border-b border-elevated-ledger/60 last:border-b-0"
                      >
                        <td className="px-4 py-2.5">
                          <span className="block font-[family-name:var(--font-inter)] text-sm text-case-file-white">
                            {e.description}
                          </span>
                          {e.refCode && (
                            <span className="text-[0.625rem] text-muted-ink">
                              {e.refCode}
                            </span>
                          )}
                        </td>
                        <td
                          className={`whitespace-nowrap px-4 py-2.5 text-right ${
                            e.delta >= 0 ? "text-signal-cyan" : "text-stamp-red"
                          }`}
                        >
                          {e.delta >= 0 ? "+" : ""}
                          {e.delta}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right text-muted-ink">
                          {e.balanceAfter}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </Panel>

            <DeleteAccount playerId={player.id} label={displayName} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
