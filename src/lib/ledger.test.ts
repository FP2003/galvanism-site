import { describe, it, expect } from "vitest";
import {
  agilityMovementBonus,
  applyCreditsDelta,
  applyCreditsTransfer,
  applyXpGrant,
  applyXpSpend,
  adjustCurrentForMaxChange,
  clampMovementSpend,
  clampResource,
  clampTempHp,
  movementMeters,
  parseSignedInt,
  resilienceHpBonus,
  validateAttributeAllocation,
  MAX_CREDITS,
  MAX_XP,
} from "./ledger";

describe("applyCreditsDelta", () => {
  it("adds a positive delta", () => {
    expect(applyCreditsDelta(100, 400)).toEqual({ ok: true, value: 500 });
  });

  it("subtracts a negative delta", () => {
    expect(applyCreditsDelta(500, -60)).toEqual({ ok: true, value: 440 });
  });

  it("allows spending down to exactly zero", () => {
    expect(applyCreditsDelta(60, -60)).toEqual({ ok: true, value: 0 });
  });

  it("refuses to overdraw below zero", () => {
    const r = applyCreditsDelta(50, -60);
    expect(r.ok).toBe(false);
  });

  it("rejects a zero delta", () => {
    expect(applyCreditsDelta(100, 0).ok).toBe(false);
  });

  it("rejects a non-integer delta", () => {
    expect(applyCreditsDelta(100, 1.5).ok).toBe(false);
  });

  it("rejects exceeding the maximum balance", () => {
    expect(applyCreditsDelta(MAX_CREDITS, 1).ok).toBe(false);
  });
});

describe("applyCreditsTransfer", () => {
  it("moves credits from sender to recipient", () => {
    expect(applyCreditsTransfer(500, 100, 200)).toEqual({
      ok: true,
      value: { senderBalance: 300, recipientBalance: 300 },
    });
  });

  it("allows sending the entire balance", () => {
    expect(applyCreditsTransfer(200, 0, 200)).toEqual({
      ok: true,
      value: { senderBalance: 0, recipientBalance: 200 },
    });
  });

  it("rejects a zero amount", () => {
    expect(applyCreditsTransfer(500, 100, 0).ok).toBe(false);
  });

  it("rejects a negative amount", () => {
    expect(applyCreditsTransfer(500, 100, -50).ok).toBe(false);
  });

  it("rejects a non-integer amount", () => {
    expect(applyCreditsTransfer(500, 100, 1.5).ok).toBe(false);
  });

  it("refuses to overdraw the sender", () => {
    expect(applyCreditsTransfer(100, 0, 200).ok).toBe(false);
  });

  it("rejects exceeding the recipient's maximum balance", () => {
    expect(applyCreditsTransfer(MAX_CREDITS, MAX_CREDITS, 1).ok).toBe(false);
  });
});

describe("applyXpGrant", () => {
  it("raises both totals by the grant amount", () => {
    expect(applyXpGrant(100, 40, 25)).toEqual({
      ok: true,
      value: { totalXp: 125, currencyXp: 65 },
    });
  });

  it("rejects a zero amount", () => {
    expect(applyXpGrant(100, 40, 0).ok).toBe(false);
  });

  it("rejects a negative amount", () => {
    expect(applyXpGrant(100, 40, -10).ok).toBe(false);
  });

  it("rejects a non-integer amount", () => {
    expect(applyXpGrant(100, 40, 1.5).ok).toBe(false);
  });

  it("rejects exceeding the maximum total", () => {
    expect(applyXpGrant(MAX_XP, 0, 1).ok).toBe(false);
  });
});

describe("applyXpSpend", () => {
  it("debits an affordable spend", () => {
    expect(applyXpSpend(500, 200)).toEqual({ ok: true, value: 300 });
  });

  it("allows spending down to exactly zero", () => {
    expect(applyXpSpend(200, 200)).toEqual({ ok: true, value: 0 });
  });

  it("refuses to overdraw", () => {
    expect(applyXpSpend(100, 200).ok).toBe(false);
  });

  it("rejects a zero cost", () => {
    expect(applyXpSpend(500, 0).ok).toBe(false);
  });

  it("rejects a negative cost", () => {
    expect(applyXpSpend(500, -50).ok).toBe(false);
  });

  it("rejects a non-integer cost", () => {
    expect(applyXpSpend(500, 49.99).ok).toBe(false);
  });
});

describe("clampResource", () => {
  it("passes through an in-range value", () => {
    expect(clampResource(12, 20)).toBe(12);
  });

  it("clamps above max down to max", () => {
    expect(clampResource(30, 20)).toBe(20);
  });

  it("clamps negatives up to zero", () => {
    expect(clampResource(-5, 20)).toBe(0);
  });

  it("floors fractional input", () => {
    expect(clampResource(12.9, 20)).toBe(12);
  });

  it("treats non-finite input as zero", () => {
    expect(clampResource(NaN, 20)).toBe(0);
  });
});

describe("clampTempHp", () => {
  it("passes through a positive value", () => {
    expect(clampTempHp(12)).toBe(12);
  });

  it("has no ceiling", () => {
    expect(clampTempHp(9999)).toBe(9999);
  });

  it("clamps negatives up to zero", () => {
    expect(clampTempHp(-5)).toBe(0);
  });

  it("floors fractional input", () => {
    expect(clampTempHp(12.9)).toBe(12);
  });

  it("treats non-finite input as zero", () => {
    expect(clampTempHp(NaN)).toBe(0);
  });
});

describe("adjustCurrentForMaxChange", () => {
  it("raises current HP by the same amount as max HP", () => {
    expect(adjustCurrentForMaxChange(13, 13, 14)).toBe(14);
  });

  it("preserves existing damage when max HP increases", () => {
    expect(adjustCurrentForMaxChange(9, 13, 14)).toBe(10);
  });

  it("lowers current HP when max HP decreases", () => {
    expect(adjustCurrentForMaxChange(10, 14, 12)).toBe(8);
  });

  it("does not allow current HP below zero", () => {
    expect(adjustCurrentForMaxChange(1, 14, 10)).toBe(0);
  });
});

describe("resilienceHpBonus", () => {
  it("adds 2 HP per Resilience point", () => {
    expect(resilienceHpBonus(3)).toBe(6);
  });

  it("returns 0 for no Resilience", () => {
    expect(resilienceHpBonus(0)).toBe(0);
  });

  it("floors negative Resilience to 0", () => {
    expect(resilienceHpBonus(-2)).toBe(0);
  });

  it("floors fractional Resilience", () => {
    expect(resilienceHpBonus(3.9)).toBe(6);
  });
});

describe("agilityMovementBonus", () => {
  it("adds 1 movement per 2 Agility points", () => {
    expect(agilityMovementBonus(4)).toBe(2);
  });

  it("floors an odd Agility down", () => {
    expect(agilityMovementBonus(5)).toBe(2);
  });

  it("returns 0 for less than 2 Agility", () => {
    expect(agilityMovementBonus(1)).toBe(0);
  });

  it("floors negative Agility to 0", () => {
    expect(agilityMovementBonus(-4)).toBe(0);
  });
});

describe("movementMeters", () => {
  it("returns the base with no EP spent", () => {
    expect(movementMeters(6, 0)).toBe(6);
  });

  it("adds 2m per EP spent", () => {
    expect(movementMeters(6, 3)).toBe(12);
  });

  it("floors fractional inputs", () => {
    expect(movementMeters(6.9, 1.9)).toBe(6 + 2 * 1);
  });
});

describe("clampMovementSpend", () => {
  it("passes through a spend that leaves room in the pool", () => {
    expect(clampMovementSpend(3, 2, 8)).toBe(3); // 2 + 3 = 5 <= 8
  });

  it("clamps down when current + spent would exceed max", () => {
    expect(clampMovementSpend(5, 5, 8)).toBe(3); // 8 - 5 = 3
  });

  it("clamps to zero when current already fills the max", () => {
    expect(clampMovementSpend(4, 8, 8)).toBe(0);
  });

  it("floors negative spend to zero", () => {
    expect(clampMovementSpend(-2, 0, 8)).toBe(0);
  });

  it("treats non-finite spend as zero", () => {
    expect(clampMovementSpend(NaN, 0, 8)).toBe(0);
  });
});

describe("validateAttributeAllocation", () => {
  it("accepts a distribution summing to the budget", () => {
    expect(validateAttributeAllocation([2, 1, 1, 1, 1], 6)).toEqual({
      ok: true,
      value: [2, 1, 1, 1, 1],
    });
  });

  it("accepts all points dumped on one attribute", () => {
    expect(validateAttributeAllocation([6, 0, 0, 0, 0], 6).ok).toBe(true);
  });

  it("rejects under-allocation", () => {
    expect(validateAttributeAllocation([1, 1, 1, 1, 1], 6).ok).toBe(false);
  });

  it("rejects over-allocation", () => {
    expect(validateAttributeAllocation([2, 2, 2, 1, 0], 6).ok).toBe(false);
  });

  it("rejects negative values", () => {
    expect(validateAttributeAllocation([-1, 3, 2, 1, 1], 6).ok).toBe(false);
  });

  it("rejects non-integers", () => {
    expect(validateAttributeAllocation([1.5, 1.5, 1, 1, 1], 6).ok).toBe(false);
  });
});

describe("parseSignedInt", () => {
  it("parses a leading-plus value", () => {
    expect(parseSignedInt("+400")).toEqual({ ok: true, value: 400 });
  });

  it("parses a negative value", () => {
    expect(parseSignedInt("-60")).toEqual({ ok: true, value: -60 });
  });

  it("parses a plain value", () => {
    expect(parseSignedInt("300")).toEqual({ ok: true, value: 300 });
  });

  it("rejects blank input", () => {
    expect(parseSignedInt("   ").ok).toBe(false);
  });

  it("rejects decimals", () => {
    expect(parseSignedInt("1.5").ok).toBe(false);
  });

  it("rejects non-numeric input", () => {
    expect(parseSignedInt("abc").ok).toBe(false);
  });
});
