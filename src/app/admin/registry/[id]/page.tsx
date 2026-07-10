import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, EyeOff } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Panel } from "@/components/ui/panel";
import { FormDialogTrigger } from "@/components/ui/form-dialog-trigger";
import { StatusLabel } from "@/components/ui/status-dot";
import { Markdown } from "@/components/ui/markdown";
import { RegistryTypeIcon } from "@/components/registry/registry-type-icon";
import { requireAdmin } from "@/lib/auth";
import { getRegistryEntry } from "@/lib/registry-data";
import { REGISTRY_TYPE_META } from "@/lib/registry";
import { RegistryEntryForm } from "../registry-entry-form";

export const metadata: Metadata = { title: "Registry Entry — Personnel Command" };

// Admin registry entry detail (Phase 8): full row incl. GM Notes, which
// never appears on the player-facing /registry/[slug] route (see
// lib/registry-data.ts's separate public query).
export default async function AdminRegistryEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const entry = await getRegistryEntry(id);
  if (!entry) notFound();

  return (
    <AppShell>
      <div className="mx-auto max-w-[1000px] px-4 py-6 sm:px-6 lg:py-8">
        <Link
          href="/admin/registry"
          className="mb-5 inline-flex items-center gap-2 font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink transition-colors hover:text-signal-cyan pointer-coarse:min-h-11"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Registry
        </Link>

        <div className="mb-6 flex flex-col gap-3 border-b border-ledger-teal pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <RegistryTypeIcon type={entry.type} size={20} className="text-steel-blue" />
              <h1 className="font-[family-name:var(--font-rajdhani)] text-3xl font-bold uppercase leading-none tracking-[0.02em] text-case-file-white break-words sm:text-4xl">
                {entry.name}
              </h1>
            </div>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-ink">
              <StatusLabel tone="neutral">{REGISTRY_TYPE_META[entry.type].label}</StatusLabel>
              {entry.visibility === "hidden" && (
                <StatusLabel tone="neutral">
                  <span className="inline-flex items-center gap-1">
                    <EyeOff size={10} aria-hidden="true" /> Hidden from players
                  </span>
                </StatusLabel>
              )}
            </p>
          </div>
          <FormDialogTrigger label="Edit" title={`Edit ${entry.name}`}>
            <RegistryEntryForm entry={entry} />
          </FormDialogTrigger>
        </div>

        <div className="flex flex-col gap-6">
          <Panel title="Description">
            {entry.description ? (
              <Markdown className="max-w-prose text-sm text-case-file-white">
                {entry.description}
              </Markdown>
            ) : (
              <p className="text-sm text-muted-ink">No description yet.</p>
            )}
          </Panel>

          <Panel title="GM Notes" meta={<StatusLabel tone="neutral">Admin only</StatusLabel>}>
            {entry.gmNotes ? (
              <Markdown className="max-w-prose text-sm text-case-file-white">
                {entry.gmNotes}
              </Markdown>
            ) : (
              <p className="text-sm text-muted-ink">No GM notes yet.</p>
            )}
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
