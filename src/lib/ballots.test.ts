import { describe, it, expect } from "vitest";
import { tickBallotDeadline, tallyVotes, votersByOption, leadingOptionIds } from "./ballots";

describe("tickBallotDeadline", () => {
  it("decrements a deadline that's still safely above zero", () => {
    expect(tickBallotDeadline(3)).toEqual({ nextDeadline: 2, closed: false });
  });

  it("closes when the deadline reaches exactly zero", () => {
    expect(tickBallotDeadline(1)).toEqual({ nextDeadline: 0, closed: true });
  });

  it("closes (not crashes) when already past zero", () => {
    expect(tickBallotDeadline(0)).toEqual({ nextDeadline: -1, closed: true });
  });
});

describe("tallyVotes", () => {
  const options = [
    { id: "a", label: "Option A" },
    { id: "b", label: "Option B" },
    { id: "c", label: "Option C" },
  ];

  it("splits votes evenly across options", () => {
    const votes = [{ optionId: "a" }, { optionId: "b" }];
    expect(tallyVotes(options.slice(0, 2), votes)).toEqual({
      totalVotes: 2,
      results: [
        { optionId: "a", label: "Option A", votes: 1, pct: 50 },
        { optionId: "b", label: "Option B", votes: 1, pct: 50 },
      ],
    });
  });

  it("handles a zero-vote ballot without dividing by zero", () => {
    expect(tallyVotes(options, [])).toEqual({
      totalVotes: 0,
      results: [
        { optionId: "a", label: "Option A", votes: 0, pct: 0 },
        { optionId: "b", label: "Option B", votes: 0, pct: 0 },
        { optionId: "c", label: "Option C", votes: 0, pct: 0 },
      ],
    });
  });

  it("gives one option all the votes", () => {
    const votes = [{ optionId: "a" }, { optionId: "a" }, { optionId: "a" }];
    const { results } = tallyVotes(options, votes);
    expect(results.find((r) => r.optionId === "a")).toEqual({
      optionId: "a",
      label: "Option A",
      votes: 3,
      pct: 100,
    });
    expect(results.find((r) => r.optionId === "b")?.votes).toBe(0);
  });

  it("keeps an unvoted option present alongside voted ones", () => {
    const votes = [{ optionId: "a" }, { optionId: "a" }];
    const { results } = tallyVotes(options, votes);
    expect(results.find((r) => r.optionId === "c")).toEqual({
      optionId: "c",
      label: "Option C",
      votes: 0,
      pct: 0,
    });
  });
});

describe("votersByOption", () => {
  const options = [
    { id: "a", label: "Option A" },
    { id: "b", label: "Option B" },
  ];

  it("groups callsigns under the option they picked, alphabetized", () => {
    const votes = [
      { optionId: "a", callsign: "Ghost" },
      { optionId: "a", callsign: "Ace" },
      { optionId: "b", callsign: "Raze" },
    ];
    expect(votersByOption(options, votes)).toEqual({
      a: ["Ace", "Ghost"],
      b: ["Raze"],
    });
  });

  it("keeps an unvoted option present as an empty list", () => {
    expect(votersByOption(options, [])).toEqual({ a: [], b: [] });
  });
});

describe("leadingOptionIds", () => {
  it("returns the single leader", () => {
    const results = [
      { optionId: "a", label: "A", votes: 3, pct: 75 },
      { optionId: "b", label: "B", votes: 1, pct: 25 },
    ];
    expect(leadingOptionIds(results)).toEqual(["a"]);
  });

  it("returns every option tied for the lead", () => {
    const results = [
      { optionId: "a", label: "A", votes: 2, pct: 50 },
      { optionId: "b", label: "B", votes: 2, pct: 50 },
      { optionId: "c", label: "C", votes: 0, pct: 0 },
    ];
    expect(leadingOptionIds(results)).toEqual(["a", "b"]);
  });

  it("returns empty when nobody's voted", () => {
    const results = [
      { optionId: "a", label: "A", votes: 0, pct: 0 },
      { optionId: "b", label: "B", votes: 0, pct: 0 },
    ];
    expect(leadingOptionIds(results)).toEqual([]);
  });

  it("returns empty for an empty option list", () => {
    expect(leadingOptionIds([])).toEqual([]);
  });
});
