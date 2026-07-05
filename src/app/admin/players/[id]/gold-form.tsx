"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, TextInput, FormMessage } from "@/components/ui/form";
import { TEXT_LIMITS } from "@/lib/game-rules";
import { adjustGold, type FormState } from "@/app/admin/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      <Coins size={15} />
      {pending ? "Posting…" : "Post adjustment"}
    </Button>
  );
}

// Posts a signed gold delta with a mandatory ledger description. Positive credits
// (payouts), negative debits (purchases/fines). The running balance and history
// render on the page from the ledger table.
export function GoldForm({
  playerId,
  balance,
}: {
  playerId: string;
  balance: number;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(adjustGold, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="playerId" value={playerId} />

      <div className="flex items-baseline justify-between border-b border-elevated-ledger pb-3">
        <span className="font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">
          Current balance
        </span>
        <span className="font-[family-name:var(--font-jetbrains)] text-xl text-signal-cyan">
          {balance.toLocaleString()}
          <span className="ml-1 text-[0.625rem] uppercase text-muted-ink">Cr</span>
        </span>
      </div>

      <Field
        label="Amount"
        hint="Use a negative amount for a debit, e.g. -60."
      >
        {(id) => (
          <TextInput
            id={id}
            name="amount"
            required
            inputMode="numeric"
            autoComplete="off"
            placeholder="+400"
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
            placeholder="Operation payout — Sublevel sweep"
          />
        )}
      </Field>

      <Field label="Reference" hint="Optional — op or requisition code.">
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
