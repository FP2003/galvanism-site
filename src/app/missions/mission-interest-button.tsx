"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { StatusLabel } from "@/components/ui/status-dot";
import { markInterested, withdrawInterest, type FormState } from "./actions";

/*
 * Player-side interest control (Phase 5). Three states for the viewer's own
 * character on a given mission: no relationship yet, self-expressed interest
 * (withdrawable), or a DM-confirmed assignment (final, no player action).
 */
export function MissionInterestButton({
  missionId,
  assignmentId,
  state,
}: {
  missionId: string;
  assignmentId: string | null;
  state: "none" | "interested" | "assigned";
}) {
  const [interestedState, interestedAction] = useActionState<FormState, FormData>(markInterested, {});
  const [withdrawState, withdrawAction] = useActionState<FormState, FormData>(withdrawInterest, {});

  if (state === "assigned") {
    return <StatusLabel tone="live">Assigned</StatusLabel>;
  }

  if (state === "interested" && assignmentId) {
    return (
      <form action={withdrawAction}>
        <input type="hidden" name="assignmentId" value={assignmentId} />
        <SubmitButton variant="secondary" pendingLabel="Withdrawing…" label="Withdraw" />
        {withdrawState.error && (
          <div className="mt-1.5">
            <FormMessage state={withdrawState} />
          </div>
        )}
      </form>
    );
  }

  return (
    <form action={interestedAction}>
      <input type="hidden" name="missionId" value={missionId} />
      <SubmitButton pendingLabel="Marking…" label="Mark interested" />
      {interestedState.error && (
        <div className="mt-1.5">
          <FormMessage state={interestedState} />
        </div>
      )}
    </form>
  );
}

function SubmitButton({
  label,
  pendingLabel,
  variant,
}: {
  label: string;
  pendingLabel: string;
  variant?: "primary" | "secondary";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending} className="shrink-0">
      {pending ? pendingLabel : label}
    </Button>
  );
}
