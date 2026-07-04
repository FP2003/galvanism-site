import { AppShell } from "@/components/shell/app-shell";
import { CommandDashboard } from "@/components/command-dashboard";
import { requireUser } from "@/lib/auth";
import { getRosterViews } from "@/lib/characters";

// Ops Terminal command overview (authenticated). Personnel is live roster data;
// the mission/facility/ballot panels remain mock pending their own phases.
export default async function CommandPage() {
  await requireUser();
  const operators = await getRosterViews();

  return (
    <AppShell>
      <CommandDashboard operators={operators} />
    </AppShell>
  );
}
