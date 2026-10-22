/** Monthly refresh rules. */
export const REFRESH_AFTER_DAYS = 30;
/** Runs once a night, so each run handles a small batch of due profiles. */
export const USERS_PER_RUN = 5;
export const LOCK_MINUTES = 30;

/** Is this profile due for its monthly re-import? */
export function isDue(lastImportedAt: string | null, now: Date): boolean {
  if (!lastImportedAt) return false; // never imported: the user's own first import handles it
  return now.getTime() - new Date(lastImportedAt).getTime() >= REFRESH_AFTER_DAYS * 86400_000;
}

/** AI statuses that must pause the whole job until the owner fixes the account. */
export function pauseReasonFor(aiStatus: number): string | null {
  if (aiStatus === 402) return "AI account out of credit (402)";
  if (aiStatus === 403) return "AI account refused access (403)";
  return null;
}
