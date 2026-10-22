import { describe, expect, it } from "vitest";
import { DEFAULT_SECTIONS, addCustomRole, allRoles, can, commentSource, describeActivity, fromSaved, invitable, isConflict, parseMentions, proposalMarkdown, proposalText } from "@/lib/projects";

describe("shared opportunity permissions", () => {
  const owner = { role: "owner" as const, state: "accepted" as const };
  const editor = { role: "editor" as const, state: "accepted" as const };
  const invitee = { role: "editor" as const, state: "invited" as const };
  it("editors can edit and comment", () => { expect(can(editor, "edit")).toBe(true); expect(can(editor, "comment")).toBe(true); });
  it("only owners invite, remove, archive, delete or transfer", () => {
    for (const a of ["invite", "remove", "archive", "delete", "transfer"] as const) { expect(can(editor, a)).toBe(false); expect(can(owner, a)).toBe(true); }
  });
  it("invitees cannot see or edit before accepting", () => { expect(can(invitee, "view")).toBe(false); expect(can(invitee, "edit")).toBe(false); });
});

describe("invitations", () => {
  it("only matches, not already in, never yourself", () => {
    expect(invitable(["m1", "m2", "x", "me", "m1"], ["m1", "m2", "me"], ["m2"], "me")).toEqual(["m1"]);
  });
});

describe("edit conflicts", () => {
  it("a save based on an older version is a conflict", () => { expect(isConflict(3, 4)).toBe(true); expect(isConflict(4, 4)).toBe(false); });
});

describe("export and activity", () => {
  it("export lists sections and evidence", () => {
    const md = proposalMarkdown({ title: "T", description: "D", status: "drafting", people: [{ name: "A", role: "owner" }], sections: [{ title: "Aims", body: "" }], papers: [{ title: "P", url: "u" }] });
    expect(md).toContain("## Aims");
    expect(md).toContain("- P (u)");
    expect(md).toContain("Status: Drafting");
  });
  it("describes a section edit with its version", () => { expect(describeActivity("section_edited", { section: "Aims", version: 2 })).toBe("edited “Aims” (version 2)"); });
});

describe("manuscript workspace", () => {
  it("new opportunities use the classical article structure", () => {
    expect(DEFAULT_SECTIONS.map((s) => s.title)).toEqual(["Abstract", "Introduction", "Experimental", "Results and discussion", "Conclusions"]);
  });
  it("custom roles are added once and kept after the default roles", () => {
    expect(addCustomRole(["Cell assembly"], "cell ASSEMBLY")).toEqual(["Cell assembly"]);
    expect(addCustomRole([], "Methodology")).toEqual([]);
    expect(allRoles(["Cell assembly"]).at(-1)).toBe("Cell assembly");
    expect(allRoles([])).toContain("Conceptualization");
  });
  it("tags members by full name, never yourself", () => {
    const people = [{ user_id: "a", name: "Jeff Dahn" }, { user_id: "b", name: "Brett Lucht" }, { user_id: "me", name: "Me Self" }];
    expect(parseMentions("@Jeff Dahn and @me self please check", people, "me")).toEqual(["a"]);
  });
  it("comments say where they come from", () => {
    const lookup = { sections: [{ id: "s", title: "Abstract" }], papers: [], items: [{ id: "q", kind: "question", title: "Why?" }], references: [] };
    expect(commentSource({ section_id: "s" }, lookup).label).toBe("Draft: Abstract");
    expect(commentSource({ item_id: "q" }, lookup).label).toBe("Open question: Why?");
    expect(commentSource({}, lookup).label).toBe("General");
  });
  it("exports contributor roles and numbered references in md and txt", () => {
    const input = { title: "T", description: "", status: "idea" as const, people: [{ name: "A", role: "owner", contributions: ["Methodology"] }], sections: [], papers: [], references: [{ title: "R", authors: "X", year: 2024, venue: "J", doi: "10.1/x", url: null }] };
    expect(proposalMarkdown(input)).toContain("- A — Methodology");
    expect(proposalMarkdown(input)).toContain("1. X (2024) R. J. https://doi.org/10.1/x");
    expect(proposalText(input)).toContain("[1] X (2024) R.");
  });
});

describe("saved opportunity to shared", () => {
  it("keeps notes, whitespace, evidence, closest papers and people", () => {
    const r = fromSaved({ id: "s1", notes: "my idea", snapshot: { title: "T", description: "D", evidence: [{ id: "W1", title: "E", url: "u", isOa: true }], pis: [{ id: "A1", name: "Brett Lucht" }], potential: [{ id: "A1", name: "Brett Lucht" }, { id: "A2", name: "X" }], whitespace: { level: "moderate", closest: [{ id: "W2", title: "C", url: "v" }, { id: "W1", title: "E", url: "u" }] } } });
    expect(r.notes).toBe("my idea");
    expect(r.whitespace?.level).toBe("moderate");
    expect(r.papers.map((p) => [p.openalexId, p.origin])).toEqual([["W1", "evidence"], ["W2", "prior_art"]]);
    expect(r.people.map((p) => p.id)).toEqual(["A1", "A2"]);
    expect(r.source.savedOpportunityId).toBe("s1");
  });
});
