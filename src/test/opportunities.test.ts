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

import { assessWhitespace, principalInvestigators, sameSettings } from "@/lib/opportunities";
import { describe as d2, it as i2, expect as e2 } from "vitest";

d2("principal investigators", () => {
  i2("lists each paper's last author once, merged by id", () => {
    const pis = principalInvestigators([
      { authorships: [
        { author_position: "middle", is_corresponding: true, author: { id: "A2", display_name: "Corr" } },
        { author_position: "last", author: { id: "A3", display_name: "Senior" } },
      ] },
      { authorships: [{ author_position: "last", author: { id: "A3", display_name: "Senior" } }] },
    ]);
    e2(pis.map((p) => p.name)).toEqual(["Senior"]);
  });
});

d2("whitespace", () => {
  const base = { query: "sodium battery cathode aging", sinceYear: 2023, totalCount: 100 };
  i2("under 50 recent papers is potentially underexplored", () => {
    e2(assessWhitespace({ ...base, recentCount: 49, closest: [] }).level).toBe("underexplored");
  });
  i2("500 or more recent papers is well studied", () => {
    e2(assessWhitespace({ ...base, recentCount: 500, closest: [] }).level).toBe("crowded");
  });
  i2("a closely matching existing title marks it well studied", () => {
    const w = assessWhitespace({ ...base, recentCount: 3, closest: [{ id: "W1", title: "Sodium battery cathode aging", url: "" }] });
    e2(w.level).toBe("crowded");
  });
});

d2("settings cache", () => {
  i2("different mode or review filter means not the same", () => {
    const s = { mode: "broad" as const, excludeReviews: false, mutualOnly: false, matchIds: [] };
    e2(sameSettings(s, s)).toBe(true);
    e2(sameSettings({ ...s, excludeReviews: true }, s)).toBe(false);
  });
});

import { searchTerms as st, principalInvestigators as pi } from "@/lib/opportunities";
describe("whitespace search terms", () => {
  it("removes ? so OpenAlex accepts the search", () => {
    const t = st("What is the role of Na⁺ substitution on early Ni‑mediated surface reconstruction?");
    expect(t).not.toMatch(/[?*]/);
    expect(t).toContain("substitution");
  });
});
describe("likely PIs", () => {
  it("keeps only last authors, not corresponding ones", () => {
    const r = pi([{ authorships: [
      { author_position: "first", is_corresponding: true, author: { id: "A1", display_name: "First" } },
      { author_position: "last", author: { id: "A2", display_name: "Last" } },
    ] }]);
    expect(r.map((p) => p.name)).toEqual(["Last"]);
  });
});

import { threeYearsAgo, byFewestRecent } from "@/lib/opportunities";
describe("last 3 years window and order", () => {
  it("window starts exactly 3 years before today", () => {
    expect(threeYearsAgo(new Date("2026-10-22T12:00:00Z"))).toBe("2023-10-22");
  });
  it("fewest recent papers first, unknown last", () => {
    const s = (n: number | null) => ({ whitespace: { recentCount: n } });
    expect(byFewestRecent([s(50), s(null), s(3), s(12)]).map((x) => x.whitespace.recentCount)).toEqual([3, 12, 50, null]);
  });
});
