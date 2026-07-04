import Link from "next/link";
import { ChevronRight, MapPin } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { Meter } from "@/components/ui/meter";
import { StatusLabel } from "@/components/ui/status-dot";
import {
  operators,
  missions,
  facilityProcesses,
  openBallot,
  regiment,
  type OperatorStatus,
} from "@/lib/mock-data";

const statusTone: Record<OperatorStatus, "live" | "critical" | "neutral"> = {
  active: "live",
  standby: "neutral",
  injured: "critical",
  kia: "critical",
};

const statusWord: Record<OperatorStatus, string> = {
  active: "Active",
  standby: "Standby",
  injured: "Injured",
  kia: "K.I.A.",
};

const riskLabel = {
  low: "LOW",
  moderate: "MOD",
  high: "HIGH",
  severe: "SEV",
} as const;

/*
 * The Ops Terminal overview. Presentational — renders the sample fixtures today
 * (converted to live data in Phase 2). Shared by the authenticated `/` command
 * page and the public `/preview`. When `linkOperators` is false (preview mode),
 * operator rows are static so they don't lead into auth-gated case files.
 */
export function CommandDashboard({
  linkOperators = true,
}: {
  linkOperators?: boolean;
}) {
  const activeCount = operators.filter((o) => o.status === "active").length;
  const totalVotes = openBallot.options.reduce((n, o) => n + o.votes, 0);

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
            value={String(missions.filter((m) => m.status !== "complete").length)}
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
                          {op.role} · {op.rank}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Meter
                          value={op.hp.current}
                          max={op.hp.max}
                          tone={
                            op.hp.current / op.hp.max <= 0.33 ? "critical" : "live"
                          }
                          className="max-w-32"
                        />
                        <span className="font-[family-name:var(--font-jetbrains)] text-[0.625rem] text-muted-ink">
                          HP {op.hp.current}/{op.hp.max}
                        </span>
                      </div>
                    </div>
                    <div className="hidden w-20 shrink-0 sm:block">
                      <StatusLabel tone={statusTone[op.status]}>
                        {statusWord[op.status]}
                      </StatusLabel>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 font-[family-name:var(--font-jetbrains)] text-xs text-muted-ink">
                      LVL {op.level}
                      {linkOperators && (
                        <ChevronRight
                          size={16}
                          className="text-steel-blue transition-colors group-hover:text-signal-cyan"
                          aria-hidden="true"
                        />
                      )}
                    </span>
                  </>
                );
                return (
                  <li key={op.slug}>
                    {linkOperators ? (
                      <Link
                        href={`/roster/${op.slug}`}
                        className="group flex items-center gap-4 border-b border-elevated-ledger px-5 py-3.5 transition-colors duration-150 last:border-b-0 hover:bg-elevated-ledger"
                      >
                        {rowInner}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-4 border-b border-elevated-ledger px-5 py-3.5 last:border-b-0">
                        {rowInner}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>

        <div className="lg:col-span-5">
          {/* Active operations */}
          <Panel title="Active Operations" className="h-full" bodyClassName="p-0">
            <ul>
              {missions.map((m) => (
                <li
                  key={m.code}
                  className="border-b border-elevated-ledger px-5 py-3.5 last:border-b-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-[family-name:var(--font-jetbrains)] text-[0.625rem] text-muted-ink">
                          {m.code}
                        </span>
                        {m.urgent && (
                          <span className="bg-stamp-red px-1.5 py-0.5 font-[family-name:var(--font-chakra)] text-[0.5625rem] font-bold uppercase tracking-[0.08em] text-case-file-white">
                            Urgent · {m.deadline} ops left
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate font-[family-name:var(--font-chakra)] text-sm font-semibold text-case-file-white">
                        {m.title}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-ink">
                        <MapPin size={11} aria-hidden="true" /> {m.sector} · Risk{" "}
                        {riskLabel[m.risk]}
                      </p>
                    </div>
                    <span className="shrink-0 font-[family-name:var(--font-jetbrains)] text-sm text-signal-cyan">
                      {m.payout}
                      <span className="ml-0.5 text-[0.625rem] text-muted-ink">
                        CR
                      </span>
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
        {/* Facility processes — the "Ongoing" readout */}
        <div className="lg:col-span-4">
          <Panel title="Facility Processes" className="h-full" bodyClassName="p-0">
            <ul>
              {facilityProcesses.map((p) => (
                <li
                  key={`${p.facility}-${p.label}`}
                  className="flex items-center justify-between gap-3 border-b border-elevated-ledger px-5 py-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <StatusLabel tone="live" pulse>
                      Ongoing
                    </StatusLabel>
                    <p className="mt-1 truncate text-sm text-case-file-white">
                      <span className="text-muted-ink">{p.facility} —</span>{" "}
                      {p.label}
                    </p>
                  </div>
                  <span className="shrink-0 font-[family-name:var(--font-jetbrains)] text-xs text-muted-ink">
                    {p.remaining}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="lg:col-span-4">
          <Panel
            title="Open Ballot"
            className="h-full"
            meta={
              <StatusLabel tone="live" pulse>
                Voting Open
              </StatusLabel>
            }
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-[family-name:var(--font-chakra)] text-sm font-semibold text-case-file-white">
                {openBallot.title}
              </p>
              <span className="shrink-0 font-[family-name:var(--font-jetbrains)] text-xs text-muted-ink">
                {openBallot.code}
              </span>
            </div>
            <ul className="mt-4 flex flex-col gap-3">
              {openBallot.options.map((opt) => (
                <li key={opt.label}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-case-file-white">
                      {opt.label}
                    </span>
                    <span className="shrink-0 font-[family-name:var(--font-jetbrains)] text-xs text-muted-ink">
                      {opt.votes} / {totalVotes}
                    </span>
                  </div>
                  <Meter
                    value={opt.votes}
                    max={totalVotes || 1}
                    tone="steel"
                    className="mt-1.5"
                  />
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-elevated-ledger pt-3 text-xs text-muted-ink">
              {openBallot.closes}
            </p>
          </Panel>
        </div>

        <div className="lg:col-span-4">
          <Panel title="Station Readout" className="h-full">
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
