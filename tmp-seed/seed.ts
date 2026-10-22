import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { openalexGet } from "@/lib/openalex.server";
import { computeActivity, computeTopicWeights, shortId, type WorkTopic } from "@/lib/openalex-math";
import { aiChat, parseJson } from "@/lib/ai-call.server";
import { CHUNK_SIZE, LIMITS, chunk, clipWords, inputFingerprint, verifyClaims } from "@/lib/analysis";

const SYSTEM = `You analyse a researcher's published work. Use ONLY the given titles, keywords, topics and their own interests text.
Return JSON: {"summary": string (max 80 words), "interests": [{"label": string, "evidence": [2 exact titles]}] (max 10),
"methods": [{"label": string, "evidence": [2 exact titles]}] (max 8, concrete methods/techniques),
"directions": [{"label": string, "evidence": [2 exact titles]}] (max 5, themes new in the last 3 years)}.
Evidence must be copied character-for-character from the given titles. No names, no institutions, no invented facts.`;

const PEOPLE = [
  { email: "johan.foster@ubc.ca", first: "Johan", last: "Foster", inst: "University of British Columbia",
    ids: ["A5059588273", "A5159112419", "A5030450974", "A5140167166", "A5138740368"] },
  { email: "raphaell@uni-bremen.de", first: "Raphaell", last: "Moreira", inst: "University of Bremen",
    ids: ["A5033675494"] },
];

for (const p of PEOPLE) {
  let { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  let user = list?.users.find((u) => u.email === p.email);
  if (!user) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: p.email, email_confirm: true, password: crypto.randomUUID() + "Aa1!",
      user_metadata: { first_name: p.first, last_name: p.last, institution: p.inst },
    });
    if (error) throw error;
    user = data.user!;
  }
  const uid = user.id;
  await supabaseAdmin.from("profiles").upsert({ id: uid, first_name: p.first, last_name: p.last, institution: p.inst });

  const byId = new Map<string, any>();
  for (const aid of p.ids) {
    let cursor: string | null = "*";
    while (cursor) {
      const page: any = await openalexGet(`/works?filter=author.id:${aid}&per_page=200&cursor=${encodeURIComponent(cursor)}&select=id,doi,title,publication_year,type,cited_by_count,topics,keywords,primary_location`);
      for (const w of page.results ?? []) {
        if (!w.title || byId.has(shortId(w.id))) continue;
        byId.set(shortId(w.id), {
          user_id: uid, openalex_id: shortId(w.id), doi: w.doi ?? null, title: w.title, year: w.publication_year ?? null,
          type: w.type ?? null, cited_by_count: w.cited_by_count ?? 0,
          topics: (w.topics ?? []).map((t: any) => ({ id: shortId(t.id), name: t.display_name, score: t.score ?? 0 })),
          keywords: (w.keywords ?? []).map((k: any) => k.display_name), venue: w.primary_location?.source?.display_name ?? null,
        });
      }
      if (!page.results?.length) break;
      cursor = page.meta?.next_cursor ?? null;
    }
  }
  const rows = [...byId.values()];
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabaseAdmin.from("works").upsert(rows.slice(i, i + 500), { onConflict: "user_id,openalex_id" });
    if (error) throw error;
  }
  const wl = rows.map((r) => ({ year: r.year, topics: r.topics as WorkTopic[] }));
  await supabaseAdmin.from("profiles").update({
    openalex_author_id: p.ids[0], openalex_author_ids: p.ids, topic_weights: computeTopicWeights(wl),
    activity: computeActivity(wl, new Date().getUTCFullYear()), last_imported_at: new Date().toISOString(),
  }).eq("id", uid);
  console.log(p.first, "works", rows.length);

  const works = rows.sort((a, b) => (b.year ?? 0) - (a.year ?? 0)).map((w) => ({
    title: w.title, year: w.year, keywords: w.keywords.slice(0, 5), topics: w.topics.map((t: any) => t.name).slice(0, 3),
  }));
  const call = async (payload: unknown) => {
    for (let t = 0; t < 2; t++) {
      const r = await aiChat([{ role: "system", content: SYSTEM }, { role: "user", content: JSON.stringify(payload) }], { json: true });
      const j = parseJson(r.text);
      if (j && typeof j === "object") return j;
    }
    return null;
  };
  const partials: any[] = [];
  for (const part of chunk(works, CHUNK_SIZE)) partials.push(await call({ interests_text: "", works: part }));
  let result = partials.length > 1 ? await call({ task: "Merge these partial analyses into one, keeping evidence titles exact.", interests_text: "", partials }) : partials[0];
  if (!result) throw new Error("AI failed for " + p.first);
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
  console.log(p.first, "methods", m.kept.map((c: any) => c.label));
}
