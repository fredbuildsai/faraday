import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiChat, parseJson } from "@/lib/ai-call.server";
import {
  MAX_SUGGESTIONS, assessWhitespace, isFresh, principalInvestigators, sameSettings, searchTerms, verifySuggestions, workKey,
  type OaWork, type OppSettings,
} from "@/lib/opportunities";

const SYSTEM = `You suggest research gaps for a researcher. Use ONLY the given works.
Return JSON: {"suggestions": [{"title": string (phrased as a specific research question or topic), "description": string (max 60 words), "evidence": [work ids from the list, at least 2]}]} (max ${MAX_SUGGESTIONS}).
Never invent work ids. No names, no invented facts.`;
const NETWORK_HINT = " The works come from the researcher and selected collaborators; prefer gaps that combine works from different owners.";

const labels = (v: unknown) => (Array.isArray(v) ? v : []).map((x: any) => String(x?.label ?? "")).filter(Boolean);

const Input = z.object({
  force: z.boolean().optional(),
  mode: z.enum(["network", "broad"]).default("broad"),
  excludeReviews: z.boolean().default(false),
  mutualOnly: z.boolean().default(false),
  matchIds: z.array(z.string().uuid()).max(20).default([]),
});

/** Find (or return cached) research-gap suggestions for the signed-in user. */
export const findOpportunities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { openalexGet } = await import("@/lib/openalex.server");
    const uid = context.userId;

    // Only matches the caller really has (and, if asked, with mutual interest).
    let matchIds: string[] = [];
    const names = new Map<string, string>();
    if (data.mode === "network") {
      const { data: mine } = await context.supabase.rpc("my_matches");
      const allowed = (mine ?? []).filter((m: any) => !data.mutualOnly || (m.i_am_interested && m.they_are_interested));
      for (const m of allowed as any[]) names.set(m.other_id, m.other_name);
      matchIds = data.matchIds.filter((id) => names.has(id));
      if (!matchIds.length) return { status: "error" as const, reason: "Choose at least one match to include." };
    }
    const settings: OppSettings = { mode: data.mode, excludeReviews: data.excludeReviews, mutualOnly: data.mutualOnly, matchIds };

    const { data: cached } = await supabaseAdmin.from("opportunities").select("created_at, settings").eq("user_id", uid).maybeSingle();
    if (!data.force && isFresh(cached?.created_at) && sameSettings(cached?.settings as any, settings)) return { status: "cached" as const };

    const { data: a } = await context.supabase.from("profile_analysis").select("status, interests, methods, directions").eq("user_id", uid).maybeSingle();
    if (a?.status !== "done") return { status: "error" as const, reason: "Run your profile analysis first." };
    const terms = [...labels(a.directions), ...labels(a.interests)].slice(0, 4);
    const methods = labels(a.methods).slice(0, 3);
    if (!terms.length) return { status: "error" as const, reason: "Your analysis has no interests yet." };

    const since = new Date().getFullYear() - 3;
    let works: OaWork[] = [];
    try {
      if (data.mode === "broad") {
        const search = encodeURIComponent(terms.join(" "));
        const filter = `publication_year:>${since - 1}${data.excludeReviews ? ",type:!review" : ""}`;
        const res: any = await openalexGet(`/works?search=${search}&filter=${filter}&per_page=25&select=id,display_name,doi,publication_year`);
        works = (res?.results ?? []).map((w: any) => ({ id: workKey(w.id), title: String(w.display_name ?? ""), url: w.doi || w.id })).filter((w: OaWork) => w.id && w.title);
      } else {
        names.set(uid, "you");
        for (const owner of [uid, ...matchIds]) {
          let q = supabaseAdmin.from("works").select("openalex_id, title, doi, type").eq("user_id", owner).order("year", { ascending: false }).limit(30);
          if (data.excludeReviews) q = q.neq("type", "review");
          const { data: rows } = await q;
          for (const r of rows ?? []) {
            const id = workKey(r.openalex_id);
            if (id && r.title && !works.some((w) => w.id === id)) works.push({ id, title: r.title, url: r.doi ? `https://doi.org/${r.doi.replace(/^https?:\/\/doi.org\//, "")}` : `https://openalex.org/${id}`, owner });
          }
        }
      }
    } catch (e) { console.error("works", e); return { status: "error" as const, reason: "OpenAlex is not answering. Try again later." }; }
    if (works.length < 2) return { status: "error" as const, reason: "Not enough published work found." };

    const ai = await aiChat([
      { role: "system", content: SYSTEM + (data.mode === "network" ? NETWORK_HINT : "") },
      { role: "user", content: JSON.stringify({ interests: terms, methods, works: works.map((w) => ({ id: w.id, title: w.title, owner: w.owner ? (w.owner === uid ? "self" : "collaborator") : undefined })) }) },
    ], { json: true });
    const j = parseJson(ai.text);
    if (!j) return { status: "error" as const, reason: ai.status === 429 ? "The AI services are busy or over their limit. Try again later." : "The AI could not answer right now." };
    const { kept, dropped } = verifySuggestions(j.suggestions, works);

    for (const s of kept) {
      // Likely PIs: last and corresponding authors of the evidence papers (from OpenAlex, never AI).
      try {
        const ids = s.evidence.map((w) => w.id).join("|");
        const r: any = await openalexGet(`/works?filter=openalex_id:${ids}&per_page=10&select=id,authorships`);
        s.pis = principalInvestigators(r?.results ?? []);
      } catch { s.pis = []; }
      if (data.mode === "network") {
        const owners = [...new Set(s.evidence.map((w) => w.owner).filter((o): o is string => !!o && o !== uid))];
        s.collaborators = owners.map((id) => ({ id, name: names.get(id) ?? "Match" }));
      }
      // Whitespace: counts and closest existing papers for the proposed question.
      const terms = searchTerms(s.title);
      const q = encodeURIComponent(terms);
      const rv = data.excludeReviews ? ",type:!review" : "";
      let totalCount: number | null = null, recentCount: number | null = null, closest: OaWork[] = [];
      try {
        const all: any = await openalexGet(`/works?search=${q}&per_page=5&select=id,display_name,doi${rv ? `&filter=${rv.slice(1)}` : ""}`);
        totalCount = Number(all?.meta?.count ?? 0);
        closest = (all?.results ?? []).map((w: any) => ({ id: workKey(w.id), title: String(w.display_name ?? ""), url: w.doi || w.id })).filter((w: OaWork) => w.title);
        const recent: any = await openalexGet(`/works?search=${q}&filter=publication_year:>${since - 1}${rv}&per_page=1&select=id`);
        recentCount = Number(recent?.meta?.count ?? 0);
      } catch { /* leave unknown */ }
      s.novelty = totalCount;
      s.whitespace = assessWhitespace({ query: s.title, sinceYear: since, totalCount, recentCount, closest });
    }
    await supabaseAdmin.from("opportunities").upsert({ user_id: uid, suggestions: kept as any, dropped_claims: dropped as any, settings: settings as any, created_at: new Date().toISOString() });
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
