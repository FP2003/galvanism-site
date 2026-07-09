"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, TextInput, Textarea, Select, FormMessage } from "@/components/ui/form";
import { createBallot, updateBallot, type FormState } from "@/app/admin/ballot-actions";
import { TEXT_LIMITS, MAX_BALLOT_OPTIONS } from "@/lib/game-rules";
import type { Ballot, BallotOption } from "@/lib/schema";

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {isEdit ? <Save size={15} /> : <Plus size={15} />}
      {pending ? (isEdit ? "Saving…" : "Opening…") : isEdit ? "Save changes" : "Open ballot"}
    </Button>
  );
}

// Create/edit form for a ballot (Phase 7). Doubles as the edit form, same
// dual-mode pattern as MissionForm. Options are only set at creation — an
// option may already have votes against it by the time an admin wants to
// edit, so the option builder only renders in create mode; editing an
// existing ballot only touches title/description/deadline.
export function BallotForm({
  ballot,
  onSaved,
}: {
  ballot?: Ballot & { options: BallotOption[] };
  onSaved?: () => void;
} = {}) {
  const isEdit = Boolean(ballot);
  const [state, formAction] = useActionState<FormState, FormData>(
    isEdit ? updateBallot : createBallot,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [hasDeadline, setHasDeadline] = useState(ballot?.opsDeadline != null);
  const [options, setOptions] = useState<string[]>(["", ""]);

  useEffect(() => {
    if (state.ok && !isEdit) {
      formRef.current?.reset();
      setOptions(["", ""]);
    }
  }, [state, isEdit]);

  useEffect(() => {
    if (isEdit && state.ok) onSaved?.();
  }, [state, isEdit, onSaved]);

  function updateOption(index: number, value: string) {
    setOptions((rows) => rows.map((r, i) => (i === index ? value : r)));
  }

  function addOption() {
    setOptions((rows) => (rows.length >= MAX_BALLOT_OPTIONS ? rows : [...rows, ""]));
  }

  function removeOption(index: number) {
    setOptions((rows) => rows.filter((_, i) => i !== index));
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      {isEdit && <input type="hidden" name="ballotId" value={ballot!.id} />}

      <Field label="Title">
        {(id) => (
          <TextInput
            id={id}
            name="title"
            required
            maxLength={TEXT_LIMITS.ballotTitle}
            autoComplete="off"
            defaultValue={ballot?.title}
            placeholder="Next shared upgrade for the station"
          />
        )}
      </Field>

      <Field label="Description" hint="Optional context for players.">
        {(id) => (
          <Textarea
            id={id}
            name="description"
            rows={3}
            maxLength={TEXT_LIMITS.ballotDescription}
            defaultValue={ballot?.description ?? ""}
            placeholder="What's on the table and why."
          />
        )}
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Time limit">
          {(id) => (
            <Select
              id={id}
              name="hasDeadline"
              defaultValue={hasDeadline ? "limited" : "none"}
              onChange={(e) => setHasDeadline(e.target.value === "limited")}
            >
              <option value="none">No limit</option>
              <option value="limited">Limited</option>
            </Select>
          )}
        </Field>
        {hasDeadline && (
          <Field label="Deadline" hint="Ops (missions) remaining before this auto-closes.">
            {(id) => (
              <TextInput
                id={id}
                name="opsDeadline"
                type="number"
                min={1}
                inputMode="numeric"
                defaultValue={ballot?.opsDeadline ?? ""}
                placeholder="3"
              />
            )}
          </Field>
        )}
      </div>

      {!isEdit && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-signal-cyan">
              Options
            </span>
            <button
              type="button"
              onClick={addOption}
              disabled={options.length >= MAX_BALLOT_OPTIONS}
              className="flex items-center gap-1 font-[family-name:var(--font-chakra)] text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-signal-cyan transition-colors hover:text-case-file-white disabled:opacity-40"
            >
              <Plus size={13} aria-hidden="true" /> Add option
            </button>
          </div>

          {options.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <TextInput
                aria-label={`Option ${i + 1}`}
                value={label}
                onChange={(e) => updateOption(i, e.target.value)}
                maxLength={TEXT_LIMITS.ballotOptionLabel}
                placeholder={`Option ${i + 1}`}
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => removeOption(i)}
                disabled={options.length <= 2}
                aria-label={`Remove option ${i + 1}`}
                className="text-muted-ink transition-colors hover:text-stamp-red disabled:opacity-40"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          ))}

          <input type="hidden" name="options" value={JSON.stringify(options)} />
        </div>
      )}

      <FormMessage state={state} />
      <div>
        <SubmitButton isEdit={isEdit} />
      </div>
    </form>
  );
}
