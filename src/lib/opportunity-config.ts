/** Application defaults; runtime overrides do not belong in selection logic. */
export const DEFAULT_OPPORTUNITY_CONFIG = { collaboratorLimit: 10 };

export function resolveOpportunityConfig(env: { OPPORTUNITY_COLLABORATOR_LIMIT?: string | undefined } = {}) {
  const limit = Number(env.OPPORTUNITY_COLLABORATOR_LIMIT);
  return { collaboratorLimit: Number.isSafeInteger(limit) && limit > 0 ? limit : DEFAULT_OPPORTUNITY_CONFIG.collaboratorLimit };
}