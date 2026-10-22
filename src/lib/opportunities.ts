// Pure rules for research-gap suggestions. No I/O here.
export const MAX_SUGGESTIONS = 3;
export const MIN_VERIFIED = 2;
export const MAX_DESC_WORDS = 60;
export const CACHE_DAYS = 7;

export type OaWork = { id: string; title: string; url: string };
export type Suggestion = { title: string; description: string; evidence: OaWork[]; novelty?: number | null };

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

/** Keep suggestions whose evidence ids exist in the OpenAlex response (>= MIN_VERIFIED). */
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
