// AI provider settings: code defaults, optionally overridden by environment variables.
// Model names are not secret; only the API keys live in Secrets.

export type AiProvider = "mistral" | "openrouter" | "groq";

export const AI_PROVIDERS: Record<AiProvider, { baseUrl: string; keyEnv: string; modelEnv: string; defaultModel: string }> = {
  mistral: { baseUrl: "https://api.mistral.ai/v1", keyEnv: "MISTRAL_API_KEY", modelEnv: "MISTRAL_MODEL", defaultModel: "mistral-small-latest" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", keyEnv: "OPENROUTER_API_KEY", modelEnv: "OPENROUTER_MODEL", defaultModel: "nvidia/nemotron-3.5-super-vl:free" },
  groq: { baseUrl: "https://api.groq.com/openai/v1", keyEnv: "GROQ_API_KEY", modelEnv: "GROQ_MODEL", defaultModel: "openai/gpt-oss-120b" },
};

export const DEFAULT_PROVIDER: AiProvider = "openrouter";

export interface ResolvedAiConfig {
  provider: AiProvider;
  baseUrl: string;
  model: string;
  apiKey: string | undefined;
}

type Env = Record<string, string | undefined>;

/** Pick provider from AI_PROVIDER (fallback: default), model from <PROVIDER>_MODEL (fallback: default). */
export function resolveAiConfig(env: Env): ResolvedAiConfig {
  const raw = env["AI_PROVIDER"]?.trim().toLowerCase();
  const provider: AiProvider = raw && raw in AI_PROVIDERS ? (raw as AiProvider) : DEFAULT_PROVIDER;
  const p = AI_PROVIDERS[provider];
  const model = env[p.modelEnv]?.trim() || p.defaultModel;
  return { provider, baseUrl: p.baseUrl, model, apiKey: env[p.keyEnv] || undefined };
}
