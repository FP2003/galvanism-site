"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { completeMission, type FormState } from "@/app/admin/mission-actions";
import { splitPayoutEvenly } from "@/lib/missions";

// Two-step confirm before posting a mission's payout — this moves credits to
// every assigned operator and can't be undone, same "hard to reverse, ask
// first" bar as the facility/mission delete confirms.
export function CompleteMissionForm({
  missionId,
  payoutCredits,
  payoutXp,
  assignedCount,
}: {
  missionId: string;
  payoutCredits: number;
  payoutXp: number;
  assignedCount: number;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(completeMission, {});
  const [confirming, setConfirming] = useState(false);

  if (assignedCount === 0) {
    return (
      <p className="font-[family-name:var(--font-inter)] text-sm text-muted-ink">
        Assign at least one operator before completing this mission.
      </p>
    );
  }

  const { perOperator: perOperatorCredits, remainder: remainderCredits } = splitPayoutEvenly(
    payoutCredits,
    assignedCount,
  );
  const { perOperator: perOperatorXp, remainder: remainderXp } = splitPayoutEvenly(payoutXp, assignedCount);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="missionId" value={missionId} />
      <p className="font-[family-name:var(--font-inter)] text-sm text-muted-ink">
        Splits {payoutCredits} Cr and {payoutXp} XP across {assignedCount} assigned operator
        {assignedCount === 1 ? "" : "s"}: {perOperatorCredits} Cr
        {remainderCredits > 0 ? ` (${remainderCredits} Cr remainder dropped)` : ""} and {perOperatorXp} XP
        {remainderXp > 0 ? ` (${remainderXp} XP remainder dropped)` : ""} each.
      </p>
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
          <CheckCircle2 size={15} />
          Complete mission
        </Button>
      )}
    </form>
  );
}

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" disabled={pending}>
      {pending ? "Posting…" : "Confirm payout"}
    </Button>
  );
}
