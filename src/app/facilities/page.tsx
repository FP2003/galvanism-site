import Link from "next/link";
import type { Metadata } from "next";
import { Factory, Store, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Panel } from "@/components/ui/panel";
import { StatusLabel } from "@/components/ui/status-dot";
import { requireUser } from "@/lib/auth";
import { getFacilities } from "@/lib/facility-data";
import type { Facility } from "@/lib/schema";

export const metadata: Metadata = { title: "Facilities" };

// Player-facing facility directory (Phase 6, replacing Phase 4's aggregate
// /requisitions browse page). Split into "The Station" (named, leveled
// services) and "Field" (small, never-leveled flavor shops) — each links to
// its own detail page for the actual browsing/purchase/training UI.
export default async function FacilitiesPage() {
  await requireUser();
  const facilityList = (await getFacilities()).filter((f) => f.isOpen);
  const station = facilityList.filter((f) => f.kind === "station");
  const field = facilityList.filter((f) => f.kind === "field");

  return (
    <AppShell>
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:py-8">
        <div className="mb-6 border-b border-ledger-teal pb-5">
          <h1 className="font-[family-name:var(--font-rajdhani)] text-3xl font-bold uppercase leading-none tracking-[0.02em] text-case-file-white sm:text-4xl">
            Facilities
          </h1>
          <p className="mt-2 max-w-prose text-sm text-muted-ink">
            Station services and field shops. Open one to browse its stock,
            training, and unlocks.
          </p>
        </div>

        <div className="flex flex-col gap-6">
          <FacilityGroup
            title="The Station"
            icon={<Factory size={28} className="text-steel-blue" aria-hidden="true" />}
            emptyLabel="No station facilities open right now."
            facilities={station}
          />
          <FacilityGroup
            title="Field"
            icon={<Store size={28} className="text-steel-blue" aria-hidden="true" />}
            emptyLabel="No field shops open right now."
            facilities={field}
          />
        </div>
      </div>
    </AppShell>
  );
}

function FacilityGroup({
  title,
  icon,
  emptyLabel,
  facilities,
}: {
  title: string;
  icon: React.ReactNode;
  emptyLabel: string;
  facilities: Facility[];
}) {
  return (
    <Panel
      title={title}
      meta={
        <span className="font-[family-name:var(--font-jetbrains)] text-[0.625rem] uppercase text-muted-ink">
          {facilities.length} open
        </span>
      }
      bodyClassName={facilities.length === 0 ? undefined : "p-0"}
    >
      {facilities.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          {icon}
          <p className="max-w-sm text-pretty text-sm text-muted-ink">{emptyLabel}</p>
        </div>
      ) : (
        <ul>
          {facilities.map((facility) => (
            <li key={facility.id} className="border-b border-elevated-ledger last:border-b-0">
              <Link
                href={`/facilities/${facility.id}`}
                className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-elevated-ledger"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-[family-name:var(--font-chakra)] text-sm font-bold uppercase tracking-[0.04em] text-case-file-white">
                      {facility.name}
                    </span>
                    {facility.kind === "station" && (
                      <StatusLabel tone="neutral">Lv {facility.level}</StatusLabel>
                    )}
                  </div>
                  {facility.description && (
                    <p className="mt-1 truncate font-[family-name:var(--font-inter)] text-[0.75rem] text-muted-ink">
                      {facility.description}
                    </p>
                  )}
                </div>
                <ChevronRight
                  size={16}
                  className="shrink-0 text-steel-blue transition-colors group-hover:text-signal-cyan"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
