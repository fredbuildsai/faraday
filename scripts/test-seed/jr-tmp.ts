import { runAnalysisFor } from "../../src/lib/analysis-core.server";
import { computeMatchesFor } from "../../src/lib/matching-core.server";
import { supabaseAdmin } from "../../src/integrations/supabase/client.server";
const J="5c8bf282-d22b-4b58-a217-3820ebf94eb1";
await supabaseAdmin.from("analysis_runs").delete().eq("user_id", J);
const r = await runAnalysisFor(J, true); console.log("RES", JSON.stringify(r));
if (r.status==="done") console.log("RES", JSON.stringify(await computeMatchesFor(J)));
