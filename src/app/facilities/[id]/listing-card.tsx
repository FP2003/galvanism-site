"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ShoppingCart, Check, Undo2 } from "lucide-react";
import { GameCard } from "@/components/cards/game-card";
import { FormMessage } from "@/components/ui/form";
import { purchaseListing, refundListing, type FormState } from "./purchase-actions";
import { facilityListingState } from "@/lib/facilities";
import type { CardWithEffects } from "@/lib/schema";

// One facility listing (Phase 6, absorbing Phase 4's shop listing). Price +
// Buy are composed around GameCard, not passed into it as props — GameCard
// stays price-blind by construction so the same component can render a card
// in the roster loadout (no price) and here at a facility (price shown)
// without a leak either direction.
export function ListingCard({
  listingId,
  card,
  priceCredits,
  alreadyOwned,
  remaining,
  quantityTotal,
  canAfford,
  previewOnly,
}: {
  listingId: string;
  card: CardWithEffects;
  priceCredits: number;
  alreadyOwned: boolean;
  remaining: number;
  quantityTotal: number;
  canAfford: boolean;
  previewOnly?: boolean;
}) {
  const [buyState, buyAction] = useActionState<FormState, FormData>(purchaseListing, {});
  const [refundState, refundAction] = useActionState<FormState, FormData>(refundListing, {});
  // Only true for the rest of this page load, right after a successful buy —
  // useActionState's initial {} comes back the moment the component remounts
  // (navigate away and back, or reload), so the Refund affordance can't
  // reappear once you've left the page. The server action re-checks its own
  // grace period too; this is just the matching client-side gate.
  const justBought = buyState.ok === true;
  const state = facilityListingState(remaining, alreadyOwned);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <GameCard card={card} />
        <span className="absolute bottom-1.5 right-6 z-10 font-[family-name:var(--font-jetbrains)] text-xs font-bold text-signal-cyan">
          {priceCredits.toLocaleString()}
          <span className="ml-0.5 text-[0.5625rem] uppercase text-muted-ink">Cr</span>
        </span>
        {quantityTotal > 1 && (
          <span className="absolute bottom-1.5 left-2 z-10 font-[family-name:var(--font-jetbrains)] text-[0.625rem] font-bold text-muted-ink">
            {Math.max(remaining, 0)}/{quantityTotal} left
          </span>
        )}
      </div>
      {previewOnly ? (
        <button
          type="button"
          disabled
          className="flex w-full cursor-not-allowed items-center justify-center gap-1.5 border border-elevated-ledger px-3 py-2 font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink pointer-coarse:min-h-11"
        >
          Admin preview
        </button>
      ) : alreadyOwned && justBought ? (
        <>
          <form action={refundAction}>
            <input type="hidden" name="listingId" value={listingId} />
            <RefundButton />
          </form>
          <FormMessage state={refundState} />
        </>
      ) : (
        <>
          <form action={buyAction}>
            <input type="hidden" name="listingId" value={listingId} />
            <BuyButton state={state} canAfford={canAfford} />
          </form>
          <FormMessage state={buyState} />
        </>
      )}
    </div>
  );
}

function BuyButton({
  state,
  canAfford,
}: {
  state: ReturnType<typeof facilityListingState>;
  canAfford: boolean;
}) {
  const { pending } = useFormStatus();
  const disabled = pending || state !== "available" || !canAfford;
  const stateClasses =
    state === "owned"
      ? "border-signal-cyan bg-signal-cyan/10 text-signal-cyan"
      : state === "sold_out"
        ? "border-elevated-ledger bg-elevated-ledger/40 text-muted-ink"
        : "border-steel-blue text-signal-cyan hover:bg-elevated-ledger hover:text-live-cyan disabled:border-elevated-ledger disabled:text-muted-ink";

  return (
    <button
      type="submit"
      disabled={disabled}
      className={`flex w-full items-center justify-center gap-1.5 border px-3 py-2 font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] transition-colors disabled:cursor-not-allowed pointer-coarse:min-h-11 ${stateClasses}`}
    >
      {state === "owned" ? (
        <>
          <Check size={13} aria-hidden="true" /> Owned
        </>
      ) : state === "sold_out" ? (
        <>
          <Check size={13} aria-hidden="true" /> Sold Out
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

function RefundButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center gap-1.5 border border-signal-cyan px-3 py-2 font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-signal-cyan transition-colors hover:border-stamp-red hover:text-stamp-red disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:min-h-11"
    >
      <Undo2 size={13} aria-hidden="true" />
      {pending ? "Refunding…" : "Refund"}
    </button>
  );
}
