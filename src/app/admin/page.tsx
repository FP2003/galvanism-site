import { AppShell } from "@/components/shell/app-shell";
import { Panel } from "@/components/ui/panel";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { CreatePlayerForm } from "./create-player-form";

// Admin console (DM only). Phase 1 scope: provision player accounts and see the
// resulting roster. Character CRUD arrives in Phase 2.
export default async function AdminPage() {
  await requireAdmin();

  const db = getDb();
  const roster = await db.query.players.findMany({
    with: { user: true, character: true },
    orderBy: (p, { desc }) => [desc(p.createdAt)],
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:py-8">
        <div className="mb-6 border-b border-ledger-teal pb-5">
          <h1 className="font-[family-name:var(--font-rajdhani)] text-3xl font-bold uppercase leading-none tracking-[0.02em] text-case-file-white sm:text-4xl">
            Personnel Command
          </h1>
          <p className="mt-2 max-w-prose text-sm text-muted-ink">
            Provision operator accounts for Regiment Foxtrot. Each account grants
            the operator sign-in access to their own case file.
          </p>
        </div>

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
                      <th className="py-2 pr-4 font-semibold">Operator</th>
                      <th className="py-2 pr-4 font-semibold">Email</th>
                      <th className="py-2 pr-4 font-semibold">Character</th>
                      <th className="py-2 pr-4 text-right font-semibold">Gold</th>
                    </tr>
                  </thead>
                  <tbody className="font-[family-name:var(--font-inter)] text-sm">
                    {roster.map((p) => (
                      <tr
                        key={p.id}
                        className="border-b border-elevated-ledger/50"
                      >
                        <td className="py-2.5 pr-4 text-case-file-white">
                          {p.name || p.user?.displayName || "—"}
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
                          {p.gold.toLocaleString()}
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
