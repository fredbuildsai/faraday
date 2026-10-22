import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  computeActivity,
  computeTopicWeights,
  confidentMatch,
  shortId,
  type AuthorCandidate,
  type WorkTopic,
} from "@/lib/openalex-math";

const MAX_WORKS = 2000;
const AUTHOR_SELECT = "id,display_name,orcid,works_count,last_known_institutions,topics";

function toCandidate(a: any): AuthorCandidate {
  return {
    id: shortId(a.id),
    name: a.display_name,
    institution: a.last_known_institutions?.[0]?.display_name ?? null,
    worksCount: a.works_count ?? 0,
    topTopics: (a.topics ?? []).slice(0, 3).map((t: any) => t.display_name),
    orcid: a.orcid ? String(a.orcid).replace("https://orcid.org/", "") : null,
  };
}

export type ResolveResult = {
  firstName: string;
  orcidNotFound: boolean;
  /** Pre-selected author (ORCID match or a single confident name match). */
  suggested: AuthorCandidate | null;
  viaOrcid: boolean;
  candidates: AuthorCandidate[];
};

export const resolveAuthor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ResolveResult> => {
    const { openalexGet, OpenAlexNotFound } = await import("@/lib/openalex.server");
    const { data: p, error } = await context.supabase
      .from("profiles")
      .select("first_name, last_name, institution, orcid")
      .eq("id", context.userId)
      .single();
    if (error) throw new Error("Profile not found");

    let orcidNotFound = false;
    if (p.orcid) {
      try {
        const a = await openalexGet(`/authors/orcid:${encodeURIComponent(p.orcid)}?select=${AUTHOR_SELECT}`);
        const c = toCandidate(a);
        return { firstName: p.first_name, orcidNotFound: false, suggested: c, viaOrcid: true, candidates: [c] };
      } catch (e) {
        if (!(e instanceof OpenAlexNotFound)) throw e;
        orcidNotFound = true;
      }
    }

    const fullName = `${p.first_name} ${p.last_name}`.trim();
    if (!fullName) return { firstName: p.first_name, orcidNotFound, suggested: null, viaOrcid: false, candidates: [] };
    const res = await openalexGet<{ results: any[] }>(
      `/authors?search=${encodeURIComponent(fullName)}&per_page=10&select=${AUTHOR_SELECT}`,
    );
    const candidates = res.results.map(toCandidate);
    // Without ORCID, never auto-pick; the confident match is only pre-selected.
    const suggested = confidentMatch(candidates, fullName, p.institution);
    return { firstName: p.first_name, orcidNotFound, suggested, viaOrcid: false, candidates };
  });

export const importWorks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ authorId: z.string().regex(/^A\d+$/).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { openalexGet } = await import("@/lib/openalex.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let authorId = data.authorId;
    if (!authorId) {
      const { data: p } = await context.supabase.from("profiles").select("openalex_author_id").eq("id", context.userId).single();
      authorId = p?.openalex_author_id ?? undefined;
    }
    if (!authorId) throw new Error("No author selected");

    const select = "id,doi,title,publication_year,type,cited_by_count,topics,keywords,primary_location";
    const rows: any[] = [];
    let cursor: string | null = "*";
    let truncated = false;
    while (cursor) {
      const page: any = await openalexGet(
        `/works?filter=author.id:${authorId}&per_page=200&cursor=${encodeURIComponent(cursor)}&select=${select}`,
      );
      for (const w of page.results ?? []) {
        if (!w.title) continue;
        if (rows.length >= MAX_WORKS) {
          truncated = true;
          break;
        }
        const topics: WorkTopic[] = (w.topics ?? []).map((t: any) => ({ id: shortId(t.id), name: t.display_name, score: t.score ?? 0 }));
        rows.push({
          user_id: context.userId,
          openalex_id: shortId(w.id),
          doi: w.doi ?? null,
          title: w.title,
          year: w.publication_year ?? null,
          type: w.type ?? null,
          cited_by_count: w.cited_by_count ?? 0,
          topics,
          keywords: (w.keywords ?? []).map((k: any) => k.display_name),
          venue: w.primary_location?.source?.display_name ?? null,
        });
      }
      if (truncated || !page.results?.length) break;
      cursor = page.meta?.next_cursor ?? null;
    }

    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabaseAdmin.from("works").upsert(rows.slice(i, i + 500), { onConflict: "user_id,openalex_id" });
      if (error) throw new Error("Could not save works");
    }

    const works = rows.map((r) => ({ year: r.year, topics: r.topics as WorkTopic[] }));
    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .update({
        openalex_author_id: authorId,
        topic_weights: computeTopicWeights(works),
        activity: computeActivity(works, new Date().getUTCFullYear()),
        works_truncated: truncated,
        last_imported_at: new Date().toISOString(),
      })
      .eq("id", context.userId);
    if (upErr) throw new Error("Could not update profile");
    return { imported: rows.length, truncated };
  });

export const saveResearchInterests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ text: z.string().max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("profiles").update({ research_interests: data.text }).eq("id", context.userId);
    if (error) throw new Error("Could not save");
    return { ok: true };
  });

export const updateProfileDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ institution: z.string().max(200), orcid: z.string().max(40) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ institution: data.institution || null, orcid: data.orcid || null })
      .eq("id", context.userId);
    if (error) throw new Error("Could not save");
    return { ok: true };
  });
