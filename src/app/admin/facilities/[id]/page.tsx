import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Panel } from "@/components/ui/panel";
import { FormDialogTrigger } from "@/components/ui/form-dialog-trigger";
import { requireAdmin } from "@/lib/auth";
import { getShop, getEligibleListingCards } from "@/lib/shop-data";
import { ShopForm } from "../shop-form";
import { RestockRules } from "./restock-rules";
import { RestockNowButton } from "./restock-now-button";
import { ShopListingManagement } from "./shop-listings";

export const metadata: Metadata = { title: "Shop — Personnel Command" };

// Admin shop detail (Phase 4): listings, restock rules, and the rotation
// status/manual-restock control for one shop.
export default async function AdminShopDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const shop = await getShop(id);
  if (!shop) notFound();

  const eligibleCards = await getEligibleListingCards(id);

  return (
    <AppShell>
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:py-8">
        <Link
          href="/admin/shops"
          className="mb-5 inline-flex items-center gap-2 font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink transition-colors hover:text-signal-cyan pointer-coarse:min-h-11"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Shops
        </Link>

        <div className="mb-6 flex flex-col gap-3 border-b border-ledger-teal pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-[family-name:var(--font-rajdhani)] text-3xl font-bold uppercase leading-none tracking-[0.02em] text-case-file-white break-words sm:text-4xl">
              {shop.name}
            </h1>
            <p className="mt-2 max-w-prose text-sm text-muted-ink break-words">
              {shop.isOpen ? "Open" : "Closed"}
              {shop.description ? ` · ${shop.description}` : ""}
            </p>
          </div>
          <FormDialogTrigger label="Edit" title="Edit Shop">
            <ShopForm shop={shop} />
          </FormDialogTrigger>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex flex-col gap-6">
            <Panel
              title="Listings"
              meta={
                <span className="font-[family-name:var(--font-jetbrains)] text-[0.625rem] uppercase text-muted-ink">
                  {shop.listings.length} for sale
                </span>
              }
            >
              <ShopListingManagement
                shopId={shop.id}
                eligibleCards={eligibleCards}
                listings={shop.listings}
              />
            </Panel>
          </div>

          <div className="flex flex-col gap-6">
            <Panel title="Rotation">
              <div className="flex flex-col gap-4">
                <dl className="flex flex-col gap-3">
                  <div className="flex items-baseline justify-between border-b border-elevated-ledger pb-3">
                    <dt className="font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">
                      Rotating slots
                    </dt>
                    <dd className="font-[family-name:var(--font-jetbrains)] text-sm text-case-file-white">
                      {shop.rotatingSlotCount}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <dt className="font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">
                      Restock cadence
                    </dt>
                    <dd className="font-[family-name:var(--font-jetbrains)] text-sm text-case-file-white">
                      {shop.restockIntervalOps
                        ? `${shop.opsSinceRestock}/${shop.restockIntervalOps} ops`
                        : "Manual only"}
                    </dd>
                  </div>
                </dl>
                <RestockNowButton shopId={shop.id} />
              </div>
            </Panel>

            <Panel title="Restock Rules">
              <RestockRules shopId={shop.id} rules={shop.restockRules} />
            </Panel>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
