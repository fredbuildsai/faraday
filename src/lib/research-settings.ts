import { z } from "zod";
import { DEFAULT_OPPORTUNITY_CONFIG } from "@/lib/opportunity-config";

export const ResearchSettingsSchema = z.object({
  collaboratorLimit: z.number().int().positive(),
  piOnly: z.boolean(),
  excludeReviews: z.boolean(),
  mutualOnly: z.boolean(),
  opportunityMode: z.enum(["network", "broad"]),
});
export type ResearchSettings = z.infer<typeof ResearchSettingsSchema>;
export const DEFAULT_RESEARCH_SETTINGS: ResearchSettings = { collaboratorLimit: DEFAULT_OPPORTUNITY_CONFIG.collaboratorLimit, piOnly: true, excludeReviews: false, mutualOnly: false, opportunityMode: "broad" };
export function resolveResearchSettings(raw: unknown, defaults = DEFAULT_RESEARCH_SETTINGS): ResearchSettings {
  const object = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const result = ResearchSettingsSchema.safeParse({ ...defaults, ...object });
  return result.success ? result.data : defaults;
}