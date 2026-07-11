import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Panel } from "@/components/ui/panel";
import { Markdown } from "@/components/ui/markdown";
import { StatusLabel } from "@/components/ui/status-dot";
import { BallotTally } from "@/components/ballot-tally";
import { requireUser } from "@/lib/auth";
import { getViewerCharacterState } from "@/lib/characters";
import { getBallot } from "@/lib/ballot-data";
import { tallyVotes, votersByOption } from "@/lib/ballots";
import { BallotVoteForm } from "../ballot-vote-form";

export const metadata: Metadata = { title: "Ballot" };

// Player-facing ballot detail (Phase 7 Step 2): live tally plus the caller's
// own vote control. Same interest-control placement as
// missions/[id]/page.tsx's "Your Standing" panel.
export default async function BallotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const { id } = await params;

  const ballot = await getBallot(id);
  if (!ballot) notFound();

  const viewer = isAdmin ? null : await getViewerCharacterState(user.id);
  const character = viewer?.kind === "approved" ? viewer.character : null;
  const ownVote = character ? ballot.votes.find((v) => v.characterId === character.id) : undefined;

  const { totalVotes, results } = tallyVotes(ballot.options, ballot.votes);
  const voters = votersByOption(
    ballot.options,
    ballot.votes.map((v) => ({ optionId: v.optionId, callsign: v.character.callsign })),
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:py-8">
        <Link
          href="/ballots"
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
              {ballot.opsDeadline != null && ballot.status === "open" && (
                <StatusLabel tone="critical">
                  Closes in {ballot.opsDeadline} op{ballot.opsDeadline === 1 ? "" : "s"}
                </StatusLabel>
              )}
            </div>
          </div>
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

          {!isAdmin && character && (
            <Panel title="Your Vote">
              <BallotVoteForm
                ballotId={ballot.id}
                options={ballot.options}
                currentOptionId={ownVote?.optionId ?? null}
                closed={ballot.status !== "open"}
              />
            </Panel>
          )}
        </div>
      </div>
    </AppShell>
  );
}
