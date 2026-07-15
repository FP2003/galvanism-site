"use client";

import { useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BookUser, ChevronRight, Crosshair, RotateCcw, Search, X } from "lucide-react";
import { RegistryTypeIcon } from "@/components/registry/registry-type-icon";
import { MissionStatusBadge } from "@/components/missions/mission-tags";
import styles from "@/components/registry/registry-terminal.module.css";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/form";
import {
  REGISTRY_TYPES,
  REGISTRY_TYPE_META,
  registryHref,
  type RegistryEntryType,
} from "@/lib/registry";
import { briefingPreview } from "@/lib/missions";
import type { getPublicRegistryEntries } from "@/lib/registry-data";
import type { Mission, MissionAssignment } from "@/lib/schema";

type PublicRegistryEntry = Awaited<ReturnType<typeof getPublicRegistryEntries>>[number];
type MissionRow = Mission & { assignments: (MissionAssignment & { character: { callsign: string } })[] };

type Classification = RegistryEntryType | "mission";

type BrowsableItem =
  | { kind: "entry"; key: string; data: PublicRegistryEntry }
  | { kind: "mission"; key: string; data: MissionRow };

function itemName(item: BrowsableItem): string {
  return item.kind === "entry" ? item.data.name : item.data.title;
}

function itemClassification(item: BrowsableItem): Classification {
  return item.kind === "entry" ? item.data.type : "mission";
}

function itemHref(item: BrowsableItem): string {
  return item.kind === "entry" ? registryHref(item.data.slug) : `/missions/${item.data.id}`;
}

function itemDescription(item: BrowsableItem): string {
  return item.kind === "entry" ? (item.data.description?.trim() ?? "") : briefingPreview(item.data.briefing);
}

function itemIdLine(item: BrowsableItem): string {
  return item.kind === "entry" ? `REG://${item.data.slug}` : `OPS://${item.data.id.slice(0, 8).toUpperCase()}`;
}

// The public roster is intentionally small, so querying and classification
// filtering stay local after the server has enforced visibility and column
// selection. Missions are merged in as one more classification ("Mission")
// rather than a separate tab — they're records too, just backed by a
// different table, so they share this one search/filter/list instead of a
// parallel browsing surface. `RegistryEntryType` stays schema-only (it also
// drives the admin entry-type <select>, where "mission" would be a bogus
// option), so the extra classification lives only in this component's local
// `Classification` union. Ordinals are based on the full name-sorted merged
// list and never change when the result set narrows.
export function RegistryBrowser({
  entries,
  missions,
}: {
  entries: PublicRegistryEntry[];
  missions: MissionRow[];
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<Classification | "all">("all");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchId = useId();
  const searchInput = useRef<HTMLInputElement>(null);

  const items = useMemo<BrowsableItem[]>(() => {
    const merged: BrowsableItem[] = [
      ...entries.map((entry) => ({ kind: "entry" as const, key: `entry:${entry.id}`, data: entry })),
      ...missions.map((mission) => ({ kind: "mission" as const, key: `mission:${mission.id}`, data: mission })),
    ];
    merged.sort((a, b) => itemName(a).localeCompare(itemName(b)));
    return merged;
  }, [entries, missions]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter(
      (item) =>
        (type === "all" || itemClassification(item) === type) &&
        (normalizedQuery === "" || itemName(item).toLowerCase().includes(normalizedQuery)),
    );
  }, [items, query, type]);

  const typeCounts = useMemo(() => {
    const counts = Object.fromEntries(
      REGISTRY_TYPES.map((entryType) => [entryType, 0]),
    ) as Record<RegistryEntryType, number>;

    let missionCount = 0;
    for (const item of items) {
      if (item.kind === "entry") counts[item.data.type] += 1;
      else missionCount += 1;
    }
    return { ...counts, mission: missionCount };
  }, [items]);

  const ordinalById = useMemo(
    () => new Map(items.map((item, index) => [item.key, index + 1])),
    [items],
  );

  function clearQuery() {
    setQuery("");
    searchInput.current?.focus();
  }

  function resetIndex() {
    setQuery("");
    setType("all");
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
              Archive query
            </label>
            <span className="font-[family-name:var(--font-jetbrains)] text-[0.5625rem] uppercase tracking-[0.06em] text-muted-ink">
              Name index
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
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              placeholder="Query public records or missions…"
              aria-label="Search the public registry and mission log by name"
              className={`${styles.searchInput} h-12 border-steel-blue pl-10 pr-12 font-[family-name:var(--font-orbitron)] text-xs tracking-[0.04em]`}
            />
            {query ? (
              <button
                type="button"
                onClick={clearQuery}
                aria-label="Clear registry search"
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
              isSearchFocused
                ? styles.modeActive
                : "border-elevated-ledger text-muted-ink"
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

      <section aria-labelledby="registry-filters-heading" className="border-t border-elevated-ledger px-4 py-4 sm:px-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2
            id="registry-filters-heading"
            className="font-[family-name:var(--font-chakra)] text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-case-file-white"
          >
            Classification filter
          </h2>
          <span className="font-[family-name:var(--font-jetbrains)] text-[0.5625rem] uppercase tracking-[0.06em] text-muted-ink">
            Select one channel
          </span>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter registry by classification">
          <TypeChip
            label="All"
            count={items.length}
            active={type === "all"}
            onClick={() => setType("all")}
          />
          {REGISTRY_TYPES.map((entryType) => (
            <TypeChip
              key={entryType}
              icon={<RegistryTypeIcon type={entryType} size={12} />}
              label={REGISTRY_TYPE_META[entryType].label}
              count={typeCounts[entryType]}
              active={type === entryType}
              onClick={() => setType((current) => (current === entryType ? "all" : entryType))}
            />
          ))}
          <TypeChip
            icon={<Crosshair size={12} aria-hidden="true" />}
            label="Mission"
            count={typeCounts.mission}
            active={type === "mission"}
            onClick={() => setType((current) => (current === "mission" ? "all" : "mission"))}
          />
        </div>
      </section>

      <div className="flex items-center justify-between gap-4 border-y border-elevated-ledger bg-void-navy px-4 py-2.5 sm:px-5">
        <span className="font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-case-file-white">
          Indexed records
        </span>
        <span
          role="status"
          aria-live="polite"
          aria-atomic="true"
          aria-label={`${filtered.length} of ${items.length} records shown`}
          className="font-[family-name:var(--font-jetbrains)] text-[0.625rem] uppercase tracking-[0.06em] text-signal-cyan"
        >
          {String(filtered.length).padStart(2, "0")} / {String(items.length).padStart(2, "0")} match
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-5 py-10 text-center">
          <BookUser size={30} className="text-muted-ink" aria-hidden="true" />
          <p className="font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.1em] text-case-file-white">
            {items.length === 0 ? "Archive index empty" : "Query returned zero records"}
          </p>
          <p className="max-w-sm text-pretty font-[family-name:var(--font-inter)] text-xs leading-relaxed text-muted-ink">
            {items.length === 0
              ? "No public records have been released to the archive."
              : "Reset the query buffer and classification channel to inspect the full index."}
          </p>
          {items.length > 0 ? (
            <Button variant="secondary" onClick={resetIndex} className="mt-2 px-4 py-2">
              <RotateCcw size={14} aria-hidden="true" /> Reset index
            </Button>
          ) : null}
        </div>
      ) : (
        <ul>
          {filtered.map((item) => {
            const ordinal = ordinalById.get(item.key) ?? 0;
            const classificationLabel = item.kind === "entry" ? REGISTRY_TYPE_META[item.data.type].label : "Mission";

            return (
              <li key={item.key} className="border-b border-elevated-ledger last:border-b-0">
                <Link
                  href={itemHref(item)}
                  className="group grid grid-cols-[3.5rem_minmax(0,1fr)_1.25rem] items-center gap-x-3 px-4 py-3 transition-colors duration-150 hover:bg-elevated-ledger focus-visible:bg-elevated-ledger sm:grid-cols-[3.5rem_2rem_minmax(0,1fr)_1.25rem] sm:px-5 lg:grid-cols-[3.5rem_2.25rem_minmax(11rem,0.85fr)_7rem_minmax(11rem,1.15fr)_1.25rem]"
                >
                  <span
                    className="row-span-2 self-center whitespace-nowrap font-[family-name:var(--font-jetbrains)] text-[0.6875rem] text-muted-ink"
                    aria-hidden="true"
                  >
                    IDX-{String(ordinal).padStart(3, "0")}
                  </span>

                  <span className="hidden size-8 items-center justify-center border border-elevated-ledger bg-void-navy text-steel-blue transition-colors duration-150 group-hover:border-steel-blue group-hover:text-signal-cyan sm:col-start-2 sm:row-span-2 sm:flex lg:col-start-2">
                    {item.kind === "entry" ? (
                      <RegistryTypeIcon type={item.data.type} size={16} />
                    ) : (
                      <Crosshair size={16} aria-hidden="true" />
                    )}
                  </span>

                  <div className="col-start-2 row-start-1 flex min-w-0 items-center gap-2 sm:col-start-3 lg:col-start-3">
                    <span className="min-w-0 flex-1 truncate font-[family-name:var(--font-orbitron)] text-xs font-semibold uppercase tracking-[0.05em] text-case-file-white transition-colors duration-150 group-hover:text-live-cyan">
                      {itemName(item)}
                    </span>
                    <span className="shrink-0 border border-elevated-ledger px-1.5 py-0.5 font-[family-name:var(--font-chakra)] text-[0.5rem] font-semibold uppercase tracking-[0.08em] text-muted-ink lg:hidden">
                      {classificationLabel}
                    </span>
                    {item.kind === "mission" && <MissionStatusBadge status={item.data.status} />}
                  </div>

                  <span className="hidden font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-muted-ink lg:col-start-4 lg:row-start-1 lg:block">
                    {classificationLabel}
                  </span>

                  <div className="col-start-2 row-start-2 min-w-0 pt-1 sm:col-start-3 lg:col-start-5 lg:row-start-1 lg:pt-0">
                    <p className="truncate font-[family-name:var(--font-orbitron)] text-[0.625rem] tracking-[0.02em] text-muted-ink">
                      {itemDescription(item) || "No summary attached."}
                    </p>
                    <p className="mt-0.5 truncate font-[family-name:var(--font-jetbrains)] text-[0.5625rem] uppercase tracking-[0.03em] text-muted-ink">
                      {itemIdLine(item)}
                    </p>
                  </div>

                  <ChevronRight
                    size={16}
                    className="col-start-3 row-span-2 row-start-1 shrink-0 self-center text-muted-ink transition-[color,transform] duration-150 group-hover:translate-x-0.5 group-hover:text-signal-cyan sm:col-start-4 lg:col-start-6"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TypeChip({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon?: React.ReactNode;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${label}, ${count} ${count === 1 ? "record" : "records"}`}
      className={`flex min-h-9 items-center gap-2 border px-2.5 py-1.5 font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.08em] transition-colors duration-150 pointer-coarse:min-h-11 ${
        active
          ? "border-signal-cyan bg-signal-cyan text-void-navy"
          : "border-elevated-ledger text-muted-ink hover:border-steel-blue hover:bg-void-navy hover:text-case-file-white"
      }`}
    >
      {icon}
      <span>{label}</span>
      <span className="font-[family-name:var(--font-jetbrains)] text-[0.5625rem]">{String(count).padStart(2, "0")}</span>
    </button>
  );
}
