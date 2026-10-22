export interface WorkTopic { id: string; name: string; score: number }
export interface WorkLike { year: number | null; topics: WorkTopic[] }

/** Strip the OpenAlex URL prefix: "https://openalex.org/A123" -> "A123". */
export function shortId(id: string): string {
  return id.replace(/^https?:\/\/openalex\.org\//, "");
}

/** Sum topic scores across works, keep the top 25, normalise to sum 1. */
export function computeTopicWeights(works: WorkLike[], limit = 25): Record<string, number> {
  const totals = new Map<string, number>();
  for (const w of works) for (const t of w.topics) totals.set(t.id, (totals.get(t.id) ?? 0) + (t.score || 0));
  const top = [...totals.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
  const sum = top.reduce((s, [, v]) => s + v, 0);
  if (!sum) return {};
  return Object.fromEntries(top.map(([k, v]) => [k, v / sum]));
}

/** Works in the last 3 calendar years (incl. current) / 3, capped at 1. */
export function computeActivity(works: WorkLike[], currentYear: number): number {
  const recent = works.filter((w) => w.year != null && w.year >= currentYear - 2 && w.year <= currentYear).length;
  return Math.min(1, recent / 3);
}

export interface AuthorCandidate {
  id: string;
  name: string;
  institution: string | null;
  worksCount: number;
  topTopics: string[];
  orcid: string | null;
}

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

/** A single exact-name match whose institution matches the user's is "confident". */
export function confidentMatch(cands: AuthorCandidate[], fullName: string, institution: string | null): AuthorCandidate | null {
  if (!institution) return null;
  const n = norm(fullName), inst = norm(institution);
  const hits = cands.filter((c) => norm(c.name) === n && c.institution != null && (norm(c.institution).includes(inst) || inst.includes(norm(c.institution))));
  return hits.length === 1 ? hits[0]! : null;
}
