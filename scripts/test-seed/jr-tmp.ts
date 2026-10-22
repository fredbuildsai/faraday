import { computeMatchesFor } from "../../src/lib/matching-core.server";
import { supabaseAdmin } from "../../src/integrations/supabase/client.server";
const R="5538f9e5-f292-4d0f-bba2-de398fd9aeee", J="5c8bf282-d22b-4b58-a217-3820ebf94eb1";
const { data: a } = await supabaseAdmin.from("profile_analysis").select("user_id,status,methods").in("user_id",[R,J]);
console.log(JSON.stringify(a?.map(x=>({u:x.user_id.slice(0,4),s:x.status,m:(x.methods as any[]|null)?.map((m:any)=>m.label)}))));
for (const u of [R,J]) console.log(JSON.stringify(await computeMatchesFor(u)).slice(0,600));
const { data: m } = await supabaseAdmin.from("matches").select("*").or(`and(user_a.eq.${R},user_b.eq.${J}),and(user_a.eq.${J},user_b.eq.${R})`);
console.log(JSON.stringify(m).slice(0,800));
