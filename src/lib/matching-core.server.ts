import { WEEKLY_CAP, selectPairs, type Match, type Profile } from "@/lib/matching";
import { collaborationMatchesFor, type MatchWeights } from "@/lib/match-score";
import { tidyMethod } from "@/lib/method-synonyms";

const topicKey = (id: unknown) => String(id ?? "").split("/").pop() ?? "";

/** Find new matches for one user (recorded for both people). */
export async function computeMatchesFor(uid: string) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const [{ data: profiles }, { data: analyses }, { data: edits }, { data: existing }, { data: works }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, topic_weights, activity, match_weights"),
      supabaseAdmin.from("profile_analysis").select("user_id, methods").eq("status", "done"),
      supabaseAdmin.from("profile_analysis_edits").select("user_id, value, action").eq("kind", "method"),
      supabaseAdmin.from("matches").select("id, user_a, user_b, created_at, formula"),
      supabaseAdmin.from("works").select("topics").eq("user_id", uid).limit(2000),
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
    const all = (profiles ?? []).map(toProfile).filter((p) => Object.keys(p.topics).length);
    const me = all.find((p) => p.id === uid);
    if (!me) return { added: 0, reason: "Import your publications first so we know your research topics." };

    const current = (existing ?? []).filter((m) => m.formula === "v2");
    const legacy = (existing ?? []).filter((m) => m.formula !== "v2" && uid === m.user_a || m.formula !== "v2" && uid === m.user_b);
    const paired = new Set(current.map((m) => `${m.user_a}|${m.user_b}`));
    const weekAgo = Date.now() - 7 * 86400_000;
    const open: Record<string, number> = {};
    for (const m of current) if (new Date(m.created_at).getTime() >= weekAgo)
      for (const id of [m.user_a, m.user_b]) open[id] = (open[id] ?? 0) + 1;

    const myWeights = ((profiles ?? []).find((p: any) => p.id === uid)?.match_weights ?? {}) as Partial<MatchWeights>;
    const scored = collaborationMatchesFor(me, all, myWeights);
    // Rescore this user's old-formula matches in place (keeps notes, interest, saved state).
    let rescored = 0;
    for (const old of legacy) {
      const n = scored.find((m) => m.a === old.user_a && m.b === old.user_b);
      if (!n) continue;
      await supabaseAdmin.from("matches").update({ score: n.score, t: n.T, m: n.M, act: n.act, a_only: n.aOnly, b_only: n.bOnly, shared_methods: n.sharedMethods, formula: n.formula }).eq("id", old.id);
      paired.add(`${old.user_a}|${old.user_b}`); rescored++;
    }
    for (const old of legacy) paired.add(`${old.user_a}|${old.user_b}`);
    const candidates = scored.filter((m) => !paired.has(`${m.a}|${m.b}`));
    const chosen = selectPairs(candidates as unknown as Match[], open, WEEKLY_CAP) as unknown as typeof candidates;

    const names = new Map<string, string>();
    for (const w of works ?? []) for (const t of (w.topics as any[]) ?? []) if (t?.name) names.set(topicKey(t.id), t.name);
    const label = (k: string) => names.get(topicKey(k)) ?? k;

    if (chosen.length) {
      const { error } = await supabaseAdmin.from("matches").insert(chosen.map((m) => ({
        user_a: m.a, user_b: m.b, score: m.score, t: m.T, m: m.M, act: m.act,
        shared_topics: m.sharedTopics.map(label), a_only: m.aOnly, b_only: m.bOnly, shared_methods: m.sharedMethods, formula: m.formula,
      })));
      if (error) throw new Error("Could not save matches");
    }
    if (!chosen.length && (open[uid] ?? 0) >= WEEKLY_CAP) return { added: 0, reason: `You already have ${WEEKLY_CAP} new matches this week.` };
    if (!chosen.length && rescored) return { added: 0, reason: `Updated ${rescored} existing match${rescored > 1 ? "es" : ""} to the new score. Dismissed ones are under Dismissed.` };
    return { added: chosen.length, reason: chosen.length ? null : "No new researchers fit you right now. Check back later." };
  }
