"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { closeBallot, type FormState } from "@/app/admin/ballot-actions";

// Two-step confirm before closing a ballot — closing locks the tally for
// good (no re-opening), same "hard to reverse, ask first" bar as the
// mission/facility delete confirms.
export function CloseBallotForm({ ballotId }: { ballotId: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(closeBallot, {});
  const [confirming, setConfirming] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="ballotId" value={ballotId} />
      <FormMessage state={state} />
      {confirming ? (
        <div className="flex gap-2">
          <ConfirmButton />
          <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button type="button" onClick={() => setConfirming(true)} className="w-full sm:w-auto">
          <Lock size={15} />
          Close ballot
        </Button>
      )}
    </form>
  );
}

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" disabled={pending}>
      {pending ? "Closing…" : "Confirm close"}
    </Button>
  );
}
