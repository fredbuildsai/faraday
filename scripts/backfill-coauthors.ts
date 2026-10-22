// Re-import every profile's works so co-authors are stored. Run: bun scripts/backfill-coauthors.ts
import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import { importWorksFor } from "../src/lib/import-core.server";
const { data } = await supabaseAdmin.from("profiles").select("id, first_name, last_name, openalex_author_id, openalex_author_ids");
for (const p of data ?? []) {
  if (!p.openalex_author_id && !p.openalex_author_ids?.length) continue;
  try { console.log(p.first_name, p.last_name, await importWorksFor(p.id)); } catch (e) { console.log(p.first_name, "failed", String(e)); }
}
