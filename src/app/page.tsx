import Link from "next/link";
import { ClipboardList, Clock, IdCard, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { AutoRefresh } from "@/components/auto-refresh";
import { CommandDashboard } from "@/components/command-dashboard";
import { ButtonLink } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { getRosterViews, getViewerCharacterState } from "@/lib/characters";
import { getMissionsForDashboard } from "@/lib/mission-data";
import { getUnresolvedOngoingEntries } from "@/lib/facility-data";
import { getBallotsForDashboard } from "@/lib/ballot-data";
import { tallyVotes } from "@/lib/ballots";

// Ops Terminal command overview (authenticated). Personnel, missions,
// facility processes, and the open-ballot panel are all live data. Players
// without an approved character get an enlistment prompt above the dashboard.
export default async function CommandPage() {
  const user = await requireUser();
  const [operators, missions, facilityProcesses, ballotRows, viewer] = await Promise.all([
    getRosterViews(),
    getMissionsForDashboard(),
    getUnresolvedOngoingEntries(),
    getBallotsForDashboard(),
    user.role === "admin"
      ? Promise.resolve(null)
      : getViewerCharacterState(user.id),
  ]);
  const ballots = ballotRows.map((b) => {
    const { totalVotes, results } = tallyVotes(b.options, b.votes);
    return { id: b.id, title: b.title, opsDeadline: b.opsDeadline, totalVotes, results };
  });

  return (
    <AppShell>
      <AutoRefresh />
      {viewer?.kind === "none" && (
        <div className="mx-auto max-w-[1600px] px-4 pt-6 sm:px-6">
          <div className="flex flex-col gap-4 border border-signal-cyan/40 bg-signal-cyan/5 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <ClipboardList
                size={22}
                className="mt-0.5 shrink-0 text-signal-cyan"
                aria-hidden="true"
              />
              <div>
                <p className="font-[family-name:var(--font-chakra)] text-sm font-bold uppercase tracking-[0.04em] text-case-file-white">
                  No character on file
                </p>
                <p className="mt-1 max-w-prose text-sm text-muted-ink">
                  Submit an enlistment application to join Regiment Foxtrot. The DM
                  reviews it before you hit the active roster.
                </p>
              </div>
            </div>
            <div className="shrink-0">
              <ButtonLink href="/apply">
                <IdCard size={15} />
                Enlist now
              </ButtonLink>
            </div>
          </div>
        </div>
      )}

      {viewer?.kind === "pending" && (
        <div className="mx-auto max-w-[1600px] px-4 pt-6 sm:px-6">
          <Link
            href={`/roster/${viewer.character.slug}`}
            className="group flex items-center gap-3 border border-signal-cyan/40 bg-signal-cyan/10 px-5 py-3.5 transition-colors hover:bg-signal-cyan/15"
          >
            <Clock size={18} className="shrink-0 text-signal-cyan" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-[family-name:var(--font-chakra)] text-sm font-semibold uppercase tracking-[0.04em] text-case-file-white">
                {viewer.character.callsign} · Application pending
              </p>
              <p className="text-xs text-muted-ink">
                Awaiting DM approval. Review your submitted sheet →
              </p>
            </div>
            <ChevronRight
              size={16}
              className="shrink-0 text-steel-blue transition-colors group-hover:text-signal-cyan"
              aria-hidden="true"
            />
          </Link>
        </div>
      )}

      <CommandDashboard
        operators={operators}
        missions={missions}
        facilityProcesses={facilityProcesses}
        ballots={ballots}
      />
    </AppShell>
  );
}
