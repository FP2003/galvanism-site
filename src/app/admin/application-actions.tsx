"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
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
      try {
        const result = await fn({}, fd);
        setError(result.error ?? null);
      } catch {
        setError("Couldn't reach the server. Check your connection and try again.");
      }
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
              variant="danger"
              disabled={pending}
              onClick={() => run(denyCharacter)}
            >
              <X size={15} />
              {pending ? "Removing…" : "Confirm deny"}
            </Button>
            <button
              type="button"
              onClick={() => setConfirmingDeny(false)}
              className="inline-flex items-center px-2 font-[family-name:var(--font-chakra)] text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-ink hover:text-case-file-white pointer-coarse:min-h-11"
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
      <FormMessage state={{ error: error ?? undefined }} />
    </div>
  );
}
