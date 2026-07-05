"use client";

import { useState, useTransition } from "react";
import { Shield, Zap, Crosshair, Minus, Plus, Check } from "lucide-react";
import { Meter } from "@/components/ui/meter";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { clampResource } from "@/lib/ledger";
import { updateResources, type SheetState } from "@/app/roster/actions";

type Resource = { current: number; max: number };

/*
 * Owner/admin resource tracking on the Case File (Phase 2). Steppers + direct
 * entry adjust current HP/Energy/Ammo; maxes are DM-set and shown read-only. All
 * three post together; the server clamps to [0, max] as the source of truth, and
 * the local values re-baseline on a successful save.
 */
export function ResourceTracker({
  characterId,
  hp,
  energy,
  ammo,
}: {
  characterId: string;
  hp: Resource;
  energy: Resource;
  ammo: Resource;
}) {
  const [state, setState] = useState<SheetState>({});
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState({
    hpCurrent: hp.current,
    energyCurrent: energy.current,
    ammoCurrent: ammo.current,
  });

  function action(formData: FormData) {
    startTransition(async () => {
      try {
        const result = await updateResources({}, formData);
        setState(result);
        if (result.ok) {
          setValues((v) => ({
            hpCurrent: clampResource(v.hpCurrent, hp.max),
            energyCurrent: clampResource(v.energyCurrent, energy.max),
            ammoCurrent: clampResource(v.ammoCurrent, ammo.max),
          }));
        }
      } catch {
        setState({
          error: "Couldn't reach the server. Check your connection and try again.",
        });
      }
    });
  }

  const dirty =
    values.hpCurrent !== hp.current ||
    values.energyCurrent !== energy.current ||
    values.ammoCurrent !== ammo.current;

  const set = (key: keyof typeof values, next: number, max: number) =>
    setValues((v) => ({ ...v, [key]: clampResource(next, max) }));

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="characterId" value={characterId} />
      <input type="hidden" name="hpCurrent" value={values.hpCurrent} />
      <input type="hidden" name="energyCurrent" value={values.energyCurrent} />
      <input type="hidden" name="ammoCurrent" value={values.ammoCurrent} />

      <Row
        icon={<Shield size={14} aria-hidden="true" />}
        label="Health"
        value={values.hpCurrent}
        max={hp.max}
        tone={hp.max > 0 && values.hpCurrent / hp.max <= 0.33 ? "critical" : "live"}
        onChange={(n) => set("hpCurrent", n, hp.max)}
      />
      <Row
        icon={<Zap size={14} aria-hidden="true" />}
        label="Energy"
        value={values.energyCurrent}
        max={energy.max}
        tone="steel"
        onChange={(n) => set("energyCurrent", n, energy.max)}
      />
      <Row
        icon={<Crosshair size={14} aria-hidden="true" />}
        label="Ammo"
        value={values.ammoCurrent}
        max={ammo.max}
        tone="steel"
        onChange={(n) => set("ammoCurrent", n, ammo.max)}
      />

      <FormMessage state={state} />
      <Button
        type="submit"
        variant="secondary"
        disabled={pending || !dirty}
        className="w-full"
      >
        <Check size={15} />
        {pending ? "Saving…" : dirty ? "Save resources" : "Saved"}
      </Button>
    </form>
  );
}

function Row({
  icon,
  label,
  value,
  max,
  tone,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  max: number;
  tone: "live" | "critical" | "steel";
  onChange: (next: number) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink">
          <span className="text-steel-blue">{icon}</span>
          {label}
        </span>
        <span className="font-[family-name:var(--font-jetbrains)] text-sm text-case-file-white">
          {value}
          <span className="text-muted-ink">/{max}</span>
        </span>
      </div>
      <Meter value={value} max={max} tone={tone} label={`${label} ${value}/${max}`} />
      <div className="mt-2 flex items-center gap-2">
        <Stepper label={`Decrease ${label}`} onClick={() => onChange(value - 1)}>
          <Minus size={14} aria-hidden="true" />
        </Stepper>
        <input
          type="number"
          min={0}
          max={max}
          inputMode="numeric"
          aria-label={`${label} current`}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full border border-elevated-ledger bg-void-navy px-2 py-1.5 text-center font-[family-name:var(--font-jetbrains)] text-sm text-case-file-white outline-none focus:border-signal-cyan pointer-coarse:py-3"
        />
        <Stepper label={`Increase ${label}`} onClick={() => onChange(value + 1)}>
          <Plus size={14} aria-hidden="true" />
        </Stepper>
      </div>
    </div>
  );
}

function Stepper({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-8 shrink-0 items-center justify-center border border-steel-blue text-signal-cyan transition-colors hover:bg-elevated-ledger hover:text-live-cyan pointer-coarse:size-11"
    >
      {children}
    </button>
  );
}
