import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Layers, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { regiment } from "@/lib/mock-data";
import type { User } from "@/lib/schema";

// Global top bar. Sticky, sits above the sidebar rail. Carries the F.C.B. seal +
// wordmark, the regiment designation, the signed-in operator badge, and (for the
// DM) an admin link. Sign-out lives in the Clerk UserButton.
export function TopBar({ user }: { user: User | null }) {
  const isAdmin = user?.role === "admin";
  const displayName = user?.displayName || user?.email || "Unidentified";
  const initials = displayName.slice(0, 2).toUpperCase();
  const clearance = isAdmin ? "COMMAND" : "OPERATOR";

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-ledger-teal bg-void-navy px-3 sm:px-4">
      <Link href="/" className="flex items-center gap-3">
        <BrandMark size={30} className="text-signal-cyan" />
        <span className="flex flex-col leading-none">
          <span className="font-[family-name:var(--font-rajdhani)] text-lg font-bold uppercase tracking-[0.04em] text-case-file-white">
            F.C.B. Command
          </span>
          <span className="mt-0.5 hidden font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted-ink sm:inline">
            Frontier Custodian Brigade
          </span>
        </span>
      </Link>

      <div className="flex items-center gap-3 sm:gap-5">
        <span className="hidden font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.1em] text-muted-ink lg:inline">
          {regiment.designation} · {regiment.sector}
        </span>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <Link
              href="/admin/cards"
              className="flex items-center gap-1.5 border border-steel-blue px-3 py-1.5 font-[family-name:var(--font-chakra)] text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-signal-cyan transition-colors hover:bg-elevated-ledger hover:text-live-cyan pointer-coarse:py-2.5"
            >
              <Layers size={14} />
              <span className="hidden sm:inline">Card library</span>
            </Link>
            <Link
              href="/admin"
              className="flex items-center gap-1.5 border border-steel-blue px-3 py-1.5 font-[family-name:var(--font-chakra)] text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-signal-cyan transition-colors hover:bg-elevated-ledger hover:text-live-cyan pointer-coarse:py-2.5"
            >
              <ShieldCheck size={14} />
              Admin
            </Link>
          </div>
        )}

        <div className="flex items-center gap-2.5 border border-ledger-teal py-1.5 pl-3 pr-1.5">
          <span className="flex flex-col text-right leading-none">
            <span className="font-[family-name:var(--font-chakra)] text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-case-file-white">
              {displayName}
            </span>
            <span className="mt-0.5 font-[family-name:var(--font-jetbrains)] text-[0.5625rem] uppercase text-muted-ink">
              CLR · {clearance}
            </span>
          </span>
          <span className="flex size-6 items-center justify-center bg-ledger-teal font-[family-name:var(--font-chakra)] text-[0.625rem] font-bold text-signal-cyan">
            {initials}
          </span>
          <UserButton
            appearance={{
              elements: {
                userButtonAvatarBox: "size-7 rounded-none pointer-coarse:size-9",
                userButtonPopoverCard: "bg-ledger-teal border border-elevated-ledger",
              },
            }}
          />
        </div>
      </div>
    </header>
  );
}
