import { describe, expect, it } from "vitest";
import { clipDescription, isFresh, verifySuggestions } from "@/lib/opportunities";

const works = [
  { id: "https://openalex.org/W1", title: "A", url: "u1" },
  { id: "https://openalex.org/W2", title: "B", url: "u2" },
  { id: "https://openalex.org/W3", title: "C", url: "u3" },
];

describe("opportunities", () => {
  it("keeps a suggestion with 2 verified works", () => {
    const r = verifySuggestions([{ title: "Gap", description: "d", evidence: ["W1", "https://openalex.org/W2"] }], works);
    expect(r.kept).toHaveLength(1);
    expect(r.kept[0]!.evidence.map((w) => w.url)).toEqual(["u1", "u2"]);
  });
  it("drops a suggestion with only 1 verified work", () => {
    const r = verifySuggestions([{ title: "Gap", description: "d", evidence: ["W1", "W999"] }], works);
    expect(r.kept).toHaveLength(0);
    expect(r.dropped).toHaveLength(1);
  });
  it("counts a duplicate id once", () => {
    expect(verifySuggestions([{ title: "G", evidence: ["W1", "W1"] }], works).kept).toHaveLength(0);
  });
  it("keeps at most 3", () => {
    const s = Array.from({ length: 5 }, (_, i) => ({ title: `G${i}`, evidence: ["W1", "W2"] }));
    expect(verifySuggestions(s, works).kept).toHaveLength(3);
  });
  it("clips description to 60 words", () => {
    expect(clipDescription(Array(80).fill("w").join(" ")).split(" ")).toHaveLength(60);
  });
  it("cache is fresh for 7 days", () => {
    const now = Date.parse("2026-01-08T00:00:00Z");
    expect(isFresh("2026-01-02T00:00:00Z", now)).toBe(true);
    expect(isFresh("2026-01-01T00:00:00Z", now)).toBe(false);
  });
});
