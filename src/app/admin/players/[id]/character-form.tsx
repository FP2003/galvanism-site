"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Field,
  TextInput,
  Textarea,
  Select,
  FormMessage,
} from "@/components/ui/form";
import { CHARACTER_STATUSES } from "@/lib/status";
import {
  BASE_HP,
  BASE_ENERGY,
  BASE_ENERGY_REGEN,
  BASE_MOVEMENT_METERS,
  IMMUNITY_BASE,
  TEXT_LIMITS,
} from "@/lib/game-rules";
import type { CharacterView } from "@/lib/characters";
import {
  createCharacter,
  updateCharacter,
  type FormState,
} from "@/app/admin/actions";

const statusLabel: Record<(typeof CHARACTER_STATUSES)[number], string> = {
  active: "Active Duty",
  standby: "Standby",
  injured: "Med Hold / Injured",
  kia: "K.I.A.",
};

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      <Save size={15} />
      {pending
        ? isEdit
          ? "Saving…"
          : "Creating…"
        : isEdit
          ? "Save character sheet"
          : "Create character"}
    </Button>
  );
}

// Full character CRUD form. `character` present → edit mode; absent → create for
// the given player. Mechanical validation/clamping is enforced server-side.
export function CharacterForm({
  playerId,
  character,
}: {
  playerId: string;
  character: CharacterView | null;
}) {
  const isEdit = character !== null;
  const [state, formAction] = useActionState<FormState, FormData>(
    isEdit ? updateCharacter : createCharacter,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="playerId" value={playerId} />
      {character && (
        <input type="hidden" name="characterId" value={character.id} />
      )}

      <Section title="Identity">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Callsign" hint="Used for the case-file URL.">
            {(id) => (
              <TextInput
                id={id}
                name="callsign"
                required
                maxLength={TEXT_LIMITS.callsign}
                autoComplete="off"
                placeholder="HALYARD"
                defaultValue={character?.callsign ?? ""}
              />
            )}
          </Field>
          <Field label="Operator name">
            {(id) => (
              <TextInput
                id={id}
                name="name"
                required
                maxLength={TEXT_LIMITS.name}
                autoComplete="off"
                placeholder="M. Okonkwo"
                defaultValue={character?.name ?? ""}
              />
            )}
          </Field>
          <Field label="Rank">
            {(id) => (
              <TextInput
                id={id}
                name="rank"
                maxLength={TEXT_LIMITS.rank}
                autoComplete="off"
                placeholder="Custodian, Grade II"
                defaultValue={character?.rank ?? ""}
              />
            )}
          </Field>
          <Field label="Role">
            {(id) => (
              <TextInput
                id={id}
                name="role"
                maxLength={TEXT_LIMITS.role}
                autoComplete="off"
                placeholder="Breacher"
                defaultValue={character?.role ?? ""}
              />
            )}
          </Field>
          <Field label="Status">
            {(id) => (
              <Select
                id={id}
                name="status"
                defaultValue={character?.status ?? "standby"}
              >
                {CHARACTER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel[s]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </Section>

      <Section title="Resources">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <ResourcePair
            label="Health"
            currentName="hpCurrent"
            maxName="hpMax"
            current={character?.hp.current ?? BASE_HP}
            max={character?.hp.max ?? BASE_HP}
          />
          <ResourcePair
            label="Energy"
            currentName="energyCurrent"
            maxName="energyMax"
            current={character?.energy.current ?? BASE_ENERGY}
            max={character?.energy.max ?? BASE_ENERGY}
          />
          <ResourcePair
            label="Ammo"
            currentName="ammoCurrent"
            maxName="ammoMax"
            current={character?.ammo.current ?? 0}
            max={character?.ammo.max ?? 0}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <NumberField
            label="Energy Regen"
            name="energyRegen"
            defaultValue={character?.energyRegen ?? BASE_ENERGY_REGEN}
          />
          <NumberField
            label="Movement Base (m)"
            name="movementBase"
            defaultValue={character?.movementBase ?? BASE_MOVEMENT_METERS}
          />
          <NumberField
            label="EP Committed to Movement"
            name="movementEpSpent"
            defaultValue={character?.movementEpSpent ?? 0}
          />
        </div>
      </Section>

      <Section title="Attributes">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <NumberField label="Tech" name="statTech" defaultValue={character?.stats.tech ?? 0} />
          <NumberField label="Precision" name="statPrecision" defaultValue={character?.stats.precision ?? 0} />
          <NumberField label="Strength" name="statStrength" defaultValue={character?.stats.strength ?? 0} />
          <NumberField label="Immunity" name="statImmunity" defaultValue={character?.stats.immunity ?? IMMUNITY_BASE} />
          <NumberField label="Resilience" name="statResilience" defaultValue={character?.stats.resilience ?? 0} />
          <NumberField label="Agility" name="statAgility" defaultValue={character?.stats.agility ?? 0} />
        </div>
      </Section>

      <Section title="Service Record">
        <Field
          label="Biography"
          hint="Supports Markdown: **bold**, *italic*, and '- ' for bullet lists."
        >
          {(id) => (
            <Textarea
              id={id}
              name="bio"
              rows={5}
              maxLength={TEXT_LIMITS.bio}
              placeholder="Background, notable operations, disposition…"
              defaultValue={character?.bio ?? ""}
            />
          )}
        </Field>
      </Section>

      <FormMessage state={state} />
      <div>
        <SubmitButton isEdit={isEdit} />
      </div>
    </form>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-1 font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-signal-cyan">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function NumberField({
  label,
  name,
  defaultValue,
  min = 0,
}: {
  label: string;
  name: string;
  defaultValue: number;
  min?: number;
}) {
  return (
    <Field label={label}>
      {(id) => (
        <TextInput
          id={id}
          name={name}
          type="number"
          min={min}
          inputMode="numeric"
          defaultValue={defaultValue}
        />
      )}
    </Field>
  );
}

function ResourcePair({
  label,
  currentName,
  maxName,
  current,
  max,
}: {
  label: string;
  currentName: string;
  maxName: string;
  current: number;
  max: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-[family-name:var(--font-chakra)] text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <TextInput
          name={currentName}
          type="number"
          min={0}
          inputMode="numeric"
          aria-label={`${label} current`}
          defaultValue={current}
        />
        <span className="font-[family-name:var(--font-jetbrains)] text-sm text-muted-ink">
          /
        </span>
        <TextInput
          name={maxName}
          type="number"
          min={0}
          inputMode="numeric"
          aria-label={`${label} max`}
          defaultValue={max}
        />
      </div>
    </div>
  );
}
