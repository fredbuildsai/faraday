import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_SECTIONS, invitable } from "@/lib/projects";
import { assessWhitespace, searchTerms, threeYearsAgo, workKey } from "@/lib/opportunities";

const Paper = z.object({ openalexId: z.string().min(1).max(200), title: z.string().min(1).max(1000), url: z.string().max(1000).nullable(), isOa: z.boolean().default(false), origin: z.enum(["member", "evidence", "prior_art", "similar"]).default("member") });
const Person = z.object({ id: z.string().max(200), name: z.string().max(300) });

async function myMatchIds(sb: any): Promise<string[]> {
  const { data, error } = await sb.rpc("my_matches");
  if (error) throw new Error("Could not load your matches.");
  return (data ?? []).map((m: any) => m.other_id as string);
}

/** Create a shared opportunity: you as owner, matches invited, papers attached. */
export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    title: z.string().trim().min(3).max(300), description: z.string().max(5000).default(""),
    memberIds: z.array(z.string().uuid()).max(30).default([]), suggested: z.array(Person).max(30).default([]),
    papers: z.array(Paper).max(100).default([]), source: z.record(z.string(), z.any()).default({}),
    notes: z.string().max(5000).default(""), whitespace: z.record(z.string(), z.any()).nullable().default(null),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const uid = context.userId;
    const invite = invitable(data.memberIds, await myMatchIds(context.supabase), [], uid);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // A saved opportunity's private notes come along, both in the record and as the first discussion post.
    const source = { ...data.source, ...(data.notes.trim() ? { notes: data.notes } : {}) };
    const { data: p, error } = await supabaseAdmin.from("projects").insert({ owner_id: uid, title: data.title, description: data.description, suggested_people: data.suggested as any, source: source as any, whitespace: data.whitespace as any }).select("id").single();
    if (error || !p) throw new Error("Could not create the opportunity.");
    await supabaseAdmin.from("project_members").insert({ project_id: p.id, user_id: uid, role: "owner", state: "accepted", invited_by: uid });
    if (invite.length) await supabaseAdmin.from("project_members").insert(invite.map((user_id) => ({ project_id: p.id, user_id, role: "editor", state: "invited", invited_by: uid })));
    await supabaseAdmin.from("project_sections").insert(DEFAULT_SECTIONS.map((s, i) => ({ project_id: p.id, key: s.key, title: s.title, position: i })));
    if (data.papers.length) await supabaseAdmin.from("project_papers").upsert(data.papers.map((w) => ({ project_id: p.id, openalex_id: workKey(w.openalexId) || w.openalexId, title: w.title, url: w.url, is_oa: w.isOa, origin: w.origin, added_by: uid })), { onConflict: "project_id,openalex_id", ignoreDuplicates: true });
    if (data.notes.trim()) await supabaseAdmin.from("project_comments").insert({ project_id: p.id, author_id: uid, body: `Notes from my saved opportunity:\n\n${data.notes.trim()}` });
    return { id: p.id };
  });

/** Owner invites more of their matches. */
export const inviteToProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid(), memberIds: z.array(z.string().uuid()).min(1).max(30) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isOwner } = await context.supabase.rpc("is_project_owner", { _project: data.projectId, _user: context.userId });
    if (!isOwner) throw new Error("Only the owner can invite people.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin.from("project_members").select("user_id, state").eq("project_id", data.projectId);
    const declined = (existing ?? []).filter((m) => m.state === "declined").map((m) => m.user_id);
    const ids = invitable(data.memberIds, await myMatchIds(context.supabase), (existing ?? []).filter((m) => m.state !== "declined").map((m) => m.user_id), context.userId);
    if (!ids.length) return { invited: 0 };
    const again = ids.filter((id) => declined.includes(id));
    if (again.length) await supabaseAdmin.from("project_members").delete().eq("project_id", data.projectId).in("user_id", again);
    await supabaseAdmin.from("project_members").insert(ids.map((user_id) => ({ project_id: data.projectId, user_id, role: "editor", state: "invited", invited_by: context.userId })));
    return { invited: ids.length };
  });

/** Title search over the publications of you and the people you may work with. */
export const searchMemberPapers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ q: z.string().trim().min(2).max(200), projectId: z.string().uuid().optional(), memberIds: z.array(z.string().uuid()).max(30).default([]) }).parse(d))
  .handler(async ({ data, context }) => {
    const uid = context.userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let owners = [uid];
    if (data.projectId) {
      const { data: ok } = await context.supabase.rpc("is_project_member", { _project: data.projectId, _user: uid });
      if (!ok) throw new Error("Not allowed.");
      const { data: m } = await supabaseAdmin.from("project_members").select("user_id").eq("project_id", data.projectId).eq("state", "active");
      owners = [...new Set([uid, ...(m ?? []).map((x) => x.user_id)])];
    } else {
      const allowed = new Set(await myMatchIds(context.supabase));
      owners = [uid, ...data.memberIds.filter((id) => allowed.has(id))];
    }
    const pattern = `%${data.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    const { data: rows } = await supabaseAdmin.from("works").select("openalex_id, title, doi, is_oa, year, user_id").in("user_id", owners).ilike("title", pattern).order("year", { ascending: false }).limit(25);
    const { data: names } = await supabaseAdmin.from("profiles").select("id, first_name, last_name").in("id", owners);
    const nameOf = (id: string) => id === uid ? "You" : (() => { const p = names?.find((n) => n.id === id); return p ? `${p.first_name} ${p.last_name}`.trim() : "Member"; })();
    const seen = new Set<string>();
    return (rows ?? []).filter((r) => { const k = workKey(r.openalex_id); if (!k || seen.has(k)) return false; seen.add(k); return true; })
      .map((r) => ({ openalexId: workKey(r.openalex_id), title: r.title, url: r.doi ? `https://doi.org/${r.doi.replace(/^https?:\/\/doi.org\//, "")}` : `https://openalex.org/${workKey(r.openalex_id)}`, isOa: !!r.is_oa, year: r.year, owner: nameOf(r.user_id) }));
  });

/** AI drafts search terms from the opportunity and its papers; OpenAlex returns real related papers. */
export const findSimilarPapers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: project } = await sb.from("projects").select("title, description").eq("id", data.projectId).maybeSingle();
    const { data: ok } = await sb.rpc("is_project_member", { _project: data.projectId, _user: context.userId });
    if (!project || !ok) throw new Error("Not allowed.");
    const { data: papers } = await sb.from("project_papers").select("openalex_id, title").eq("project_id", data.projectId).limit(30);
    const { aiChat, parseJson } = await import("@/lib/ai-call.server");
    const { openalexGet } = await import("@/lib/openalex.server");
    const ai = await aiChat([
      { role: "system", content: 'Return JSON {"query": string} — one literature search query (max 10 keywords, no punctuation) that finds papers similar to this research opportunity and its evidence papers. No names.' },
      { role: "user", content: JSON.stringify({ title: project.title, description: project.description, papers: (papers ?? []).map((p) => p.title) }) },
    ], { json: true });
    const query = searchTerms(String(parseJson(ai.text)?.query ?? "") || project.title) || searchTerms(project.title);
    if (!query) return { query: "", papers: [], whitespace: null };
    const sinceDate = threeYearsAgo(new Date());
    const have = new Set((papers ?? []).map((p) => workKey(p.openalex_id)));
    let results: any[] = [], totalCount: number | null = null, recentCount: number | null = null;
    try {
      const q = encodeURIComponent(query);
      const recent: any = await openalexGet(`/works?search=${q}&filter=from_publication_date:${sinceDate}&per_page=15&select=id,display_name,doi,publication_year,open_access`);
      results = recent?.results ?? []; recentCount = Number(recent?.meta?.count ?? 0);
      const all: any = await openalexGet(`/works?search=${q}&per_page=1&select=id`);
      totalCount = Number(all?.meta?.count ?? 0);
    } catch (e) { console.error("similar papers", e); }
    const found = results.map((w) => ({ openalexId: workKey(w.id), title: String(w.display_name ?? ""), url: w.doi || w.id, isOa: !!w.open_access?.is_oa, year: w.publication_year as number | null }))
      .filter((w) => w.openalexId && w.title && !have.has(w.openalexId));
    const whitespace = assessWhitespace({ query, sinceYear: Number(sinceDate.slice(0, 4)), sinceDate, totalCount, recentCount, closest: found.slice(0, 5).map((w) => ({ id: w.openalexId, title: w.title, url: w.url })) });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("projects").update({ whitespace: whitespace as any }).eq("id", data.projectId);
    return { query, papers: found, whitespace };
  });

/** OpenAlex search for references: title/keywords, or a DOI. Members of the opportunity only. */
export const searchReferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid(), q: z.string().trim().min(2).max(300) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("is_project_member", { _project: data.projectId, _user: context.userId });
    if (!ok) throw new Error("Not allowed.");
    const { openalexGet } = await import("@/lib/openalex.server");
    const doi = data.q.match(/10\.\d{4,9}\/\S+/)?.[0];
    const select = "id,display_name,doi,publication_year,authorships,primary_location";
    const path = doi
      ? `/works?filter=doi:${encodeURIComponent(doi.toLowerCase())}&select=${select}`
      : `/works?search=${encodeURIComponent(searchTerms(data.q) || data.q)}&per_page=15&select=${select}`;
    let rows: any[] = [];
    try { rows = ((await openalexGet(path)) as any)?.results ?? []; } catch (e) { console.error("reference search", e); throw new Error("OpenAlex search failed."); }
    return rows.map((w) => {
      const names = (w.authorships ?? []).map((a: any) => String(a?.author?.display_name ?? "")).filter(Boolean);
      return {
        openalexId: workKey(w.id), title: String(w.display_name ?? ""),
        authors: names.length > 3 ? `${names.slice(0, 3).join(", ")} et al.` : names.join(", "),
        year: (w.publication_year ?? null) as number | null,
        venue: String(w.primary_location?.source?.display_name ?? ""),
        doi: w.doi ? String(w.doi).replace(/^https?:\/\/doi\.org\//i, "") : "",
        url: (w.doi || w.id || null) as string | null,
      };
    }).filter((r) => r.openalexId && r.title);
  });
