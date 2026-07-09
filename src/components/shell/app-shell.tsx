import { TopBar } from "./top-bar";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { getCurrentUser } from "@/lib/auth";
import { getViewerCharacterState } from "@/lib/characters";

// Chrome shared by every authenticated surface — the frame both the Ops Terminal
// and the Case File render inside.
export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  // Players with a character (pending or approved) get a "My Case File" nav
  // shortcut to their own sheet. Admins have no player row, so skip the query.
  let myCaseFileHref: string | null = null;
  if (user && user.role !== "admin") {
    const state = await getViewerCharacterState(user.id);
    if (state.kind === "pending" || state.kind === "approved") {
      myCaseFileHref = `/roster/${state.character.slug}`;
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar user={user} />
      <MobileNav myCaseFileHref={myCaseFileHref} />
      <div className="flex flex-1">
        <Sidebar myCaseFileHref={myCaseFileHref} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
