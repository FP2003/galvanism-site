"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, TextInput, FormMessage } from "@/components/ui/form";
import { updatePlayer, type FormState } from "@/app/admin/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      <Save size={15} />
      {pending ? "Saving…" : "Save"}
    </Button>
  );
}

// Edits player-account fields (gaming alias). Email is Clerk-owned; gold is
// handled by the ledger form so every balance change is audited.
export function PlayerForm({
  playerId,
  name,
  email,
}: {
  playerId: string;
  name: string;
  email: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    updatePlayer,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="playerId" value={playerId} />

      <Field label="Sign-in email" hint="Managed in Clerk; read-only here.">
        {(id) => (
          <TextInput id={id} value={email} disabled readOnly />
        )}
      </Field>

      <Field label="Gaming alias">
        {(id) => (
          <TextInput
            id={id}
            name="name"
            autoComplete="off"
            placeholder="EpicGamerName"
            defaultValue={name}
          />
        )}
      </Field>

      <FormMessage state={state} />
      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
