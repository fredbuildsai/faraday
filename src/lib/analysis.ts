// Pure rules for the profile analysis: input shaping, evidence checks, user edits.

export const MAX_SUMMARY_WORDS = 80;
export const LIMITS = { interests: 10, methods: 8, directions: 5 } as const;
export const MIN_EVIDENCE = 2;
export const DAILY_RUNS = 3;
export const CHUNK_SIZE = 40;
/** Share of batches that must succeed before we save a combined result. */
export const MIN_CHUNK_SUCCESS = 0.5;

/** Merge validated claims from several batches: same label (case/space/trailing-s) merges evidence. */
export function mergeClaims(lists: Claim[][]): Claim[] {
  const key = (l: string) => l.toLowerCase().replace(/\s+/g, " ").trim().replace(/s$/, "");
  const map = new Map<string, { label: string; evidence: string[]; hits: number }>();
  for (const list of lists) for (const c of list) {
    const k = key(c.label);
    const cur = map.get(k) ?? { label: c.label, evidence: [], hits: 0 };
    cur.hits++;
    for (const e of c.evidence) if (!cur.evidence.includes(e)) cur.evidence.push(e);
    map.set(k, cur);
  }
  return [...map.values()]
    .sort((a, b) => b.hits - a.hits || b.evidence.length - a.evidence.length)
    .map(({ label, evidence }) => ({ label, evidence }));
}

/** Enough batches succeeded to trust a combined result. */
export const enoughChunks = (ok: number, total: number) => total > 0 && ok / total >= MIN_CHUNK_SUCCESS;

export interface Claim { label: string; evidence: string[] }
export interface AnalysisResult { summary: string; interests: Claim[]; methods: Claim[]; directions: Claim[] }
export interface AnalysisWork { title: string; year: number | null; keywords: string[]; topics: string[] }

export const normTitle = (t: string) => t.toLowerCase().replace(/\s+/g, " ").trim();

export function chunk<T>(xs: T[], size = CHUNK_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}

/** Stable fingerprint of what we send; same input means the analysis is skipped. */
export function inputFingerprint(works: AnalysisWork[], interestsText: string): string {
  const s = JSON.stringify([works.map((w) => [w.title, w.year, w.keywords, w.topics]).sort(), interestsText.trim()]);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return `${s.length}-${h.toString(16)}`;
}

export function clipWords(text: string, max = MAX_SUMMARY_WORDS): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length <= max ? words.join(" ") : words.slice(0, max).join(" ") + "…";
}

/** Keep only claims with at least MIN_EVIDENCE titles that exactly match the user's works. */
export function verifyClaims(claims: unknown, titles: string[], limit: number): { kept: Claim[]; dropped: Claim[] } {
  const byNorm = new Map(titles.map((t) => [normTitle(t), t]));
  const kept: Claim[] = [];
  const dropped: Claim[] = [];
  const seen = new Set<string>();
  for (const c of Array.isArray(claims) ? claims : []) {
    const label = String((c as any)?.label ?? "").trim().slice(0, 120);
    const ev = Array.isArray((c as any)?.evidence) ? (c as any).evidence.map(String) : [];
    if (!label) continue;
    const verified = Array.from(new Set(ev.map((e: string) => byNorm.get(normTitle(e))).filter(Boolean))) as string[];
    const key = label.toLowerCase();
    if (verified.length >= MIN_EVIDENCE && !seen.has(key) && kept.length < limit) {
      seen.add(key);
      kept.push({ label, evidence: verified.slice(0, MIN_EVIDENCE) });
    } else dropped.push({ label, evidence: ev });
  }
  return { kept, dropped };
}

export interface Edit { kind: "interest" | "method"; value: string; action: "add" | "remove" }
export interface ShownClaim extends Claim { byUser?: boolean }

/** Apply the user's removals and additions on top of the AI list. */
export function applyEdits(claims: Claim[], edits: Edit[], kind: Edit["kind"]): ShownClaim[] {
  const mine = edits.filter((e) => e.kind === kind);
  const removed = new Set(mine.filter((e) => e.action === "remove").map((e) => e.value.toLowerCase()));
  const out: ShownClaim[] = claims.filter((c) => !removed.has(c.label.toLowerCase()));
  const have = new Set(out.map((c) => c.label.toLowerCase()));
  for (const e of mine) if (e.action === "add" && !have.has(e.value.toLowerCase())) {
    have.add(e.value.toLowerCase());
    out.push({ label: e.value, evidence: [], byUser: true });
  }
  return out;
}
