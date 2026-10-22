import { DEFAULT_OPPORTUNITY_CONFIG } from "@/lib/opportunity-config";

export type OpportunityPerson = { id: string; name: string; mutual: boolean; collaborator: boolean; match: boolean };
export type OpportunityMatch = { id: string; name: string; mutual: boolean; authorIds: string[]; score?: number };

/** Direct co-authors are eligible here even though discovery excludes them. */
export function opportunityPeople(matches: OpportunityMatch[], works: { authors: { id: string; name: string }[] }[], ownIds: string[], config = DEFAULT_OPPORTUNITY_CONFIG): OpportunityPerson[] {
  const short = (id: string) => id.split("/").pop() ?? "";
  const own = new Set(ownIds.map(short));
  // Matches are capped separately from collaborators: best score first, mutual interest breaking ties.
  const topMatches = [...matches].sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || Number(b.mutual) - Number(a.mutual) || a.name.localeCompare(b.name)).slice(0, config.matchLimit);
  const people = new Map<string, OpportunityPerson>(topMatches.map((m) => [m.id, { id: m.id, name: m.name, mutual: m.mutual, collaborator: false, match: true }]));
  const members = new Map(matches.flatMap((m) => m.authorIds.map((id) => [short(id), m.id] as const)));
  const frequency = new Map<string, number>();
  const names = new Map<string, string>();
  for (const work of works) {
    const counted = new Set<string>();
    for (const author of work.authors ?? []) {
      const id = short(author.id);
      if (!/^A\d+$/.test(id) || own.has(id) || !author.name.trim()) continue;
      const key = members.get(id) ?? id;
      names.set(key, author.name);
      if (!counted.has(key)) frequency.set(key, (frequency.get(key) ?? 0) + 1);
      counted.add(key);
    }
  }
  const top = [...frequency.keys()].sort((a, b) => (frequency.get(b) ?? 0) - (frequency.get(a) ?? 0) || (names.get(a) ?? "").localeCompare(names.get(b) ?? "")).slice(0, config.collaboratorLimit);
  for (const id of top) {
    const member = people.get(id);
    if (member) member.collaborator = true;
    else people.set(id, { id, name: names.get(id) ?? "", mutual: false, collaborator: true, match: false });
  }
  return [...people.values()].sort((a, b) => Number(b.collaborator) - Number(a.collaborator) || (a.collaborator && b.collaborator ? (frequency.get(b.id) ?? 0) - (frequency.get(a.id) ?? 0) : 0) || a.name.localeCompare(b.name));
}

export function eligibleOpportunityPeople(people: OpportunityPerson[], mutualOnly: boolean) {
  return people.filter((person) => person.collaborator || !mutualOnly || person.mutual);
}