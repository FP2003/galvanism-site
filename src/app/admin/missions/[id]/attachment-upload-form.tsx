"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FileInput, FormMessage } from "@/components/ui/form";
import { MAX_ATTACHMENT_BYTES } from "@/lib/game-rules";
import { uploadMissionAttachment, type FormState } from "@/app/admin/mission-actions";

const MAX_ATTACHMENT_MB = MAX_ATTACHMENT_BYTES / (1024 * 1024);

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      <Upload size={15} />
      {pending ? "Uploading…" : "Add photo"}
    </Button>
  );
}

// Single-file upload, submitted one at a time — Vercel's platform-level
// request-body ceiling (4.5MB, unaffected by next.config) makes batching
// several full-resolution phone photos into one submit a real, badly
// surfaced failure mode. The admin just clicks "Add photo" a few times.
export function AttachmentUploadForm({
  missionId,
  remainingSlots,
}: {
  missionId: string;
  remainingSlots: number;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(uploadMissionAttachment, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  if (remainingSlots <= 0) {
    return (
      <p className="font-[family-name:var(--font-inter)] text-sm text-muted-ink">
        This mission has reached the photo limit. Remove one to add another.
      </p>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="missionId" value={missionId} />
      <Field
        label="Add photo"
        hint={`${remainingSlots} slot${remainingSlots === 1 ? "" : "s"} remaining. PNG, JPEG, WebP, or GIF, up to ${MAX_ATTACHMENT_MB}MB.`}
      >
        {(id) => <FileInput id={id} name="photo" accept="image/png,image/jpeg,image/webp,image/gif" required />}
      </Field>
      <FormMessage state={state} />
      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
