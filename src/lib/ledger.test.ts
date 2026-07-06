import { describe, it, expect } from "vitest";
import {
  applyCreditsDelta,
  applyXpGrant,
  clampResource,
  parseSignedInt,
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
