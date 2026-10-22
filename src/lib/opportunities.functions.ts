import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiChat, parseJson } from "@/lib/ai-call.server";
import { eligibleOpportunityPeople } from "@/lib/opportunity-people";
import { potentialCollaborators, secondDegree } from "@/lib/opportunity-network";
import { DEFAULT_OPPORTUNITY_CONFIG } from "@/lib/opportunity-config";
import {
  MAX_SUGGESTIONS, assessWhitespace, isFresh, principalInvestigators, sameSettings, searchTerms, threeYearsAgo, byFewestRecent, verifySuggestions, workKey,
  type OaWork, type OppSettings,
} from "@/lib/opportunities";

const SYSTEM = `You suggest research gaps for a researcher. Use ONLY the given works.
Return JSON: {"suggestions": [{"title": string (phrased as a specific research question or topic), "description": string (max 60 words), "evidence": [work ids from the list, at least 2]}]} (max ${MAX_SUGGESTIONS}).
Never invent work ids. No names, no invented facts.`;
const NETWORK_HINT = " The works come from the researcher and selected collaborators; prefer gaps that combine works from different owners.";

const SOLO_HINT = " The works are all the researcher's own; suggest natural extensions and unexplored gaps within this body of work.";

const labels = (v: unknown) => (Array.isArray(v) ? v : []).map((x: any) => String(x?.label ?? "")).filter(Boolean);

const Input = z.object({
  force: z.boolean().optional(),
  mode: z.enum(["network", "broad"]).default("broad"),
  excludeReviews: z.boolean().default(false),
  mutualOnly: z.boolean().default(false),
  matchIds: z.array(z.string().uuid()).max(20).default([]),
  collaboratorIds: z.array(z.string().regex(/^A\d+$/)).default([]),
});

export const getOpportunityPeople = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadOpportunityPeople } = await import("@/lib/opportunity-people.server");
    return loadOpportunityPeople(context.supabase, context.userId);
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
    let collaboratorIds: string[] = [];
    const names = new Map<string, string>();
    const direct = new Map<string, string>();
    if (data.mode === "network") {
      const { loadOpportunityPeople } = await import("@/lib/opportunity-people.server");
      const allowed = eligibleOpportunityPeople(await loadOpportunityPeople(context.supabase, uid), data.mutualOnly);
      for (const person of allowed) { names.set(person.id, person.name); if (person.collaborator && /^A\d+$/.test(person.id)) direct.set(person.id, person.name); }
      matchIds = data.matchIds.filter((id) => names.has(id));
      collaboratorIds = data.collaboratorIds.filter((id) => names.has(id));
    }
    const settings: OppSettings = { mode: data.mode, excludeReviews: data.excludeReviews, mutualOnly: data.mutualOnly, matchIds, collaboratorIds };

    const { data: cached } = await supabaseAdmin.from("opportunities").select("created_at, settings").eq("user_id", uid).maybeSingle();
    if (!data.force && isFresh(cached?.created_at) && sameSettings(cached?.settings as any, settings)) return { status: "cached" as const };

    const { data: a } = await context.supabase.from("profile_analysis").select("status, interests, methods, directions").eq("user_id", uid).maybeSingle();
    if (a?.status !== "done") return { status: "error" as const, reason: "Run your profile analysis first." };
    const terms = [...labels(a.directions), ...labels(a.interests)].slice(0, 4);
    const methods = labels(a.methods).slice(0, 3);
    if (!terms.length) return { status: "error" as const, reason: "Your analysis has no interests yet." };

    const { data: prof } = await context.supabase.from("profiles").select("research_settings").eq("id", uid).maybeSingle();
    const { resolveResearchSettings } = await import("@/lib/research-settings");
    const paperLimit = resolveResearchSettings(prof?.research_settings).paperLimit;
    const solo = data.mode === "network" && !matchIds.length && !collaboratorIds.length;

    const sinceDate = threeYearsAgo(new Date());

    // Own-work search: build the user's network (direct collaborators and their co-authors) once.
    let ownIds: string[] = [];
    let second = new Map<string, { name: string; via: Set<string> }>();
    if (solo) {
      const { data: me } = await context.supabase.from("profiles").select("openalex_author_id, openalex_author_ids").eq("id", uid).maybeSingle();
      ownIds = me?.openalex_author_ids?.length ? me.openalex_author_ids : me?.openalex_author_id ? [me.openalex_author_id] : [];
      const collaboratorPapers = await Promise.all([...direct.keys()].map(async (id) => {
        try {
          const r: any = await openalexGet(`/works?filter=author.id:${id},from_publication_date:${sinceDate}&per_page=50&select=authorships`);
          return { collaboratorId: id, papers: r?.results ?? [] };
        } catch { return { collaboratorId: id, papers: [] }; }
      }));
      second = secondDegree(direct, collaboratorPapers, ownIds);
    }
    const since = Number(sinceDate.slice(0, 4));
    let works: OaWork[] = [];
    try {
      if (data.mode === "broad") {
        const search = encodeURIComponent(terms.join(" "));
        const filter = `from_publication_date:${sinceDate}${data.excludeReviews ? ",type:!review" : ""}`;
        const res: any = await openalexGet(`/works?search=${search}&filter=${filter}&per_page=25&select=id,display_name,doi,publication_year,open_access`);
        works = (res?.results ?? []).map((w: any) => ({ id: workKey(w.id), title: String(w.display_name ?? ""), url: w.doi || w.id, isOa: !!w.open_access?.is_oa })).filter((w: OaWork) => w.id && w.title);
      } else {
        names.set(uid, "you");
        for (const owner of [uid, ...matchIds]) {
          let q = supabaseAdmin.from("works").select("openalex_id, title, doi, type, is_oa").eq("user_id", owner).order("year", { ascending: false }).limit(paperLimit);
          if (data.excludeReviews) q = q.neq("type", "review");
          const { data: rows } = await q;
          for (const r of rows ?? []) {
            const id = workKey(r.openalex_id);
            if (id && r.title && !works.some((w) => w.id === id)) works.push({ id, title: r.title, url: r.doi ? `https://doi.org/${r.doi.replace(/^https?:\/\/doi.org\//, "")}` : `https://openalex.org/${id}`, owner, isOa: !!r.is_oa });
          }
        }
        for (const owner of collaboratorIds) {
          const filter = `author.id:${owner}${data.excludeReviews ? ",type:!review" : ""}`;
          const res: any = await openalexGet(`/works?filter=${filter}&sort=publication_date:desc&per_page=${Math.min(paperLimit, 200)}&select=id,display_name,doi,open_access`);
          for (const paper of res?.results ?? []) {
            const id = workKey(paper.id);
            if (id && paper.display_name && !works.some((w) => w.id === id)) works.push({ id, title: paper.display_name, url: paper.doi || paper.id, owner, isOa: !!paper.open_access?.is_oa });
          }
        }
      }
    } catch (e) { console.error("works", e); return { status: "error" as const, reason: "OpenAlex is not answering. Try again later." }; }
    if (works.length < 2) return { status: "error" as const, reason: "Not enough published work found." };

    const ai = await aiChat([
      { role: "system", content: SYSTEM + (solo ? SOLO_HINT : data.mode === "network" ? NETWORK_HINT : "") },
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
        if (solo) {
          let topic: any[] = [];
          try {
            const t: any = await openalexGet(`/works?search=${encodeURIComponent(searchTerms(s.title))}&filter=from_publication_date:${sinceDate}&per_page=50&select=authorships`);
            topic = t?.results ?? [];
          } catch (e) { console.error("potential collaborators", e); }
          s.potential = potentialCollaborators({ evidence: r?.results ?? [], topic, direct, second, ownIds, limit: DEFAULT_OPPORTUNITY_CONFIG.potentialLimit });
        }
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
        const recent: any = await openalexGet(`/works?search=${q}&filter=from_publication_date:${sinceDate}${rv}&per_page=1&select=id`);
        recentCount = Number(recent?.meta?.count ?? 0);
      } catch (e) { console.error("whitespace count", terms, e); }
      s.novelty = totalCount;
      s.whitespace = assessWhitespace({ query: terms, sinceYear: since, sinceDate, totalCount, recentCount, closest });
    }
    await supabaseAdmin.from("opportunities").upsert({ user_id: uid, suggestions: byFewestRecent(kept) as any, dropped_claims: dropped as any, settings: settings as any, created_at: new Date().toISOString() });
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
