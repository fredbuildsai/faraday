// Wider OpenAlex search: fills the discovery batch with researchers not on Lattice Scout.
import { scoreCollaboration, type MatchWeights } from "@/lib/match-score";
import type { Profile } from "@/lib/matching";
import { shortId } from "@/lib/openalex-math";

/** How many of your most frequent co-authors are followed for collaborators of collaborators. */
export const BRIDGE_COAUTHORS = 5;
/** Most candidate authors looked up in detail per request. */
export const MAX_LOOKUPS = 50;

export type Layer = "second_degree" | "interest";
export interface RawCandidate { id: string; name: string; layer: Layer; via: string | null; hits: number }

/** Your co-authors ordered by how often you published together. */
export function topCoauthors(works: { authors: { id: string; name: string }[] }[], ownIds: string[], n = BRIDGE_COAUTHORS) {
  const own = new Set(ownIds);
  const count = new Map<string, { id: string; name: string; c: number }>();
  for (const w of works) for (const a of w.authors ?? []) {
    if (!a?.id || own.has(a.id)) continue;
    const e = count.get(a.id) ?? { id: a.id, name: a.name, c: 0 }; e.c++; count.set(a.id, e);
  }
  return [...count.values()].sort((x, y) => y.c - x.c || x.id.localeCompare(y.id)).slice(0, n);
}

/**
 * Collect candidate authors from OpenAlex works.
 * `bridged`: works of one of your co-authors (their co-authors become collaborators of collaborators).
 * `topical`: recent works in your topics.
 * With `piOnly`, only last authors (likely principal investigators) become candidates.
 */
export function collectCandidates(
  bridged: { via: string; works: any[] }[],
  topical: any[],
  exclude: Set<string>,
  /** Only principal investigators (last authors) — on by default. */
  piOnly = true,
): RawCandidate[] {
  const out = new Map<string, RawCandidate>();
  const add = (id: string, name: string, layer: Layer, via: string | null) => {
    if (!id || exclude.has(id)) return;
    const e = out.get(id);
    if (e) { e.hits++; if (layer === "second_degree" && e.layer !== layer) Object.assign(e, { layer, via }); }
    else out.set(id, { id, name, layer, via, hits: 1 });
  };
  const pick = (w: any) => (w.authorships ?? []).filter((a: any) => a?.author?.id && (!piOnly || a.author_position === "last"));
  for (const b of bridged) for (const w of b.works) for (const a of pick(w)) add(shortId(a.author.id), a.author.display_name ?? "", "second_degree", b.via);
  for (const w of topical) for (const a of pick(w)) add(shortId(a.author.id), a.author.display_name ?? "", "interest", null);
  return [...out.values()].sort((x, y) => (x.layer === y.layer ? 0 : x.layer === "second_degree" ? -1 : 1) || y.hits - x.hits);
}

/** Topic weights from an OpenAlex author record (topic counts, normalised to sum 1). */
export function authorTopicWeights(author: any): Record<string, number> {
  const t = (author?.topics ?? []).filter((x: any) => x?.id && x.count > 0).slice(0, 25);
  const sum = t.reduce((s: number, x: any) => s + x.count, 0);
  return sum ? Object.fromEntries(t.map((x: any) => [shortId(x.id), x.count / sum])) : {};
}

/** Activity: works in the last 3 years / 3, capped at 1 (same rule as members). */
export function authorActivity(author: any, currentYear: number): number {
  const n = (author?.counts_by_year ?? []).filter((c: any) => c.year >= currentYear - 2).reduce((s: number, c: any) => s + (c.works_count ?? 0), 0);
  return Math.min(1, n / 3);
}

export interface ExternalPick {
  openalex_id: string; name: string; institution: string | null; score: number; t: number;
  layer: Layer; via: string | null; shared_topics: string[]; h_index: number; citations: number; works_count: number;
}

/** Score looked-up authors against you with the same rule as members; keep the best `size`. */
export function rankExternal(me: Profile, raws: RawCandidate[], authors: Map<string, any>, weights: Partial<MatchWeights>, size: number, currentYear: number): ExternalPick[] {
  const out: ExternalPick[] = [];
  for (const r of raws) {
    const a = authors.get(r.id);
    if (!a) continue;
    const p: Profile = { id: `oa:${r.id}`, topics: authorTopicWeights(a), methods: [], activity: authorActivity(a, currentYear) };
    const s = scoreCollaboration(me, p, weights);
    if (!s) continue;
    const topicNames = new Map((a.topics ?? []).map((x: any) => [shortId(x.id), x.display_name]));
    out.push({
      openalex_id: r.id, name: a.display_name || r.name, institution: a.last_known_institutions?.[0]?.display_name ?? null,
      score: s.score, t: s.T, layer: r.layer, via: r.via, shared_topics: s.sharedTopics.map((k) => String(topicNames.get(k) ?? k)),
      h_index: a.summary_stats?.h_index ?? 0, citations: a.cited_by_count ?? 0, works_count: a.works_count ?? 0,
    });
  }
  out.sort((x, y) => (x.layer === y.layer ? 0 : x.layer === "second_degree" ? -1 : 1) || y.score - x.score);
  return out.slice(0, size);
}
