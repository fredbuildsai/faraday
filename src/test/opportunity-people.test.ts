import { describe, it, expect } from "vitest";
import { opportunityPeople, eligibleOpportunityPeople } from "@/lib/opportunity-people";

describe("opportunity collaborators", () => {
  const works = [{ authors: [{ id: "A1", name: "Me" }, { id: "A2", name: "Brett" }, { id: "https://openalex.org/A2", name: "Brett" }, { id: "A3", name: "Hubert" }] }];
  it("includes direct collaborators once and excludes your own profiles", () => {
    expect(opportunityPeople([], works, ["https://openalex.org/A1"]).map((p) => p.id)).toEqual(["A2", "A3"]);
  });
  it("merges a collaborator who is also a match into one choice", () => {
    const people = opportunityPeople([{ id: "member", name: "Brett", mutual: false, authorIds: ["A2"] }], works, ["A1"]);
    expect(people.map((p) => p.id)).toEqual(["member", "A3"]);
    expect(people[0]?.collaborator).toBe(true);
  });
  it("keeps collaborators when filtering matches to mutual interest", () => {
    const people = opportunityPeople([{ id: "member", name: "Jeff", mutual: false, authorIds: ["A4"] }], works, ["A1"]);
    expect(eligibleOpportunityPeople(people, true).map((p) => p.id)).toEqual(["A2", "A3"]);
  });
});