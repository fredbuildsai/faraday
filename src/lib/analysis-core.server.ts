import { aiChat, parseJson } from "@/lib/ai-call.server";
import { CHUNK_SIZE, DAILY_RUNS, LIMITS, chunk, clipWords, enoughChunks, inputFingerprint, mergeClaims, verifyClaims, type AnalysisWork, type Claim } from "@/lib/analysis";

const SYSTEM = `You analyse a researcher's published work. Use ONLY the given titles, keywords, topics and their own interests text.
Return JSON: {"summary": string (max 80 words), "interests": [{"label": string, "evidence": [2 exact titles]}] (max 10),
"methods": [{"label": string, "evidence": [2 exact titles]}] (max 8, concrete methods/techniques),
"directions": [{"label": string, "evidence": [2 exact titles]}] (max 5, themes new in the last 3 years)}.
Evidence must be copied character-for-character from the given titles. No names, no institutions, no invented facts.`;

/** Run (or skip) the profile analysis for one user. Shared by the button and the monthly refresh. */
export async function runAnalysisFor(uid: string, force = false) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const [{ data: profile }, { data: rows }, { data: current }] = await Promise.all([
      supabaseAdmin.from("profiles").select("research_interests").eq("id", uid).maybeSingle(),
      supabaseAdmin.from("works").select("title, year, keywords, topics").eq("user_id", uid)
        .order("year", { ascending: false, nullsFirst: false }).limit(2000),
      supabaseAdmin.from("profile_analysis").select("status, input_hash, updated_at").eq("user_id", uid).maybeSingle(),
    ]);
    if (!rows?.length) return { status: "skipped" as const, reason: "No publications yet" };
    const works: AnalysisWork[] = rows.map((w) => ({
      title: w.title, year: w.year,
      keywords: ((w.keywords as any[]) ?? []).map((k) => k?.display_name ?? k?.name ?? String(k)).slice(0, 5),
      topics: ((w.topics as any[]) ?? []).map((t) => t?.name).filter(Boolean).slice(0, 3),
    }));
    const interestsText = profile?.research_interests ?? "";
    const hash = inputFingerprint(works, interestsText);
    if (current?.status === "running" && Date.now() - new Date(current.updated_at).getTime() < 3 * 60_000)
      return { status: "running" as const };
    if (!force && current?.status === "done" && current.input_hash === hash) return { status: "skipped" as const, reason: "Nothing changed" };

    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { count } = await supabaseAdmin.from("analysis_runs").select("id", { count: "exact", head: true }).eq("user_id", uid).gte("created_at", since);
    if ((count ?? 0) >= DAILY_RUNS) return { status: "limited" as const, reason: `You can run the analysis ${DAILY_RUNS} times a day. Try again tomorrow.` };

    await supabaseAdmin.from("analysis_runs").insert({ user_id: uid });
    await supabaseAdmin.from("profile_analysis").upsert({ user_id: uid, status: "running", error: null, updated_at: new Date().toISOString() });
    let aiStatus = 0;
    const fail = async (msg: string) => {
      await supabaseAdmin.from("profile_analysis").update({ status: "failed", error: msg, updated_at: new Date().toISOString() }).eq("user_id", uid);
      return { status: "failed" as const, reason: msg, aiStatus };
    };

    const call = async (payload: unknown) => {
      for (let t = 0; t < 2; t++) {
        const r = await aiChat([{ role: "system", content: SYSTEM }, { role: "user", content: JSON.stringify(payload) }], { json: true });
        aiStatus = r.status;
        const j = parseJson(r.text);
        if (j && typeof j === "object") return j;
        if (r.status === 402 || r.status === 403) break;
      }
      return null;
    };

    // 1) Analyse each batch on its own; validate its claims against that batch's titles.
    const parts = chunk(works, CHUNK_SIZE);
    const titles = works.map((w) => w.title);
    const found = { interests: [] as Claim[][], methods: [] as Claim[][], directions: [] as Claim[][] };
    const summaries: string[] = [];
    let ok = 0;
    for (let n = 0; n < parts.length; n++) {
      const p = parts[n];
      await supabaseAdmin.from("profile_analysis").update({ error: `Analysing publications: ${n + 1} of ${parts.length} batches`, updated_at: new Date().toISOString() }).eq("user_id", uid);
      const j: any = await call({ interests_text: interestsText, works: p });
      if (!j) { if (aiStatus === 402 || aiStatus === 403) break; continue; }
      ok++;
      const pt = p.map((w) => w.title);
      found.interests.push(verifyClaims(j.interests, pt, 50).kept);
      found.methods.push(verifyClaims(j.methods, pt, 50).kept);
      found.directions.push(verifyClaims(j.directions, pt, 50).kept);
      if (j.summary) summaries.push(clipWords(String(j.summary), 60));
    }
    if (!enoughChunks(ok, parts.length)) return fail(`The AI could only analyse ${ok} of ${parts.length} batches of your publications. Please try again later.`);

    // 2) Merge validated findings, then ask for one synthesis using only those compact findings.
    const merged = { interests: mergeClaims(found.interests), methods: mergeClaims(found.methods), directions: mergeClaims(found.directions) };
    let result: any = { summary: summaries[0] ?? "", ...merged };
    if (parts.length > 1) {
      const s: any = await call({
        task: "Combine these validated findings from batches of one researcher's publications into one analysis. Keep evidence titles exact and only reuse given evidence.",
        interests_text: interestsText, batch_summaries: summaries, findings: merged,
      });
      // Fall back to the deterministic merge if the synthesis fails or loses claims.
      if (s) result = {
        summary: s.summary || result.summary,
        interests: verifyClaims(s.interests, titles, LIMITS.interests).kept.length ? s.interests : merged.interests,
        methods: verifyClaims(s.methods, titles, LIMITS.methods).kept.length ? s.methods : merged.methods,
        directions: verifyClaims(s.directions, titles, LIMITS.directions).kept.length ? s.directions : merged.directions,
      };
    }

    const i = verifyClaims(result.interests, titles, LIMITS.interests);
    const m = verifyClaims(result.methods, titles, LIMITS.methods);
    const d = verifyClaims(result.directions, titles, LIMITS.directions);
    await supabaseAdmin.from("profile_analysis").update({
      status: "done", error: null, input_hash: hash,
      summary: clipWords(String(result.summary ?? "")),
      interests: i.kept as any, methods: m.kept as any, directions: d.kept as any,
      dropped_claims: { interests: i.dropped, methods: m.dropped, directions: d.dropped } as any,
      finished_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("user_id", uid);
    return { status: "done" as const };
  }
