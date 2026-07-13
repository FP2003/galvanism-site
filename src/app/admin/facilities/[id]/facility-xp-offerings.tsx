"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Pencil, Plus, Power, X } from "lucide-react";
import { Select, TextInput, Textarea, FormMessage, fieldLabelClass } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  XP_OFFERING_TYPES,
  offeringTargetsFor,
  offeringTargetLabel,
  offeringCostCurrency,
  type XpOfferingType,
} from "@/lib/facilities";
import {
  addXpOffering,
  updateXpOffering,
  deleteXpOffering,
  setXpOfferingActive,
  type FormState,
} from "@/app/admin/facility-xp-offerings-actions";
import type { FacilityXpOffering } from "@/lib/schema";

const TYPE_LABELS: Record<XpOfferingType, string> = {
  stat_bump: "Stat bump",
  resource_refill: "Resource refill",
};

// Admin training/refill catalog for one facility (Phase 6 Step 2) — a
// permanent stat bump (priced in Currency XP) or a one-off current-resource
// refill (priced in Credits, like any other facility purchase). Same
// add/delete-row shape as RestockRules; `active` retires an offering without
// deleting it so historical ledger rows stay meaningful.
export function FacilityXpOfferings({
  facilityId,
  facilityLevel,
  offerings,
}: {
  facilityId: string;
  facilityLevel: number;
  offerings: FacilityXpOffering[];
}) {
  const [addState, addAction] = useActionState<FormState, FormData>(addXpOffering, {});

  return (
    <div className="flex flex-col gap-4">
      <p className="font-[family-name:var(--font-inter)] text-xs text-muted-ink">
        A stat bump is priced in Currency XP; a resource refill is priced in
        Credits. An offering with a Min Level above this facility&apos;s
        current level ({facilityLevel}) stays hidden from players until the
        facility is leveled up to match.
      </p>
      {offerings.length === 0 ? (
        <p className="font-[family-name:var(--font-inter)] text-xs text-muted-ink">
          No XP offerings yet.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-elevated-ledger border-y border-elevated-ledger">
          {offerings.map((o) => (
            <OfferingRow key={o.id} offering={o} />
          ))}
        </ul>
      )}

      <form action={addAction} className="flex flex-col gap-2">
        <input type="hidden" name="facilityId" value={facilityId} />
        <OfferingFields />
        <AddOfferingButton />
      </form>
      <FormMessage state={addState} />
    </div>
  );
}

// Shared field set for both the inline add-form above and the edit dialog
// below — offeringType is local state so changing it live-updates the target
// list and the amount/cost currency labels in either context.
function OfferingFields({ offering }: { offering?: FacilityXpOffering }) {
  const [offeringType, setOfferingType] = useState<XpOfferingType>(offering?.offeringType ?? "stat_bump");
  const targets = offeringTargetsFor(offeringType);
  const currency = offeringCostCurrency(offeringType);

  return (
    <>
      <TextInput
        name="name"
        aria-label="Name"
        placeholder="Name (e.g. Precision Drill)"
        maxLength={64}
        defaultValue={offering?.name}
        required
      />
      <Textarea
        name="description"
        aria-label="Description"
        placeholder="Description (optional)"
        rows={2}
        maxLength={400}
        defaultValue={offering?.description ?? undefined}
      />
      <div className="grid grid-cols-2 gap-2">
        <Select
          name="offeringType"
          aria-label="Type"
          value={offeringType}
          onChange={(e) => setOfferingType(e.target.value as XpOfferingType)}
        >
          {XP_OFFERING_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
        <Select name="targetKey" aria-label="Target" defaultValue={offering?.targetKey}>
          {targets.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-1">
          <span className={fieldLabelClass}>Amount</span>
          <TextInput
            name="amount"
            type="number"
            min={1}
            inputMode="numeric"
            aria-label="Amount"
            defaultValue={offering?.amount ?? 1}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className={fieldLabelClass}>{currency === "xp" ? "XP Cost" : "Credit Cost"}</span>
          <TextInput
            name="cost"
            type="number"
            min={1}
            inputMode="numeric"
            aria-label={currency === "xp" ? "XP cost" : "Credit cost"}
            defaultValue={offering?.cost ?? (currency === "xp" ? 50 : 100)}
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
            defaultValue={offering?.minLevel ?? 1}
          />
        </div>
      </div>
    </>
  );
}

function AddOfferingButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending} className="shrink-0">
      <Plus size={15} />
      {pending ? "Adding…" : "Add offering"}
    </Button>
  );
}

function OfferingRow({ offering }: { offering: FacilityXpOffering }) {
  const [, toggleAction] = useActionState<FormState, FormData>(setXpOfferingActive, {});
  const [, deleteAction] = useActionState<FormState, FormData>(deleteXpOffering, {});
  const label = offeringTargetLabel(offering.offeringType, offering.targetKey);
  const currencyLabel = offeringCostCurrency(offering.offeringType) === "xp" ? "XP" : "Cr";
  const [editOpen, setEditOpen] = useState(false);

  return (
    <li className="flex items-center gap-3 py-3">
      <span
        className={`size-2.5 shrink-0 ${offering.active ? "bg-steel-blue" : "bg-elevated-ledger"}`}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-[family-name:var(--font-chakra)] text-sm font-semibold uppercase tracking-[0.03em] text-case-file-white">
          {offering.name}
          {!offering.active && (
            <span className="ml-2 text-[0.625rem] text-muted-ink">Inactive</span>
          )}
        </p>
        <p className="truncate font-[family-name:var(--font-jetbrains)] text-[0.6875rem] text-muted-ink">
          +{offering.amount} {label} · {offering.cost} {currencyLabel} · Min Lv {offering.minLevel}
        </p>
      </div>
      <button
        type="button"
        aria-label={`Edit ${offering.name}`}
        onClick={() => setEditOpen(true)}
        className="flex size-8 shrink-0 items-center justify-center border border-elevated-ledger text-muted-ink transition-colors hover:border-signal-cyan hover:text-signal-cyan pointer-coarse:size-11"
      >
        <Pencil size={14} aria-hidden="true" />
      </button>
      <form action={toggleAction}>
        <input type="hidden" name="offeringId" value={offering.id} />
        <input type="hidden" name="active" value={(!offering.active).toString()} />
        <ToggleActiveButton
          active={offering.active}
          label={`${offering.active ? "Deactivate" : "Activate"} ${offering.name}`}
        />
      </form>
      <form action={deleteAction}>
        <input type="hidden" name="offeringId" value={offering.id} />
        <RemoveOfferingButton label={`Remove ${offering.name}`} />
      </form>
      <EditOfferingDialog open={editOpen} onClose={() => setEditOpen(false)} offering={offering} />
    </li>
  );
}

function EditOfferingDialog({
  open,
  onClose,
  offering,
}: {
  open: boolean;
  onClose: () => void;
  offering: FacilityXpOffering;
}) {
  const [state, action] = useActionState<FormState, FormData>(updateXpOffering, {});

  return (
    <Dialog open={open} onClose={onClose} title={`Edit ${offering.name}`}>
      <form action={action} className="flex flex-col gap-2">
        <input type="hidden" name="offeringId" value={offering.id} />
        <OfferingFields offering={offering} />
        <SaveOfferingButton />
        <FormMessage state={state} />
      </form>
    </Dialog>
  );
}

function SaveOfferingButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending} className="shrink-0">
      {pending ? "Saving…" : "Save changes"}
    </Button>
  );
}

function ToggleActiveButton({ active, label }: { active: boolean; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      aria-label={label}
      disabled={pending}
      className={`flex size-8 shrink-0 items-center justify-center border transition-colors disabled:opacity-60 pointer-coarse:size-11 ${
        active
          ? "border-elevated-ledger text-muted-ink hover:border-signal-cyan hover:text-signal-cyan"
          : "border-elevated-ledger text-muted-ink/50 hover:border-signal-cyan hover:text-signal-cyan"
      }`}
    >
      <Power size={14} aria-hidden="true" />
    </button>
  );
}

function RemoveOfferingButton({ label }: { label: string }) {
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
