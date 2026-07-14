import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, ChevronRight, Vote } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Panel } from "@/components/ui/panel";
import { StatusLabel } from "@/components/ui/status-dot";
import { requireAdmin } from "@/lib/auth";
import { getBallots } from "@/lib/ballot-data";
import { NewBallotDialog } from "./new-ballot-dialog";
import { BallotMenu } from "./ballot-menu";

export const metadata: Metadata = { title: "Ballots · Personnel Command" };

// Admin ballot list (info/roadmap.md §Phase 7). Each row links to the
// ballot's detail page for the live tally and close/delete controls.
export default async function AdminBallotsPage() {
  await requireAdmin();
  const ballotList = await getBallots();

  return (
    <AppShell>
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:py-8">
        <Link
          href="/admin"
          className="mb-5 inline-flex items-center gap-2 font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink transition-colors hover:text-signal-cyan pointer-coarse:min-h-11"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Personnel Command
        </Link>

        <div className="mb-6 border-b border-ledger-teal pb-5">
          <h1 className="font-[family-name:var(--font-rajdhani)] text-3xl font-bold uppercase leading-none tracking-[0.02em] text-case-file-white sm:text-4xl">
            Ballots
          </h1>
          <p className="mt-2 max-w-prose text-sm text-muted-ink">
            Open shared-upgrade votes for players, and watch the tally live.
          </p>
        </div>

        <Panel
          title="All Ballots"
          meta={
            <div className="flex items-center gap-3">
              <span className="font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.06em] text-muted-ink">
                {ballotList.length} ballot{ballotList.length === 1 ? "" : "s"}
              </span>
              <NewBallotDialog />
            </div>
          }
          bodyClassName={ballotList.length === 0 ? undefined : "p-0"}
        >
          {ballotList.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <Vote size={28} className="text-muted-ink" aria-hidden="true" />
              <p className="font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink">
                No ballots yet
              </p>
              <p className="max-w-xs text-pretty text-xs text-muted-ink">
                Use New Ballot above to open the first one.
              </p>
            </div>
          ) : (
            <ul>
              {ballotList.map((ballot) => (
                <li
                  key={ballot.id}
                  className="group flex items-center gap-4 border-b border-elevated-ledger px-5 py-4 transition-colors last:border-b-0 hover:bg-elevated-ledger"
                >
                  <Link href={`/admin/ballots/${ballot.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-[family-name:var(--font-chakra)] text-sm font-bold uppercase tracking-[0.04em] text-case-file-white">
                          {ballot.title}
                        </span>
                        {ballot.status === "open" ? (
                          <StatusLabel tone="live" pulse>
                            Open
                          </StatusLabel>
                        ) : (
                          <StatusLabel tone="neutral">Closed</StatusLabel>
                        )}
                        {ballot.opsDeadline != null && ballot.status === "open" && (
                          <StatusLabel tone="critical">
                            Closes in {ballot.opsDeadline} op{ballot.opsDeadline === 1 ? "" : "s"}
                          </StatusLabel>
                        )}
                      </div>
                      <p className="mt-1.5 font-[family-name:var(--font-jetbrains)] text-[0.6875rem] text-muted-ink">
                        {ballot.options.length} option{ballot.options.length === 1 ? "" : "s"} ·{" "}
                        {ballot.votes.length} vote{ballot.votes.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <ChevronRight
                      size={16}
                      className="shrink-0 text-muted-ink transition-colors group-hover:text-signal-cyan"
                      aria-hidden="true"
                    />
                  </Link>
                  <BallotMenu ballot={ballot} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
