import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { recentWorksCount } from "@/lib/discovery-external";
const { data } = await supabaseAdmin.from("external_suggestions").select("id, openalex_id").is("recent_works", null);
const y = new Date().getUTCFullYear();
for (const r of data ?? []) {
  const a = await (await fetch(`https://api.openalex.org/authors/${r.openalex_id}?select=counts_by_year`)).json();
  await supabaseAdmin.from("external_suggestions").update({ recent_works: recentWorksCount(a, y) }).eq("id", r.id);
}
console.log("updated", data?.length);
