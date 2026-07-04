import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Panel } from "@/components/ui/panel";
import { Meter } from "@/components/ui/meter";
import { StatusLabel } from "@/components/ui/status-dot";
import { operators, type OperatorStatus } from "@/lib/mock-data";

export const metadata: Metadata = {
  title: "Personnel Roster",
};

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

export default function RosterPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:py-8">
        <div className="mb-6 border-b border-ledger-teal pb-5">
          <h1 className="font-[family-name:var(--font-rajdhani)] text-3xl font-bold uppercase leading-none tracking-[0.02em] text-case-file-white sm:text-4xl">
            Personnel Roster
          </h1>
          <p className="mt-2 text-sm text-muted-ink">
            {operators.length} operators assigned to Regiment Foxtrot. Select a
            file for the full personnel record.
          </p>
        </div>

        <Panel bodyClassName="p-0">
          <ul>
            {operators.map((op) => (
              <li key={op.slug}>
                <Link
                  href={`/roster/${op.slug}`}
                  className="group grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-2 border-b border-elevated-ledger px-5 py-4 transition-colors duration-150 last:border-b-0 hover:bg-elevated-ledger sm:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_auto_auto]"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center bg-void-navy font-[family-name:var(--font-chakra)] text-sm font-bold text-signal-cyan">
                    {op.callsign.slice(0, 2)}
                  </span>

                  <div className="min-w-0">
                    <span className="block truncate font-[family-name:var(--font-chakra)] text-sm font-bold uppercase tracking-[0.04em] text-case-file-white">
                      {op.callsign}
                    </span>
                    <span className="block truncate text-xs text-muted-ink">
                      {op.name} · {op.role}
                    </span>
                  </div>

                  <div className="hidden min-w-0 sm:block">
                    <div className="flex items-center gap-2">
                      <Meter
                        value={op.hp.current}
                        max={op.hp.max}
                        tone={
                          op.hp.current / op.hp.max <= 0.33 ? "critical" : "live"
                        }
                        className="max-w-28"
                      />
                      <span className="font-[family-name:var(--font-jetbrains)] text-[0.625rem] text-muted-ink">
                        {op.hp.current}/{op.hp.max}
                      </span>
                    </div>
                  </div>

                  <div className="hidden w-24 sm:block">
                    <StatusLabel tone={statusTone[op.status]}>
                      {statusWord[op.status]}
                    </StatusLabel>
                  </div>

                  <span className="flex items-center justify-end gap-2 font-[family-name:var(--font-jetbrains)] text-xs text-muted-ink">
                    LVL {op.level}
                    <ChevronRight
                      size={16}
                      className="text-steel-blue transition-colors group-hover:text-signal-cyan"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </AppShell>
  );
}
