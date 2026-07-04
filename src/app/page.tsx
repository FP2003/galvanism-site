import { AppShell } from "@/components/shell/app-shell";
import { CommandDashboard } from "@/components/command-dashboard";

// Ops Terminal command overview (authenticated). Renders sample fixtures today;
// wired to live data in Phase 2.
export default function CommandPage() {
  return (
    <AppShell>
      <CommandDashboard />
    </AppShell>
  );
}
