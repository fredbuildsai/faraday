/** Potential collaborators for an opportunity built from the user's own work. */
export type Authorship = { author?: { id?: string | null; display_name?: string | null } | null };
export type PaperAuthors = { authorships?: Authorship[] };
export type PotentialCollaborator = { id: string; name: string; degree: 1 | 2; via: string[]; papers: number };

const short = (id: unknown) => String(id ?? "").split("/").pop() ?? "";
const authorsOf = (p: PaperAuthors) => (p.authorships ?? []).map((a) => ({ id: short(a.author?.id), name: String(a.author?.display_name ?? "").trim() })).filter((a) => /^A\d+$/.test(a.id) && a.name);

/** Co-authors of each direct collaborator (excluding the user and direct collaborators) → who connects them. */
export function secondDegree(direct: Map<string, string>, collaboratorPapers: { collaboratorId: string; papers: PaperAuthors[] }[], ownIds: string[]) {
  const own = new Set(ownIds.map(short));
  const out = new Map<string, { name: string; via: Set<string> }>();
  for (const { collaboratorId, papers } of collaboratorPapers) {
    const viaName = direct.get(short(collaboratorId));
    if (!viaName) continue;
    for (const p of papers) for (const a of authorsOf(p)) {
      if (own.has(a.id) || direct.has(a.id)) continue;
      const e = out.get(a.id) ?? { name: a.name, via: new Set<string>() };
      e.via.add(viaName);
      out.set(a.id, e);
    }
  }
  return out;
}

/**
 * Ranks people for one opportunity: direct collaborators who co-wrote its evidence papers or
 * publish on its topic come first, then collaborators-of-collaborators publishing on the topic.
 */
export function potentialCollaborators(input: {
  evidence: PaperAuthors[]; topic: PaperAuthors[]; direct: Map<string, string>;
  second: Map<string, { name: string; via: Set<string> }>; ownIds: string[]; limit: number;
}): PotentialCollaborator[] {
  const own = new Set(input.ownIds.map(short));
  const found = new Map<string, PotentialCollaborator>();
  const add = (id: string, name: string, degree: 1 | 2, via: string[]) => {
    const e = found.get(id);
    if (e) e.papers += 1; else found.set(id, { id, name, degree, via, papers: 1 });
  };
  for (const p of [...input.evidence, ...input.topic]) {
    const seen = new Set<string>();
    for (const a of authorsOf(p)) {
      if (own.has(a.id) || seen.has(a.id)) continue;
      seen.add(a.id);
      if (input.direct.has(a.id)) add(a.id, input.direct.get(a.id)!, 1, []);
      else if (input.evidence.includes(p)) add(a.id, a.name, 1, []); // co-author of the user's own evidence paper
      else { const s = input.second.get(a.id); if (s) add(a.id, s.name, 2, [...s.via]); }
    }
  }
  return [...found.values()].sort((a, b) => a.degree - b.degree || b.papers - a.papers || a.name.localeCompare(b.name)).slice(0, input.limit);
}
