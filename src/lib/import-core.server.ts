import { computeActivity, computeTopicWeights, shortId, type WorkTopic } from "@/lib/openalex-math";

const MAX_WORKS = 2000;

/** Re-import all works for one user from their chosen OpenAlex profiles. */
export async function importWorksFor(userId: string, requested?: string[]) {
    const { openalexGet } = await import("@/lib/openalex.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let authorIds = requested ? Array.from(new Set(requested)) : undefined;
    if (!authorIds) {
      const { data: p } = await supabaseAdmin.from("profiles").select("openalex_author_id, openalex_author_ids").eq("id", userId).single();
      authorIds = p?.openalex_author_ids?.length ? p.openalex_author_ids : p?.openalex_author_id ? [p.openalex_author_id] : [];
    }
    if (!authorIds.length) throw new Error("No author selected");

    const select = "id,doi,title,publication_year,type,cited_by_count,topics,keywords,primary_location,open_access";
    // Works shared by several selected profiles are kept once (keyed by OpenAlex work id).
    const byId = new Map<string, any>();
    let truncated = false;
    outer: for (const authorId of authorIds) {
      let cursor: string | null = "*";
      while (cursor) {
        const page: any = await openalexGet(
          `/works?filter=author.id:${authorId}&per_page=200&cursor=${encodeURIComponent(cursor)}&select=${select}`,
        );
        for (const w of page.results ?? []) {
          if (!w.title) continue;
          const oid = shortId(w.id);
          if (byId.has(oid)) continue;
          if (byId.size >= MAX_WORKS) {
            truncated = true;
            break outer;
          }
          const topics: WorkTopic[] = (w.topics ?? []).map((t: any) => ({ id: shortId(t.id), name: t.display_name, score: t.score ?? 0 }));
          byId.set(oid, {
            user_id: userId,
            openalex_id: oid,
            doi: w.doi ?? null,
            title: w.title,
            year: w.publication_year ?? null,
            type: w.type ?? null,
            cited_by_count: w.cited_by_count ?? 0,
            is_oa: !!w.open_access?.is_oa,
            topics,
            keywords: (w.keywords ?? []).map((k: any) => k.display_name),
            venue: w.primary_location?.source?.display_name ?? null,
          });
        }
        if (!page.results?.length) break;
        cursor = page.meta?.next_cursor ?? null;
      }
    }
    const rows = Array.from(byId.values());

    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabaseAdmin.from("works").upsert(rows.slice(i, i + 500), { onConflict: "user_id,openalex_id" });
      if (error) throw new Error("Could not save works");
    }

    const works = rows.map((r) => ({ year: r.year, topics: r.topics as WorkTopic[] }));
    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .update({
        openalex_author_id: authorIds[0]!,
        openalex_author_ids: authorIds,
        topic_weights: computeTopicWeights(works),
        activity: computeActivity(works, new Date().getUTCFullYear()),
        works_truncated: truncated,
        last_imported_at: new Date().toISOString(),
      })
      .eq("id", userId);
    if (upErr) throw new Error("Could not update profile");
    return { imported: rows.length, truncated, profiles: authorIds.length };
  }
