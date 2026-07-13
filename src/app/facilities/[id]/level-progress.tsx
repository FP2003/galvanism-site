"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Meter } from "@/components/ui/meter";
import { FormMessage } from "@/components/ui/form";
import { donateToFacilityLevel, type FormState } from "./purchase-actions";

// Crowd-funded facility level-up (Phase 6+): players donate any amount of
// Credits they want toward the next level, shown as a pooled progress bar —
// same Meter primitive as the HP/Energy/Ammo trackers and the ballot tally.
// Reaching nextLevelCost auto-levels the facility server-side (see
// donateToFacilityLevel); this component just reflects whatever the latest
// server-rendered pool total is, refreshed by the page's AutoRefresh.
export function LevelProgress({
  facilityId,
  level,
  nextLevelCost,
  total,
  byCharacter,
  credits,
  previewOnly,
}: {
  facilityId: string;
  level: number;
  nextLevelCost: number;
  total: number;
  byCharacter: { callsign: string; amount: number }[];
  credits: number;
  previewOnly?: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(donateToFacilityLevel, {});
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (state.ok) setAmount("");
  }, [state]);

  const parsed = Number(amount);
  const valid = amount.trim() !== "" && Number.isInteger(parsed) && parsed > 0;
  const canAfford = valid && parsed <= credits;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2 font-[family-name:var(--font-jetbrains)] text-sm text-case-file-white">
          <span>Level {level + 1}</span>
          <span>
            {total.toLocaleString()}
            <span className="text-muted-ink">/{nextLevelCost.toLocaleString()} Cr</span>
          </span>
        </div>
        <Meter
          value={total}
          max={nextLevelCost}
          tone="live"
          label={`Progress toward Level ${level + 1}: ${total} of ${nextLevelCost} Cr`}
        />
      </div>
      {byCharacter.length > 0 && (
        <p className="font-[family-name:var(--font-jetbrains)] text-[0.6875rem] text-muted-ink">
          {byCharacter.map((c) => `${c.callsign} (${c.amount.toLocaleString()} Cr)`).join(", ")}
        </p>
      )}
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
          <form action={formAction} className="flex items-center gap-2">
            <input type="hidden" name="facilityId" value={facilityId} />
            <input
              type="number"
              min={1}
              inputMode="numeric"
              name="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
              aria-label="Donation amount in Credits"
              className="w-full border border-elevated-ledger bg-void-navy px-2 py-1.5 text-center font-[family-name:var(--font-jetbrains)] text-sm text-case-file-white outline-none focus:border-signal-cyan pointer-coarse:py-3"
            />
            <DonateButton valid={valid} canAfford={canAfford} />
          </form>
          <FormMessage state={state} />
        </>
      )}
    </div>
  );
}

function DonateButton({ valid, canAfford }: { valid: boolean; canAfford: boolean }) {
  const { pending } = useFormStatus();
  const disabled = pending || !valid || !canAfford;
  return (
    <button
      type="submit"
      disabled={disabled}
      className="flex shrink-0 items-center justify-center gap-1.5 border border-steel-blue px-3 py-2 font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-signal-cyan transition-colors hover:bg-elevated-ledger hover:text-live-cyan disabled:cursor-not-allowed disabled:border-elevated-ledger disabled:text-muted-ink pointer-coarse:min-h-11"
    >
      {pending ? "Working…" : valid && !canAfford ? "Insufficient Cr" : "Donate"}
    </button>
  );
}
