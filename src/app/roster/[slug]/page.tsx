import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Shield, Zap, Crosshair, Layers, Activity, Clock } from "lucide-react";
import { eq, desc } from "drizzle-orm";
import { AppShell } from "@/components/shell/app-shell";
import { Panel } from "@/components/ui/panel";
import { Meter } from "@/components/ui/meter";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { goldLedger } from "@/lib/schema";
import { getCharacterBySlug } from "@/lib/characters";
import { regiment } from "@/lib/mock-data";
import {
  stampStyle,
  stampWord,
  combatStats,
  passiveStats,
} from "@/lib/status";
import { BioEditor } from "./bio-editor";
import { ResourceTracker } from "./resource-tracker";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const detail = await getCharacterBySlug(slug);
  return {
    title: detail
      ? `OPR. ${detail.view.callsign} — Personnel File`
      : "Personnel File",
  };
}

export default async function CaseFilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [detail, viewer] = await Promise.all([
    getCharacterBySlug(slug),
    getCurrentUser(),
  ]);
  if (!detail) notFound();

  const op = detail.view;
  const canEdit =
    viewer?.id === detail.ownerUserId || viewer?.role === "admin";

  // A pending application is visible only to its owner and the DM.
  if (!op.approved && !canEdit) notFound();

  const db = getDb();
  const ledger = await db.query.goldLedger.findMany({
    where: eq(goldLedger.playerId, op.playerId),
    orderBy: [desc(goldLedger.createdAt)],
    limit: 50,
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
        <Link
          href="/roster"
          className="mb-5 inline-flex items-center gap-2 font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink transition-colors hover:text-signal-cyan pointer-coarse:min-h-11"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Personnel
        </Link>

        {!op.approved && (
          <div className="mb-3 flex items-center gap-2 border border-signal-cyan/40 bg-signal-cyan/10 px-4 py-2.5 font-[family-name:var(--font-inter)] text-[0.8125rem] text-muted-ink">
            <Clock size={15} className="shrink-0 text-signal-cyan" aria-hidden="true" />
            {viewer?.role === "admin"
              ? "This application is awaiting your review in Personnel Command."
              : "Your application is awaiting DM approval. You'll join the roster once it's approved."}
          </div>
        )}

        {/* Classification banner */}
        <div className="flex items-center justify-between gap-3 border border-ledger-teal bg-ledger-teal px-4 py-2">
          <span className="font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted-ink sm:text-xs">
            Personnel File · {regiment.designation}
          </span>
          <span className="font-[family-name:var(--font-jetbrains)] text-[0.625rem] uppercase text-muted-ink sm:text-xs">
            FILE OPR-{op.slug.toUpperCase().slice(0, 4)}
          </span>
        </div>

        {/* Identity band */}
        <div className="mt-3 flex flex-col gap-5 bg-ledger-teal p-5 sm:flex-row sm:items-center sm:p-6">
          <div
            className="flex size-24 shrink-0 items-center justify-center border-2 border-steel-blue bg-void-navy"
            style={{
              clipPath:
                "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)",
            }}
          >
            <span className="font-[family-name:var(--font-rajdhani)] text-3xl font-bold text-signal-cyan">
              {op.callsign.slice(0, 2)}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="font-[family-name:var(--font-rajdhani)] text-4xl font-bold uppercase leading-none tracking-[0.02em] text-case-file-white break-words">
              {op.callsign}
            </h1>
            <p className="mt-1.5 text-sm text-muted-ink break-words">
              {op.name}
              {op.rank ? ` · ${op.rank}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 font-[family-name:var(--font-jetbrains)] text-xs text-muted-ink">
              <span>
                ROLE{" "}
                <span className="text-case-file-white">{op.role ?? "—"}</span>
              </span>
              <span>
                LEVEL <span className="text-case-file-white">{op.level}</span>
              </span>
              <span>
                XP <span className="text-case-file-white">{op.xp}</span>
              </span>
              <span>
                CREDITS <span className="text-signal-cyan">{op.gold}</span>
              </span>
            </div>
          </div>

          <div className="shrink-0 self-start sm:self-center">
            <span
              className={`inline-block -rotate-3 border-2 border-current px-3 py-1.5 font-[family-name:var(--font-chakra)] text-sm font-bold uppercase tracking-[0.08em] ${stampStyle[op.status]}`}
            >
              {stampWord[op.status]}
            </span>
          </div>
        </div>

        {/* Detail grid */}
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
          {/* Left column: resources + attributes */}
          <div className="flex flex-col gap-3">
            <Panel title="Resources">
              {canEdit ? (
                <ResourceTracker
                  characterId={op.id}
                  hp={op.hp}
                  energy={op.energy}
                  ammo={op.ammo}
                />
              ) : (
                <div className="flex flex-col gap-4">
                  <ResourceRow
                    icon={<Shield size={14} aria-hidden="true" />}
                    label="Health"
                    value={op.hp}
                    tone={
                      op.hp.max > 0 && op.hp.current / op.hp.max <= 0.33
                        ? "critical"
                        : "live"
                    }
                  />
                  <ResourceRow
                    icon={<Zap size={14} aria-hidden="true" />}
                    label="Energy"
                    value={op.energy}
                    tone="steel"
                  />
                  <ResourceRow
                    icon={<Crosshair size={14} aria-hidden="true" />}
                    label="Ammo"
                    value={op.ammo}
                    tone="steel"
                  />
                </div>
              )}
              <div className="mt-4 flex items-center justify-between border-t border-elevated-ledger pt-3">
                <span className="flex items-center gap-2 font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink">
                  <Activity size={14} className="text-steel-blue" aria-hidden="true" />
                  Energy Regen
                </span>
                <span className="font-[family-name:var(--font-jetbrains)] text-sm text-signal-cyan">
                  +{op.energyRegen}
                  <span className="text-muted-ink"> / turn</span>
                </span>
              </div>
            </Panel>

            <Panel title="Attributes">
              <StatGroup heading="Combat">
                {combatStats.map((s) => (
                  <StatRow
                    key={s.key}
                    label={s.label}
                    note={s.note}
                    value={String(op.stats[s.key])}
                  />
                ))}
              </StatGroup>
              <div className="my-4 border-t border-elevated-ledger" />
              <StatGroup heading="Passive">
                {passiveStats.map((s) => (
                  <StatRow
                    key={s.key}
                    label={s.label}
                    note={s.note}
                    value={`${op.stats[s.key]}${"suffix" in s ? s.suffix : ""}`}
                  />
                ))}
              </StatGroup>
            </Panel>
          </div>

          {/* Right column: biography + ledger */}
          <div className="flex flex-col gap-3 lg:col-span-2">
            <Panel title="Service Record">
              <BioEditor characterId={op.id} bio={op.bio} canEdit={canEdit} />
            </Panel>

            <Panel
              title="Credit Ledger"
              meta={
                <span className="font-[family-name:var(--font-jetbrains)] text-xs text-muted-ink">
                  BAL <span className="text-signal-cyan">{op.gold}</span>
                </span>
              }
              bodyClassName="p-0"
            >
              {ledger.length === 0 ? (
                <p className="px-5 py-8 text-center font-[family-name:var(--font-inter)] text-sm text-muted-ink">
                  No credit movement recorded yet.
                </p>
              ) : (
                <div className="overflow-x-auto bg-void-navy">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-elevated-ledger text-left font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-muted-ink">
                      <th scope="col" className="px-5 py-2 font-semibold">Entry</th>
                      <th scope="col" className="px-5 py-2 font-semibold">Ref</th>
                      <th scope="col" className="px-5 py-2 text-right font-semibold">Δ Cr</th>
                    </tr>
                  </thead>
                  <tbody className="font-[family-name:var(--font-jetbrains)] text-xs">
                    {ledger.map((e) => (
                      <tr
                        key={e.id}
                        className="border-b border-elevated-ledger last:border-b-0"
                      >
                        <td className="px-5 py-2.5 font-[family-name:var(--font-inter)] text-sm text-case-file-white">
                          {e.description}
                        </td>
                        <td className="whitespace-nowrap px-5 py-2.5 text-muted-ink">
                          {e.refCode ?? "—"}
                        </td>
                        <td
                          className={`whitespace-nowrap px-5 py-2.5 text-right ${
                            e.delta >= 0 ? "text-signal-cyan" : "text-stamp-red"
                          }`}
                        >
                          {e.delta >= 0 ? "+" : ""}
                          {e.delta}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </Panel>

            <Panel
              title="Loadout"
              meta={
                <span className="font-[family-name:var(--font-jetbrains)] text-[0.625rem] uppercase text-muted-ink">
                  Phase 3
                </span>
              }
            >
              <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                <Layers
                  size={28}
                  className="text-steel-blue"
                  aria-hidden="true"
                />
                <p className="font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink">
                  No cards or weapons assigned
                </p>
                <p className="max-w-xs text-pretty text-xs text-muted-ink">
                  Ability cards, weapons, and item loadout come online with the
                  card system.
                </p>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ResourceRow({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: { current: number; max: number };
  tone: "live" | "critical" | "steel";
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink">
          <span className="text-steel-blue">{icon}</span>
          {label}
        </span>
        <span className="font-[family-name:var(--font-jetbrains)] text-sm text-case-file-white">
          {value.current}
          <span className="text-muted-ink">/{value.max}</span>
        </span>
      </div>
      <Meter value={value.current} max={value.max} tone={tone} label={`${label} ${value.current}/${value.max}`} />
    </div>
  );
}

function StatGroup({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2.5 font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-signal-cyan">
        {heading}
      </h3>
      <dl className="flex flex-col gap-2.5">{children}</dl>
    </div>
  );
}

function StatRow({
  label,
  note,
  value,
}: {
  label: string;
  note: string;
  value: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="min-w-0">
        <dt className="font-[family-name:var(--font-chakra)] text-sm font-semibold uppercase tracking-[0.04em] text-case-file-white">
          {label}
        </dt>
        <dd className="truncate text-xs text-muted-ink">{note}</dd>
      </div>
      <span className="shrink-0 font-[family-name:var(--font-jetbrains)] text-lg text-signal-cyan">
        {value}
      </span>
    </div>
  );
}
