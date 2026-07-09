import { describe, it, expect } from "vitest";
import {
  isSlotLegalFor,
  resolveWeaponSlotAssignment,
  validateWeaponFields,
  modCategoryForWeapon,
  validateModFields,
  computeWeaponProfile,
  type WeaponCardFields,
  type OccupiedSlots,
} from "./weapons";

function weapon(over: Partial<WeaponCardFields> = {}): WeaponCardFields {
  return { subcategory: "rifle", handedness: "two_handed", ...over };
}

describe("isSlotLegalFor", () => {
  it("accepts any weapon shape in primary", () => {
    for (const subcategory of ["rifle", "pistol", "melee"] as const) {
      for (const handedness of ["one_handed", "two_handed"] as const) {
        expect(isSlotLegalFor(weapon({ subcategory, handedness }), "primary")).toBe(
          true,
        );
      }
    }
  });

  it("accepts one-handed weapons of any subcategory in secondary", () => {
    for (const subcategory of ["rifle", "pistol", "melee"] as const) {
      expect(
        isSlotLegalFor(weapon({ subcategory, handedness: "one_handed" }), "secondary"),
      ).toBe(true);
    }
  });

  it("rejects two-handed weapons in secondary", () => {
    for (const subcategory of ["rifle", "pistol", "melee"] as const) {
      expect(
        isSlotLegalFor(weapon({ subcategory, handedness: "two_handed" }), "secondary"),
      ).toBe(false);
    }
  });

  it("accepts one-handed pistol/melee in tertiary", () => {
    expect(
      isSlotLegalFor(weapon({ subcategory: "pistol", handedness: "one_handed" }), "tertiary"),
    ).toBe(true);
    expect(
      isSlotLegalFor(weapon({ subcategory: "melee", handedness: "one_handed" }), "tertiary"),
    ).toBe(true);
  });

  it("rejects rifles in tertiary regardless of handedness", () => {
    expect(
      isSlotLegalFor(weapon({ subcategory: "rifle", handedness: "one_handed" }), "tertiary"),
    ).toBe(false);
    expect(
      isSlotLegalFor(weapon({ subcategory: "rifle", handedness: "two_handed" }), "tertiary"),
    ).toBe(false);
  });

  it("rejects any two-handed weapon in tertiary", () => {
    for (const subcategory of ["pistol", "melee"] as const) {
      expect(
        isSlotLegalFor(weapon({ subcategory, handedness: "two_handed" }), "tertiary"),
      ).toBe(false);
    }
  });
});

describe("resolveWeaponSlotAssignment", () => {
  it("allows equipping into an empty primary with no clears", () => {
    const result = resolveWeaponSlotAssignment(
      weapon({ subcategory: "pistol", handedness: "one_handed" }),
      "assign-1",
      "primary",
      {},
    );
    expect(result).toEqual({ ok: true, value: { slotsToClear: [] } });
  });

  it("clears secondary when a two-handed weapon takes primary and a different assignment holds secondary", () => {
    const occupied: OccupiedSlots = {
      secondary: { assignmentId: "assign-2", subcategory: "pistol", handedness: "one_handed" },
    };
    const result = resolveWeaponSlotAssignment(
      weapon({ subcategory: "rifle", handedness: "two_handed" }),
      "assign-1",
      "primary",
      occupied,
    );
    expect(result).toEqual({ ok: true, value: { slotsToClear: ["secondary"] } });
  });

  it("does not self-clear when secondary is already held by the same assignment", () => {
    const occupied: OccupiedSlots = {
      secondary: { assignmentId: "assign-1", subcategory: "rifle", handedness: "two_handed" },
    };
    const result = resolveWeaponSlotAssignment(
      weapon({ subcategory: "rifle", handedness: "two_handed" }),
      "assign-1",
      "primary",
      occupied,
    );
    expect(result).toEqual({ ok: true, value: { slotsToClear: [] } });
  });

  it("rejects a two-handed weapon placed directly into secondary", () => {
    const result = resolveWeaponSlotAssignment(
      weapon({ subcategory: "melee", handedness: "two_handed" }),
      "assign-1",
      "secondary",
      {},
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a rifle placed into tertiary", () => {
    const result = resolveWeaponSlotAssignment(
      weapon({ subcategory: "rifle", handedness: "one_handed" }),
      "assign-1",
      "tertiary",
      {},
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a two-handed weapon placed into tertiary", () => {
    const result = resolveWeaponSlotAssignment(
      weapon({ subcategory: "pistol", handedness: "two_handed" }),
      "assign-1",
      "tertiary",
      {},
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a one-handed weapon into secondary when primary holds a two-handed weapon", () => {
    const occupied: OccupiedSlots = {
      primary: { assignmentId: "assign-1", subcategory: "rifle", handedness: "two_handed" },
    };
    const result = resolveWeaponSlotAssignment(
      weapon({ subcategory: "melee", handedness: "one_handed" }),
      "assign-2",
      "secondary",
      occupied,
    );
    expect(result.ok).toBe(false);
  });

  it("does not evict the target slot's current occupant itself — that's the caller's job", () => {
    const occupied: OccupiedSlots = {
      primary: { assignmentId: "assign-2", subcategory: "pistol", handedness: "one_handed" },
    };
    const result = resolveWeaponSlotAssignment(
      weapon({ subcategory: "melee", handedness: "one_handed" }),
      "assign-1",
      "primary",
      occupied,
    );
    // primary's own occupant is not listed in slotsToClear — the server
    // action's UPDATE on the target slot itself is what evicts it.
    expect(result).toEqual({ ok: true, value: { slotsToClear: [] } });
  });
});

describe("validateWeaponFields", () => {
  it("accepts a valid rifle", () => {
    const result = validateWeaponFields({
      subcategory: "rifle",
      handedness: "two_handed",
      damageType: "piercing",
      damage: 6,
      range: 20,
      ammoCount: 30,
      modSlots: 2,
    });
    expect(result.ok).toBe(true);
  });

  it("accepts a weapon with range/ammoCount/modSlots omitted", () => {
    const result = validateWeaponFields({
      subcategory: "melee",
      handedness: "one_handed",
      damageType: "bladed",
      damage: 4,
      range: null,
      ammoCount: null,
      modSlots: null,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a weapon subcategory missing handedness", () => {
    const result = validateWeaponFields({
      subcategory: "pistol",
      handedness: null,
      damageType: "piercing",
      damage: 5,
      range: null,
      ammoCount: null,
      modSlots: null,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a weapon subcategory missing damage type", () => {
    const result = validateWeaponFields({
      subcategory: "pistol",
      handedness: "one_handed",
      damageType: null,
      damage: 5,
      range: null,
      ammoCount: null,
      modSlots: null,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-positive damage value", () => {
    const result = validateWeaponFields({
      subcategory: "pistol",
      handedness: "one_handed",
      damageType: "piercing",
      damage: 0,
      range: null,
      ammoCount: null,
      modSlots: null,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a negative range or ammo count", () => {
    expect(
      validateWeaponFields({
        subcategory: "rifle",
        handedness: "two_handed",
        damageType: "piercing",
        damage: 6,
        range: -1,
        ammoCount: null,
        modSlots: null,
      }).ok,
    ).toBe(false);
    expect(
      validateWeaponFields({
        subcategory: "rifle",
        handedness: "two_handed",
        damageType: "piercing",
        damage: 6,
        range: null,
        ammoCount: -1,
        modSlots: null,
      }).ok,
    ).toBe(false);
  });

  it("accepts modSlots within range and rejects out-of-range values", () => {
    const base = {
      subcategory: "rifle" as const,
      handedness: "two_handed" as const,
      damageType: "piercing" as const,
      damage: 6,
      range: 20,
      ammoCount: 30,
    };
    expect(validateWeaponFields({ ...base, modSlots: 0 }).ok).toBe(true);
    expect(validateWeaponFields({ ...base, modSlots: 6 }).ok).toBe(true);
    expect(validateWeaponFields({ ...base, modSlots: -1 }).ok).toBe(false);
    expect(validateWeaponFields({ ...base, modSlots: 7 }).ok).toBe(false);
    expect(validateWeaponFields({ ...base, modSlots: 1.5 }).ok).toBe(false);
  });

  it("rejects weapon fields set on a non-weapon subcategory", () => {
    const result = validateWeaponFields({
      subcategory: "medical",
      handedness: "one_handed",
      damageType: null,
      damage: null,
      range: null,
      ammoCount: null,
      modSlots: null,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a stray damage type on a non-weapon subcategory", () => {
    const result = validateWeaponFields({
      subcategory: "medical",
      handedness: null,
      damageType: "burn",
      damage: null,
      range: null,
      ammoCount: null,
      modSlots: null,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a stray modSlots on a non-weapon subcategory", () => {
    const result = validateWeaponFields({
      subcategory: "grenade",
      handedness: null,
      damageType: null,
      damage: null,
      range: null,
      ammoCount: null,
      modSlots: 2,
    });
    expect(result.ok).toBe(false);
  });

  it("accepts a non-weapon subcategory with all weapon fields null", () => {
    const result = validateWeaponFields({
      subcategory: "grenade",
      handedness: null,
      damageType: null,
      damage: null,
      range: null,
      ammoCount: null,
      modSlots: null,
    });
    expect(result.ok).toBe(true);
  });
});

describe("modCategoryForWeapon", () => {
  it("maps rifle/pistol to firearm_mod and melee to melee_mod", () => {
    expect(modCategoryForWeapon("rifle")).toBe("firearm_mod");
    expect(modCategoryForWeapon("pistol")).toBe("firearm_mod");
    expect(modCategoryForWeapon("melee")).toBe("melee_mod");
  });
});

describe("validateModFields", () => {
  it("accepts a valid firearm mod with a range delta and descriptive text", () => {
    const result = validateModFields({
      category: "firearm_mod",
      modDamageDelta: null,
      modRangeDelta: 15,
      modAddedDamageType: null,
      descriptiveText: "-1 EP Readying Penalty | +1 EP Reactive Penalty",
    });
    expect(result.ok).toBe(true);
  });

  it("accepts a valid melee mod with a damage delta and added damage type", () => {
    const result = validateModFields({
      category: "melee_mod",
      modDamageDelta: -2,
      modRangeDelta: null,
      modAddedDamageType: "electric",
      descriptiveText: "Successful strikes SHOCK the target.",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a zero delta", () => {
    const result = validateModFields({
      category: "firearm_mod",
      modDamageDelta: 0,
      modRangeDelta: null,
      modAddedDamageType: null,
      descriptiveText: null,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects an out-of-range delta", () => {
    const result = validateModFields({
      category: "firearm_mod",
      modDamageDelta: 100000,
      modRangeDelta: null,
      modAddedDamageType: null,
      descriptiveText: null,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a mod with no delta and no descriptive text", () => {
    const result = validateModFields({
      category: "melee_mod",
      modDamageDelta: null,
      modRangeDelta: null,
      modAddedDamageType: null,
      descriptiveText: "   ",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects mod deltas set on a non-mod category", () => {
    const result = validateModFields({
      category: "item",
      modDamageDelta: 2,
      modRangeDelta: null,
      modAddedDamageType: null,
      descriptiveText: null,
    });
    expect(result.ok).toBe(false);
  });

  it("accepts a non-mod category with all mod fields null", () => {
    const result = validateModFields({
      category: "combat",
      modDamageDelta: null,
      modRangeDelta: null,
      modAddedDamageType: null,
      descriptiveText: null,
    });
    expect(result.ok).toBe(true);
  });
});

describe("computeWeaponProfile", () => {
  const rifle = { damage: 6, range: 20, damageType: "piercing" as const };

  it("returns the base profile unchanged with no mods installed", () => {
    const profile = computeWeaponProfile(rifle, []);
    expect(profile).toEqual({
      damage: 6,
      damageDelta: 0,
      range: 20,
      rangeDelta: 0,
      damageTypes: ["piercing"],
    });
  });

  it("stacks damage and range deltas across multiple mods", () => {
    // x2 Scope: +15 range. Short Barrel: -15 range, +2 damage.
    const profile = computeWeaponProfile(rifle, [
      { modDamageDelta: null, modRangeDelta: 15, modAddedDamageType: null },
      { modDamageDelta: 2, modRangeDelta: -15, modAddedDamageType: null },
    ]);
    expect(profile.damage).toBe(8);
    expect(profile.damageDelta).toBe(2);
    expect(profile.range).toBe(20);
    expect(profile.rangeDelta).toBe(0);
  });

  it("clamps damage at zero (Thin Blade on a 2-DMG knife)", () => {
    const knife = { damage: 2, range: null, damageType: "bladed" as const };
    const profile = computeWeaponProfile(knife, [
      { modDamageDelta: -2, modRangeDelta: null, modAddedDamageType: null },
    ]);
    expect(profile.damage).toBe(0);
  });

  it("applies a range delta even when the base weapon has no range", () => {
    const knife = { damage: 4, range: null, damageType: "bladed" as const };
    const profile = computeWeaponProfile(knife, [
      { modDamageDelta: null, modRangeDelta: 10, modAddedDamageType: null },
    ]);
    expect(profile.range).toBe(10);
  });

  it("stays null range when neither base nor any mod ever sets one", () => {
    const knife = { damage: 4, range: null, damageType: "bladed" as const };
    const profile = computeWeaponProfile(knife, [
      { modDamageDelta: -1, modRangeDelta: null, modAddedDamageType: null },
    ]);
    expect(profile.range).toBeNull();
  });

  it("appends a distinct added damage type (Electric Chip)", () => {
    const profile = computeWeaponProfile(rifle, [
      { modDamageDelta: null, modRangeDelta: null, modAddedDamageType: "electric" },
    ]);
    expect(profile.damageTypes).toEqual(["piercing", "electric"]);
  });

  it("dedupes an added damage type already present", () => {
    const profile = computeWeaponProfile(rifle, [
      { modDamageDelta: null, modRangeDelta: null, modAddedDamageType: "piercing" },
    ]);
    expect(profile.damageTypes).toEqual(["piercing"]);
  });
});
