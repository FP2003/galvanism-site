import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Panel } from "@/components/ui/panel";
import { StatusLabel } from "@/components/ui/status-dot";
import { Markdown } from "@/components/ui/markdown";
import { LocationTag, RiskTag, MissionStatusBadge } from "@/components/missions/mission-tags";
import { AttachmentGallery } from "@/components/missions/attachment-gallery";
import { requireUser } from "@/lib/auth";
import { getViewerCharacterState } from "@/lib/characters";
import { getMissionWithAttachments } from "@/lib/mission-data";
import { callsignsByState } from "@/lib/missions";
import { MissionInterestButton } from "../mission-interest-button";

export const metadata: Metadata = { title: "Mission Briefing" };

// Player-facing mission briefing detail (info/website_scope.md: "read mission
// briefing detail"). Same interest control as the list page.
export default async function MissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const { id } = await params;

  const mission = await getMissionWithAttachments(id);
  if (!mission) notFound();

  const viewer = isAdmin ? null : await getViewerCharacterState(user.id);
  const character = viewer?.kind === "approved" ? viewer.character : null;
  const ownRow = character ? mission.assignments.find((a) => a.characterId === character.id) : undefined;
  const { interested, assigned } = callsignsByState(mission.assignments);

  return (
    <AppShell>
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:py-8">
        <Link
          href="/missions"
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
              <MissionStatusBadge status={mission.status} />
              {mission.urgent && mission.urgentDeadline != null && (
                <StatusLabel tone="critical">
                  Urgent · {mission.urgentDeadline} op{mission.urgentDeadline === 1 ? "" : "s"} left
                </StatusLabel>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <LocationTag sector={mission.sector} />
              <RiskTag risk={mission.risk} />
            </div>
          </div>
          <div className="shrink-0 border border-ledger-teal px-3 py-1.5 text-right">
            <span className="block font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">
              Payout
            </span>
            <span className="font-[family-name:var(--font-jetbrains)] text-xl text-signal-cyan">
              {mission.payoutCredits}
              <span className="ml-1 text-[0.625rem] uppercase text-muted-ink">Cr</span>
              <span className="mx-1.5 text-muted-ink">·</span>
              {mission.payoutXp}
              <span className="ml-1 text-[0.625rem] uppercase text-muted-ink">Xp</span>
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <Panel title="Briefing">
            {mission.briefing ? (
              <Markdown className="max-w-prose text-sm text-case-file-white">{mission.briefing}</Markdown>
            ) : (
              <p className="font-[family-name:var(--font-inter)] text-sm text-muted-ink">
                No briefing on file.
              </p>
            )}
          </Panel>

          {mission.attachments.length > 0 && (
            <Panel title="Photos">
              <AttachmentGallery attachments={mission.attachments} />
            </Panel>
          )}

          {(interested.length > 0 || assigned.length > 0) && (
            <Panel title="Interested Operators">
              <div className="flex flex-col gap-3">
                {assigned.length > 0 && (
                  <p className="text-sm text-case-file-white">
                    <span className="font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">
                      Assigned:{" "}
                    </span>
                    {assigned.join(", ")}
                  </p>
                )}
                {interested.length > 0 && (
                  <p className="text-sm text-case-file-white">
                    <span className="font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">
                      Interested:{" "}
                    </span>
                    {interested.join(", ")}
                  </p>
                )}
              </div>
            </Panel>
          )}

          {!isAdmin && character && (mission.status === "available" || mission.status === "active") && (
            <Panel title="Your Standing">
              <MissionInterestButton
                missionId={mission.id}
                assignmentId={ownRow?.id ?? null}
                state={ownRow?.state ?? "none"}
              />
            </Panel>
          )}
        </div>
      </div>
    </AppShell>
  );
}
