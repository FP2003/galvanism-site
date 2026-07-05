"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Minus, Plus, Send, Shield, Zap, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, TextInput, Textarea, FormMessage } from "@/components/ui/form";
import {
  POINT_BUY_ATTRIBUTES,
  ATTRIBUTE_BUDGET,
  BASE_HP,
  BASE_ENERGY,
  BASE_ENERGY_REGEN,
  IMMUNITY_BASE,
  TEXT_LIMITS,
} from "@/lib/game-rules";
import { submitApplication, type ApplicationState } from "./actions";

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} className="w-full sm:w-auto">
      <Send size={15} />
      {pending ? "Submitting…" : "Submit for approval"}
    </Button>
  );
}

// Level-1 character application. The player picks identity + backstory and spends
// exactly ATTRIBUTE_BUDGET points across the five point-buy attributes; base
// resources and Immunity are fixed. The server re-validates on submit.
export function ApplicationForm() {
  const [state, formAction] = useActionState<ApplicationState, FormData>(
    submitApplication,
    {},
  );

  const [points, setPoints] = useState<Record<string, number>>(
    Object.fromEntries(POINT_BUY_ATTRIBUTES.map((a) => [a.key, 0])),
  );

  const spent = Object.values(points).reduce((s, v) => s + v, 0);
  const remaining = ATTRIBUTE_BUDGET - spent;

  const adjust = (key: string, delta: number) =>
    setPoints((p) => {
      const next = Math.max(0, (p[key] ?? 0) + delta);
      // Don't allow spending past the budget.
      if (delta > 0 && spent >= ATTRIBUTE_BUDGET) return p;
      return { ...p, [key]: next };
    });

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {POINT_BUY_ATTRIBUTES.map((a) => (
        <input key={a.key} type="hidden" name={a.key} value={points[a.key]} />
      ))}

      <section className="flex flex-col gap-4">
        <h2 className="font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-signal-cyan">
          Identity
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Callsign" hint="Your operational codename (e.g. HALYARD).">
            {(id) => (
              <TextInput
                id={id}
                name="callsign"
                required
                maxLength={TEXT_LIMITS.callsign}
                autoComplete="off"
                placeholder="HALYARD"
              />
            )}
          </Field>
          <Field label="Operator name" hint="Your character's name.">
            {(id) => (
              <TextInput
                id={id}
                name="name"
                required
                maxLength={TEXT_LIMITS.name}
                autoComplete="off"
                placeholder="M. Okonkwo"
              />
            )}
          </Field>
        </div>
        <Field label="Backstory">
          {(id) => (
            <Textarea
              id={id}
              name="bio"
              rows={6}
              maxLength={TEXT_LIMITS.bio}
              placeholder="Where your operator came from, how they ended up in Regiment Foxtrot…"
            />
          )}
        </Field>
      </section>

      {/* Fixed starting kit */}
      <section className="flex flex-col gap-3">
        <h2 className="font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-signal-cyan">
          Standard Issue
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <IssueStat icon={<Shield size={14} aria-hidden="true" />} label="Health" value={`${BASE_HP}`} />
          <IssueStat icon={<Zap size={14} aria-hidden="true" />} label="Energy" value={`${BASE_ENERGY}`} />
          <IssueStat icon={<Activity size={14} aria-hidden="true" />} label="Regen" value={`+${BASE_ENERGY_REGEN}`} />
          <IssueStat icon={<Shield size={14} aria-hidden="true" />} label="Immunity" value={`${IMMUNITY_BASE}%`} />
        </div>
        <p className="font-[family-name:var(--font-inter)] text-[0.6875rem] text-muted-ink">
          Fixed for every level-1 operator. Rank, role, and weapon loadout are
          assigned by the DM.
        </p>
      </section>

      {/* Point-buy */}
      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-signal-cyan">
            Attributes
          </h2>
          <span
            className={`font-[family-name:var(--font-jetbrains)] text-sm ${
              remaining === 0 ? "text-signal-cyan" : "text-case-file-white"
            }`}
          >
            {remaining} <span className="text-muted-ink">/ {ATTRIBUTE_BUDGET} points left</span>
          </span>
        </div>

        <div className="flex flex-col gap-3">
          {POINT_BUY_ATTRIBUTES.map((a) => (
            <div
              key={a.key}
              className="flex items-center justify-between gap-3 border border-elevated-ledger px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-[family-name:var(--font-chakra)] text-sm font-semibold uppercase tracking-[0.04em] text-case-file-white">
                  {a.label}
                </p>
                <p className="truncate text-xs text-muted-ink">{a.note}</p>
              </div>
              <div className="flex items-center gap-2">
                <Stepper
                  label={`Decrease ${a.label}`}
                  onClick={() => adjust(a.key, -1)}
                  disabled={points[a.key] === 0}
                >
                  <Minus size={14} aria-hidden="true" />
                </Stepper>
                <span className="w-8 text-center font-[family-name:var(--font-jetbrains)] text-lg text-signal-cyan">
                  {points[a.key]}
                </span>
                <Stepper
                  label={`Increase ${a.label}`}
                  onClick={() => adjust(a.key, 1)}
                  disabled={remaining === 0}
                >
                  <Plus size={14} aria-hidden="true" />
                </Stepper>
              </div>
            </div>
          ))}
        </div>
      </section>

      <FormMessage state={state} />
      <div>
        <SubmitButton disabled={remaining !== 0} />
        {remaining !== 0 && (
          <p className="mt-2 font-[family-name:var(--font-inter)] text-[0.6875rem] text-muted-ink">
            Allocate all {ATTRIBUTE_BUDGET} points to submit.
          </p>
        )}
      </div>
    </form>
  );
}

function IssueStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="border border-elevated-ledger px-3 py-2.5">
      <span className="flex items-center gap-1.5 font-[family-name:var(--font-chakra)] text-[0.5625rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">
        <span className="text-steel-blue">{icon}</span>
        {label}
      </span>
      <span className="mt-0.5 block font-[family-name:var(--font-jetbrains)] text-lg text-case-file-white">
        {value}
      </span>
    </div>
  );
}

function Stepper({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex size-8 shrink-0 items-center justify-center border border-steel-blue text-signal-cyan transition-colors hover:bg-elevated-ledger hover:text-live-cyan disabled:cursor-not-allowed disabled:border-elevated-ledger disabled:text-steel-blue/40 pointer-coarse:size-11"
    >
      {children}
    </button>
  );
}
