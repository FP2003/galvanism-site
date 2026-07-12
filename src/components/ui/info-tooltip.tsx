"use client";

import { Info } from "lucide-react";

/*
 * Small hover/focus tooltip for a short explanatory note next to a label —
 * e.g. clarifying what a numeric field controls without a permanent hint
 * line taking up space in a compact form row.
 */
export function InfoTooltip({ label }: { label: string }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={label}
        className="flex size-4 shrink-0 items-center justify-center text-muted-ink transition-colors hover:text-signal-cyan focus-visible:text-signal-cyan pointer-coarse:size-11"
      >
        <Info size={13} aria-hidden="true" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 w-56 max-w-[calc(100vw-2rem)] border border-elevated-ledger bg-void-navy p-2 font-[family-name:var(--font-inter)] text-[0.6875rem] font-normal normal-case tracking-normal text-case-file-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}
