"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Sparkles, Check, Undo2 } from "lucide-react";
import { FormMessage } from "@/components/ui/form";
import { purchasePerk, refundPerk, type FormState } from "./purchase-actions";
import type { FacilityPerk } from "@/lib/schema";

// One descriptive-perk row (Phase 6 Step 3) — a permanent per-character
// unlock the DM honors at the table. Text-based, no mechanical effect to
// render. Owned/Buy button mirrors ListingCard's composition; unlike XP
// offerings a perk is one-time, so an owned perk shows a disabled "Owned"
// state instead of staying repeatable.
export function PerkRow({
  perk,
  credits,
  owned,
  previewOnly,
}: {
  perk: FacilityPerk;
  credits: number;
  owned: boolean;
  previewOnly?: boolean;
}) {
  const [buyState, buyAction] = useActionState<FormState, FormData>(purchasePerk, {});
  const [refundState, refundAction] = useActionState<FormState, FormData>(refundPerk, {});
  const canAfford = credits >= perk.priceCredits;
  // See ListingCard's justBought for why this resets on navigation/reload.
  const justBought = buyState.ok === true;

  return (
    <li className="flex flex-col gap-2 border border-elevated-ledger p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Sparkles size={16} className="mt-0.5 shrink-0 text-steel-blue" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate font-[family-name:var(--font-chakra)] text-sm font-semibold uppercase tracking-[0.03em] text-case-file-white">
              {perk.name}
            </p>
            {perk.description && (
              <p className="mt-1 max-w-prose text-xs text-muted-ink">{perk.description}</p>
            )}
          </div>
        </div>
        <span className="shrink-0 font-[family-name:var(--font-jetbrains)] text-xs font-bold text-signal-cyan">
          {perk.priceCredits.toLocaleString()}
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
      ) : owned && justBought ? (
        <>
          <form action={refundAction}>
            <input type="hidden" name="perkId" value={perk.id} />
            <RefundButton />
          </form>
          <FormMessage state={refundState} />
        </>
      ) : (
        <>
          <form action={buyAction}>
            <input type="hidden" name="perkId" value={perk.id} />
            <UnlockButton owned={owned} canAfford={canAfford} />
          </form>
          <FormMessage state={buyState} />
        </>
      )}
    </li>
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

function UnlockButton({ owned, canAfford }: { owned: boolean; canAfford: boolean }) {
  const { pending } = useFormStatus();
  const disabled = pending || owned || !canAfford;

  return (
    <button
      type="submit"
      disabled={disabled}
      className={`flex w-full items-center justify-center gap-1.5 border px-3 py-2 font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] transition-colors disabled:cursor-not-allowed pointer-coarse:min-h-11 ${
        owned
          ? "border-signal-cyan bg-signal-cyan/10 text-signal-cyan"
          : "border-steel-blue text-signal-cyan hover:bg-elevated-ledger hover:text-live-cyan disabled:border-elevated-ledger disabled:text-muted-ink"
      }`}
    >
      {owned ? (
        <>
          <Check size={13} aria-hidden="true" /> Owned
        </>
      ) : (
        <>
          <Sparkles size={13} aria-hidden="true" />
          {pending ? "Unlocking…" : !canAfford ? "Insufficient credits" : "Unlock"}
        </>
      )}
    </button>
  );
}
