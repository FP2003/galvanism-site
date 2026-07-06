"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, TextInput, FormMessage } from "@/components/ui/form";
import { TEXT_LIMITS } from "@/lib/game-rules";
import { postMissionPayout, type FormState } from "@/app/admin/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      <Award size={15} />
      {pending ? "Posting…" : "Post payout"}
    </Button>
  );
}

// Posts a credits delta and an XP grant together under one shared description —
// the common case at the end of a mission, so the DM doesn't have to open the
// Credit and XP dialogs separately for the same reward. Either amount can be
// left blank to post a single-ledger entry instead.
export function MissionPayoutForm({
  playerId,
  characterId,
  balance,
  totalXp,
  currencyXp,
}: {
  playerId: string;
  characterId: string | null;
  balance: number;
  totalXp: number | null;
  currencyXp: number | null;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    postMissionPayout,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="playerId" value={playerId} />
      {characterId && <input type="hidden" name="characterId" value={characterId} />}

      <div className="flex items-baseline justify-between border-b border-elevated-ledger pb-3">
        <span className="font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">
          Current balance
        </span>
        <span className="font-[family-name:var(--font-jetbrains)] text-xl text-signal-cyan">
          {balance.toLocaleString()}
          <span className="ml-1 text-[0.625rem] uppercase text-muted-ink">Cr</span>
        </span>
      </div>
      {characterId && (
        <div className="flex items-baseline justify-between">
          <span className="font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">
            Total / Currency XP
          </span>
          <span className="font-[family-name:var(--font-jetbrains)] text-lg text-case-file-white">
            {totalXp?.toLocaleString()} / {currencyXp?.toLocaleString()}
          </span>
        </div>
      )}

      <Field label="Credits" hint="Optional — negative for a debit. Leave blank to skip.">
        {(id) => (
          <TextInput
            id={id}
            name="credits"
            inputMode="numeric"
            autoComplete="off"
            placeholder="+400"
          />
        )}
      </Field>

      <Field
        label="XP"
        hint={
          characterId
            ? "Optional — whole numbers only, always a grant. Leave blank to skip."
            : "This operator has no character yet, so XP can't be granted."
        }
      >
        {(id) => (
          <TextInput
            id={id}
            name="xp"
            inputMode="numeric"
            autoComplete="off"
            placeholder="25"
            disabled={!characterId}
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
