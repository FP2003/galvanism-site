"use client";

import { useState, useTransition } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deletePlayerAccount, type FormState } from "@/app/admin/actions";

// Destructive: permanently removes the player's account, character, and ledger.
// Requires an explicit confirm click before firing.
export function DeleteAccount({
  playerId,
  label,
}: {
  playerId: string;
  label: string;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function remove() {
    const fd = new FormData();
    fd.set("playerId", playerId);
    startTransition(async () => {
      // On success the action redirects; only errors return here.
      const result: FormState = await deletePlayerAccount({}, fd);
      setError(result?.error ?? null);
    });
  }

  return (
    <div className="flex flex-col gap-3 border border-stamp-red/40 bg-stamp-red/5 p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle
          size={16}
          className="mt-0.5 shrink-0 text-stamp-red"
          aria-hidden="true"
        />
        <div>
          <p className="font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-case-file-white">
            Remove account
          </p>
          <p className="mt-1 font-[family-name:var(--font-inter)] text-[0.8125rem] text-muted-ink">
            Permanently deletes {label}&apos;s sign-in, character sheet, and gold
            ledger. This cannot be undone.
          </p>
        </div>
      </div>

      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={remove}
            className="border-stamp-red text-stamp-red hover:text-stamp-red"
          >
            <Trash2 size={15} />
            {pending ? "Removing…" : "Confirm removal"}
          </Button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="font-[family-name:var(--font-chakra)] text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-ink hover:text-case-file-white"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setConfirming(true)}
            className="border-stamp-red text-stamp-red hover:text-stamp-red"
          >
            <Trash2 size={15} />
            Remove account
          </Button>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="border-l-2 border-stamp-red bg-stamp-red/10 px-3 py-2 font-[family-name:var(--font-inter)] text-[0.8125rem] text-stamp-red"
        >
          {error}
        </p>
      )}
    </div>
  );
}
