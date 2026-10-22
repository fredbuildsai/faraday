import { describe, expect, it } from "vitest";
import { BATCH_SIZE, coauthorsOf, pickDiscovery, type Candidate } from "@/lib/discovery";

const topics = { t1: 1, t2: 1 };
const prof = (id: string, t: Record<string, number> = topics) => ({ id, topics: t, methods: [], activity: 1 });
const cand = (id: string, authorIds: string[], co: [string, string][] = [], t?: Record<string, number>): Candidate =>
  ({ profile: prof(id, t), authorIds, coauthors: new Map(co) });
const me = { profile: prof("me"), authorIds: ["A0"], coauthors: new Map([["A1", "Ada Co"]]) };

describe("discovery", () => {
  it("returns at most 10 per request", () => {
    expect(BATCH_SIZE).toBe(10);
    const many = Array.from({ length: 15 }, (_, i) => cand(`u${String(i).padStart(2, "0")}`, [`X${i}`]));
    expect(pickDiscovery(me, many, new Set())).toHaveLength(10);
  });
  it("excludes self, already matched (saved/dismissed) and direct co-authors", () => {
    const r = pickDiscovery(me, [cand("me", ["A0"]), cand("seen", ["S"]), cand("coauthor", ["A1"]), cand("ok", ["Z"])], new Set(["seen"]));
    expect(r.map((x) => x.b === "me" ? x.a : x.b)).toEqual(["ok"]);
  });
  it("excludes people who list me as co-author", () => {
    expect(pickDiscovery(me, [cand("x", ["X"], [["A0", "Me"]])], new Set())).toHaveLength(0);
  });
  it("puts collaborators of collaborators first, naming the shared co-author", () => {
    const r = pickDiscovery(me, [cand("int", ["I"]), cand("sec", ["S"], [["A1", "Ada Co"]])], new Set());
    expect(r[0]!.layer).toBe("second_degree");
    expect(r[0]!.via).toBe("Ada Co");
    expect(r[1]!.layer).toBe("interest");
  });
  it("keeps the topic gate for collaborators of collaborators", () => {
    expect(pickDiscovery(me, [cand("far", ["F"], [["A1", "Ada"]], { other: 1 })], new Set())).toHaveLength(0);
  });
  it("collects co-authors without the person themselves", () => {
    const m = coauthorsOf([{ authors: [{ id: "A0", name: "Me" }, { id: "B", name: "Bo" }] }], ["A0"]);
    expect([...m.keys()]).toEqual(["B"]);
  });
});
