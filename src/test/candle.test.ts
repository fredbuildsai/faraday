import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PASSAGES, pickPassage } from "@/lib/candle";

const norm = (s: string) => s.replace(/\s+/g, " ").toLowerCase();
const book = norm(readFileSync("public/books/chemical-history-of-a-candle.txt", "utf8"));

describe("candle passages", () => {
  it("bundles the full book", () => {
    expect(book).toContain("lecture vi");
    expect(book.length).toBeGreaterThan(200_000);
  });
  for (const p of PASSAGES) {
    it(`quotes verbatim: ${p.text.slice(0, 40)}`, () => {
      expect(book).toContain(norm(p.text));
    });
  }
  it("always shows the philosophers passage", () => {
    expect(PASSAGES[0]!.text).toMatch(/^We come here to be philosophers/);
    expect(PASSAGES[0]!.text).toContain("find out the reason.");
    expect(PASSAGES[0]!.source).toBe("Lecture I");
  });
  it("pickPassage stays in range", () => {
    expect(pickPassage(0)).toBe(PASSAGES[0]);
    expect(pickPassage(0.9999)).toBe(PASSAGES[PASSAGES.length - 1]);
  });
});
