import { describe, it, expect } from "vitest";
import { splitPayoutEvenly, tickUrgentDeadline, missionBucket } from "./missions";

describe("splitPayoutEvenly", () => {
  it("splits evenly with no remainder", () => {
    expect(splitPayoutEvenly(600, 3)).toEqual({ perOperator: 200, remainder: 0 });
  });

  it("floors an uneven split and drops the remainder", () => {
    expect(splitPayoutEvenly(500, 3)).toEqual({ perOperator: 166, remainder: 2 });
  });

  it("gives the whole pot to a single operator", () => {
    expect(splitPayoutEvenly(340, 1)).toEqual({ perOperator: 340, remainder: 0 });
  });

  it("splits a zero payout to zero for everyone", () => {
    expect(splitPayoutEvenly(0, 4)).toEqual({ perOperator: 0, remainder: 0 });
  });
});

describe("tickUrgentDeadline", () => {
  it("decrements a deadline that's still safely above zero", () => {
    expect(tickUrgentDeadline(3)).toEqual({ nextDeadline: 2, failed: false });
  });

  it("fails when the deadline reaches exactly zero", () => {
    expect(tickUrgentDeadline(1)).toEqual({ nextDeadline: 0, failed: true });
  });

  it("fails (not crashes) when already past zero", () => {
    expect(tickUrgentDeadline(0)).toEqual({ nextDeadline: -1, failed: true });
  });
});

describe("missionBucket", () => {
  it("groups available and active as incomplete", () => {
    expect(missionBucket("available")).toBe("incomplete");
    expect(missionBucket("active")).toBe("incomplete");
  });

  it("maps complete and failed to their own buckets", () => {
    expect(missionBucket("complete")).toBe("complete");
    expect(missionBucket("failed")).toBe("failed");
  });
});
