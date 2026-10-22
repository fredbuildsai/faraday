import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiChat, parseJson } from "@/lib/ai-call.server";
import { MAX_SUGGESTIONS, isFresh, verifySuggestions, workKey, type OaWork } from "@/lib/opportunities";

const SYSTEM = `You suggest research gaps for a researcher. Use ONLY the given recent works.
Return JSON: {"suggestions": [{"title": string, "description": string (max 60 words), "evidence": [OpenAlex work ids from the list, at least 2]}]} (max ${MAX_SUGGESTIONS}).
Never invent work ids. No names, no invented facts.`;

const labels = (v: unknown) => (Array.isArray(v) ? v : []).map((x: any) => String(x?.label ?? "")).filter(Boolean);

/** Find (or return cached) research-gap suggestions for the signed-in user. */
export const findOpportunities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ force: z.boolean().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { openalexGet } = await import("@/lib/openalex.server");
    const uid = context.userId;
    const { data: cached } = await supabaseAdmin.from("opportunities").select("created_at").eq("user_id", uid).maybeSingle();
    if (!data.force && isFresh(cached?.created_at)) return { status: "cached" as const };

    const { data: a } = await context.supabase.from("profile_analysis").select("status, interests, methods, directions").eq("user_id", uid).maybeSingle();
    if (a?.status !== "done") return { status: "error" as const, reason: "Run your profile analysis first." };
    const terms = [...labels(a.directions), ...labels(a.interests)].slice(0, 4);
    const methods = labels(a.methods).slice(0, 3);
    if (!terms.length) return { status: "error" as const, reason: "Your analysis has no interests yet." };

    const since = new Date().getFullYear() - 3;
    const search = encodeURIComponent(terms.join(" "));
    let works: OaWork[] = [];
    try {
      const res: any = await openalexGet(`/works?search=${search}&filter=publication_year:>${since - 1}&per_page=25&select=id,display_name,doi,publication_year`);
      works = (res?.results ?? []).map((w: any) => ({ id: workKey(w.id), title: String(w.display_name ?? ""), url: w.doi || w.id })).filter((w: OaWork) => w.id && w.title);
    } catch (e) { console.error("OpenAlex works", e); return { status: "error" as const, reason: "OpenAlex is not answering. Try again later." }; }
    if (works.length < 2) return { status: "error" as const, reason: "Not enough recent related work found." };

    const ai = await aiChat([
      { role: "system", content: SYSTEM },
      { role: "user", content: JSON.stringify({ interests: terms, methods, works: works.map((w) => ({ id: w.id, title: w.title })) }) },
    ], { json: true });
    const j = parseJson(ai.text);
    if (!j) return { status: "error" as const, reason: ai.status === 429 ? "The AI services are busy or over their limit. Try again later." : "The AI could not answer right now." };
    const { kept, dropped } = verifySuggestions(j.suggestions, works);

    // Novelty comes from an OpenAlex count, never from the AI.
    for (const s of kept) {
      try {
        const r: any = await openalexGet(`/works?search=${encodeURIComponent(s.title)}&per_page=1&select=id`);
        s.novelty = Number(r?.meta?.count ?? 0);
      } catch { s.novelty = null; }
    }
    await supabaseAdmin.from("opportunities").upsert({ user_id: uid, suggestions: kept as any, dropped_claims: dropped as any, created_at: new Date().toISOString() });
    return { status: "done" as const };
  });

/** Thumbs up/down; clicking the same value again removes it. */
export const setFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ targetType: z.enum(["match", "opportunity"]), targetId: z.string().min(1).max(200), value: z.union([z.literal(1), z.literal(-1)]) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: cur } = await sb.from("feedback").select("value").eq("user_id", context.userId).eq("target_type", data.targetType).eq("target_id", data.targetId).maybeSingle();
    if (cur?.value === data.value) {
      await sb.from("feedback").delete().eq("user_id", context.userId).eq("target_type", data.targetType).eq("target_id", data.targetId);
      return { value: 0 };
    }
    const { error } = await sb.from("feedback").upsert({ user_id: context.userId, target_type: data.targetType, target_id: data.targetId, value: data.value }, { onConflict: "user_id,target_type,target_id" });
    if (error) throw new Error("Could not save");
    return { value: data.value };
  });
