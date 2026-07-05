"use client";

import { useState, useTransition } from "react";
import { Pencil, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea, FormMessage } from "@/components/ui/form";
import { updateBio, type SheetState } from "@/app/roster/actions";

/*
 * Service-record (bio) view + owner/admin edit on the Case File (Phase 2).
 * Read-only prose by default; the owner reveals an inline editor. Non-owners
 * never see the edit affordance — the page only renders this in editable mode
 * for them. State transitions happen in the action callback (not an effect) so
 * the "close on success" reset stays out of render side effects.
 */
export function BioEditor({
  characterId,
  bio,
  canEdit,
}: {
  characterId: string;
  bio: string | null;
  canEdit: boolean;
}) {
  const [state, setState] = useState<SheetState>({});
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  function action(formData: FormData) {
    startTransition(async () => {
      try {
        const result = await updateBio({}, formData);
        setState(result);
        if (result.ok) setEditing(false);
      } catch {
        setState({
          error: "Couldn't reach the server. Check your connection and try again.",
        });
      }
    });
  }

  if (canEdit && editing) {
    return (
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="characterId" value={characterId} />
        <Textarea
          name="bio"
          rows={7}
          defaultValue={bio ?? ""}
          placeholder="Background, notable operations, disposition…"
        />
        <FormMessage state={state} />
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={pending}>
            <Save size={15} />
            {pending ? "Saving…" : "Save record"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => setEditing(false)}
          >
            <X size={15} />
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {bio ? (
        <p className="max-w-[68ch] text-pretty leading-relaxed text-case-file-white/90">
          {bio}
        </p>
      ) : (
        <p className="font-[family-name:var(--font-inter)] text-sm italic text-muted-ink">
          No service record on file.
        </p>
      )}
      {canEdit && (
        <div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setState({});
              setEditing(true);
            }}
          >
            <Pencil size={14} />
            {bio ? "Edit record" : "Add record"}
          </Button>
        </div>
      )}
    </div>
  );
}
