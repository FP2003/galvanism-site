import Link from "next/link";
import { ChevronRight, MapPin } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { Meter } from "@/components/ui/meter";
import { StatusLabel } from "@/components/ui/status-dot";
import { BallotTally } from "@/components/ballot-tally";
import { regiment } from "@/lib/mock-data";
import type { BallotOptionTally } from "@/lib/ballots";
import { statusTone, statusWord, type CharacterStatus } from "@/lib/status";

// The subset of a character the dashboard renders, satisfied by the live
// CharacterView.
export interface DashboardOperator {
  callsign: string;
  slug: string;
  role: string | null;
  rank: string | null;
  status: CharacterStatus;
  hp: { current: number; max: number };
  energy: { current: number; max: number };
}

const riskLabel = {
  low: "LOW",
  moderate: "MOD",
  high: "HIGH",
  severe: "SEV",
} as const;

// The subset of a mission the dashboard renders. Field names match the real
// `missions` DB row (src/lib/schema.ts) — satisfied by both a live query and
// the mock fixtures (lib/mock-data.ts), same convention as DashboardOperator.
export interface DashboardMission {
  id: string;
  title: string;
  sector: string | null;
  risk: "low" | "moderate" | "high" | "severe";
  payoutCredits: number;
  payoutXp: number;
  status: "available" | "active" | "complete" | "failed";
  urgent: boolean;
  urgentDeadline: number | null;
}

// The subset of a facility ongoing entry the dashboard renders — `facility`
// is the joined facility name, `label` is the whole hand-typed status string
// (e.g. "Ammo Resupply: 2 days"), matching the real `facility_ongoing_entries`
// row (src/lib/schema.ts) shape returned by getUnresolvedOngoingEntries.
export interface DashboardFacilityProcess {
  facilityId: string;
  facility: string;
  label: string;
}

// A facility's next level-up, once it's received at least one perk
// contribution — matches getFacilityUpgradesInProgress (lib/facility-data.ts).
export interface DashboardFacilityUpgrade {
  facilityId: string;
  facilityName: string;
  level: number;
  totalCost: number;
  totalContributed: number;
  fundedCount: number;
  perkCount: number;
}

// The subset of a ballot the dashboard renders — already tallied, matching
// lib/ballots.ts's tallyVotes output, so a live query+tally and the mock
// fixture (lib/mock-data.ts) satisfy this shape without a mapping step, same
// convention as DashboardMission.
export interface DashboardBallot {
  id: string;
  title: string;
  opsDeadline: number | null;
  totalVotes: number;
  results: BallotOptionTally[];
}

/*
 * The Ops Terminal overview. Presentational — the caller supplies `operators`
 * (live roster), `missions` (live non-terminal missions), `facilityProcesses`
 * (live unresolved Ongoing entries), and `ballots` (live open ballots,
 * soonest-to-close first).
 */
export function CommandDashboard({
  operators,
  missions,
  facilityProcesses,
  facilityUpgrades,
  ballots,
}: {
  operators: DashboardOperator[];
  missions: DashboardMission[];
  facilityProcesses: DashboardFacilityProcess[];
  facilityUpgrades: DashboardFacilityUpgrade[];
  ballots: DashboardBallot[];
}) {
  const activeCount = operators.filter((o) => o.status === "active").length;

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:py-8">
      {/* Page header — Ops Terminal title block */}
      <div className="mb-6 flex flex-col gap-3 border-b border-ledger-teal pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-rajdhani)] text-3xl font-bold uppercase leading-none tracking-[0.02em] text-case-file-white sm:text-4xl">
            Regiment Status
          </h1>
          <p className="mt-2 max-w-prose text-sm text-muted-ink">
            {regiment.station}
          </p>
        </div>
        <div className="flex items-center gap-6">
          <Readout
            label="Operators"
            value={`${activeCount}/${operators.length}`}
            suffix="ACTIVE"
          />
          <Readout
            label="Open Ops"
            value={String(missions.filter((m) => m.status !== "complete" && m.status !== "failed").length)}
            suffix="LOGGED"
          />
          <Readout label="Sector" value="S.F." suffix="ZONE 4" />
        </div>
      </div>

      {/* Row A: Personnel + Active Operations */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Panel
            title="Personnel"
            className="h-full"
            meta={
              <span className="font-[family-name:var(--font-jetbrains)] text-xs text-muted-ink">
                {operators.length} ASSIGNED
              </span>
            }
            bodyClassName="p-0"
          >
            {operators.length === 0 && (
              <p className="px-5 py-8 text-center font-[family-name:var(--font-inter)] text-sm text-muted-ink">
                No operators assigned yet.
              </p>
            )}
            <ul>
              {operators.map((op) => {
                const rowInner = (
                  <>
                    <span className="flex size-9 shrink-0 items-center justify-center bg-void-navy font-[family-name:var(--font-chakra)] text-xs font-bold text-signal-cyan">
                      {op.callsign.slice(0, 2)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="shrink-0 font-[family-name:var(--font-chakra)] text-sm font-bold uppercase tracking-[0.04em] text-case-file-white">
                          {op.callsign}
                        </span>
                        <span className="truncate text-xs text-muted-ink">
                          {[op.role, op.rank].filter(Boolean).join(" · ") || "—"}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-3">
                        <div className="flex max-w-40 flex-1 items-center gap-2">
                          <Meter
                            value={op.hp.current}
                            max={op.hp.max}
                            label={`HP ${op.hp.current}/${op.hp.max}`}
                            tone={
                              op.hp.max > 0 && op.hp.current / op.hp.max <= 0.33
                                ? "critical"
                                : "live"
                            }
                            className="max-w-20"
                          />
                          <span className="shrink-0 font-[family-name:var(--font-jetbrains)] text-[0.625rem] text-muted-ink">
                            HP {op.hp.current}/{op.hp.max}
                          </span>
                        </div>
                        <div className="flex max-w-40 flex-1 items-center gap-2">
                          <Meter
                            value={op.energy.current}
                            max={op.energy.max}
                            label={`Energy ${op.energy.current}/${op.energy.max}`}
                            tone="steel"
                            className="max-w-20"
                          />
                          <span className="shrink-0 font-[family-name:var(--font-jetbrains)] text-[0.625rem] text-muted-ink">
                            EN {op.energy.current}/{op.energy.max}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="hidden w-20 shrink-0 sm:block">
                      <StatusLabel tone={statusTone[op.status]}>
                        {statusWord[op.status]}
                      </StatusLabel>
                    </div>
                    <span className="flex shrink-0 items-center font-[family-name:var(--font-jetbrains)] text-xs text-muted-ink">
                      <ChevronRight
                        size={16}
                        className="text-muted-ink transition-colors group-hover:text-signal-cyan"
                        aria-hidden="true"
                      />
                    </span>
                  </>
                );
                return (
                  <li key={op.slug}>
                    <Link
                      href={`/roster/${op.slug}`}
                      className="group flex items-center gap-4 border-b border-elevated-ledger px-5 py-3.5 transition-colors duration-150 last:border-b-0 hover:bg-elevated-ledger"
                    >
                      {rowInner}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>

        <div className="lg:col-span-5">
          {/* Active operations */}
          <Panel title="Active Operations" className="h-full" bodyClassName="p-0">
            {missions.length === 0 && (
              <p className="px-5 py-8 text-center font-[family-name:var(--font-inter)] text-sm text-muted-ink">
                No open operations.
              </p>
            )}
            <ul>
              {missions.map((m) => (
                <li
                  key={m.id}
                  className="border-b border-elevated-ledger px-5 py-3.5 last:border-b-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {m.urgent && m.urgentDeadline != null && (
                        <span className="bg-stamp-red px-1.5 py-0.5 font-[family-name:var(--font-chakra)] text-[0.5625rem] font-bold uppercase tracking-[0.08em] text-case-file-white">
                          Urgent · {m.urgentDeadline} ops left
                        </span>
                      )}
                      <p className="mt-1 truncate font-[family-name:var(--font-chakra)] text-sm font-semibold text-case-file-white">
                        {m.title}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-ink">
                        <MapPin size={11} aria-hidden="true" /> {m.sector ?? "Unknown sector"} · Risk{" "}
                        {riskLabel[m.risk]}
                      </p>
                    </div>
                    <span className="shrink-0 font-[family-name:var(--font-jetbrains)] text-sm text-signal-cyan">
                      {m.payoutCredits}
                      <span className="ml-0.5 text-[0.625rem] text-muted-ink">CR</span>
                      <span className="mx-1 text-muted-ink">·</span>
                      {m.payoutXp}
                      <span className="ml-0.5 text-[0.625rem] text-muted-ink">XP</span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      {/* Row B: Facility processes + Open ballot + Station readout */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-12">
        {/* Facility processes — the "Ongoing" readout, plus any in-progress
            perk-funded level-ups underneath */}
        <div className="lg:col-span-4">
          <Panel title="Facility Processes" className="h-full" bodyClassName="p-0">
            {facilityProcesses.length === 0 && facilityUpgrades.length === 0 ? (
              <p className="px-5 py-8 text-center font-[family-name:var(--font-inter)] text-sm text-muted-ink">
                No ongoing processes.
              </p>
            ) : (
              <ul>
                {facilityProcesses.map((p, i) => (
                  <li key={`${p.facilityId}-${i}`}>
                    <Link
                      href={`/facilities/${p.facilityId}`}
                      className="group flex items-center gap-3 border-b border-elevated-ledger px-5 py-3 transition-colors duration-150 hover:bg-elevated-ledger"
                    >
                      <div className="min-w-0 flex-1">
                        <StatusLabel tone="live" pulse>
                          Ongoing
                        </StatusLabel>
                        <p className="mt-1 truncate text-sm text-case-file-white">
                          <span className="text-muted-ink">{p.facility}:</span>{" "}
                          {p.label}
                        </p>
                      </div>
                      <ChevronRight
                        size={16}
                        className="shrink-0 text-muted-ink transition-colors group-hover:text-signal-cyan"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
                {facilityUpgrades.map((u) => (
                  <li key={u.facilityId}>
                    <Link
                      href={`/facilities/${u.facilityId}`}
                      className="group flex items-center gap-3 border-b border-elevated-ledger px-5 py-3 transition-colors duration-150 last:border-b-0 hover:bg-elevated-ledger"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <StatusLabel tone="neutral">Upgrading</StatusLabel>
                          <span className="shrink-0 font-[family-name:var(--font-jetbrains)] text-[0.625rem] text-muted-ink">
                            {u.fundedCount}/{u.perkCount} perks
                          </span>
                        </div>
                        <p className="mt-1 truncate text-sm text-case-file-white">
                          <span className="text-muted-ink">{u.facilityName}:</span> Level{" "}
                          {u.level + 1}
                        </p>
                        <Meter
                          value={u.totalContributed}
                          max={u.totalCost}
                          tone="live"
                          className="mt-1.5"
                          label={`${u.facilityName} progress toward Level ${u.level + 1}: ${u.totalContributed} of ${u.totalCost} Cr`}
                        />
                      </div>
                      <ChevronRight
                        size={16}
                        className="shrink-0 text-muted-ink transition-colors group-hover:text-signal-cyan"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="lg:col-span-4">
          <Panel
            title="Open Ballot"
            className="h-full"
            meta={
              ballots.length > 0 && (
                <StatusLabel tone="live" pulse>
                  Voting Open
                </StatusLabel>
              )
            }
          >
            {ballots.length === 0 ? (
              <p className="py-8 text-center font-[family-name:var(--font-inter)] text-sm text-muted-ink">
                No open ballots.
              </p>
            ) : (
              <>
                <p className="font-[family-name:var(--font-chakra)] text-sm font-semibold text-case-file-white">
                  {ballots[0].title}
                </p>
                <div className="mt-4">
                  <BallotTally totalVotes={ballots[0].totalVotes} results={ballots[0].results} />
                </div>
                <p className="mt-4 border-t border-elevated-ledger pt-3 text-xs text-muted-ink">
                  {ballots[0].opsDeadline != null
                    ? `Closes in ${ballots[0].opsDeadline} op${ballots[0].opsDeadline === 1 ? "" : "s"}`
                    : "No deadline, closed manually"}
                </p>
                {ballots.length > 1 && (
                  <Link
                    href="/ballots"
                    className="mt-2 flex items-center gap-1 font-[family-name:var(--font-chakra)] text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-signal-cyan transition-colors hover:text-live-cyan"
                  >
                    +{ballots.length - 1} more ballot{ballots.length - 1 === 1 ? "" : "s"} open
                    <ChevronRight size={13} aria-hidden="true" />
                  </Link>
                )}
              </>
            )}
          </Panel>
        </div>

        <div className="lg:col-span-4">
          <Panel title="Station Info" className="h-full">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
              <ReadoutRow label="Designation" value={regiment.designation} />
              <ReadoutRow label="Sector" value={regiment.sector} />
              <ReadoutRow label="Station" value="Precinct 19" />
              <ReadoutRow label="Rebuild" value="In progress" tone="live" />
              <ReadoutRow label="Threat Level" value="Elevated" tone="critical" />
              <ReadoutRow label="Motto" value="Order, at any cost" />
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Readout({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">
        {label}
      </span>
      <span className="font-[family-name:var(--font-jetbrains)] text-xl leading-tight text-signal-cyan">
        {value}
      </span>
      <span className="font-[family-name:var(--font-jetbrains)] text-[0.5625rem] uppercase text-muted-ink">
        {suffix}
      </span>
    </div>
  );
}

function ReadoutRow({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "live" | "critical";
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">
        {label}
      </dt>
      {tone === "critical" ? (
        // Filled stamp — red text on teal would fail contrast (DESIGN.md §2)
        <dd>
          <span className="inline-block bg-stamp-red px-1.5 py-0.5 font-[family-name:var(--font-jetbrains)] text-xs text-case-file-white">
            {value}
          </span>
        </dd>
      ) : (
        <dd
          className={`font-[family-name:var(--font-jetbrains)] text-sm ${
            tone === "live" ? "text-signal-cyan" : "text-case-file-white"
          }`}
        >
          {value}
        </dd>
      )}
    </div>
  );
}
