import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Crosshair } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Panel } from "@/components/ui/panel";
import { requireAdmin } from "@/lib/auth";
import { getMissions } from "@/lib/mission-data";
import { NewMissionDialog } from "./new-mission-dialog";
import { MissionList } from "./mission-list";

export const metadata: Metadata = { title: "Missions · Personnel Command" };

// Admin mission list (info/roadmap.md Phase 5). Each row links to the
// mission's detail page for assignment management and completion.
export default async function AdminMissionsPage() {
  await requireAdmin();
  const missionList = await getMissions();

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
            Missions
          </h1>
          <p className="mt-2 max-w-prose text-sm text-muted-ink">
            Post ops, review operator interest, and complete missions to post their payout.
          </p>
        </div>

        <Panel
          title="All Missions"
          meta={
            <div className="flex items-center gap-3">
              <span className="font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.06em] text-muted-ink">
                {missionList.length} mission{missionList.length === 1 ? "" : "s"}
              </span>
              <NewMissionDialog />
            </div>
          }
          bodyClassName={missionList.length === 0 ? undefined : "p-0"}
        >
          {missionList.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <Crosshair size={28} className="text-steel-blue" aria-hidden="true" />
              <p className="font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink">
                No missions yet
              </p>
              <p className="max-w-xs text-pretty text-xs text-muted-ink">
                Use New Mission above to post the first one.
              </p>
            </div>
          ) : (
            <MissionList missions={missionList} />
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
