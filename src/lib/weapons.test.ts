import { describe, it, expect } from "vitest";
import {
  isSlotLegalFor,
  resolveWeaponSlotAssignment,
  validateWeaponFields,
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
    });
    expect(result.ok).toBe(true);
  });

  it("accepts a weapon with range/ammoCount omitted", () => {
    const result = validateWeaponFields({
      subcategory: "melee",
      handedness: "one_handed",
      damageType: "bladed",
      damage: 4,
      range: null,
      ammoCount: null,
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
      }).ok,
    ).toBe(false);
  });

  it("rejects weapon fields set on a non-weapon subcategory", () => {
    const result = validateWeaponFields({
      subcategory: "medical",
      handedness: "one_handed",
      damageType: null,
      damage: null,
      range: null,
      ammoCount: null,
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
    });
    expect(result.ok).toBe(true);
  });
});
