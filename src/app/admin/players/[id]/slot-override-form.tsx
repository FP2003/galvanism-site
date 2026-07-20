"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Field, TextInput, FormMessage } from "@/components/ui/form";
import { CARD_CATEGORY_META } from "@/lib/cards";
import { SLOT_LIMITED_CATEGORIES, type SlotCountMap } from "@/lib/card-slots";
import { setCharacterSlotOverrides, type FormState } from "@/app/admin/card-actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Saving…" : "Save overrides"}
    </Button>
  );
}

// Admin's direct per-category bonus-slot override (Phase 8) — one field per
// slot-limited category, additive on top of any slots the character has
// separately bought via a facility slot-upgrade offering (see
// getCharacterSlotBonuses in lib/card-data.ts — `override` is seeded here
// deliberately unmerged with `purchased`, or editing would double-count).
export function SlotOverrideForm({
  characterId,
  override,
}: {
  characterId: string;
  override: SlotCountMap;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(setCharacterSlotOverrides, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="characterId" value={characterId} />
      <p className="text-xs text-muted-ink">
        Bonus equip slots granted by hand, per card category — adds on top of
        any slots this character has bought via a facility slot upgrade.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {SLOT_LIMITED_CATEGORIES.map((category) => (
          <Field key={category} label={CARD_CATEGORY_META[category].label}>
            {(id) => (
              <TextInput
                id={id}
                name={`bonus_${category}`}
                type="number"
                min={0}
                inputMode="numeric"
                defaultValue={override[category]}
              />
            )}
          </Field>
        ))}
      </div>
      <FormMessage state={state} />
      <SubmitButton />
    </form>
  );
}
