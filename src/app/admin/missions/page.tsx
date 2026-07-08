import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Crosshair, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Panel } from "@/components/ui/panel";
import { StatusLabel } from "@/components/ui/status-dot";
import { requireAdmin } from "@/lib/auth";
import { getMissions } from "@/lib/mission-data";
import { NewMissionDialog } from "./new-mission-dialog";
import { MissionMenu } from "./mission-menu";

export const metadata: Metadata = { title: "Missions — Personnel Command" };

const RISK_LABEL = { low: "Low", moderate: "Moderate", high: "High", severe: "Severe" } as const;
const STATUS_TONE = {
  available: "neutral",
  active: "live",
  complete: "live",
  failed: "critical",
} as const;
const STATUS_WORD = {
  available: "Available",
  active: "Active",
  complete: "Complete",
  failed: "Failed",
} as const;

// Admin mission list (info/roadmap.md Phase 5). Each row links to the
// mission's detail page for assignment management and completion.
export default async function AdminMissionsPage() {
  await requireAdmin();
  const missionList = await getMissions();

  return (
    <AppShell>
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:py-8">
        <Link
          href="/admin"
          className="mb-5 inline-flex items-center gap-2 font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink transition-colors hover:text-signal-cyan pointer-coarse:min-h-11"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Personnel Command
        </Link>

        <div className="mb-6 border-b border-ledger-teal pb-5">
          <h1 className="font-[family-name:var(--font-rajdhani)] text-3xl font-bold uppercase leading-none tracking-[0.02em] text-case-file-white sm:text-4xl">
            Missions
          </h1>
          <p className="mt-2 max-w-prose text-sm text-muted-ink">
            Post ops, review operator interest, and complete missions to post their payout.
          </p>
        </div>

        <Panel
          title="All Missions"
          meta={
            <div className="flex items-center gap-3">
              <span className="font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.06em] text-muted-ink">
                {missionList.length} mission{missionList.length === 1 ? "" : "s"}
              </span>
              <NewMissionDialog />
            </div>
          }
          bodyClassName={missionList.length === 0 ? undefined : "p-0"}
        >
          {missionList.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <Crosshair size={28} className="text-steel-blue" aria-hidden="true" />
              <p className="font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink">
                No missions yet
              </p>
              <p className="max-w-xs text-pretty text-xs text-muted-ink">
                Use New Mission above to post the first one.
              </p>
            </div>
          ) : (
            <ul>
              {missionList.map((mission) => {
                const assignedCount = mission.assignments.filter((a) => a.state === "assigned").length;
                const interestedCount = mission.assignments.filter((a) => a.state === "interested").length;
                return (
                  <li
                    key={mission.id}
                    className="group flex items-center gap-4 border-b border-elevated-ledger px-5 py-4 transition-colors last:border-b-0 hover:bg-elevated-ledger"
                  >
                    <Link
                      href={`/admin/missions/${mission.id}`}
                      className="flex min-w-0 flex-1 items-center gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-[family-name:var(--font-chakra)] text-sm font-bold uppercase tracking-[0.04em] text-case-file-white">
                            {mission.title}
                          </span>
                          <StatusLabel tone={STATUS_TONE[mission.status]}>
                            {STATUS_WORD[mission.status]}
                          </StatusLabel>
                          {mission.urgent && mission.urgentDeadline != null && (
                            <StatusLabel tone="critical">
                              Urgent · {mission.urgentDeadline} op{mission.urgentDeadline === 1 ? "" : "s"} left
                            </StatusLabel>
                          )}
                        </div>
                        <p className="mt-1 font-[family-name:var(--font-jetbrains)] text-[0.6875rem] text-muted-ink">
                          {mission.sector ?? "No sector"} · Risk {RISK_LABEL[mission.risk]} ·{" "}
                          {mission.payoutCredits} Cr · {mission.payoutXp} XP · {assignedCount} assigned,{" "}
                          {interestedCount} interested
                        </p>
                      </div>
                      <ChevronRight
                        size={16}
                        className="shrink-0 text-steel-blue transition-colors group-hover:text-signal-cyan"
                        aria-hidden="true"
                      />
                    </Link>
                    <MissionMenu mission={mission} />
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
