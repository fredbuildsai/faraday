import { describe, expect, it } from "vitest";
import { resolveResearchSettings } from "@/lib/research-settings";

describe("personal research settings", () => {
  it("defaults to ten collaborators", () => { expect(resolveResearchSettings({}).collaboratorLimit).toBe(10); });
  it("allows the user to choose a different collaborator limit", () => { expect(resolveResearchSettings({ collaboratorLimit: 6 }).collaboratorLimit).toBe(6); });
  it("uses the saved PI-only discovery preference", () => { expect(resolveResearchSettings({ piOnly: false }).piOnly).toBe(false); });
});