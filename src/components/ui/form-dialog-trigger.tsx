"use client";

import { useState } from "react";
import { Dialog } from "./dialog";

/*
 * Compact button that opens its children (typically a form) in a Dialog.
 * Sized to sit in a Panel's header `meta` slot next to the title, so the
 * page body can show a read-only summary while the edit form stays hidden
 * until needed.
 */
export function FormDialogTrigger({
  label,
  title,
  children,
}: {
  label: string;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 border border-steel-blue px-3 py-1.5 font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-signal-cyan transition-colors hover:bg-elevated-ledger hover:text-live-cyan pointer-coarse:min-h-11"
      >
        {label}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title}>
        {children}
      </Dialog>
    </>
  );
}
