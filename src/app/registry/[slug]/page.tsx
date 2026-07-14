import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { RegistryTerminalFrame } from "@/components/registry/registry-terminal-frame";
import { RegistryTypeIcon } from "@/components/registry/registry-type-icon";
import { Markdown } from "@/components/ui/markdown";
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
  return { title: entry ? `${entry.name} · Registry` : "Registry" };
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
      <div className="mx-auto max-w-[1100px] px-3 py-5 sm:px-6 sm:py-7 lg:py-9">
        <RegistryTerminalFrame
          variant="record"
          systemLabel="F.C.B. public archive"
          meta={REGISTRY_TYPE_META[entry.type].label}
          status="Read only"
        >
          <div className="border-b border-elevated-ledger px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
            <Link
              href="/registry"
              className="inline-flex min-h-9 items-center gap-2 font-[family-name:var(--font-chakra)] text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted-ink transition-colors duration-150 hover:text-signal-cyan pointer-coarse:min-h-11"
            >
              <ArrowLeft size={14} aria-hidden="true" /> Return to registry index
            </Link>

            <div className="mt-5 grid grid-cols-[2.75rem_minmax(0,1fr)] gap-4 sm:grid-cols-[3.5rem_minmax(0,1fr)] sm:gap-5">
              <div className="flex size-11 items-center justify-center border border-steel-blue bg-void-navy text-steel-blue sm:size-14">
                <RegistryTypeIcon type={entry.type} size={22} />
              </div>

              <div className="min-w-0">
                <p className="truncate font-[family-name:var(--font-jetbrains)] text-[0.625rem] uppercase tracking-[0.05em] text-muted-ink">
                  REG://{entry.slug}
                </p>
                <h1 className="mt-2 break-words font-[family-name:var(--font-orbitron)] text-2xl font-semibold uppercase leading-tight tracking-[0.06em] text-case-file-white sm:text-3xl lg:text-4xl">
                  {entry.name}
                </h1>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-[13rem_minmax(0,1fr)]">
            <dl className="grid grid-cols-2 border-b border-elevated-ledger bg-void-navy sm:grid-cols-3 lg:grid-cols-1 lg:border-b-0 lg:border-r">
              <RecordField
                label="Record class"
                value={REGISTRY_TYPE_META[entry.type].label}
                className="border-b border-r border-elevated-ledger sm:border-b-0 lg:border-b lg:border-r-0"
              />
              <RecordField
                label="Access level"
                value="Public"
                className="border-b border-elevated-ledger sm:border-b-0 sm:border-r lg:border-b lg:border-r-0"
              />
              <RecordField
                label="Protocol"
                value="Read only"
                className="col-span-2 sm:col-span-1"
              />
            </dl>

            <article className="min-w-0 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
              <header className="mb-5 flex items-center justify-between gap-4 border-b border-elevated-ledger pb-3">
                <h2 className="font-[family-name:var(--font-chakra)] text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-case-file-white">
                  Archive content
                </h2>
                <span className="font-[family-name:var(--font-jetbrains)] text-[0.5625rem] uppercase tracking-[0.05em] text-muted-ink">
                  Text record
                </span>
              </header>

              {entry.description?.trim() ? (
                <Markdown className="max-w-[72ch] space-y-4 break-words font-[family-name:var(--font-orbitron)] text-sm leading-7 tracking-[0.02em] text-case-file-white [&_a]:text-signal-cyan [&_a]:transition-colors [&_a]:duration-150 [&_a:hover]:text-live-cyan">
                  {entry.description}
                </Markdown>
              ) : (
                <p className="font-[family-name:var(--font-inter)] text-sm leading-relaxed text-muted-ink">
                  Nothing on record.
                </p>
              )}
            </article>
          </div>
        </RegistryTerminalFrame>
      </div>
    </AppShell>
  );
}

function RecordField({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`px-4 py-4 ${className}`}>
      <dt className="font-[family-name:var(--font-chakra)] text-[0.5625rem] font-semibold uppercase tracking-[0.12em] text-muted-ink">
        {label}
      </dt>
      <dd className="mt-1.5 font-[family-name:var(--font-jetbrains)] text-[0.6875rem] uppercase tracking-[0.05em] text-case-file-white">
        {value}
      </dd>
    </div>
  );
}
