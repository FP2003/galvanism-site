"use client";

import { useRef, useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Pencil, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea, FormMessage } from "@/components/ui/form";
import { Markdown } from "@/components/ui/markdown";
import { Panel } from "@/components/ui/panel";
import { RegistryLinkPicker } from "@/components/registry/registry-link-picker";
import { updateBio, type SheetState } from "@/app/roster/actions";

/*
 * Service-record (bio) view + owner/admin edit on the Case File (Phase 2).
 * Read-only prose by default; the owner reveals an inline editor. Non-owners
 * never see the edit affordance — the page only renders this in editable mode
 * for them. State transitions happen in the action callback (not an effect) so
 * the "close on success" reset stays out of render side effects.
 */
// Bio is free-form Markdown, so "first 5 lines" is measured on the raw
// newline-delimited source rather than rendered output.
const COLLAPSED_LINES = 5;

function firstLines(text: string, n: number): { head: string; hasMore: boolean } {
  const lines = text.split("\n");
  if (lines.length <= n) return { head: text, hasMore: false };
  return { head: lines.slice(0, n).join("\n"), hasMore: true };
}

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
  const [collapsed, setCollapsed] = useState(false);
  const [pending, startTransition] = useTransition();
  const bioRef = useRef<HTMLTextAreaElement>(null);

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

  const { head, hasMore } = bio ? firstLines(bio, COLLAPSED_LINES) : { head: "", hasMore: false };
  const isEditing = canEdit && editing;

  return (
    <Panel
      title="Service Record"
      meta={
        !isEditing &&
        hasMore && (
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="flex items-center gap-1 font-[family-name:var(--font-jetbrains)] text-[0.6875rem] uppercase tracking-[0.06em] text-signal-cyan hover:text-live-cyan"
          >
            {collapsed ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronUp size={13} aria-hidden="true" />}
            {collapsed ? "Show full record" : "Collapse"}
          </button>
        )
      }
    >
      {isEditing ? (
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="characterId" value={characterId} />
          <Textarea
            ref={bioRef}
            name="bio"
            rows={7}
            defaultValue={bio ?? ""}
            placeholder="Background, notable operations, disposition…"
          />
          <p className="font-[family-name:var(--font-inter)] text-[0.6875rem] text-muted-ink">
            Supports Markdown: **bold**, *italic*, and &apos;- &apos; for bullet lists.
          </p>
          <div>
            <RegistryLinkPicker textareaRef={bioRef} />
          </div>
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
      ) : (
        <div className="flex flex-col gap-3">
          {bio ? (
            <Markdown className="max-w-[68ch] text-pretty leading-relaxed text-case-file-white/90">
              {collapsed ? head : bio}
            </Markdown>
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
      )}
    </Panel>
  );
}
