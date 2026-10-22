/** Horizontal drag distance (px) that counts as a decision. */
export const SWIPE_THRESHOLD = 110;

export type SwipeDecision = "like" | "pass" | null;

/** Right = like (interested + saved), left = pass (dismissed), short drag = no decision. */
export function swipeDecision(dx: number, threshold = SWIPE_THRESHOLD): SwipeDecision {
  if (dx >= threshold) return "like";
  if (dx <= -threshold) return "pass";
  return null;
}

/**
 * A Lattice Scout member stays in the deck until the user has decided on them.
 * Members dismissed earlier are proposed again (shown with a "previously dismissed" note),
 * except the ones passed during the current visit.
 */
export function inDeck(m: { state: string; i_am_interested: boolean }, passedThisVisit = false): boolean {
  if (passedThisVisit) return false;
  if (m.state === "dismissed") return true;
  return m.state === "active" && !m.i_am_interested;
}
