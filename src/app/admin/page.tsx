import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Panel } from "@/components/ui/panel";
import { StatusLabel } from "@/components/ui/status-dot";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getPendingApplications } from "@/lib/characters";
import { POINT_BUY_ATTRIBUTES } from "@/lib/game-rules";
import { CreatePlayerForm } from "./create-player-form";
import { ApplicationActions } from "./application-actions";

// Admin console (DM only). Reviews character applications, provisions accounts,
// and manages the roster (info/roadmap.md Phase 2).
export default async function AdminPage() {
  await requireAdmin();

  const db = getDb();
  const [roster, pending] = await Promise.all([
    db.query.players.findMany({
      with: { user: true, character: true },
      orderBy: (p, { desc }) => [desc(p.createdAt)],
    }),
    getPendingApplications(),
  ]);

  return (
    <AppShell>
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:py-8">
        <div className="mb-6 border-b border-ledger-teal pb-5">
          <h1 className="font-[family-name:var(--font-rajdhani)] text-3xl font-bold uppercase leading-none tracking-[0.02em] text-case-file-white sm:text-4xl">
            Personnel Command
          </h1>
          <p className="mt-2 max-w-prose text-sm text-muted-ink">
            Review enlistment applications and manage operator accounts for
            Regiment Foxtrot.
          </p>
        </div>

        {pending.length > 0 && (
          <Panel
            title="Enlistment Applications"
            className="mb-6"
            meta={
              <StatusLabel tone="live" pulse>
                {pending.length} awaiting review
              </StatusLabel>
            }
            bodyClassName="p-0"
          >
            <ul>
              {pending.map(({ view, applicantName }) => (
                <li
                  key={view.id}
                  className="flex flex-col gap-4 border-b border-elevated-ledger px-5 py-4 last:border-b-0 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-[family-name:var(--font-chakra)] text-sm font-bold uppercase tracking-[0.04em] text-signal-cyan">
                        {view.callsign}
                      </span>
                      <span className="truncate text-xs text-muted-ink">
                        {view.name} · {applicantName}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-[family-name:var(--font-jetbrains)] text-[0.6875rem] text-muted-ink">
                      {POINT_BUY_ATTRIBUTES.map((a) => (
                        <span key={a.key}>
                          {a.label.slice(0, 3).toUpperCase()}{" "}
                          <span className="text-case-file-white">
                            {view.stats[
                              a.key.replace("stat", "").toLowerCase() as keyof typeof view.stats
                            ]}
                          </span>
                        </span>
                      ))}
                    </div>
                    {view.bio && (
                      <p className="mt-2 max-w-2xl text-pretty text-xs text-muted-ink">
                        {view.bio}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">
                    <ApplicationActions characterId={view.id} />
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Panel title="Active Personnel" meta={`${roster.length} on file`}>
            {roster.length === 0 ? (
              <p className="py-8 text-center font-[family-name:var(--font-inter)] text-sm text-muted-ink">
                No operators provisioned yet. Create the first account →
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-elevated-ledger font-[family-name:var(--font-chakra)] text-[0.625rem] uppercase tracking-[0.1em] text-muted-ink">
                      <th scope="col" className="py-2 pr-4 font-semibold">Operator</th>
                      <th scope="col" className="py-2 pr-4 font-semibold">Email</th>
                      <th scope="col" className="py-2 pr-4 font-semibold">Character</th>
                      <th scope="col" className="py-2 pr-4 text-right font-semibold">Credits</th>
                      <th scope="col" className="py-2 pl-4 text-right font-semibold">
                        <span className="sr-only">Manage</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="font-[family-name:var(--font-inter)] text-sm">
                    {roster.map((p) => (
                      <tr
                        key={p.id}
                        className="group relative border-b border-elevated-ledger/50 transition-colors hover:bg-elevated-ledger/40"
                      >
                        <td className="py-2.5 pr-4 text-case-file-white">
                          <Link
                            href={`/admin/players/${p.id}`}
                            className="block after:absolute after:inset-0"
                          >
                            {p.name || p.user?.displayName || "—"}
                          </Link>
                        </td>
                        <td className="py-2.5 pr-4 text-muted-ink">
                          {p.user?.email}
                        </td>
                        <td className="py-2.5 pr-4 text-muted-ink">
                          {p.character ? (
                            <span className="font-[family-name:var(--font-chakra)] uppercase tracking-[0.06em] text-signal-cyan">
                              {p.character.callsign}
                            </span>
                          ) : (
                            <span className="font-[family-name:var(--font-chakra)] text-[0.6875rem] uppercase tracking-[0.08em] text-muted-ink/70">
                              Unassigned
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-[family-name:var(--font-jetbrains)] text-case-file-white">
                          {p.credits.toLocaleString()}
                        </td>
                        <td className="py-2.5 pl-4 text-right">
                          <ChevronRight
                            size={16}
                            className="ml-auto text-steel-blue transition-colors group-hover:text-signal-cyan"
                            aria-hidden="true"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Provision Account">
            <CreatePlayerForm />
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
