import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_RESEARCH_SETTINGS, ResearchSettingsSchema, resolveResearchSettings } from "@/lib/research-settings";
import { resolveOpportunityConfig } from "@/lib/opportunity-config";

export const getResearchSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("profiles").select("research_settings").eq("id", context.userId).single();
    if (error) throw new Error("Could not load settings.");
    return resolveResearchSettings(data.research_settings, { ...DEFAULT_RESEARCH_SETTINGS, ...resolveOpportunityConfig({ OPPORTUNITY_COLLABORATOR_LIMIT: process.env["OPPORTUNITY_COLLABORATOR_LIMIT"] }) });
  });
export const saveResearchSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ResearchSettingsSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("profiles").update({ research_settings: data }).eq("id", context.userId);
    if (error) throw new Error("Could not save settings.");
    return data;
  });
export const researchSettingsQuery = queryOptions({ queryKey: ["research-settings"], queryFn: () => getResearchSettings() });