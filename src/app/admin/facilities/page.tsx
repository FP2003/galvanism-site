import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Factory, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Panel } from "@/components/ui/panel";
import { StatusLabel } from "@/components/ui/status-dot";
import { requireAdmin } from "@/lib/auth";
import { getFacilities } from "@/lib/facility-data";
import { NewFacilityDialog } from "./new-facility-dialog";
import { FacilityMenu } from "./facility-menu";

export const metadata: Metadata = { title: "Facilities · Personnel Command" };

// Admin facility list (info/roadmap.md Phase 6, absorbing Phase 4's shop
// list). Each row links to the facility's detail page for listing + restock
// rule management.
export default async function AdminFacilitiesPage() {
  await requireAdmin();
  const facilityList = await getFacilities();

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
            Facilities
          </h1>
          <p className="mt-2 max-w-prose text-sm text-muted-ink">
            Manage what&rsquo;s for sale, trained, or unlocked, and to whom. Open
            facilities appear on every operator&rsquo;s Facilities page; rotating
            slots restock automatically as configured, or on demand from a
            facility&rsquo;s detail page.
          </p>
        </div>

        <Panel
          title="All Facilities"
          meta={
            <div className="flex items-center gap-3">
              <span className="font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.06em] text-muted-ink">
                {facilityList.length} facilit{facilityList.length === 1 ? "y" : "ies"}
              </span>
              <NewFacilityDialog />
            </div>
          }
          bodyClassName={facilityList.length === 0 ? undefined : "p-0"}
        >
          {facilityList.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <Factory size={28} className="text-steel-blue" aria-hidden="true" />
              <p className="font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink">
                No facilities yet
              </p>
              <p className="max-w-xs text-pretty text-xs text-muted-ink">
                Use New Facility above to stand up the first one.
              </p>
            </div>
          ) : (
            <ul>
              {facilityList.map((facility) => (
                <li
                  key={facility.id}
                  className="group flex items-center gap-4 border-b border-elevated-ledger px-5 py-4 transition-colors last:border-b-0 hover:bg-elevated-ledger"
                >
                  <Link
                    href={`/admin/facilities/${facility.id}`}
                    className="flex min-w-0 flex-1 items-center gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="min-w-0 truncate font-[family-name:var(--font-chakra)] text-sm font-bold uppercase tracking-[0.04em] text-case-file-white">
                          {facility.name}
                        </span>
                        <StatusLabel tone={facility.isOpen ? "live" : "neutral"}>
                          {facility.isOpen ? "Open" : "Closed"}
                        </StatusLabel>
                        {facility.kind === "station" && (
                          <StatusLabel tone="neutral">Lv {facility.level}</StatusLabel>
                        )}
                        <StatusLabel tone="neutral">
                          {facility.kind === "station" ? "Station" : "Field"}
                        </StatusLabel>
                      </div>
                      <p className="mt-1 font-[family-name:var(--font-jetbrains)] text-[0.6875rem] text-muted-ink">
                        {facility.listings.length} listing{facility.listings.length === 1 ? "" : "s"} ·{" "}
                        {facility.rotatingSlotCount} rotating slot{facility.rotatingSlotCount === 1 ? "" : "s"} ·{" "}
                        {facility.restockIntervalOps
                          ? `restocks every ${facility.restockIntervalOps} op${facility.restockIntervalOps === 1 ? "" : "s"} (${facility.opsSinceRestock}/${facility.restockIntervalOps})`
                          : "manual restock only"}
                      </p>
                    </div>
                    <ChevronRight
                      size={16}
                      className="shrink-0 text-steel-blue transition-colors group-hover:text-signal-cyan"
                      aria-hidden="true"
                    />
                  </Link>
                  <FacilityMenu facility={facility} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
