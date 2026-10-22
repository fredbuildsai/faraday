import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { OaBadge } from "@/components/OaBadge";
import { getOpportunityPeople } from "@/lib/opportunities.functions";
import { createProject, searchMemberPapers } from "@/lib/projects.functions";

export type DraftPaper = { openalexId: string; title: string; url: string | null; isOa: boolean; origin?: "member" | "evidence" | "prior_art" | "similar" };
type Initial = { title?: string; description?: string; papers?: DraftPaper[]; source?: Record<string, unknown>; notes?: string; whitespace?: Record<string, unknown> | null; people?: { id: string; name: string }[] };

/** Create a shared opportunity: invite matches, note outside collaborators, pick evidence papers. */
export function NewProjectDialog({ trigger, initial }: { trigger: ReactNode; initial?: Initial }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [members, setMembers] = useState<Set<string>>(new Set());
  const [suggested, setSuggested] = useState<Set<string>>(new Set());
  const [papers, setPapers] = useState<DraftPaper[]>(initial?.papers ?? []);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<(DraftPaper & { owner: string; year: number | null })[]>([]);
  const [busy, setBusy] = useState(false);
  const people = useQuery({ queryKey: ["opportunity-people"], queryFn: () => getOpportunityPeople(), enabled: open });
  const search = useServerFn(searchMemberPapers);
  const create = useServerFn(createProject);
  const navigate = useNavigate();
  const matches = (people.data ?? []).filter((p) => p.match);
  const outside = (people.data ?? []).filter((p) => !p.match);
  const carried = initial?.people ?? [];
  const toggle = (set: Set<string>, id: string, on: boolean) => { const n = new Set(set); on ? n.add(id) : n.delete(id); return n; };
  // People named on a saved opportunity start ticked: members by name, outside researchers by id.
  useEffect(() => {
    if (!people.data || !carried.length) return;
    const names = new Set(carried.map((c) => c.name.trim().toLowerCase()));
    const ids = new Set(carried.map((c) => c.id));
    setMembers(new Set(matches.filter((m) => names.has(m.name.trim().toLowerCase())).map((m) => m.id)));
    setSuggested(new Set(outside.filter((m) => ids.has(m.id) || names.has(m.name.trim().toLowerCase())).map((m) => m.id)));
  }, [people.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const memberNames = new Set(matches.map((m) => m.name.trim().toLowerCase()));
  const outsideIds = new Set(outside.map((m) => m.id));
  const extraPeople = carried.filter((c) => !outsideIds.has(c.id) && !memberNames.has(c.name.trim().toLowerCase()));

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2) return;
    try { setResults(await search({ data: { q, memberIds: [...members] } })); } catch { toast.error("Could not search papers."); }
  }
  async function submit() {
    setBusy(true);
    try {
      const suggestedPeople = [...outside.filter((p) => suggested.has(p.id)).map((p) => ({ id: p.id, name: p.name })), ...extraPeople];
      const r = await create({ data: { title, description, memberIds: [...members], suggested: suggestedPeople, papers, source: initial?.source ?? {}, notes, whitespace: initial?.whitespace ?? null } });
      toast.success(members.size ? "Opportunity created and invitations sent" : "Opportunity created");
      setOpen(false);
      navigate({ to: "/projects/$id", params: { id: r.id } });
    } catch { toast.error("Could not create the opportunity."); } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">New shared opportunity</DialogTitle>
          <DialogDescription>Invite Lattice Scout members to work on it with you. Only people who accept can see it.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 text-sm">
          <div className="space-y-1.5"><Label htmlFor="np-title">Title</Label><Input id="np-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A specific research question" /></div>
          <div className="space-y-1.5"><Label htmlFor="np-desc">Description</Label><Textarea id="np-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></div>

          <div className="space-y-2">
            <p className="font-medium">Invite from Lattice Scout</p>
            {people.isLoading ? <p className="text-muted-foreground">Loading…</p> : matches.length ? (
              <div className="flex flex-wrap gap-4">{matches.map((m) => <label key={m.id} className="flex items-center gap-2"><Checkbox checked={members.has(m.id)} onCheckedChange={(v) => setMembers((s) => toggle(s, m.id, !!v))} />{m.name}</label>)}</div>
            ) : <p className="text-muted-foreground">No Lattice Scout matches yet.</p>}
          </div>
          {!!outside.length && (
            <div className="space-y-2">
              <p className="font-medium">Suggested people outside Lattice Scout <span className="font-normal text-muted-foreground">(listed only, they can’t edit)</span></p>
              <div className="flex flex-wrap gap-4">{outside.map((m) => <label key={m.id} className="flex items-center gap-2"><Checkbox checked={suggested.has(m.id)} onCheckedChange={(v) => setSuggested((s) => toggle(s, m.id, !!v))} />{m.name}</label>)}</div>
            </div>
          )}

          <div className="space-y-2">
            <p className="font-medium">Evidence papers <span className="font-normal text-muted-foreground">(search your publications and those of the people you invite)</span></p>
            <form onSubmit={runSearch} className="flex gap-2"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title" /><Button type="submit" variant="outline" size="icon" aria-label="Search papers"><Search className="h-4 w-4" /></Button></form>
            {!!results.length && (
              <ul className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-2">
                {results.map((r) => {
                  const on = papers.some((p) => p.openalexId === r.openalexId);
                  return <li key={r.openalexId}><label className="flex items-start gap-2"><Checkbox className="mt-0.5" checked={on} onCheckedChange={(v) => setPapers((ps) => v ? [...ps, r] : ps.filter((p) => p.openalexId !== r.openalexId))} /><span>{r.title} <span className="text-xs text-muted-foreground">· {r.owner}{r.year ? ` · ${r.year}` : ""}</span> {r.isOa && <OaBadge />}</span></label></li>;
                })}
              </ul>
            )}
            {!!papers.length && (
              <ul className="space-y-1">{papers.map((p) => <li key={p.openalexId} className="flex items-start justify-between gap-2 rounded-md bg-muted/50 px-2 py-1"><span>{p.title}</span><button type="button" aria-label="Remove paper" onClick={() => setPapers((ps) => ps.filter((x) => x.openalexId !== p.openalexId))}><X className="h-4 w-4" /></button></li>)}</ul>
            )}
            <p className="text-xs text-muted-foreground">Once created, “Find similar papers” on the opportunity page uses AI to look for related recent literature.</p>
          </div>
          <Button onClick={submit} disabled={busy || title.trim().length < 3}>{busy ? "Creating…" : "Create opportunity"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
