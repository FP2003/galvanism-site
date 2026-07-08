"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import Image from "next/image";
import { Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { FormMessage } from "@/components/ui/form";
import { attachmentTiltDeg } from "@/lib/missions";
import { deleteMissionAttachment, type FormState } from "@/app/admin/mission-actions";

export interface GalleryAttachment {
  id: string;
  url: string;
}

/*
 * Mission briefing photo gallery (case-file aesthetic): tilted, flat-bordered
 * thumbnails that open a shared Dialog lightbox on click. One component for
 * both surfaces — `admin` just adds a delete control inside the lightbox,
 * not on the thumbnail (a rotated thumbnail fights an overlay button placed
 * on top of it; the lightbox is a bigger, non-rotated, easier target).
 */
export function AttachmentGallery({
  attachments,
  admin = false,
}: {
  attachments: GalleryAttachment[];
  admin?: boolean;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (attachments.length === 0) return null;

  const active = openIndex != null ? attachments[openIndex] : null;

  return (
    <>
      <div className="flex flex-wrap gap-4 py-2">
        {attachments.map((attachment, i) => (
          <button
            key={attachment.id}
            type="button"
            onClick={() => setOpenIndex(i)}
            aria-label={`Open photo ${i + 1} of ${attachments.length}`}
            style={{ transform: `rotate(${attachmentTiltDeg(attachment.id)}deg)` }}
            className="relative size-28 shrink-0 overflow-hidden border border-elevated-ledger bg-void-navy transition-transform hover:z-10 hover:rotate-0 hover:scale-105"
          >
            <Image src={attachment.url} alt="" fill sizes="112px" className="object-cover" />
          </button>
        ))}
      </div>

      <Dialog
        open={active != null}
        onClose={() => setOpenIndex(null)}
        title={active ? `Photo ${(openIndex ?? 0) + 1} of ${attachments.length}` : "Photo"}
      >
        {active && (
          <div className="flex flex-col gap-3">
            <div className="relative aspect-[4/3] w-full bg-void-navy">
              <Image src={active.url} alt="" fill sizes="600px" className="object-contain" />
            </div>
            {admin && <DeleteAttachmentButton attachmentId={active.id} onDeleted={() => setOpenIndex(null)} />}
          </div>
        )}
      </Dialog>
    </>
  );
}

function DeleteAttachmentButton({
  attachmentId,
  onDeleted,
}: {
  attachmentId: string;
  onDeleted: () => void;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(deleteMissionAttachment, {});

  useEffect(() => {
    if (state.ok) onDeleted();
  }, [state, onDeleted]);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="attachmentId" value={attachmentId} />
      <DeleteSubmit />
      <FormMessage state={state} />
    </form>
  );
}

function DeleteSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center gap-2 self-start border border-steel-blue px-4 py-2 font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink transition-colors hover:border-stamp-red hover:text-stamp-red disabled:opacity-60 pointer-coarse:min-h-11"
    >
      <Trash2 size={14} aria-hidden="true" />
      {pending ? "Removing…" : "Remove photo"}
    </button>
  );
}
