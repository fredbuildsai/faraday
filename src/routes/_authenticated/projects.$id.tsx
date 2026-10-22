import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Download, History, MessageSquare, Search, Sparkles, Trash2, UserPlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { OaBadge } from "@/components/OaBadge";
import { PaperDialog } from "@/components/PaperDialog";
import { OpenAlexDialog } from "@/components/OpenAlexDialog";
import { projectQuery } from "@/lib/projects-queries";
import { PROJECT_STATUSES, STATUS_LABEL, can, describeActivity, proposalMarkdown, type MemberRole, type MemberState, type ProjectStatus } from "@/lib/projects";
import { findSimilarPapers, inviteToProject, searchMemberPapers } from "@/lib/projects.functions";
import { getOpportunityPeople } from "@/lib/opportunities.functions";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  head: () => ({ meta: [
    { title: "Shared opportunity — Lattice Scout" },
    { name: "description", content: "Work on a research proposal together: sections, evidence papers, comments, tasks and history." },
    { property: "og:title", content: "Shared opportunity — Lattice Scout" },
    { property: "og:description", content: "Work on a research proposal together: sections, evidence papers, comments, tasks and history." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(projectQuery(params.id)),
  component: ProjectPage,
});

type Data = Awaited<ReturnType<ReturnType<typeof projectQuery>["queryFn"] & {}>>;
const when = (d: string) => new Date(d).toLocaleString();

function ProjectPage() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(projectQuery(id));
  const qc = useQueryClient();
  const [me, setMe] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data: u }) => setMe(u.user?.id ?? null)); }, []);
  const refresh = () => qc.invalidateQueries({ queryKey: ["project", id] });
  // Opening the opportunity marks its updates as read.
  useEffect(() => { supabase.from("notifications").update({ read: true }).eq("project_id", id).eq("read", false).then(() => qc.invalidateQueries({ queryKey: ["notifications"] })); }, [id, qc]);

  if (!data.project) return <main className="mx-auto max-w-5xl px-6 py-10"><p className="text-muted-foreground">This opportunity does not exist or you are not a member. <Link to="/projects" className="text-primary hover:underline">Back to shared opportunities</Link></p></main>;
  const p = data.project;
  const mine = data.people.find((x) => x.user_id === me);
  const member = mine ? { role: mine.role as MemberRole, state: mine.state as MemberState } : null;
  const nameOf = (uid: string | null) => data.people.find((x) => x.user_id === uid)?.name ?? "Former member";

  if (member && member.state === "invited") return <main className="mx-auto max-w-5xl px-6 py-10"><p>You have been invited to “{p.title}”. <Link to="/projects" className="text-primary hover:underline">Accept or decline on Shared opportunities</Link>.</p></main>;
  const editable = can(member, "edit");

  async function setStatus(status: ProjectStatus) {
    const { error } = await supabase.from("projects").update({ status }).eq("id", id);
    if (error) toast.error("Could not change status."); else await refresh();
  }
  function exportDoc() {
    const md = proposalMarkdown({ title: p.title, description: p.description, status: p.status as ProjectStatus, people: data.people.filter((x) => x.state === "accepted").map((x) => ({ name: x.name, role: x.role })), sections: data.sections, papers: data.papers });
    const url = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${p.title.slice(0, 60).replace(/[^\w-]+/g, "-")}.md` });
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <Link to="/projects" className="text-sm text-muted-foreground hover:underline">← Shared opportunities</Link>
      <Details data={data} id={id} editable={editable} onSaved={refresh} />
      <div className="flex flex-wrap items-center gap-3">
        <Select value={p.status} onValueChange={(v) => setStatus(v as ProjectStatus)} disabled={!editable}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>{PROJECT_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
        </Select>
        {p.archived && <Badge variant="outline">Archived</Badge>}
        <Button variant="outline" size="sm" onClick={exportDoc}><Download className="h-4 w-4" /> Export proposal</Button>
      </div>

      <Tabs defaultValue="proposal">
        <TabsList className="flex-wrap">
          <TabsTrigger value="proposal">Proposal</TabsTrigger>
          <TabsTrigger value="papers">Papers ({data.papers.length})</TabsTrigger>
          <TabsTrigger value="discussion">Discussion ({data.comments.filter((c) => !c.resolved).length})</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({data.tasks.filter((t) => !t.done).length})</TabsTrigger>
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="proposal" className="space-y-4">{data.sections.map((s) => <SectionEditor key={s.id} s={s} data={data} editable={editable} nameOf={nameOf} onSaved={refresh} />)}</TabsContent>
        <TabsContent value="papers"><Papers data={data} id={id} editable={editable} nameOf={nameOf} onSaved={refresh} /></TabsContent>
        <TabsContent value="discussion"><Comments data={data} id={id} target={{}} nameOf={nameOf} onSaved={refresh} /></TabsContent>
        <TabsContent value="tasks"><Tasks data={data} id={id} nameOf={nameOf} onSaved={refresh} /></TabsContent>
        <TabsContent value="people"><People data={data} id={id} me={me} member={member} onSaved={refresh} /></TabsContent>
        <TabsContent value="history">
          <ul className="divide-y rounded-xl border bg-card text-sm">
            {data.activity.map((a) => <li key={a.id} className="flex justify-between gap-3 px-4 py-2.5"><span><span className="font-medium">{nameOf(a.actor_id)}</span> {describeActivity(a.action, a.detail)}</span><span className="shrink-0 text-xs text-muted-foreground">{when(a.created_at)}</span></li>)}
          </ul>
        </TabsContent>
      </Tabs>
    </main>
  );
}

function Details({ data, id, editable, onSaved }: { data: Data; id: string; editable: boolean; onSaved: () => void }) {
  const p = data.project!;
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(p.title);
  const [description, setDescription] = useState(p.description);
  async function save() {
    const { error } = await supabase.from("projects").update({ title, description }).eq("id", id);
    if (error) toast.error("Could not save."); else { setEditing(false); onSaved(); }
  }
  if (editing) return <div className="space-y-2"><Input value={title} onChange={(e) => setTitle(e.target.value)} className="font-serif text-2xl" /><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /><div className="flex gap-2"><Button size="sm" onClick={save} disabled={title.trim().length < 3}>Save</Button><Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button></div></div>;
  const suggested = (p.suggested_people as { id: string; name: string }[]) ?? [];
  return (
    <div className="space-y-2">
      <h1 className="font-serif text-3xl">{p.title}</h1>
      <p className="text-muted-foreground">{p.description}</p>
      {!!suggested.length && <p className="text-sm"><span className="font-medium">Suggested people outside Lattice Scout: </span>{suggested.map((s, i) => <span key={s.id}>{i ? ", " : ""}<OpenAlexDialog authorId={s.id} name={s.name} trigger={<button type="button" className="hover:underline">{s.name}</button>} /></span>)}</p>}
      {editable && <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Edit title and description</Button>}
    </div>
  );
}

function SectionEditor({ s, data, editable, nameOf, onSaved }: { s: Data["sections"][number]; data: Data; editable: boolean; nameOf: (id: string | null) => string; onSaved: () => void }) {
  const [body, setBody] = useState(s.body);
  const [base, setBase] = useState(s.version);
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (body === s.body || base === s.version) { setBody(s.body); setBase(s.version); } }, [s.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = body !== s.body || base !== s.version;
  const comments = data.comments.filter((c) => c.section_id === s.id && !c.resolved).length;

  async function save(text = body, version = base) {
    setBusy(true);
    const { error } = await supabase.rpc("save_project_section", { _section: s.id, _expected_version: version, _body: text });
    setBusy(false);
    if (error) { if (error.message.includes("conflict")) setConflict(true); else toast.error("Could not save."); return; }
    setConflict(false); toast.success(`“${s.title}” saved`); onSaved();
  }
  return (
    <section className="space-y-2 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif text-xl">{s.title}</h2>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {s.version > 0 && <span>v{s.version} · {nameOf(s.updated_by)} · {when(s.updated_at)}</span>}
          <Versions section={s} nameOf={nameOf} editable={editable} onRestore={(text) => { setBody(text); }} />
          <Dialog><DialogTrigger asChild><Button size="sm" variant="ghost"><MessageSquare className="h-4 w-4" />{comments || ""}</Button></DialogTrigger><DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto"><DialogHeader><DialogTitle>Comments on “{s.title}”</DialogTitle></DialogHeader><Comments data={data} id={s.project_id} target={{ section_id: s.id }} nameOf={nameOf} onSaved={onSaved} /></DialogContent></Dialog>
        </div>
      </div>
      {editable ? <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} placeholder="Not written yet." /> : <p className="whitespace-pre-wrap text-sm">{s.body || "Not written yet."}</p>}
      {conflict && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm">
          <p className="font-medium">Someone saved this section while you were editing.</p>
          <p className="text-muted-foreground">Their version is below. Copy anything you need from yours, then choose.</p>
          <p className="mt-2 whitespace-pre-wrap rounded bg-card p-2">{s.body || "(empty)"}</p>
          <div className="mt-2 flex gap-2"><Button size="sm" onClick={() => save(body, s.version)}>Keep mine (overwrite)</Button><Button size="sm" variant="outline" onClick={() => { setBody(s.body); setBase(s.version); setConflict(false); }}>Use theirs</Button></div>
        </div>
      )}
      {editable && dirty && !conflict && <div className="flex gap-2"><Button size="sm" onClick={() => save()} disabled={busy}>{busy ? "Saving…" : "Save section"}</Button><Button size="sm" variant="ghost" onClick={() => { setBody(s.body); setBase(s.version); }}>Discard</Button></div>}
    </section>
  );
}

function Versions({ section, nameOf, editable, onRestore }: { section: Data["sections"][number]; nameOf: (id: string | null) => string; editable: boolean; onRestore: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const versions = useQuery({ queryKey: ["section-versions", section.id, section.version], enabled: open, queryFn: async () => (await supabase.from("project_section_versions").select("*").eq("section_id", section.id).order("version", { ascending: false })).data ?? [] });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="ghost" aria-label="Version history"><History className="h-4 w-4" /></Button></DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader><DialogTitle>Versions of “{section.title}”</DialogTitle></DialogHeader>
        {!versions.data?.length ? <p className="text-sm text-muted-foreground">{versions.isLoading ? "Loading…" : "No saved versions yet."}</p> : (
          <ul className="space-y-3">{versions.data.map((v) => (
            <li key={v.id} className="rounded-lg border p-3 text-sm">
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground"><span>v{v.version} · {nameOf(v.edited_by)} · {when(v.created_at)}</span>{editable && v.version !== section.version && <Button size="sm" variant="outline" onClick={() => { onRestore(v.body); setOpen(false); toast.info("Restored into the editor. Save to keep it."); }}>Restore</Button>}</div>
              <p className="whitespace-pre-wrap">{v.body || "(empty)"}</p>
            </li>
          ))}</ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Comments({ data, id, target, nameOf, onSaved }: { data: Data; id: string; target: { section_id?: string; paper_id?: string }; nameOf: (id: string | null) => string; onSaved: () => void }) {
  const [text, setText] = useState("");
  const [showResolved, setShowResolved] = useState(false);
  const list = data.comments.filter((c) => (target.section_id ? c.section_id === target.section_id : target.paper_id ? c.paper_id === target.paper_id : true));
  const shown = list.filter((c) => showResolved || !c.resolved);
  const label = (c: Data["comments"][number]) => c.section_id ? data.sections.find((s) => s.id === c.section_id)?.title : c.paper_id ? data.papers.find((p) => p.id === c.paper_id)?.title : null;
  async function add() {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("project_comments").insert({ project_id: id, body: text.trim(), author_id: u.user!.id, ...target });
    if (error) toast.error("Could not post."); else { setText(""); onSaved(); }
  }
  async function resolve(cid: string, resolved: boolean) { await supabase.from("project_comments").update({ resolved }).eq("id", cid); onSaved(); }
  return (
    <div className="space-y-3">
      <div className="space-y-2"><Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Write a comment" /><Button size="sm" onClick={add} disabled={!text.trim()}>Comment</Button></div>
      {list.some((c) => c.resolved) && <label className="flex items-center gap-2 text-xs text-muted-foreground"><Checkbox checked={showResolved} onCheckedChange={(v) => setShowResolved(!!v)} /> Show resolved</label>}
      <ul className="space-y-2">{shown.map((c) => (
        <li key={c.id} className={`rounded-lg border p-3 text-sm ${c.resolved ? "opacity-60" : ""}`}>
          <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground"><span><span className="font-medium text-foreground">{nameOf(c.author_id)}</span> · {when(c.created_at)}{!target.section_id && !target.paper_id && label(c) ? ` · on “${label(c)}”` : ""}</span>
            <Button size="sm" variant="ghost" onClick={() => resolve(c.id, !c.resolved)}>{c.resolved ? "Reopen" : <><Check className="h-3.5 w-3.5" /> Resolve</>}</Button></div>
          <p className="whitespace-pre-wrap">{c.body}</p>
        </li>
      ))}</ul>
      {!shown.length && <p className="text-sm text-muted-foreground">No comments yet.</p>}
    </div>
  );
}

function Papers({ data, id, editable, nameOf, onSaved }: { data: Data; id: string; editable: boolean; nameOf: (id: string | null) => string; onSaved: () => void }) {
  const search = useServerFn(searchMemberPapers);
  const similar = useServerFn(findSimilarPapers);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ openalexId: string; title: string; url: string | null; isOa: boolean; year: number | null; owner?: string }[]>([]);
  const [heading, setHeading] = useState("");
  const [busy, setBusy] = useState(false);
  const have = new Set(data.papers.map((p) => p.openalex_id));
  const ws = data.project?.whitespace as { level: string; recentCount: number | null; query: string } | null;

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2) return;
    try { setResults(await search({ data: { q, projectId: id } })); setHeading("Members’ publications"); } catch { toast.error("Could not search."); }
  }
  async function runSimilar() {
    setBusy(true);
    try { const r = await similar({ data: { projectId: id } }); setResults(r.papers); setHeading(`Similar recent papers (search: “${r.query}”)`); onSaved(); if (!r.papers.length) toast.info("No new similar papers found."); }
    catch { toast.error("Could not look for similar papers."); } finally { setBusy(false); }
  }
  async function add(r: (typeof results)[number], origin: string) {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("project_papers").insert({ project_id: id, openalex_id: r.openalexId, title: r.title, url: r.url, is_oa: r.isOa, origin, added_by: u.user!.id });
    if (error) toast.error("Could not add."); else onSaved();
  }
  async function remove(pid: string) { await supabase.from("project_papers").delete().eq("id", pid); onSaved(); }

  return (
    <div className="space-y-5">
      <ul className="space-y-2">{data.papers.map((p) => (
        <li key={p.id} className="flex items-start justify-between gap-3 rounded-lg border bg-card p-3 text-sm">
          <div><PaperDialog href={p.url ?? p.openalex_id} title={p.title} className="text-primary" /> {p.is_oa && <OaBadge />}<p className="text-xs text-muted-foreground">{p.origin === "similar" ? "Found by similarity search" : "From members’ publications"} · added by {nameOf(p.added_by)}</p></div>
          <div className="flex shrink-0">
            <Dialog><DialogTrigger asChild><Button size="sm" variant="ghost" aria-label="Comments on paper"><MessageSquare className="h-4 w-4" />{data.comments.filter((c) => c.paper_id === p.id && !c.resolved).length || ""}</Button></DialogTrigger><DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto"><DialogHeader><DialogTitle>Comments on this paper</DialogTitle></DialogHeader><Comments data={data} id={id} target={{ paper_id: p.id }} nameOf={nameOf} onSaved={onSaved} /></DialogContent></Dialog>
            {editable && <Button size="sm" variant="ghost" aria-label="Remove paper" onClick={() => remove(p.id)}><X className="h-4 w-4" /></Button>}
          </div>
        </li>
      ))}</ul>
      {!data.papers.length && <p className="text-sm text-muted-foreground">No evidence papers yet.</p>}
      {editable && (
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap gap-2">
            <form onSubmit={runSearch} className="flex flex-1 gap-2"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search members’ publications by title" /><Button type="submit" variant="outline" size="icon" aria-label="Search"><Search className="h-4 w-4" /></Button></form>
            <Button variant="outline" onClick={runSimilar} disabled={busy}><Sparkles className="h-4 w-4" />{busy ? "Looking…" : "Find similar papers"}</Button>
          </div>
          {ws && <p className="text-xs text-muted-foreground">Whitespace: {ws.level === "underexplored" ? "potentially underexplored" : ws.level === "crowded" ? "well studied" : ws.level === "moderate" ? "moderately studied" : "unknown"} · {ws.recentCount ?? "?"} papers in the last 3 years for “{ws.query}” (OpenAlex)</p>}
          {!!results.length && <>
            <p className="text-sm font-medium">{heading}</p>
            <ul className="space-y-1 text-sm">{results.map((r) => (
              <li key={r.openalexId} className="flex items-start justify-between gap-2">
                <span><PaperDialog href={r.url ?? r.openalexId} title={r.title} /> <span className="text-xs text-muted-foreground">{[r.owner, r.year].filter(Boolean).join(" · ")}</span> {r.isOa && <OaBadge />}</span>
                {have.has(r.openalexId) ? <span className="text-xs text-muted-foreground">Added</span> : <Button size="sm" variant="ghost" onClick={() => add(r, heading.startsWith("Similar") ? "similar" : "member")}>Add</Button>}
              </li>
            ))}</ul>
          </>}
        </div>
      )}
    </div>
  );
}

function Tasks({ data, id, nameOf, onSaved }: { data: Data; id: string; nameOf: (id: string | null) => string; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("none");
  const [due, setDue] = useState("");
  const members = data.people.filter((p) => p.state === "accepted");
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("project_tasks").insert({ project_id: id, title: title.trim(), assignee_id: assignee === "none" ? null : assignee, due_date: due || null, created_by: u.user!.id });
    if (error) toast.error("Could not add task."); else { setTitle(""); setDue(""); setAssignee("none"); onSaved(); }
  }
  async function toggle(tid: string, done: boolean) { await supabase.from("project_tasks").update({ done }).eq("id", tid); onSaved(); }
  async function remove(tid: string) { await supabase.from("project_tasks").delete().eq("id", tid); onSaved(); }
  return (
    <div className="space-y-4">
      <form onSubmit={add} className="flex flex-wrap gap-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New task" className="min-w-48 flex-1" />
        <Select value={assignee} onValueChange={setAssignee}><SelectTrigger className="w-44"><SelectValue placeholder="Assign to" /></SelectTrigger><SelectContent><SelectItem value="none">Unassigned</SelectItem>{members.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>)}</SelectContent></Select>
        <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="w-40" aria-label="Due date" />
        <Button type="submit" disabled={!title.trim()}>Add</Button>
      </form>
      <ul className="space-y-2">{data.tasks.map((t) => (
        <li key={t.id} className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 text-sm">
          <label className="flex items-center gap-2"><Checkbox checked={t.done} onCheckedChange={(v) => toggle(t.id, !!v)} /><span className={t.done ? "line-through text-muted-foreground" : ""}>{t.title}</span></label>
          <span className="flex items-center gap-2 text-xs text-muted-foreground">{t.assignee_id ? nameOf(t.assignee_id) : "Unassigned"}{t.due_date ? ` · due ${t.due_date}` : ""}<Button size="sm" variant="ghost" aria-label="Remove task" onClick={() => remove(t.id)}><Trash2 className="h-4 w-4" /></Button></span>
        </li>
      ))}</ul>
      {!data.tasks.length && <p className="text-sm text-muted-foreground">No tasks yet.</p>}
    </div>
  );
}

function People({ data, id, me, member, onSaved }: { data: Data; id: string; me: string | null; member: { role: MemberRole; state: MemberState } | null; onSaved: () => void }) {
  const navigate = useNavigate();
  const invite = useServerFn(inviteToProject);
  const [pick, setPick] = useState<Set<string>>(new Set());
  const people = useQuery({ queryKey: ["opportunity-people"], queryFn: () => getOpportunityPeople(), enabled: can(member, "invite") });
  const present = new Set(data.people.map((p) => p.user_id));
  const candidates = (people.data ?? []).filter((p) => p.match && !present.has(p.id));
  const p = data.project!;

  async function call(fn: "remove_project_member" | "transfer_project_ownership", user: string, ok: string) {
    const { error } = await supabase.rpc(fn, { _project: id, _user: user });
    if (error) toast.error("Could not do that."); else { toast.success(ok); onSaved(); }
  }
  async function sendInvites() {
    try { const r = await invite({ data: { projectId: id, memberIds: [...pick] } }); toast.success(`${r.invited} invitation(s) sent`); setPick(new Set()); onSaved(); } catch { toast.error("Could not invite."); }
  }
  async function leave() {
    const { error } = await supabase.rpc("leave_project", { _project: id });
    if (error) toast.error(error.message.includes("Transfer") ? "Transfer ownership before leaving." : "Could not leave."); else navigate({ to: "/projects" });
  }
  async function archive() { await supabase.from("projects").update({ archived: !p.archived }).eq("id", id); onSaved(); }
  async function destroy() {
    const { error } = await supabase.rpc("delete_project", { _project: id });
    if (error) toast.error("Could not delete."); else navigate({ to: "/projects" });
  }

  return (
    <div className="space-y-6">
      <ul className="divide-y rounded-xl border bg-card text-sm">{data.people.map((x) => (
        <li key={x.user_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <span><span className="font-medium">{x.name}</span>{x.institution ? ` · ${x.institution}` : ""} <Badge variant={x.role === "owner" ? "default" : "secondary"}>{x.role === "owner" ? "Owner" : "Editor"}</Badge> {x.state === "invited" && <Badge variant="outline">Invited</Badge>}</span>
          {can(member, "remove") && x.user_id !== me && (
            <span className="flex gap-1">
              {x.state === "accepted" && <Button size="sm" variant="ghost" onClick={() => call("transfer_project_ownership", x.user_id, `${x.name} is now the owner`)}>Make owner</Button>}
              <Button size="sm" variant="ghost" onClick={() => call("remove_project_member", x.user_id, "Removed")}>Remove</Button>
            </span>
          )}
        </li>
      ))}</ul>

      {can(member, "invite") && (
        <div className="space-y-2">
          <p className="font-medium">Invite more Lattice Scout matches</p>
          {candidates.length ? <>
            <div className="flex flex-wrap gap-4 text-sm">{candidates.map((c) => <label key={c.id} className="flex items-center gap-2"><Checkbox checked={pick.has(c.id)} onCheckedChange={(v) => setPick((s) => { const n = new Set(s); v ? n.add(c.id) : n.delete(c.id); return n; })} />{c.name}</label>)}</div>
            <Button size="sm" onClick={sendInvites} disabled={!pick.size}><UserPlus className="h-4 w-4" /> Send invitations</Button>
          </> : <p className="text-sm text-muted-foreground">{people.isLoading ? "Loading…" : "Everyone you can invite is already here."}</p>}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t pt-4">
        {member?.role !== "owner" && <Button variant="outline" size="sm" onClick={leave}>Leave this opportunity</Button>}
        {can(member, "archive") && <Button variant="outline" size="sm" onClick={archive}>{p.archived ? "Restore from archive" : "Archive"}</Button>}
        {can(member, "delete") && (
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="outline" size="sm"><Trash2 className="h-4 w-4" /> Delete</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Delete this shared opportunity?</AlertDialogTitle><AlertDialogDescription>The proposal, papers, comments, tasks and history are removed for everyone. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={destroy}>Delete permanently</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
