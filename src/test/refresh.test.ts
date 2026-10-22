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

import { isLocalNight, localHour } from "@/lib/refresh";
describe("local night window", () => {
  const t = new Date("2026-07-01T01:30:00Z"); // 03:30 Madrid, 18:30 Vancouver
  it("Madrid at 03:30 is night", () => expect(isLocalNight("Europe/Madrid", t)).toBe(true));
  it("Vancouver at 18:30 is not night", () => expect(isLocalNight("America/Vancouver", t)).toBe(false));
  it("Vancouver at 02:00 local is night", () => expect(isLocalNight("America/Vancouver", new Date("2026-07-01T09:00:00Z"))).toBe(true));
  it("missing or bad zone falls back to UTC", () => {
    expect(localHour(null, t)).toBe(1);
    expect(localHour("Not/AZone", t)).toBe(1);
  });
  it("05:00 local is outside the window", () => expect(isLocalNight("UTC", new Date("2026-07-01T05:00:00Z"))).toBe(false));
});
