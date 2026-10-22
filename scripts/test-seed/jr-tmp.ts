import { runAnalysisFor } from "/dev-server/src/lib/analysis-core.server";
import { supabaseAdmin } from "/dev-server/src/integrations/supabase/client.server";
for (const id of ["5538f9e5-f292-4d0f-bba2-de398fd9aeee","5c8bf282-d22b-4b58-a217-3820ebf94eb1"]) {
  await supabaseAdmin.from("analysis_runs").delete().eq("user_id", id);
  const r = await runAnalysisFor(id, true); console.log(id, JSON.stringify(r));
}
