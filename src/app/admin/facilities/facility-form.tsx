"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, TextInput, Textarea, Select, FormMessage } from "@/components/ui/form";
import { createFacility, updateFacility, type FormState } from "@/app/admin/facility-actions";
import type { Facility } from "@/lib/schema";

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {isEdit ? <Save size={15} /> : <Plus size={15} />}
      {pending ? (isEdit ? "Saving…" : "Creating…") : isEdit ? "Save changes" : "Create facility"}
    </Button>
  );
}

// Create/edit form for a facility (Phase 6, absorbing Phase 4's ShopForm).
// Doubles as the edit form: passing `facility` prefills every field and
// submits through updateFacility instead of createFacility, same pattern as
// CardForm. Kind toggles what the facility "is" (a named, leveled Station
// service vs a simple never-leveled Field shop) — Level only matters for
// Station kind but is always shown, since an admin can retype a Field shop
// into a Station one later.
export function FacilityForm({
  facility,
  onSaved,
}: {
  facility?: Facility;
  onSaved?: () => void;
} = {}) {
  const isEdit = Boolean(facility);
  const [state, formAction] = useActionState<FormState, FormData>(
    isEdit ? updateFacility : createFacility,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && !isEdit) formRef.current?.reset();
  }, [state, isEdit]);

  useEffect(() => {
    if (isEdit && state.ok) onSaved?.();
  }, [state, isEdit, onSaved]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      {isEdit && <input type="hidden" name="facilityId" value={facility!.id} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name">
          {(id) => (
            <TextInput
              id={id}
              name="name"
              required
              maxLength={64}
              autoComplete="off"
              defaultValue={facility?.name}
              placeholder="Armory / Shooting Range"
            />
          )}
        </Field>
        <Field label="Status">
          {(id) => (
            <Select
              id={id}
              name="isOpen"
              defaultValue={facility ? (facility.isOpen ? "open" : "closed") : "open"}
            >
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </Select>
          )}
        </Field>
        <Field label="Kind" hint="Station = named, leveled service. Field = a small shop that never levels.">
          {(id) => (
            <Select id={id} name="kind" defaultValue={facility?.kind ?? "station"}>
              <option value="station">Station</option>
              <option value="field">Field</option>
            </Select>
          )}
        </Field>
        <Field label="Level" hint="Admin-set. Caps which card level this facility can list/roll.">
          {(id) => (
            <TextInput
              id={id}
              name="level"
              type="number"
              min={1}
              inputMode="numeric"
              defaultValue={facility?.level ?? 1}
            />
          )}
        </Field>
        <Field label="Rotating slots" hint="How many listings restock auto-fills.">
          {(id) => (
            <TextInput
              id={id}
              name="rotatingSlotCount"
              type="number"
              min={0}
              inputMode="numeric"
              defaultValue={facility?.rotatingSlotCount ?? 4}
            />
          )}
        </Field>
        <Field
          label="Restock every"
          hint="Operations between auto-restocks. Blank = manual restock only."
        >
          {(id) => (
            <TextInput
              id={id}
              name="restockIntervalOps"
              type="number"
              min={1}
              inputMode="numeric"
              defaultValue={facility?.restockIntervalOps ?? ""}
              placeholder="3"
            />
          )}
        </Field>
      </div>

      <Field label="Description" hint="Optional flavor text for the facility front.">
        {(id) => (
          <Textarea
            id={id}
            name="description"
            rows={3}
            maxLength={400}
            defaultValue={facility?.description ?? ""}
            placeholder="What this facility is / how it reads on the table."
          />
        )}
      </Field>

      <FormMessage state={state} />
      <div>
        <SubmitButton isEdit={isEdit} />
      </div>
    </form>
  );
}
