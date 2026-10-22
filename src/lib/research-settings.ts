import { z } from "zod";
import { DEFAULT_OPPORTUNITY_CONFIG } from "@/lib/opportunity-config";

export const ResearchSettingsSchema = z.object({
  collaboratorLimit: z.number().int().positive(),
  matchLimit: z.number().int().positive(),
  paperLimit: z.number().int().min(2).max(200),
  piOnly: z.boolean(),
  excludeReviews: z.boolean(),
  mutualOnly: z.boolean(),
  opportunityMode: z.enum(["network", "broad"]),
});
export type ResearchSettings = z.infer<typeof ResearchSettingsSchema>;
export const DEFAULT_RESEARCH_SETTINGS: ResearchSettings = { collaboratorLimit: DEFAULT_OPPORTUNITY_CONFIG.collaboratorLimit, matchLimit: DEFAULT_OPPORTUNITY_CONFIG.matchLimit, paperLimit: DEFAULT_OPPORTUNITY_CONFIG.paperLimit, piOnly: true, excludeReviews: false, mutualOnly: false, opportunityMode: "broad" };
export function resolveResearchSettings(raw: unknown, defaults = DEFAULT_RESEARCH_SETTINGS): ResearchSettings {
  const object = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const merged = { ...defaults, ...object } as Record<string, unknown>;
  const result = ResearchSettingsSchema.safeParse(merged);
  if (result.success) return result.data;
  // Keep valid saved values when one field is invalid or missing.
  const out = { ...defaults } as Record<string, unknown>;
  for (const [k, field] of Object.entries(ResearchSettingsSchema.shape)) if (field.safeParse(merged[k]).success) out[k] = merged[k];
  return out as ResearchSettings;
}