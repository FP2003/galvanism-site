"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Sparkles, Undo2 } from "lucide-react";
import { refundPerkPurchase, type FormState } from "@/app/admin/facility-perks-actions";
import type { FacilityPerkPurchase, FacilityPerk, Facility } from "@/lib/schema";

// Admin view of a character's unlocked facility perks (Phase 6), mirroring
// CardAssignment's owned-row shape — no "assign a perk for free" counterpart
// exists (perks are always bought), so this is refund/remove only.
export function PerkPurchases({
  purchases,
}: {
  purchases: (FacilityPerkPurchase & { perk: FacilityPerk & { facility: Facility } })[];
}) {
  if (purchases.length === 0) {
    return (
      <p className="font-[family-name:var(--font-inter)] text-[0.8125rem] text-muted-ink">
        No perks unlocked yet.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-elevated-ledger border-y border-elevated-ledger">
      {purchases.map((p) => (
        <li key={p.id} className="flex items-center gap-3 py-3">
          <Sparkles size={14} className="shrink-0 text-steel-blue" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-[family-name:var(--font-chakra)] text-sm font-semibold uppercase tracking-[0.03em] text-case-file-white">
              {p.perk.name}
            </p>
            <p className="truncate font-[family-name:var(--font-jetbrains)] text-[0.6875rem] text-muted-ink">
              {p.perk.facility.name}
            </p>
          </div>
          <RefundForm purchaseId={p.id} />
        </li>
      ))}
    </ul>
  );
}

function RefundForm({ purchaseId }: { purchaseId: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(refundPerkPurchase, {});
  return (
    <form action={formAction} className="flex shrink-0 flex-col items-end gap-1">
      <input type="hidden" name="purchaseId" value={purchaseId} />
      <RefundButton />
      {state.error && (
        <p className="max-w-[10rem] text-right text-[0.6875rem] text-stamp-red">{state.error}</p>
      )}
    </form>
  );
}

function RefundButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-1.5 border border-elevated-ledger px-2 py-1.5 font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-muted-ink transition-colors hover:border-stamp-red hover:text-stamp-red disabled:opacity-60 pointer-coarse:min-h-11"
    >
      <Undo2 size={13} aria-hidden="true" />
      {pending ? "…" : "Refund"}
    </button>
  );
}
