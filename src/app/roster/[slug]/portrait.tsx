"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { upload } from "@vercel/blob/client";
import Image from "next/image";
import { Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FileInput, FormMessage } from "@/components/ui/form";
import { PortraitFrame } from "@/components/ui/portrait-frame";
import { MAX_PORTRAIT_BYTES } from "@/lib/game-rules";
import { savePortraitUrl, deletePortrait, type SheetState } from "@/app/roster/actions";

const MAX_PORTRAIT_MB = MAX_PORTRAIT_BYTES / (1024 * 1024);

/*
 * Case-file identity avatar: a spinning HeroForge mini GIF (or callsign
 * initials, unset). Clicking opens a bigger view; owner/admin get an upload/
 * replace/remove form in the same dialog. `unoptimized` on every <Image> here
 * is load-bearing — Next's image optimizer re-encodes and freezes GIF
 * animation otherwise, defeating the whole point of a spinning mini.
 */
export function Portrait({
  characterId,
  callsign,
  portraitUrl,
  canEdit,
}: {
  characterId: string;
  callsign: string;
  portraitUrl: string | null;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const clickable = portraitUrl != null || canEdit;

  const frame = (
    <PortraitFrame
      size="size-24"
      portraitUrl={portraitUrl}
      imageSizes="96px"
      fallback={
        <span className="font-[family-name:var(--font-rajdhani)] text-3xl font-bold text-signal-cyan">
          {callsign.slice(0, 2)}
        </span>
      }
    />
  );

  return (
    <>
      {clickable ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={portraitUrl ? "View portrait" : "Add portrait"}
          className="block shrink-0"
        >
          {frame}
        </button>
      ) : (
        frame
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title={`${callsign} · Portrait`}>
        <div className="flex flex-col gap-4">
          {portraitUrl && (
            <div className="relative aspect-square w-full bg-void-navy">
              <Image src={portraitUrl} alt="" fill unoptimized sizes="480px" className="object-contain" />
            </div>
          )}
          {canEdit && (
            <>
              <PortraitUploadForm characterId={characterId} hasPortrait={portraitUrl != null} />
              {portraitUrl && (
                <DeletePortraitButton characterId={characterId} onDeleted={() => setOpen(false)} />
              )}
            </>
          )}
        </div>
      </Dialog>
    </>
  );
}

// Uploads go straight from the browser to Blob storage (bypassing our
// server for the file bytes — see api/portrait-upload/route.ts), so this
// can't be a plain <form action={serverAction}> the way the other case-file
// forms are: the client has to call upload() and await its result before
// there's a URL worth persisting.
function PortraitUploadForm({
  characterId,
  hasPortrait,
}: {
  characterId: string;
  hasPortrait: boolean;
}) {
  const [state, setState] = useState<SheetState>({});
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setState({ error: "Pick a GIF to upload." });
      return;
    }
    setPending(true);
    setState({});
    try {
      const blob = await upload(`characters/${characterId}/${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/portrait-upload",
        clientPayload: JSON.stringify({ characterId }),
      });
      const result = await savePortraitUrl(characterId, blob.url);
      setState(result);
      if (result.ok) formRef.current?.reset();
    } catch (err) {
      setState({
        error: err instanceof Error ? err.message : "Upload failed. Check your connection and try again.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Field
        label={hasPortrait ? "Replace portrait" : "Add portrait"}
        hint={`Animated GIF only, up to ${MAX_PORTRAIT_MB}MB.`}
      >
        {(id) => <FileInput ref={inputRef} id={id} name="photo" accept="image/gif" required />}
      </Field>
      <FormMessage state={state} />
      <div>
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          <Upload size={15} />
          {pending ? "Uploading…" : hasPortrait ? "Replace portrait" : "Add portrait"}
        </Button>
      </div>
    </form>
  );
}

function DeletePortraitButton({
  characterId,
  onDeleted,
}: {
  characterId: string;
  onDeleted: () => void;
}) {
  const [state, formAction] = useActionState<SheetState, FormData>(deletePortrait, {});

  useEffect(() => {
    if (state.ok) onDeleted();
  }, [state, onDeleted]);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="characterId" value={characterId} />
      <DeleteSubmit />
      <FormMessage state={state} />
    </form>
  );
}

function DeleteSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" disabled={pending} className="w-full sm:w-auto">
      <Trash2 size={14} aria-hidden="true" />
      {pending ? "Removing…" : "Remove portrait"}
    </Button>
  );
}
