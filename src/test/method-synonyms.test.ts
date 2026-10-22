import { describe, expect, it } from "vitest";
import { tidyMethod } from "@/lib/method-synonyms";

describe("tidyMethod", () => {
  it("tidies case, spaces and plural", () => expect(tidyMethod("  Surveys ")).toBe("survey"));
  it("maps synonyms to one name", () => expect(tidyMethod("NLP")).toBe("natural language processing"));
  it("merges plural synonyms", () => expect(tidyMethod("Semi-structured interviews")).toBe("interview"));
});
