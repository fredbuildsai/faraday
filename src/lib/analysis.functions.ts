import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiChat, parseJson } from "@/lib/ai-call.server";
import { CHUNK_SIZE, DAILY_RUNS, LIMITS, chunk, clipWords, inputFingerprint, verifyClaims, type AnalysisWork } from "@/lib/analysis";

const SYSTEM = `You analyse a researcher's published work. Use ONLY the given titles, keywords, topics and their own interests text.
Return JSON: {"summary": string (max 80 words), "interests": [{"label": string, "evidence": [2 exact titles]}] (max 10),
"methods": [{"label": string, "evidence": [2 exact titles]}] (max 8, concrete methods/techniques),
"directions": [{"label": string, "evidence": [2 exact titles]}] (max 5, themes new in the last 3 years)}.
Evidence must be copied character-for-character from the given titles. No names, no institutions, no invented facts.`;

/** Run (or skip) the profile analysis for the signed-in user. */
export const runAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ force: z.boolean().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { runAnalysisFor } = await import("@/lib/analysis-core.server");
    return runAnalysisFor(context.userId, !!data.force);
  });

const editSchema = z.object({ kind: z.enum(["interest", "method"]), value: z.string().trim().min(1).max(120), action: z.enum(["add", "remove"]) });

/** Remember a user's add/remove so it survives re-analysis. */
export const saveAnalysisEdit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => editSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    // Removing something the user added just deletes their addition.
    const { data: existing } = await sb.from("profile_analysis_edits").select("id, action").eq("user_id", context.userId).eq("kind", data.kind).ilike("value", data.value);
    if (existing?.length) await sb.from("profile_analysis_edits").delete().in("id", existing.map((e) => e.id));
    if (!(data.action === "remove" && existing?.some((e) => e.action === "add"))) {
      const { error } = await sb.from("profile_analysis_edits").insert({ user_id: context.userId, ...data });
      if (error) throw new Error("Could not save");
    }
    return { ok: true };
  });
