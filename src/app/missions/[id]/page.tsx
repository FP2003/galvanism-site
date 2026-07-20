import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Crosshair } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { RegistryTerminalFrame } from "@/components/registry/registry-terminal-frame";
import { Panel } from "@/components/ui/panel";
import { StatusLabel } from "@/components/ui/status-dot";
import { Markdown } from "@/components/ui/markdown";
import {
  LocationTag,
  RiskTag,
  MissionStatusBadge,
  RISK_LABEL,
  STATUS_WORD,
} from "@/components/missions/mission-tags";
import { AttachmentGallery } from "@/components/missions/attachment-gallery";
import { requireUser } from "@/lib/auth";
import { getViewerCharacterState } from "@/lib/characters";
import { getMissionWithAttachments } from "@/lib/mission-data";
import { callsignsByState } from "@/lib/missions";
import { MissionInterestButton } from "../mission-interest-button";

export const metadata: Metadata = { title: "Mission Briefing" };

// Player-facing mission briefing detail (info/website_scope.md: "read mission
// briefing detail"), styled as the Registry's Data-Shard record view
// (DESIGN.md "Data-Shard Frame") for the descriptive header, briefing, and
// operator roster — all read-only record content. Photos and the interest
// button are workflow, not archival lore, so they stay in standard Ops
// Terminal panels below the frame. Same interest control as the list page.
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
      <div className="mx-auto max-w-[1500px] px-3 py-5 sm:px-6 sm:py-7 lg:py-9">
        <RegistryTerminalFrame
          variant="record"
          systemLabel="F.C.B. operations log"
          meta={STATUS_WORD[mission.status]}
          status={isAdmin ? "Preview" : "Operator"}
        >
          <div className="border-b border-elevated-ledger px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
            <Link
              href="/missions"
              className="inline-flex min-h-9 items-center gap-2 font-[family-name:var(--font-chakra)] text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted-ink transition-colors duration-150 hover:text-signal-cyan pointer-coarse:min-h-11"
            >
              <ArrowLeft size={14} aria-hidden="true" /> Return to mission board
            </Link>

            <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-4 sm:grid-cols-[3.5rem_minmax(0,1fr)] sm:gap-5">
                <div className="flex size-11 items-center justify-center border border-steel-blue bg-void-navy text-steel-blue sm:size-14">
                  <Crosshair size={22} />
                </div>

                <div className="min-w-0">
                  <p className="truncate font-[family-name:var(--font-jetbrains)] text-[0.625rem] uppercase tracking-[0.05em] text-muted-ink">
                    OPS://{mission.id.slice(0, 8).toUpperCase()}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <h1 className="break-words font-[family-name:var(--font-orbitron)] text-2xl font-semibold uppercase leading-tight tracking-[0.06em] text-case-file-white sm:text-3xl lg:text-4xl">
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
              </div>

              <div className="shrink-0 border border-elevated-ledger px-3 py-1.5 text-right">
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
          </div>

          <div className="grid lg:grid-cols-[13rem_minmax(0,1fr)]">
            <dl className="grid grid-cols-2 border-b border-elevated-ledger bg-void-navy sm:grid-cols-3 lg:grid-cols-1 lg:border-b-0 lg:border-r">
              <RecordField
                label="Status"
                value={STATUS_WORD[mission.status]}
                className="border-b border-r border-elevated-ledger sm:border-b-0 lg:border-b lg:border-r-0"
              />
              <RecordField
                label="Risk"
                value={RISK_LABEL[mission.risk]}
                className="border-b border-elevated-ledger sm:border-b-0 sm:border-r lg:border-b lg:border-r-0"
              />
              <RecordField
                label="Sector"
                value={mission.sector ?? "No sector"}
                className="col-span-2 sm:col-span-1"
              />
            </dl>

            <article className="min-w-0 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
              <header className="mb-5 flex items-center justify-between gap-4 border-b border-elevated-ledger pb-3">
                <h2 className="font-[family-name:var(--font-chakra)] text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-case-file-white">
                  Briefing
                </h2>
                <span className="font-[family-name:var(--font-jetbrains)] text-[0.5625rem] uppercase tracking-[0.05em] text-muted-ink">
                  Text record
                </span>
              </header>

              {mission.briefing ? (
                <Markdown className="max-w-[72ch] space-y-4 break-words font-[family-name:var(--font-orbitron)] text-sm leading-7 tracking-[0.02em] text-case-file-white [&_a]:text-signal-cyan [&_a]:transition-colors [&_a]:duration-150 [&_a:hover]:text-live-cyan">
                  {mission.briefing}
                </Markdown>
              ) : (
                <p className="font-[family-name:var(--font-inter)] text-sm leading-relaxed text-muted-ink">
                  No briefing on file.
                </p>
              )}

              {(interested.length > 0 || assigned.length > 0) && (
                <div className="mt-8 border-t border-elevated-ledger pt-6">
                  <header className="mb-4 flex items-center justify-between gap-4">
                    <h2 className="font-[family-name:var(--font-chakra)] text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-case-file-white">
                      Operators
                    </h2>
                    <span className="font-[family-name:var(--font-jetbrains)] text-[0.5625rem] uppercase tracking-[0.05em] text-muted-ink">
                      Personnel record
                    </span>
                  </header>
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
                </div>
              )}
            </article>
          </div>
        </RegistryTerminalFrame>

        <div className="mt-6 flex flex-col gap-6">
          {mission.attachments.length > 0 && (
            <Panel title="Photos">
              <AttachmentGallery attachments={mission.attachments} />
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
