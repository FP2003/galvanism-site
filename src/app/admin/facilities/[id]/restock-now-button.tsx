"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { restockNow, type FormState } from "@/app/admin/facility-actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending} className="w-full">
      <RefreshCw size={15} className={pending ? "animate-spin" : ""} aria-hidden="true" />
      {pending ? "Restocking…" : "Restock now"}
    </Button>
  );
}

// Runs a weighted restock immediately (server action always resets the ops
// counter too, regardless of what the auto-trigger threshold is).
export function RestockNowButton({ facilityId }: { facilityId: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(restockNow, {});
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="facilityId" value={facilityId} />
      <SubmitButton />
      <FormMessage state={state} />
    </form>
  );
}
