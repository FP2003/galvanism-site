"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ShoppingCart, Check } from "lucide-react";
import { GameCard } from "@/components/cards/game-card";
import { FormMessage } from "@/components/ui/form";
import { purchaseListing, type FormState } from "./requisitions-actions";
import type { CardWithEffects } from "@/lib/schema";

// One shop listing (Phase 4). Price + Buy are composed around GameCard, not
// passed into it as props — GameCard stays price-blind by construction so
// the same component can render a card in the roster loadout (no price)
// and here in the shop (price shown) without a leak either direction.
export function ListingCard({
  listingId,
  card,
  priceCredits,
  alreadyOwned,
  canAfford,
  previewOnly,
}: {
  listingId: string;
  card: CardWithEffects;
  priceCredits: number;
  alreadyOwned: boolean;
  canAfford: boolean;
  previewOnly?: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(purchaseListing, {});

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <GameCard card={card} />
        <span className="absolute bottom-1.5 right-6 z-10 font-[family-name:var(--font-jetbrains)] text-xs font-bold text-signal-cyan">
          {priceCredits.toLocaleString()}
          <span className="ml-0.5 text-[0.5625rem] uppercase text-muted-ink">Cr</span>
        </span>
      </div>
      {previewOnly ? (
        <button
          type="button"
          disabled
          className="flex w-full cursor-not-allowed items-center justify-center gap-1.5 border border-elevated-ledger px-3 py-2 font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink pointer-coarse:min-h-11"
        >
          Admin preview
        </button>
      ) : (
        <>
          <form action={formAction}>
            <input type="hidden" name="listingId" value={listingId} />
            <BuyButton alreadyOwned={alreadyOwned} canAfford={canAfford} />
          </form>
          <FormMessage state={state} />
        </>
      )}
    </div>
  );
}

function BuyButton({
  alreadyOwned,
  canAfford,
}: {
  alreadyOwned: boolean;
  canAfford: boolean;
}) {
  const { pending } = useFormStatus();
  const disabled = pending || alreadyOwned || !canAfford;

  return (
    <button
      type="submit"
      disabled={disabled}
      className={`flex w-full items-center justify-center gap-1.5 border px-3 py-2 font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] transition-colors disabled:cursor-not-allowed pointer-coarse:min-h-11 ${
        alreadyOwned
          ? "border-signal-cyan bg-signal-cyan/10 text-signal-cyan"
          : "border-steel-blue text-signal-cyan hover:bg-elevated-ledger hover:text-live-cyan disabled:border-elevated-ledger disabled:text-muted-ink"
      }`}
    >
      {alreadyOwned ? (
        <>
          <Check size={13} aria-hidden="true" /> Owned
        </>
      ) : (
        <>
          <ShoppingCart size={13} aria-hidden="true" />
          {pending ? "Purchasing…" : !canAfford ? "Insufficient credits" : "Requisition"}
        </>
      )}
    </button>
  );
}
