import { describe, expect, it } from "vitest";
import { openAccessPercentage } from "@/lib/publication-metrics";
import { threeYearsAgo } from "@/lib/opportunities";

describe("open-access scientist metric", () => {
  it("uses open-access publications divided by all publications", () => {
    expect(openAccessPercentage(40, 10)).toBe(25);
  });
  it("keeps genuine zero open-access publications as zero percent", () => {
    expect(openAccessPercentage(40, 0)).toBe(0);
  });
  it("does not report missing data or no publications as zero percent", () => {
    expect(openAccessPercentage(null, null)).toBeNull();
    expect(openAccessPercentage(0, 0)).toBeNull();
  });
  it("uses a rolling three-year window", () => {
    expect(threeYearsAgo(new Date("2026-10-22T21:52:00Z"))).toBe("2023-10-22");
  });
});