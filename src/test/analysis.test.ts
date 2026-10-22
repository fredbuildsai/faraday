import { describe, it, expect } from "vitest";
import { applyEdits, chunk, clipWords, inputFingerprint, verifyClaims } from "@/lib/analysis";

const titles = ["Deep learning for NMR", "Protein folding in cells", "A third paper"];

describe("analysis rules", () => {
  it("keeps a claim backed by 2 exact titles", () => {
    const r = verifyClaims([{ label: "NMR", evidence: ["deep learning for nmr", "Protein folding in cells"] }], titles, 10);
    expect(r.kept).toHaveLength(1);
  });
  it("drops a claim with only 1 verified title", () => {
    const r = verifyClaims([{ label: "X", evidence: ["Deep learning for NMR", "Made up title"] }], titles, 10);
    expect(r.kept).toHaveLength(0);
    expect(r.dropped).toHaveLength(1);
  });
  it("caps methods at 8", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ label: `m${i}`, evidence: titles.slice(0, 2) }));
    expect(verifyClaims(many, titles, 8).kept).toHaveLength(8);
  });
  it("summary is clipped to 80 words", () => {
    expect(clipWords(Array(100).fill("w").join(" ")).split(" ")).toHaveLength(80);
  });
  it("sends 100 works per call", () => {
    expect(chunk(Array(250).fill(0)).map((c) => c.length)).toEqual([100, 100, 50]);
  });
  it("same input gives same fingerprint, changed interests differ", () => {
    const w = [{ title: "a", year: 2020, keywords: [], topics: [] }];
    expect(inputFingerprint(w, "x")).toBe(inputFingerprint(w, "x"));
    expect(inputFingerprint(w, "x")).not.toBe(inputFingerprint(w, "y"));
  });
  it("user edits survive: removed hidden, added marked", () => {
    const out = applyEdits([{ label: "NMR", evidence: [] }, { label: "MS", evidence: [] }],
      [{ kind: "method", value: "nmr", action: "remove" }, { kind: "method", value: "Cryo-EM", action: "add" }], "method");
    expect(out.map((c) => c.label)).toEqual(["MS", "Cryo-EM"]);
    expect(out[1]!.byUser).toBe(true);
  });
});
