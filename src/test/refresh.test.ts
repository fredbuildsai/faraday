import { describe, expect, it } from "vitest";
import { isDue, pauseReasonFor } from "@/lib/refresh";
import { cleanIdeas } from "@/lib/match-ideas";

const now = new Date("2026-10-22T00:00:00Z");

describe("monthly refresh", () => {
  it("is due after 30 days", () => expect(isDue("2026-09-22T00:00:00Z", now)).toBe(true));
  it("is not due after 29 days", () => expect(isDue("2026-09-23T00:00:00Z", now)).toBe(false));
  it("skips never-imported profiles", () => expect(isDue(null, now)).toBe(false));
  it("pauses on 402 and 403 only", () => {
    expect(pauseReasonFor(402)).not.toBeNull();
    expect(pauseReasonFor(403)).not.toBeNull();
    expect(pauseReasonFor(429)).toBeNull();
  });
});

describe("match ideas", () => {
  it("keeps at most 2 ideas", () => {
    const r = cleanIdeas({ summary: "x", ideas: [1, 2, 3].map((n) => ({ title: `t${n}`, description: "d" })) });
    expect(r.ideas).toHaveLength(2);
  });
  it("clips the summary to 60 words", () => {
    const r = cleanIdeas({ summary: Array(80).fill("w").join(" "), ideas: [] });
    expect(r.summary.split(" ")).toHaveLength(60);
  });
});
