import type { Metadata } from "next";
import { Crosshair, IdCard } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { RegistryTerminalFrame } from "@/components/registry/registry-terminal-frame";
import { ButtonLink } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { getViewerCharacterState } from "@/lib/characters";
import { getMissionsForViewer } from "@/lib/mission-data";
import { MissionList } from "./mission-list";

export const metadata: Metadata = { title: "Missions" };

// Player-facing mission board (Phase 5), styled as the Registry's
// Data-Shard Frame (DESIGN.md "Data-Shard Frame") since briefings link into
// /registry/slug and the two boards read as one system. Admins have no
// character to claim against, so they get a read-only preview instead —
// same convention as facilities/[id]/page.tsx.
export default async function MissionsPage() {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const viewer = isAdmin ? null : await getViewerCharacterState(user.id);

  if (!isAdmin && (!viewer || viewer.kind !== "approved")) {
    return (
      <AppShell>
        <div className="mx-auto max-w-[1500px] px-3 py-5 sm:px-6 sm:py-7 lg:py-9">
          <RegistryTerminalFrame variant="index" systemLabel="F.C.B. operations log" status="Unregistered">
            <Header />
            <div className="flex flex-col items-center justify-center gap-3 px-5 py-12 text-center">
              <Crosshair size={28} className="text-muted-ink" aria-hidden="true" />
              <p className="font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink">
                No character on file
              </p>
              <p className="max-w-sm text-pretty font-[family-name:var(--font-inter)] text-sm text-muted-ink">
                Submit an enlistment application first. Approved operators can claim ops here.
              </p>
              <ButtonLink href="/apply">
                <IdCard size={15} /> Enlist now
              </ButtonLink>
            </div>
          </RegistryTerminalFrame>
        </div>
      </AppShell>
    );
  }

  const character = viewer?.kind === "approved" ? viewer.character : null;
  const missionList = await getMissionsForViewer();

  return (
    <AppShell>
      <div className="mx-auto max-w-[1500px] px-3 py-5 sm:px-6 sm:py-7 lg:py-9">
        <RegistryTerminalFrame
          variant="index"
          systemLabel="F.C.B. operations log"
          meta={`${String(missionList.length).padStart(2, "0")} ${missionList.length === 1 ? "op" : "ops"}`}
          status={isAdmin ? "Preview" : "Operator"}
        >
          <Header />
          {missionList.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-5 py-12 text-center">
              <Crosshair size={28} className="text-muted-ink" aria-hidden="true" />
              <p className="font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink">
                No missions posted
              </p>
              <p className="max-w-sm text-pretty font-[family-name:var(--font-inter)] text-sm text-muted-ink">
                Check back once the DM posts one.
              </p>
            </div>
          ) : (
            <MissionList missions={missionList} characterId={character?.id ?? null} isAdmin={isAdmin} />
          )}
        </RegistryTerminalFrame>
      </div>
    </AppShell>
  );
}

function Header() {
  return (
    <div className="border-b border-elevated-ledger px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <h1 className="font-[family-name:var(--font-orbitron)] text-2xl font-semibold uppercase leading-tight tracking-[0.08em] text-case-file-white sm:text-3xl lg:text-4xl">
        Missions
      </h1>
      <p className="mt-3 max-w-2xl font-[family-name:var(--font-inter)] text-sm leading-relaxed text-muted-ink">
        Mark interest in an op. The DM confirms who&rsquo;s actually assigned.
      </p>
    </div>
  );
}
