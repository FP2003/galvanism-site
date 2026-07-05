"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  MoreVertical,
  Plus,
  Trash2,
  Check,
  AlertTriangle,
} from "lucide-react";
import {
  assignCard,
  deleteCard,
  type FormState,
} from "@/app/admin/card-actions";
import type { AssignmentTarget } from "@/lib/card-data";

/*
 * Per-card action menu (Card Library). A WAI-ARIA menu button: opening moves
 * focus into the menu, roving focus (Arrow/Home/End) walks the items, and
 * Escape/Tab/outside-click close it (keyboard closes restore focus to the
 * trigger). Assign and delete post through useActionState so the result is
 * surfaced instead of swallowed — assign keeps the menu open with a
 * confirmation so the DM can both verify it landed and fan one card out to
 * several operators without reopening; a failed delete shows its error inline
 * (on success the card unmounts, taking the menu with it).
 */
export function CardMenu({
  cardId,
  title,
  targets,
}: {
  cardId: string;
  title: string;
  targets: AssignmentTarget[];
}) {
  const [open, setOpen] = useState(false);
  // Gates the result banner so a stale "Assigned to…" doesn't reappear on reopen.
  const [interacted, setInteracted] = useState(false);
  const [lastAssigned, setLastAssigned] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [assignState, assignAction] = useActionState<FormState, FormData>(
    assignCard,
    {},
  );
  const [deleteState, deleteAction] = useActionState<FormState, FormData>(
    deleteCard,
    {},
  );

  function menuItems() {
    return Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
  }

  function closeMenu(restoreFocus = false) {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }

  // Outside pointerdown dismisses (focus follows the click, so no restore).
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Move focus into the menu when it opens (WAI-ARIA menu button pattern).
  useEffect(() => {
    if (open) menuItems()[0]?.focus();
  }, [open]);

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
      case "Home":
        e.preventDefault();
        items[0]?.focus();
        break;
      case "End":
        e.preventDefault();
        items[items.length - 1]?.focus();
        break;
      case "Escape":
      case "Tab":
        // Both close the menu and park focus on the trigger — a predictable
        // continuation rather than letting Tab fall into unmounting items.
        e.preventDefault();
        closeMenu(true);
        break;
    }
  }

  function toggle() {
    setOpen((v) => {
      if (!v) setInteracted(false); // fresh open — hide any stale result banner
      return !v;
    });
  }

  const showAssignOk = interacted && assignState.ok && lastAssigned;
  const showAssignErr = interacted && Boolean(assignState.error);
  const showDeleteErr = interacted && Boolean(deleteState.error);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${title}`}
        onClick={toggle}
        className="flex size-7 items-center justify-center bg-void-navy text-case-file-white transition-colors hover:text-signal-cyan pointer-coarse:size-9"
      >
        <MoreVertical size={15} aria-hidden="true" />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={`${title} actions`}
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 top-full z-20 mt-1 w-52 border border-steel-blue bg-elevated-ledger py-1"
        >
          {(showAssignOk || showAssignErr || showDeleteErr) && (
            <div className="flex flex-col gap-1 px-1 pb-1">
              {showAssignErr && (
                <MenuBanner tone="error">{assignState.error}</MenuBanner>
              )}
              {showDeleteErr && (
                <MenuBanner tone="error">{deleteState.error}</MenuBanner>
              )}
              {showAssignOk && (
                <MenuBanner tone="ok">Assigned to {lastAssigned}</MenuBanner>
              )}
            </div>
          )}

          {targets.length > 0 && (
            <>
              <p className="px-3 py-1 font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">
                Assign to operator
              </p>
              <ul className="max-h-48 overflow-y-auto">
                {targets.map((t) => (
                  <li key={t.id}>
                    <form
                      action={assignAction}
                      onSubmit={() => {
                        setInteracted(true);
                        setLastAssigned(t.callsign);
                      }}
                    >
                      <input type="hidden" name="cardId" value={cardId} />
                      <input type="hidden" name="characterId" value={t.id} />
                      <AssignItem
                        label={t.callsign}
                        suffix={t.approved ? "" : " (pending)"}
                      />
                    </form>
                  </li>
                ))}
              </ul>
              <div className="my-1 border-t border-ledger-teal" />
            </>
          )}

          <form
            action={deleteAction}
            onSubmit={(e) => {
              if (
                !window.confirm(
                  `Delete “${title}”? This unassigns it from every operator who holds it.`,
                )
              ) {
                e.preventDefault();
                return;
              }
              setInteracted(true);
            }}
          >
            <input type="hidden" name="cardId" value={cardId} />
            <DeleteItem />
          </form>
        </div>
      )}
    </div>
  );
}

function AssignItem({ label, suffix }: { label: string; suffix: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      role="menuitem"
      tabIndex={-1}
      disabled={pending}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-[family-name:var(--font-inter)] text-[0.8125rem] text-case-file-white transition-colors hover:bg-ledger-teal hover:text-signal-cyan focus:bg-ledger-teal focus:text-signal-cyan focus:outline-none disabled:opacity-60 pointer-coarse:py-2.5"
    >
      <Plus size={13} className="shrink-0 text-steel-blue" aria-hidden="true" />
      <span className="truncate">
        {label}
        {suffix}
      </span>
      {pending && (
        <span className="ml-auto shrink-0 font-[family-name:var(--font-chakra)] text-[0.625rem] uppercase tracking-[0.08em] text-muted-ink">
          …
        </span>
      )}
    </button>
  );
}

function DeleteItem() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      role="menuitem"
      tabIndex={-1}
      disabled={pending}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-[family-name:var(--font-inter)] text-[0.8125rem] text-muted-ink transition-colors hover:bg-ledger-teal hover:text-stamp-red focus:bg-ledger-teal focus:text-stamp-red focus:outline-none disabled:opacity-60 pointer-coarse:py-2.5"
    >
      <Trash2 size={13} className="shrink-0" aria-hidden="true" />
      {pending ? "Deleting…" : "Delete card"}
    </button>
  );
}

function MenuBanner({
  tone,
  children,
}: {
  tone: "ok" | "error";
  children: React.ReactNode;
}) {
  // Filled treatments, matching FormMessage — raw cyan/red text fails contrast
  // on the Elevated-Ledger menu surface; a solid fill reads on any tone.
  const isOk = tone === "ok";
  return (
    <p
      role={isOk ? "status" : "alert"}
      className={`flex items-start gap-1.5 px-2 py-1.5 font-[family-name:var(--font-inter)] text-[0.75rem] ${
        isOk ? "bg-signal-cyan text-void-navy" : "bg-stamp-red text-case-file-white"
      }`}
    >
      {isOk ? (
        <Check size={13} className="mt-px shrink-0" aria-hidden="true" />
      ) : (
        <AlertTriangle size={13} className="mt-px shrink-0" aria-hidden="true" />
      )}
      <span className="min-w-0">{children}</span>
    </p>
  );
}
