import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { regiment } from "@/lib/mock-data";

// Global top bar. Sticky, sits above the sidebar rail. Carries the F.C.B. seal +
// wordmark, the regiment designation, and the current operator badge.
export function TopBar() {
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
        <div className="flex items-center gap-2.5 border border-ledger-teal px-3 py-1.5">
          <span className="flex size-6 items-center justify-center bg-ledger-teal font-[family-name:var(--font-chakra)] text-[0.625rem] font-bold text-signal-cyan">
            {regiment.operator.callsign.slice(0, 2)}
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-[family-name:var(--font-chakra)] text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-case-file-white">
              OPR. {regiment.operator.callsign}
            </span>
            <span className="mt-0.5 font-[family-name:var(--font-jetbrains)] text-[0.5625rem] uppercase text-muted-ink">
              CLR · {regiment.operator.clearance}
            </span>
          </span>
        </div>
      </div>
    </header>
  );
}
