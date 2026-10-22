import type { Profile } from "@/lib/matching";
import { collaborationMatchesFor, type MatchWeights } from "@/lib/match-score";
import { BATCH_SIZE, coauthorsOf, pickDiscovery, type Author, type Candidate } from "@/lib/discovery";
import { tidyMethod } from "@/lib/method-synonyms";

const topicKey = (id: unknown) => String(id ?? "").split("/").pop() ?? "";

/** Read every works row in pages (the API returns at most 1000 rows per request). */
async function allRows(db: any, cols: string) {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("works").select(cols).order("id").range(from, from + 999);
    if (error) throw new Error("Could not read publications");
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return { data: out };
  }
}

/** Find up to 10 new researchers for one user (recorded for both people). */
export async function computeMatchesFor(uid: string) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Only this user's matches are read (indexed), not the whole table.
    const [{ data: profiles }, { data: analyses }, { data: edits }, { data: existing }, { data: allWorks }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, topic_weights, activity, match_weights, openalex_author_id, openalex_author_ids"),
      supabaseAdmin.from("profile_analysis").select("user_id, methods").eq("status", "done"),
      supabaseAdmin.from("profile_analysis_edits").select("user_id, value, action").eq("kind", "method"),
      supabaseAdmin.from("matches").select("id, user_a, user_b, created_at, formula").or(`user_a.eq.${uid},user_b.eq.${uid}`),
      allRows(supabaseAdmin, "user_id, topics, authors"),
    ]);

    const methodsBy = new Map<string, Set<string>>();
    for (const a of analyses ?? []) {
      const s = new Set<string>();
      for (const c of (a.methods as any[]) ?? []) if (c?.label) s.add(tidyMethod(c.label));
      methodsBy.set(a.user_id, s);
    }
    for (const e of edits ?? []) {
      const s = methodsBy.get(e.user_id) ?? new Set<string>();
      const m = tidyMethod(e.value);
      if (e.action === "add") s.add(m); else s.delete(m);
      methodsBy.set(e.user_id, s);
    }
    const toProfile = (p: any): Profile => ({
      id: p.id, topics: (p.topic_weights ?? {}) as Record<string, number>,
      methods: [...(methodsBy.get(p.id) ?? [])], activity: Number(p.activity ?? 0),
    });
    const worksBy = new Map<string, { authors: Author[] }[]>();
    for (const w of allWorks ?? []) {
      const l = worksBy.get(w.user_id) ?? []; l.push({ authors: (w.authors as Author[]) ?? [] }); worksBy.set(w.user_id, l);
    }
    const idsOf = (p: any): string[] => p.openalex_author_ids?.length ? p.openalex_author_ids : p.openalex_author_id ? [p.openalex_author_id] : [];
    const candidates: Candidate[] = (profiles ?? [])
      .filter((p: any) => Object.keys(p.topic_weights ?? {}).length)
      .map((p: any) => ({ profile: toProfile(p), authorIds: idsOf(p), coauthors: coauthorsOf(worksBy.get(p.id) ?? [], idsOf(p)) }));
    const meC = candidates.find((c) => c.profile.id === uid);
    if (!meC) return { added: 0, reason: "Import your publications first so we know your research topics." };

    const myWeights = ((profiles ?? []).find((p: any) => p.id === uid)?.match_weights ?? {}) as Partial<MatchWeights>;

    // Rescore this user's old-formula matches in place (keeps notes, interest, saved state).
    const legacy = (existing ?? []).filter((m) => m.formula !== "v2");
    let rescored = 0;
    if (legacy.length) {
      const scored = collaborationMatchesFor(meC.profile, candidates.map((c) => c.profile), myWeights);
      for (const old of legacy) {
        const n = scored.find((m) => m.a === old.user_a && m.b === old.user_b);
        if (!n) continue;
        await supabaseAdmin.from("matches").update({ score: n.score, t: n.T, m: n.M, act: n.act, a_only: n.aOnly, b_only: n.bOnly, shared_methods: n.sharedMethods, formula: n.formula }).eq("id", old.id);
        rescored++;
      }
    }

    // Anyone already matched (active, saved or dismissed) is never shown again.
    const matched = new Set((existing ?? []).map((m) => (m.user_a === uid ? m.user_b : m.user_a)));
    const chosen = pickDiscovery(meC, candidates, matched, myWeights);

    const names = new Map<string, string>();
    for (const w of allWorks ?? []) if (w.user_id === uid) for (const t of (w.topics as any[]) ?? []) if (t?.name) names.set(topicKey(t.id), t.name);
    const label = (k: string) => names.get(topicKey(k)) ?? k;

    if (chosen.length) {
      // The unique pair index makes a simultaneous run by the other person harmless.
      for (const m of chosen) {
        const { error } = await supabaseAdmin.from("matches").insert({
          user_a: m.a, user_b: m.b, score: m.score, t: m.T, m: m.M, act: m.act,
          shared_topics: m.sharedTopics.map(label), a_only: m.aOnly, b_only: m.bOnly, shared_methods: m.sharedMethods, formula: m.formula,
          layer: m.layer, via: m.via,
        });
        if (error && error.code !== "23505") { console.error("save matches", error); throw new Error("Could not save matches"); }
      }
    }
    // Fewer than a full batch from members: fill the rest from the wider OpenAlex network.
    let external = 0;
    try {
      const { findExternalFor } = await import("@/lib/discovery-external.server");
      external = await findExternalFor({
        uid, me: meC.profile, myAuthorIds: meC.authorIds, myWorks: worksBy.get(uid) ?? [],
        memberAuthorIds: candidates.flatMap((c) => c.authorIds), weights: myWeights, needed: BATCH_SIZE - chosen.length,
      });
    } catch (e) { console.error("external discovery", e); }
    const added = chosen.length + external;
    if (added) return { added, reason: null, members: chosen.length, external };
    if (rescored) return { added: 0, reason: `Updated ${rescored} existing match${rescored > 1 ? "es" : ""} to the new score. Dismissed ones are under Dismissed.` };
    return { added: 0, reason: "No new researchers fit you right now. Check back later.", members: 0, external: 0 };
  }
