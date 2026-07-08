import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Panel } from "@/components/ui/panel";
import { StatusLabel } from "@/components/ui/status-dot";
import { Markdown } from "@/components/ui/markdown";
import { FormDialogTrigger } from "@/components/ui/form-dialog-trigger";
import { requireAdmin } from "@/lib/auth";
import { getMission, getEligibleAssignees } from "@/lib/mission-data";
import { MissionForm } from "../mission-form";
import { MissionAssignment } from "./mission-assignment";
import { CompleteMissionForm } from "./complete-mission-form";

export const metadata: Metadata = { title: "Mission — Personnel Command" };

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

// Admin mission detail (Phase 5): briefing, operator assignment, and the
// urgent-deadline / completion controls for one mission.
export default async function AdminMissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const mission = await getMission(id);
  if (!mission) notFound();

  const eligible = await getEligibleAssignees(id);
  const assignedCount = mission.assignments.filter((a) => a.state === "assigned").length;
  const resolved = mission.status === "complete" || mission.status === "failed";

  return (
    <AppShell>
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:py-8">
        <Link
          href="/admin/missions"
          className="mb-5 inline-flex items-center gap-2 font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink transition-colors hover:text-signal-cyan pointer-coarse:min-h-11"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Missions
        </Link>

        <div className="mb-6 flex flex-col gap-3 border-b border-ledger-teal pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-[family-name:var(--font-rajdhani)] text-3xl font-bold uppercase leading-none tracking-[0.02em] text-case-file-white break-words sm:text-4xl">
                {mission.title}
              </h1>
              <StatusLabel tone={STATUS_TONE[mission.status]}>{STATUS_WORD[mission.status]}</StatusLabel>
            </div>
            <p className="mt-2 max-w-prose text-sm text-muted-ink break-words">
              {mission.sector ?? "No sector"} · Risk {RISK_LABEL[mission.risk]}
            </p>
          </div>
          <FormDialogTrigger label="Edit" title="Edit Mission">
            <MissionForm mission={mission} />
          </FormDialogTrigger>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex flex-col gap-6">
            <Panel title="Briefing">
              {mission.briefing ? (
                <Markdown className="max-w-prose text-sm text-case-file-white">{mission.briefing}</Markdown>
              ) : (
                <p className="font-[family-name:var(--font-inter)] text-sm text-muted-ink">
                  No briefing written yet.
                </p>
              )}
            </Panel>

            <Panel title="Assignment">
              <MissionAssignment missionId={mission.id} eligible={eligible} assignments={mission.assignments} />
            </Panel>
          </div>

          <div className="flex flex-col gap-6">
            <Panel title="Status">
              <div className="flex flex-col gap-4">
                <dl className="flex flex-col gap-3">
                  <div className="flex items-baseline justify-between border-b border-elevated-ledger pb-3">
                    <dt className="font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">
                      Payout (total pot)
                    </dt>
                    <dd className="font-[family-name:var(--font-jetbrains)] text-sm text-signal-cyan">
                      {mission.payoutCredits} Cr · {mission.payoutXp} XP
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <dt className="font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">
                      Urgent
                    </dt>
                    <dd className="font-[family-name:var(--font-jetbrains)] text-sm text-case-file-white">
                      {mission.urgent && mission.urgentDeadline != null
                        ? `${mission.urgentDeadline} op${mission.urgentDeadline === 1 ? "" : "s"} left`
                        : "No"}
                    </dd>
                  </div>
                </dl>

                {resolved ? (
                  <p className="font-[family-name:var(--font-inter)] text-sm text-muted-ink">
                    This mission is {STATUS_WORD[mission.status].toLowerCase()}.
                  </p>
                ) : (
                  <CompleteMissionForm
                    missionId={mission.id}
                    payoutCredits={mission.payoutCredits}
                    payoutXp={mission.payoutXp}
                    assignedCount={assignedCount}
                  />
                )}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
