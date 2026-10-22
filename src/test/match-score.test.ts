import { describe, it, expect } from "vitest";
import { DEFAULT_WEIGHTS, resolveWeights, scoreCollaboration } from "@/lib/match-score";
import type { Profile } from "@/lib/matching";

const A: Profile = { id: "A", topics: { t1: 0.5, t2: 0.5 }, methods: ["pcr", "nmr"], activity: 1 };
const B: Profile = { id: "B", topics: { t1: 0.5, t3: 0.5 }, methods: ["pcr", "mass-spec"], activity: 1 };

describe("collaboration score", () => {
  it("defaults to 85% topic, 15% activity", () => {
    expect(DEFAULT_WEIGHTS.topic).toBe(0.85);
    expect(DEFAULT_WEIGHTS.activity).toBe(0.15);
    expect(scoreCollaboration(A, B)!.score).toBeCloseTo(0.85 * 0.5 + 0.15, 5);
  });
  it("never matches unrelated fields (topic similarity below 0.20)", () => {
    const far: Profile = { ...B, topics: { t1: 0.1, t9: 0.9 } };
    expect(scoreCollaboration(A, far)).toBeNull();
  });
  it("does not penalise identical methods", () => {
    expect(scoreCollaboration(A, { ...B, methods: A.methods })!.score).toBeCloseTo(scoreCollaboration(A, B)!.score, 5);
  });
  it("accepts custom weights", () => {
    expect(scoreCollaboration(A, { ...B, activity: 0 }, { topic: 1, activity: 1 })!.score).toBeCloseTo(0.25, 5);
  });
  it("normalises weights to sum to 1", () => {
    const w = resolveWeights({ topic: 3, activity: 1 });
    expect(w.topic + w.activity).toBeCloseTo(1, 5);
  });
});
