"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, RefreshCw, X } from "lucide-react";
import { Select, TextInput, FormMessage, fieldLabelClass } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { CARD_CATEGORIES, CARD_CATEGORY_META, type CardCategory } from "@/lib/cards";
import { addListing, removeListing, replaceCategoryListings, type FormState } from "@/app/admin/facility-actions";
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
  const [replaceOpen, setReplaceOpen] = useState(false);

  // Categories currently represented in this facility's listings, with a
  // count each — feeds the "replace category" dialog's defaults (first
  // present category, and that category's current count as the quantity).
  const categoryCounts = useMemo(() => {
    const counts = new Map<CardCategory, number>();
    for (const listing of listings) {
      counts.set(listing.card.category, (counts.get(listing.card.category) ?? 0) + 1);
    }
    return CARD_CATEGORIES.filter((c) => counts.has(c)).map((category) => ({
      category,
      count: counts.get(category)!,
    }));
  }, [listings]);

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
        <>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setReplaceOpen(true)}
              className="flex items-center gap-1.5 font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.05em] text-muted-ink transition-colors hover:text-signal-cyan pointer-coarse:min-h-11"
            >
              <RefreshCw size={13} aria-hidden="true" />
              Replace category
            </button>
          </div>
          <ul className="flex flex-col divide-y divide-elevated-ledger border-y border-elevated-ledger">
            {listings.map((listing) => (
              <ListingRow key={listing.id} listing={listing} />
            ))}
          </ul>
        </>
      )}
      <ReplaceCategoryDialog
        open={replaceOpen}
        onClose={() => setReplaceOpen(false)}
        facilityId={facilityId}
        categoryCounts={categoryCounts}
      />
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
      <span className="size-2.5 shrink-0 bg-muted-ink" aria-hidden="true" />
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

function ReplaceCategoryDialog({
  open,
  onClose,
  facilityId,
  categoryCounts,
}: {
  open: boolean;
  onClose: () => void;
  facilityId: string;
  categoryCounts: { category: CardCategory; count: number }[];
}) {
  const [state, action] = useActionState<FormState, FormData>(replaceCategoryListings, {});
  const first = categoryCounts[0];
  const [category, setCategory] = useState<CardCategory | undefined>(first?.category);
  const [quantity, setQuantity] = useState(first?.count ?? 1);

  if (!first) return null;

  return (
    <Dialog open={open} onClose={onClose} title="Replace Category">
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="facilityId" value={facilityId} />
        <p className="font-[family-name:var(--font-inter)] text-xs text-muted-ink">
          Removes every listing of the chosen category and refills it with
          randomly-picked cards from that category.
        </p>
        <div className="flex flex-col gap-1">
          <span className={fieldLabelClass}>Category</span>
          <Select
            name="category"
            aria-label="Category"
            value={category}
            onChange={(e) => {
              const next = e.target.value as CardCategory;
              setCategory(next);
              setQuantity(categoryCounts.find((c) => c.category === next)?.count ?? 1);
            }}
          >
            {categoryCounts.map(({ category: c, count }) => (
              <option key={c} value={c}>
                {CARD_CATEGORY_META[c].label} ({count})
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <span className={fieldLabelClass}>Quantity</span>
          <TextInput
            name="quantity"
            type="number"
            min={1}
            max={50}
            inputMode="numeric"
            aria-label="Quantity"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
        </div>
        <ReplaceButton />
        <FormMessage state={state} />
      </form>
    </Dialog>
  );
}

function ReplaceButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending} className="shrink-0">
      <RefreshCw size={15} />
      {pending ? "Replacing…" : "Replace"}
    </Button>
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
