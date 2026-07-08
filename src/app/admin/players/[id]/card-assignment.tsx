"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, FormMessage } from "@/components/ui/form";
import { EquipToggleButton } from "@/components/cards/equip-toggle";
import {
  effectSummary,
  CARD_CATEGORY_META,
  WEAPON_DAMAGE_TYPE_LABELS,
} from "@/lib/cards";
import type { Card } from "@/lib/schema";
import { partitionByWeapon, type OwnedCard } from "@/lib/card-data";
import {
  assignCard,
  unassignCard,
  type FormState,
} from "@/app/admin/card-actions";
import { setCardEquipped, setWeaponSlot, type SheetState } from "@/app/roster/actions";
import { WEAPON_SLOTS, WEAPON_SLOT_META, isSlotLegalFor } from "@/lib/weapons";
import type { WeaponSlotName } from "@/lib/cards";

/*
 * Admin card assignment (Phase 3). Attaches library cards to one character's
 * inventory, toggles equipped, and removes them. Equip/unequip reuses the same
 * owner-or-admin action the player uses on their own case file.
 */
export function CardAssignment({
  characterId,
  library,
  owned,
}: {
  characterId: string;
  library: Card[];
  owned: OwnedCard[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    assignCard,
    {},
  );

  const ownedIds = new Set(owned.map((o) => o.card.id));
  const assignable = library.filter((c) => !ownedIds.has(c.id));

  return (
    <div className="flex flex-col gap-5">
      {library.length === 0 ? (
        <p className="border border-signal-cyan/40 bg-signal-cyan/10 px-3 py-2 font-[family-name:var(--font-inter)] text-[0.8125rem] text-muted-ink">
          No cards in the library yet. Author some in the{" "}
          <span className="text-signal-cyan">Card Library</span> first.
        </p>
      ) : (
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="characterId" value={characterId} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select
              name="cardId"
              aria-label="Card to assign"
              defaultValue=""
              disabled={assignable.length === 0}
              wrapperClassName="flex-1"
            >
              <option value="" disabled>
                {assignable.length === 0
                  ? "Every card is already assigned"
                  : "Select a card…"}
              </option>
              {assignable.map((c) => (
                <option key={c.id} value={c.id}>
                  {CARD_CATEGORY_META[c.category].label} · {c.title}
                </option>
              ))}
            </Select>
            <AssignButton disabled={assignable.length === 0} />
          </div>
          <FormMessage state={state} />
        </form>
      )}

      {owned.length > 0 &&
        (() => {
          const { weapons, rest } = partitionByWeapon(owned);
          return (
            <ul className="flex flex-col divide-y divide-elevated-ledger border-y border-elevated-ledger">
              {weapons.map((o) => (
                <WeaponRow key={o.assignmentId} characterId={characterId} owned={o} />
              ))}
              {rest.map((o) => (
                <OwnedRow key={o.assignmentId} characterId={characterId} owned={o} />
              ))}
            </ul>
          );
        })()}
    </div>
  );
}

// A weapon-subcategory row (rifle/pistol/melee): equip is a slot pick, not the
// plain boolean toggle used by everything else (info: card-data's
// partitionByWeapon / lib/weapons.ts).
function WeaponRow({
  characterId,
  owned,
}: {
  characterId: string;
  owned: OwnedCard;
}) {
  const [, slotAction] = useActionState<SheetState, FormData>(setWeaponSlot, {});
  const [, removeAction] = useActionState<FormState, FormData>(unassignCard, {});
  const { card } = owned;
  const subcategory = card.subcategory as "rifle" | "pistol" | "melee";
  const candidateSlots =
    !owned.weaponSlot && card.handedness
      ? WEAPON_SLOTS.filter((slot) =>
          isSlotLegalFor({ subcategory, handedness: card.handedness! }, slot),
        )
      : [];

  return (
    <li className="flex items-center gap-3 py-3">
      <span className="size-2.5 shrink-0 bg-steel-blue" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-[family-name:var(--font-chakra)] text-sm font-semibold uppercase tracking-[0.03em] text-case-file-white">
          {card.title}
        </p>
        <p className="truncate font-[family-name:var(--font-jetbrains)] text-[0.6875rem] text-muted-ink">
          {card.damage}DMG
          {card.damageType && ` · ${WEAPON_DAMAGE_TYPE_LABELS[card.damageType]}`}
          {card.range != null && ` · ${card.range}M`}
          {card.handedness === "two_handed" ? " · 2H" : " · 1H"}
        </p>
      </div>

      {owned.weaponSlot ? (
        <form action={slotAction} className="flex items-center gap-2">
          <input type="hidden" name="characterId" value={characterId} />
          <input type="hidden" name="assignmentId" value={owned.assignmentId} />
          <input type="hidden" name="slot" value="" />
          <span className="font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-signal-cyan">
            {WEAPON_SLOT_META[owned.weaponSlot].label}
          </span>
          <EquipToggleButton equipped />
        </form>
      ) : candidateSlots.length > 0 ? (
        <form action={slotAction} className="flex items-center gap-2">
          <input type="hidden" name="characterId" value={characterId} />
          <input type="hidden" name="assignmentId" value={owned.assignmentId} />
          <SlotSelect card={card} candidateSlots={candidateSlots} />
        </form>
      ) : (
        <span className="font-[family-name:var(--font-chakra)] text-[0.625rem] uppercase tracking-[0.08em] text-muted-ink">
          Unslotted
        </span>
      )}

      <form action={removeAction}>
        <input type="hidden" name="assignmentId" value={owned.assignmentId} />
        <IconButton label={`Remove ${card.title}`} tone="danger">
          <X size={14} aria-hidden="true" />
        </IconButton>
      </form>
    </li>
  );
}

// Picking a slot is the whole interaction — no separate "Equip" button next
// to it, since that meant two controls for one action (and the button was
// easy to click before ever touching the dropdown, see setWeaponSlot's
// empty-slot guard). Selecting a real option submits the form immediately.
function SlotSelect({
  card,
  candidateSlots,
}: {
  card: Card;
  candidateSlots: WeaponSlotName[];
}) {
  const { pending } = useFormStatus();
  return (
    <Select
      name="slot"
      aria-label={`Equip ${card.title} to a slot`}
      defaultValue=""
      required
      disabled={pending}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className="h-10 w-36 shrink-0"
    >
      <option value="" disabled>
        {pending ? "…" : "Equip to…"}
      </option>
      {candidateSlots.map((slot) => (
        <option key={slot} value={slot}>
          {WEAPON_SLOT_META[slot].label}
        </option>
      ))}
    </Select>
  );
}

function AssignButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="secondary"
      disabled={pending || disabled}
      className="shrink-0"
    >
      <Plus size={15} />
      {pending ? "Assigning…" : "Assign"}
    </Button>
  );
}

function OwnedRow({
  characterId,
  owned,
}: {
  characterId: string;
  owned: OwnedCard;
}) {
  const [, equipAction] = useActionState<SheetState, FormData>(
    setCardEquipped,
    {},
  );
  const [, removeAction] = useActionState<FormState, FormData>(
    unassignCard,
    {},
  );
  const { card } = owned;
  const summary =
    card.effects.length > 0
      ? card.effects.map(effectSummary).join(", ")
      : null;

  return (
    <li className="flex items-center gap-3 py-3">
      <span className="size-2.5 shrink-0 bg-steel-blue" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-[family-name:var(--font-chakra)] text-sm font-semibold uppercase tracking-[0.03em] text-case-file-white">
          {card.title}
        </p>
        <p className="truncate font-[family-name:var(--font-inter)] text-[0.6875rem] text-muted-ink">
          {CARD_CATEGORY_META[card.category].label}
          {summary
            ? ` · ${summary}`
            : card.descriptiveText
              ? " · Descriptive"
              : ""}
        </p>
      </div>

      <form action={equipAction}>
        <input type="hidden" name="characterId" value={characterId} />
        <input type="hidden" name="assignmentId" value={owned.assignmentId} />
        <input type="hidden" name="equipped" value={String(!owned.equipped)} />
        <EquipToggleButton equipped={owned.equipped} />
      </form>

      <form action={removeAction}>
        <input type="hidden" name="assignmentId" value={owned.assignmentId} />
        <IconButton label={`Remove ${card.title}`} tone="danger">
          <X size={14} aria-hidden="true" />
        </IconButton>
      </form>
    </li>
  );
}

function IconButton({
  label,
  tone,
  children,
}: {
  label: string;
  tone: "danger";
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      aria-label={label}
      disabled={pending}
      className={`flex size-8 shrink-0 items-center justify-center border transition-colors disabled:opacity-60 pointer-coarse:size-11 ${
        tone === "danger"
          ? "border-elevated-ledger text-muted-ink hover:border-stamp-red hover:text-stamp-red"
          : ""
      }`}
    >
      {children}
    </button>
  );
}
