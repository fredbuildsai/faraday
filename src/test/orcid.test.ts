import { describe, it, expect } from "vitest";
import { isValidOrcid, normaliseOrcid } from "@/lib/orcid";

describe("orcid", () => {
  it("accepts valid ORCIDs", () => {
    expect(isValidOrcid("0000-0002-1825-0097")).toBe(true);
    expect(isValidOrcid("https://orcid.org/0000-0002-1694-233X")).toBe(true);
  });
  it("rejects bad checksum", () => {
    expect(isValidOrcid("0000-0002-1825-0098")).toBe(false);
  });
  it("normalises", () => {
    expect(normaliseOrcid("0000000218250097")).toBe("0000-0002-1825-0097");
  });
});
