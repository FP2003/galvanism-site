import type { Metadata } from "next";
import { ClipboardList, IdCard, Store } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Panel } from "@/components/ui/panel";
import { ButtonLink } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { getViewerCharacterState } from "@/lib/characters";
import { getOpenShopsWithListings } from "@/lib/shop-data";
import { getCharacterCards } from "@/lib/card-data";
import { ListingCard } from "./listing-card";

export const metadata: Metadata = { title: "Requisitions" };

// Player-facing shop browsing + purchase (Phase 4). Admins have no character
// to requisition against, so they get a read-only preview of the same shop
// panels instead — Buy is replaced with a disabled "Admin preview" button.
export default async function RequisitionsPage() {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const viewer = isAdmin ? null : await getViewerCharacterState(user.id);

  if (!isAdmin && (!viewer || viewer.kind !== "approved")) {
    return (
      <AppShell>
        <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:py-8">
          <Header />
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
  const [shopList, owned] = await Promise.all([
    getOpenShopsWithListings(),
    character ? getCharacterCards(character.id) : Promise.resolve([]),
  ]);
  const ownedCardIds = new Set(owned.map((o) => o.card.id));

  return (
    <AppShell>
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:py-8">
        <div className="mb-6 flex flex-col gap-3 border-b border-ledger-teal pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-[family-name:var(--font-rajdhani)] text-3xl font-bold uppercase leading-none tracking-[0.02em] text-case-file-white sm:text-4xl">
              Requisitions
            </h1>
            <p className="mt-2 max-w-prose text-sm text-muted-ink">
              {isAdmin
                ? "Read-only preview of what operators see here — admins hold no character to spend credits against."
                : `Spend ${character!.callsign}’s credits on gear from open shops.`}
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

        {shopList.length === 0 ? (
          <EmptyShops />
        ) : (
          <div className="flex flex-col gap-6">
            {shopList.map((shop) => {
              const listings = shop.listings.filter((l) => l.card.priceCredits != null);
              return (
                <Panel
                  key={shop.id}
                  title={shop.name}
                  meta={
                    <span className="font-[family-name:var(--font-jetbrains)] text-[0.625rem] uppercase text-muted-ink">
                      {listings.length} for sale
                    </span>
                  }
                >
                  {shop.description && (
                    <p className="mb-4 max-w-prose text-sm text-muted-ink">{shop.description}</p>
                  )}
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
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Header() {
  return (
    <div className="mb-6 border-b border-ledger-teal pb-5">
      <h1 className="font-[family-name:var(--font-rajdhani)] text-3xl font-bold uppercase leading-none tracking-[0.02em] text-case-file-white sm:text-4xl">
        Requisitions
      </h1>
    </div>
  );
}

function EmptyShops() {
  return (
    <Panel>
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <Store size={28} className="text-steel-blue" aria-hidden="true" />
        <p className="font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink">
          No shops open
        </p>
        <p className="max-w-sm text-pretty text-sm text-muted-ink">
          Check back once the DM opens one for business.
        </p>
      </div>
    </Panel>
  );
}
