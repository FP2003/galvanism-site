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
  voters,
}: {
  totalVotes: number;
  results: BallotOptionTally[];
  /** Callsigns of everyone who picked each option, keyed by optionId — omit
   *  to render tallies without the voter breakdown (e.g. the dashboard's
   *  compact preview). */
  voters?: Record<string, string[]>;
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
          {voters && voters[r.optionId]?.length > 0 && (
            <p className="mt-1.5 truncate font-[family-name:var(--font-jetbrains)] text-[0.6875rem] text-muted-ink">
              {voters[r.optionId].join(", ")}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
