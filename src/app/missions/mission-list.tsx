"use client";

import { useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Crosshair, ChevronRight, RotateCcw, Search, X } from "lucide-react";
import styles from "@/components/registry/registry-terminal.module.css";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/form";
import { StatusLabel } from "@/components/ui/status-dot";
import { LocationTag, RiskTag, MissionStatusBadge } from "@/components/missions/mission-tags";
import {
  MissionStatusFilterChips,
  type MissionFilterBucket,
} from "@/components/missions/mission-status-filter";
import { missionBucket, callsignsByState, briefingPreview } from "@/lib/missions";
import type { Mission, MissionAssignment } from "@/lib/schema";
import { MissionInterestButton } from "./mission-interest-button";

type MissionRow = Mission & {
  assignments: (MissionAssignment & { character: { callsign: string } })[];
};

function countByBucket(missions: MissionRow[]): Record<MissionFilterBucket, number> {
  const counts: Record<MissionFilterBucket, number> = { all: missions.length, incomplete: 0, complete: 0, failed: 0 };
  for (const mission of missions) counts[missionBucket(mission.status)]++;
  return counts;
}

// Player mission list body — restyled to match the Registry's Data-Shard
// list treatment (DESIGN.md "Data-Shard Frame"): Orbitron titles/previews,
// an ordinal + icon-box lead-in, the READY/INSERT MODE query indicator, and
// a single divided list — since briefings link into /registry/slug and the
// two boards are meant to read as one system now. Defaults to "incomplete"
// since that's what a player is actually here to act on; Complete/Failed
// are browsable history.
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
  const [query, setQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchId = useId();
  const searchInput = useRef<HTMLInputElement>(null);

  const counts = useMemo(() => countByBucket(missions), [missions]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return missions.filter(
      (m) =>
        (bucket === "all" || missionBucket(m.status) === bucket) &&
        (q === "" || m.title.toLowerCase().includes(q)),
    );
  }, [missions, bucket, query]);

  const ordinalById = useMemo(() => new Map(missions.map((m, index) => [m.id, index + 1])), [missions]);

  function clearQuery() {
    setQuery("");
    searchInput.current?.focus();
  }

  function resetBoard() {
    setQuery("");
    setBucket("all");
  }

  return (
    <div>
      <div className="grid gap-px bg-elevated-ledger lg:grid-cols-[minmax(0,1fr)_13rem]">
        <div className="bg-ledger-teal p-4 sm:p-5">
          <div className="mb-2 flex items-center justify-between gap-4">
            <label
              htmlFor={searchId}
              className="font-[family-name:var(--font-chakra)] text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-case-file-white"
            >
              Mission query
            </label>
            <span className="font-[family-name:var(--font-jetbrains)] text-[0.5625rem] uppercase tracking-[0.06em] text-muted-ink">
              Title index
            </span>
          </div>

          <div className="relative">
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-ink"
            />
            <TextInput
              ref={searchInput}
              id={searchId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              placeholder="Query mission titles…"
              aria-label="Search missions by title"
              className={`${styles.searchInput} h-12 border-steel-blue pl-10 pr-12 font-[family-name:var(--font-orbitron)] text-xs tracking-[0.04em]`}
            />
            {query ? (
              <button
                type="button"
                onClick={clearQuery}
                aria-label="Clear mission search"
                className="absolute right-0.5 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center text-muted-ink transition-colors duration-150 hover:bg-elevated-ledger hover:text-case-file-white"
              >
                <X size={16} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col justify-between bg-void-navy p-4 sm:p-5" aria-hidden="true">
          <span className="font-[family-name:var(--font-chakra)] text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-muted-ink">
            Query input state
          </span>
          <div
            className={`mt-3 border px-3 py-3 ${
              isSearchFocused ? styles.modeActive : "border-elevated-ledger text-muted-ink"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-[family-name:var(--font-orbitron)] text-[0.6875rem] font-semibold uppercase tracking-[0.1em]">
                {isSearchFocused ? "Insert mode" : "Ready"}
              </span>
              <span
                className={`h-3.5 w-2.5 shrink-0 ${
                  isSearchFocused ? "bg-current" : "border border-current"
                }`}
              />
            </div>
          </div>
          <span className="mt-3 font-[family-name:var(--font-jetbrains)] text-[0.5625rem] uppercase tracking-[0.06em] text-muted-ink">
            {isSearchFocused ? "Buffer accepting" : "Buffer standby"}
          </span>
        </div>
      </div>

      <section aria-labelledby="mission-filters-heading" className="border-t border-elevated-ledger px-4 py-4 sm:px-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2
            id="mission-filters-heading"
            className="font-[family-name:var(--font-chakra)] text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-case-file-white"
          >
            Status filter
          </h2>
          <span className="font-[family-name:var(--font-jetbrains)] text-[0.5625rem] uppercase tracking-[0.06em] text-muted-ink">
            Select one channel
          </span>
        </div>

        <MissionStatusFilterChips value={bucket} onChange={setBucket} counts={counts} />
      </section>

      <div className="flex items-center justify-between gap-4 border-y border-elevated-ledger bg-void-navy px-4 py-2.5 sm:px-5">
        <span className="font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-case-file-white">
          Logged operations
        </span>
        <span
          role="status"
          aria-live="polite"
          aria-atomic="true"
          aria-label={`${filtered.length} of ${missions.length} missions shown`}
          className="font-[family-name:var(--font-jetbrains)] text-[0.625rem] uppercase tracking-[0.06em] text-signal-cyan"
        >
          {String(filtered.length).padStart(2, "0")} / {String(missions.length).padStart(2, "0")} match
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-5 py-10 text-center">
          <Crosshair size={30} className="text-muted-ink" aria-hidden="true" />
          <p className="font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.1em] text-case-file-white">
            Query returned zero ops
          </p>
          <p className="max-w-sm text-pretty font-[family-name:var(--font-inter)] text-xs leading-relaxed text-muted-ink">
            Reset the query buffer and status channel to inspect the full board.
          </p>
          <Button variant="secondary" onClick={resetBoard} className="mt-2 px-4 py-2">
            <RotateCcw size={14} aria-hidden="true" /> Reset board
          </Button>
        </div>
      ) : (
        <ul>
          {filtered.map((mission) => {
            const ownRow = characterId
              ? mission.assignments.find((a) => a.characterId === characterId)
              : undefined;
            const state = ownRow?.state ?? "none";
            const canAct = mission.status === "available" || mission.status === "active";
            const { interested } = callsignsByState(mission.assignments);
            const preview = briefingPreview(mission.briefing);
            const ordinal = ordinalById.get(mission.id) ?? 0;

            return (
              <li key={mission.id} className="border-b border-elevated-ledger px-4 py-4 last:border-b-0 sm:px-5">
                <div className="group flex flex-col gap-3 transition-colors duration-150 sm:flex-row sm:items-start sm:justify-between">
                  <Link href={`/missions/${mission.id}`} className="flex min-w-0 flex-1 gap-3">
                    <span
                      className="hidden size-8 shrink-0 items-center justify-center border border-elevated-ledger bg-void-navy text-steel-blue transition-colors duration-150 group-hover:border-steel-blue group-hover:text-signal-cyan sm:flex"
                      aria-hidden="true"
                    >
                      <Crosshair size={16} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="shrink-0 font-[family-name:var(--font-jetbrains)] text-[0.6875rem] text-muted-ink"
                          aria-hidden="true"
                        >
                          OPS-{String(ordinal).padStart(3, "0")}
                        </span>
                        <span className="min-w-0 truncate font-[family-name:var(--font-orbitron)] text-xs font-semibold uppercase tracking-[0.05em] text-case-file-white transition-colors duration-150 group-hover:text-live-cyan">
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
                      {preview && (
                        <p className="mt-1 truncate font-[family-name:var(--font-orbitron)] text-[0.625rem] tracking-[0.02em] text-muted-ink">
                          {preview}
                        </p>
                      )}
                      {interested.length > 0 && (
                        <p className="mt-0.5 truncate font-[family-name:var(--font-jetbrains)] text-[0.5625rem] uppercase tracking-[0.03em] text-muted-ink">
                          Interested: {interested.join(", ")}
                        </p>
                      )}
                    </div>

                    <span className="flex shrink-0 items-center gap-2">
                      <span className="font-[family-name:var(--font-jetbrains)] text-sm text-signal-cyan">
                        {mission.payoutCredits}
                        <span className="ml-0.5 text-[0.625rem] text-muted-ink">CR</span>
                        <span className="mx-1 text-muted-ink">·</span>
                        {mission.payoutXp}
                        <span className="ml-0.5 text-[0.625rem] text-muted-ink">XP</span>
                      </span>
                      <ChevronRight
                        size={16}
                        className="shrink-0 text-muted-ink transition-colors duration-150 group-hover:translate-x-0.5 group-hover:text-signal-cyan"
                        aria-hidden="true"
                      />
                    </span>
                  </Link>

                  <div className="flex shrink-0 items-center gap-3 sm:pl-11">
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
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
