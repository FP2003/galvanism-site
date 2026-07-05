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
  CARD_CATEGORY_META,
  type CardEffectFields,
} from "./cards";

// Helper: a fully-specified mechanical stat card, overridable per-test.
function mechanical(over: Partial<CardEffectFields> = {}): CardEffectFields {
  return {
    effectKind: "mechanical",
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

  it("returns null for descriptive cards", () => {
    expect(
      effectSummary({
        effectKind: "descriptive",
        effectType: null,
        effectTarget: null,
        effectAmount: null,
        trigger: null,
      }),
    ).toBeNull();
  });

  it("returns null for an incomplete mechanical card", () => {
    expect(effectSummary(mechanical({ effectAmount: null }))).toBeNull();
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

  it("excludes descriptive cards", () => {
    expect(
      isPersistentEffect({
        effectKind: "descriptive",
        effectType: null,
        effectTarget: null,
        effectAmount: null,
        trigger: null,
      }),
    ).toBe(false);
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

  it("ignores on-use and descriptive cards", () => {
    const mods = accumulateModifiers([
      mechanical({ trigger: "on_use", effectAmount: 5 }),
      {
        effectKind: "descriptive",
        effectType: null,
        effectTarget: null,
        effectAmount: null,
        trigger: null,
      },
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
