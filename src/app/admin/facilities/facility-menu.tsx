"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { MoreVertical, Pencil, Lock, Unlock, Trash2, AlertTriangle } from "lucide-react";
import {
  setFacilityOpen,
  deleteFacility,
  type FormState,
} from "@/app/admin/facility-actions";
import type { Facility } from "@/lib/schema";
import { Dialog } from "@/components/ui/dialog";
import { FacilityForm } from "./facility-form";

/*
 * Per-facility action menu (Facilities admin list), trimmed down from
 * card-menu.tsx's WAI-ARIA menu-button skeleton — same open/close,
 * roving-focus, and two-step delete confirm, just without the per-operator
 * assignment list (not applicable to a facility).
 */
export function FacilityMenu({ facility }: { facility: Facility }) {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [align, setAlign] = useState<"left" | "right">("right");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const confirmDeleteRef = useRef<HTMLButtonElement>(null);
  const [interacted, setInteracted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [toggleState, toggleAction] = useActionState<FormState, FormData>(setFacilityOpen, {});
  const [deleteState, deleteAction] = useActionState<FormState, FormData>(deleteFacility, {});

  function menuItems() {
    return Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
  }

  function closeMenu(restoreFocus = false) {
    setOpen(false);
    setConfirmingDelete(false);
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
    if (confirmingDelete) confirmDeleteRef.current?.focus();
  }, [confirmingDelete]);

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
        setConfirmingDelete(false);
        const rect = triggerRef.current?.getBoundingClientRect();
        setAlign(rect && rect.right - MENU_WIDTH < 8 ? "left" : "right");
      }
      return !v;
    });
  }

  const showToggleErr = interacted && Boolean(toggleState.error);
  const showDeleteErr = interacted && Boolean(deleteState.error);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${facility.name}`}
        onClick={toggle}
        className="flex size-7 items-center justify-center bg-void-navy text-case-file-white transition-colors hover:text-signal-cyan pointer-coarse:size-11"
      >
        <MoreVertical size={15} aria-hidden="true" />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={`${facility.name} actions`}
          onKeyDown={onMenuKeyDown}
          className={`absolute top-full z-20 mt-1 w-52 border border-steel-blue bg-elevated-ledger py-1 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {(showToggleErr || showDeleteErr) && (
            <div className="flex flex-col gap-1 px-1 pb-1">
              {showToggleErr && <MenuBanner>{toggleState.error}</MenuBanner>}
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
            Edit facility
          </button>

          <form action={toggleAction} onSubmit={() => setInteracted(true)}>
            <input type="hidden" name="facilityId" value={facility.id} />
            <input type="hidden" name="isOpen" value={String(!facility.isOpen)} />
            <ToggleOpenItem isOpen={facility.isOpen} />
          </form>

          <form action={deleteAction} onSubmit={() => setInteracted(true)}>
            <input type="hidden" name="facilityId" value={facility.id} />
            {confirmingDelete ? (
              <div className="flex flex-col gap-1.5 px-3 py-1.5">
                <p className="font-[family-name:var(--font-inter)] text-[0.6875rem] text-muted-ink">
                  Removes every listing and restock rule too.
                </p>
                <div className="flex gap-1.5">
                  <ConfirmDeleteItem innerRef={confirmDeleteRef} />
                  <CancelDeleteItem onClick={() => setConfirmingDelete(false)} />
                </div>
              </div>
            ) : (
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={() => setConfirmingDelete(true)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-[family-name:var(--font-inter)] text-[0.8125rem] text-muted-ink transition-colors hover:bg-ledger-teal hover:text-stamp-red focus:bg-ledger-teal focus:text-stamp-red focus:outline-none pointer-coarse:min-h-11"
              >
                <Trash2 size={13} className="shrink-0" aria-hidden="true" />
                Delete facility
              </button>
            )}
          </form>
        </div>
      )}

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} title={`Edit ${facility.name}`}>
        {editOpen && <FacilityForm facility={facility} onSaved={() => setEditOpen(false)} />}
      </Dialog>
    </div>
  );
}

function ToggleOpenItem({ isOpen }: { isOpen: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      role="menuitem"
      tabIndex={-1}
      disabled={pending}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-[family-name:var(--font-inter)] text-[0.8125rem] text-case-file-white transition-colors hover:bg-ledger-teal hover:text-signal-cyan focus:bg-ledger-teal focus:text-signal-cyan focus:outline-none disabled:opacity-60 pointer-coarse:min-h-11"
    >
      {isOpen ? (
        <Lock size={13} className="shrink-0 text-muted-ink" aria-hidden="true" />
      ) : (
        <Unlock size={13} className="shrink-0 text-muted-ink" aria-hidden="true" />
      )}
      {pending ? "…" : isOpen ? "Close facility" : "Open facility"}
    </button>
  );
}

function ConfirmDeleteItem({ innerRef }: { innerRef: React.Ref<HTMLButtonElement> }) {
  const { pending } = useFormStatus();
  return (
    <button
      ref={innerRef}
      type="submit"
      role="menuitem"
      tabIndex={-1}
      disabled={pending}
      className="flex flex-1 items-center justify-center gap-1.5 bg-stamp-red px-3 py-1.5 font-[family-name:var(--font-inter)] text-[0.8125rem] text-case-file-white transition-colors hover:bg-stamp-red/80 focus:outline-none disabled:opacity-60 pointer-coarse:min-h-11"
    >
      <Trash2 size={13} aria-hidden="true" />
      {pending ? "Deleting…" : "Confirm"}
    </button>
  );
}

function CancelDeleteItem({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      onClick={onClick}
      className="flex-1 px-3 py-1.5 text-center font-[family-name:var(--font-inter)] text-[0.8125rem] text-muted-ink transition-colors hover:bg-ledger-teal hover:text-case-file-white focus:outline-none pointer-coarse:min-h-11"
    >
      Cancel
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
