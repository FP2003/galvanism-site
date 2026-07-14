import { Meter } from "@/components/ui/meter";

// Facility-level rollup (Phase 6+, reworked from an arbitrary donate-any-
// amount pool): read-only now — there's nothing to contribute to here
// directly, since funding happens per-perk in the Perks section below. This
// panel just sums every currently-unlocked perk's funding progress against
// its price, so the team can see the facility's overall level-up progress at
// a glance without adding up each perk row by hand. Reaching 100% across
// every perk is what actually triggers the level-up (see contributeToPerk in
// purchase-actions.ts); this bar just reflects that state.
export function LevelProgress({
  level,
  totalCost,
  totalContributed,
  fundedCount,
  perkCount,
}: {
  level: number;
  totalCost: number;
  totalContributed: number;
  fundedCount: number;
  perkCount: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 font-[family-name:var(--font-jetbrains)] text-sm text-case-file-white">
        <span>Level {level + 1}</span>
        <span className="text-muted-ink">
          {fundedCount}/{perkCount} perks funded
        </span>
      </div>
      <Meter
        value={totalContributed}
        max={totalCost}
        tone="live"
        label={`Progress toward Level ${level + 1}: ${totalContributed} of ${totalCost} Cr across ${perkCount} perks`}
      />
      <p className="font-[family-name:var(--font-jetbrains)] text-[0.6875rem] text-muted-ink">
        {totalContributed.toLocaleString()}
        <span className="text-muted-ink">/{totalCost.toLocaleString()} Cr</span> pledged toward the
        perks below — fund every one to level up.
      </p>
    </div>
  );
}
