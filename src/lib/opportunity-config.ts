/** Application defaults; runtime overrides do not belong in selection logic. */
export const DEFAULT_OPPORTUNITY_CONFIG = { collaboratorLimit: 10, matchLimit: 10, paperLimit: 30, potentialLimit: 8 };

export function resolveOpportunityConfig(env: { OPPORTUNITY_COLLABORATOR_LIMIT?: string | undefined } = {}) {
  const limit = Number(env.OPPORTUNITY_COLLABORATOR_LIMIT);
  return { ...DEFAULT_OPPORTUNITY_CONFIG, collaboratorLimit: Number.isSafeInteger(limit) && limit > 0 ? limit : DEFAULT_OPPORTUNITY_CONFIG.collaboratorLimit };
}