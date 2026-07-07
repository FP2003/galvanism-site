"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Field,
  TextInput,
  Textarea,
  Select,
  FormMessage,
  fieldLabelClass,
} from "@/components/ui/form";
import {
  CARD_CATEGORIES,
  CARD_CATEGORY_META,
  CARD_TEXT_LIMITS,
  ITEM_SUBCATEGORIES,
  ITEM_SUBCATEGORY_META,
  WEAPON_HANDEDNESS_LABELS,
  WEAPON_DAMAGE_TYPES,
  WEAPON_DAMAGE_TYPE_LABELS,
  isWeaponSubcategory,
  targetsFor,
  TRIGGER_LABELS,
  type CardActivation,
  type CardCategory,
  type CardEffectType,
  type CardTrigger,
  type ItemSubcategory,
  type WeaponHandedness,
} from "@/lib/cards";
import { createCard, type FormState } from "@/app/admin/card-actions";

const TRIGGERS = ["on_equip", "on_use", "passive"] as const;
const WEAPON_HANDEDNESS = ["one_handed", "two_handed"] as const;

// One row of the repeatable effect builder below (card-form state, serialized
// to JSON on submit — see card-actions.ts parseEffectsField for the mirrored
// server-side validation).
interface EffectRow {
  activation: CardActivation;
  effectType: CardEffectType;
  effectTarget: string;
  effectAmount: string;
  trigger: CardTrigger;
}

function defaultEffectRow(): EffectRow {
  return {
    activation: "passive",
    effectType: "stat_modifier",
    effectTarget: "statTech",
    effectAmount: "",
    trigger: "passive",
  };
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      <Plus size={15} />
      {pending ? "Creating…" : "Create card"}
    </Button>
  );
}

// Structured effect builder (info/card_system.md). A card can carry any number
// of mechanical effects (each with its own activation/type/target/amount/
// trigger) plus optional flavor text — the two aren't mutually exclusive.
export function CardForm() {
  const [state, formAction] = useActionState<FormState, FormData>(createCard, {});
  const [effects, setEffects] = useState<EffectRow[]>([defaultEffectRow()]);
  const [category, setCategory] = useState<CardCategory>("combat");
  const [subcategory, setSubcategory] = useState<ItemSubcategory>("medical");
  const [resetKey, setResetKey] = useState(0);
  const titleRef = useRef<HTMLInputElement>(null);

  // On a successful create, the dialog hosting this form stays open (so the
  // DM can author the next card without reopening it) — reset in place
  // rather than relying on unmount. Bumping resetKey remounts the uncontrolled
  // native fields; setEffects clears the controlled effect-row state. Adjusted
  // during render (not an effect) per React's "state from props" pattern,
  // since it's deriving state from the latest action result, not synchronizing
  // with an external system.
  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (state.ok) {
      setEffects([defaultEffectRow()]);
      setCategory("combat");
      setSubcategory("medical");
      setResetKey((k) => k + 1);
    }
  }

  // Focusing is a genuine effect (imperative DOM action after the reset
  // above has committed and remounted the title input).
  useEffect(() => {
    if (resetKey > 0) titleRef.current?.focus();
  }, [resetKey]);

  // Item cards usually lean on their weapon stats / descriptive text rather
  // than a structured effect, so switching into "item" starts from a blank
  // effect list instead of the usual pre-seeded row — and switching back out
  // restores it, but only if the DM hasn't already started filling it in.
  function handleCategoryChange(next: CardCategory) {
    if (next === "item" && category !== "item") {
      setEffects([]);
    } else if (next !== "item" && category === "item" && effects.length === 0) {
      setEffects([defaultEffectRow()]);
    }
    setCategory(next);
  }

  function updateEffect(index: number, patch: Partial<EffectRow>) {
    setEffects((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function addEffect() {
    setEffects((rows) =>
      rows.length >= CARD_TEXT_LIMITS.effectsMax
        ? rows
        : [...rows, defaultEffectRow()],
    );
  }

  function removeEffect(index: number) {
    setEffects((rows) => rows.filter((_, i) => i !== index));
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div key={resetKey} className="flex flex-col gap-6">
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-1 font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-signal-cyan">
            Card face
          </legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Category">
              {(id) => (
                <Select
                  id={id}
                  name="category"
                  value={category}
                  onChange={(e) => handleCategoryChange(e.target.value as CardCategory)}
                >
                  {CARD_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CARD_CATEGORY_META[c].label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {category === "item" && (
              <Field label="Subcategory">
                {(id) => (
                  <Select
                    id={id}
                    name="subcategory"
                    value={subcategory}
                    onChange={(e) => setSubcategory(e.target.value as ItemSubcategory)}
                  >
                    {ITEM_SUBCATEGORIES.map((s) => (
                      <option key={s} value={s}>
                        {ITEM_SUBCATEGORY_META[s].label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
            <Field label="Title">
              {(id) => (
                <TextInput
                  ref={titleRef}
                  id={id}
                  name="title"
                  required
                  maxLength={CARD_TEXT_LIMITS.title}
                  autoComplete="off"
                  placeholder="Overclock Rounds"
                />
              )}
            </Field>
            <Field label="Level">
              {(id) => (
                <TextInput
                  id={id}
                  name="level"
                  type="number"
                  min={1}
                  max={CARD_TEXT_LIMITS.levelMax}
                  inputMode="numeric"
                  defaultValue={1}
                />
              )}
            </Field>
            <Field label="Custom color" hint="Optional #hex override.">
              {(id) => (
                <TextInput
                  id={id}
                  name="colorOverride"
                  autoComplete="off"
                  placeholder="#4a3b7a"
                />
              )}
            </Field>
          </div>
          <Field label="Description" hint="Card-face body copy (flavor / rules text).">
            {(id) => (
              <Textarea
                id={id}
                name="description"
                rows={3}
                maxLength={CARD_TEXT_LIMITS.description}
                placeholder="What the card is / how it reads on the table."
              />
            )}
          </Field>
        </fieldset>

        {category === "item" && isWeaponSubcategory(subcategory) && (
          <fieldset className="flex flex-col gap-4">
            <legend className="mb-1 font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-signal-cyan">
              Weapon details
            </legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Handedness">
                {(id) => (
                  <Select id={id} name="handedness" defaultValue="one_handed">
                    {WEAPON_HANDEDNESS.map((h) => (
                      <option key={h} value={h}>
                        {WEAPON_HANDEDNESS_LABELS[h as WeaponHandedness]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Damage type">
                {(id) => (
                  <Select id={id} name="damageType" defaultValue="piercing">
                    {WEAPON_DAMAGE_TYPES.map((d) => (
                      <option key={d} value={d}>
                        {WEAPON_DAMAGE_TYPE_LABELS[d]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Damage">
                {(id) => (
                  <TextInput
                    id={id}
                    name="damage"
                    type="number"
                    min={1}
                    max={CARD_TEXT_LIMITS.damageAbs}
                    inputMode="numeric"
                    required
                    placeholder="6"
                  />
                )}
              </Field>
              <Field label="Range" hint="Meters, optional.">
                {(id) => (
                  <TextInput
                    id={id}
                    name="range"
                    type="number"
                    min={0}
                    max={CARD_TEXT_LIMITS.rangeAbs}
                    inputMode="numeric"
                    placeholder="20"
                  />
                )}
              </Field>
              <Field
                label="Ammo count"
                hint="Optional — descriptive only, not wired to the Ammo resource."
              >
                {(id) => (
                  <TextInput
                    id={id}
                    name="ammoCount"
                    type="number"
                    min={0}
                    max={CARD_TEXT_LIMITS.ammoCountAbs}
                    inputMode="numeric"
                    placeholder="30"
                  />
                )}
              </Field>
            </div>
          </fieldset>
        )}

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-1 font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-signal-cyan">
            Effects
          </legend>
          <Field
            label="Descriptive text"
            hint="Optional feat-like flavor text, shown alongside any mechanical effects below."
          >
            {(id) => (
              <Textarea
                id={id}
                name="descriptiveText"
                rows={3}
                maxLength={CARD_TEXT_LIMITS.descriptiveText}
                placeholder="Once per mission, re-roll a failed melee defense…"
              />
            )}
          </Field>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className={fieldLabelClass}>Mechanical effects</span>
              <button
                type="button"
                onClick={addEffect}
                disabled={effects.length >= CARD_TEXT_LIMITS.effectsMax}
                className="flex items-center gap-1 font-[family-name:var(--font-chakra)] text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-signal-cyan transition-colors hover:text-case-file-white disabled:opacity-40"
              >
                <Plus size={13} aria-hidden="true" /> Add effect
              </button>
            </div>

            {effects.length === 0 && (
              <p className="text-xs text-muted-ink">
                No mechanical effects — this card is descriptive only.
              </p>
            )}

            {effects.map((row, i) => (
              <EffectRowFields
                key={i}
                row={row}
                index={i}
                onChange={(patch) => updateEffect(i, patch)}
                onRemove={() => removeEffect(i)}
              />
            ))}
          </div>

          <input type="hidden" name="effects" value={JSON.stringify(effects)} />
        </fieldset>
      </div>

      <FormMessage state={state} />
      <div>
        <SubmitButton />
      </div>
    </form>
  );
}

function EffectRowFields({
  row,
  index,
  onChange,
  onRemove,
}: {
  row: EffectRow;
  index: number;
  onChange: (patch: Partial<EffectRow>) => void;
  onRemove: () => void;
}) {
  const targets = targetsFor(row.effectType);

  return (
    <div className="border border-elevated-ledger p-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">
          Effect {index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove effect ${index + 1}`}
          className="text-muted-ink transition-colors hover:text-stamp-red"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Activation">
          {(id) => (
            <Select
              id={id}
              value={row.activation}
              onChange={(e) =>
                onChange({ activation: e.target.value as CardActivation })
              }
            >
              <option value="passive">Passive</option>
              <option value="active">Active</option>
            </Select>
          )}
        </Field>
        <Field label="Effect type">
          {(id) => (
            <Select
              id={id}
              value={row.effectType}
              onChange={(e) => {
                const effectType = e.target.value as CardEffectType;
                onChange({
                  effectType,
                  effectTarget: targetsFor(effectType)[0]?.key ?? "",
                });
              }}
            >
              <option value="stat_modifier">Stat modifier</option>
              <option value="resource_modifier">Resource modifier</option>
            </Select>
          )}
        </Field>
        <Field label="Target">
          {(id) => (
            <Select
              id={id}
              value={row.effectTarget}
              onChange={(e) => onChange({ effectTarget: e.target.value })}
            >
              {targets.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Amount" hint="Signed whole number, e.g. +1 or −10.">
          {(id) => (
            <TextInput
              id={id}
              value={row.effectAmount}
              onChange={(e) => onChange({ effectAmount: e.target.value })}
              autoComplete="off"
              inputMode="numeric"
              placeholder="+1"
            />
          )}
        </Field>
        <Field
          label="Trigger"
          hint="On-equip / passive apply while equipped; on-use is table-side."
        >
          {(id) => (
            <Select
              id={id}
              value={row.trigger}
              onChange={(e) =>
                onChange({ trigger: e.target.value as CardTrigger })
              }
            >
              {TRIGGERS.map((t) => (
                <option key={t} value={t}>
                  {TRIGGER_LABELS[t]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
    </div>
  );
}
