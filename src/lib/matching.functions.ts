import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { WEEKLY_CAP, matchesFor, selectPairs, type Profile } from "@/lib/matching";
import { tidyMethod } from "@/lib/method-synonyms";

const topicKey = (id: unknown) => String(id ?? "").split("/").pop() ?? "";

/** Find new matches for the signed-in user (and record them for both people). */
export const computeMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { computeMatchesFor } = await import("@/lib/matching-core.server");
    return computeMatchesFor(context.userId);
  });

/** Say "I'm interested" in a match (or take it back while the other person hasn't answered). */
export const setInterest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ matchId: z.string().uuid(), interested: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const q = context.supabase.from("interests");
    const { error } = data.interested
      ? await q.upsert({ match_id: data.matchId, user_id: context.userId }, { ignoreDuplicates: true })
      : await q.delete().eq("match_id", data.matchId).eq("user_id", context.userId);
    if (error) throw new Error("Could not update");
    return { ok: true };
  });
