"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, X } from "lucide-react";
import { Select, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { CARD_CATEGORY_META } from "@/lib/cards";
import { addListing, removeListing, type FormState } from "@/app/admin/facility-actions";
import type { Card, FacilityListing } from "@/lib/schema";

// Admin listing management for one facility (Phase 6, absorbing Phase 4's
// shop listings). Admin can freely add/remove listings regardless of source
// — a rotation-picked card is just as removable as a manually curated one.
// `eligibleCards` is already filtered to this facility's level upstream
// (getEligibleListingCards), so every option here is safe to list.
export function FacilityListingManagement({
  facilityId,
  eligibleCards,
  listings,
}: {
  facilityId: string;
  eligibleCards: Card[];
  listings: (FacilityListing & { card: Card })[];
}) {
  const [addState, addAction] = useActionState<FormState, FormData>(addListing, {});

  return (
    <div className="flex flex-col gap-5">
      <form action={addAction} className="flex flex-col gap-2 sm:flex-row">
        <input type="hidden" name="facilityId" value={facilityId} />
        <Select
          name="cardId"
          aria-label="Card to list"
          defaultValue=""
          disabled={eligibleCards.length === 0}
          wrapperClassName="flex-1"
        >
          <option value="" disabled>
            {eligibleCards.length === 0
              ? "No priced cards available"
              : "Select a card…"}
          </option>
          {eligibleCards.map((c) => (
            <option key={c.id} value={c.id}>
              {CARD_CATEGORY_META[c.category].label} · {c.title}: {c.priceCredits} Cr
            </option>
          ))}
        </Select>
        <AddListingButton disabled={eligibleCards.length === 0} />
      </form>
      <FormMessage state={addState} />

      {listings.length === 0 ? (
        <p className="border border-signal-cyan/40 bg-signal-cyan/10 px-3 py-2 font-[family-name:var(--font-inter)] text-[0.8125rem] text-muted-ink">
          Nothing listed yet. Add a priced card above, or configure restock
          rules to fill the rotating slots automatically.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-elevated-ledger border-y border-elevated-ledger">
          {listings.map((listing) => (
            <ListingRow key={listing.id} listing={listing} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AddListingButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="secondary"
      disabled={pending || disabled}
      className="shrink-0"
    >
      <Plus size={15} />
      {pending ? "Adding…" : "Add"}
    </Button>
  );
}

function ListingRow({ listing }: { listing: FacilityListing & { card: Card } }) {
  const [, removeAction] = useActionState<FormState, FormData>(removeListing, {});
  const { card } = listing;

  return (
    <li className="flex items-center gap-3 py-3">
      <span className="size-2.5 shrink-0 bg-steel-blue" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-[family-name:var(--font-chakra)] text-sm font-semibold uppercase tracking-[0.03em] text-case-file-white">
          {card.title}
        </p>
        <p className="truncate font-[family-name:var(--font-inter)] text-[0.6875rem] text-muted-ink">
          {CARD_CATEGORY_META[card.category].label} · {card.priceCredits?.toLocaleString()} Cr ·{" "}
          {listing.source === "rotation"
            ? `Rotation · Slot ${(listing.slotIndex ?? 0) + 1}`
            : "Manual"}
        </p>
      </div>
      <form action={removeAction}>
        <input type="hidden" name="listingId" value={listing.id} />
        <RemoveListingButton label={`Remove ${card.title}`} />
      </form>
    </li>
  );
}

function RemoveListingButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      aria-label={label}
      disabled={pending}
      className="flex size-8 shrink-0 items-center justify-center border border-elevated-ledger text-muted-ink transition-colors hover:border-stamp-red hover:text-stamp-red disabled:opacity-60 pointer-coarse:size-11"
    >
      <X size={14} aria-hidden="true" />
    </button>
  );
}
