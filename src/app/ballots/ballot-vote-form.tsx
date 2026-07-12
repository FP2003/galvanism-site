"use client";

import { useActionState, useRef, useState } from "react";
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
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function moveTo(index: number) {
    const next = options[index];
    if (!next) return;
    setSelected(next.id);
    optionRefs.current[index]?.focus();
  }

  function onOptionKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (e.key) {
      case "ArrowDown":
      case "ArrowRight":
        e.preventDefault();
        moveTo((index + 1) % options.length);
        break;
      case "ArrowUp":
      case "ArrowLeft":
        e.preventDefault();
        moveTo((index - 1 + options.length) % options.length);
        break;
      case "Home":
        e.preventDefault();
        moveTo(0);
        break;
      case "End":
        e.preventDefault();
        moveTo(options.length - 1);
        break;
    }
  }

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
        {options.map((option, index) => {
          const isSelected = selected === option.id;
          const isTabbable = selected == null ? index === 0 : isSelected;
          return (
            <button
              key={option.id}
              ref={(el) => {
                optionRefs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={isTabbable ? 0 : -1}
              onClick={() => setSelected(option.id)}
              onKeyDown={(e) => onOptionKeyDown(e, index)}
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
