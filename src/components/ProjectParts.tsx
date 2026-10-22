import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, MessageSquare, Plus, Search, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PaperDialog } from "@/components/PaperDialog";
import type { ProjectData } from "@/lib/projects-queries";
import { addCustomRole, allRoles, citation, commentSource, parseMentions } from "@/lib/projects";
import { searchReferences } from "@/lib/projects.functions";

type NameOf = (id: string | null) => string;
const when = (d: string) => new Date(d).toLocaleString();
export type CommentTarget = { section_id?: string; paper_id?: string; item_id?: string; reference_id?: string };

/** Comment body with "@Name" mentions highlighted. */
function MentionText({ body, names }: { body: string; names: string[] }) {
  const sorted = names.filter(Boolean).sort((a, b) => b.length - a.length);
  if (!sorted.length) return <>{body}</>;
  const esc = sorted.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = body.split(new RegExp(`(@(?:${esc.join("|")}))`, "gi"));
  return <>{parts.map((p, i) => p.startsWith("@") && sorted.some((n) => p.slice(1).toLowerCase() === n.toLowerCase()) ? <span key={i} className="rounded bg-primary/10 px-1 font-medium text-primary">{p}</span> : <span key={i}>{p}</span>)}</>;
}

/** Textarea that offers member names after typing "@". */
function MentionInput({ value, onChange, people, placeholder }: { value: string; onChange: (v: string) => void; people: { user_id: string; name: string }[]; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState(0);
  const before = value.slice(0, caret);
  const m = before.match(/@([^@\n]{0,30})$/);
  const raw = m?.[1]?.toLowerCase() ?? "";
  // Once a full name was picked (or typed) and followed by text, the suggestion box closes.
  const done = people.some((p) => raw.startsWith(p.name.toLowerCase() + " ") || raw === p.name.toLowerCase());
  const open = !!m && !done && !/\s{2}|\s\S+\s/.test(raw);
  const term = raw;
  const options = open ? people.filter((p) => p.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(term)) || p.name.toLowerCase().startsWith(term)).slice(0, 6) : [];
  const [active, setActive] = useState(0);
  function pick(name: string) {
    const start = caret - (m?.[0].length ?? 0);
    const next = `${value.slice(0, start)}@${name} ${value.slice(caret)}`;
    onChange(next);
    const pos = start + name.length + 2;
    setCaret(pos);
    requestAnimationFrame(() => { ref.current?.focus(); ref.current?.setSelectionRange(pos, pos); });
  }
  return (
    <div className="relative">
      <Textarea ref={ref} value={value} rows={2} placeholder={placeholder ?? "Write a comment. Type @ to tag someone."}
        onChange={(e) => { onChange(e.target.value); setCaret(e.target.selectionStart); }}
        onKeyDown={(e) => {
          if (!options.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % options.length); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + options.length) % options.length); }
          else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(options[Math.min(active, options.length - 1)]!.name); setActive(0); }
        }}
        onKeyUp={(e) => { if (!["ArrowDown", "ArrowUp", "Enter", "Tab"].includes(e.key)) setCaret(e.currentTarget.selectionStart); }} onClick={(e) => setCaret(e.currentTarget.selectionStart)} />
      {!!options.length && (
        <ul className="absolute z-20 mt-1 w-64 rounded-md border bg-popover p-1 text-sm shadow-md" role="listbox" aria-label="Tag a collaborator">
          {options.map((p, i) => <li key={p.user_id}><button type="button" className={`w-full rounded px-2 py-1 text-left hover:bg-accent ${i === active ? "bg-accent" : ""}`} onMouseDown={(e) => { e.preventDefault(); pick(p.name); }}>@{p.name}</button></li>)}
        </ul>
      )}
      {open && !raw.includes(" ") && !options.length && <p className="absolute z-20 mt-1 rounded-md border bg-popover px-3 py-2 text-xs text-muted-foreground shadow-md">{people.length ? "No collaborator with that name." : "Invite people to this opportunity to tag them."}</p>}
    </div>
  );
}

export function Comments({ data, id, target, nameOf, me, onSaved }: { data: ProjectData; id: string; target: CommentTarget; nameOf: NameOf; me: string | null; onSaved: () => void }) {
  const [text, setText] = useState("");
  const [showResolved, setShowResolved] = useState(false);
  const [filter, setFilter] = useState("all");
  const general = !target.section_id && !target.paper_id && !target.item_id && !target.reference_id;
  // Invited people can be tagged too: they get the notification and see it once they join.
  const members = data.people.filter((p) => p.state === "accepted" || p.state === "invited");
  const lookup = { sections: data.sections, papers: data.papers, items: data.items, references: data.references };
  const list = data.comments.filter((c: any) => general ? true : target.section_id ? c.section_id === target.section_id : target.paper_id ? c.paper_id === target.paper_id : target.item_id ? c.item_id === target.item_id : c.reference_id === target.reference_id);
  const shown = list.filter((c) => (showResolved || !c.resolved) && (filter === "all" || commentSource(c, lookup).kind === filter));
  async function add() {
    if (!me) return;
    const mentions = parseMentions(text, members, me);
    const { error } = await supabase.from("project_comments").insert({ project_id: id, body: text.trim(), author_id: me, mentions, ...target });
    if (error) toast.error("Could not post."); else { setText(""); if (mentions.length) toast.success(`Tagged ${mentions.map((u) => nameOf(u)).join(", ")}`); onSaved(); }
  }
  async function resolve(cid: string, resolved: boolean) { await supabase.from("project_comments").update({ resolved }).eq("id", cid); onSaved(); }
  return (
    <div className="space-y-3">
      <div className="space-y-2"><MentionInput value={text} onChange={setText} people={members.filter((p) => p.user_id !== me)} /><Button size="sm" onClick={add} disabled={!text.trim()}>Comment</Button></div>
      <div className="flex flex-wrap items-center gap-3">
        {general && (
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-8 w-48" aria-label="Show comments from"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">From everywhere</SelectItem><SelectItem value="general">General</SelectItem><SelectItem value="section">Draft sections</SelectItem>
              <SelectItem value="aim">Aims</SelectItem><SelectItem value="question">Open questions</SelectItem><SelectItem value="paper">Papers</SelectItem><SelectItem value="reference">References</SelectItem>
            </SelectContent>
          </Select>
        )}
        {list.some((c) => c.resolved) && <label className="flex items-center gap-2 text-xs text-muted-foreground"><Checkbox checked={showResolved} onCheckedChange={(v) => setShowResolved(!!v)} /> Show resolved</label>}
      </div>
      <ul className="space-y-2">{shown.map((c) => {
        const src = commentSource(c, lookup);
        const tagged = (c.mentions ?? []).includes(me ?? "");
        return (
          <li key={c.id} className={`rounded-lg border p-3 text-sm ${c.resolved ? "opacity-60" : ""} ${tagged ? "border-primary/50" : ""}`}>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="flex flex-wrap items-center gap-2">
                {general && <Badge variant={src.kind === "general" ? "outline" : "secondary"} className="max-w-72 truncate">{src.label}</Badge>}
                <span className="font-medium text-foreground">{nameOf(c.author_id)}</span> · {when(c.created_at)}
                {tagged && <Badge>Mentions you</Badge>}
              </span>
              <Button size="sm" variant="ghost" onClick={() => resolve(c.id, !c.resolved)}>{c.resolved ? "Reopen" : <><Check className="h-3.5 w-3.5" /> Resolve</>}</Button>
            </div>
            <p className="whitespace-pre-wrap"><MentionText body={c.body} names={members.map((m) => m.name)} /></p>
          </li>
        );
      })}</ul>
      {!shown.length && <p className="text-sm text-muted-foreground">No comments yet.</p>}
    </div>
  );
}

function CommentsButton({ data, id, target, title, nameOf, me, onSaved }: { data: ProjectData; id: string; target: CommentTarget; title: string; nameOf: NameOf; me: string | null; onSaved: () => void }) {
  const key = Object.keys(target)[0] as keyof CommentTarget;
  const count = data.comments.filter((c: any) => c[key] === target[key] && !c.resolved).length;
  return (
    <Dialog>
      <DialogTrigger asChild><Button size="sm" variant="ghost" aria-label={`Comments on ${title}`}><MessageSquare className="h-4 w-4" />{count || ""}</Button></DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto"><DialogHeader><DialogTitle>Comments on “{title}”</DialogTitle></DialogHeader><Comments data={data} id={id} target={target} nameOf={nameOf} me={me} onSaved={onSaved} /></DialogContent>
    </Dialog>
  );
}
export { CommentsButton };

/** Who does what: CRediT roles plus custom roles saved on the opportunity. */
export function Contributors({ data, id, editable, onSaved }: { data: ProjectData; id: string; editable: boolean; onSaved: () => void }) {
  const [newRole, setNewRole] = useState("");
  const custom = (data.project?.custom_roles ?? []) as string[];
  const roles = allRoles(custom);
  const members = data.people.filter((p) => p.state === "accepted");
  const has = (uid: string, role: string) => data.contributions.some((c) => c.user_id === uid && c.role === role);
  async function toggle(uid: string, role: string, on: boolean) {
    const q = on ? supabase.from("project_contributions").insert({ project_id: id, user_id: uid, role })
      : supabase.from("project_contributions").delete().eq("project_id", id).eq("user_id", uid).eq("role", role);
    const { error } = await q;
    if (error) toast.error("Could not update the role."); else onSaved();
  }
  async function saveRole(e: React.FormEvent) {
    e.preventDefault();
    const next = addCustomRole(custom, newRole);
    if (next.length === custom.length) { toast.info("That role is already in the list."); return; }
    const { error } = await supabase.from("projects").update({ custom_roles: next }).eq("id", id);
    if (error) toast.error("Could not save the role."); else { setNewRole(""); toast.success("Role saved for this opportunity"); onSaved(); }
  }
  async function removeRole(role: string) {
    if (data.contributions.some((c) => c.role === role)) { toast.info("Unassign this role from everyone first."); return; }
    await supabase.from("projects").update({ custom_roles: custom.filter((r) => r !== role) }).eq("id", id); onSaved();
  }
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">Tick each person's role in the paper or project. Roles follow the CRediT contributor taxonomy; add your own when needed.</p>
      <div className="space-y-3">{members.map((m) => {
        const mine = roles.filter((r) => has(m.user_id, r));
        return (
          <section key={m.user_id} className="rounded-xl border bg-card p-4">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2"><p className="font-medium">{m.name}</p><p className="text-xs text-muted-foreground">{mine.length ? mine.join(" · ") : "No role yet"}</p></div>
            <div className="flex flex-wrap gap-2">{roles.map((r) => {
              const on = has(m.user_id, r);
              return <button key={r} type="button" disabled={!editable} aria-pressed={on} onClick={() => toggle(m.user_id, r, !on)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${on ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent"} disabled:opacity-60`}>{r}</button>;
            })}</div>
          </section>
        );
      })}</div>
      {editable && (
        <div className="space-y-2 rounded-xl border bg-card p-4">
          <form onSubmit={saveRole} className="flex gap-2"><Input value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder="New role, e.g. Cell assembly" maxLength={80} aria-label="New role" /><Button type="submit" variant="outline" disabled={!newRole.trim()}><Plus className="h-4 w-4" /> Add role</Button></form>
          {!!custom.length && <div className="flex flex-wrap gap-2 text-xs">{custom.map((r) => <span key={r} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">{r}<button type="button" aria-label={`Remove role ${r}`} onClick={() => removeRole(r)}><X className="h-3 w-3" /></button></span>)}</div>}
        </div>
      )}
    </div>
  );
}

/** Aims and open questions: separate items, each with its own comment thread. */
export function Items({ data, id, kind, editable, nameOf, me, onSaved }: { data: ProjectData; id: string; kind: "aim" | "question"; editable: boolean; nameOf: NameOf; me: string | null; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [showResolved, setShowResolved] = useState(false);
  const all = data.items.filter((i) => i.kind === kind);
  const list = all.filter((i) => showResolved || !i.resolved);
  const word = kind === "aim" ? "aim" : "open question";
  async function add(e: React.FormEvent) {
    e.preventDefault(); if (!me) return;
    const { error } = await supabase.from("project_items").insert({ project_id: id, kind, title: title.trim(), body: body.trim(), created_by: me });
    if (error) toast.error(`Could not add the ${word}.`); else { setTitle(""); setBody(""); onSaved(); }
  }
  async function resolve(iid: string, resolved: boolean) { await supabase.from("project_items").update({ resolved }).eq("id", iid); onSaved(); }
  async function remove(iid: string) { await supabase.from("project_items").delete().eq("id", iid); onSaved(); }
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between"><h2 className="font-serif text-xl">{kind === "aim" ? "Aims" : "Open questions"}</h2>
        {all.some((i) => i.resolved) && <label className="flex items-center gap-2 text-xs text-muted-foreground"><Checkbox checked={showResolved} onCheckedChange={(v) => setShowResolved(!!v)} /> Show resolved</label>}</div>
      <ul className="space-y-2">{list.map((i, n) => (
        <li key={i.id} className={`rounded-lg border bg-card p-3 text-sm ${i.resolved ? "opacity-60" : ""}`}>
          <div className="flex items-start justify-between gap-2">
            <div><p className="font-medium">{kind === "aim" ? `Aim ${n + 1}: ` : ""}{i.title}</p>{i.body && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{i.body}</p>}<p className="mt-1 text-xs text-muted-foreground">{nameOf(i.created_by)} · {when(i.created_at)}</p></div>
            <div className="flex shrink-0">
              <CommentsButton data={data} id={id} target={{ item_id: i.id }} title={i.title} nameOf={nameOf} me={me} onSaved={onSaved} />
              {editable && <Button size="sm" variant="ghost" onClick={() => resolve(i.id, !i.resolved)}>{i.resolved ? "Reopen" : <><Check className="h-3.5 w-3.5" /> Resolve</>}</Button>}
              {editable && <Button size="sm" variant="ghost" aria-label={`Remove ${word}`} onClick={() => remove(i.id)}><Trash2 className="h-4 w-4" /></Button>}
            </div>
          </div>
        </li>
      ))}</ul>
      {!list.length && <p className="text-sm text-muted-foreground">No {word}s yet.</p>}
      {editable && (
        <form onSubmit={add} className="space-y-2 rounded-xl border bg-card p-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === "aim" ? "New aim" : "New open question"} maxLength={300} aria-label={`New ${word}`} />
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Details (optional)" />
          <Button type="submit" size="sm" disabled={!title.trim()}><Plus className="h-4 w-4" /> Add {word}</Button>
        </form>
      )}
    </section>
  );
}

const emptyRef = { title: "", authors: "", year: "", venue: "", doi: "", url: "" };

/** Bibliography for the draft: from an OpenAlex search or typed in by hand. */
export function References({ data, id, editable, nameOf, me, onSaved }: { data: ProjectData; id: string; editable: boolean; nameOf: NameOf; me: string | null; onSaved: () => void }) {
  const search = useServerFn(searchReferences);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchReferences>>>([]);
  const [manual, setManual] = useState(emptyRef);
  const have = new Set(data.references.map((r) => r.openalex_id).filter(Boolean));
  async function run(e: React.FormEvent) {
    e.preventDefault(); if (q.trim().length < 2) return;
    setBusy(true);
    try { const r = await search({ data: { projectId: id, q } }); setResults(r); if (!r.length) toast.info("Nothing found on OpenAlex."); } catch { toast.error("Could not search OpenAlex."); } finally { setBusy(false); }
  }
  async function insert(row: { openalex_id: string | null; title: string; authors: string; year: number | null; venue: string; doi: string; url: string | null }) {
    if (!me) return false;
    const { error } = await supabase.from("project_references").insert({ project_id: id, added_by: me, ...row });
    if (error) { toast.error(error.code === "23505" ? "Already in the references." : "Could not add the reference."); return false; }
    onSaved(); return true;
  }
  async function addManual(e: React.FormEvent) {
    e.preventDefault();
    const year = manual.year ? Number(manual.year) : null;
    if (await insert({ openalex_id: null, title: manual.title.trim(), authors: manual.authors.trim(), year: Number.isFinite(year) ? year : null, venue: manual.venue.trim(), doi: manual.doi.trim().replace(/^https?:\/\/doi\.org\//i, ""), url: manual.url.trim() || null })) setManual(emptyRef);
  }
  async function remove(rid: string) { await supabase.from("project_references").delete().eq("id", rid); onSaved(); }
  const set = (k: keyof typeof emptyRef) => (e: React.ChangeEvent<HTMLInputElement>) => setManual({ ...manual, [k]: e.target.value });
  return (
    <section className="space-y-3">
      <h2 className="font-serif text-xl">References</h2>
      <ol className="space-y-2">{data.references.map((r, i) => (
        <li key={r.id} className="flex items-start justify-between gap-3 rounded-lg border bg-card p-3 text-sm">
          <div><span className="mr-1 text-muted-foreground">[{i + 1}]</span>{r.url ? <PaperDialog href={r.url} title={citation({ ...r, url: null })} /> : citation(r)}<p className="text-xs text-muted-foreground">{r.openalex_id ? "From OpenAlex" : "Added by hand"} · {nameOf(r.added_by)}</p></div>
          <div className="flex shrink-0">
            <CommentsButton data={data} id={id} target={{ reference_id: r.id }} title={r.title} nameOf={nameOf} me={me} onSaved={onSaved} />
            {editable && <Button size="sm" variant="ghost" aria-label="Remove reference" onClick={() => remove(r.id)}><X className="h-4 w-4" /></Button>}
          </div>
        </li>
      ))}</ol>
      {!data.references.length && <p className="text-sm text-muted-foreground">No references yet.</p>}
      {editable && (
        <div className="space-y-4 rounded-xl border bg-card p-4">
          <form onSubmit={run} className="flex gap-2"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search OpenAlex by title, keywords or DOI" aria-label="Search references" /><Button type="submit" variant="outline" disabled={busy}><Search className="h-4 w-4" />{busy ? "Searching…" : "Search"}</Button></form>
          {!!results.length && <ul className="max-h-72 space-y-1 overflow-y-auto text-sm">{results.map((r) => (
            <li key={r.openalexId} className="flex items-start justify-between gap-2">
              <span>{citation(r)}</span>
              {have.has(r.openalexId) ? <span className="text-xs text-muted-foreground">Added</span> : <Button size="sm" variant="ghost" onClick={() => insert({ openalex_id: r.openalexId, title: r.title, authors: r.authors, year: r.year, venue: r.venue, doi: r.doi, url: r.url })}>Add</Button>}
            </li>
          ))}</ul>}
          <form onSubmit={addManual} className="space-y-2 border-t pt-3">
            <p className="text-sm font-medium">Add by hand</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2"><Label htmlFor="ref-title">Title</Label><Input id="ref-title" value={manual.title} onChange={set("title")} required /></div>
              <div className="space-y-1"><Label htmlFor="ref-authors">Authors</Label><Input id="ref-authors" value={manual.authors} onChange={set("authors")} placeholder="Smith J, Lee K" /></div>
              <div className="space-y-1"><Label htmlFor="ref-year">Year</Label><Input id="ref-year" type="number" value={manual.year} onChange={set("year")} /></div>
              <div className="space-y-1"><Label htmlFor="ref-venue">Journal or source</Label><Input id="ref-venue" value={manual.venue} onChange={set("venue")} /></div>
              <div className="space-y-1"><Label htmlFor="ref-doi">DOI</Label><Input id="ref-doi" value={manual.doi} onChange={set("doi")} placeholder="10.1000/xyz" /></div>
              <div className="space-y-1 sm:col-span-2"><Label htmlFor="ref-url">Link (optional)</Label><Input id="ref-url" value={manual.url} onChange={set("url")} /></div>
            </div>
            <Button type="submit" size="sm" disabled={!manual.title.trim()}><Plus className="h-4 w-4" /> Add reference</Button>
          </form>
        </div>
      )}
    </section>
  );
}
