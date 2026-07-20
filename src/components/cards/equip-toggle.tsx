"use client";

import { useFormStatus } from "react-dom";
import { Power, PowerOff } from "lucide-react";

// Shared equip/unequip button face — used as the submit control inside
// whichever equip-related form wraps it (loadout's own equipped-boolean
// form, admin's equipped-boolean form, and admin's weapon-slot-clear form).
// Label is action-labeled ("Unequip"/"Equip" — what clicking it does), not
// state-labeled, so the two surfaces can't drift into different wording for
// the same toggle.
export function EquipToggleButton({
  equipped,
  fullWidth = false,
  disabled = false,
  title,
}: {
  equipped: boolean;
  fullWidth?: boolean;
  /** Blocks equipping when the character is already at slot capacity — never
   *  applies to unequipping, which is always allowed. */
  disabled?: boolean;
  title?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      title={title}
      className={`inline-flex items-center justify-center gap-1.5 border px-2.5 py-1.5 font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.08em] transition-colors disabled:opacity-60 pointer-coarse:min-h-11 ${
        fullWidth ? "w-full" : ""
      } ${
        equipped
          ? "border-signal-cyan bg-signal-cyan/10 text-signal-cyan hover:bg-signal-cyan/20"
          : "border-steel-blue text-muted-ink hover:bg-elevated-ledger hover:text-signal-cyan"
      }`}
    >
      {equipped ? (
        <Power size={13} aria-hidden="true" />
      ) : (
        <PowerOff size={13} aria-hidden="true" />
      )}
      {pending ? "…" : equipped ? "Unequip" : disabled ? "Full" : "Equip"}
    </button>
  );
}
