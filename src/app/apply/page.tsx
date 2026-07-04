import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AppShell } from "@/components/shell/app-shell";
import { Panel } from "@/components/ui/panel";
import { requireUser } from "@/lib/auth";
import { getViewerCharacterState } from "@/lib/characters";
import { ApplicationForm } from "./application-form";

export const metadata: Metadata = {
  title: "Enlistment Application",
};

// Character application (Phase 2). Available only to a signed-in player who has
// no character yet. Anyone with a character (pending or approved) or an admin is
// bounced home.
export default async function ApplyPage() {
  const user = await requireUser();
  if (user.role === "admin") redirect("/");

  const state = await getViewerCharacterState(user.id);
  if (state.kind !== "none") redirect("/");

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:py-8">
        <div className="mb-6 border-b border-ledger-teal pb-5">
          <h1 className="font-[family-name:var(--font-rajdhani)] text-3xl font-bold uppercase leading-none tracking-[0.02em] text-case-file-white sm:text-4xl">
            Enlistment Application
          </h1>
          <p className="mt-2 max-w-prose text-sm text-muted-ink">
            Submit your operator for Regiment Foxtrot. The DM reviews every
            application before it joins the active roster.
          </p>
        </div>

        <Panel title="New Operator">
          <ApplicationForm />
        </Panel>
      </div>
    </AppShell>
  );
}
