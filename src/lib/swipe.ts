/** Horizontal drag distance (px) that counts as a decision. */
export const SWIPE_THRESHOLD = 110;

export type SwipeDecision = "like" | "pass" | null;

/** Right = like (interested + saved), left = pass (dismissed), short drag = no decision. */
export function swipeDecision(dx: number, threshold = SWIPE_THRESHOLD): SwipeDecision {
  if (dx >= threshold) return "like";
  if (dx <= -threshold) return "pass";
  return null;
}

/** A match still waits in the deck until the user has decided on it. */
export function inDeck(m: { state: string; i_am_interested: boolean }): boolean {
  return m.state === "active" && !m.i_am_interested;
}
