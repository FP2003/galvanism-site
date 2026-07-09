import Link from "next/link";
import type { Metadata } from "next";
import { Vote, ChevronRight, IdCard } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Panel } from "@/components/ui/panel";
import { StatusLabel } from "@/components/ui/status-dot";
import { ButtonLink } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { getViewerCharacterState } from "@/lib/characters";
import { getBallotsForViewer } from "@/lib/ballot-data";
import type { Ballot, BallotOption, BallotVote } from "@/lib/schema";

export const metadata: Metadata = { title: "Ballots" };

type BallotRow = Ballot & { options: BallotOption[]; votes: BallotVote[] };

// Player-facing ballot board (Phase 7 Step 2). Admins have no character to
// vote with, so they get a read-only preview instead — same convention as
// missions/page.tsx.
export default async function BallotsPage() {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const viewer = isAdmin ? null : await getViewerCharacterState(user.id);

  if (!isAdmin && (!viewer || viewer.kind !== "approved")) {
    return (
      <AppShell>
        <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:py-8">
          <Header />
          <Panel>
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <Vote size={28} className="text-steel-blue" aria-hidden="true" />
              <p className="font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink">
                No character on file
              </p>
              <p className="max-w-sm text-pretty text-sm text-muted-ink">
                Submit an enlistment application first — approved operators can vote here.
              </p>
              <ButtonLink href="/apply">
                <IdCard size={15} /> Enlist now
              </ButtonLink>
            </div>
          </Panel>
        </div>
      </AppShell>
    );
  }

  const characterId = viewer?.kind === "approved" ? viewer.character.id : null;
  const ballotList = await getBallotsForViewer();
  const openBallots = ballotList.filter((b) => b.status === "open");
  const closedBallots = ballotList.filter((b) => b.status === "closed");

  return (
    <AppShell>
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:py-8">
        <Header />

        {ballotList.length === 0 ? (
          <EmptyBallots />
        ) : (
          <div className="flex flex-col gap-6">
            <BallotSection
              title="Open"
              ballots={openBallots}
              characterId={characterId}
              isAdmin={isAdmin}
              emptyLabel="No open ballots right now."
            />
            {closedBallots.length > 0 && (
              <BallotSection
                title="Closed"
                ballots={closedBallots}
                characterId={characterId}
                isAdmin={isAdmin}
                emptyLabel=""
              />
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Header() {
  return (
    <div className="mb-6 border-b border-ledger-teal pb-5">
      <h1 className="font-[family-name:var(--font-rajdhani)] text-3xl font-bold uppercase leading-none tracking-[0.02em] text-case-file-white sm:text-4xl">
        Ballots
      </h1>
      <p className="mt-2 max-w-prose text-sm text-muted-ink">
        Vote on what the regiment upgrades next — change your pick anytime while a ballot&rsquo;s open.
      </p>
    </div>
  );
}

function EmptyBallots() {
  return (
    <Panel>
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <Vote size={28} className="text-steel-blue" aria-hidden="true" />
        <p className="font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink">
          No ballots yet
        </p>
        <p className="max-w-sm text-pretty text-sm text-muted-ink">
          Check back once the DM opens one.
        </p>
      </div>
    </Panel>
  );
}

function BallotSection({
  title,
  ballots,
  characterId,
  isAdmin,
  emptyLabel,
}: {
  title: string;
  ballots: BallotRow[];
  characterId: string | null;
  isAdmin: boolean;
  emptyLabel: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.1em] text-muted-ink">
        {title}
      </h2>
      {ballots.length === 0 ? (
        emptyLabel && (
          <Panel>
            <p className="py-6 text-center text-sm text-muted-ink">{emptyLabel}</p>
          </Panel>
        )
      ) : (
        <div className="flex flex-col gap-4">
          {ballots.map((ballot) => {
            const ownVote = characterId ? ballot.votes.find((v) => v.characterId === characterId) : undefined;
            return (
              <Panel key={ballot.id} className="group transition-colors hover:bg-elevated-ledger">
                <Link
                  href={`/ballots/${ballot.id}`}
                  className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-[family-name:var(--font-chakra)] text-sm font-bold uppercase tracking-[0.04em] text-case-file-white transition-colors group-hover:text-signal-cyan">
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
                  <span className="shrink-0 flex items-center gap-2">
                    {isAdmin ? (
                      <span className="font-[family-name:var(--font-chakra)] text-[0.625rem] uppercase text-muted-ink">
                        Preview
                      </span>
                    ) : ownVote ? (
                      <StatusLabel tone="live">Voted</StatusLabel>
                    ) : ballot.status === "open" ? (
                      <StatusLabel tone="neutral">Not voted</StatusLabel>
                    ) : null}
                    <ChevronRight
                      size={16}
                      className="shrink-0 text-steel-blue transition-colors group-hover:text-signal-cyan"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
