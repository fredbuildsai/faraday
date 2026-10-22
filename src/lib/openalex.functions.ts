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
  .inputValidator((d: unknown) =>
    z.object({ authorIds: z.array(z.string().regex(/^A\d+$/)).min(1).max(10).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { importWorksFor } = await import("@/lib/import-core.server");
    return importWorksFor(context.userId, data.authorIds);
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
