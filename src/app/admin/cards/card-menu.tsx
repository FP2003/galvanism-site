"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  MoreVertical,
  Plus,
  Minus,
  Pencil,
  Trash2,
  Check,
  AlertTriangle,
} from "lucide-react";
import {
  assignCard,
  unassignCard,
  deleteCard,
  type FormState,
} from "@/app/admin/card-actions";
import type { CardAssignmentTarget } from "@/lib/card-data";
import type { CardWithEffects } from "@/lib/schema";
import { Dialog } from "@/components/ui/dialog";
import { CardForm } from "./card-form";

/*
 * Per-card action menu (Card Library). A WAI-ARIA menu button: opening moves
 * focus into the menu, roving focus (Arrow/Home/End) walks the items, and
 * Escape/Tab/outside-click close it (keyboard closes restore focus to the
 * trigger). Every operator gets one row that toggles between assign (+, not
 * held) and remove (−, held) — the sign itself tells the DM at a glance who
 * already has the card, no need to track two separate lists. Assign/remove/
 * delete all post through useActionState so the result is surfaced instead
 * of swallowed; the menu stays open after assign/remove so the DM can fan a
 * card across several operators without reopening (a failed delete shows its
 * error inline; on success the card unmounts, taking the menu with it).
 */
export function CardMenu({
  card,
  targets,
}: {
  card: CardWithEffects;
  targets: CardAssignmentTarget[];
}) {
  const cardId = card.id;
  const title = card.title;
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [align, setAlign] = useState<"left" | "right">("right");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const confirmDeleteRef = useRef<HTMLButtonElement>(null);
  // Gates the result banner so a stale one doesn't reappear on reopen, and
  // pins which action's state to read — assign/remove/delete each keep their
  // own useActionState, so without this a leftover ok/error from an earlier
  // action of a different kind could render alongside a fresh one.
  const [interacted, setInteracted] = useState(false);
  const [lastAction, setLastAction] = useState<
    { kind: "assign" | "remove"; callsign: string } | null
  >(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [assignState, assignAction] = useActionState<FormState, FormData>(
    assignCard,
    {},
  );
  const [unassignState, unassignAction] = useActionState<FormState, FormData>(
    unassignCard,
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
    setConfirmingDelete(false);
    if (restoreFocus) triggerRef.current?.focus();
  }

  // Outside pointerdown dismisses (focus follows the click, so no restore).
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) closeMenu();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Move focus into the menu when it opens (WAI-ARIA menu button pattern).
  useEffect(() => {
    if (open) menuItems()[0]?.focus();
  }, [open]);

  // Focus the confirm button the moment the delete row switches into its
  // confirm state, so keyboard users land straight on it.
  useEffect(() => {
    if (confirmingDelete) confirmDeleteRef.current?.focus();
  }, [confirmingDelete]);

  // The menu is 208px wide (w-52) and anchors its right edge to the trigger's
  // right edge by default; on a left-column card in a narrow grid that would
  // push the menu's left edge off-screen. Flip to left-anchored when there
  // isn't 208px of room to the trigger's left.
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
      if (!v) {
        setInteracted(false); // fresh open — hide any stale result banner
        setConfirmingDelete(false);
        const rect = triggerRef.current?.getBoundingClientRect();
        setAlign(rect && rect.right - MENU_WIDTH < 8 ? "left" : "right");
      }
      return !v;
    });
  }

  // Only the state matching the most recent action renders — otherwise a
  // leftover ok from an earlier assign could show alongside a fresh remove
  // error, since assign/remove/delete each hold their own useActionState.
  const activeState =
    lastAction?.kind === "assign"
      ? assignState
      : lastAction?.kind === "remove"
        ? unassignState
        : null;
  const showActionOk = interacted && activeState?.ok && lastAction;
  const showActionErr = interacted && Boolean(activeState?.error);
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
        className="flex size-7 items-center justify-center bg-void-navy text-case-file-white transition-colors hover:text-signal-cyan pointer-coarse:size-11"
      >
        <MoreVertical size={15} aria-hidden="true" />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={`${title} actions`}
          onKeyDown={onMenuKeyDown}
          className={`absolute top-full z-20 mt-1 w-52 border border-steel-blue bg-elevated-ledger py-1 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {(showActionOk || showActionErr || showDeleteErr) && (
            <div className="flex flex-col gap-1 px-1 pb-1">
              {showActionErr && (
                <MenuBanner tone="error">{activeState?.error}</MenuBanner>
              )}
              {showDeleteErr && (
                <MenuBanner tone="error">{deleteState.error}</MenuBanner>
              )}
              {showActionOk && lastAction && (
                <MenuBanner tone="ok">
                  {lastAction.kind === "assign" ? "Assigned to " : "Removed from "}
                  {lastAction.callsign}
                </MenuBanner>
              )}
            </div>
          )}

          {targets.length > 0 && (
            <>
              <p className="px-3 py-1 font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">
                Operators
              </p>
              <ul className="max-h-48 overflow-y-auto">
                {targets.map((t) =>
                  t.assignmentId ? (
                    <li key={t.id}>
                      <form
                        action={unassignAction}
                        onSubmit={() => {
                          setInteracted(true);
                          setLastAction({ kind: "remove", callsign: t.callsign });
                        }}
                      >
                        <input
                          type="hidden"
                          name="assignmentId"
                          value={t.assignmentId}
                        />
                        <RemoveItem
                          label={t.callsign}
                          suffix={t.approved ? "" : " (pending)"}
                        />
                      </form>
                    </li>
                  ) : (
                    <li key={t.id}>
                      <form
                        action={assignAction}
                        onSubmit={() => {
                          setInteracted(true);
                          setLastAction({ kind: "assign", callsign: t.callsign });
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
                  ),
                )}
              </ul>
              <div className="my-1 border-t border-ledger-teal" />
            </>
          )}

          <EditItem
            onClick={() => {
              closeMenu();
              setEditOpen(true);
            }}
          />

          <form
            action={deleteAction}
            onSubmit={() => setInteracted(true)}
          >
            <input type="hidden" name="cardId" value={cardId} />
            {confirmingDelete ? (
              <div className="flex flex-col gap-1.5 px-3 py-1.5">
                <p className="font-[family-name:var(--font-inter)] text-[0.6875rem] text-muted-ink">
                  Unassigns from every operator who holds it.
                </p>
                <div className="flex gap-1.5">
                  <ConfirmDeleteItem innerRef={confirmDeleteRef} />
                  <CancelDeleteItem onClick={() => setConfirmingDelete(false)} />
                </div>
              </div>
            ) : (
              <DeleteItem onClick={() => setConfirmingDelete(true)} />
            )}
          </form>
        </div>
      )}

      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={`Edit ${title}`}
      >
        {editOpen && <CardForm card={card} onSaved={() => setEditOpen(false)} />}
      </Dialog>
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
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-[family-name:var(--font-inter)] text-[0.8125rem] text-case-file-white transition-colors hover:bg-ledger-teal hover:text-signal-cyan focus:bg-ledger-teal focus:text-signal-cyan focus:outline-none disabled:opacity-60 pointer-coarse:min-h-11"
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

function RemoveItem({ label, suffix }: { label: string; suffix: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      role="menuitem"
      tabIndex={-1}
      disabled={pending}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-[family-name:var(--font-inter)] text-[0.8125rem] text-case-file-white transition-colors hover:bg-ledger-teal hover:text-stamp-red focus:bg-ledger-teal focus:text-stamp-red focus:outline-none disabled:opacity-60 pointer-coarse:min-h-11"
    >
      <Minus size={13} className="shrink-0 text-stamp-red" aria-hidden="true" />
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

function EditItem({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-[family-name:var(--font-inter)] text-[0.8125rem] text-muted-ink transition-colors hover:bg-ledger-teal hover:text-signal-cyan focus:bg-ledger-teal focus:text-signal-cyan focus:outline-none pointer-coarse:min-h-11"
    >
      <Pencil size={13} className="shrink-0" aria-hidden="true" />
      Edit card
    </button>
  );
}

function DeleteItem({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-[family-name:var(--font-inter)] text-[0.8125rem] text-muted-ink transition-colors hover:bg-ledger-teal hover:text-stamp-red focus:bg-ledger-teal focus:text-stamp-red focus:outline-none pointer-coarse:min-h-11"
    >
      <Trash2 size={13} className="shrink-0" aria-hidden="true" />
      Delete card
    </button>
  );
}

// Two-step inline confirm — replaces a native window.confirm (off-brand,
// blocks the render thread) with the same shape as the account-deletion
// confirm elsewhere in admin: an explicit second click, not a browser modal.
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
