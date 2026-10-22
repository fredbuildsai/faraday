import { describe, it, expect } from "vitest";
import { matchesFor, normaliseMethod, scorePair, selectPairs, type Match, type Profile } from "@/lib/matching";

const A: Profile = { id: "A", topics: { t1: 0.5, t2: 0.5 }, methods: ["pcr", "nmr"], activity: 1 };
const B: Profile = { id: "B", topics: { t1: 0.5, t3: 0.5 }, methods: ["pcr", "mass-spec"], activity: 1 };

describe("matching", () => {
  it("scores the A/B example", () => {
    const s = scorePair(A, B)!;
    expect(s.T).toBeCloseTo(0.5, 3);
    expect(s.M).toBeCloseTo(0.333, 3);
    expect(s.score).toBeCloseTo(0.272, 3);
    expect(s.sharedTopics).toEqual(["t1"]);
  });
  it("drops identical methods", () => {
    expect(scorePair(A, { ...B, methods: ["pcr", "nmr"] })).toBeNull();
  });
  it("drops subset methods", () => {
    expect(scorePair(A, { ...B, methods: ["pcr"] })).toBeNull();
  });
  it("drops below threshold", () => {
    expect(scorePair(A, B, 0.3)).toBeNull();
  });
  it("normalises methods", () => {
    expect(normaliseMethod(" NMR ", { nmr: "nuclear magnetic resonance spectroscopy" })).toBe(
      "nuclear magnetic resonance spectroscopy",
    );
    expect(normaliseMethod("Mass  Spectrometers")).toBe("mass spectrometer");
  });
  it("caps at 5 per user", () => {
    const pairs: Match[] = Array.from({ length: 6 }, (_, i) => ({
      a: "U", b: `V${i}`, score: 0.5 + i / 100, T: 1, M: 0, act: 1,
      sharedTopics: [], aOnly: [], bOnly: [], formula: "c2",
    }));
    expect(selectPairs(pairs, {})).toHaveLength(5);
  });
  it("is symmetric", () => {
    expect(matchesFor(B, [A])).toEqual(matchesFor(A, [B]));
  });
});
