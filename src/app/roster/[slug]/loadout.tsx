"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Power, PowerOff, Layers, Crosshair } from "lucide-react";
import { GameCard } from "@/components/cards/game-card";
import { Select } from "@/components/ui/form";
import { partitionByWeapon, type OwnedCard } from "@/lib/card-data";
import { setCardEquipped, setWeaponSlot, type SheetState } from "@/app/roster/actions";
import { WEAPON_SLOTS, WEAPON_SLOT_META, isSlotLegalFor } from "@/lib/weapons";
import type { WeaponSlotName } from "@/lib/cards";

/*
 * Case File loadout (Phase 3). Shows the operator's equipped cards as full card
 * faces; the owner/admin can toggle equip and see the unequipped inventory.
 * Read-only viewers see equipped cards only. GameCard is a pure presentational
 * component, so it renders fine inside this client boundary.
 */
export function Loadout({
  characterId,
  owned,
  canEdit,
}: {
  characterId: string;
  owned: OwnedCard[];
  canEdit: boolean;
}) {
  const { weapons, rest } = partitionByWeapon(owned);
  const equipped = rest.filter((o) => o.equipped);
  const inventory = rest.filter((o) => !o.equipped);

  if (owned.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
        <Layers size={28} className="text-steel-blue" aria-hidden="true" />
        <p className="font-[family-name:var(--font-chakra)] text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink">
          No cards assigned
        </p>
        <p className="max-w-xs text-pretty text-xs text-muted-ink">
          {canEdit
            ? "Cards assigned by the DM appear here to equip."
            : "This operator has no cards on file yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {(canEdit || weapons.length > 0) && (
        <WeaponSlots characterId={characterId} weapons={weapons} canEdit={canEdit} />
      )}
      <CardGroup
        heading="Equipped"
        cards={equipped}
        characterId={characterId}
        canEdit={canEdit}
        emptyNote={canEdit ? "Nothing equipped — equip a card below." : "Nothing equipped."}
      />
      {canEdit && inventory.length > 0 && (
        <CardGroup
          heading="Inventory"
          cards={inventory}
          characterId={characterId}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}

/*
 * Weapon loadout (pre-Phase 4). Rifle/pistol/melee cards use three fixed
 * slots instead of the generic equipped/inventory toggle above — a slot's
 * legality (which subcategory/handedness fits where) and conflict handling
 * (2H into Primary auto-clears Secondary) are enforced server-side in
 * setWeaponSlot; the isSlotLegalFor filter here is UX only, to avoid
 * offering a doomed choice.
 */
function WeaponSlots({
  characterId,
  weapons,
  canEdit,
}: {
  characterId: string;
  weapons: OwnedCard[];
  canEdit: boolean;
}) {
  const unslotted = weapons.filter((w) => !w.weaponSlot);

  return (
    <div>
      <h3 className="mb-3 font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-signal-cyan">
        Weapons
      </h3>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {WEAPON_SLOTS.map((slot) => {
          const occupant = weapons.find((w) => w.weaponSlot === slot);
          const candidates = unslotted.filter(
            (w) =>
              w.card.subcategory &&
              w.card.handedness &&
              isSlotLegalFor(
                { subcategory: w.card.subcategory as "rifle" | "pistol" | "melee", handedness: w.card.handedness },
                slot,
              ),
          );
          return (
            <li key={slot} className="flex flex-col gap-2">
              <span className="font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">
                {WEAPON_SLOT_META[slot].label}
              </span>
              {occupant ? (
                <>
                  <GameCard card={occupant.card} />
                  {canEdit && (
                    <WeaponSlotForm
                      characterId={characterId}
                      assignmentId={occupant.assignmentId}
                      slot=""
                      label="Unequip"
                    />
                  )}
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 border border-dashed border-elevated-ledger p-4 text-center">
                  <Crosshair size={20} className="text-steel-blue" aria-hidden="true" />
                  <p className="text-xs text-muted-ink">No weapon equipped</p>
                  {canEdit && candidates.length > 0 && (
                    <WeaponSlotAssignForm
                      characterId={characterId}
                      slot={slot}
                      candidates={candidates}
                    />
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {unslotted.length > 0 && (
        <p className="mt-3 text-xs text-muted-ink">
          Unslotted: {unslotted.map((w) => w.card.title).join(", ")}
        </p>
      )}
    </div>
  );
}

function WeaponSlotForm({
  characterId,
  assignmentId,
  slot,
  label,
}: {
  characterId: string;
  assignmentId: string;
  slot: WeaponSlotName | "";
  label: string;
}) {
  const [, formAction] = useActionState<SheetState, FormData>(setWeaponSlot, {});
  return (
    <form action={formAction}>
      <input type="hidden" name="characterId" value={characterId} />
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <input type="hidden" name="slot" value={slot} />
      <SlotSubmitButton label={label} />
    </form>
  );
}

function WeaponSlotAssignForm({
  characterId,
  slot,
  candidates,
}: {
  characterId: string;
  slot: WeaponSlotName;
  candidates: OwnedCard[];
}) {
  const [, formAction] = useActionState<SheetState, FormData>(setWeaponSlot, {});
  return (
    <form action={formAction} className="flex w-full flex-col gap-2">
      <input type="hidden" name="characterId" value={characterId} />
      <input type="hidden" name="slot" value={slot} />
      <Select
        name="assignmentId"
        aria-label={`Equip to ${WEAPON_SLOT_META[slot].label}`}
        defaultValue=""
        required
      >
        <option value="" disabled>
          Select a weapon…
        </option>
        {candidates.map((c) => (
          <option key={c.assignmentId} value={c.assignmentId}>
            {c.card.title}
          </option>
        ))}
      </Select>
      <SlotSubmitButton label="Equip" />
    </form>
  );
}

function SlotSubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center gap-1.5 border border-steel-blue px-2 py-1.5 font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-muted-ink transition-colors hover:bg-elevated-ledger hover:text-signal-cyan disabled:opacity-60 pointer-coarse:min-h-11"
    >
      {pending ? "…" : label}
    </button>
  );
}

function CardGroup({
  heading,
  cards,
  characterId,
  canEdit,
  emptyNote,
}: {
  heading: string;
  cards: OwnedCard[];
  characterId: string;
  canEdit: boolean;
  emptyNote?: string;
}) {
  return (
    <div>
      <h3 className="mb-3 font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-signal-cyan">
        {heading}
        <span className="ml-2 text-muted-ink">{cards.length}</span>
      </h3>
      {cards.length === 0 ? (
        <p className="text-xs text-muted-ink">{emptyNote}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {cards.map((o) => (
            <li key={o.assignmentId} className="flex flex-col gap-2">
              <GameCard card={o.card} />
              {canEdit && (
                <EquipForm
                  characterId={characterId}
                  assignmentId={o.assignmentId}
                  equipped={o.equipped}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EquipForm({
  characterId,
  assignmentId,
  equipped,
}: {
  characterId: string;
  assignmentId: string;
  equipped: boolean;
}) {
  const [, formAction] = useActionState<SheetState, FormData>(
    setCardEquipped,
    {},
  );
  return (
    <form action={formAction}>
      <input type="hidden" name="characterId" value={characterId} />
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <input type="hidden" name="equipped" value={String(!equipped)} />
      <ToggleButton equipped={equipped} />
    </form>
  );
}

function ToggleButton({ equipped }: { equipped: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex w-full items-center justify-center gap-1.5 border px-2 py-1.5 font-[family-name:var(--font-chakra)] text-[0.625rem] font-semibold uppercase tracking-[0.08em] transition-colors disabled:opacity-60 pointer-coarse:min-h-11 ${
        equipped
          ? "border-signal-cyan bg-signal-cyan/10 text-signal-cyan hover:bg-signal-cyan/20"
          : "border-steel-blue text-muted-ink hover:bg-elevated-ledger hover:text-signal-cyan"
      }`}
    >
      {equipped ? (
        <Power size={13} aria-hidden="true" />
      ) : (
        <PowerOff size={13} aria-hidden="true" />
      )}
      {pending ? "…" : equipped ? "Unequip" : "Equip"}
    </button>
  );
}
