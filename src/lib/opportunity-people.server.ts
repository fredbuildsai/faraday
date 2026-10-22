import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { opportunityPeople } from "@/lib/opportunity-people";
import { resolveOpportunityConfig } from "@/lib/opportunity-config";
import { DEFAULT_RESEARCH_SETTINGS, resolveResearchSettings } from "@/lib/research-settings";

export async function loadOpportunityPeople(sb: SupabaseClient<Database>, uid: string) {
  const [{ data: profile, error: profileError }, { data: matches, error: matchError }] = await Promise.all([
    sb.from("profiles").select("openalex_author_id, openalex_author_ids, research_settings").eq("id", uid).single(),
    sb.rpc("my_matches"),
  ]);
  if (profileError || matchError) throw new Error("Could not load your collaborators.");
  const works: { authors: { id: string; name: string }[] }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("works").select("authors").eq("user_id", uid).order("id").range(from, from + 999);
    if (error) throw new Error("Could not load your collaborators.");
    for (const work of data ?? []) works.push({ authors: (work.authors ?? []) as { id: string; name: string }[] });
    if (!data || data.length < 1000) break;
  }
  // Only author identifiers for already-authorized matches; no private profile fields.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: members, error } = matches?.length
    ? await supabaseAdmin.from("profiles").select("id, openalex_author_id, openalex_author_ids").in("id", matches.map((m) => m.other_id))
    : { data: [], error: null };
  if (error) throw new Error("Could not load your collaborators.");
  const ids = (p: { openalex_author_id: string | null; openalex_author_ids: string[] | null }) => p.openalex_author_ids?.length ? p.openalex_author_ids : p.openalex_author_id ? [p.openalex_author_id] : [];
  const config = resolveResearchSettings(profile.research_settings, { ...DEFAULT_RESEARCH_SETTINGS, ...resolveOpportunityConfig({ OPPORTUNITY_COLLABORATOR_LIMIT: process.env["OPPORTUNITY_COLLABORATOR_LIMIT"] }) });
  return opportunityPeople((matches ?? []).map((m) => ({ id: m.other_id, name: m.other_name, mutual: !!(m.i_am_interested && m.they_are_interested), score: Number(m.score ?? 0), authorIds: ids(members?.find((p) => p.id === m.other_id) ?? { openalex_author_id: null, openalex_author_ids: [] }) })), works, ids(profile), config);
}