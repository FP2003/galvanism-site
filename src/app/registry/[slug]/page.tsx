import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Panel } from "@/components/ui/panel";
import { StatusLabel } from "@/components/ui/status-dot";
import { Markdown } from "@/components/ui/markdown";
import { RegistryTypeIcon } from "@/components/registry/registry-type-icon";
import { requireUser } from "@/lib/auth";
import { getPublicRegistryEntryBySlug } from "@/lib/registry-data";
import { REGISTRY_TYPE_META } from "@/lib/registry";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entry = await getPublicRegistryEntryBySlug(slug);
  return { title: entry ? `${entry.name} — Registry` : "Registry" };
}

// Player-facing registry entry detail (Phase 8). getPublicRegistryEntryBySlug
// returns undefined for a missing OR hidden entry — either way this 404s,
// same handling either way so a hidden entry's existence isn't distinguishable
// from a typo'd slug. gmNotes is structurally absent from that query, not
// merely unrendered here.
export default async function RegistryEntryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireUser();
  const { slug } = await params;
  const entry = await getPublicRegistryEntryBySlug(slug);
  if (!entry) notFound();

  return (
    <AppShell>
      <div className="mx-auto max-w-[1000px] px-4 py-6 sm:px-6 lg:py-8">
        <Link
          href="/registry"
          className="mb-5 inline-flex items-center gap-2 font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink transition-colors hover:text-signal-cyan pointer-coarse:min-h-11"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Registry
        </Link>

        <div className="mb-6 flex items-center gap-3 border-b border-ledger-teal pb-5">
          <RegistryTypeIcon type={entry.type} size={22} className="text-steel-blue" />
          <div className="min-w-0">
            <h1 className="font-[family-name:var(--font-rajdhani)] text-3xl font-bold uppercase leading-none tracking-[0.02em] text-case-file-white break-words sm:text-4xl">
              {entry.name}
            </h1>
            <div className="mt-2">
              <StatusLabel tone="neutral">{REGISTRY_TYPE_META[entry.type].label}</StatusLabel>
            </div>
          </div>
        </div>

        <Panel title="Description">
          {entry.description ? (
            <Markdown className="max-w-prose text-sm text-case-file-white">
              {entry.description}
            </Markdown>
          ) : (
            <p className="text-sm text-muted-ink">Nothing on record.</p>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
