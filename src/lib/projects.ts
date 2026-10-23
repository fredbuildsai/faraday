/** Pure rules for shared (collaborative) opportunities. */
export const PROJECT_STATUSES = ["idea", "drafting", "submitted", "funded", "closed"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type MemberRole = "owner" | "editor";
export type MemberState = "invited" | "accepted" | "declined";

/** Classical scientific article structure; every new opportunity gets these draft sections. */
export const DEFAULT_SECTIONS = [
  { key: "abstract", title: "Abstract" },
  { key: "introduction", title: "Introduction" },
  { key: "experimental", title: "Experimental" },
  { key: "results", title: "Results and discussion" },
  { key: "conclusions", title: "Conclusions" },
] as const;
export const MANUSCRIPT_KEYS: readonly string[] = DEFAULT_SECTIONS.map((s) => s.key);

/** Contributor roles offered by default (CRediT taxonomy). Custom roles are added per opportunity. */
export const CREDIT_ROLES = [
  "Conceptualization", "Methodology", "Investigation", "Formal analysis", "Data curation", "Software",
  "Validation", "Visualization", "Resources", "Writing – original draft", "Writing – review & editing",
  "Supervision", "Project administration", "Funding acquisition",
] as const;

/** Default roles first, then saved custom roles; trimmed, case-insensitive duplicates removed. */
export function allRoles(custom: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of [...CREDIT_ROLES, ...(Array.isArray(custom) ? custom : [])]) {
    const v = String(r ?? "").trim().slice(0, 80);
    if (!v || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase()); out.push(v);
  }
  return out;
}

/** Adds a custom role unless it is empty or already offered. Returns the new custom list. */
export function addCustomRole(custom: unknown, role: string): string[] {
  const list = Array.isArray(custom) ? custom.map(String) : [];
  const v = role.trim().slice(0, 80);
  if (!v || allRoles(list).some((r) => r.toLowerCase() === v.toLowerCase())) return list;
  return [...list, v];
}

export const STATUS_LABEL: Record<ProjectStatus, string> = { idea: "Idea", drafting: "Drafting", submitted: "Submitted", funded: "Funded", closed: "Closed" };

/** Accepted members edit and comment; only owners manage people, archive and delete. */
export function can(member: { role: MemberRole; state: MemberState } | null | undefined, action: "view" | "edit" | "comment" | "invite" | "remove" | "archive" | "delete" | "transfer") {
  if (!member || member.state !== "accepted") return false;
  if (action === "view" || action === "edit" || action === "comment") return true;
  return member.role === "owner";
}

/** Only the caller's Faraday matches can be invited; nobody twice, never yourself. */
export function invitable(requested: string[], allowedMatchIds: string[], existingMemberIds: string[], self: string) {
  const allowed = new Set(allowedMatchIds);
  const existing = new Set(existingMemberIds);
  return [...new Set(requested)].filter((id) => id !== self && allowed.has(id) && !existing.has(id));
}

/** A save is a conflict when someone else saved since the editor loaded the section. */
export function isConflict(loadedVersion: number, currentVersion: number) {
  return loadedVersion !== currentVersion;
}

/** Members tagged as "@First Last" in a comment (longest names first, never yourself). */
export function parseMentions(text: string, people: { user_id: string; name: string }[], self?: string | null): string[] {
  const lower = text.toLowerCase();
  const ids = new Set<string>();
  for (const p of [...people].sort((a, b) => b.name.length - a.name.length)) {
    if (p.user_id !== self && p.name && lower.includes("@" + p.name.toLowerCase())) ids.add(p.user_id);
  }
  return [...ids];
}

/** Where a comment was posted, for the Discussion tab. */
export function commentSource(c: { section_id?: string | null; paper_id?: string | null; item_id?: string | null; reference_id?: string | null }, lookup: {
  sections: { id: string; title: string }[]; papers: { id: string; title: string }[];
  items: { id: string; kind: string; title: string }[]; references: { id: string; title: string }[];
}): { kind: "general" | "section" | "paper" | "aim" | "question" | "reference"; label: string } {
  const find = <T extends { id: string }>(xs: T[], id: string | null | undefined) => (id ? xs.find((x) => x.id === id) : undefined);
  const s = find(lookup.sections, c.section_id); if (c.section_id) return { kind: "section", label: `Draft: ${s?.title ?? "removed section"}` };
  const i = find(lookup.items, c.item_id); if (c.item_id) return { kind: i?.kind === "question" ? "question" : "aim", label: `${i?.kind === "question" ? "Open question" : "Aim"}: ${i?.title ?? "removed"}` };
  const p = find(lookup.papers, c.paper_id); if (c.paper_id) return { kind: "paper", label: `Paper: ${p?.title ?? "removed"}` };
  const r = find(lookup.references, c.reference_id); if (c.reference_id) return { kind: "reference", label: `Reference: ${r?.title ?? "removed"}` };
  return { kind: "general", label: "General" };
}

export type ExportRef = { title: string; authors: string; year: number | null; venue: string; doi: string; url: string | null };
export type ExportInput = {
  title: string; description: string; status: ProjectStatus;
  people: { name: string; role: string; contributions?: string[] }[];
  sections: { title: string; body: string }[];
  aims?: { title: string; body: string; resolved: boolean }[];
  questions?: { title: string; body: string; resolved: boolean }[];
  references?: ExportRef[];
  papers: { title: string; url: string | null }[];
};

export function citation(r: ExportRef) {
  const parts = [r.authors.trim(), r.year ? `(${r.year})` : "", r.title.trim() + ".", r.venue.trim() ? r.venue.trim() + "." : "", r.doi ? `https://doi.org/${r.doi.replace(/^https?:\/\/doi\.org\//i, "")}` : r.url ?? ""];
  return parts.filter(Boolean).join(" ");
}

/** One ordered outline shared by every export format. */
export function exportOutline(p: ExportInput) {
  const blocks: { heading?: string; level?: 1 | 2; lines: string[]; list?: boolean; numbered?: boolean }[] = [];
  blocks.push({ heading: p.title, level: 1, lines: [`Status: ${STATUS_LABEL[p.status]}`, ...(p.description.trim() ? [p.description.trim()] : [])] });
  blocks.push({ heading: "Contributors", level: 2, list: true, lines: p.people.map((x) => `${x.name}${x.contributions?.length ? ` — ${x.contributions.join(", ")}` : ""}`) });
  for (const s of p.sections) blocks.push({ heading: s.title, level: 2, lines: [s.body.trim() || "Not written yet."] });
  const items = (label: string, xs?: ExportInput["aims"]) => { if (xs?.length) blocks.push({ heading: label, level: 2, list: true, lines: xs.map((x) => `${x.title}${x.resolved ? " (resolved)" : ""}${x.body.trim() ? `: ${x.body.trim()}` : ""}`) }); };
  items("Aims", p.aims); items("Open questions", p.questions);
  if (p.references?.length) blocks.push({ heading: "References", level: 2, numbered: true, lines: p.references.map(citation) });
  if (p.papers.length) blocks.push({ heading: "Evidence papers", level: 2, list: true, lines: p.papers.map((w) => w.url ? `${w.title} (${w.url})` : w.title) });
  return blocks;
}

export function proposalMarkdown(p: ExportInput) {
  const out: string[] = [];
  for (const b of exportOutline(p)) {
    if (b.heading) out.push(`${b.level === 1 ? "#" : "##"} ${b.heading}`, "");
    b.lines.forEach((l, i) => out.push(b.numbered ? `${i + 1}. ${l}` : b.list ? `- ${l}` : l));
    out.push("");
  }
  return out.join("\n");
}

export function proposalText(p: ExportInput) {
  const out: string[] = [];
  for (const b of exportOutline(p)) {
    if (b.heading) out.push(b.level === 1 ? b.heading.toUpperCase() : b.heading, "=".repeat(Math.min(b.heading.length, 70)), "");
    b.lines.forEach((l, i) => out.push(b.numbered ? `[${i + 1}] ${l}` : b.list ? `* ${l}` : l));
    out.push("");
  }
  return out.join("\n");
}

/** Everything a saved opportunity carries over when it becomes a shared one. */
export function fromSaved(row: { id: string; notes?: string | null; snapshot: unknown }) {
  const s = (row.snapshot ?? {}) as any;
  const ev = (Array.isArray(s.evidence) ? s.evidence : []) as any[];
  const closest = (Array.isArray(s.whitespace?.closest) ? s.whitespace.closest : []) as any[];
  const people = [...(s.pis ?? []), ...(s.collaborators ?? []), ...(s.potential ?? [])] as { id: string; name: string }[];
  const seen = new Set<string>();
  return {
    title: String(s.title ?? ""),
    description: String(s.description ?? ""),
    notes: String(row.notes ?? ""),
    whitespace: s.whitespace ?? null,
    papers: [
      ...ev.map((w) => ({ openalexId: String(w.id), title: String(w.title), url: w.url ?? null, isOa: !!w.isOa, origin: "evidence" as const })),
      ...closest.map((w) => ({ openalexId: String(w.id), title: String(w.title), url: w.url ?? null, isOa: false, origin: "prior_art" as const })),
    ].filter((w) => w.openalexId && !seen.has(w.openalexId) && seen.add(w.openalexId)),
    people: people.filter((x, i) => x?.id && people.findIndex((y) => y.id === x.id) === i).map((x) => ({ id: x.id, name: x.name })),
    source: { savedOpportunityId: row.id, snapshot: row.snapshot },
  };
}

const ACTIONS: Record<string, (d: any) => string> = {
  created: () => "created the opportunity",
  invited: (d) => `invited ${d.name ?? "someone"}`,
  joined: () => "joined",
  declined: () => "declined the invitation",
  left: () => "left",
  removed: (d) => `removed ${d.name ?? "someone"}`,
  role: (d) => `made ${d.name ?? "someone"} ${d.role}`,
  ownership: () => "transferred ownership",
  status: (d) => `changed status to ${STATUS_LABEL[d.to as ProjectStatus] ?? d.to}`,
  archived: () => "archived the opportunity",
  unarchived: () => "restored the opportunity",
  details: () => "edited the title or description",
  paper_added: (d) => `added paper “${d.title}”`,
  paper_removed: (d) => `removed paper “${d.title}”`,
  section_edited: (d) => `edited “${d.section}” (version ${d.version})`,
  commented: (d) => `commented: “${d.excerpt}”`,
  comment_resolved: () => "resolved a comment",
  comment_reopened: () => "reopened a comment",
  task_added: (d) => `added task “${d.title}”`,
  task_done: (d) => `completed task “${d.title}”`,
  task_reopened: (d) => `reopened task “${d.title}”`,
  task_removed: (d) => `removed task “${d.title}”`,
  item_added: (d) => `added ${d.kind === "question" ? "open question" : "aim"} “${d.title}”`,
  item_resolved: (d) => `resolved ${d.kind === "question" ? "open question" : "aim"} “${d.title}”`,
  item_reopened: (d) => `reopened ${d.kind === "question" ? "open question" : "aim"} “${d.title}”`,
  item_removed: (d) => `removed ${d.kind === "question" ? "open question" : "aim"} “${d.title}”`,
  reference_added: (d) => `added reference “${d.title}”`,
  reference_removed: (d) => `removed reference “${d.title}”`,
  contribution_added: (d) => `gave ${d.name ?? "someone"} the role “${d.role}”`,
  contribution_removed: (d) => `removed the role “${d.role}” from ${d.name ?? "someone"}`,
};
export function describeActivity(action: string, detail: unknown) {
  return (ACTIONS[action] ?? (() => action))(detail ?? {});
}
