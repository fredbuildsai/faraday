export type Weights = Record<string, number>
export interface Profile { id: string; topics: Weights; methods: string[]; activity: number }
export interface Match {
  a: string; b: string; score: number; T: number; M: number; act: number
  sharedTopics: string[]; aOnly: string[]; bOnly: string[]; formula: 'c2'
}
export const MIN_SCORE = 0.11, ALPHA = 1.0, BETA = 1.5, WEEKLY_CAP = 5
const sum = (w: Weights) => Object.values(w).reduce((s, v) => s + v, 0)

export function overlapCoefficient(x: Weights, y: Weights): number {
  const smaller = Math.min(sum(x), sum(y))
  if (!smaller) return 0
  let low = 0
  for (const k of Object.keys(x)) if (k in y) low += Math.min(x[k], y[k])
  return Math.min(1, low / smaller)
}

export function methodJaccard(a: string[], b: string[]): number {
  const A = new Set(a), B = new Set(b)
  let inter = 0
  for (const m of A) if (B.has(m)) inter++
  const union = A.size + B.size - inter
  return union ? inter / union : 0
}

export function normaliseMethod(raw: string, synonyms: Record<string, string> = {}): string {
  let m = raw.toLowerCase().trim().replace(/\s+/g, ' ')
  if (m.length > 3 && m.endsWith('s') && !m.endsWith('ss')) m = m.slice(0, -1)
  return synonyms[m] ?? m
}

export function scorePair(a: Profile, b: Profile, minScore = MIN_SCORE): Omit<Match, 'a' | 'b'> | null {
  const aSet = new Set(a.methods), bSet = new Set(b.methods)
  const aOnly = [...aSet].filter((m) => !bSet.has(m)).sort()
  const bOnly = [...bSet].filter((m) => !aSet.has(m)).sort()
  if (!aOnly.length || !bOnly.length) return null
  const T = overlapCoefficient(a.topics, b.topics)
  const M = methodJaccard(a.methods, b.methods)
  const act = 0.5 + 0.5 * Math.min(a.activity, b.activity)
  const score = Math.min(1, Math.pow(T, ALPHA) * Math.pow(1 - M, BETA) * act)
  if (score < minScore) return null
  const sharedTopics = Object.keys(a.topics).filter((k) => k in b.topics).sort().slice(0, 5)
  return { score, T, M, act, sharedTopics, aOnly: aOnly.slice(0, 5), bOnly: bOnly.slice(0, 5), formula: 'c2' }
}

export function selectPairs(pairs: Match[], openCounts: Record<string, number>, cap = WEEKLY_CAP): Match[] {
  const taken: Record<string, number> = {}
  const chosen: Match[] = []
  const sorted = [...pairs].sort((p, q) => q.score - p.score || p.a.localeCompare(q.a) || p.b.localeCompare(q.b))
  for (const p of sorted) {
    if (![p.a, p.b].every((id) => (openCounts[id] ?? 0) + (taken[id] ?? 0) < cap)) continue
    chosen.push(p)
    taken[p.a] = (taken[p.a] ?? 0) + 1
    taken[p.b] = (taken[p.b] ?? 0) + 1
  }
  return chosen
}

export function matchesFor(user: Profile, others: Profile[], minScore = MIN_SCORE): Match[] {
  const out: Match[] = []
  for (const o of others) {
    if (o.id === user.id) continue
    const s = scorePair(user, o, minScore)
    if (!s) continue
    const [a, b] = user.id < o.id ? [user.id, o.id] : [o.id, user.id]
    out.push(user.id < o.id ? { a, b, ...s } : { a, b, ...s, aOnly: s.bOnly, bOnly: s.aOnly })
  }
  return out
}
