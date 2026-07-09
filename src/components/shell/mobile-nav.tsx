"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buildNavItems, isNavActive } from "./nav-items";

// Mobile nav (<md): a horizontally scrollable row under the top bar. Disabled
// (phase-gated) items are omitted here to keep the row scannable on small screens.
export function MobileNav({ myCaseFileHref }: { myCaseFileHref: string | null }) {
  const pathname = usePathname();
  const live = buildNavItems(myCaseFileHref).filter((i) => i.href);

  return (
    <nav
      aria-label="Primary"
      className="sticky top-14 z-30 flex gap-1 overflow-x-auto border-b border-ledger-teal bg-void-navy px-2 py-1.5 md:hidden"
    >
      {live.map((item) => {
        const Icon = item.icon;
        const href = item.href!;
        const active = isNavActive(item, pathname, myCaseFileHref);
        return (
          <Link
            key={item.label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 px-3 py-2 font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] transition-colors duration-150 pointer-coarse:py-3 ${
              active
                ? "bg-ledger-teal text-signal-cyan"
                : "text-case-file-white hover:bg-elevated-ledger"
            }`}
          >
            <Icon size={16} aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
