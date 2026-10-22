import { describe, expect, it } from "vitest";
import { inDeck, swipeDecision } from "@/lib/swipe";

describe("swipe", () => {
  it("right past threshold likes", () => expect(swipeDecision(120)).toBe("like"));
  it("left past threshold passes", () => expect(swipeDecision(-120)).toBe("pass"));
  it("short drag decides nothing", () => expect(swipeDecision(60)).toBeNull());
  it("decided matches leave the deck", () => {
    expect(inDeck({ state: "active", i_am_interested: false })).toBe(true);
    expect(inDeck({ state: "saved", i_am_interested: false })).toBe(false);
    expect(inDeck({ state: "active", i_am_interested: true })).toBe(false);
  });
  it("dismissed members are proposed again, unless passed this visit", () => {
    expect(inDeck({ state: "dismissed", i_am_interested: false })).toBe(true);
    expect(inDeck({ state: "dismissed", i_am_interested: true })).toBe(true);
    expect(inDeck({ state: "dismissed", i_am_interested: false }, true)).toBe(false);
  });
});
