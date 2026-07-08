import Link from "next/link";
import type { Metadata } from "next";
import { Crosshair, IdCard, MapPin } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Panel } from "@/components/ui/panel";
import { ButtonLink } from "@/components/ui/button";
import { StatusLabel } from "@/components/ui/status-dot";
import { requireUser } from "@/lib/auth";
import { getViewerCharacterState } from "@/lib/characters";
import { getMissionsForViewer } from "@/lib/mission-data";
import { MissionInterestButton } from "./mission-interest-button";

export const metadata: Metadata = { title: "Missions" };

const RISK_LABEL = { low: "Low", moderate: "Moderate", high: "High", severe: "Severe" } as const;

// Player-facing mission board (Phase 5). Admins have no character to claim
// against, so they get a read-only preview instead — same convention as
// requisitions/page.tsx.
export default async function MissionsPage() {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const viewer = isAdmin ? null : await getViewerCharacterState(user.id);

  if (!isAdmin && (!viewer || viewer.kind !== "approved")) {
    return (
      <AppShell>
        <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:py-8">
          <Header />
          <Panel>
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <Crosshair size={28} className="text-steel-blue" aria-hidden="true" />
              <p className="font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink">
                No character on file
              </p>
              <p className="max-w-sm text-pretty text-sm text-muted-ink">
                Submit an enlistment application first — approved operators can claim ops here.
              </p>
              <ButtonLink href="/apply">
                <IdCard size={15} /> Enlist now
              </ButtonLink>
            </div>
          </Panel>
        </div>
      </AppShell>
    );
  }

  const character = viewer?.kind === "approved" ? viewer.character : null;
  const missionList = await getMissionsForViewer();

  return (
    <AppShell>
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:py-8">
        <Header />

        {missionList.length === 0 ? (
          <EmptyMissions />
        ) : (
          <div className="flex flex-col gap-4">
            {missionList.map((mission) => {
              const ownRow = character
                ? mission.assignments.find((a) => a.characterId === character.id)
                : undefined;
              const state = ownRow?.state ?? "none";
              return (
                <Panel key={mission.id}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/missions/${mission.id}`}
                          className="font-[family-name:var(--font-chakra)] text-sm font-bold uppercase tracking-[0.04em] text-case-file-white transition-colors hover:text-signal-cyan"
                        >
                          {mission.title}
                        </Link>
                        {mission.urgent && mission.urgentDeadline != null && (
                          <StatusLabel tone="critical">
                            Urgent · {mission.urgentDeadline} op{mission.urgentDeadline === 1 ? "" : "s"} left
                          </StatusLabel>
                        )}
                      </div>
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-ink">
                        <MapPin size={11} aria-hidden="true" /> {mission.sector ?? "Unknown sector"} · Risk{" "}
                        {RISK_LABEL[mission.risk]}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="font-[family-name:var(--font-jetbrains)] text-sm text-signal-cyan">
                        {mission.payoutCredits}
                        <span className="ml-0.5 text-[0.625rem] text-muted-ink">CR</span>
                        <span className="mx-1 text-muted-ink">·</span>
                        {mission.payoutXp}
                        <span className="ml-0.5 text-[0.625rem] text-muted-ink">XP</span>
                      </span>
                      {isAdmin ? (
                        <span className="font-[family-name:var(--font-chakra)] text-[0.625rem] uppercase text-muted-ink">
                          Preview
                        </span>
                      ) : (
                        <MissionInterestButton
                          missionId={mission.id}
                          assignmentId={ownRow?.id ?? null}
                          state={state}
                        />
                      )}
                    </div>
                  </div>
                </Panel>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Header() {
  return (
    <div className="mb-6 border-b border-ledger-teal pb-5">
      <h1 className="font-[family-name:var(--font-rajdhani)] text-3xl font-bold uppercase leading-none tracking-[0.02em] text-case-file-white sm:text-4xl">
        Missions
      </h1>
      <p className="mt-2 max-w-prose text-sm text-muted-ink">
        Mark interest in an op — the DM confirms who&rsquo;s actually assigned.
      </p>
    </div>
  );
}

function EmptyMissions() {
  return (
    <Panel>
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <Crosshair size={28} className="text-steel-blue" aria-hidden="true" />
        <p className="font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink">
          No missions posted
        </p>
        <p className="max-w-sm text-pretty text-sm text-muted-ink">
          Check back once the DM posts one.
        </p>
      </div>
    </Panel>
  );
}
