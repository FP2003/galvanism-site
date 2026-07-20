"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, X, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, FormMessage } from "@/components/ui/form";
import { EquipToggleButton } from "@/components/cards/equip-toggle";
import {
  effectSummary,
  modDeltaSummary,
  CARD_CATEGORY_META,
  WEAPON_DAMAGE_TYPE_LABELS,
} from "@/lib/cards";
import type { Card } from "@/lib/schema";
import { partitionByWeapon, groupInstalledMods, type OwnedCard } from "@/lib/card-data";
import {
  assignCard,
  unassignCard,
  refundCardPurchase,
  detachMod,
  type FormState,
} from "@/app/admin/card-actions";
import { setCardEquipped, setWeaponSlot, type SheetState } from "@/app/roster/actions";
import { WEAPON_SLOTS, WEAPON_SLOT_META, isSlotLegalFor } from "@/lib/weapons";
import type { WeaponSlotName } from "@/lib/cards";
import {
  SLOT_LIMITED_CATEGORIES,
  tallyEquippedByCategory,
  canEquipInCategory,
  categorySlotUsage,
  sharedPoolRemaining,
  type SlotCountMap,
} from "@/lib/card-slots";

/*
 * Admin card assignment (Phase 3). Attaches library cards to one character's
 * inventory, toggles equipped, and removes them. Equip/unequip reuses the same
 * owner-or-admin action the player uses on their own case file.
 */
export function CardAssignment({
  characterId,
  library,
  owned,
  refundableCardIds,
  bonusByCategory,
}: {
  characterId: string;
  library: Card[];
  owned: OwnedCard[];
  refundableCardIds: Set<string>;
  bonusByCategory: SlotCountMap;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    assignCard,
    {},
  );

  const ownedIds = new Set(owned.map((o) => o.card.id));
  const assignable = library.filter((c) => !ownedIds.has(c.id));
  const equippedByCategory = tallyEquippedByCategory(owned);

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

      <SlotUsage equippedByCategory={equippedByCategory} bonusByCategory={bonusByCategory} />

      {owned.length > 0 &&
        (() => {
          const { weapons, mods, rest } = partitionByWeapon(owned);
          const { byHost } = groupInstalledMods(mods);
          const hostTitle = (assignmentId: string) =>
            weapons.find((w) => w.assignmentId === assignmentId)?.card.title ?? "—";
          return (
            <ul className="flex flex-col divide-y divide-elevated-ledger border-y border-elevated-ledger">
              {weapons.map((o) => (
                <WeaponRow
                  key={o.assignmentId}
                  characterId={characterId}
                  owned={o}
                  installedModCount={byHost.get(o.assignmentId)?.length ?? 0}
                  refundable={refundableCardIds.has(o.card.id)}
                />
              ))}
              {mods.map((o) => (
                <ModRow
                  key={o.assignmentId}
                  owned={o}
                  hostTitle={hostTitle}
                  refundable={refundableCardIds.has(o.card.id)}
                />
              ))}
              {rest.map((o) => (
                <OwnedRow
                  key={o.assignmentId}
                  characterId={characterId}
                  owned={o}
                  refundable={refundableCardIds.has(o.card.id)}
                  disabled={
                    !o.equipped &&
                    !canEquipInCategory(
                      o.card.category,
                      equippedByCategory,
                      bonusByCategory,
                      o.card.takesSlot,
                    )
                  }
                />
              ))}
            </ul>
          );
        })()}
    </div>
  );
}

// Mirrors roster/[slug]/ability-slots.tsx's category breakdown for the admin
// view — kept as a separate component rather than a shared import, same
// convention as WeaponRow/ModRow vs. the player-facing WeaponSlots/ModsSection
// (parallel admin/player row implementations rather than cross-surface sharing).
function SlotUsage({
  equippedByCategory,
  bonusByCategory,
}: {
  equippedByCategory: SlotCountMap;
  bonusByCategory: SlotCountMap;
}) {
  // Only categories with something currently equipped, or a bonus reserved
  // for them — an unequipped card sitting in inventory shouldn't surface a
  // "0 equipped" tile.
  const visible = SLOT_LIMITED_CATEGORIES.filter(
    (c) => equippedByCategory[c] > 0 || bonusByCategory[c] > 0,
  );
  if (visible.length === 0) return null;

  const usage = categorySlotUsage(equippedByCategory, bonusByCategory).filter((u) =>
    visible.includes(u.category),
  );
  const remaining = sharedPoolRemaining(equippedByCategory, bonusByCategory);

  return (
    <div className="border border-elevated-ledger px-3 py-2">
      <p className="font-[family-name:var(--font-jetbrains)] text-[0.6875rem] text-muted-ink">
        Ability slots — Base: {remaining} of 3 free
      </p>
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
        {usage.map((u) => (
          <li
            key={u.category}
            className="font-[family-name:var(--font-jetbrains)] text-[0.6875rem] text-muted-ink"
          >
            {CARD_CATEGORY_META[u.category].label}: {u.used}/{u.cap}
            {u.bonus > 0 ? ` (+${u.bonus})` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

// A weapon-subcategory row (rifle/pistol/melee): equip is a slot pick, not the
// plain boolean toggle used by everything else (info: card-data's
// partitionByWeapon / lib/weapons.ts).
function WeaponRow({
  characterId,
  owned,
  installedModCount,
  refundable,
}: {
  characterId: string;
  owned: OwnedCard;
  installedModCount: number;
  refundable: boolean;
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
    <li className="flex flex-wrap items-center gap-3 py-3">
      <span className="size-2.5 shrink-0 bg-muted-ink" aria-hidden="true" />
      <div className="min-w-0 flex-1 basis-full sm:basis-auto">
        <p className="truncate font-[family-name:var(--font-chakra)] text-sm font-semibold uppercase tracking-[0.03em] text-case-file-white">
          {card.title}
        </p>
        <p className="truncate font-[family-name:var(--font-jetbrains)] text-[0.6875rem] text-muted-ink">
          {card.damage}DMG
          {card.damageType && ` · ${WEAPON_DAMAGE_TYPE_LABELS[card.damageType]}`}
          {card.range != null && ` · ${card.range}M`}
          {card.handedness === "two_handed" ? " · 2H" : " · 1H"}
          {card.modSlots ? ` · Mods ${installedModCount}/${card.modSlots}` : ""}
        </p>
      </div>

      <div className="ml-[1.375rem] sm:ml-0">
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
      </div>

      {refundable && <RefundIconButton assignmentId={owned.assignmentId} title={card.title} />}

      <form action={removeAction}>
        <input type="hidden" name="assignmentId" value={owned.assignmentId} />
        <IconButton label={`Remove ${card.title}`} tone="danger">
          <X size={14} aria-hidden="true" />
        </IconButton>
      </form>
    </li>
  );
}

// A firearm_mod/melee_mod row. Mods have no equip toggle — installation
// (permanent for players) is their only "active" state, and only an admin can
// undo it. `hostTitle` resolves installedOnAssignmentId to the host weapon's
// title for display.
function ModRow({
  owned,
  hostTitle,
  refundable,
}: {
  owned: OwnedCard;
  hostTitle: (assignmentId: string) => string;
  refundable: boolean;
}) {
  const [, detachAction] = useActionState<FormState, FormData>(detachMod, {});
  const [, removeAction] = useActionState<FormState, FormData>(unassignCard, {});
  const { card } = owned;
  const deltas = modDeltaSummary(card);

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <span className="size-2.5 shrink-0 bg-muted-ink" aria-hidden="true" />
      <div className="min-w-0 flex-1 basis-full sm:basis-auto">
        <p className="truncate font-[family-name:var(--font-chakra)] text-sm font-semibold uppercase tracking-[0.03em] text-case-file-white">
          {card.title}
        </p>
        <p className="truncate font-[family-name:var(--font-jetbrains)] text-[0.6875rem] text-muted-ink">
          {CARD_CATEGORY_META[card.category].label}
          {deltas.length > 0 ? ` · ${deltas.join(" · ")}` : ""}
        </p>
      </div>

      <div className="ml-[1.375rem] sm:ml-0">
        {owned.installedOnAssignmentId ? (
          <form action={detachAction} className="flex items-center gap-2">
            <input type="hidden" name="assignmentId" value={owned.assignmentId} />
            <span className="font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-signal-cyan">
              On {hostTitle(owned.installedOnAssignmentId)}
            </span>
            <DetachButton />
          </form>
        ) : (
          <span className="font-[family-name:var(--font-chakra)] text-[0.625rem] uppercase tracking-[0.08em] text-muted-ink">
            Uninstalled
          </span>
        )}
      </div>

      {refundable && <RefundIconButton assignmentId={owned.assignmentId} title={card.title} />}

      <form action={removeAction}>
        <input type="hidden" name="assignmentId" value={owned.assignmentId} />
        <IconButton label={`Remove ${card.title}`} tone="danger">
          <X size={14} aria-hidden="true" />
        </IconButton>
      </form>
    </li>
  );
}

function DetachButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="border border-elevated-ledger px-2 py-1.5 font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-muted-ink transition-colors hover:border-stamp-red hover:text-stamp-red disabled:opacity-60 pointer-coarse:min-h-11"
    >
      {pending ? "…" : "Detach"}
    </button>
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
  refundable,
  disabled,
}: {
  characterId: string;
  owned: OwnedCard;
  refundable: boolean;
  disabled: boolean;
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
      <span className="size-2.5 shrink-0 bg-muted-ink" aria-hidden="true" />
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
        <EquipToggleButton
          equipped={owned.equipped}
          disabled={disabled}
          title={disabled ? "No free slot for this card's category." : undefined}
        />
      </form>

      {refundable && <RefundIconButton assignmentId={owned.assignmentId} title={card.title} />}

      <form action={removeAction}>
        <input type="hidden" name="assignmentId" value={owned.assignmentId} />
        <IconButton label={`Remove ${card.title}`} tone="danger">
          <X size={14} aria-hidden="true" />
        </IconButton>
      </form>
    </li>
  );
}

// Only rendered when a matching unrefunded facility purchase exists
// (refundableCardIds, computed server-side from the credit ledger) — a card
// an admin assigned for free has no purchase to reverse, so it only ever
// gets the plain Remove button above.
function RefundIconButton({ assignmentId, title }: { assignmentId: string; title: string }) {
  const [, refundAction] = useActionState<FormState, FormData>(refundCardPurchase, {});
  return (
    <form action={refundAction}>
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <IconButton label={`Refund ${title}`}>
        <Undo2 size={14} aria-hidden="true" />
      </IconButton>
    </form>
  );
}

function IconButton({
  label,
  tone = "refund",
  children,
}: {
  label: string;
  tone?: "danger" | "refund";
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
          : "border-elevated-ledger text-muted-ink hover:border-signal-cyan hover:text-signal-cyan"
      }`}
    >
      {children}
    </button>
  );
}
