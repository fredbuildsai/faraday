import { resolveAiConfig, type AiProvider } from "@/lib/ai-config";

type Msg = { role: "system" | "user"; content: string };

/** Chat completion with one retry on 429 and fallback to other providers that have a key. */
export async function aiChat(messages: Msg[], opts: { json?: boolean } = {}): Promise<{ text: string | null; status: number }> {
  const cfg = resolveAiConfig(process.env);
  const others = (["openrouter", "mistral", "groq"] as AiProvider[])
    .filter((p) => p !== cfg.provider)
    .map((p) => resolveAiConfig({ ...process.env, AI_PROVIDER: p }))
    .filter((c) => c.apiKey);
  const attempts = [...(cfg.apiKey ? [cfg, cfg] : []), ...others];
  let lastStatus = 0;
  for (let i = 0; i < attempts.length; i++) {
    const c = attempts[i]!;
    if (cfg.apiKey && i === 1) { if (lastStatus !== 429) continue; await new Promise((r) => setTimeout(r, 2000)); }
    try {
      // A slow provider must not hang the request: give up after 40s and try the next one.
      const res = await fetch(`${c.baseUrl}/chat/completions`, {
        method: "POST",
        signal: AbortSignal.timeout(Number(process.env["AI_TIMEOUT_MS"]) || 40_000),
        headers: { Authorization: `Bearer ${c.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: c.model, temperature: 0.2, messages, ...(opts.json ? { response_format: { type: "json_object" } } : {}) }),
      });
      if (!res.ok) { lastStatus = res.status; console.error("AI failed", c.provider, res.status, (await res.text()).slice(0, 300)); continue; }
      const j: any = await res.json();
      const text = String(j.choices?.[0]?.message?.content ?? "").trim();
      if (text) return { text, status: 200 };
    } catch (e) { console.error("AI error", c.provider, e); }
  }
  return { text: null, status: lastStatus };
}

export function parseJson(text: string | null): any {
  if (!text) return null;
  const m = text.match(/\{[\s\S]*\}/);
  try { return JSON.parse(m ? m[0] : text); } catch { return null; }
}
