"use client";

import { useState, useTransition } from "react";
import { Shield, ShieldPlus, Zap, Crosshair, Activity, Footprints, Minus, Plus, Check, X } from "lucide-react";
import { Meter } from "@/components/ui/meter";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { clampMovementSpend, clampResource, clampTempHp, movementMeters } from "@/lib/ledger";
import { updateResources, type SheetState } from "@/app/roster/actions";

type Resource = { current: number; max: number };

// Energy regen has no max — it's a flat rate, not a fillable pool — so it's
// only floored at 0, never clamped to a ceiling like the other resources.
const clampRegen = (n: number) => Math.max(0, Math.floor(n));

/*
 * Owner/admin resource tracking on the Case File (Phase 2). Steppers + direct
 * entry adjust current HP/Energy/Ammo (maxes are DM-set and shown read-only)
 * plus the flat Energy Regen rate. All four post together; the server clamps
 * to [0, max] (or just floors at 0 for regen) as the source of truth, and the
 * local values re-baseline on a successful save.
 */
export function ResourceTracker({
  characterId,
  hp,
  hpTemp,
  energy,
  ammo,
  energyRegen,
  movementBase,
  movementEpSpent,
}: {
  characterId: string;
  hp: Resource;
  hpTemp: number;
  energy: Resource;
  ammo: Resource;
  energyRegen: number;
  movementBase: number;
  movementEpSpent: number;
}) {
  const [state, setState] = useState<SheetState>({});
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState({
    hpCurrent: hp.current,
    hpTemp,
    energyCurrent: energy.current,
    ammoCurrent: ammo.current,
    energyRegen,
    movementEpSpent,
  });

  function action(formData: FormData) {
    startTransition(async () => {
      try {
        const result = await updateResources({}, formData);
        setState(result);
        if (result.ok) {
          setValues((v) => {
            const nextEnergyCurrent = clampResource(v.energyCurrent, energy.max);
            return {
              hpCurrent: clampResource(v.hpCurrent, hp.max),
              hpTemp: clampTempHp(v.hpTemp),
              energyCurrent: nextEnergyCurrent,
              ammoCurrent: clampResource(v.ammoCurrent, ammo.max),
              energyRegen: clampRegen(v.energyRegen),
              movementEpSpent: clampMovementSpend(v.movementEpSpent, nextEnergyCurrent, energy.max),
            };
          });
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
    values.hpTemp !== hpTemp ||
    values.energyCurrent !== energy.current ||
    values.ammoCurrent !== ammo.current ||
    values.energyRegen !== energyRegen ||
    values.movementEpSpent !== movementEpSpent;

  const set = (key: "hpCurrent" | "energyCurrent" | "ammoCurrent", next: number, max: number) =>
    setValues((v) => ({ ...v, [key]: clampResource(next, max) }));

  // Spending/refunding movement draws 1 EP from — or returns 1 EP to —
  // Energy Current in the same update, so the two rows never drift apart
  // (lib/ledger.ts movementMeters/clampMovementSpend are the source of truth
  // the server re-validates against on save).
  const adjustMovement = (epDelta: 1 | -1) =>
    setValues((v) => {
      const nextEnergyCurrent = clampResource(v.energyCurrent - epDelta, energy.max);
      const spentEnergyDelta = v.energyCurrent - nextEnergyCurrent;
      return {
        ...v,
        energyCurrent: nextEnergyCurrent,
        movementEpSpent: Math.max(0, v.movementEpSpent + spentEnergyDelta),
      };
    });

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="characterId" value={characterId} />
      <input type="hidden" name="hpCurrent" value={values.hpCurrent} />
      <input type="hidden" name="hpTemp" value={values.hpTemp} />
      <input type="hidden" name="energyCurrent" value={values.energyCurrent} />
      <input type="hidden" name="ammoCurrent" value={values.ammoCurrent} />
      <input type="hidden" name="energyRegen" value={values.energyRegen} />
      <input type="hidden" name="movementEpSpent" value={values.movementEpSpent} />

      <Row
        icon={<Shield size={14} aria-hidden="true" />}
        label="Health"
        value={values.hpCurrent}
        max={hp.max}
        tone={hp.max > 0 && values.hpCurrent / hp.max <= 0.33 ? "critical" : "live"}
        onChange={(n) => set("hpCurrent", n, hp.max)}
      />
      <TempHpRow
        value={values.hpTemp}
        onChange={(n) => setValues((v) => ({ ...v, hpTemp: clampTempHp(n) }))}
      />
      <Row
        icon={<Zap size={14} aria-hidden="true" />}
        label="Energy"
        value={values.energyCurrent}
        max={energy.max}
        tone="steel"
        onChange={(n) => set("energyCurrent", n, energy.max)}
      />
      <MovementRow
        base={movementBase}
        epSpent={values.movementEpSpent}
        energyCurrent={values.energyCurrent}
        onIncrease={() => adjustMovement(1)}
        onDecrease={() => adjustMovement(-1)}
      />
      <Row
        icon={<Crosshair size={14} aria-hidden="true" />}
        label="Ammo"
        value={values.ammoCurrent}
        max={ammo.max}
        tone="steel"
        onChange={(n) => set("ammoCurrent", n, ammo.max)}
      />
      <RateRow
        icon={<Activity size={14} aria-hidden="true" />}
        label="Energy Regen"
        value={values.energyRegen}
        onChange={(n) =>
          setValues((v) => ({ ...v, energyRegen: clampRegen(n) }))
        }
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
          <span className="text-muted-ink">{icon}</span>
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

// Temporary HP: a freeform buffer with no ceiling, unlike Health's Row (no
// Meter — there's no max to show progress against). A one-tap Clear zeroes it
// out, the usual way a table wipes temp HP once it's been used up.
function TempHpRow({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink">
          <span className="text-muted-ink">
            <ShieldPlus size={14} aria-hidden="true" />
          </span>
          Temp HP
        </span>
        <span className="font-[family-name:var(--font-jetbrains)] text-sm text-case-file-white">
          {value}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Stepper label="Decrease Temp HP" onClick={() => onChange(value - 1)}>
          <Minus size={14} aria-hidden="true" />
        </Stepper>
        <input
          type="number"
          min={0}
          inputMode="numeric"
          aria-label="Temp HP current"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full border border-elevated-ledger bg-void-navy px-2 py-1.5 text-center font-[family-name:var(--font-jetbrains)] text-sm text-case-file-white outline-none focus:border-signal-cyan pointer-coarse:py-3"
        />
        <Stepper label="Increase Temp HP" onClick={() => onChange(value + 1)}>
          <Plus size={14} aria-hidden="true" />
        </Stepper>
        <Stepper label="Clear Temp HP" onClick={() => onChange(0)}>
          <X size={14} aria-hidden="true" />
        </Stepper>
      </div>
    </div>
  );
}

// Movement has no direct numeric entry — its value is derived from EP spent
// (lib/ledger.ts movementMeters), so the only way to change it is the
// steppers, which trade 1 EP for METERS_PER_EP of movement via the shared
// adjustMovement handler above. `max` is the ceiling if all remaining Energy
// were committed, so it shrinks as Energy is spent on other rows.
function MovementRow({
  base,
  epSpent,
  energyCurrent,
  onIncrease,
  onDecrease,
}: {
  base: number;
  epSpent: number;
  energyCurrent: number;
  onIncrease: () => void;
  onDecrease: () => void;
}) {
  const value = movementMeters(base, epSpent);
  const max = movementMeters(base, epSpent + energyCurrent);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink">
          <span className="text-muted-ink">
            <Footprints size={14} aria-hidden="true" />
          </span>
          Movement
        </span>
        <span className="font-[family-name:var(--font-jetbrains)] text-sm text-case-file-white">
          {value}m<span className="text-muted-ink">/{max}m</span>
        </span>
      </div>
      <Meter value={value} max={max} tone="steel" label={`Movement ${value}/${max} meters`} />
      <div className="mt-2 flex items-center gap-2">
        <Stepper label="Decrease movement (refund 1 EP)" onClick={onDecrease}>
          <Minus size={14} aria-hidden="true" />
        </Stepper>
        <span className="w-full border border-elevated-ledger bg-void-navy px-2 py-1.5 text-center font-[family-name:var(--font-jetbrains)] text-sm text-muted-ink pointer-coarse:py-3">
          {epSpent} EP spent
        </span>
        <Stepper label="Increase movement (spend 1 EP)" onClick={onIncrease}>
          <Plus size={14} aria-hidden="true" />
        </Stepper>
      </div>
    </div>
  );
}

// A flat rate rather than a fillable pool — same steppers + direct entry as
// Row, but no max and no meter.
function RateRow({
  icon,
  label,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink">
          <span className="text-muted-ink">{icon}</span>
          {label}
        </span>
        <span className="font-[family-name:var(--font-jetbrains)] text-sm text-signal-cyan">
          +{value}
          <span className="text-muted-ink"> / turn</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Stepper label={`Decrease ${label}`} onClick={() => onChange(value - 1)}>
          <Minus size={14} aria-hidden="true" />
        </Stepper>
        <input
          type="number"
          min={0}
          inputMode="numeric"
          aria-label={label}
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
