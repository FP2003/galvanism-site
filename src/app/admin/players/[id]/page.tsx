import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Panel } from "@/components/ui/panel";
import { StatusLabel } from "@/components/ui/status-dot";
import { FormDialogTrigger } from "@/components/ui/form-dialog-trigger";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { players, creditLedger, xpLedger } from "@/lib/schema";
import { toCharacterView } from "@/lib/characters";
import { getCardLibrary, getCharacterCards } from "@/lib/card-data";
import { getRefundableRefCodes, getCharacterPerkContributions } from "@/lib/facility-data";
import { PlayerForm } from "./player-form";
import { CreditForm } from "./credit-form";
import { XpForm } from "./xp-form";
import { CharacterForm } from "./character-form";
import { CardAssignment } from "./card-assignment";
import { PerkPurchases } from "./perk-purchases";
import { DeleteAccount } from "./delete-account";
import { MissionPayoutForm } from "./mission-payout-form";
import { HistoryPanel, type HistoryRow } from "@/components/ledger/history-table";
import { ApplicationActions } from "../../application-actions";

// Admin player-management console (info/roadmap.md Phase 2). Full CRUD for one
// player: account info, credit ledger, and the character sheet.
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

  const ledger = await db.query.creditLedger.findMany({
    where: eq(creditLedger.playerId, id),
    orderBy: [desc(creditLedger.createdAt)],
    limit: 50,
  });

  const characterView = player.character
    ? toCharacterView(player.character, player)
    : null;

  const xpHistory = characterView
    ? await db.query.xpLedger.findMany({
        where: eq(xpLedger.characterId, characterView.id),
        orderBy: [desc(xpLedger.createdAt)],
        limit: 50,
      })
    : [];

  // Card inventory + the shared library, only when there's a character to hold them.
  const [cardLibrary, ownedCards, perkPurchases] = player.character
    ? await Promise.all([
        getCardLibrary(),
        getCharacterCards(player.character.id),
        getCharacterPerkContributions(player.character.id),
      ])
    : [[], [], []];
  // Cards/perks with an unrefunded facility purchase (vs. admin-assigned for
  // free) — feeds the Refund buttons in CardAssignment/PerkPurchases below.
  const refundableRefCodes = await getRefundableRefCodes(player.id);
  const displayName = player.name || player.user?.displayName || player.user?.email || "Operator";

  // Merge credit + XP into one chronological feed instead of two separate
  // history tables — the DM reads a single timeline of everything that
  // happened to this player.
  const history: HistoryRow[] = [
    ...ledger.map((e) => ({
      id: `credit:${e.id}`,
      type: "credit" as const,
      createdAt: e.createdAt,
      description: e.description,
      refCode: e.refCode,
      delta: e.delta,
      after: `${e.balanceAfter.toLocaleString()} Cr`,
    })),
    ...xpHistory.map((e) => ({
      id: `xp:${e.id}`,
      type: "xp" as const,
      createdAt: e.createdAt,
      description: e.description,
      refCode: e.refCode,
      delta: e.delta,
      after: `${e.currencyXpAfter.toLocaleString()} XP`,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 50);

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
          {/* Character sheet CRUD + card loadout */}
          <div className="flex flex-col gap-6">
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

          {characterView && (
            <Panel
              title="Card Loadout"
              meta={
                <span className="font-[family-name:var(--font-jetbrains)] text-[0.625rem] uppercase text-muted-ink">
                  {ownedCards.filter((o) => o.equipped).length} equipped ·{" "}
                  {ownedCards.length} held
                </span>
              }
            >
              <CardAssignment
                characterId={characterView.id}
                library={cardLibrary}
                owned={ownedCards}
                refundableCardIds={refundableRefCodes}
              />
            </Panel>
          )}

          {characterView && (
            <Panel
              title="Facility Perks"
              meta={
                <span className="font-[family-name:var(--font-jetbrains)] text-[0.625rem] uppercase text-muted-ink">
                  {perkPurchases.length} contribution{perkPurchases.length === 1 ? "" : "s"}
                </span>
              }
            >
              <PerkPurchases purchases={perkPurchases} />
            </Panel>
          )}
          </div>

          {/* Right rail: account + credits */}
          <div className="flex flex-col gap-6">
            <Panel
              title="Account"
              meta={
                <FormDialogTrigger label="Edit" title="Edit Account">
                  <PlayerForm
                    playerId={player.id}
                    name={player.name ?? ""}
                    email={player.user?.email ?? ""}
                  />
                </FormDialogTrigger>
              }
            >
              <dl className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between gap-3 border-b border-elevated-ledger pb-3">
                  <dt className="font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">
                    Alias
                  </dt>
                  <dd className="truncate font-[family-name:var(--font-jetbrains)] text-sm text-case-file-white">
                    {player.name || "—"}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">
                    Email
                  </dt>
                  <dd className="truncate text-sm text-muted-ink">
                    {player.user?.email}
                  </dd>
                </div>
              </dl>
            </Panel>

            <Panel
              title="Mission Payout"
              meta={
                <FormDialogTrigger label="Post" title="Mission Payout">
                  <MissionPayoutForm
                    playerId={player.id}
                    characterId={characterView?.id ?? null}
                    balance={player.credits}
                    totalXp={characterView?.totalXp ?? null}
                    currencyXp={characterView?.currencyXp ?? null}
                  />
                </FormDialogTrigger>
              }
            >
              <p className="font-[family-name:var(--font-inter)] text-[0.8125rem] text-muted-ink">
                Post a credits and/or XP reward together under one shared description.
              </p>
            </Panel>

            <Panel
              title="Credit Ledger"
              meta={
                <FormDialogTrigger label="Adjust" title="Adjust Credits">
                  <CreditForm playerId={player.id} balance={player.credits} />
                </FormDialogTrigger>
              }
            >
              <div className="flex items-baseline justify-between">
                <span className="font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">
                  Current balance
                </span>
                <span className="font-[family-name:var(--font-jetbrains)] text-xl text-signal-cyan">
                  {player.credits.toLocaleString()}
                  <span className="ml-1 text-[0.625rem] uppercase text-muted-ink">Cr</span>
                </span>
              </div>
            </Panel>

            {characterView && (
              <Panel
                title="XP Ledger"
                meta={
                  <FormDialogTrigger label="Grant" title="Grant XP">
                    <XpForm
                      characterId={characterView.id}
                      totalXp={characterView.totalXp}
                      currencyXp={characterView.currencyXp}
                    />
                  </FormDialogTrigger>
                }
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between">
                    <span className="font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">
                      Total XP
                    </span>
                    <span className="font-[family-name:var(--font-jetbrains)] text-xl text-signal-cyan">
                      {characterView.totalXp.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">
                      Currency XP
                    </span>
                    <span className="font-[family-name:var(--font-jetbrains)] text-lg text-case-file-white">
                      {characterView.currencyXp.toLocaleString()}
                    </span>
                  </div>
                </div>
              </Panel>
            )}

            <DeleteAccount playerId={player.id} label={displayName} />
          </div>
        </div>

        {/* Full-width so the combined ledger doesn't need horizontal scroll */}
        <HistoryPanel rows={history} className="mt-6" />
      </div>
    </AppShell>
  );
}
