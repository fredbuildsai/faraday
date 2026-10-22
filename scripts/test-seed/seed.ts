// Create test researchers with publications and an AI analysis. Run: bun scripts/test-seed/seed.ts
import { supabaseAdmin } from "../../src/integrations/supabase/client.server";
import { openalexGet } from "../../src/lib/openalex.server";
import { computeActivity, computeTopicWeights, shortId, type WorkTopic } from "../../src/lib/openalex-math";
import { aiChat, parseJson } from "../../src/lib/ai-call.server";
import { CHUNK_SIZE, LIMITS, chunk, clipWords, inputFingerprint, verifyClaims } from "../../src/lib/analysis";
import { MAX_WORKS, PEOPLE, SEED_TAG } from "./people";

const SYSTEM = `You analyse a researcher's published work. Use ONLY the given titles, keywords, topics and their own interests text.
Return JSON: {"summary": string (max 80 words), "interests": [{"label": string, "evidence": [2 exact titles]}] (max 10),
"methods": [{"label": string, "evidence": [2 exact titles]}] (max 8, concrete methods/techniques),
"directions": [{"label": string, "evidence": [2 exact titles]}] (max 5, themes new in the last 3 years)}.
Evidence must be copied character-for-character from the given titles. No names, no institutions, no invented facts.`;

const only = process.argv.slice(2).map((s) => s.toLowerCase());
const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });

for (const p of PEOPLE.filter((x) => !only.length || only.includes(x.last.toLowerCase()))) {
  let user = list?.users.find((u) => u.email === p.email);
  if (!user) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: p.email, email_confirm: true, password: crypto.randomUUID() + "Aa1!",
      user_metadata: { first_name: p.first, last_name: p.last, institution: p.inst, seed: SEED_TAG },
    });
    if (error) throw error;
    user = data.user!;
  }
  const uid = user.id;
  await supabaseAdmin.from("profiles").upsert({ id: uid, first_name: p.first, last_name: p.last, institution: p.inst });

  const rows: any[] = [];
  for (const aid of p.ids) {
    const page: any = await openalexGet(`/works?filter=author.id:${aid}&sort=publication_year:desc&per_page=${MAX_WORKS}&select=id,doi,title,publication_year,type,cited_by_count,topics,keywords,primary_location,authorships`);
    for (const w of page.results ?? []) {
      if (!w.title || rows.some((r) => r.openalex_id === shortId(w.id))) continue;
      rows.push({
        user_id: uid, openalex_id: shortId(w.id), doi: w.doi ?? null, title: w.title, year: w.publication_year ?? null,
        type: w.type ?? null, cited_by_count: w.cited_by_count ?? 0,
        topics: (w.topics ?? []).map((t: any) => ({ id: shortId(t.id), name: t.display_name, score: t.score ?? 0 })),
        keywords: (w.keywords ?? []).map((k: any) => k.display_name), venue: w.primary_location?.source?.display_name ?? null,
        authors: (w.authorships ?? []).filter((a: any) => a?.author?.id).slice(0, 100).map((a: any) => ({ id: shortId(a.author.id), name: a.author.display_name ?? "" })),
      });
    }
  }
  const { error: wErr } = await supabaseAdmin.from("works").upsert(rows, { onConflict: "user_id,openalex_id" });
  if (wErr) throw wErr;
  const wl = rows.map((r) => ({ year: r.year, topics: r.topics as WorkTopic[] }));
  await supabaseAdmin.from("profiles").update({
    openalex_author_id: p.ids[0], openalex_author_ids: p.ids, topic_weights: computeTopicWeights(wl),
    activity: computeActivity(wl, new Date().getUTCFullYear()), last_imported_at: new Date().toISOString(),
  }).eq("id", uid);
  console.log(p.last, "works", rows.length);

  // Small payloads so free-tier AI limits (e.g. 8k tokens/minute) are not exceeded.
  const works = rows.slice(0, 80).map((w) => ({ title: w.title, year: w.year, keywords: w.keywords.slice(0, 2), topics: w.topics.map((t: any) => t.name).slice(0, 1) }));
  const call = async (payload: unknown) => {
    for (let t = 0; t < 2; t++) {
      const r = await aiChat([{ role: "system", content: SYSTEM }, { role: "user", content: JSON.stringify(payload) }], { json: true });
      const j = parseJson(r.text);
      if (j && typeof j === "object") return j;
      console.log(p.last, "AI attempt failed, status", r.status);
    }
    return null;
  };
  const partials: any[] = [];
  for (const part of chunk(works, Math.min(CHUNK_SIZE, 40))) { await new Promise((r) => setTimeout(r, 15000)); const j = await call({ interests_text: "", works: part }); if (j) partials.push(j); }
  const result = partials.length > 1 ? await call({ task: "Merge these partial analyses into one, keeping evidence titles exact.", interests_text: "", partials }) : partials[0];
  if (!result) { console.log(p.last, "ANALYSIS FAILED"); continue; }
  const titles = works.map((w) => w.title);
  const i = verifyClaims(result.interests, titles, LIMITS.interests);
  const m = verifyClaims(result.methods, titles, LIMITS.methods);
  const d = verifyClaims(result.directions, titles, LIMITS.directions);
  await supabaseAdmin.from("profile_analysis").upsert({
    user_id: uid, status: "done", input_hash: inputFingerprint(works, ""), summary: clipWords(String(result.summary ?? "")),
    interests: i.kept as any, methods: m.kept as any, directions: d.kept as any,
    dropped_claims: { interests: i.dropped, methods: m.dropped, directions: d.dropped } as any,
    finished_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
  console.log(p.last, "methods", m.kept.map((c: any) => c.label));
}
