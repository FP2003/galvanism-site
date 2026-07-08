import { describe, it, expect } from "vitest";
import {
  applyPurchase,
  pickWeightedRule,
  pickRandomCard,
  planRestock,
  type RestockRule,
  type EligibleCard,
} from "./shops";

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
