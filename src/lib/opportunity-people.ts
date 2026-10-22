export type OpportunityPerson = { id: string; name: string; mutual: boolean; collaborator: boolean };
export type OpportunityMatch = { id: string; name: string; mutual: boolean; authorIds: string[] };

/** Direct co-authors are eligible here even though discovery excludes them. */
export function opportunityPeople(matches: OpportunityMatch[], works: { authors: { id: string; name: string }[] }[], ownIds: string[]): OpportunityPerson[] {
  const short = (id: string) => id.split("/").pop() ?? "";
  const own = new Set(ownIds.map(short));
  const people = new Map<string, OpportunityPerson>(matches.map((m) => [m.id, { id: m.id, name: m.name, mutual: m.mutual, collaborator: false }]));
  const members = new Map(matches.flatMap((m) => m.authorIds.map((id) => [short(id), m.id] as const)));
  for (const work of works) for (const author of work.authors ?? []) {
    const id = short(author.id);
    if (!/^A\d+$/.test(id) || own.has(id) || !author.name.trim()) continue;
    const memberId = members.get(id);
    const member = memberId ? people.get(memberId) : undefined;
    if (member) member.collaborator = true;
    else people.set(id, { id, name: author.name, mutual: false, collaborator: true });
  }
  return [...people.values()].sort((a, b) => Number(b.collaborator) - Number(a.collaborator) || a.name.localeCompare(b.name));
}

export function eligibleOpportunityPeople(people: OpportunityPerson[], mutualOnly: boolean) {
  return people.filter((person) => person.collaborator || !mutualOnly || person.mutual);
}