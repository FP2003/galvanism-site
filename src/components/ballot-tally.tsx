import { Meter } from "@/components/ui/meter";
import type { BallotOptionTally } from "@/lib/ballots";

/*
 * Live per-option vote tally (Phase 7). Shared between the admin/player
 * ballot detail pages and the command dashboard's "Open Ballot" panel — one
 * implementation instead of three copies of the same Meter-per-option rows.
 */
export function BallotTally({
  totalVotes,
  results,
}: {
  totalVotes: number;
  results: BallotOptionTally[];
}) {
  return (
    <ul className="flex flex-col gap-3">
      {results.map((r) => (
        <li key={r.optionId}>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-case-file-white">{r.label}</span>
            <span className="shrink-0 font-[family-name:var(--font-jetbrains)] text-xs text-muted-ink">
              {r.votes} / {totalVotes}
            </span>
          </div>
          <Meter
            value={r.votes}
            max={totalVotes || 1}
            label={`${r.label}: ${r.votes} of ${totalVotes} votes`}
            tone="steel"
            className="mt-1.5"
          />
        </li>
      ))}
    </ul>
  );
}
