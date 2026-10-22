/** Pure rules for shared (collaborative) opportunities. */
export const PROJECT_STATUSES = ["idea", "drafting", "submitted", "funded", "closed"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type MemberRole = "owner" | "editor";
export type MemberState = "invited" | "accepted" | "declined";

export const DEFAULT_SECTIONS = [
  { key: "aims", title: "Aims" },
  { key: "approach", title: "Approach" },
  { key: "roles", title: "Who does what" },
  { key: "questions", title: "Open questions" },
] as const;

export const STATUS_LABEL: Record<ProjectStatus, string> = { idea: "Idea", drafting: "Drafting", submitted: "Submitted", funded: "Funded", closed: "Closed" };

/** Accepted members edit and comment; only owners manage people, archive and delete. */
export function can(member: { role: MemberRole; state: MemberState } | null | undefined, action: "view" | "edit" | "comment" | "invite" | "remove" | "archive" | "delete" | "transfer") {
  if (!member || member.state !== "accepted") return false;
  if (action === "view" || action === "edit" || action === "comment") return true;
  return member.role === "owner";
}

/** Only the caller's Lattice Scout matches can be invited; nobody twice, never yourself. */
export function invitable(requested: string[], allowedMatchIds: string[], existingMemberIds: string[], self: string) {
  const allowed = new Set(allowedMatchIds);
  const existing = new Set(existingMemberIds);
  return [...new Set(requested)].filter((id) => id !== self && allowed.has(id) && !existing.has(id));
}

/** A save is a conflict when someone else saved since the editor loaded the section. */
export function isConflict(loadedVersion: number, currentVersion: number) {
  return loadedVersion !== currentVersion;
}

export function proposalMarkdown(p: {
  title: string; description: string; status: ProjectStatus;
  people: { name: string; role: string }[]; sections: { title: string; body: string }[];
  papers: { title: string; url: string | null }[];
}) {
  const lines = [`# ${p.title}`, "", `Status: ${STATUS_LABEL[p.status]}`, "", p.description, "", "## Team", ...p.people.map((x) => `- ${x.name} (${x.role})`), ""];
  for (const s of p.sections) lines.push(`## ${s.title}`, "", s.body.trim() || "_Not written yet._", "");
  lines.push("## Evidence papers", ...p.papers.map((w) => `- ${w.url ? `[${w.title}](${w.url})` : w.title}`), "");
  return lines.join("\n");
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
};
export function describeActivity(action: string, detail: unknown) {
  return (ACTIONS[action] ?? (() => action))(detail ?? {});
}
