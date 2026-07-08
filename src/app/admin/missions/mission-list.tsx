"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Crosshair } from "lucide-react";
import { LocationTag, RiskTag, MissionStatusBadge } from "@/components/missions/mission-tags";
import { StatusLabel } from "@/components/ui/status-dot";
import {
  MissionStatusFilterChips,
  type MissionFilterBucket,
} from "@/components/missions/mission-status-filter";
import { missionBucket } from "@/lib/missions";
import type { Mission, MissionAssignment } from "@/lib/schema";
import { MissionMenu } from "./mission-menu";

type MissionRow = Mission & { assignments: MissionAssignment[] };

function countByBucket(missions: MissionRow[]): Record<MissionFilterBucket, number> {
  const counts: Record<MissionFilterBucket, number> = { all: missions.length, incomplete: 0, complete: 0, failed: 0 };
  for (const mission of missions) counts[missionBucket(mission.status)]++;
  return counts;
}

// Admin mission list body — filter chips + rows, extracted from page.tsx so
// the (small) full mission list can be filtered client-side, mirroring
// CardLibrary's convention for the card deck.
export function MissionList({ missions }: { missions: MissionRow[] }) {
  const [bucket, setBucket] = useState<MissionFilterBucket>("all");

  const counts = useMemo(() => countByBucket(missions), [missions]);
  const filtered = useMemo(
    () => (bucket === "all" ? missions : missions.filter((m) => missionBucket(m.status) === bucket)),
    [missions, bucket],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="px-5 pt-5">
        <MissionStatusFilterChips value={bucket} onChange={setBucket} counts={counts} />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-5 py-12 text-center">
          <Crosshair size={28} className="text-steel-blue" aria-hidden="true" />
          <p className="font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink">
            No missions match
          </p>
          <p className="max-w-xs text-pretty text-xs text-muted-ink">Try a different filter.</p>
        </div>
      ) : (
        <ul>
          {filtered.map((mission) => {
            const assignedCount = mission.assignments.filter((a) => a.state === "assigned").length;
            const interestedCount = mission.assignments.filter((a) => a.state === "interested").length;
            return (
              <li
                key={mission.id}
                className="group flex items-center gap-4 border-b border-elevated-ledger px-5 py-4 transition-colors last:border-b-0 hover:bg-elevated-ledger"
              >
                <Link href={`/admin/missions/${mission.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-[family-name:var(--font-chakra)] text-sm font-bold uppercase tracking-[0.04em] text-case-file-white">
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
                    <p className="mt-1.5 font-[family-name:var(--font-jetbrains)] text-[0.6875rem] text-muted-ink">
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
    </div>
  );
}
