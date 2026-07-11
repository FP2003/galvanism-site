import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Panel } from "@/components/ui/panel";
import { Markdown } from "@/components/ui/markdown";
import { StatusLabel } from "@/components/ui/status-dot";
import { FormDialogTrigger } from "@/components/ui/form-dialog-trigger";
import { BallotTally } from "@/components/ballot-tally";
import { requireAdmin } from "@/lib/auth";
import { getBallot } from "@/lib/ballot-data";
import { tallyVotes, votersByOption } from "@/lib/ballots";
import { BallotForm } from "../ballot-form";
import { CloseBallotForm } from "./close-ballot-form";

export const metadata: Metadata = { title: "Ballot · Personnel Command" };

// Admin ballot detail (info/roadmap.md §Phase 7): description, live tally,
// and the close control for one ballot. Closing is purely informational — it
// just locks the tally for display, same as the ops-deadline auto-close.
export default async function AdminBallotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const ballot = await getBallot(id);
  if (!ballot) notFound();

  const { totalVotes, results } = tallyVotes(ballot.options, ballot.votes);
  const voters = votersByOption(
    ballot.options,
    ballot.votes.map((v) => ({ optionId: v.optionId, callsign: v.character.callsign })),
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:py-8">
        <Link
          href="/admin/ballots"
          className="mb-5 inline-flex items-center gap-2 font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink transition-colors hover:text-signal-cyan pointer-coarse:min-h-11"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Ballots
        </Link>

        <div className="mb-6 flex flex-col gap-3 border-b border-ledger-teal pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-[family-name:var(--font-rajdhani)] text-3xl font-bold uppercase leading-none tracking-[0.02em] text-case-file-white break-words sm:text-4xl">
                {ballot.title}
              </h1>
              {ballot.status === "open" ? (
                <StatusLabel tone="live" pulse>
                  Open
                </StatusLabel>
              ) : (
                <StatusLabel tone="neutral">Closed</StatusLabel>
              )}
            </div>
          </div>
          <FormDialogTrigger label="Edit" title="Edit Ballot">
            <BallotForm ballot={ballot} />
          </FormDialogTrigger>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex flex-col gap-6">
            <Panel title="Description">
              {ballot.description ? (
                <Markdown className="max-w-prose text-sm text-case-file-white">
                  {ballot.description}
                </Markdown>
              ) : (
                <p className="font-[family-name:var(--font-inter)] text-sm text-muted-ink">
                  No description written yet.
                </p>
              )}
            </Panel>

            <Panel title="Live Tally">
              <BallotTally totalVotes={totalVotes} results={results} voters={voters} />
            </Panel>
          </div>

          <div className="flex flex-col gap-6">
            <Panel title="Status">
              <div className="flex flex-col gap-4">
                <dl className="flex flex-col gap-3">
                  <div className="flex items-baseline justify-between border-b border-elevated-ledger pb-3">
                    <dt className="font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">
                      Total votes
                    </dt>
                    <dd className="font-[family-name:var(--font-jetbrains)] text-sm text-signal-cyan">
                      {totalVotes}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <dt className="font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">
                      Time limit
                    </dt>
                    <dd className="font-[family-name:var(--font-jetbrains)] text-sm text-case-file-white">
                      {ballot.opsDeadline != null
                        ? `${ballot.opsDeadline} op${ballot.opsDeadline === 1 ? "" : "s"} left`
                        : "None"}
                    </dd>
                  </div>
                </dl>

                {ballot.status === "closed" ? (
                  <p className="font-[family-name:var(--font-inter)] text-sm text-muted-ink">
                    This ballot is closed. The tally above is final.
                  </p>
                ) : (
                  <CloseBallotForm ballotId={ballot.id} />
                )}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
