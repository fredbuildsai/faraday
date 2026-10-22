import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SIZE, paginate, sortWorks } from "@/lib/paginate";

const works = [
  { id: "a", year: 2020, cited_by_count: 50 },
  { id: "b", year: 2024, cited_by_count: 2 },
  { id: "c", year: 2022, cited_by_count: 10 },
];

describe("publications list", () => {
  it("defaults to 5 per page", () => expect(DEFAULT_PAGE_SIZE).toBe(5));
  it("sorts most recent first", () => expect(sortWorks(works, "recent").map((w) => w.id)).toEqual(["b", "c", "a"]));
  it("sorts most cited first", () => expect(sortWorks(works, "cited").map((w) => w.id)).toEqual(["a", "c", "b"]));
  it("splits 12 items into pages of 5", () => {
    const r = paginate(Array.from({ length: 12 }, (_, i) => i), 3, 5);
    expect(r.pages).toBe(3);
    expect(r.items).toEqual([10, 11]);
  });
});
