"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, TextInput, FormMessage } from "@/components/ui/form";
import { TEXT_LIMITS } from "@/lib/game-rules";
import { grantXp, type FormState } from "@/app/admin/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      <Sparkles size={15} />
      {pending ? "Posting…" : "Grant XP"}
    </Button>
  );
}

// Posts a positive XP grant with a mandatory ledger description. Total XP and
// Currency XP both rise by the amount — XP only ever moves through this ledgered
// path (spends happen on the player's side via upgrade purchases).
export function XpForm({
  characterId,
  totalXp,
  currencyXp,
}: {
  characterId: string;
  totalXp: number;
  currencyXp: number;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(grantXp, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="characterId" value={characterId} />

      <div className="flex items-baseline justify-between border-b border-elevated-ledger pb-3">
        <span className="font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">
          Total XP
        </span>
        <span className="font-[family-name:var(--font-jetbrains)] text-xl text-signal-cyan">
          {totalXp.toLocaleString()}
        </span>
      </div>
      <div className="flex items-baseline justify-between">
        <span className="font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">
          Currency XP
        </span>
        <span className="font-[family-name:var(--font-jetbrains)] text-lg text-case-file-white">
          {currencyXp.toLocaleString()}
        </span>
      </div>

      <Field label="Amount" hint="Whole numbers only. Grants can't be reversed with a negative amount, post a reversing entry instead.">
        {(id) => (
          <TextInput
            id={id}
            name="amount"
            required
            inputMode="numeric"
            autoComplete="off"
            placeholder="25"
          />
        )}
      </Field>

      <Field label="Description">
        {(id) => (
          <TextInput
            id={id}
            name="description"
            required
            maxLength={TEXT_LIMITS.ledgerDescription}
            autoComplete="off"
            placeholder="Operation payout: Sublevel sweep"
          />
        )}
      </Field>

      <Field label="Reference" hint="Optional, op or requisition code.">
        {(id) => (
          <TextInput
            id={id}
            name="refCode"
            maxLength={TEXT_LIMITS.refCode}
            autoComplete="off"
            placeholder="OP-0142"
          />
        )}
      </Field>

      <FormMessage state={state} />
      <SubmitButton />
    </form>
  );
}
