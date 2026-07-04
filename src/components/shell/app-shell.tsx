import { TopBar } from "./top-bar";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";

// Chrome shared by every authenticated surface — the frame both the Ops Terminal
// and the Case File render inside.
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar />
      <MobileNav />
      <div className="flex flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
