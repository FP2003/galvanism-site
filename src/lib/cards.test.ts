import { describe, it, expect } from "vitest";
import {
  toRoman,
  effectSummary,
  isPersistentEffect,
  accumulateModifiers,
  applyModifiers,
  validateMechanicalEffect,
  cardAccent,
  isHexColor,
  isWeaponSubcategory,
  CARD_CATEGORY_META,
  ITEM_SUBCATEGORY_META,
  type CardEffectFields,
} from "./cards";

// Helper: a fully-specified effect, overridable per-test.
function mechanical(over: Partial<CardEffectFields> = {}): CardEffectFields {
  return {
    activation: "passive",
    effectType: "stat_modifier",
    effectTarget: "statTech",
    effectAmount: 1,
    trigger: "passive",
    ...over,
  };
}

describe("toRoman", () => {
  it("maps small levels", () => {
    expect(toRoman(1)).toBe("I");
    expect(toRoman(3)).toBe("III");
    expect(toRoman(4)).toBe("IV");
    expect(toRoman(9)).toBe("IX");
    expect(toRoman(10)).toBe("X");
  });

  it("clamps and floors out-of-range input", () => {
    expect(toRoman(0)).toBe("I"); // floor is level 1
    expect(toRoman(-5)).toBe("I");
    expect(toRoman(2.9)).toBe("II");
    expect(toRoman(999)).toBe(toRoman(20)); // clamped to levelMax
  });
});

describe("effectSummary", () => {
  it("formats a positive stat modifier", () => {
    expect(effectSummary(mechanical({ effectAmount: 1 }))).toBe("+1 Tech");
  });

  it("formats a negative modifier with a minus glyph", () => {
    expect(
      effectSummary(
        mechanical({ effectTarget: "statImmunity", effectAmount: -10 }),
      ),
    ).toBe("−10 Immunity");
  });

  it("labels resource targets", () => {
    expect(
      effectSummary(
        mechanical({
          effectType: "resource_modifier",
          effectTarget: "hpMax",
          effectAmount: 4,
        }),
      ),
    ).toBe("+4 Max HP");
  });

});

describe("isPersistentEffect", () => {
  it("counts passive effects", () => {
    expect(isPersistentEffect(mechanical({ trigger: "passive" }))).toBe(true);
  });

  it("counts on-equip effects", () => {
    expect(isPersistentEffect(mechanical({ trigger: "on_equip" }))).toBe(true);
  });

  it("excludes on-use effects (momentary, table-side)", () => {
    expect(isPersistentEffect(mechanical({ trigger: "on_use" }))).toBe(false);
  });
});

describe("accumulateModifiers", () => {
  it("sums stacking modifiers on the same target", () => {
    const mods = accumulateModifiers([
      mechanical({ effectTarget: "statTech", effectAmount: 1 }),
      mechanical({ effectTarget: "statTech", effectAmount: 2 }),
    ]);
    expect(mods).toEqual([{ target: "statTech", amount: 3 }]);
  });

  it("keeps distinct targets separate", () => {
    const mods = accumulateModifiers([
      mechanical({ effectTarget: "statTech", effectAmount: 1 }),
      mechanical({ effectTarget: "statAgility", effectAmount: 2 }),
    ]);
    expect(mods).toContainEqual({ target: "statTech", amount: 1 });
    expect(mods).toContainEqual({ target: "statAgility", amount: 2 });
  });

  it("ignores on-use effects", () => {
    const mods = accumulateModifiers([
      mechanical({ trigger: "on_use", effectAmount: 5 }),
    ]);
    expect(mods).toEqual([]);
  });
});

describe("applyModifiers", () => {
  const base = { statTech: 3, statImmunity: 100, hpMax: 12 };

  it("adds deltas onto base without mutating base", () => {
    const { effective, deltas } = applyModifiers(base, [
      { target: "statTech", amount: 1 },
    ]);
    expect(effective.statTech).toBe(4);
    expect(deltas.statTech).toBe(1);
    expect(base.statTech).toBe(3); // untouched
  });

  it("applies negative modifiers (mod card reduces immunity)", () => {
    const { effective } = applyModifiers(base, [
      { target: "statImmunity", amount: -10 },
    ]);
    expect(effective.statImmunity).toBe(90);
  });

  it("floors an over-subtracted target at zero", () => {
    const { effective } = applyModifiers(base, [
      { target: "hpMax", amount: -100 },
    ]);
    expect(effective.hpMax).toBe(0);
  });

  it("ignores modifiers whose target isn't in the base map", () => {
    const { effective } = applyModifiers(base, [
      { target: "statUnknown", amount: 5 },
    ]);
    expect(effective).toEqual(base);
  });
});

describe("validateMechanicalEffect", () => {
  it("accepts a valid stat modifier", () => {
    expect(
      validateMechanicalEffect({
        activation: "passive",
        effectType: "stat_modifier",
        effectTarget: "statTech",
        effectAmount: 1,
        trigger: "passive",
      }).ok,
    ).toBe(true);
  });

  it("rejects a target that doesn't match the effect type", () => {
    expect(
      validateMechanicalEffect({
        activation: "passive",
        effectType: "stat_modifier",
        effectTarget: "hpMax", // a resource target
        effectAmount: 1,
        trigger: "passive",
      }).ok,
    ).toBe(false);
  });

  it("rejects a zero amount", () => {
    expect(
      validateMechanicalEffect({
        activation: "passive",
        effectType: "stat_modifier",
        effectTarget: "statTech",
        effectAmount: 0,
        trigger: "passive",
      }).ok,
    ).toBe(false);
  });

  it("rejects an out-of-range amount", () => {
    expect(
      validateMechanicalEffect({
        activation: "passive",
        effectType: "resource_modifier",
        effectTarget: "hpMax",
        effectAmount: 100000,
        trigger: "on_equip",
      }).ok,
    ).toBe(false);
  });
});

describe("cardAccent", () => {
  it("uses the category preset by default", () => {
    expect(cardAccent("combat", null)).toBe(CARD_CATEGORY_META.combat.color);
  });

  it("honors a valid hex override", () => {
    expect(cardAccent("combat", "#abcdef")).toBe("#abcdef");
  });

  it("falls back to the preset for a malformed override", () => {
    expect(cardAccent("combat", "not-a-color")).toBe(
      CARD_CATEGORY_META.combat.color,
    );
  });

  it("uses the weapon subcategory color over the item category preset", () => {
    expect(cardAccent("item", null, "rifle")).toBe(
      ITEM_SUBCATEGORY_META.rifle.color,
    );
    expect(cardAccent("item", null, "pistol")).toBe(
      ITEM_SUBCATEGORY_META.pistol.color,
    );
    expect(cardAccent("item", null, "melee")).toBe(
      ITEM_SUBCATEGORY_META.melee.color,
    );
  });

  it("falls back to the item category preset for non-weapon subcategories", () => {
    expect(cardAccent("item", null, "medical")).toBe(
      CARD_CATEGORY_META.item.color,
    );
  });

  it("still honors a color override over a weapon subcategory color", () => {
    expect(cardAccent("item", "#abcdef", "rifle")).toBe("#abcdef");
  });
});

describe("isHexColor", () => {
  it("accepts #RRGGBB", () => {
    expect(isHexColor("#0caadc")).toBe(true);
  });

  it("rejects shorthand and named colors", () => {
    expect(isHexColor("#fff")).toBe(false);
    expect(isHexColor("red")).toBe(false);
  });
});

describe("isWeaponSubcategory", () => {
  it("accepts rifle, pistol, and melee", () => {
    expect(isWeaponSubcategory("rifle")).toBe(true);
    expect(isWeaponSubcategory("pistol")).toBe(true);
    expect(isWeaponSubcategory("melee")).toBe(true);
  });

  it("rejects the non-weapon item subcategories", () => {
    expect(isWeaponSubcategory("medical")).toBe(false);
    expect(isWeaponSubcategory("grenade")).toBe(false);
    expect(isWeaponSubcategory("other")).toBe(false);
  });

  it("rejects null/undefined", () => {
    expect(isWeaponSubcategory(null)).toBe(false);
    expect(isWeaponSubcategory(undefined)).toBe(false);
  });
});
