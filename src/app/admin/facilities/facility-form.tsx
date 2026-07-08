"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, TextInput, Textarea, Select, FormMessage } from "@/components/ui/form";
import { createShop, updateShop, type FormState } from "@/app/admin/shop-actions";
import type { Shop } from "@/lib/schema";

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {isEdit ? <Save size={15} /> : <Plus size={15} />}
      {pending ? (isEdit ? "Saving…" : "Creating…") : isEdit ? "Save changes" : "Create shop"}
    </Button>
  );
}

// Create/edit form for a shop (Phase 4). Doubles as the edit form: passing
// `shop` prefills every field and submits through updateShop instead of
// createShop, same pattern as CardForm.
export function ShopForm({
  shop,
  onSaved,
}: {
  shop?: Shop;
  onSaved?: () => void;
} = {}) {
  const isEdit = Boolean(shop);
  const [state, formAction] = useActionState<FormState, FormData>(
    isEdit ? updateShop : createShop,
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
      {isEdit && <input type="hidden" name="shopId" value={shop!.id} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name">
          {(id) => (
            <TextInput
              id={id}
              name="name"
              required
              maxLength={64}
              autoComplete="off"
              defaultValue={shop?.name}
              placeholder="Foxtrot Tech Depot"
            />
          )}
        </Field>
        <Field label="Status">
          {(id) => (
            <Select id={id} name="isOpen" defaultValue={shop ? (shop.isOpen ? "open" : "closed") : "open"}>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </Select>
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
              defaultValue={shop?.rotatingSlotCount ?? 4}
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
              defaultValue={shop?.restockIntervalOps ?? ""}
              placeholder="3"
            />
          )}
        </Field>
      </div>

      <Field label="Description" hint="Optional flavor text for the shop front.">
        {(id) => (
          <Textarea
            id={id}
            name="description"
            rows={3}
            maxLength={400}
            defaultValue={shop?.description ?? ""}
            placeholder="What this shop is / how it reads on the table."
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
