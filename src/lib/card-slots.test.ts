import { describe, it, expect } from "vitest";
import {
  BASE_ABILITY_SLOTS,
  SLOT_LIMITED_CATEGORIES,
  isSlotLimitedCategory,
  emptySlotCountMap,
  mergeSlotCountMaps,
  tallyEquippedByCategory,
  canEquipInCategory,
  categorySlotUsage,
  sharedPoolRemaining,
  type SlotCountMap,
} from "./card-slots";

function bonus(over: Partial<SlotCountMap> = {}): SlotCountMap {
  return { ...emptySlotCountMap(), ...over };
}

describe("isSlotLimitedCategory", () => {
  it("includes the 7 ability-type categories", () => {
    for (const c of SLOT_LIMITED_CATEGORIES) {
      expect(isSlotLimitedCategory(c)).toBe(true);
    }
  });

  it("excludes item and the weapon-mod categories", () => {
    expect(isSlotLimitedCategory("item")).toBe(false);
    expect(isSlotLimitedCategory("firearm_mod")).toBe(false);
    expect(isSlotLimitedCategory("melee_mod")).toBe(false);
  });
});

describe("tallyEquippedByCategory", () => {
  it("counts only equipped, slot-limited cards", () => {
    const tally = tallyEquippedByCategory([
      { equipped: true, card: { category: "tech", takesSlot: true } },
      { equipped: false, card: { category: "tech", takesSlot: true } },
      { equipped: true, card: { category: "combat", takesSlot: true } },
      { equipped: true, card: { category: "item", takesSlot: true } },
      { equipped: true, card: { category: "firearm_mod", takesSlot: true } },
    ]);
    expect(tally.tech).toBe(1);
    expect(tally.combat).toBe(1);
  });

  it("ignores equipped cards flagged takesSlot: false, even in a slot-limited category", () => {
    const tally = tallyEquippedByCategory([
      { equipped: true, card: { category: "defense", takesSlot: false } },
      { equipped: true, card: { category: "defense", takesSlot: true } },
    ]);
    expect(tally.defense).toBe(1);
  });
});

// Worked examples from the plan, base=3, bonus={tech:1, combat:0}.
describe("canEquipInCategory — dual-constraint model", () => {
  const b = bonus({ tech: 1 });

  it("blocks a 4th combat card even though tech's bonus is unused (per-category cap)", () => {
    const equipped = bonus({ combat: 3 });
    expect(canEquipInCategory("combat", equipped, b)).toBe(false);
  });

  it("blocks a 2nd tech card once the shared pool is fully spent by combat (aggregate cap)", () => {
    const equipped = bonus({ combat: 3, tech: 1 });
    expect(canEquipInCategory("tech", equipped, b)).toBe(false);
  });

  it("allows a 3rd combat card when the shared pool + tech's reserved bonus aren't yet exhausted", () => {
    const equipped = bonus({ combat: 2, tech: 1 });
    expect(canEquipInCategory("combat", equipped, b)).toBe(true);
  });

  it("per-category cap alone is insufficient — aggregate must also be checked", () => {
    // Without the aggregate constraint, tech (bonus=1) would wrongly be
    // allowed to reach BASE+bonus=4 even while combat has already spent the
    // entire shared pool of 3.
    const equipped = bonus({ combat: 3, tech: 1 });
    const perCategoryOnly = equipped.tech + 1 <= BASE_ABILITY_SLOTS + b.tech;
    expect(perCategoryOnly).toBe(true); // the buggy check would pass...
    expect(canEquipInCategory("tech", equipped, b)).toBe(false); // ...but the real one blocks it
  });

  it("aggregate cap alone is insufficient — per-category must also be checked", () => {
    // Without the per-category constraint, combat (bonus=0) would wrongly be
    // allowed to spend tech's reserved bonus slot just because the aggregate
    // total still fits.
    const equipped = bonus({ combat: 3 });
    const totalCap = BASE_ABILITY_SLOTS + b.tech; // sum(bonus) = 1
    const aggregateOnly = Object.values(equipped).reduce((s, n) => s + n, 0) + 1 <= totalCap;
    expect(aggregateOnly).toBe(true); // the buggy check would pass...
    expect(canEquipInCategory("combat", equipped, b)).toBe(false); // ...but the real one blocks it
  });

  it("blocks a 4th card of any mix once all-zero-bonus categories fill the shared pool", () => {
    const equipped = bonus({ combat: 1, defense: 1, movement: 1 });
    expect(canEquipInCategory("resilience", equipped, emptySlotCountMap())).toBe(false);
  });

  it("non-limited categories are always allowed regardless of usage", () => {
    const equipped = bonus({ combat: 3 });
    expect(canEquipInCategory("item", equipped, emptySlotCountMap())).toBe(true);
    expect(canEquipInCategory("firearm_mod", equipped, emptySlotCountMap())).toBe(true);
  });

  it("a card flagged takesSlot: false bypasses the cap even at full capacity", () => {
    const equipped = bonus({ combat: 3 });
    expect(canEquipInCategory("combat", equipped, emptySlotCountMap(), false)).toBe(true);
  });

  it("defaults takesSlot to true when the argument is omitted", () => {
    const equipped = bonus({ combat: 3 });
    expect(canEquipInCategory("combat", equipped, emptySlotCountMap())).toBe(false);
  });
});

describe("mergeSlotCountMaps", () => {
  it("adds purchased and override bonuses category-by-category", () => {
    const purchased = bonus({ tech: 1 });
    const override = bonus({ tech: 1, combat: 2 });
    const merged = mergeSlotCountMaps(purchased, override);
    expect(merged.tech).toBe(2);
    expect(merged.combat).toBe(2);
    expect(merged.defense).toBe(0);
  });
});

describe("categorySlotUsage", () => {
  it("reports used/bonus/cap per category", () => {
    const equipped = bonus({ tech: 1 });
    const b = bonus({ tech: 1 });
    const usage = categorySlotUsage(equipped, b).find((u) => u.category === "tech");
    expect(usage).toEqual({ category: "tech", used: 1, bonus: 1, cap: 4 });
  });
});

describe("sharedPoolRemaining", () => {
  it("reflects unclaimed shared-pool slots, not per-category caps", () => {
    const equipped = bonus({ combat: 2 });
    expect(sharedPoolRemaining(equipped, emptySlotCountMap())).toBe(1);
  });

  it("floors at 0 rather than going negative", () => {
    const equipped = bonus({ combat: 5 });
    expect(sharedPoolRemaining(equipped, emptySlotCountMap())).toBe(0);
  });
});
