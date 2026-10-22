import { supabase } from "@/integrations/supabase/client";
import type { Suggestion } from "@/lib/opportunities";

export type SavedState = "saved" | "dismissed";

/** Save (thumbs up) or dismiss (thumbs down, soft delete) an opportunity snapshot. */
export async function markOpportunity(key: string, s: Suggestion, settings: unknown, state: SavedState) {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("Not signed in");
  const { error } = await supabase.from("saved_opportunities").upsert(
    { user_id: uid, source_key: key, state, snapshot: { ...s, settings } as any, updated_at: new Date().toISOString() },
    { onConflict: "user_id,source_key" },
  );
  if (error) throw error;
  await supabase.from("feedback").upsert(
    { user_id: uid, target_type: "opportunity", target_id: key, value: state === "saved" ? 1 : -1 },
    { onConflict: "user_id,target_type,target_id" },
  );
}
