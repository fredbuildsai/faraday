import { describe, expect, it } from "vitest";
import { authorActivity, authorTopicWeights, collectCandidates, rankExternal, topCoauthors } from "@/lib/discovery-external";

const au = (id: string, name: string, pos = "middle") => ({ author: { id: `https://openalex.org/${id}`, display_name: name }, author_position: pos });
const me = { id: "me", topics: { T1: 0.5, T2: 0.5 }, methods: [], activity: 1 };
const author = (id: string, topics: [string, number][], extra: any = {}) => ({
  id, display_name: id, topics: topics.map(([t, count]) => ({ id: `https://openalex.org/${t}`, display_name: `Topic ${t}`, count })),
  counts_by_year: [{ year: 2026, works_count: 5 }], ...extra,
});

describe("wider OpenAlex discovery", () => {
  it("follows the most frequent co-authors", () => {
    const w = [{ authors: [{ id: "A0", name: "Me" }, { id: "B", name: "Bo" }] }, { authors: [{ id: "B", name: "Bo" }, { id: "C", name: "Cy" }] }];
    expect(topCoauthors(w, ["A0"], 1).map((x) => x.id)).toEqual(["B"]);
  });
  it("excludes known people and puts collaborators of collaborators first", () => {
    const r = collectCandidates(
      [{ via: "Bo", works: [{ authorships: [au("B", "Bo"), au("X", "Xi", "last")] }] }],
      [{ authorships: [au("Y", "Yo", "first"), au("Z", "Zed", "last")] }],
      new Set(["B"]),
    );
    expect(r.map((x) => [x.id, x.layer, x.via])).toEqual([["X", "second_degree", "Bo"], ["Z", "interest", null]]);
  });
  it("takes only the last author from topic search", () => {
    const r = collectCandidates([], [{ authorships: [au("F", "F", "first"), au("L", "L", "last")] }], new Set());
    expect(r.map((x) => x.id)).toEqual(["L"]);
  });
  it("normalises author topics and counts recent works", () => {
    expect(authorTopicWeights(author("A", [["T1", 3], ["T2", 1]]))).toEqual({ T1: 0.75, T2: 0.25 });
    expect(authorActivity({ counts_by_year: [{ year: 2026, works_count: 1 }, { year: 2020, works_count: 9 }] }, 2026)).toBeCloseTo(1 / 3);
  });
  it("applies the topic gate to outside researchers", () => {
    const authors = new Map([["N", author("N", [["T1", 1]])], ["F", author("F", [["T9", 1]])]]);
    const raws = [{ id: "N", name: "N", layer: "interest" as const, via: null, hits: 1 }, { id: "F", name: "F", layer: "interest" as const, via: null, hits: 1 }];
    expect(rankExternal(me, raws, authors, {}, 10, 2026).map((x) => x.openalex_id)).toEqual(["N"]);
  });
  it("returns no more than requested", () => {
    const authors = new Map(["a", "b", "c"].map((id) => [id, author(id, [["T1", 1]])]));
    const raws = ["a", "b", "c"].map((id) => ({ id, name: id, layer: "interest" as const, via: null, hits: 1 }));
    expect(rankExternal(me, raws, authors, {}, 2, 2026)).toHaveLength(2);
  });
});

describe("principal-investigator toggle", () => {
  const works = [{ authorships: [au("F", "F", "first"), au("M", "M"), au("L", "L", "last")] }];
  it("on by default: only last authors", () => {
    expect(collectCandidates([{ via: "Bo", works }], works, new Set()).map((x) => x.id)).toEqual(["L"]);
  });
  it("off: every author", () => {
    expect(collectCandidates([], works, new Set(), false).map((x) => x.id).sort()).toEqual(["F", "L", "M"]);
  });
});
