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
  CardCategory,
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
    return "Two-handed weapons can't be equipped in the Secondary slot (only Primary).";
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

  // A two-handed Primary occupies Secondary too, even though it's only
  // recorded against the "primary" slot in storage — Secondary never gets
  // its own row for it, so this can't be caught by isSlotLegalFor alone.
  if (targetSlot === "secondary") {
    const primary = occupied.primary;
    if (
      primary &&
      primary.assignmentId !== assignmentId &&
      primary.handedness === "two_handed"
    ) {
      return {
        ok: false,
        error: "Secondary is occupied by the two-handed weapon in Primary.",
      };
    }
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
  modSlots: number | null;
}

/**
 * Server-trusted validation of a card's weapon fields (used by createCard).
 * Weapon subcategories require handedness + damage type + a positive integer
 * damage; range/ammoCount/modSlots are optional but must be non-negative
 * integers if given. Non-weapon subcategories must not carry any of these
 * fields — rejects stray weapon data smuggled onto a medical/grenade/other
 * card.
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
      input.ammoCount !== null ||
      input.modSlots !== null
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
  if (
    input.modSlots !== null &&
    (!Number.isInteger(input.modSlots) ||
      input.modSlots < 0 ||
      input.modSlots > CARD_TEXT_LIMITS.modSlotsMax)
  ) {
    return {
      ok: false,
      error: `Mod slots must be a whole number from 0 to ${CARD_TEXT_LIMITS.modSlotsMax}.`,
    };
  }
  return { ok: true, value: input };
}

// ---------------------------------------------------------------------------
// Weapon customisation (FIREARM MOD / MELEE MOD). A mod card installs
// permanently onto one of the character's owned weapon rows (lib/card-data.ts
// / roster/actions.ts installMod), contributing a structured delta to that
// weapon's displayed damage/range/damage-type — everything else about a mod
// (EP penalties, ACC, stealth %, SHOCK, ...) is descriptive text the DM
// adjudicates, same split as the wider card system.
// ---------------------------------------------------------------------------

/** Which mod category installs on a given weapon subcategory. */
export function modCategoryForWeapon(
  subcategory: "rifle" | "pistol" | "melee",
): "firearm_mod" | "melee_mod" {
  return subcategory === "melee" ? "melee_mod" : "firearm_mod";
}

export interface ModFieldsInput {
  category: CardCategory;
  modDamageDelta: number | null;
  modRangeDelta: number | null;
  modAddedDamageType: WeaponDamageType | null;
  descriptiveText: string | null;
}

/**
 * Server-trusted validation of a card's mod fields (used by createCard).
 * Non-mod categories must not carry any mod field. Mod categories: each
 * delta, when given, must be a non-zero integer within ±modDeltaAbs; the
 * added damage type must be a real damage type; and at least one delta or
 * a descriptive-text line is required (a mod that does literally nothing
 * isn't a valid card, mirroring the "at least one effect or descriptive
 * text" rule for mechanical/descriptive cards elsewhere).
 */
export function validateModFields(input: ModFieldsInput): Result<ModFieldsInput> {
  const isMod = input.category === "firearm_mod" || input.category === "melee_mod";
  if (!isMod) {
    if (
      input.modDamageDelta !== null ||
      input.modRangeDelta !== null ||
      input.modAddedDamageType !== null
    ) {
      return {
        ok: false,
        error: "Mod deltas can only be set on Firearm Mod or Melee Mod cards.",
      };
    }
    return { ok: true, value: input };
  }

  for (const [delta, label] of [
    [input.modDamageDelta, "Damage delta"],
    [input.modRangeDelta, "Range delta"],
  ] as const) {
    if (
      delta !== null &&
      (!Number.isInteger(delta) ||
        delta === 0 ||
        Math.abs(delta) > CARD_TEXT_LIMITS.modDeltaAbs)
    ) {
      return {
        ok: false,
        error: `${label} must be a non-zero whole number within range.`,
      };
    }
  }
  if (
    input.modAddedDamageType !== null &&
    !WEAPON_DAMAGE_TYPES.includes(input.modAddedDamageType)
  ) {
    return { ok: false, error: "Pick a valid added damage type." };
  }
  if (
    input.modDamageDelta === null &&
    input.modRangeDelta === null &&
    input.modAddedDamageType === null &&
    !input.descriptiveText?.trim()
  ) {
    return {
      ok: false,
      error: "A mod needs at least one stat delta or descriptive text.",
    };
  }
  return { ok: true, value: input };
}

/** The host weapon fields a mod's delta gets applied onto. */
export interface WeaponBaseFields {
  damage: number | null;
  range: number | null;
  damageType: WeaponDamageType | null;
}

/** An installed mod's structured delta. */
export interface InstalledModFields {
  modDamageDelta: number | null;
  modRangeDelta: number | null;
  modAddedDamageType: WeaponDamageType | null;
}

export interface WeaponProfile {
  damage: number;
  damageDelta: number;
  range: number | null;
  rangeDelta: number;
  damageTypes: WeaponDamageType[];
}

/**
 * Computes a weapon's effective displayed stats from its base fields plus
 * every mod installed on it. Damage/range are clamped at 0 (a mod can't push
 * a stat negative); range stays null only when neither the base weapon nor
 * any installed mod ever set one. Damage types are the base type (if any)
 * followed by each distinct appended type, in mod order, deduped.
 */
export function computeWeaponProfile(
  weapon: WeaponBaseFields,
  mods: InstalledModFields[],
): WeaponProfile {
  const damageDelta = mods.reduce((sum, m) => sum + (m.modDamageDelta ?? 0), 0);
  const rangeDelta = mods.reduce((sum, m) => sum + (m.modRangeDelta ?? 0), 0);

  const damage = Math.max(0, (weapon.damage ?? 0) + damageDelta);
  const rangeKnown = weapon.range !== null || mods.some((m) => m.modRangeDelta !== null);
  const range = rangeKnown ? Math.max(0, (weapon.range ?? 0) + rangeDelta) : null;

  const damageTypes: WeaponDamageType[] = [];
  if (weapon.damageType) damageTypes.push(weapon.damageType);
  for (const m of mods) {
    if (m.modAddedDamageType && !damageTypes.includes(m.modAddedDamageType)) {
      damageTypes.push(m.modAddedDamageType);
    }
  }

  return { damage, damageDelta, range, rangeDelta, damageTypes };
}
