// Fetches outside-the-platform candidates from OpenAlex and stores them as suggestions.
import type { Profile } from "@/lib/matching";
import type { MatchWeights } from "@/lib/match-score";
import { MAX_LOOKUPS, collectCandidates, rankExternal, topCoauthors, topicalPages } from "@/lib/discovery-external";
import { threeYearsAgo } from "@/lib/opportunities";

export async function findExternalFor(opts: {
  uid: string; me: Profile; myAuthorIds: string[]; myWorks: { authors: { id: string; name: string }[] }[];
  memberAuthorIds: string[]; weights: Partial<MatchWeights>; needed: number; piOnly?: boolean;
}): Promise<number> {
  if (opts.needed <= 0) return 0;
  const { openalexGet } = await import("@/lib/openalex.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = threeYearsAgo(new Date());

  const { data: seen } = await supabaseAdmin.from("external_suggestions").select("openalex_id").eq("user_id", opts.uid);
  const exclude = new Set<string>([...opts.myAuthorIds, ...opts.memberAuthorIds, ...(seen ?? []).map((s) => s.openalex_id)]);
  for (const w of opts.myWorks) for (const a of w.authors ?? []) if (a?.id) exclude.add(a.id); // direct co-authors

  const safe = async (path: string) => { try { return (await openalexGet(path)).results ?? []; } catch (e) { console.error("openalex", path, e); return []; } };
  const seenCount = (seen ?? []).length;
  const bridges = topCoauthors(opts.myWorks, opts.myAuthorIds);
  // All your topics (OpenAlex caps OR filters), rotated through pages as you see more people.
  const topics = Object.entries(opts.me.topics).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k]) => k);
  const pages = topicalPages(seenCount);
  const [bridged, topicalPagesRes] = await Promise.all([
    Promise.all(bridges.map(async (b) => ({ via: b.name, works: await safe(`/works?filter=author.id:${b.id},from_publication_date:${since}&per_page=100&select=authorships`) }))),
    topics.length
      ? Promise.all(pages.map((p) => safe(`/works?filter=topics.id:${topics.join("|")},from_publication_date:${since}&sort=cited_by_count:desc&per_page=100&page=${p}&select=authorships`)))
      : Promise.resolve([] as any[][]),
  ]);
  const topical = topicalPagesRes.flat();

  const raws = collectCandidates(bridged, topical, exclude, opts.piOnly ?? true);
  // Keep room for both kinds of suggestion.
  const second = raws.filter((r) => r.layer === "second_degree").slice(0, Math.ceil(MAX_LOOKUPS * 0.6));
  const pool = [...second, ...raws.filter((r) => r.layer === "interest")].slice(0, MAX_LOOKUPS);
  if (!pool.length) return 0;

  const authors = new Map<string, any>();
  const res = await safe(`/authors?filter=openalex:${pool.map((r) => r.id).join("|")}&per_page=${MAX_LOOKUPS}&select=id,display_name,last_known_institutions,summary_stats,cited_by_count,works_count,topics,counts_by_year`);
  for (const a of res) authors.set(String(a.id).split("/").pop()!, a);

  const picks = rankExternal(opts.me, pool, authors, opts.weights, opts.needed, new Date().getUTCFullYear());
  if (!picks.length) return 0;
  const { error } = await supabaseAdmin.from("external_suggestions")
    .upsert(picks.map((p) => ({ ...p, user_id: opts.uid })), { onConflict: "user_id,openalex_id", ignoreDuplicates: true });
  if (error) { console.error("save external", error); return 0; }
  return picks.length;
}
