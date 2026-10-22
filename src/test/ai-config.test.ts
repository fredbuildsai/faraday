import { describe, expect, it } from "vitest";
import { resolveAiConfig } from "@/lib/ai-config";

describe("resolveAiConfig", () => {
  it("defaults to mistral-small-latest", () => {
    const c = resolveAiConfig({ MISTRAL_API_KEY: "k" });
    expect(c.provider).toBe("mistral");
    expect(c.model).toBe("mistral-small-latest");
    expect(c.apiKey).toBe("k");
  });
  it("switches provider via AI_PROVIDER", () => {
    const c = resolveAiConfig({ AI_PROVIDER: "groq", GROQ_API_KEY: "g" });
    expect(c.model).toBe("llama-3.3-70b-versatile");
    expect(c.apiKey).toBe("g");
  });
  it("model env overrides the default", () => {
    expect(resolveAiConfig({ AI_PROVIDER: "groq", GROQ_MODEL: "deepseek-r1-distill-llama-70b" }).model).toBe("deepseek-r1-distill-llama-70b");
  });
  it("unknown provider falls back to mistral", () => {
    expect(resolveAiConfig({ AI_PROVIDER: "foo" }).provider).toBe("mistral");
  });
});
