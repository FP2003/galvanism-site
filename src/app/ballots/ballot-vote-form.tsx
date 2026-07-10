"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import type { BallotOption } from "@/lib/schema";
import { castVote, type FormState } from "./actions";

// Player vote control (Phase 7 Step 2). Three states for the viewer's own
// character on a ballot: no vote yet, voted for X (changeable), or closed
// (read-only) — mirrors missions/mission-interest-button.tsx's three-state
// shape, but single-choice-changeable rather than interest/assign.
export function BallotVoteForm({
  ballotId,
  options,
  currentOptionId,
  closed,
}: {
  ballotId: string;
  options: BallotOption[];
  currentOptionId: string | null;
  closed: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(castVote, {});
  const [selected, setSelected] = useState<string | null>(currentOptionId);

  if (closed) {
    return (
      <p className="font-[family-name:var(--font-inter)] text-sm text-muted-ink">
        This ballot is closed. Voting has ended.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="ballotId" value={ballotId} />
      <input type="hidden" name="optionId" value={selected ?? ""} />
      <div role="radiogroup" aria-label="Ballot options" className="flex flex-col gap-2">
        {options.map((option) => {
          const isSelected = selected === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setSelected(option.id)}
              className={`flex items-center justify-between gap-2 border px-3 py-2.5 text-left font-[family-name:var(--font-inter)] text-sm transition-colors pointer-coarse:min-h-11 ${
                isSelected
                  ? "border-signal-cyan bg-signal-cyan/10 text-case-file-white"
                  : "border-elevated-ledger text-muted-ink hover:border-steel-blue hover:text-case-file-white"
              }`}
            >
              <span className="min-w-0 truncate">{option.label}</span>
              {isSelected && <Check size={15} className="shrink-0 text-signal-cyan" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <FormMessage state={state} />
      <SubmitButton disabled={!selected || selected === currentOptionId} hasVoted={currentOptionId != null} />
    </form>
  );
}

function SubmitButton({ disabled, hasVoted }: { disabled: boolean; hasVoted: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending} className="w-full sm:w-auto">
      {pending ? "Saving…" : hasVoted ? "Change vote" : "Cast vote"}
    </Button>
  );
}
