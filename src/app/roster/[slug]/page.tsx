import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Shield, Zap, Crosshair, Activity, Clock, Sparkles } from "lucide-react";
import { eq, desc } from "drizzle-orm";
import { AppShell } from "@/components/shell/app-shell";
import { Panel } from "@/components/ui/panel";
import { Markdown } from "@/components/ui/markdown";
import { Meter } from "@/components/ui/meter";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { creditLedger, xpLedger } from "@/lib/schema";
import { HistoryTable, type HistoryRow } from "@/components/ledger/history-table";
import { getCharacterBySlug } from "@/lib/characters";
import { getCharacterCards, computeLoadout } from "@/lib/card-data";
import { CARD_CATEGORY_META } from "@/lib/cards";
import { regiment } from "@/lib/mock-data";
import {
  stampStyle,
  stampWord,
  combatStats,
  passiveStats,
} from "@/lib/status";
import { BioEditor } from "./bio-editor";
import { ResourceTracker } from "./resource-tracker";
import { Loadout } from "./loadout";
import { Portrait } from "./portrait";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const detail = await getCharacterBySlug(slug);
  return {
    title: detail
      ? `OPR. ${detail.view.callsign} · Personnel File`
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
  const [ledger, xpHistory, ownedCards] = await Promise.all([
    db.query.creditLedger.findMany({
      where: eq(creditLedger.playerId, op.playerId),
      orderBy: [desc(creditLedger.createdAt)],
      limit: 50,
    }),
    db.query.xpLedger.findMany({
      where: eq(xpLedger.characterId, op.id),
      orderBy: [desc(xpLedger.createdAt)],
      limit: 50,
    }),
    getCharacterCards(op.id),
  ]);

  // Merge credit + XP into one chronological feed (mirrors the admin console's
  // player page) so the operator sees everything that happened to them in one
  // scan instead of hunting for XP grants elsewhere.
  const history: HistoryRow[] = [
    ...ledger.map((e) => ({
      id: `credit:${e.id}`,
      type: "credit" as const,
      createdAt: e.createdAt,
      description: e.description,
      refCode: e.refCode,
      delta: e.delta,
      after: `${e.balanceAfter.toLocaleString()} Cr`,
    })),
    ...xpHistory.map((e) => ({
      id: `xp:${e.id}`,
      type: "xp" as const,
      createdAt: e.createdAt,
      description: e.description,
      refCode: e.refCode,
      delta: e.delta,
      after: `${e.currencyXpAfter.toLocaleString()} XP`,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 50);

  // Effective sheet = base stats + equipped card modifiers (computed, never
  // written back — see lib/card-data). Cards on a pending, non-owner-visible
  // sheet are already gated by the approval check above.
  const loadout = computeLoadout(op, ownedCards);

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
          <Portrait
            characterId={op.id}
            callsign={op.callsign}
            portraitUrl={op.portraitUrl}
            canEdit={canEdit}
          />

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
                XP{" "}
                <span className="text-case-file-white">{op.currencyXp}</span>
              </span>
              <span>
                CREDITS <span className="text-signal-cyan">{op.credits}</span>
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
                  hp={loadout.resources.hp}
                  energy={loadout.resources.energy}
                  ammo={loadout.resources.ammo}
                  energyRegen={op.energyRegen}
                />
              ) : (
                <div className="flex flex-col gap-4">
                  <ResourceRow
                    icon={<Shield size={14} aria-hidden="true" />}
                    label="Health"
                    value={loadout.resources.hp}
                    tone={
                      loadout.resources.hp.max > 0 &&
                      loadout.resources.hp.current / loadout.resources.hp.max <= 0.33
                        ? "critical"
                        : "live"
                    }
                  />
                  <ResourceRow
                    icon={<Zap size={14} aria-hidden="true" />}
                    label="Energy"
                    value={loadout.resources.energy}
                    tone="steel"
                  />
                  <ResourceRow
                    icon={<Crosshair size={14} aria-hidden="true" />}
                    label="Ammo"
                    value={loadout.resources.ammo}
                    tone="steel"
                  />
                  <div className="flex items-center justify-between border-t border-elevated-ledger pt-3">
                    <span className="flex items-center gap-2 font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink">
                      <Activity size={14} className="text-steel-blue" aria-hidden="true" />
                      Energy Regen
                    </span>
                    <span className="font-[family-name:var(--font-jetbrains)] text-sm text-signal-cyan">
                      +{op.energyRegen}
                      <span className="text-muted-ink"> / turn</span>
                    </span>
                  </div>
                </div>
              )}
            </Panel>

            <Panel
              title="Attributes"
              meta={
                loadout.equipped.length > 0 ? (
                  <span className="font-[family-name:var(--font-jetbrains)] text-[0.625rem] uppercase text-signal-cyan">
                    Card-adjusted
                  </span>
                ) : undefined
              }
            >
              <StatGroup heading="Combat">
                {combatStats.map((s) => (
                  <StatRow
                    key={s.key}
                    label={s.label}
                    note={s.note}
                    base={op.stats[s.key]}
                    delta={loadout.statDeltas[s.key]}
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
                    base={op.stats[s.key]}
                    delta={loadout.statDeltas[s.key]}
                    suffix={"suffix" in s ? s.suffix : ""}
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

            {(loadout.activeModifiers.length > 0 ||
              loadout.descriptiveEffects.length > 0) && (
              <Panel
                title="Effects"
                meta={
                  <span className="flex items-center gap-1.5 font-[family-name:var(--font-jetbrains)] text-[0.625rem] uppercase text-signal-cyan">
                    <Sparkles size={12} aria-hidden="true" /> Equipped
                  </span>
                }
              >
                <div className="flex flex-col gap-4">
                  {loadout.activeModifiers.length > 0 && (
                    <ul className="flex flex-col gap-2">
                      {loadout.activeModifiers.map((m, i) => (
                        <li
                          key={`mod-${i}`}
                          className="flex items-center gap-3"
                        >
                          <span className="size-2.5 shrink-0 bg-steel-blue" aria-hidden="true" />
                          <span className="min-w-0 flex-1 truncate font-[family-name:var(--font-inter)] text-sm text-case-file-white">
                            {m.cardTitle}
                          </span>
                          <span className="shrink-0 font-[family-name:var(--font-jetbrains)] text-sm text-signal-cyan">
                            {m.summary}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {loadout.descriptiveEffects.map((e, i) => (
                    <div key={`desc-${i}`} className="bg-void-navy p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.06em] text-case-file-white">
                          {e.cardTitle}
                        </p>
                        <span className="shrink-0 font-[family-name:var(--font-chakra)] text-[0.5625rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">
                          {CARD_CATEGORY_META[e.category].label}
                        </span>
                      </div>
                      <Markdown className="mt-1 text-pretty font-[family-name:var(--font-inter)] text-[0.8125rem] text-muted-ink">
                        {e.text}
                      </Markdown>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            <Panel
              title="Loadout"
              meta={
                <span className="font-[family-name:var(--font-jetbrains)] text-[0.625rem] uppercase text-muted-ink">
                  {loadout.equipped.length} equipped
                </span>
              }
            >
              <Loadout
                characterId={op.id}
                owned={loadout.owned}
                canEdit={canEdit}
              />
            </Panel>

            <Panel title="History" bodyClassName="p-0">
              <HistoryTable rows={history} />
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
  base,
  delta,
  suffix = "",
}: {
  label: string;
  note: string;
  base: number;
  delta: number;
  suffix?: string;
}) {
  const effective = Math.max(0, base + delta);
  const modified = delta !== 0;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="min-w-0">
        <dt className="font-[family-name:var(--font-chakra)] text-sm font-semibold uppercase tracking-[0.04em] text-case-file-white">
          {label}
        </dt>
        <dd className="truncate text-xs text-muted-ink">{note}</dd>
      </div>
      <div className="flex shrink-0 items-baseline gap-2">
        {modified && (
          <span className="font-[family-name:var(--font-jetbrains)] text-[0.625rem] text-muted-ink">
            {base}
            {suffix}
            <span className={delta > 0 ? "text-signal-cyan" : "text-stamp-red"}>
              {" "}
              {delta > 0 ? "+" : "−"}
              {Math.abs(delta)}
            </span>
          </span>
        )}
        <span className="font-[family-name:var(--font-jetbrains)] text-lg text-signal-cyan">
          {effective}
          {suffix}
        </span>
      </div>
    </div>
  );
}
