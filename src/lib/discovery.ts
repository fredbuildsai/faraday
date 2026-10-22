// Discovery layer: 10 new researchers per request, platform members only (for now).
import { scoreCollaboration, type CollabMatch, type MatchWeights } from "@/lib/match-score";
import type { Profile } from "@/lib/matching";

export const BATCH_SIZE = 10;

export type Author = { id: string; name: string };
export type Layer = "second_degree" | "interest";

export interface Candidate {
  profile: Profile;
  /** The candidate's own OpenAlex author ids. */
  authorIds: string[];
  /** OpenAlex ids (→ names) of everyone the candidate has published with. */
  coauthors: Map<string, string>;
}

export type Discovery = CollabMatch & { layer: Layer; /** Names of the shared co-authors who link you (2nd-degree connections). */ vias: string[] };

/** Everyone on the given works except the person themselves (by their own OpenAlex ids). */
export function coauthorsOf(works: { authors: Author[] }[], ownIds: string[]): Map<string, string> {
  const own = new Set(ownIds);
  const out = new Map<string, string>();
  for (const w of works) for (const a of w.authors ?? []) if (a?.id && !own.has(a.id)) out.set(a.id, a.name ?? "");
  return out;
}

/**
 * Pick up to `size` new researchers for `me`.
 * Excluded: self, anyone already matched (active, saved or dismissed), and direct co-authors.
 * Collaborators of collaborators come first, then the strongest shared-topic matches.
 * The topic gate still applies to both, so unrelated fields never appear.
 */
export function pickDiscovery(
  me: { profile: Profile; authorIds: string[]; coauthors: Map<string, string> },
  candidates: Candidate[],
  alreadyMatched: Set<string>,
  weights: Partial<MatchWeights> = {},
  size = BATCH_SIZE,
): Discovery[] {
  const out: Discovery[] = [];
  for (const c of candidates) {
    const id = c.profile.id;
    if (id === me.profile.id || alreadyMatched.has(id)) continue;
    if (c.authorIds.some((a) => me.coauthors.has(a))) continue; // direct co-author
    if (me.authorIds.some((a) => c.coauthors.has(a))) continue;
    const s = scoreCollaboration(me.profile, c.profile, weights);
    if (!s) continue;
    // Every shared co-author is a connection; several are possible.
    const vias = [...c.coauthors.keys()].filter((k) => me.coauthors.has(k))
      .map((k) => me.coauthors.get(k) || c.coauthors.get(k) || "")
      .filter(Boolean);
    const base = me.profile.id < id
      ? { a: me.profile.id, b: id, ...s }
      : { a: id, b: me.profile.id, ...s, aOnly: s.bOnly, bOnly: s.aOnly };
    out.push({ ...base, layer: vias.length ? "second_degree" : "interest", vias });
  }
  out.sort((x, y) => (x.layer === y.layer ? 0 : x.layer === "second_degree" ? -1 : 1) || y.score - x.score);
  return out.slice(0, size);
}
