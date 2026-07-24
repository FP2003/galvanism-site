"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Dumbbell, HeartPulse, LayoutGrid, Sparkles } from "lucide-react";
import { FormMessage } from "@/components/ui/form";
import { offeringTargetLabel, offeringCostCurrency } from "@/lib/facilities";
import { purchaseXpOffering, type FormState } from "./purchase-actions";
import type { FacilityXpOffering } from "@/lib/schema";

// One training/refill/descriptive/slot-upgrade offering row (Phase 6 Step 2,
// Phase 8) — a permanent stat bump or slot upgrade (priced in Currency XP), a
// one-off resource refill (priced in Credits), or a descriptive perk (either
// currency, the admin's choice per row). Text-based rather than GameCard
// -based (these aren't cards), but otherwise mirrors ListingCard's price +
// action-button composition. `cost` is passed in rather than read off
// `offering.cost` directly because a slot_upgrade's or descriptive offering's
// real price is this specific character's escalated price (see
// nextEscalatingOfferingCost), computed by the parent page — stat_bump and
// resource_refill just pass their flat `offering.cost` through unchanged.
export function XpOfferingRow({
  offering,
  cost,
  currencyXp,
  credits,
  previewOnly,
}: {
  offering: FacilityXpOffering;
  cost: number;
  currencyXp: number;
  credits: number;
  previewOnly?: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(purchaseXpOffering, {});
  const currency = offeringCostCurrency(offering);
  const balance = currency === "xp" ? currencyXp : credits;
  const canAfford = balance >= cost;
  const currencyLabel = currency === "xp" ? "XP" : "Cr";
  const label = offeringTargetLabel(offering.offeringType, offering.targetKey);
  const Icon =
    offering.offeringType === "stat_bump"
      ? Dumbbell
      : offering.offeringType === "resource_refill"
        ? HeartPulse
        : offering.offeringType === "slot_upgrade"
          ? LayoutGrid
          : Sparkles;
  const verb =
    offering.offeringType === "stat_bump"
      ? "Train"
      : offering.offeringType === "resource_refill"
        ? "Treat"
        : offering.offeringType === "slot_upgrade"
          ? "Upgrade"
          : "Unlock";

  return (
    <li className="flex flex-col gap-2 border border-elevated-ledger p-3">
      <div className="flex flex-1 items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Icon size={16} className="mt-0.5 shrink-0 text-muted-ink" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate font-[family-name:var(--font-chakra)] text-sm font-semibold uppercase tracking-[0.03em] text-case-file-white">
              {offering.name}
            </p>
            {offering.offeringType !== "descriptive" && (
              <p className="font-[family-name:var(--font-jetbrains)] text-[0.6875rem] text-muted-ink">
                +{offering.amount} {label}
                {offering.offeringType === "slot_upgrade" ? " slot(s)" : ""}
              </p>
            )}
            {offering.description && (
              <p className="mt-1 max-w-prose text-xs text-muted-ink">{offering.description}</p>
            )}
          </div>
        </div>
        <span className="shrink-0 font-[family-name:var(--font-jetbrains)] text-xs font-bold text-signal-cyan">
          {cost.toLocaleString()}
          <span className="ml-0.5 text-[0.5625rem] uppercase text-muted-ink">{currencyLabel}</span>
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
            <input type="hidden" name="offeringId" value={offering.id} />
            <TrainButton verb={verb} canAfford={canAfford} currencyLabel={currencyLabel} />
          </form>
          <FormMessage state={state} />
        </>
      )}
    </li>
  );
}

function TrainButton({
  verb,
  canAfford,
  currencyLabel,
}: {
  verb: string;
  canAfford: boolean;
  currencyLabel: string;
}) {
  const { pending } = useFormStatus();
  const disabled = pending || !canAfford;

  return (
    <button
      type="submit"
      disabled={disabled}
      className="flex w-full items-center justify-center gap-1.5 border border-steel-blue px-3 py-2 font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-signal-cyan transition-colors hover:bg-elevated-ledger hover:text-live-cyan disabled:cursor-not-allowed disabled:border-elevated-ledger disabled:text-muted-ink pointer-coarse:min-h-11"
    >
      {pending ? "Working…" : !canAfford ? `Insufficient ${currencyLabel}` : verb}
    </button>
  );
}
