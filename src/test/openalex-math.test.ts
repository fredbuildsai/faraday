import { describe, it, expect } from "vitest";
import { computeActivity, computeTopicWeights, confidentMatch, shortId, type AuthorCandidate } from "@/lib/openalex-math";

describe("openalex math", () => {
  it("normalises topic weights to sum 1", () => {
    const w = computeTopicWeights([
      { year: 2024, topics: [{ id: "T1", name: "a", score: 0.6 }, { id: "T2", name: "b", score: 0.2 }] },
      { year: 2020, topics: [{ id: "T1", name: "a", score: 0.2 }] },
    ]);
    expect(w.T1).toBeCloseTo(0.8);
    expect(w.T2).toBeCloseTo(0.2);
  });
  it("keeps only the top 25 topics", () => {
    const topics = Array.from({ length: 30 }, (_, i) => ({ id: `T${i}`, name: "", score: 30 - i }));
    expect(Object.keys(computeTopicWeights([{ year: 2024, topics }]))).toHaveLength(25);
  });
  it("activity = recent works / 3, capped at 1", () => {
    const y = (year: number) => ({ year, topics: [] });
    expect(computeActivity([y(2026), y(2024), y(2023)], 2026)).toBeCloseTo(2 / 3);
    expect(computeActivity([y(2026), y(2025), y(2024), y(2024)], 2026)).toBe(1);
  });
  it("strips openalex ids", () => {
    expect(shortId("https://openalex.org/A5082461253")).toBe("A5082461253");
  });
  it("confident only for a single exact name + institution", () => {
    const c = (id: string, name: string, institution: string): AuthorCandidate => ({ id, name, institution, worksCount: 1, topTopics: [], orcid: null });
    expect(confidentMatch([c("A1", "Johan Bollen", "Indiana University"), c("A2", "Johan Bollen", "MIT")], "Johan Bollen", "Indiana University")?.id).toBe("A1");
    expect(confidentMatch([c("A1", "Johan Bollen", "Indiana University")], "Johan Bollen", null)).toBeNull();
  });
});
