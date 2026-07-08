import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardList, IdCard, Store, Radio } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Panel } from "@/components/ui/panel";
import { StatusLabel } from "@/components/ui/status-dot";
import { ButtonLink } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { getViewerCharacterState } from "@/lib/characters";
import { getFacility, getOwnedPerkIds } from "@/lib/facility-data";
import { getCharacterCards } from "@/lib/card-data";
import { ListingCard } from "./listing-card";
import { XpOfferingRow } from "./xp-offering-row";
import { PerkRow } from "./perk-row";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const facility = await getFacility(id);
  return { title: facility ? `${facility.name} — Facilities` : "Facility" };
}

// Player-facing facility detail (Phase 6, absorbing Phase 4's /requisitions
// purchase flow, now scoped to one facility instead of an aggregate page).
// Admins have no character to spend against, so they get a read-only preview
// instead — Buy is replaced with a disabled "Admin preview" button.
export default async function FacilityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const facility = await getFacility((await params).id);
  if (!facility) notFound();

  const viewer = isAdmin ? null : await getViewerCharacterState(user.id);

  if (!isAdmin && (!viewer || viewer.kind !== "approved")) {
    return (
      <AppShell>
        <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:py-8">
          <Header name={facility.name} level={facility.kind === "station" ? facility.level : null} />
          <Panel>
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <ClipboardList size={28} className="text-steel-blue" aria-hidden="true" />
              <p className="font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink">
                No character on file
              </p>
              <p className="max-w-sm text-pretty text-sm text-muted-ink">
                Submit an enlistment application first — approved operators can spend credits here.
              </p>
              <ButtonLink href="/apply">
                <IdCard size={15} /> Enlist now
              </ButtonLink>
            </div>
          </Panel>
        </div>
      </AppShell>
    );
  }

  const player = viewer?.kind === "approved" ? viewer.player : null;
  const character = viewer?.kind === "approved" ? viewer.character : null;
  const [owned, ownedPerkIds] = await Promise.all([
    character ? getCharacterCards(character.id) : Promise.resolve([]),
    character ? getOwnedPerkIds(character.id) : Promise.resolve(new Set<string>()),
  ]);
  const ownedCardIds = new Set(owned.map((o) => o.card.id));

  const listings = facility.listings.filter((l) => l.card.priceCredits != null);
  const hasShop = facility.listings.length > 0 || facility.restockRules.length > 0;
  const availableOfferings = facility.xpOfferings.filter(
    (o) => o.active && facility.level >= o.minLevel,
  );
  const availablePerks = facility.perks.filter((p) => p.active && facility.level >= p.minLevel);
  const unresolvedEntries = facility.ongoingEntries.filter((e) => !e.resolved);

  return (
    <AppShell>
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:py-8">
        <Link
          href="/facilities"
          className="mb-5 inline-flex items-center gap-2 font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink transition-colors hover:text-signal-cyan pointer-coarse:min-h-11"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Facilities
        </Link>

        <div className="mb-6 flex flex-col gap-3 border-b border-ledger-teal pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <Header name={facility.name} level={facility.kind === "station" ? facility.level : null} noMargin />
            <p className="mt-2 max-w-prose text-sm text-muted-ink break-words">
              {!facility.isOpen
                ? "Closed."
                : isAdmin
                  ? "Read-only preview of what operators see here — admins hold no character to spend credits against."
                  : `Spend ${character!.callsign}’s credits here.`}
              {facility.description ? ` ${facility.description}` : ""}
            </p>
          </div>
          {player && (
            <div className="shrink-0 border border-ledger-teal px-3 py-1.5 text-right">
              <span className="block font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">
                Balance
              </span>
              <span className="font-[family-name:var(--font-jetbrains)] text-xl text-signal-cyan">
                {player.credits.toLocaleString()}
                <span className="ml-1 text-[0.625rem] uppercase text-muted-ink">Cr</span>
              </span>
            </div>
          )}
        </div>

        {facility.isOpen && unresolvedEntries.length > 0 && (
          <Panel title="Ongoing" className="mb-6">
            <ul className="flex flex-col divide-y divide-elevated-ledger">
              {unresolvedEntries.map((entry) => (
                <li key={entry.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <Radio size={14} className="shrink-0 text-steel-blue" aria-hidden="true" />
                  <span className="font-[family-name:var(--font-inter)] text-sm text-case-file-white">
                    {entry.label}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {!facility.isOpen ? (
          <ClosedNotice />
        ) : !hasShop && availableOfferings.length === 0 && availablePerks.length === 0 ? (
          <Panel>
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <Store size={28} className="text-steel-blue" aria-hidden="true" />
              <p className="max-w-sm text-pretty text-sm text-muted-ink">
                This facility doesn&rsquo;t sell gear or offer training right now.
              </p>
            </div>
          </Panel>
        ) : (
          <div className="flex flex-col gap-6">
            {hasShop && (
              <Panel
                title="For Sale"
                meta={
                  <span className="font-[family-name:var(--font-jetbrains)] text-[0.625rem] uppercase text-muted-ink">
                    {listings.length} for sale
                  </span>
                }
              >
                {listings.length === 0 ? (
                  <p className="font-[family-name:var(--font-inter)] text-sm text-muted-ink">
                    Nothing in stock right now. Check back later.
                  </p>
                ) : (
                  <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {listings.map((listing) => (
                      <li key={listing.id}>
                        <ListingCard
                          listingId={listing.id}
                          card={listing.card}
                          priceCredits={listing.card.priceCredits!}
                          alreadyOwned={ownedCardIds.has(listing.cardId)}
                          canAfford={player ? player.credits >= listing.card.priceCredits! : false}
                          previewOnly={isAdmin}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            )}

            {availableOfferings.length > 0 && (
              <Panel
                title="Training & Recovery"
                meta={
                  character && (
                    <span className="font-[family-name:var(--font-jetbrains)] text-[0.625rem] uppercase text-muted-ink">
                      {character.currencyXp.toLocaleString()} XP · {(player?.credits ?? 0).toLocaleString()} Cr
                    </span>
                  )
                }
              >
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {availableOfferings.map((offering) => (
                    <XpOfferingRow
                      key={offering.id}
                      offering={offering}
                      currencyXp={character?.currencyXp ?? 0}
                      credits={player?.credits ?? 0}
                      previewOnly={isAdmin}
                    />
                  ))}
                </ul>
              </Panel>
            )}

            {availablePerks.length > 0 && (
              <Panel
                title="Perks"
                meta={
                  player && (
                    <span className="font-[family-name:var(--font-jetbrains)] text-[0.625rem] uppercase text-muted-ink">
                      {player.credits.toLocaleString()} Cr available
                    </span>
                  )
                }
              >
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {availablePerks.map((perk) => (
                    <PerkRow
                      key={perk.id}
                      perk={perk}
                      credits={player?.credits ?? 0}
                      owned={ownedPerkIds.has(perk.id)}
                      previewOnly={isAdmin}
                    />
                  ))}
                </ul>
              </Panel>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Header({ name, level, noMargin }: { name: string; level: number | null; noMargin?: boolean }) {
  return (
    <div className={noMargin ? undefined : "mb-6 border-b border-ledger-teal pb-5"}>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-[family-name:var(--font-rajdhani)] text-3xl font-bold uppercase leading-none tracking-[0.02em] text-case-file-white sm:text-4xl">
          {name}
        </h1>
        {level != null && <StatusLabel tone="neutral">Lv {level}</StatusLabel>}
      </div>
    </div>
  );
}

function ClosedNotice() {
  return (
    <Panel>
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <Store size={28} className="text-steel-blue" aria-hidden="true" />
        <p className="font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink">
          Facility closed
        </p>
        <p className="max-w-sm text-pretty text-sm text-muted-ink">
          Check back once the DM opens this facility for business.
        </p>
      </div>
    </Panel>
  );
}
