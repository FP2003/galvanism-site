"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, TextInput, Textarea, Select, FormMessage } from "@/components/ui/form";
import { createRegistryEntry, updateRegistryEntry, type FormState } from "@/app/admin/registry-actions";
import { REGISTRY_TYPE_META, REGISTRY_TYPES } from "@/lib/registry";
import { TEXT_LIMITS } from "@/lib/game-rules";
import type { RegistryEntry } from "@/lib/schema";

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {isEdit ? <Save size={15} /> : <Plus size={15} />}
      {pending ? (isEdit ? "Saving…" : "Creating…") : isEdit ? "Save changes" : "Create entry"}
    </Button>
  );
}

// Create/edit form for a registry entry (Phase 8). Doubles as the edit form,
// same pattern as FacilityForm — passing `entry` prefills every field and
// submits through updateRegistryEntry instead of createRegistryEntry.
// GM Notes is deliberately its own field, never merged into Description —
// it's the one part of an entry that's never sent to a player regardless of
// visibility (see lib/registry-data.ts's public query, which never selects
// this column).
export function RegistryEntryForm({
  entry,
  onSaved,
}: {
  entry?: RegistryEntry;
  onSaved?: () => void;
} = {}) {
  const isEdit = Boolean(entry);
  const [state, formAction] = useActionState<FormState, FormData>(
    isEdit ? updateRegistryEntry : createRegistryEntry,
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
      {isEdit && <input type="hidden" name="entryId" value={entry!.id} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name">
          {(id) => (
            <TextInput
              id={id}
              name="name"
              required
              maxLength={TEXT_LIMITS.registryName}
              autoComplete="off"
              defaultValue={entry?.name}
              placeholder="The Iron Cartel"
            />
          )}
        </Field>
        <Field label="Type">
          {(id) => (
            <Select id={id} name="type" defaultValue={entry?.type ?? REGISTRY_TYPES[0]}>
              {REGISTRY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {REGISTRY_TYPE_META[t].label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field
          label="Visibility"
          hint="Hidden entries never appear to players — not in the browse list, and not as a linkable page."
        >
          {(id) => (
            <Select id={id} name="visibility" defaultValue={entry?.visibility ?? "public"}>
              <option value="public">Public</option>
              <option value="hidden">Hidden</option>
            </Select>
          )}
        </Field>
      </div>

      <Field label="Description" hint="Player-visible when the entry is Public. Supports Markdown.">
        {(id) => (
          <Textarea
            id={id}
            name="description"
            rows={5}
            maxLength={TEXT_LIMITS.registryDescription}
            defaultValue={entry?.description ?? ""}
            placeholder="What a player sees on this entry's page."
          />
        )}
      </Field>

      <Field label="GM Notes" hint="Never shown to players, regardless of visibility. Supports Markdown.">
        {(id) => (
          <Textarea
            id={id}
            name="gmNotes"
            rows={5}
            maxLength={TEXT_LIMITS.registryGmNotes}
            defaultValue={entry?.gmNotes ?? ""}
            placeholder="Secrets, stat blocks, plot hooks — admin eyes only."
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
