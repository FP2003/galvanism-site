"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, TextInput, FormMessage } from "@/components/ui/form";
import { TEXT_LIMITS } from "@/lib/game-rules";
import { createPlayerAccount, type CreatePlayerState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      <UserPlus size={15} />
      {pending ? "Provisioning…" : "Provision account"}
    </Button>
  );
}

export function CreatePlayerForm() {
  const [state, formAction] = useActionState<CreatePlayerState, FormData>(
    createPlayerAccount,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <Field label="Gaming alias">
        {(id) => (
          <TextInput
            id={id}
            name="name"
            type="text"
            maxLength={TEXT_LIMITS.name}
            autoComplete="off"
            placeholder="EpicGamerName"
          />
        )}
      </Field>

      <Field label="Email">
        {(id) => (
          <TextInput
            id={id}
            name="email"
            type="email"
            required
            autoComplete="off"
            placeholder="operator@foxtrot.fcb"
          />
        )}
      </Field>

      <Field
        label="Initial password"
        hint="Minimum 8 characters. The operator signs in with this and can reset it."
      >
        {(id) => (
          <TextInput
            id={id}
            name="password"
            type="text"
            required
            minLength={8}
            autoComplete="off"
            placeholder="Share with the operator; they can change it later"
          />
        )}
      </Field>

      <FormMessage
        state={{
          ok: state.ok,
          error: state.error,
          message: state.ok
            ? `Account provisioned for ${state.createdEmail}.`
            : undefined,
        }}
      />

      <SubmitButton />
    </form>
  );
}
