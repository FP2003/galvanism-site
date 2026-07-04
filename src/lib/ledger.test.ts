import { describe, it, expect } from "vitest";
import {
  applyGoldDelta,
  clampResource,
  parseSignedInt,
  MAX_GOLD,
} from "./ledger";

describe("applyGoldDelta", () => {
  it("adds a positive delta", () => {
    expect(applyGoldDelta(100, 400)).toEqual({ ok: true, value: 500 });
  });

  it("subtracts a negative delta", () => {
    expect(applyGoldDelta(500, -60)).toEqual({ ok: true, value: 440 });
  });

  it("allows spending down to exactly zero", () => {
    expect(applyGoldDelta(60, -60)).toEqual({ ok: true, value: 0 });
  });

  it("refuses to overdraw below zero", () => {
    const r = applyGoldDelta(50, -60);
    expect(r.ok).toBe(false);
  });

  it("rejects a zero delta", () => {
    expect(applyGoldDelta(100, 0).ok).toBe(false);
  });

  it("rejects a non-integer delta", () => {
    expect(applyGoldDelta(100, 1.5).ok).toBe(false);
  });

  it("rejects exceeding the maximum balance", () => {
    expect(applyGoldDelta(MAX_GOLD, 1).ok).toBe(false);
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
