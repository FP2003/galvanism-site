import { describe, it, expect } from "vitest";
import {
  applyPurchase,
  pickWeightedRule,
  pickRandomCard,
  planRestock,
  isCardLevelUnlocked,
  offeringTargetsFor,
  isValidOfferingTarget,
  offeringTargetLabel,
  offeringCostCurrency,
  applyStatBump,
  applyResourceRefill,
  type RestockRule,
  type EligibleCard,
} from "./facilities";

// Deterministic rng from a fixed sequence, cycling if exhausted — lets a test
// script exactly which draw comes out of each weighted/uniform pick.
function sequence(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("applyPurchase", () => {
  it("debits an affordable purchase", () => {
    expect(applyPurchase(500, 200)).toEqual({ ok: true, value: 300 });
  });

  it("allows spending down to exactly zero", () => {
    expect(applyPurchase(200, 200)).toEqual({ ok: true, value: 0 });
  });

  it("refuses to overdraw", () => {
    expect(applyPurchase(100, 200).ok).toBe(false);
  });

  it("rejects a zero price", () => {
    expect(applyPurchase(500, 0).ok).toBe(false);
  });

  it("rejects a negative price", () => {
    expect(applyPurchase(500, -50).ok).toBe(false);
  });

  it("rejects a non-integer price", () => {
    expect(applyPurchase(500, 49.99).ok).toBe(false);
  });
});

describe("pickWeightedRule", () => {
  const rules: RestockRule[] = [
    { id: "a", category: "tech", level: 1, weight: 80 },
    { id: "b", category: "tech", level: 2, weight: 20 },
  ];

  it("picks the first rule near roll=0", () => {
    expect(pickWeightedRule(rules, sequence([0]))?.id).toBe("a");
  });

  it("picks the second rule near roll=1", () => {
    expect(pickWeightedRule(rules, sequence([0.999]))?.id).toBe("b");
  });

  it("picks the boundary correctly (roll exactly at the split)", () => {
    // roll * total = 0.8 * 100 = 80, which falls in rule b's [80, 100) band.
    expect(pickWeightedRule(rules, sequence([0.8]))?.id).toBe("b");
  });

  it("returns null when every weight is zero", () => {
    const zeroed: RestockRule[] = [{ id: "a", category: "tech", level: 1, weight: 0 }];
    expect(pickWeightedRule(zeroed, sequence([0.5]))).toBeNull();
  });

  it("returns null for an empty rule list", () => {
    expect(pickWeightedRule([], sequence([0.5]))).toBeNull();
  });

  it("ignores negative-weight rules", () => {
    const withNegative: RestockRule[] = [
      { id: "a", category: "tech", level: 1, weight: -10 },
      { id: "b", category: "tech", level: 2, weight: 10 },
    ];
    expect(pickWeightedRule(withNegative, sequence([0.5]))?.id).toBe("b");
  });
});

describe("pickRandomCard", () => {
  it("returns null for an empty list", () => {
    expect(pickRandomCard([], sequence([0.5]))).toBeNull();
  });

  it("picks the first item at rng=0", () => {
    expect(pickRandomCard(["x", "y", "z"], sequence([0]))).toBe("x");
  });

  it("picks the last item just under rng=1 (rounding boundary)", () => {
    expect(pickRandomCard(["x", "y", "z"], sequence([0.999]))).toBe("z");
  });
});

describe("planRestock", () => {
  const rules: RestockRule[] = [{ id: "r1", category: "tech", level: 1, weight: 100 }];
  const cards: EligibleCard[] = [
    { id: "c1", category: "tech", level: 1 },
    { id: "c2", category: "tech", level: 1 },
    { id: "c3", category: "tech", level: 1 },
  ];

  it("fills every slot without picking the same card twice", () => {
    const plan = planRestock(rules, cards, [], 3, sequence([0, 0.4, 0.9]));
    const picked = plan.map((s) => s.cardId).filter(Boolean);
    expect(picked).toHaveLength(3);
    expect(new Set(picked).size).toBe(3); // no duplicate picks across slots
  });

  it("partially restocks when a slot's pool runs out", () => {
    // Only 3 eligible cards for 4 slots — the 4th slot must skip, not crash.
    const plan = planRestock(rules, cards, [], 4, sequence([0, 0.3, 0.6, 0.9]));
    expect(plan.filter((s) => s.cardId).length).toBe(3);
    expect(plan.filter((s) => !s.cardId).length).toBe(1);
    expect(plan[3].ruleId).toBe("r1"); // a rule was drawn, just no card left
  });

  it("excludes already-listed cards from every slot's pool", () => {
    const plan = planRestock(rules, cards, ["c1", "c2"], 1, sequence([0]));
    expect(plan[0].cardId).toBe("c3");
  });

  it("returns null-filled slots when there are no rules at all", () => {
    const plan = planRestock([], cards, [], 2, sequence([0.5]));
    expect(plan).toEqual([
      { slotIndex: 0, cardId: null, ruleId: null },
      { slotIndex: 1, cardId: null, ruleId: null },
    ]);
  });

  it("runs a fully deterministic scripted scenario end to end", () => {
    const twoRules: RestockRule[] = [
      { id: "tech1", category: "tech", level: 1, weight: 80 },
      { id: "tech2", category: "tech", level: 2, weight: 20 },
    ];
    const pool: EligibleCard[] = [
      { id: "a", category: "tech", level: 1 },
      { id: "b", category: "tech", level: 2 },
    ];
    // Slot 0: roll 0 -> rule tech1 (weight 80 first), then card pick roll 0 -> "a".
    // Slot 1: roll 0.99 -> rule tech2, then card pick roll 0 -> "b".
    const plan = planRestock(twoRules, pool, [], 2, sequence([0, 0, 0.99, 0]));
    expect(plan).toEqual([
      { slotIndex: 0, cardId: "a", ruleId: "tech1" },
      { slotIndex: 1, cardId: "b", ruleId: "tech2" },
    ]);
  });
});

describe("isCardLevelUnlocked", () => {
  it("allows a card at or below the facility's level", () => {
    expect(isCardLevelUnlocked(1, 3)).toBe(true);
    expect(isCardLevelUnlocked(3, 3)).toBe(true);
  });

  it("blocks a card above the facility's level", () => {
    expect(isCardLevelUnlocked(4, 3)).toBe(false);
  });
});

describe("offeringTargetsFor / isValidOfferingTarget", () => {
  it("lists the six stat keys for stat_bump", () => {
    expect(offeringTargetsFor("stat_bump").map((t) => t.key)).toEqual([
      "statTech",
      "statPrecision",
      "statStrength",
      "statImmunity",
      "statResilience",
      "statAgility",
    ]);
  });

  it("lists the three current-resource keys for resource_refill", () => {
    expect(offeringTargetsFor("resource_refill").map((t) => t.key)).toEqual([
      "hpCurrent",
      "energyCurrent",
      "ammoCurrent",
    ]);
  });

  it("accepts a target that matches its offering type", () => {
    expect(isValidOfferingTarget("stat_bump", "statTech")).toBe(true);
    expect(isValidOfferingTarget("resource_refill", "hpCurrent")).toBe(true);
  });

  it("rejects a target from the other offering type", () => {
    expect(isValidOfferingTarget("stat_bump", "hpCurrent")).toBe(false);
    expect(isValidOfferingTarget("resource_refill", "statTech")).toBe(false);
  });

  it("falls back to the raw key when a label isn't found", () => {
    expect(offeringTargetLabel("stat_bump", "statTech")).toBe("Tech");
    expect(offeringTargetLabel("stat_bump", "bogus")).toBe("bogus");
  });
});

describe("offeringCostCurrency", () => {
  it("charges XP for a stat bump", () => {
    expect(offeringCostCurrency("stat_bump")).toBe("xp");
  });

  it("charges Credits for a resource refill", () => {
    expect(offeringCostCurrency("resource_refill")).toBe("credits");
  });
});

describe("applyStatBump", () => {
  it("adds the amount onto the current stat with no ceiling", () => {
    expect(applyStatBump(5, 2)).toBe(7);
  });
});

describe("applyResourceRefill", () => {
  it("adds the amount and clamps at the max", () => {
    expect(applyResourceRefill(5, 10, 3)).toBe(8);
    expect(applyResourceRefill(8, 10, 5)).toBe(10);
  });

  it("never goes below zero", () => {
    expect(applyResourceRefill(0, 10, -100)).toBe(0);
  });
});
