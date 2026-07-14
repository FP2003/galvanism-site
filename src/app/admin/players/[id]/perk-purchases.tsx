"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Sparkles, Undo2, Check } from "lucide-react";
import { refundPerkContribution, type FormState } from "@/app/admin/facility-perks-actions";
import type { FacilityPerkContribution, FacilityPerk, Facility } from "@/lib/schema";

// Admin view of a character's perk contributions (Phase 6, reworked from a
// one-time per-character purchase into a crowd-funded team upgrade) —
// mirrors CardAssignment's owned-row shape, but a character can appear here
// more than once per perk since contributions are repeatable. No "assign for
// free" counterpart exists (perks are always funded via contribution), so
// this is refund/remove only, scoped to one contribution at a time.
export function PerkPurchases({
  purchases,
}: {
  purchases: (FacilityPerkContribution & { perk: FacilityPerk & { facility: Facility } })[];
}) {
  if (purchases.length === 0) {
    return (
      <p className="font-[family-name:var(--font-inter)] text-[0.8125rem] text-muted-ink">
        No perk contributions yet.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-elevated-ledger border-y border-elevated-ledger">
      {purchases.map((p) => (
        <li key={p.id} className="flex items-center gap-3 py-3">
          <Sparkles size={14} className="shrink-0 text-muted-ink" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-[family-name:var(--font-chakra)] text-sm font-semibold uppercase tracking-[0.03em] text-case-file-white">
              {p.perk.name}
            </p>
            <p className="truncate font-[family-name:var(--font-jetbrains)] text-[0.6875rem] text-muted-ink">
              {p.perk.facility.name} · {p.amount.toLocaleString()} Cr
              {p.perk.fundedAt && (
                <span className="ml-1 inline-flex items-center gap-0.5 text-signal-cyan">
                  <Check size={10} aria-hidden="true" /> Funded
                </span>
              )}
            </p>
          </div>
          <RefundForm contributionId={p.id} />
        </li>
      ))}
    </ul>
  );
}

function RefundForm({ contributionId }: { contributionId: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(refundPerkContribution, {});
  return (
    <form action={formAction} className="flex shrink-0 flex-col items-end gap-1">
      <input type="hidden" name="contributionId" value={contributionId} />
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
