"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buildNavItems, isNavActive } from "./nav-items";

// Desktop rail (md+). Icon-only at md, icon+label at lg. Active item is a full
// tonal fill + cyan text — never a colored side-stripe (DESIGN.md §5 / Don'ts).
export function Sidebar({ myCaseFileHref }: { myCaseFileHref: string | null }) {
  const pathname = usePathname();
  const items = buildNavItems(myCaseFileHref);

  return (
    <nav
      aria-label="Primary"
      className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] shrink-0 flex-col justify-between border-r border-ledger-teal bg-void-navy md:flex md:w-16 lg:w-56"
    >
      <ul className="flex flex-col gap-0.5 p-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isNavActive(item, pathname, myCaseFileHref);

          if (!item.href) {
            return (
              <li key={item.label}>
                <span
                  className="flex cursor-not-allowed items-center gap-3 px-3 py-2.5 font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink/70"
                  title={`${item.label} — ${item.phase}`}
                  aria-label={`${item.label} — ${item.phase}`}
                  aria-disabled="true"
                >
                  <Icon size={18} className="shrink-0" aria-hidden="true" />
                  <span className="hidden lg:inline">{item.label}</span>
                  <span className="ml-auto hidden font-[family-name:var(--font-jetbrains)] text-[0.625rem] tracking-normal text-muted-ink/60 lg:inline">
                    {item.phase}
                  </span>
                </span>
              </li>
            );
          }

          return (
            <li key={item.label}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
                className={`flex items-center gap-3 px-3 py-2.5 font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] transition-colors duration-150 ${
                  active
                    ? "bg-ledger-teal text-signal-cyan"
                    : "text-case-file-white hover:bg-elevated-ledger"
                }`}
              >
                <Icon size={18} className="shrink-0" aria-hidden="true" />
                <span className="hidden lg:inline">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="hidden border-t border-ledger-teal p-4 lg:block">
        <p className="font-[family-name:var(--font-jetbrains)] text-[0.625rem] leading-relaxed text-muted-ink">
          SKIZZO INC.
          <br />
          BUILD 19.3 · PHASE 7
        </p>
      </div>
    </nav>
  );
}
