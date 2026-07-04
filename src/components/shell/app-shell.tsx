import { TopBar } from "./top-bar";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { getCurrentUser } from "@/lib/auth";

// Chrome shared by every authenticated surface — the frame both the Ops Terminal
// and the Case File render inside.
export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar user={user} />
      <MobileNav />
      <div className="flex flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
