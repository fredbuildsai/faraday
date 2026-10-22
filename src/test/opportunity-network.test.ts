import { describe, expect, it } from "vitest";
import { potentialCollaborators, secondDegree } from "@/lib/opportunity-network";

const paper = (...ids: string[]) => ({ authorships: ids.map((id) => ({ author: { id: `https://openalex.org/${id}`, display_name: `N${id}` } })) });
const direct = new Map([["A2", "Bob"]]);

describe("potential collaborators for own-work opportunities", () => {
  it("finds collaborators of collaborators and who connects them", () => {
    const s = secondDegree(direct, [{ collaboratorId: "A2", papers: [paper("A2", "A3", "A1")] }], ["A1"]);
    expect([...s.keys()]).toEqual(["A3"]);
    expect([...s.get("A3")!.via]).toEqual(["Bob"]);
  });
  it("lists direct collaborators before 2nd-degree ones and never the user", () => {
    const second = secondDegree(direct, [{ collaboratorId: "A2", papers: [paper("A3")] }], ["A1"]);
    const r = potentialCollaborators({ evidence: [paper("A1", "A2")], topic: [paper("A3", "A9")], direct, second, ownIds: ["A1"], limit: 8 });
    expect(r.map((p) => [p.id, p.degree])).toEqual([["A2", 1], ["A3", 2]]);
  });
  it("ignores topic authors outside the network", () => {
    const r = potentialCollaborators({ evidence: [], topic: [paper("A9")], direct, second: new Map(), ownIds: ["A1"], limit: 8 });
    expect(r).toEqual([]);
  });
  it("respects the limit", () => {
    const r = potentialCollaborators({ evidence: [paper("A1", "A4", "A5", "A6")], topic: [], direct, second: new Map(), ownIds: ["A1"], limit: 2 });
    expect(r).toHaveLength(2);
  });
});
