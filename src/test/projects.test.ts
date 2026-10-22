import { describe, expect, it } from "vitest";
import { can, describeActivity, invitable, isConflict, proposalMarkdown } from "@/lib/projects";

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
    expect(md).toContain("[P](u)");
    expect(md).toContain("Status: Drafting");
  });
  it("describes a section edit with its version", () => { expect(describeActivity("section_edited", { section: "Aims", version: 2 })).toBe("edited “Aims” (version 2)"); });
});
