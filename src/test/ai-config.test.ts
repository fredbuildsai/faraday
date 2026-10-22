import { describe, it, expect } from "vitest";
import { resolveAiConfig } from "@/lib/ai-config";

describe("resolveAiConfig", () => {
  it("defaults to OpenRouter with nvidia/nemotron-3.5-super-vl:free", () => {
    const c = resolveAiConfig({ OPENROUTER_API_KEY: "o" });
    expect(c.provider).toBe("openrouter");
    expect(c.model).toBe("nvidia/nemotron-3.5-super-vl:free");
    expect(c.apiKey).toBe("o");
  });
  it("switches provider via AI_PROVIDER", () => {
    const c = resolveAiConfig({ AI_PROVIDER: "groq", GROQ_API_KEY: "g" });
    expect(c.provider).toBe("groq");
    expect(c.apiKey).toBe("g");
  });
  it("model env overrides the default", () => {
    expect(resolveAiConfig({ AI_PROVIDER: "groq", GROQ_MODEL: "deepseek-r1-distill-llama-70b" }).model).toBe("deepseek-r1-distill-llama-70b");
  });
  it("unknown provider falls back to openrouter", () => {
    expect(resolveAiConfig({ AI_PROVIDER: "foo" }).provider).toBe("openrouter");
  });
});
