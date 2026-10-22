// Remove every test researcher created by seed.ts and all data linked to them. Run: bun scripts/test-seed/rollback.ts
import { supabaseAdmin } from "../../src/integrations/supabase/client.server";
import { PEOPLE, SEED_TAG } from "./people";

const emails = new Set(PEOPLE.map((p) => p.email));
const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
if (error) throw error;
const users = list.users.filter((u) => u.user_metadata?.seed === SEED_TAG && emails.has(u.email ?? ""));
const ids = users.map((u) => u.id);
if (!ids.length) { console.log("Nothing to remove."); process.exit(0); }

const or = `user_a.in.(${ids.join(",")}),user_b.in.(${ids.join(",")})`;
const { data: matches } = await supabaseAdmin.from("matches").select("id").or(or);
const matchIds = (matches ?? []).map((m) => m.id);

const steps: [string, () => PromiseLike<{ error: any }>][] = [
  ["interests", () => supabaseAdmin.from("interests").delete().in("match_id", matchIds.length ? matchIds : ["00000000-0000-0000-0000-000000000000"])],
  ["feedback on their matches", () => supabaseAdmin.from("feedback").delete().eq("target_type", "match").in("target_id", matchIds.length ? matchIds : ["none"])],
  ["matches", () => supabaseAdmin.from("matches").delete().or(or)],
  ["their feedback", () => supabaseAdmin.from("feedback").delete().in("user_id", ids)],
  ["opportunities", () => supabaseAdmin.from("opportunities").delete().in("user_id", ids)],
  ["analysis edits", () => supabaseAdmin.from("profile_analysis_edits").delete().in("user_id", ids)],
  ["analysis runs", () => supabaseAdmin.from("analysis_runs").delete().in("user_id", ids)],
  ["analysis", () => supabaseAdmin.from("profile_analysis").delete().in("user_id", ids)],
  ["works", () => supabaseAdmin.from("works").delete().in("user_id", ids)],
  ["profiles", () => supabaseAdmin.from("profiles").delete().in("id", ids)],
];
for (const [name, run] of steps) { const { error: e } = await run(); if (e) throw new Error(`${name}: ${e.message}`); console.log("removed", name); }
for (const u of users) { const { error: e } = await supabaseAdmin.auth.admin.deleteUser(u.id); if (e) throw e; console.log("removed account", u.email); }
