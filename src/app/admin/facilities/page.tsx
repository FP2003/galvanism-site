import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Store, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Panel } from "@/components/ui/panel";
import { StatusLabel } from "@/components/ui/status-dot";
import { requireAdmin } from "@/lib/auth";
import { getShops } from "@/lib/shop-data";
import { NewShopDialog } from "./new-shop-dialog";
import { ShopMenu } from "./shop-menu";

export const metadata: Metadata = { title: "Shops — Personnel Command" };

// Admin shop list (info/roadmap.md Phase 4). Each row links to the shop's
// detail page for listing + restock rule management.
export default async function AdminShopsPage() {
  await requireAdmin();
  const shopList = await getShops();

  return (
    <AppShell>
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:py-8">
        <Link
          href="/admin"
          className="mb-5 inline-flex items-center gap-2 font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink transition-colors hover:text-signal-cyan pointer-coarse:min-h-11"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Personnel Command
        </Link>

        <div className="mb-6 border-b border-ledger-teal pb-5">
          <h1 className="font-[family-name:var(--font-rajdhani)] text-3xl font-bold uppercase leading-none tracking-[0.02em] text-case-file-white sm:text-4xl">
            Shops
          </h1>
          <p className="mt-2 max-w-prose text-sm text-muted-ink">
            Manage what&rsquo;s for sale and to whom. Open shops appear in every
            operator&rsquo;s Requisitions tab; rotating slots restock automatically
            as configured, or on demand from a shop&rsquo;s detail page.
          </p>
        </div>

        <Panel
          title="All Shops"
          meta={
            <div className="flex items-center gap-3">
              <span className="font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.06em] text-muted-ink">
                {shopList.length} shop{shopList.length === 1 ? "" : "s"}
              </span>
              <NewShopDialog />
            </div>
          }
          bodyClassName={shopList.length === 0 ? undefined : "p-0"}
        >
          {shopList.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <Store size={28} className="text-steel-blue" aria-hidden="true" />
              <p className="font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink">
                No shops yet
              </p>
              <p className="max-w-xs text-pretty text-xs text-muted-ink">
                Use New Shop above to open the first one.
              </p>
            </div>
          ) : (
            <ul>
              {shopList.map((shop) => (
                <li
                  key={shop.id}
                  className="group flex items-center gap-4 border-b border-elevated-ledger px-5 py-4 transition-colors last:border-b-0 hover:bg-elevated-ledger"
                >
                  <Link href={`/admin/shops/${shop.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-[family-name:var(--font-chakra)] text-sm font-bold uppercase tracking-[0.04em] text-case-file-white">
                          {shop.name}
                        </span>
                        <StatusLabel tone={shop.isOpen ? "live" : "neutral"}>
                          {shop.isOpen ? "Open" : "Closed"}
                        </StatusLabel>
                      </div>
                      <p className="mt-1 font-[family-name:var(--font-jetbrains)] text-[0.6875rem] text-muted-ink">
                        {shop.listings.length} listing{shop.listings.length === 1 ? "" : "s"} ·{" "}
                        {shop.rotatingSlotCount} rotating slot{shop.rotatingSlotCount === 1 ? "" : "s"} ·{" "}
                        {shop.restockIntervalOps
                          ? `restocks every ${shop.restockIntervalOps} op${shop.restockIntervalOps === 1 ? "" : "s"} (${shop.opsSinceRestock}/${shop.restockIntervalOps})`
                          : "manual restock only"}
                      </p>
                    </div>
                    <ChevronRight
                      size={16}
                      className="shrink-0 text-steel-blue transition-colors group-hover:text-signal-cyan"
                      aria-hidden="true"
                    />
                  </Link>
                  <ShopMenu shop={shop} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
