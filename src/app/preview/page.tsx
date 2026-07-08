import { LogIn } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { ButtonLink } from "@/components/ui/button";
import { CommandDashboard } from "@/components/command-dashboard";
import { operators, missions } from "@/lib/mock-data";

// Public, unauthenticated tour of the Ops Terminal using sample fixtures. Linked
// from the sign-in page. No sidebar/case-file links here — those are auth-gated,
// so the preview stays a single self-contained screen. Whitelisted in proxy.ts.
export const metadata = {
  title: "Preview",
};

export default function PreviewPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Preview banner */}
      <div className="flex items-center justify-center gap-2 bg-stamp-red px-4 py-1.5 text-center font-[family-name:var(--font-chakra)] text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-case-file-white">
        Preview · Sample data · Not live operational records
      </div>

      {/* Minimal public top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-ledger-teal bg-void-navy px-3 sm:px-4">
        <div className="flex items-center gap-3">
          <BrandMark size={30} className="text-signal-cyan" />
          <span className="flex flex-col leading-none">
            <span className="font-[family-name:var(--font-rajdhani)] text-lg font-bold uppercase tracking-[0.04em] text-case-file-white">
              F.C.B. Command
            </span>
            <span className="mt-0.5 hidden font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted-ink sm:inline">
              Preview mode
            </span>
          </span>
        </div>
        <ButtonLink href="/sign-in" variant="secondary" className="px-4 py-2">
          <LogIn size={15} />
          Sign in
        </ButtonLink>
      </header>

      <main className="min-w-0 flex-1">
        <CommandDashboard operators={operators} missions={missions} linkOperators={false} />
      </main>
    </div>
  );
}
