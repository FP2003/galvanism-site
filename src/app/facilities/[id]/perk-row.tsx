"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Sparkles, Check } from "lucide-react";
import { Meter } from "@/components/ui/meter";
import { FormMessage } from "@/components/ui/form";
import { contributeToPerk, type FormState } from "./purchase-actions";
import type { FacilityPerk } from "@/lib/schema";

// One descriptive-perk row (Phase 6 Step 3, reworked into a crowd-funded team
// upgrade): a permanent, facility-wide unlock the DM honors at the table.
// Unlike XP offerings/listings, nobody "owns" a perk — any character can chip
// in any amount toward its priceCredits, and once the pool reaches that
// price the perk is funded for everyone. No self-refund once contributed,
// same reasoning as the old top-level facility-level donation had (a shared
// pool isn't something one contributor can buy back out).
export function PerkRow({
  perk,
  total,
  byCharacter,
  credits,
  previewOnly,
}: {
  perk: FacilityPerk;
  total: number;
  byCharacter: { callsign: string; amount: number }[];
  credits: number;
  previewOnly?: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(contributeToPerk, {});
  const [amount, setAmount] = useState("");
  const funded = perk.fundedAt != null;

  useEffect(() => {
    if (state.ok) setAmount("");
  }, [state]);

  const parsed = Number(amount);
  const valid = amount.trim() !== "" && Number.isInteger(parsed) && parsed > 0;
  const canAfford = valid && parsed <= credits;

  return (
    <li className="flex flex-col gap-2 border border-elevated-ledger p-3">
      <div className="flex flex-1 items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Sparkles size={16} className="mt-0.5 shrink-0 text-muted-ink" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate font-[family-name:var(--font-chakra)] text-sm font-semibold uppercase tracking-[0.03em] text-case-file-white">
              {perk.name}
            </p>
            {perk.description && (
              <p className="mt-1 max-w-prose text-xs text-muted-ink">{perk.description}</p>
            )}
          </div>
        </div>
        {funded ? (
          <span className="flex shrink-0 items-center gap-1 font-[family-name:var(--font-jetbrains)] text-xs font-bold text-signal-cyan">
            <Check size={13} aria-hidden="true" /> Funded
          </span>
        ) : (
          <span className="shrink-0 font-[family-name:var(--font-jetbrains)] text-xs font-bold text-signal-cyan">
            {Math.min(total, perk.priceCredits).toLocaleString()}
            <span className="text-muted-ink">/{perk.priceCredits.toLocaleString()} Cr</span>
          </span>
        )}
      </div>
      {!funded && (
        <Meter
          value={total}
          max={perk.priceCredits}
          tone="live"
          label={`${perk.name} funding: ${total} of ${perk.priceCredits} Cr`}
        />
      )}
      {byCharacter.length > 0 && (
        <p className="font-[family-name:var(--font-jetbrains)] text-[0.6875rem] text-muted-ink">
          {byCharacter.map((c) => `${c.callsign} (${c.amount.toLocaleString()} Cr)`).join(", ")}
        </p>
      )}
      {funded ? null : previewOnly ? (
        <button
          type="button"
          disabled
          className="flex w-full cursor-not-allowed items-center justify-center gap-1.5 border border-elevated-ledger px-3 py-2 font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink pointer-coarse:min-h-11"
        >
          Admin preview
        </button>
      ) : (
        <>
          <form action={formAction} className="flex items-center gap-2">
            <input type="hidden" name="perkId" value={perk.id} />
            <input
              type="number"
              min={1}
              inputMode="numeric"
              name="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
              aria-label={`Contribution amount toward ${perk.name} in Credits`}
              className="w-full border border-elevated-ledger bg-void-navy px-2 py-1.5 text-center font-[family-name:var(--font-jetbrains)] text-sm text-case-file-white outline-none focus:border-signal-cyan pointer-coarse:py-3"
            />
            <ContributeButton valid={valid} canAfford={canAfford} />
          </form>
          <FormMessage state={state} />
        </>
      )}
    </li>
  );
}

function ContributeButton({ valid, canAfford }: { valid: boolean; canAfford: boolean }) {
  const { pending } = useFormStatus();
  const disabled = pending || !valid || !canAfford;
  return (
    <button
      type="submit"
      disabled={disabled}
      className="flex shrink-0 items-center justify-center gap-1.5 border border-steel-blue px-3 py-2 font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-signal-cyan transition-colors hover:bg-elevated-ledger hover:text-live-cyan disabled:cursor-not-allowed disabled:border-elevated-ledger disabled:text-muted-ink pointer-coarse:min-h-11"
    >
      {pending ? "Working…" : valid && !canAfford ? "Insufficient Cr" : "Contribute"}
    </button>
  );
}
