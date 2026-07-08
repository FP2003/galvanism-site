"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Power, X } from "lucide-react";
import { TextInput, Textarea, FormMessage, fieldLabelClass } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { addPerk, deletePerk, setPerkActive, type FormState } from "@/app/admin/facility-perks-actions";
import type { FacilityPerk } from "@/lib/schema";

// Admin descriptive-perk catalog for one facility (Phase 6 Step 3) —
// Credits-priced, permanent per-character unlocks the DM manually honors at
// the table (e.g. the Communication Center's "Called Extraction time
// reduction"). Same add/delete-row + active-toggle shape as
// FacilityXpOfferings; no mechanical effect is attached to a perk.
export function FacilityPerks({
  facilityId,
  facilityLevel,
  perks,
}: {
  facilityId: string;
  facilityLevel: number;
  perks: FacilityPerk[];
}) {
  const [addState, addAction] = useActionState<FormState, FormData>(addPerk, {});

  return (
    <div className="flex flex-col gap-4">
      <p className="font-[family-name:var(--font-inter)] text-xs text-muted-ink">
        Purely descriptive — purchasing debits Credits and records the unlock;
        you honor the effect at the table. A perk with a Min Level above this
        facility&apos;s current level ({facilityLevel}) stays hidden from
        players until the facility is leveled up to match.
      </p>
      {perks.length === 0 ? (
        <p className="font-[family-name:var(--font-inter)] text-xs text-muted-ink">
          No perks yet.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-elevated-ledger border-y border-elevated-ledger">
          {perks.map((p) => (
            <PerkRow key={p.id} perk={p} />
          ))}
        </ul>
      )}

      <form action={addAction} className="flex flex-col gap-2">
        <input type="hidden" name="facilityId" value={facilityId} />
        <TextInput
          name="name"
          aria-label="Name"
          placeholder="Name (e.g. Called Extraction time reduction)"
          maxLength={64}
          required
        />
        <Textarea
          name="description"
          aria-label="Description"
          placeholder="Description — the effect you'll honor at the table"
          rows={2}
          maxLength={400}
        />
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Price (Credits)</span>
            <TextInput
              name="priceCredits"
              type="number"
              min={1}
              inputMode="numeric"
              aria-label="Price in Credits"
              defaultValue={100}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Min Level</span>
            <TextInput
              name="minLevel"
              type="number"
              min={1}
              inputMode="numeric"
              aria-label="Min level"
              defaultValue={1}
            />
          </div>
        </div>
        <AddPerkButton />
      </form>
      <FormMessage state={addState} />
    </div>
  );
}

function AddPerkButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending} className="shrink-0">
      <Plus size={15} />
      {pending ? "Adding…" : "Add perk"}
    </Button>
  );
}

function PerkRow({ perk }: { perk: FacilityPerk }) {
  const [, toggleAction] = useActionState<FormState, FormData>(setPerkActive, {});
  const [, deleteAction] = useActionState<FormState, FormData>(deletePerk, {});

  return (
    <li className="flex items-center gap-3 py-3">
      <span
        className={`size-2.5 shrink-0 ${perk.active ? "bg-steel-blue" : "bg-elevated-ledger"}`}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-[family-name:var(--font-chakra)] text-sm font-semibold uppercase tracking-[0.03em] text-case-file-white">
          {perk.name}
          {!perk.active && <span className="ml-2 text-[0.625rem] text-muted-ink">Inactive</span>}
        </p>
        <p className="truncate font-[family-name:var(--font-jetbrains)] text-[0.6875rem] text-muted-ink">
          {perk.priceCredits.toLocaleString()} Cr · Min Lv {perk.minLevel}
        </p>
      </div>
      <form action={toggleAction}>
        <input type="hidden" name="perkId" value={perk.id} />
        <input type="hidden" name="active" value={(!perk.active).toString()} />
        <ToggleActiveButton
          label={`${perk.active ? "Deactivate" : "Activate"} ${perk.name}`}
        />
      </form>
      <form action={deleteAction}>
        <input type="hidden" name="perkId" value={perk.id} />
        <RemovePerkButton label={`Remove ${perk.name}`} />
      </form>
    </li>
  );
}

function ToggleActiveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      aria-label={label}
      disabled={pending}
      className="flex size-8 shrink-0 items-center justify-center border border-elevated-ledger text-muted-ink transition-colors hover:border-signal-cyan hover:text-signal-cyan disabled:opacity-60 pointer-coarse:size-11"
    >
      <Power size={14} aria-hidden="true" />
    </button>
  );
}

function RemovePerkButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      aria-label={label}
      disabled={pending}
      className="flex size-8 shrink-0 items-center justify-center border border-elevated-ledger text-muted-ink transition-colors hover:border-stamp-red hover:text-stamp-red disabled:opacity-60 pointer-coarse:size-11"
    >
      <X size={14} aria-hidden="true" />
    </button>
  );
}
