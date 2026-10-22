import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveAiConfig } from "@/lib/ai-config";

export const saveCustomTopics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ topics: z.array(z.string().trim().min(1).max(80)).max(30) }).parse(d))
  .handler(async ({ data, context }) => {
    const topics = Array.from(new Set(data.topics));
    const { error } = await context.supabase.from("profiles").update({ custom_topics: topics }).eq("id", context.userId);
    if (error) throw new Error("Could not save topics");
    return { ok: true };
  });

/** Draft a research-interests paragraph from the user's published titles and topics. Does not save. */
export const draftResearchInterests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const cfg = resolveAiConfig(process.env);
    if (!cfg.apiKey) return { text: null as string | null, error: "AI is not configured" };
    const [{ data: profile }, { data: works }] = await Promise.all([
      context.supabase.from("profiles").select("custom_topics").eq("id", context.userId).maybeSingle(),
      context.supabase.from("works").select("title, year, topics").eq("user_id", context.userId)
        .order("year", { ascending: false, nullsFirst: false }).limit(60),
    ]);
    if (!works?.length) return { text: null, error: "No publications yet" };
    const topicSet = new Set<string>(profile?.custom_topics ?? []);
    for (const w of works) for (const t of ((w.topics as any[]) ?? [])) if (t?.name) topicSet.add(t.name);
    const input = {
      titles: works.map((w) => `${w.title}${w.year ? ` (${w.year})` : ""}`),
      topics: Array.from(topicSet).slice(0, 30),
    };
    try {
      const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: cfg.model,
          temperature: 0.2,
          messages: [
            { role: "system", content: "You write a researcher's 'research interests' statement in first person, max 70 words, plain prose, based only on the given published titles and topics. No invented facts, no names, no institutions." },
            { role: "user", content: JSON.stringify(input) },
          ],
        }),
      });
      if (!res.ok) {
        console.error("AI draft failed", res.status, await res.text());
        return { text: null, error: res.status === 429 ? "AI is busy, try again shortly" : "AI request failed" };
      }
      const j: any = await res.json();
      const text = String(j.choices?.[0]?.message?.content ?? "").trim().slice(0, 500);
      return { text: text || null, error: text ? null : "Empty AI answer" };
    } catch (e) {
      console.error("AI draft error", e);
      return { text: null, error: "AI request failed" };
    }
  });
