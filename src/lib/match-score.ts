// Collaboration-potential scoring (v2). Methods are descriptive only — never scored.
import { methodJaccard, overlapCoefficient, type Profile } from "@/lib/matching";

export interface MatchWeights {
  /** Weight of shared research area (topic similarity). */
  topic: number;
  /** Weight of publication activity. */
  activity: number;
  /** Minimum topic similarity before a pair is considered at all. */
  minTopic: number;
  /** Minimum final score for a match. */
  minScore: number;
}

export const DEFAULT_WEIGHTS: MatchWeights = { topic: 0.85, activity: 0.15, minTopic: 0.2, minScore: 0.2 };

export type MethodRelation = "shared" | "different" | "unknown";
/** Method similarity at or above this reads as "shared methodological ground". */
export const SHARED_METHODS_AT = 0.25;

export interface ScoredPair {
  score: number; T: number; M: number; act: number;
  sharedTopics: string[]; sharedMethods: string[]; aOnly: string[]; bOnly: string[];
  methodRelation: MethodRelation; formula: "v2";
}

/** Normalise weights so topic + activity = 1; clamp gates to 0..1. */
export function resolveWeights(w: Partial<MatchWeights> = {}): MatchWeights {
  const m = { ...DEFAULT_WEIGHTS, ...w };
  const t = Math.max(0, m.topic), a = Math.max(0, m.activity);
  const total = t + a || 1;
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  return { topic: t / total, activity: a / total, minTopic: clamp(m.minTopic), minScore: clamp(m.minScore) };
}

export function methodRelation(a: string[], b: string[], M: number): MethodRelation {
  if (!a.length || !b.length) return "unknown";
  return M >= SHARED_METHODS_AT ? "shared" : "different";
}

export function scoreCollaboration(a: Profile, b: Profile, weights: Partial<MatchWeights> = {}): ScoredPair | null {
  const w = resolveWeights(weights);
  const T = overlapCoefficient(a.topics, b.topics);
  if (T < w.minTopic) return null; // unrelated fields: never matched
  const act = Math.min(1, Math.max(0, Math.min(a.activity, b.activity)));
  const score = Math.min(1, w.topic * T + w.activity * act);
  if (score < w.minScore) return null;
  const M = methodJaccard(a.methods, b.methods);
  const aSet = new Set(a.methods), bSet = new Set(b.methods);
  return {
    score, T, M, act,
    sharedTopics: Object.keys(a.topics).filter((k) => k in b.topics).sort((x, y) => (b.topics[y]! + a.topics[y]!) - (b.topics[x]! + a.topics[x]!)).slice(0, 5),
    sharedMethods: [...aSet].filter((m) => bSet.has(m)).sort().slice(0, 5),
    aOnly: [...aSet].filter((m) => !bSet.has(m)).sort().slice(0, 5),
    bOnly: [...bSet].filter((m) => !aSet.has(m)).sort().slice(0, 5),
    methodRelation: methodRelation(a.methods, b.methods, M), formula: "v2",
  };
}

export type CollabMatch = ScoredPair & { a: string; b: string };

export function collaborationMatchesFor(user: Profile, others: Profile[], weights: Partial<MatchWeights> = {}): CollabMatch[] {
  const out: CollabMatch[] = [];
  for (const o of others) {
    if (o.id === user.id) continue;
    const s = scoreCollaboration(user, o, weights);
    if (!s) continue;
    out.push(user.id < o.id ? { a: user.id, b: o.id, ...s } : { a: o.id, b: user.id, ...s, aOnly: s.bOnly, bOnly: s.aOnly });
  }
  return out;
}
