"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Crosshair } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { StatusLabel } from "@/components/ui/status-dot";
import { LocationTag, RiskTag, MissionStatusBadge } from "@/components/missions/mission-tags";
import {
  MissionStatusFilterChips,
  type MissionFilterBucket,
} from "@/components/missions/mission-status-filter";
import { missionBucket } from "@/lib/missions";
import type { Mission, MissionAssignment } from "@/lib/schema";
import { MissionInterestButton } from "./mission-interest-button";

type MissionRow = Mission & { assignments: MissionAssignment[] };

function countByBucket(missions: MissionRow[]): Record<MissionFilterBucket, number> {
  const counts: Record<MissionFilterBucket, number> = { all: missions.length, incomplete: 0, complete: 0, failed: 0 };
  for (const mission of missions) counts[missionBucket(mission.status)]++;
  return counts;
}

// Player mission list body — same filter-chip treatment as the admin list
// (mission-list.tsx there), defaulting to "incomplete" since that's what a
// player is actually here to act on; Complete/Failed are browsable history.
export function MissionList({
  missions,
  characterId,
  isAdmin,
}: {
  missions: MissionRow[];
  characterId: string | null;
  isAdmin: boolean;
}) {
  const [bucket, setBucket] = useState<MissionFilterBucket>("incomplete");

  const counts = useMemo(() => countByBucket(missions), [missions]);
  const filtered = useMemo(
    () => (bucket === "all" ? missions : missions.filter((m) => missionBucket(m.status) === bucket)),
    [missions, bucket],
  );

  return (
    <div className="flex flex-col gap-4">
      <MissionStatusFilterChips value={bucket} onChange={setBucket} counts={counts} />

      {filtered.length === 0 ? (
        <Panel>
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Crosshair size={28} className="text-steel-blue" aria-hidden="true" />
            <p className="font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink">
              No missions match
            </p>
            <p className="max-w-xs text-pretty text-xs text-muted-ink">Try a different filter.</p>
          </div>
        </Panel>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((mission) => {
            const ownRow = characterId
              ? mission.assignments.find((a) => a.characterId === characterId)
              : undefined;
            const state = ownRow?.state ?? "none";
            const canAct = mission.status === "available" || mission.status === "active";
            return (
              <Panel key={mission.id} className="group transition-colors hover:bg-elevated-ledger">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <Link
                    href={`/missions/${mission.id}`}
                    className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-[family-name:var(--font-chakra)] text-sm font-bold uppercase tracking-[0.04em] text-case-file-white transition-colors group-hover:text-signal-cyan">
                          {mission.title}
                        </span>
                        <MissionStatusBadge status={mission.status} />
                        {mission.urgent && mission.urgentDeadline != null && (
                          <StatusLabel tone="critical">
                            Urgent · {mission.urgentDeadline} op{mission.urgentDeadline === 1 ? "" : "s"} left
                          </StatusLabel>
                        )}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <LocationTag sector={mission.sector} />
                        <RiskTag risk={mission.risk} />
                      </div>
                    </div>
                    <span className="shrink-0 font-[family-name:var(--font-jetbrains)] text-sm text-signal-cyan">
                      {mission.payoutCredits}
                      <span className="ml-0.5 text-[0.625rem] text-muted-ink">CR</span>
                      <span className="mx-1 text-muted-ink">·</span>
                      {mission.payoutXp}
                      <span className="ml-0.5 text-[0.625rem] text-muted-ink">XP</span>
                    </span>
                  </Link>
                  <div className="flex shrink-0 items-center gap-3">
                    {isAdmin ? (
                      <span className="font-[family-name:var(--font-chakra)] text-[0.625rem] uppercase text-muted-ink">
                        Preview
                      </span>
                    ) : (
                      canAct && (
                        <MissionInterestButton
                          missionId={mission.id}
                          assignmentId={ownRow?.id ?? null}
                          state={state}
                        />
                      )
                    )}
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
