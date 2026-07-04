"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { approveCharacter, denyCharacter, type FormState } from "./actions";

// Approve / deny controls for a pending application. Deny is destructive (it
// deletes the sheet), so it asks for a second click to confirm.
export function ApplicationActions({ characterId }: { characterId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingDeny, setConfirmingDeny] = useState(false);

  function run(fn: (p: FormState, f: FormData) => Promise<FormState>) {
    const fd = new FormData();
    fd.set("characterId", characterId);
    startTransition(async () => {
      const result = await fn({}, fd);
      setError(result.error ?? null);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          disabled={pending}
          onClick={() => run(approveCharacter)}
        >
          <Check size={15} />
          Approve
        </Button>
        {confirmingDeny ? (
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => run(denyCharacter)}
              className="border-stamp-red text-stamp-red hover:text-stamp-red"
            >
              <X size={15} />
              {pending ? "Removing…" : "Confirm deny"}
            </Button>
            <button
              type="button"
              onClick={() => setConfirmingDeny(false)}
              className="font-[family-name:var(--font-chakra)] text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-ink hover:text-case-file-white"
            >
              Cancel
            </button>
          </>
        ) : (
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => setConfirmingDeny(true)}
          >
            <X size={15} />
            Deny
          </Button>
        )}
      </div>
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
