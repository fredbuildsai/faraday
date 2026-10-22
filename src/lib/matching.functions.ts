import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { tidyMethod } from "@/lib/method-synonyms";

const topicKey = (id: unknown) => String(id ?? "").split("/").pop() ?? "";

/** Find new matches for the signed-in user (and record them for both people). */
export const computeMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { computeMatchesFor } = await import("@/lib/matching-core.server");
    return computeMatchesFor(context.userId);
  });

/** Say "I'm interested" in a match (or take it back while the other person hasn't answered). */
export const setInterest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ matchId: z.string().uuid(), interested: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const q = context.supabase.from("interests");
    const { error } = data.interested
      ? await q.upsert({ match_id: data.matchId, user_id: context.userId }, { ignoreDuplicates: true })
      : await q.delete().eq("match_id", data.matchId).eq("user_id", context.userId);
    if (error) throw new Error("Could not update");
    return { ok: true };
  });

/** Save / dismiss / restore a match for the signed-in user. */
export const setMatchState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ matchId: z.string().uuid(), state: z.enum(["active", "saved", "dismissed"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("match_user_state")
      .upsert({ match_id: data.matchId, user_id: context.userId, state: data.state, updated_at: new Date().toISOString() }, { onConflict: "match_id,user_id" });
    if (error) throw new Error("Could not update");
    return { ok: true };
  });

/** Private notes on a match. */
export const saveMatchNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ matchId: z.string().uuid(), notes: z.string().max(5000) }).parse(d))
  .handler(async ({ data, context }) => {
    const now = new Date().toISOString();
    const { error } = await context.supabase.from("match_user_state")
      .upsert({ match_id: data.matchId, user_id: context.userId, notes: data.notes, notes_updated_at: now, updated_at: now }, { onConflict: "match_id,user_id" });
    if (error) throw new Error("Could not save");
    return { ok: true, at: now };
  });

/** AI collaboration summary (≤60 words) and up to 2 ideas, on request only. */
export const writeMatchIdeas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ matchId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: m } = await context.supabase.from("matches").select("user_a, user_b, shared_topics").eq("id", data.matchId).maybeSingle();
    if (!m) throw new Error("Match not found");
    const other = m.user_a === context.userId ? m.user_b : m.user_a;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { aiChat, parseJson } = await import("@/lib/ai-call.server");
    const { cleanIdeas } = await import("@/lib/match-ideas");
    const side = async (id: string) => {
      const [{ data: a }, { data: w }] = await Promise.all([
        supabaseAdmin.from("profile_analysis").select("summary, methods, interests").eq("user_id", id).maybeSingle(),
        supabaseAdmin.from("works").select("title").eq("user_id", id).order("year", { ascending: false, nullsFirst: false }).limit(15),
      ]);
      const labels = (x: any) => ((x as any[]) ?? []).map((c) => c?.label).filter(Boolean);
      return { summary: a?.summary ?? "", methods: labels(a?.methods), interests: labels(a?.interests), recent_titles: (w ?? []).map((r) => r.title) };
    };
    const [me, them] = await Promise.all([side(context.userId), side(other)]);
    const r = await aiChat([
      { role: "system", content: `Two researchers were matched because they work on shared research topics. Using ONLY the given data, return JSON {"summary": string (max 60 words, why they fit together), "ideas": [{"title": string, "description": string (max 40 words)}] (max 2 concrete joint projects on their shared topics)}. No names, no invented facts.` },
      { role: "user", content: JSON.stringify({ shared_topics: m.shared_topics, researcher_1: me, researcher_2: them }) },
    ], { json: true });
    const j = parseJson(r.text);
    if (!j) return { ok: false as const, reason: r.status === 429 ? "The AI is busy. Try again in a minute." : "The AI could not write ideas right now." };
    const { summary, ideas } = cleanIdeas(j);
    const now = new Date().toISOString();
    const { error } = await context.supabase.from("match_user_state")
      .upsert({ match_id: data.matchId, user_id: context.userId, summary, ideas: ideas as any, ideas_at: now, updated_at: now }, { onConflict: "match_id,user_id" });
    if (error) throw new Error("Could not save");
    return { ok: true as const };
  });
