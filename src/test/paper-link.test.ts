import { describe, expect, it } from "vitest";
import { abstractFromIndex, openalexWorkPath } from "@/lib/paper-link";

describe("paper links open in the app", () => {
  it("reads an OpenAlex work URL", () => { expect(openalexWorkPath("https://openalex.org/W123")).toBe("/works/W123"); });
  it("reads a bare work id", () => { expect(openalexWorkPath("W42")).toBe("/works/W42"); });
  it("reads a DOI URL", () => { expect(openalexWorkPath("https://doi.org/10.1038/abc.1")).toBe("/works/doi:10.1038/abc.1"); });
  it("rejects other links", () => { expect(openalexWorkPath("https://example.com/x")).toBeNull(); });
  it("rebuilds an abstract in word order", () => { expect(abstractFromIndex({ world: [1], hello: [0] })).toBe("hello world"); });
});
