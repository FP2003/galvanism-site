"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormMessage } from "@/components/ui/form";
import { closeAllFacilities, type FormState } from "@/app/admin/facility-actions";

// Bulk close, confirmed via Dialog rather than the inline two-step pattern
// (facility-menu.tsx, close-ballot-form.tsx) — this affects every facility at
// once, so it gets the heavier confirm treatment.
export function CloseAllFacilitiesButton() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<FormState, FormData>(closeAllFacilities, {});

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Lock size={15} aria-hidden="true" /> Close All
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Close All Facilities">
        <form action={formAction} className="flex flex-col gap-4">
          <p className="text-pretty font-[family-name:var(--font-inter)] text-sm text-muted-ink">
            Every open facility will disappear from operators&rsquo; Facilities page.
            Each can be reopened individually afterward.
          </p>
          <FormMessage state={state} />
          <div className="flex gap-2">
            <ConfirmButton />
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" disabled={pending}>
      {pending ? "Closing…" : "Confirm close all"}
    </Button>
  );
}
