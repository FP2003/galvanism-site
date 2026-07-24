import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Panel } from "@/components/ui/panel";
import { FormDialogTrigger } from "@/components/ui/form-dialog-trigger";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { requireAdmin } from "@/lib/auth";
import { getFacility, getEligibleListingCards } from "@/lib/facility-data";
import { FacilityForm } from "../facility-form";
import { RestockRules } from "./restock-rules";
import { RestockNowButton } from "./restock-now-button";
import { FacilityListingManagement } from "./facility-listings";
import { FacilityXpOfferings } from "./facility-xp-offerings";
import { FacilityPerks } from "./facility-perks";
import { FacilityOngoing } from "./facility-ongoing";

export const metadata: Metadata = { title: "Facility · Personnel Command" };

// Admin facility detail (Phase 6, absorbing Phase 4's shop detail): level,
// listings, restock rules, and the rotation status/manual-restock control
// for one facility.
export default async function AdminFacilityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const facility = await getFacility(id);
  if (!facility) notFound();

  const eligibleCards = await getEligibleListingCards(id);

  return (
    <AppShell>
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:py-8">
        <Link
          href="/admin/facilities"
          className="mb-5 inline-flex items-center gap-2 font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink transition-colors hover:text-signal-cyan pointer-coarse:min-h-11"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Facilities
        </Link>

        <div className="mb-6 flex flex-col gap-3 border-b border-ledger-teal pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-[family-name:var(--font-rajdhani)] text-3xl font-bold uppercase leading-none tracking-[0.02em] text-case-file-white break-words sm:text-4xl">
              {facility.name}
            </h1>
            <p className="mt-2 max-w-prose text-sm text-muted-ink break-words">
              {facility.isOpen ? "Open" : "Closed"}
              {facility.kind === "station" ? ` · Level ${facility.level}` : " · Field"}
              {facility.description ? ` · ${facility.description}` : ""}
            </p>
          </div>
          <FormDialogTrigger label="Edit" title="Edit Facility">
            <FacilityForm facility={facility} />
          </FormDialogTrigger>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex flex-col gap-6">
            <Panel
              title="Listings"
              meta={
                <span className="font-[family-name:var(--font-jetbrains)] text-[0.625rem] uppercase text-muted-ink">
                  {facility.listings.length} for sale
                </span>
              }
            >
              <FacilityListingManagement
                facilityId={facility.id}
                eligibleCards={eligibleCards}
                listings={facility.listings}
              />
            </Panel>

            <Panel title="Ongoing">
              <FacilityOngoing facilityId={facility.id} entries={facility.ongoingEntries} />
            </Panel>

            <Panel title="Training Offerings">
              <FacilityXpOfferings
                facilityId={facility.id}
                facilityLevel={facility.level}
                offerings={facility.xpOfferings}
              />
            </Panel>

            <Panel title="Perks">
              <FacilityPerks facilityId={facility.id} facilityLevel={facility.level} perks={facility.perks} />
            </Panel>
          </div>

          <div className="flex flex-col gap-6">
            <Panel
              title={
                <span className="flex items-center gap-1.5">
                  Rotation
                  <InfoTooltip label="Restock now re-rolls every rotating slot at once, weighted-picking a new card per slot from the Restock Rules below (eligible cards at or below this facility's level). It never touches manually-added listings, and it resets the ops counter, regardless of the auto-restock cadence threshold." />
                </span>
              }
            >
              <div className="flex flex-col gap-4">
                <dl className="flex flex-col gap-3">
                  <div className="flex items-baseline justify-between border-b border-elevated-ledger pb-3">
                    <dt className="font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">
                      Rotating slots
                    </dt>
                    <dd className="font-[family-name:var(--font-jetbrains)] text-sm text-case-file-white">
                      {facility.rotatingSlotCount}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <dt className="font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">
                      Restock cadence
                    </dt>
                    <dd className="font-[family-name:var(--font-jetbrains)] text-sm text-case-file-white">
                      {facility.restockIntervalOps
                        ? `${facility.opsSinceRestock}/${facility.restockIntervalOps} ops`
                        : "Manual only"}
                    </dd>
                  </div>
                </dl>
                <RestockNowButton facilityId={facility.id} />
              </div>
            </Panel>

            <Panel title="Restock Rules">
              <RestockRules facilityId={facility.id} facilityLevel={facility.level} rules={facility.restockRules} />
            </Panel>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
