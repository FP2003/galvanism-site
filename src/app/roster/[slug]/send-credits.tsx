"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, TextInput, Select, FormMessage } from "@/components/ui/form";
import { sendCredits, type SheetState } from "@/app/roster/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      <Send size={15} />
      {pending ? "Sending…" : "Send credits"}
    </Button>
  );
}

// Player self-service P2P transfer on the Case File: pick another operator on
// the roster and send them a slice of your own credit balance. Server-side
// (app/roster/actions.ts sendCredits) debits and credits atomically and posts
// a ledger row on both sides — the balance shown here re-baselines from the
// page's props on a successful send (revalidatePath re-renders the server
// component), same convention as the other Case File self-service forms.
export function SendCredits({
  characterId,
  balance,
  recipients,
}: {
  characterId: string;
  balance: number;
  recipients: { id: string; callsign: string }[];
}) {
  const [state, formAction] = useActionState<SheetState, FormData>(sendCredits, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  if (recipients.length === 0) {
    return (
      <p className="text-sm text-muted-ink">
        No other operators on the roster yet to send credits to.
      </p>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="fromCharacterId" value={characterId} />

      <div className="flex items-baseline justify-between border-b border-elevated-ledger pb-3">
        <span className="font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">
          Your balance
        </span>
        <span className="font-[family-name:var(--font-jetbrains)] text-xl text-signal-cyan">
          {balance.toLocaleString()}
          <span className="ml-1 text-[0.625rem] uppercase text-muted-ink">Cr</span>
        </span>
      </div>

      <Field label="Recipient">
        {(id) => (
          <Select id={id} name="toCharacterId" required defaultValue="">
            <option value="" disabled>
              Select an operator…
            </option>
            {recipients.map((r) => (
              <option key={r.id} value={r.id}>
                {r.callsign}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field label="Amount">
        {(id) => (
          <TextInput
            id={id}
            name="amount"
            required
            inputMode="numeric"
            autoComplete="off"
            placeholder="100"
          />
        )}
      </Field>

      <FormMessage state={state} />
      <SubmitButton />
    </form>
  );
}
