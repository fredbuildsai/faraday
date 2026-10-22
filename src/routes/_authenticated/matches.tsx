import { DEFAULT_WEIGHTS } from "@/lib/match-score";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Bookmark, BookmarkCheck, ChevronDown, Lightbulb, Mail, RotateCcw, Trash2, X } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Section } from "@/components/Section";
import { computeMatches, removeMatch, saveMatchNotes, setInterest, setMatchState, writeMatchIdeas } from "@/lib/matching.functions";
import { Thumbs } from "@/components/Thumbs";
import { feedbackQuery } from "./opportunities";
import { SwipeDeck, type ScientistCard } from "@/components/SwipeDeck";
import { inDeck } from "@/lib/swipe";
import { OpenAlexDialog } from "@/components/OpenAlexDialog";
import { LogoMark } from "@/components/Logo";

const cardsQuery = queryOptions({
  queryKey: ["match-cards"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("match_cards");
    if (error) throw error;
    return Object.fromEntries((data ?? []).map((r) => [r.other_id, r]));
  },
});

const layersQuery = queryOptions({
  queryKey: ["match-layers"],
  queryFn: async () => {
    const { data, error } = await supabase.from("matches").select("id, layer, via");
    if (error) throw error;
    return Object.fromEntries((data ?? []).map((r) => [r.id, r])) as Record<string, { layer: string; via: string | null }>;
  },
});

type External = { id: string; openalex_id: string; name: string; institution: string | null; score: number; t: number; layer: string; via: string | null; shared_topics: string[]; h_index: number; citations: number; works_count: number; recent_works: number | null; state: string };
const externalQuery = queryOptions({
  queryKey: ["external-suggestions"],
  queryFn: async () => {
    const { data, error } = await supabase.from("external_suggestions").select("id, openalex_id, name, institution, score, t, layer, via, shared_topics, h_index, citations, works_count, recent_works, state").order("score", { ascending: false });
    if (error) throw error;
    return (data ?? []) as External[];
  },
});
const EXT = "ext:";

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
  { key: "discover", label: "Discover" },
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
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(matchesQuery), context.queryClient.ensureQueryData(feedbackQuery), context.queryClient.ensureQueryData(statesQuery), context.queryClient.ensureQueryData(cardsQuery), context.queryClient.ensureQueryData(layersQuery), context.queryClient.ensureQueryData(externalQuery)]),
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
  const removeMatchFn = useServerFn(removeMatch);
  const [busy, setBusy] = useState(false);
  const [piOnly, setPiOnly] = useState(true);
  const [tab, setTab] = useState<Tab>("discover");
  const stateOf = (id: string) => states[id]?.state ?? "active";
  const { data: cardInfo } = useSuspenseQuery(cardsQuery);
  const { data: layers } = useSuspenseQuery(layersQuery);
  const { data: external } = useSuspenseQuery(externalQuery);
  const layerLabel = (layer: string, via: string | null, topic?: string) => layer === "second_degree"
    ? `Collaborator of a collaborator${via ? ` · via ${via}` : ""}`
    : `Shared focus${topic ? ` · ${topic}` : ""}`;
  async function setExternal(id: string, state: string) {
    const { error } = await supabase.from("external_suggestions").update({ state, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: ["external-suggestions"] });
  }
  const [lastDecided, setLastDecided] = useState<string | null>(null);
  const deck: ScientistCard[] = data.filter((m) => inDeck({ state: stateOf(m.id), i_am_interested: m.i_am_interested })).map((m): ScientistCard => {
    const c = cardInfo[m.other_id];
    return {
      id: m.id, name: m.other_name || "A researcher", institution: m.other_institution, score: m.score, t: m.t,
      layer: layerLabel(layers[m.id]?.layer ?? "interest", layers[m.id]?.via ?? null, m.shared_topics[0]),
      sharedTopics: m.shared_topics, interests: c?.interests ?? null,
      hIndex: c?.h_index ?? 0, citations: Number(c?.citations ?? 0), worksCount: c?.works_count ?? 0, recentWorks: c?.recent_works ?? 0,
      methods: c?.methods ?? [], directions: c?.directions ?? [], openalexId: c?.openalex_ids?.[0] ?? null,
      member: true,
    };
  }).concat(external.filter((e) => e.state === "active").map((e) => ({
    id: EXT + e.id, name: e.name, institution: e.institution, score: e.score, t: e.t,
    layer: `Not on Lattice Scout · ${layerLabel(e.layer, e.via, e.shared_topics[0])}`,
    sharedTopics: e.shared_topics, interests: null, hIndex: e.h_index, citations: Number(e.citations), worksCount: e.works_count, recentWorks: e.recent_works ?? 0, openalexId: e.openalex_id,
    methods: [], directions: [],
    member: false,
  }))).sort((a, b) => (a.member === b.member ? b.score - a.score : a.member ? -1 : 1));
  async function removeExternal(id: string) {
    const { error } = await supabase.from("external_suggestions").delete().eq("id", id);
    if (error) { toast.error("Could not remove."); return; }
    toast.success("Removed");
    await qc.invalidateQueries({ queryKey: ["external-suggestions"] });
  }

  async function decide(id: string, d: "like" | "pass") {
    if (id.startsWith(EXT)) {
      try {
        await setExternal(id.slice(EXT.length), d === "like" ? "saved" : "dismissed");
        if (d === "like") toast.success("Saved. They're not on Lattice Scout yet, so find them under Saved.");
        setLastDecided(id);
      } catch { toast.error("Could not save your choice. Please try again."); }
      return;
    }
    try {
      if (d === "like") {
        await interest({ data: { matchId: id, interested: true } });
        await changeState({ data: { matchId: id, state: "saved" } });
        const m = data.find((x) => x.id === id);
        if (m?.they_are_interested) toast.success(`It's a match! You can now email ${m.other_name}.`);
        else toast.success("Saved. They'll see your interest.");
      } else {
        await changeState({ data: { matchId: id, state: "dismissed" } });
      }
      setLastDecided(id);
      await Promise.all([qc.invalidateQueries({ queryKey: ["my-matches"] }), qc.invalidateQueries({ queryKey: ["match-states"] })]);
    } catch { toast.error("Could not save your choice. Please try again."); }
  }

  async function undo() {
    if (!lastDecided) return;
    if (lastDecided.startsWith(EXT)) {
      try { await setExternal(lastDecided.slice(EXT.length), "active"); setLastDecided(null); } catch { toast.error("Could not undo."); }
      return;
    }
    try {
      await interest({ data: { matchId: lastDecided, interested: false } });
      await changeState({ data: { matchId: lastDecided, state: "active" } });
      setLastDecided(null);
      await Promise.all([qc.invalidateQueries({ queryKey: ["my-matches"] }), qc.invalidateQueries({ queryKey: ["match-states"] })]);
    } catch { toast.error("Could not undo."); }
  }
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

  async function remove(id: string) {
    try {
      await removeMatchFn({ data: { matchId: id } });
      setLastDecided((d) => (d === id ? null : d));
      await Promise.all([qc.invalidateQueries({ queryKey: ["my-matches"] }), qc.invalidateQueries({ queryKey: ["match-states"] }), qc.invalidateQueries({ queryKey: ["match-cards"] })]);
      toast.success("Removed permanently");
    } catch { toast.error("Could not remove. Please try again."); }
  }

  async function find() {
    setBusy(true);
    try {
      const r = await compute({ data: { piOnly } });
      if (r.added) toast.success(`${r.added} new match${r.added > 1 ? "es" : ""}`);
      else toast.info(r.reason ?? "No new matches");
      await Promise.all([qc.invalidateQueries({ queryKey: ["my-matches"] }), qc.invalidateQueries({ queryKey: ["match-cards"] }), qc.invalidateQueries({ queryKey: ["match-layers"] }), qc.invalidateQueries({ queryKey: ["external-suggestions"] })]);
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
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm" title="For researchers outside Lattice Scout, suggest only last authors (likely lab heads)">
              <Switch checked={piOnly} onCheckedChange={setPiOnly} aria-label="Principal investigators only" />
              Principal investigators only
            </label>
            <Button onClick={find} disabled={busy}>{busy ? "Looking…" : "Find new matches"}</Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2" role="tablist">
          {TABS.map((t) => (
            <Button key={t.key} role="tab" aria-selected={tab === t.key} size="sm" variant={tab === t.key ? "default" : "outline"} onClick={() => setTab(t.key)}>{t.label}</Button>
          ))}
        </div>

        {tab === "discover" ? (
          data.length || external.length ? <SwipeDeck cards={deck} onDecide={decide} onUndo={undo} canUndo={!!lastDecided} />
          : <div className="rounded-xl border border-dashed bg-card p-10 text-center text-muted-foreground">No matches yet. Run your profile analysis, then press "Find new matches".</div>
        ) : !data.length ? (
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
            aside={<>{stateOf(m.id) === "saved" && <BookmarkCheck className="h-4 w-4 text-primary" aria-label="Saved" />}<span className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs font-medium" title="On Lattice Scout"><LogoMark className="h-3.5 w-3.5" /> Lattice Scout</span><Thumbs type="match" id={m.id} value={fb[`match:${m.id}`] ?? 0} /><span className="rounded-full bg-accent px-3 py-1 font-mono text-sm text-accent-foreground">{Math.round(m.score * 100)}%</span></>}
          >
           <div className="space-y-4">
            {m.shared_topics.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {m.shared_topics.map((t) => <span key={t} className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">{t}</span>)}
              </div>
            )}
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <div><p className="mb-1 font-medium">Shared research area</p><p className="text-muted-foreground">{m.t >= 0.5 ? "Strong" : m.t >= 0.3 ? "Moderate" : "Some"} ({Math.round(m.t * 100)}%)</p></div>
              <div><p className="mb-1 font-medium">Publication activity</p><p className="text-muted-foreground">{m.act >= 0.6 ? "Current" : m.act >= 0.3 ? "Moderate" : "Low"}</p></div>
              <div><p className="mb-1 font-medium">Methods</p><p className="text-muted-foreground">{!m.you_bring.length && !m.they_bring.length && !(m.shared_methods ?? []).length ? "Still being established" : m.m >= 0.25 ? "Shared methodological ground" : "Different methodological perspectives"}</p></div>
            </div>
            <div className="grid gap-4 text-sm sm:grid-cols-3">
              <div><p className="mb-1 font-medium">Methods you both use</p><p className="text-muted-foreground">{(m.shared_methods ?? []).join(", ") || "—"}</p></div>
              <div><p className="mb-1 font-medium">Mainly yours</p><p className="text-muted-foreground">{m.you_bring.join(", ") || "—"}</p></div>
              <div><p className="mb-1 font-medium">Mainly theirs</p><p className="text-muted-foreground">{m.they_bring.join(", ") || "—"}</p></div>
            </div>
            <Collapsible>
              <CollapsibleTrigger className="group flex items-center gap-1 text-sm text-primary">
                Why this score <ChevronDown className="h-4 w-4 transition group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-1 font-mono text-xs text-muted-foreground">
                <p>Topic similarity T = {m.t.toFixed(2)}</p>
                <p>Activity A = {m.act.toFixed(2)}</p>
                {m.formula === "v2"
                  ? <><p>Score = {DEFAULT_WEIGHTS.topic} × T + {DEFAULT_WEIGHTS.activity} × A = {m.score.toFixed(2)}</p><p>Methods are shown for context only and do not change the score.</p></>
                  : <p>Older score (method overlap penalty) = {m.score.toFixed(2)}. Find new matches to use the new rule.</p>}
              </CollapsibleContent>
            </Collapsible>
            <MatchIdeas matchId={m.id} st={states[m.id]} />
            <MatchNotes matchId={m.id} st={states[m.id]} />
            <div className="flex flex-wrap items-center gap-3 border-t pt-4">
              {stateOf(m.id) === "dismissed" ? (
                <>
                  <Button size="sm" variant="outline" onClick={() => mark(m.id, "active")}><RotateCcw className="mr-1 h-4 w-4" />Restore</Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost"><Trash2 className="mr-1 h-4 w-4" />Remove</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove this match permanently?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This deletes {m.other_name || "this researcher"} from your matches for good. Any notes are lost and they will not appear again unless a new match is created. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove(m.id)}>Remove</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              ) : (
                <>
                  {stateOf(m.id) === "saved"
                    ? <Button size="sm" variant="outline" onClick={() => mark(m.id, "active")}><BookmarkCheck className="mr-1 h-4 w-4" />Saved</Button>
                    : <Button size="sm" variant="outline" onClick={() => mark(m.id, "saved")}><Bookmark className="mr-1 h-4 w-4" />Save</Button>}
                  <Button size="sm" variant="ghost" onClick={() => mark(m.id, "dismissed")}><X className="mr-1 h-4 w-4" />Dismiss</Button>
                </>
              )}
              {cardInfo[m.other_id]?.openalex_ids?.[0] && <OpenAlexDialog authorId={cardInfo[m.other_id]!.openalex_ids[0]!} name={m.other_name || "Researcher"} />}
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

        {(tab === "saved" || tab === "dismissed") && external.some((e) => e.state === tab) && (
          <div className="space-y-3">
            <h2 className="font-serif text-xl">Not on Lattice Scout yet</h2>
            <p className="text-sm text-muted-foreground">Found in the wider OpenAlex network. They can't see your interest until they join.</p>
            {external.filter((e) => e.state === tab).map((e) => (
              <Section key={e.id} title={e.name} subtitle={e.institution || "Institution not given"}
                aside={<span className="rounded-full bg-accent px-3 py-1 font-mono text-sm text-accent-foreground">{Math.round(e.score * 100)}%</span>}>
                <div className="space-y-3 text-sm">
                  <p className="text-muted-foreground">{layerLabel(e.layer, e.via, e.shared_topics[0])}</p>
                  <p><span className="font-medium">Shared research area:</span> {e.shared_topics.join(", ") || "—"}</p>
                  <p className="text-muted-foreground">h-index {e.h_index} · {Number(e.citations).toLocaleString()} citations · {e.works_count} works</p>
                  <div className="flex flex-wrap gap-2">
                    <OpenAlexDialog authorId={e.openalex_id} name={e.name} />
                    {tab === "saved"
                      ? <Button size="sm" variant="ghost" onClick={() => setExternal(e.id, "dismissed").catch(() => toast.error("Could not update."))}><X className="mr-1 h-4 w-4" />Dismiss</Button>
                      : <>
                        <Button size="sm" variant="outline" onClick={() => setExternal(e.id, "active").catch(() => toast.error("Could not update."))}><RotateCcw className="mr-1 h-4 w-4" />Restore</Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost"><Trash2 className="mr-1 h-4 w-4" />Remove</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove this researcher permanently?</AlertDialogTitle>
                              <AlertDialogDescription>This deletes {e.name} from your list for good. This cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Keep</AlertDialogCancel>
                              <AlertDialogAction onClick={() => removeExternal(e.id)}>Remove</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>}
                  </div>
                </div>
              </Section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function MatchIdeas({ matchId, st }: { matchId: string; st?: MatchState | undefined }) {
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

function MatchNotes({ matchId, st }: { matchId: string; st?: MatchState | undefined }) {
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
