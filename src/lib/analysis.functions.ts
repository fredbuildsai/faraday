import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiChat, parseJson } from "@/lib/ai-call.server";
import { CHUNK_SIZE, DAILY_RUNS, LIMITS, chunk, clipWords, inputFingerprint, verifyClaims, type AnalysisWork } from "@/lib/analysis";

const SYSTEM = `You analyse a researcher's published work. Use ONLY the given titles, keywords, topics and their own interests text.
Return JSON: {"summary": string (max 80 words), "interests": [{"label": string, "evidence": [2 exact titles]}] (max 10),
"methods": [{"label": string, "evidence": [2 exact titles]}] (max 8, concrete methods/techniques),
"directions": [{"label": string, "evidence": [2 exact titles]}] (max 5, themes new in the last 3 years)}.
Evidence must be copied character-for-character from the given titles. No names, no institutions, no invented facts.`;

/** Run (or skip) the profile analysis for the signed-in user. */
export const runAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ force: z.boolean().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = context.userId;
    const [{ data: profile }, { data: rows }, { data: current }] = await Promise.all([
      context.supabase.from("profiles").select("research_interests").eq("id", uid).maybeSingle(),
      context.supabase.from("works").select("title, year, keywords, topics").eq("user_id", uid)
        .order("year", { ascending: false, nullsFirst: false }).limit(2000),
      supabaseAdmin.from("profile_analysis").select("status, input_hash, updated_at").eq("user_id", uid).maybeSingle(),
    ]);
    if (!rows?.length) return { status: "skipped" as const, reason: "No publications yet" };
    const works: AnalysisWork[] = rows.map((w) => ({
      title: w.title, year: w.year,
      keywords: ((w.keywords as any[]) ?? []).map((k) => k?.display_name ?? k?.name ?? String(k)).slice(0, 5),
      topics: ((w.topics as any[]) ?? []).map((t) => t?.name).filter(Boolean).slice(0, 3),
    }));
    const interestsText = profile?.research_interests ?? "";
    const hash = inputFingerprint(works, interestsText);
    if (current?.status === "running" && Date.now() - new Date(current.updated_at).getTime() < 5 * 60_000)
      return { status: "running" as const };
    if (!data.force && current?.status === "done" && current.input_hash === hash) return { status: "skipped" as const, reason: "Nothing changed" };

    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { count } = await supabaseAdmin.from("analysis_runs").select("id", { count: "exact", head: true }).eq("user_id", uid).gte("created_at", since);
    if ((count ?? 0) >= DAILY_RUNS) return { status: "limited" as const, reason: `You can run the analysis ${DAILY_RUNS} times a day. Try again tomorrow.` };

    await supabaseAdmin.from("analysis_runs").insert({ user_id: uid });
    await supabaseAdmin.from("profile_analysis").upsert({ user_id: uid, status: "running", error: null, updated_at: new Date().toISOString() });
    const fail = async (msg: string) => {
      await supabaseAdmin.from("profile_analysis").update({ status: "failed", error: msg, updated_at: new Date().toISOString() }).eq("user_id", uid);
      return { status: "failed" as const, reason: msg };
    };

    const call = async (payload: unknown) => {
      for (let t = 0; t < 2; t++) {
        const r = await aiChat([{ role: "system", content: SYSTEM }, { role: "user", content: JSON.stringify(payload) }], { json: true });
        const j = parseJson(r.text);
        if (j && typeof j === "object") return j;
      }
      return null;
    };

    const parts = chunk(works, CHUNK_SIZE);
    const partials: any[] = [];
    for (const p of parts) {
      const j = await call({ interests_text: interestsText, works: p });
      if (!j) return fail("The AI could not analyse your publications right now.");
      partials.push(j);
    }
    let result = partials[0];
    if (partials.length > 1) {
      result = await call({ task: "Merge these partial analyses into one, keeping evidence titles exact.", interests_text: interestsText, partials });
      if (!result) return fail("The AI could not combine the analysis right now.");
    }

    const titles = works.map((w) => w.title);
    const i = verifyClaims(result.interests, titles, LIMITS.interests);
    const m = verifyClaims(result.methods, titles, LIMITS.methods);
    const d = verifyClaims(result.directions, titles, LIMITS.directions);
    await supabaseAdmin.from("profile_analysis").update({
      status: "done", error: null, input_hash: hash,
      summary: clipWords(String(result.summary ?? "")),
      interests: i.kept as any, methods: m.kept as any, directions: d.kept as any,
      dropped_claims: { interests: i.dropped, methods: m.dropped, directions: d.dropped } as any,
      finished_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("user_id", uid);
    return { status: "done" as const };
  });

const editSchema = z.object({ kind: z.enum(["interest", "method"]), value: z.string().trim().min(1).max(120), action: z.enum(["add", "remove"]) });

/** Remember a user's add/remove so it survives re-analysis. */
export const saveAnalysisEdit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => editSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    // Removing something the user added just deletes their addition.
    const { data: existing } = await sb.from("profile_analysis_edits").select("id, action").eq("user_id", context.userId).eq("kind", data.kind).ilike("value", data.value);
    if (existing?.length) await sb.from("profile_analysis_edits").delete().in("id", existing.map((e) => e.id));
    if (!(data.action === "remove" && existing?.some((e) => e.action === "add"))) {
      const { error } = await sb.from("profile_analysis_edits").insert({ user_id: context.userId, ...data });
      if (error) throw new Error("Could not save");
    }
    return { ok: true };
  });
