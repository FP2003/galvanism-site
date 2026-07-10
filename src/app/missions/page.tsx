import type { Metadata } from "next";
import { Crosshair, IdCard } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Panel } from "@/components/ui/panel";
import { ButtonLink } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { getViewerCharacterState } from "@/lib/characters";
import { getMissionsForViewer } from "@/lib/mission-data";
import { MissionList } from "./mission-list";

export const metadata: Metadata = { title: "Missions" };

// Player-facing mission board (Phase 5). Admins have no character to claim
// against, so they get a read-only preview instead — same convention as
// facilities/[id]/page.tsx.
export default async function MissionsPage() {
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
              <Crosshair size={28} className="text-steel-blue" aria-hidden="true" />
              <p className="font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink">
                No character on file
              </p>
              <p className="max-w-sm text-pretty text-sm text-muted-ink">
                Submit an enlistment application first. Approved operators can claim ops here.
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

  const character = viewer?.kind === "approved" ? viewer.character : null;
  const missionList = await getMissionsForViewer();

  return (
    <AppShell>
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:py-8">
        <Header />

        {missionList.length === 0 ? (
          <EmptyMissions />
        ) : (
          <MissionList missions={missionList} characterId={character?.id ?? null} isAdmin={isAdmin} />
        )}
      </div>
    </AppShell>
  );
}

function Header() {
  return (
    <div className="mb-6 border-b border-ledger-teal pb-5">
      <h1 className="font-[family-name:var(--font-rajdhani)] text-3xl font-bold uppercase leading-none tracking-[0.02em] text-case-file-white sm:text-4xl">
        Missions
      </h1>
      <p className="mt-2 max-w-prose text-sm text-muted-ink">
        Mark interest in an op. The DM confirms who&rsquo;s actually assigned.
      </p>
    </div>
  );
}

function EmptyMissions() {
  return (
    <Panel>
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <Crosshair size={28} className="text-steel-blue" aria-hidden="true" />
        <p className="font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink">
          No missions posted
        </p>
        <p className="max-w-sm text-pretty text-sm text-muted-ink">
          Check back once the DM posts one.
        </p>
      </div>
    </Panel>
  );
}
