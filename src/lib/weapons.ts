/*
 * Pure weapon-slot logic (pre-Phase 4). No DB/React imports so it's
 * unit-testable in isolation (lib/weapons.test.ts), mirroring lib/cards.ts's
 * convention. Covers: which weapon shapes are legal in which of the three
 * equip slots, what happens on conflict, and server-trusted validation of a
 * weapon card's mechanical fields.
 */
import type { Result } from "./ledger";
import { CARD_TEXT_LIMITS, isWeaponSubcategory, WEAPON_DAMAGE_TYPES } from "./cards";
import type {
  ItemSubcategory,
  WeaponHandedness,
  WeaponDamageType,
  WeaponSlotName,
} from "./cards";

export const WEAPON_SLOTS: WeaponSlotName[] = ["primary", "secondary", "tertiary"];

export const WEAPON_SLOT_META: Record<WeaponSlotName, { label: string }> = {
  primary: { label: "Primary" },
  secondary: { label: "Secondary" },
  tertiary: { label: "Tertiary" },
};

/** The slot-relevant shape of a weapon card. */
export interface WeaponCardFields {
  subcategory: "rifle" | "pistol" | "melee";
  handedness: WeaponHandedness;
}

/**
 * Whether a weapon (by subcategory + handedness) is legal in a given slot,
 * independent of what else is currently equipped:
 * - primary: any weapon subcategory, any handedness.
 * - secondary: any weapon subcategory, but one-handed only — a two-handed
 *   weapon takes both hands, so it can only ever occupy primary.
 * - tertiary: melee/pistol only, one-handed only (rifle and any two-handed
 *   weapon are always illegal here).
 */
export function isSlotLegalFor(
  weapon: WeaponCardFields,
  slot: WeaponSlotName,
): boolean {
  if (slot === "tertiary") {
    return (
      (weapon.subcategory === "melee" || weapon.subcategory === "pistol") &&
      weapon.handedness === "one_handed"
    );
  }
  if (slot === "secondary") {
    return weapon.handedness === "one_handed";
  }
  return true;
}

/** One character's currently-occupied weapon slots, keyed by slot name. */
export type OccupiedSlots = Partial<
  Record<WeaponSlotName, ({ assignmentId: string } & WeaponCardFields) | undefined>
>;

export interface SlotAssignmentPlan {
  /** Slots (other than the target) that must be vacated as a side effect. */
  slotsToClear: WeaponSlotName[];
}

function illegalSlotMessage(weapon: WeaponCardFields, slot: WeaponSlotName): string {
  if (slot === "tertiary" && weapon.handedness === "two_handed") {
    return "Two-handed weapons can't be equipped in the Tertiary slot.";
  }
  if (slot === "tertiary") {
    return "Only melee and pistol weapons can be equipped in the Tertiary slot.";
  }
  if (slot === "secondary" && weapon.handedness === "two_handed") {
    return "Two-handed weapons can't be equipped in the Secondary slot — only Primary.";
  }
  return "This weapon can't be equipped in that slot.";
}

/**
 * Validates equipping `weapon` (currently at `assignmentId`, or not yet
 * equipped anywhere) into `targetSlot` given the character's current slot
 * occupancy, and returns which *other* slots must be vacated as a side
 * effect. Whatever currently occupies `targetSlot` itself (under a different
 * assignmentId) is the caller's responsibility to evict via its own UPDATE —
 * not this function's concern.
 */
export function resolveWeaponSlotAssignment(
  weapon: WeaponCardFields,
  assignmentId: string,
  targetSlot: WeaponSlotName,
  occupied: OccupiedSlots,
): Result<SlotAssignmentPlan> {
  if (!isSlotLegalFor(weapon, targetSlot)) {
    return { ok: false, error: illegalSlotMessage(weapon, targetSlot) };
  }

  const slotsToClear: WeaponSlotName[] = [];
  if (targetSlot === "primary" && weapon.handedness === "two_handed") {
    const secondary = occupied.secondary;
    if (secondary && secondary.assignmentId !== assignmentId) {
      slotsToClear.push("secondary");
    }
  }
  return { ok: true, value: { slotsToClear } };
}

export interface WeaponFieldsInput {
  subcategory: ItemSubcategory;
  handedness: WeaponHandedness | null;
  damageType: WeaponDamageType | null;
  damage: number | null;
  range: number | null;
  ammoCount: number | null;
}

/**
 * Server-trusted validation of a card's weapon fields (used by createCard).
 * Weapon subcategories require handedness + damage type + a positive integer
 * damage; range/ammoCount are optional but must be non-negative integers if
 * given. Non-weapon subcategories must not carry any of these fields —
 * rejects stray weapon data smuggled onto a medical/grenade/other card.
 */
export function validateWeaponFields(
  input: WeaponFieldsInput,
): Result<WeaponFieldsInput> {
  if (!isWeaponSubcategory(input.subcategory)) {
    if (
      input.handedness !== null ||
      input.damageType !== null ||
      input.damage !== null ||
      input.range !== null ||
      input.ammoCount !== null
    ) {
      return {
        ok: false,
        error: "Weapon fields can only be set on rifle, pistol, or melee items.",
      };
    }
    return { ok: true, value: input };
  }

  if (input.handedness !== "one_handed" && input.handedness !== "two_handed") {
    return { ok: false, error: "Pick a handedness for this weapon." };
  }
  if (!input.damageType || !WEAPON_DAMAGE_TYPES.includes(input.damageType)) {
    return { ok: false, error: "Pick a damage type for this weapon." };
  }
  if (
    input.damage === null ||
    !Number.isInteger(input.damage) ||
    input.damage <= 0 ||
    input.damage > CARD_TEXT_LIMITS.damageAbs
  ) {
    return { ok: false, error: "Damage must be a positive whole number." };
  }
  if (
    input.range !== null &&
    (!Number.isInteger(input.range) ||
      input.range < 0 ||
      input.range > CARD_TEXT_LIMITS.rangeAbs)
  ) {
    return { ok: false, error: "Range must be a non-negative whole number." };
  }
  if (
    input.ammoCount !== null &&
    (!Number.isInteger(input.ammoCount) ||
      input.ammoCount < 0 ||
      input.ammoCount > CARD_TEXT_LIMITS.ammoCountAbs)
  ) {
    return { ok: false, error: "Ammo count must be a non-negative whole number." };
  }
  return { ok: true, value: input };
}
