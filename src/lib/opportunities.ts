// Pure rules for research-gap suggestions. No I/O here.
export const MAX_SUGGESTIONS = 3;
export const MIN_VERIFIED = 2;
export const MAX_DESC_WORDS = 60;
export const CACHE_DAYS = 7;
/** Whitespace thresholds on recent (last 3 years) OpenAlex hits for the proposed question. */
export const WHITESPACE_LOW = 50;
export const WHITESPACE_HIGH = 500;
/** Title similarity at or above this means an existing paper already frames the question. */
export const DUPLICATE_SIMILARITY = 0.6;

export type OaWork = { id: string; title: string; url: string; owner?: string };
export type Person = { id: string; name: string; institution: string | null; roles: ("last" | "corresponding")[] };
export type Whitespace = {
  query: string;
  sinceYear: number;
  /** Start of the rolling window (YYYY-MM-DD), exactly 3 years before the search. */
  sinceDate?: string;
  totalCount: number | null;
  recentCount: number | null;
  closest: { id: string; title: string; url: string; similarity: number }[];
  level: "underexplored" | "moderate" | "crowded" | "unknown";
  reasons: string[];
};
export type Suggestion = {
  title: string;
  description: string;
  evidence: OaWork[];
  novelty?: number | null;
  pis?: Person[];
  collaborators?: { id: string; name: string }[];
  whitespace?: Whitespace;
};
export type OppSettings = { mode: "network" | "broad"; excludeReviews: boolean; matchIds: string[]; mutualOnly: boolean };

/** Normalise "https://openalex.org/W123" or "W123" to "W123". */
export function workKey(id: unknown): string {
  const s = String(id ?? "").trim();
  const m = s.match(/W\d+$/i);
  return m ? m[0].toUpperCase() : "";
}

export function clipDescription(text: string, max = MAX_DESC_WORDS): string {
  const words = String(text ?? "").trim().split(/\s+/).filter(Boolean);
  return words.length <= max ? words.join(" ") : words.slice(0, max).join(" ") + "…";
}

/** Keep suggestions whose evidence ids exist in the supplied works (>= MIN_VERIFIED). */
export function verifySuggestions(raw: unknown, works: OaWork[]): { kept: Suggestion[]; dropped: unknown[] } {
  const byId = new Map(works.map((w) => [workKey(w.id), w]));
  const kept: Suggestion[] = [];
  const dropped: unknown[] = [];
  for (const s of Array.isArray(raw) ? raw : []) {
    const title = String((s as any)?.title ?? "").trim();
    const ids = Array.isArray((s as any)?.evidence) ? (s as any).evidence : [];
    const seen = new Set<string>();
    const evidence: OaWork[] = [];
    for (const id of ids) {
      const k = workKey(id);
      const w = byId.get(k);
      if (w && !seen.has(k)) { seen.add(k); evidence.push(w); }
    }
    if (!title || evidence.length < MIN_VERIFIED || kept.length >= MAX_SUGGESTIONS) { dropped.push(s); continue; }
    kept.push({ title, description: clipDescription((s as any)?.description), evidence });
  }
  return { kept, dropped };
}

export function isFresh(createdAt: string | null | undefined, now = Date.now()): boolean {
  return !!createdAt && now - new Date(createdAt).getTime() < CACHE_DAYS * 86400_000;
}

/** Same settings => cached results can be reused. */
export function sameSettings(a: Partial<OppSettings> | null | undefined, b: OppSettings): boolean {
  if (!a) return false;
  const ids = (x?: string[]) => [...(x ?? [])].sort().join(",");
  return a.mode === b.mode && !!a.excludeReviews === b.excludeReviews && !!a.mutualOnly === b.mutualOnly && ids(a.matchIds) === ids(b.matchIds);
}

/** Last author of each paper, merged by author id. */
export function principalInvestigators(papers: { authorships?: any[] }[]): Person[] {
  const out = new Map<string, Person>();
  for (const p of papers) {
    for (const a of p.authorships ?? []) {
      if (a?.author_position !== "last") continue;
      const id = String(a?.author?.id ?? a?.author?.display_name ?? "").trim();
      const name = String(a?.author?.display_name ?? a?.raw_author_name ?? "").trim();
      if (!id || !name) continue;
      if (!out.has(id)) out.set(id, { id, name, institution: a?.institutions?.[0]?.display_name ?? null, roles: ["last"] });
    }
  }
  return [...out.values()];
}

const STOP = new Set("a an the and or of in on for to with by from at as is are be can does do how what which why when whether role effect effects affect impact using use via into during between their its this that these those than under over".split(" "));

/** Turn a question-style title into plain key terms OpenAlex can search (no wildcards like ? or *). */
export function searchTerms(title: string, max = 10): string {
  const words = title.normalize("NFKC").replace(/[\u2010-\u2015]/g, "-").replace(/[^\p{L}\p{N}\- ]+/gu, " ")
    .split(/\s+/).map((w) => w.replace(/^-+|-+$/g, "")).filter((w) => w.length > 1 && !STOP.has(w.toLowerCase()));
  return [...new Set(words)].slice(0, max).join(" ");
}

/** Word-set (Jaccard) similarity between two titles, 0..1. */
export function titleSimilarity(a: string, b: string): number {
  const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length > 2));
  const A = words(a), B = words(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Auditable whitespace verdict from literature counts and the closest existing papers. */
export function assessWhitespace(input: {
  query: string; sinceYear: number; sinceDate?: string; totalCount: number | null; recentCount: number | null;
  closest: { id: string; title: string; url: string }[];
}): Whitespace {
  const closest = input.closest.map((c) => ({ ...c, similarity: Math.round(titleSimilarity(input.query, c.title) * 100) / 100 }))
    .sort((x, y) => y.similarity - x.similarity);
  const reasons: string[] = [];
  const dup = closest.find((c) => c.similarity >= DUPLICATE_SIMILARITY);
  const span = "in the last 3 years";
  let level: Whitespace["level"];
  if (input.recentCount == null) { level = "unknown"; reasons.push("Literature count unavailable."); }
  else {
    if (input.recentCount < WHITESPACE_LOW) { level = "underexplored"; reasons.push(`Only ${input.recentCount} papers ${span}.`); }
    else if (input.recentCount < WHITESPACE_HIGH) { level = "moderate"; reasons.push(`${input.recentCount} papers ${span}.`); }
    else { level = "crowded"; reasons.push(`${input.recentCount} papers ${span}.`); }
  }
  if (dup) { level = "crowded"; reasons.push(`An existing paper already frames this closely: "${dup.title}".`); }
  else if (closest.length) reasons.push("No existing paper title closely matches this question.");
  return { query: input.query, sinceYear: input.sinceYear, sinceDate: input.sinceDate, totalCount: input.totalCount, recentCount: input.recentCount, closest, level, reasons };
}

/** Date exactly 3 years before `now`, as YYYY-MM-DD. */
export function threeYearsAgo(now: Date): string {
  const d = new Date(now);
  d.setUTCFullYear(d.getUTCFullYear() - 3);
  return d.toISOString().slice(0, 10);
}

/** Fewest papers in the last 3 years first; unknown counts go last. */
export function byFewestRecent<T extends { whitespace?: { recentCount: number | null } | null }>(list: T[]): T[] {
  const n = (s: T) => s.whitespace?.recentCount ?? Number.POSITIVE_INFINITY;
  return [...list].sort((a, b) => n(a) - n(b));
}
