"use client";

import type { MissionStatusBucket } from "@/lib/missions";

export type MissionFilterBucket = "all" | MissionStatusBucket;

const BUCKET_LABEL: Record<MissionFilterBucket, string> = {
  all: "All",
  incomplete: "Incomplete",
  complete: "Complete",
  failed: "Failed",
};

const BUCKETS: MissionFilterBucket[] = ["all", "incomplete", "complete", "failed"];

/*
 * Chip-style status filter for the admin and player mission lists, mirroring
 * CategoryChip in admin/cards/card-library.tsx — client-side only, the
 * mission lists are small enough that filtering the already-fetched array in
 * the browser beats a re-fetch per click.
 */
export function MissionStatusFilterChips({
  value,
  onChange,
  counts,
}: {
  value: MissionFilterBucket;
  onChange: (bucket: MissionFilterBucket) => void;
  counts: Record<MissionFilterBucket, number>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {BUCKETS.map((bucket) => (
        <button
          key={bucket}
          type="button"
          aria-pressed={value === bucket}
          onClick={() => onChange(bucket)}
          className={`flex items-center gap-1.5 border px-2.5 py-1 font-[family-name:var(--font-chakra)] text-[0.6875rem] font-semibold uppercase tracking-[0.06em] transition-colors pointer-coarse:min-h-11 ${
            value === bucket
              ? "border-signal-cyan bg-signal-cyan/10 text-signal-cyan"
              : "border-elevated-ledger text-muted-ink hover:border-steel-blue hover:text-case-file-white"
          }`}
        >
          {BUCKET_LABEL[bucket]} ({counts[bucket]})
        </button>
      ))}
    </div>
  );
}
