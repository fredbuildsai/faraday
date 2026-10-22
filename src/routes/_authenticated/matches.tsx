import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Bookmark, BookmarkCheck, ChevronDown, Lightbulb, Mail, RotateCcw, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Section } from "@/components/Section";
import { computeMatches, saveMatchNotes, setInterest, setMatchState, writeMatchIdeas } from "@/lib/matching.functions";
import { Thumbs } from "@/components/Thumbs";
import { feedbackQuery } from "./opportunities";

const matchesQuery = queryOptions({
  queryKey: ["my-matches"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("my_matches");
    if (error) throw error;
    return data ?? [];
  },
});

type MatchState = { state: "active" | "saved" | "dismissed"; notes: string; notes_updated_at: string | null; summary: string | null; ideas: { title: string; description: string }[]; ideas_at: string | null };

const statesQuery = queryOptions({
  queryKey: ["match-states"],
  queryFn: async () => {
    const { data, error } = await supabase.from("match_user_state").select("match_id, state, notes, notes_updated_at, summary, ideas, ideas_at");
    if (error) throw error;
    return Object.fromEntries((data ?? []).map((r) => [r.match_id, r as unknown as MatchState])) as Record<string, MatchState>;
  },
});

const TABS = [
  { key: "all", label: "All" },
  { key: "saved", label: "Saved" },
  { key: "interested", label: "Mutual interest" },
  { key: "dismissed", label: "Dismissed" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export const Route = createFileRoute("/_authenticated/matches")({
  head: () => ({
    meta: [
      { title: "Your matches — Lattice Scout" },
      { name: "description", content: "Researchers whose topics overlap yours and whose methods complement yours." },
      { property: "og:title", content: "Your matches — Lattice Scout" },
      { property: "og:description", content: "Researchers whose topics overlap yours and whose methods complement yours." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(matchesQuery), context.queryClient.ensureQueryData(feedbackQuery), context.queryClient.ensureQueryData(statesQuery)]),
  component: MatchesPage,
});

function MatchesPage() {
  const { data } = useSuspenseQuery(matchesQuery);
  const { data: fb } = useSuspenseQuery(feedbackQuery);
  const qc = useQueryClient();
  const compute = useServerFn(computeMatches);
  const interest = useServerFn(setInterest);
  const { data: states } = useSuspenseQuery(statesQuery);
  const changeState = useServerFn(setMatchState);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const stateOf = (id: string) => states[id]?.state ?? "active";
  const shown = data.filter((m) => {
    const st = stateOf(m.id);
    if (tab === "dismissed") return st === "dismissed";
    if (st === "dismissed") return false;
    if (tab === "saved") return st === "saved";
    if (tab === "interested") return m.i_am_interested && m.they_are_interested;
    return true;
  });

  async function mark(id: string, state: MatchState["state"]) {
    try {
      await changeState({ data: { matchId: id, state } });
      await qc.invalidateQueries({ queryKey: ["match-states"] });
      toast.success(state === "saved" ? "Saved" : state === "dismissed" ? "Dismissed — find it under Dismissed" : "Restored");
    } catch { toast.error("Could not update. Please try again."); }
  }

  async function find() {
    setBusy(true);
    try {
      const r = await compute();
      if (r.added) toast.success(`${r.added} new match${r.added > 1 ? "es" : ""}`);
      else toast.info(r.reason ?? "No new matches");
      await qc.invalidateQueries({ queryKey: ["my-matches"] });
    } catch { toast.error("Could not look for matches. Please try again."); }
    finally { setBusy(false); }
  }

  async function toggle(id: string, on: boolean) {
    try {
      await interest({ data: { matchId: id, interested: on } });
      await qc.invalidateQueries({ queryKey: ["my-matches"] });
    } catch { toast.error("Could not update. Please try again."); }
  }

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl">Your matches</h1>
            <p className="text-muted-foreground">Shared topics, different methods. Emails appear only when you both say yes.</p>
          </div>
          <Button onClick={find} disabled={busy}>{busy ? "Looking…" : "Find new matches"}</Button>
        </div>

        <div className="flex flex-wrap gap-2" role="tablist">
          {TABS.map((t) => (
            <Button key={t.key} role="tab" aria-selected={tab === t.key} size="sm" variant={tab === t.key ? "default" : "outline"} onClick={() => setTab(t.key)}>{t.label}</Button>
          ))}
        </div>

        {!data.length ? (
          <div className="rounded-xl border border-dashed bg-card p-10 text-center text-muted-foreground">
            No matches yet. Run your profile analysis, then press "Find new matches".
          </div>
        ) : !shown.length ? (
          <div className="rounded-xl border border-dashed bg-card p-10 text-center text-muted-foreground">Nothing here yet.</div>
        ) : shown.map((m, i) => (
          <Section
            key={m.id}
            defaultOpen={i === 0}
            title={m.other_name || "A researcher"}
            subtitle={m.other_institution || "Institution not given"}
            aside={<>{stateOf(m.id) === "saved" && <BookmarkCheck className="h-4 w-4 text-primary" aria-label="Saved" />}<Thumbs type="match" id={m.id} value={fb[`match:${m.id}`] ?? 0} /><span className="rounded-full bg-accent px-3 py-1 font-mono text-sm text-accent-foreground">{Math.round(m.score * 100)}%</span></>}
          >
           <div className="space-y-4">
            {m.shared_topics.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {m.shared_topics.map((t) => <span key={t} className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">{t}</span>)}
              </div>
            )}
            <div className="grid gap-4 text-sm sm:grid-cols-2">
              <div><p className="mb-1 font-medium">You bring</p><p className="text-muted-foreground">{m.you_bring.join(", ") || "—"}</p></div>
              <div><p className="mb-1 font-medium">They bring</p><p className="text-muted-foreground">{m.they_bring.join(", ") || "—"}</p></div>
            </div>
            <Collapsible>
              <CollapsibleTrigger className="group flex items-center gap-1 text-sm text-primary">
                Why this score <ChevronDown className="h-4 w-4 transition group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-1 font-mono text-xs text-muted-foreground">
                <p>Topic overlap T = {m.t.toFixed(2)}</p>
                <p>Method overlap M = {m.m.toFixed(2)} (lower is better)</p>
                <p>Activity factor = {m.act.toFixed(2)}</p>
                <p>Score = T × (1 − M)^1.5 × activity = {m.score.toFixed(2)}</p>
              </CollapsibleContent>
            </Collapsible>
            <MatchIdeas matchId={m.id} st={states[m.id]} />
            <MatchNotes matchId={m.id} st={states[m.id]} />
            <div className="flex flex-wrap items-center gap-3 border-t pt-4">
              {stateOf(m.id) === "dismissed" ? (
                <Button size="sm" variant="outline" onClick={() => mark(m.id, "active")}><RotateCcw className="mr-1 h-4 w-4" />Restore</Button>
              ) : (
                <>
                  {stateOf(m.id) === "saved"
                    ? <Button size="sm" variant="outline" onClick={() => mark(m.id, "active")}><BookmarkCheck className="mr-1 h-4 w-4" />Saved</Button>
                    : <Button size="sm" variant="outline" onClick={() => mark(m.id, "saved")}><Bookmark className="mr-1 h-4 w-4" />Save</Button>}
                  <Button size="sm" variant="ghost" onClick={() => mark(m.id, "dismissed")}><X className="mr-1 h-4 w-4" />Dismiss</Button>
                </>
              )}
              <span className="flex-1" />
              {m.other_email ? (
                <a href={`mailto:${m.other_email}`} className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                  <Mail className="h-4 w-4" /> {m.other_email}
                </a>
              ) : m.i_am_interested ? (
                <>
                  <span className="text-sm text-muted-foreground">You're interested. Waiting for them.</span>
                  <Button variant="ghost" size="sm" onClick={() => toggle(m.id, false)}>Undo</Button>
                </>
              ) : (
                <Button size="sm" onClick={() => toggle(m.id, true)}>I'm interested</Button>
              )}
            </div>
           </div>
          </Section>
        ))}
      </main>
    </div>
  );
}

function MatchIdeas({ matchId, st }: { matchId: string; st?: MatchState }) {
  const write = useServerFn(writeMatchIdeas);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const r = await write({ data: { matchId } });
      if (!r.ok) toast.error(r.reason);
      else { toast.success("Collaboration ideas ready"); await qc.invalidateQueries({ queryKey: ["match-states"] }); }
    } catch { toast.error("Could not write ideas. Please try again."); }
    finally { setBusy(false); }
  }
  return (
    <div className="space-y-2 rounded-lg bg-secondary/50 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium"><Lightbulb className="h-4 w-4" />Collaboration ideas</p>
        <Button size="sm" variant="outline" onClick={run} disabled={busy}>{busy ? "Writing…" : st?.ideas_at ? "Rewrite" : "Write with AI"}</Button>
      </div>
      {st?.summary ? (
        <>
          <p className="text-sm text-muted-foreground">{st.summary}</p>
          {st.ideas.map((i) => (
            <div key={i.title} className="text-sm"><p className="font-medium">{i.title}</p><p className="text-muted-foreground">{i.description}</p></div>
          ))}
        </>
      ) : <p className="text-sm text-muted-foreground">A short summary of why you fit and up to 2 joint project ideas, from both your profile analyses.</p>}
    </div>
  );
}

function MatchNotes({ matchId, st }: { matchId: string; st?: MatchState }) {
  const save = useServerFn(saveMatchNotes);
  const [text, setText] = useState(st?.notes ?? "");
  const [at, setAt] = useState(st?.notes_updated_at ?? null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(async () => {
      try { const r = await save({ data: { matchId, notes: text } }); setAt(r.at); }
      catch { toast.error("Could not save your note"); }
    }, 800);
    return () => clearTimeout(t);
  }, [text]);
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium" htmlFor={`notes-${matchId}`}>Private notes</label>
      <Textarea id={`notes-${matchId}`} value={text} maxLength={5000} onChange={(e) => setText(e.target.value)} placeholder="Only you can see this." />
      {at && <p className="text-xs text-muted-foreground">Saved {new Date(at).toLocaleString()}</p>}
    </div>
  );
}
