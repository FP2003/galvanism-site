import { describe, it, expect } from "vitest";
import {
  splitPayoutEvenly,
  tickUrgentDeadline,
  missionBucket,
  callsignsByState,
  attachmentTiltDeg,
  briefingPreview,
} from "./missions";

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

describe("callsignsByState", () => {
  it("splits interested and assigned into separate groups", () => {
    const assignments = [
      { state: "interested" as const, character: { callsign: "Zephyr" } },
      { state: "assigned" as const, character: { callsign: "Anvil" } },
      { state: "interested" as const, character: { callsign: "Anvil" } },
    ];
    expect(callsignsByState(assignments)).toEqual({
      interested: ["Anvil", "Zephyr"],
      assigned: ["Anvil"],
    });
  });

  it("returns empty arrays for no assignments", () => {
    expect(callsignsByState([])).toEqual({ interested: [], assigned: [] });
  });

  it("sorts each group alphabetically regardless of input order", () => {
    const assignments = [
      { state: "interested" as const, character: { callsign: "Wraith" } },
      { state: "interested" as const, character: { callsign: "Ash" } },
      { state: "interested" as const, character: { callsign: "Mirage" } },
    ];
    expect(callsignsByState(assignments).interested).toEqual(["Ash", "Mirage", "Wraith"]);
  });
});

describe("briefingPreview", () => {
  it("returns an empty string for null or empty briefings", () => {
    expect(briefingPreview(null)).toBe("");
    expect(briefingPreview("")).toBe("");
  });

  it("strips a registry link down to its display text", () => {
    expect(briefingPreview("Check in with [Marcus Kade](/registry/marcus-kade) first.")).toBe(
      "Check in with Marcus Kade first.",
    );
  });

  it("strips bold/italic markers and bullet dashes", () => {
    expect(briefingPreview("**Urgent**: secure the *cache*.\n- Watch patrols")).toBe(
      "Urgent: secure the cache. Watch patrols",
    );
  });

  it("leaves plain text untouched", () => {
    expect(briefingPreview("Plain text with no markdown at all.")).toBe("Plain text with no markdown at all.");
  });
});

describe("attachmentTiltDeg", () => {
  it("is deterministic for the same id", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    expect(attachmentTiltDeg(id)).toBe(attachmentTiltDeg(id));
  });

  it("stays within the 2..6deg magnitude range", () => {
    const ids = ["a", "bb", "ccc", "550e8400-e29b-41d4-a716-446655440000", "11111111-1111-1111-1111-111111111111"];
    for (const id of ids) {
      const deg = attachmentTiltDeg(id);
      expect(Math.abs(deg)).toBeGreaterThanOrEqual(2);
      expect(Math.abs(deg)).toBeLessThanOrEqual(6);
    }
  });

  it("differs across at least some distinct ids", () => {
    const ids = ["a", "bb", "ccc", "dddd", "eeeee", "ffffff"];
    const degrees = new Set(ids.map(attachmentTiltDeg));
    expect(degrees.size).toBeGreaterThan(1);
  });
});
