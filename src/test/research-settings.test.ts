import { describe, expect, it } from "vitest";
import { resolveResearchSettings } from "@/lib/research-settings";

describe("personal research settings", () => {
  it("defaults to ten collaborators", () => { expect(resolveResearchSettings({}).collaboratorLimit).toBe(10); });
  it("allows the user to choose a different collaborator limit", () => { expect(resolveResearchSettings({ collaboratorLimit: 6 }).collaboratorLimit).toBe(6); });
  it("uses the saved PI-only discovery preference", () => { expect(resolveResearchSettings({ piOnly: false }).piOnly).toBe(false); });
  it("reads 30 recent papers per person by default", () => { expect(resolveResearchSettings({}).paperLimit).toBe(30); });
  it("uses the saved paper limit", () => { expect(resolveResearchSettings({ paperLimit: 80 }).paperLimit).toBe(80); });
  it("ignores an out-of-range paper limit but keeps other settings", () => { const r = resolveResearchSettings({ paperLimit: 1, collaboratorLimit: 6 }); expect(r.paperLimit).toBe(30); expect(r.collaboratorLimit).toBe(6); });
});
