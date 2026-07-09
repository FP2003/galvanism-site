"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  MoreVertical,
  Pencil,
  Lock,
  Trash2,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { closeBallot, deleteBallot, type FormState } from "@/app/admin/ballot-actions";
import type { Ballot, BallotOption } from "@/lib/schema";
import { Dialog } from "@/components/ui/dialog";
import { BallotForm } from "./ballot-form";

/*
 * Per-ballot action menu (Ballots admin list), trimmed down from
 * missions/mission-menu.tsx's WAI-ARIA menu-button skeleton. Close and delete
 * both need a confirm — close locks the tally for good, delete drops every
 * vote too.
 */
export function BallotMenu({ ballot }: { ballot: Ballot & { options: BallotOption[] } }) {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [align, setAlign] = useState<"left" | "right">("right");
  const [confirming, setConfirming] = useState<"close" | "delete" | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [interacted, setInteracted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [closeState, closeAction] = useActionState<FormState, FormData>(closeBallot, {});
  const [deleteState, deleteAction] = useActionState<FormState, FormData>(deleteBallot, {});

  function menuItems() {
    return Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
  }

  function closeMenu(restoreFocus = false) {
    setOpen(false);
    setConfirming(null);
    if (restoreFocus) triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) closeMenu();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) menuItems()[0]?.focus();
  }, [open]);

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  const MENU_WIDTH = 208;

  function onMenuKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const items = menuItems();
    if (items.length === 0) return;
    const idx = items.indexOf(document.activeElement as HTMLElement);
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        items[(idx + 1) % items.length]?.focus();
        break;
      case "ArrowUp":
        e.preventDefault();
        items[(idx - 1 + items.length) % items.length]?.focus();
        break;
      case "Escape":
      case "Tab":
        e.preventDefault();
        closeMenu(true);
        break;
    }
  }

  function toggle() {
    setOpen((v) => {
      if (!v) {
        setInteracted(false);
        setConfirming(null);
        const rect = triggerRef.current?.getBoundingClientRect();
        setAlign(rect && rect.right - MENU_WIDTH < 8 ? "left" : "right");
      }
      return !v;
    });
  }

  const showCloseErr = interacted && Boolean(closeState.error);
  const showDeleteErr = interacted && Boolean(deleteState.error);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${ballot.title}`}
        onClick={toggle}
        className="flex size-7 items-center justify-center bg-void-navy text-case-file-white transition-colors hover:text-signal-cyan pointer-coarse:size-11"
      >
        <MoreVertical size={15} aria-hidden="true" />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={`${ballot.title} actions`}
          onKeyDown={onMenuKeyDown}
          className={`absolute top-full z-20 mt-1 w-52 border border-steel-blue bg-elevated-ledger py-1 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {(showCloseErr || showDeleteErr) && (
            <div className="flex flex-col gap-1 px-1 pb-1">
              {showCloseErr && <MenuBanner>{closeState.error}</MenuBanner>}
              {showDeleteErr && <MenuBanner>{deleteState.error}</MenuBanner>}
            </div>
          )}

          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            onClick={() => {
              closeMenu();
              setEditOpen(true);
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-[family-name:var(--font-inter)] text-[0.8125rem] text-muted-ink transition-colors hover:bg-ledger-teal hover:text-signal-cyan focus:bg-ledger-teal focus:text-signal-cyan focus:outline-none pointer-coarse:min-h-11"
          >
            <Pencil size={13} className="shrink-0" aria-hidden="true" />
            Edit ballot
          </button>

          {ballot.status === "open" && (
            <form action={closeAction} onSubmit={() => setInteracted(true)}>
              <input type="hidden" name="ballotId" value={ballot.id} />
              {confirming === "close" ? (
                <ConfirmRow
                  innerRef={confirmRef}
                  pendingLabel="Closing…"
                  label="Confirm close"
                  onCancel={() => setConfirming(null)}
                />
              ) : (
                <MenuItem icon={Lock} label="Close ballot" onClick={() => setConfirming("close")} />
              )}
            </form>
          )}

          <form action={deleteAction} onSubmit={() => setInteracted(true)}>
            <input type="hidden" name="ballotId" value={ballot.id} />
            {confirming === "delete" ? (
              <div className="flex flex-col gap-1.5 px-3 py-1.5">
                <p className="font-[family-name:var(--font-inter)] text-[0.6875rem] text-muted-ink">
                  Removes every option and vote too.
                </p>
                <ConfirmRow
                  innerRef={confirmRef}
                  pendingLabel="Deleting…"
                  label="Confirm delete"
                  danger
                  onCancel={() => setConfirming(null)}
                />
              </div>
            ) : (
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={() => setConfirming("delete")}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-[family-name:var(--font-inter)] text-[0.8125rem] text-muted-ink transition-colors hover:bg-ledger-teal hover:text-stamp-red focus:bg-ledger-teal focus:text-stamp-red focus:outline-none pointer-coarse:min-h-11"
              >
                <Trash2 size={13} className="shrink-0" aria-hidden="true" />
                Delete ballot
              </button>
            )}
          </form>
        </div>
      )}

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} title={`Edit ${ballot.title}`}>
        {editOpen && <BallotForm ballot={ballot} onSaved={() => setEditOpen(false)} />}
      </Dialog>
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-[family-name:var(--font-inter)] text-[0.8125rem] text-muted-ink transition-colors hover:bg-ledger-teal hover:text-signal-cyan focus:bg-ledger-teal focus:text-signal-cyan focus:outline-none pointer-coarse:min-h-11"
    >
      <Icon size={13} className="shrink-0" aria-hidden="true" />
      {label}
    </button>
  );
}

function ConfirmRow({
  innerRef,
  label,
  pendingLabel,
  danger,
  onCancel,
}: {
  innerRef: React.Ref<HTMLButtonElement>;
  label: string;
  pendingLabel: string;
  danger?: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="flex gap-1.5 px-3 py-1.5">
      <ConfirmButton innerRef={innerRef} label={label} pendingLabel={pendingLabel} danger={danger} />
      <button
        type="button"
        role="menuitem"
        tabIndex={-1}
        onClick={onCancel}
        className="flex-1 px-3 py-1.5 text-center font-[family-name:var(--font-inter)] text-[0.8125rem] text-muted-ink transition-colors hover:bg-ledger-teal hover:text-case-file-white focus:outline-none pointer-coarse:min-h-11"
      >
        Cancel
      </button>
    </div>
  );
}

function ConfirmButton({
  innerRef,
  label,
  pendingLabel,
  danger,
}: {
  innerRef: React.Ref<HTMLButtonElement>;
  label: string;
  pendingLabel: string;
  danger?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      ref={innerRef}
      type="submit"
      role="menuitem"
      tabIndex={-1}
      disabled={pending}
      className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-1.5 font-[family-name:var(--font-inter)] text-[0.8125rem] text-case-file-white transition-colors focus:outline-none disabled:opacity-60 pointer-coarse:min-h-11 ${
        danger ? "bg-stamp-red hover:bg-stamp-red/80" : "bg-signal-cyan text-void-navy hover:bg-live-cyan"
      }`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function MenuBanner({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-1.5 bg-stamp-red px-2 py-1.5 font-[family-name:var(--font-inter)] text-[0.75rem] text-case-file-white"
    >
      <AlertTriangle size={13} className="mt-px shrink-0" aria-hidden="true" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}
