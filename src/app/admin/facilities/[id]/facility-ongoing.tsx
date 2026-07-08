"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, RotateCcw, Check, X } from "lucide-react";
import { TextInput, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import {
  addOngoingEntry,
  deleteOngoingEntry,
  setOngoingResolved,
  type FormState,
} from "@/app/admin/facility-ongoing-actions";
import type { FacilityOngoingEntry } from "@/lib/schema";

// Admin "Ongoing" status board for one facility (Phase 6 Step 4) — a free-
// text label the DM posts and later resolves by hand, no automatic timer.
// Resolving toggles `resolved` (keeps history); delete is a separate escape
// hatch for a typo'd entry. Resolved entries stay visible here (grayed out)
// for a manual undo, unlike the player-facing panel which only shows active
// ones.
export function FacilityOngoing({
  facilityId,
  entries,
}: {
  facilityId: string;
  entries: FacilityOngoingEntry[];
}) {
  const [addState, addAction] = useActionState<FormState, FormData>(addOngoingEntry, {});

  return (
    <div className="flex flex-col gap-4">
      <p className="font-[family-name:var(--font-inter)] text-xs text-muted-ink">
        Free-text status line, e.g. &ldquo;Ammo Resupply: 2 days&rdquo; — no
        automatic countdown, resolve it by hand when it&apos;s done.
      </p>
      {entries.length === 0 ? (
        <p className="font-[family-name:var(--font-inter)] text-xs text-muted-ink">
          No ongoing entries yet.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-elevated-ledger border-y border-elevated-ledger">
          {entries.map((e) => (
            <EntryRow key={e.id} entry={e} />
          ))}
        </ul>
      )}

      <form action={addAction} className="flex flex-col gap-2 sm:flex-row">
        <input type="hidden" name="facilityId" value={facilityId} />
        <TextInput
          name="label"
          aria-label="Label"
          placeholder="Label (e.g. Ammo Resupply: 2 days)"
          maxLength={120}
          required
          className="flex-1"
        />
        <AddEntryButton />
      </form>
      <FormMessage state={addState} />
    </div>
  );
}

function AddEntryButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending} className="shrink-0">
      <Plus size={15} />
      {pending ? "Posting…" : "Post"}
    </Button>
  );
}

function EntryRow({ entry }: { entry: FacilityOngoingEntry }) {
  const [, toggleAction] = useActionState<FormState, FormData>(setOngoingResolved, {});
  const [, deleteAction] = useActionState<FormState, FormData>(deleteOngoingEntry, {});

  return (
    <li className="flex items-center gap-3 py-3">
      <span
        className={`size-2.5 shrink-0 ${entry.resolved ? "bg-elevated-ledger" : "bg-steel-blue"}`}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p
          className={`truncate font-[family-name:var(--font-inter)] text-sm ${
            entry.resolved ? "text-muted-ink line-through" : "text-case-file-white"
          }`}
        >
          {entry.label}
        </p>
      </div>
      <form action={toggleAction}>
        <input type="hidden" name="entryId" value={entry.id} />
        <input type="hidden" name="resolved" value={(!entry.resolved).toString()} />
        <ToggleResolvedButton
          resolved={entry.resolved}
          label={`${entry.resolved ? "Reopen" : "Resolve"} ${entry.label}`}
        />
      </form>
      <form action={deleteAction}>
        <input type="hidden" name="entryId" value={entry.id} />
        <RemoveEntryButton label={`Remove ${entry.label}`} />
      </form>
    </li>
  );
}

function ToggleResolvedButton({ resolved, label }: { resolved: boolean; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      aria-label={label}
      disabled={pending}
      className="flex size-8 shrink-0 items-center justify-center border border-elevated-ledger text-muted-ink transition-colors hover:border-signal-cyan hover:text-signal-cyan disabled:opacity-60 pointer-coarse:size-11"
    >
      {resolved ? <RotateCcw size={14} aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
    </button>
  );
}

function RemoveEntryButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      aria-label={label}
      disabled={pending}
      className="flex size-8 shrink-0 items-center justify-center border border-elevated-ledger text-muted-ink transition-colors hover:border-stamp-red hover:text-stamp-red disabled:opacity-60 pointer-coarse:size-11"
    >
      <X size={14} aria-hidden="true" />
    </button>
  );
}
