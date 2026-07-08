"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, TextInput, Textarea, Select, FormMessage } from "@/components/ui/form";
import { createMission, updateMission, type FormState } from "@/app/admin/mission-actions";
import { TEXT_LIMITS } from "@/lib/game-rules";
import type { Mission } from "@/lib/schema";

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {isEdit ? <Save size={15} /> : <Plus size={15} />}
      {pending ? (isEdit ? "Saving…" : "Posting…") : isEdit ? "Save changes" : "Post mission"}
    </Button>
  );
}

// Create/edit form for a mission (Phase 5). Doubles as the edit form, same
// dual-mode pattern as ShopForm. Status isn't editable here — Active/Failed
// are dedicated quick actions (mission-menu.tsx) and Complete lives on the
// detail page, since it needs assignment context and moves money.
export function MissionForm({
  mission,
  onSaved,
}: {
  mission?: Mission;
  onSaved?: () => void;
} = {}) {
  const isEdit = Boolean(mission);
  const [state, formAction] = useActionState<FormState, FormData>(
    isEdit ? updateMission : createMission,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [urgent, setUrgent] = useState(mission?.urgent ?? false);

  useEffect(() => {
    if (state.ok && !isEdit) formRef.current?.reset();
  }, [state, isEdit]);

  useEffect(() => {
    if (isEdit && state.ok) onSaved?.();
  }, [state, isEdit, onSaved]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      {isEdit && <input type="hidden" name="missionId" value={mission!.id} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Title">
          {(id) => (
            <TextInput
              id={id}
              name="title"
              required
              maxLength={TEXT_LIMITS.missionTitle}
              autoComplete="off"
              defaultValue={mission?.title}
              placeholder="Crazy Joe's Sewers"
            />
          )}
        </Field>
        <Field label="Sector" hint="Free-text location label.">
          {(id) => (
            <TextInput
              id={id}
              name="sector"
              maxLength={TEXT_LIMITS.missionSector}
              autoComplete="off"
              defaultValue={mission?.sector ?? ""}
              placeholder="Downtown"
            />
          )}
        </Field>
        <Field label="Risk">
          {(id) => (
            <Select id={id} name="risk" defaultValue={mission?.risk ?? "low"}>
              <option value="low">Low</option>
              <option value="moderate">Moderate</option>
              <option value="high">High</option>
              <option value="severe">Severe</option>
            </Select>
          )}
        </Field>
        <Field label="Payout (Credits)" hint="Total credit pot — split evenly across assigned operators on completion.">
          {(id) => (
            <TextInput
              id={id}
              name="payoutCredits"
              type="number"
              min={0}
              inputMode="numeric"
              defaultValue={mission?.payoutCredits ?? 0}
              placeholder="600"
            />
          )}
        </Field>
        <Field label="Payout (XP)" hint="Total XP pot — split evenly across assigned operators' characters.">
          {(id) => (
            <TextInput
              id={id}
              name="payoutXp"
              type="number"
              min={0}
              inputMode="numeric"
              defaultValue={mission?.payoutXp ?? 0}
              placeholder="50"
            />
          )}
        </Field>
        <Field label="Urgent">
          {(id) => (
            <Select
              id={id}
              name="urgent"
              defaultValue={urgent ? "urgent" : "standard"}
              onChange={(e) => setUrgent(e.target.value === "urgent")}
            >
              <option value="standard">Standard</option>
              <option value="urgent">Urgent</option>
            </Select>
          )}
        </Field>
        {urgent && (
          <Field label="Deadline" hint="Ops (missions) remaining before this fails.">
            {(id) => (
              <TextInput
                id={id}
                name="urgentDeadline"
                type="number"
                min={1}
                inputMode="numeric"
                defaultValue={mission?.urgentDeadline ?? ""}
                placeholder="2"
              />
            )}
          </Field>
        )}
      </div>

      <Field label="Briefing" hint="Supports Markdown — **bold**, *italic*, and '- ' for bullet lists.">
        {(id) => (
          <Textarea
            id={id}
            name="briefing"
            rows={6}
            maxLength={TEXT_LIMITS.missionBriefing}
            defaultValue={mission?.briefing ?? ""}
            placeholder="What the operators are walking into."
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
