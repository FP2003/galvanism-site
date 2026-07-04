"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPlayerAccount, type CreatePlayerState } from "./actions";

const labelClass =
  "font-[family-name:var(--font-chakra)] text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted-ink";
const inputClass =
  "w-full border border-elevated-ledger bg-void-navy px-3 py-2.5 font-[family-name:var(--font-inter)] text-sm text-case-file-white placeholder:text-muted-ink/60 outline-none focus:border-signal-cyan";

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
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className={labelClass}>
          Gaming alias
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="off"
          placeholder="EpicGamerName"
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className={labelClass}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="off"
          placeholder="operator@foxtrot.fcb"
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className={labelClass}>
          Initial password
        </label>
        <input
          id="password"
          name="password"
          type="text"
          required
          minLength={8}
          autoComplete="off"
          placeholder="Share with the operator; they can change it later"
          className={inputClass}
        />
        <p className="font-[family-name:var(--font-inter)] text-[0.6875rem] text-muted-ink">
          Minimum 8 characters. The operator signs in with this and can reset it.
        </p>
      </div>

      {state.error && (
        <p
          role="alert"
          className="border-l-2 border-stamp-red bg-stamp-red/10 px-3 py-2 font-[family-name:var(--font-inter)] text-[0.8125rem] text-stamp-red"
        >
          {state.error}
        </p>
      )}
      {state.ok && (
        <p
          role="status"
          className="border-l-2 border-signal-cyan bg-signal-cyan/10 px-3 py-2 font-[family-name:var(--font-inter)] text-[0.8125rem] text-signal-cyan"
        >
          Account provisioned for {state.createdEmail}.
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
