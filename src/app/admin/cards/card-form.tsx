"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Field,
  TextInput,
  Textarea,
  Select,
  FormMessage,
} from "@/components/ui/form";
import {
  CARD_CATEGORIES,
  CARD_CATEGORY_META,
  CARD_TEXT_LIMITS,
  targetsFor,
  TRIGGER_LABELS,
  type CardEffectKind,
  type CardEffectType,
} from "@/lib/cards";
import { createCard, type FormState } from "@/app/admin/card-actions";

const TRIGGERS = ["on_equip", "on_use", "passive"] as const;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      <Plus size={15} />
      {pending ? "Creating…" : "Create card"}
    </Button>
  );
}

// Structured effect builder (info/card_system.md). Mechanical cards get the
// type/target/amount/trigger fields; descriptive cards get a free-text box. Which
// set shows is driven client-side; the server re-validates either way.
export function CardForm() {
  const [state, formAction] = useActionState<FormState, FormData>(createCard, {});
  const [effectKind, setEffectKind] = useState<CardEffectKind>("mechanical");
  const [effectType, setEffectType] =
    useState<CardEffectType>("stat_modifier");

  const targets = targetsFor(effectType);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-signal-cyan">
          Card face
        </legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Category">
            {(id) => (
              <Select id={id} name="category" defaultValue="combat">
                {CARD_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CARD_CATEGORY_META[c].label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Title">
            {(id) => (
              <TextInput
                id={id}
                name="title"
                required
                maxLength={CARD_TEXT_LIMITS.title}
                autoComplete="off"
                placeholder="Overclock Rounds"
              />
            )}
          </Field>
          <Field label="Activation">
            {(id) => (
              <Select id={id} name="activation" defaultValue="passive">
                <option value="passive">Passive</option>
                <option value="active">Active</option>
              </Select>
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

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-signal-cyan">
          Effect
        </legend>
        <Field
          label="Effect kind"
          hint="Mechanical auto-applies to the sheet; descriptive is feat-like text."
        >
          {(id) => (
            <Select
              id={id}
              name="effectKind"
              value={effectKind}
              onChange={(e) => setEffectKind(e.target.value as CardEffectKind)}
            >
              <option value="mechanical">Mechanical (structured)</option>
              <option value="descriptive">Descriptive (text only)</option>
            </Select>
          )}
        </Field>

        {effectKind === "mechanical" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Effect type">
              {(id) => (
                <Select
                  id={id}
                  name="effectType"
                  value={effectType}
                  onChange={(e) =>
                    setEffectType(e.target.value as CardEffectType)
                  }
                >
                  <option value="stat_modifier">Stat modifier</option>
                  <option value="resource_modifier">Resource modifier</option>
                </Select>
              )}
            </Field>
            <Field label="Target">
              {(id) => (
                <Select id={id} name="effectTarget" key={effectType}>
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
                  name="effectAmount"
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
                <Select id={id} name="trigger" defaultValue="passive">
                  {TRIGGERS.map((t) => (
                    <option key={t} value={t}>
                      {TRIGGER_LABELS[t]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        ) : (
          <Field label="Effect text">
            {(id) => (
              <Textarea
                id={id}
                name="descriptiveText"
                rows={4}
                maxLength={CARD_TEXT_LIMITS.descriptiveText}
                placeholder="Once per mission, re-roll a failed melee defense…"
              />
            )}
          </Field>
        )}
      </fieldset>

      <FormMessage state={state} />
      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
