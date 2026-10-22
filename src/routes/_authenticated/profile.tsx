import { OaBadge } from "@/components/OaBadge";
import { PaperDialog } from "@/components/PaperDialog";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { importWorks, saveResearchInterests } from "@/lib/openalex.functions";
import { draftResearchInterests, saveCustomTopics } from "@/lib/profile.functions";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, paginate, sortWorks, type WorkSort } from "@/lib/paginate";
import type { WorkTopic } from "@/lib/openalex-math";
import { runAnalysis } from "@/lib/analysis.functions";
import { AnalysisSection } from "@/components/AnalysisSection";
import type { Edit } from "@/lib/analysis";
import { ConfidentialNotice } from "@/components/ConfidentialNotice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Section } from "@/components/Section";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const profileQuery = queryOptions({
  queryKey: ["my-profile"],
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user!.id;
    const [{ data: profile, error }, { data: works }, { data: analysis }, { data: edits }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("works").select("id, title, venue, year, cited_by_count, type, topics, doi, is_oa")
        .eq("user_id", uid).order("year", { ascending: false, nullsFirst: false }).limit(1000),
      supabase.from("profile_analysis").select("status, summary, interests, methods, directions, error, finished_at").eq("user_id", uid).maybeSingle(),
      supabase.from("profile_analysis_edits").select("kind, value, action").eq("user_id", uid),
    ]);
    if (error) throw error;
    return { profile, works: works ?? [], analysis, edits: (edits ?? []) as Edit[], email: u.user!.email ?? "" };
  },
});

export const Route = createFileRoute("/_authenticated/profile")({
  validateSearch: z.object({ skip: z.boolean().optional() }),
  head: () => ({
    meta: [
      { title: "Your profile — Lattice Scout" },
      { name: "description", content: "Your Lattice Scout research profile." },
      { property: "og:title", content: "Your profile — Lattice Scout" },
      { property: "og:description", content: "Your Lattice Scout research profile." },
    ],
  }),
  loaderDeps: ({ search }) => ({ skip: search.skip }),
  loader: async ({ context, deps }) => {
    const d = await context.queryClient.ensureQueryData(profileQuery);
    if (!d.profile?.openalex_author_id && !deps.skip) throw redirect({ to: "/confirm" });
    return d;
  },
  component: ProfilePage,
});

function ProfilePage() {
  const { data } = useSuspenseQuery(profileQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const refresh = useServerFn(importWorks);
  const save = useServerFn(saveResearchInterests);
  const saveTopics = useServerFn(saveCustomTopics);
  const draft = useServerFn(draftResearchInterests);
  const analyse = useServerFn(runAnalysis);
  const [analysing, setAnalysing] = useState(false);
  const p = data.profile;
  const [interests, setInterests] = useState(p?.research_interests ?? "");
  const [refreshing, setRefreshing] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [aiDrafted, setAiDrafted] = useState(false);
  const [newTopic, setNewTopic] = useState("");
  const [sort, setSort] = useState<WorkSort>("recent");
  const [size, setSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);
  const autoTried = useRef(false);
  const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ") || data.email;
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const citations = data.works.reduce((s, w) => s + (w.cited_by_count ?? 0), 0);
  const customTopics = p?.custom_topics ?? [];

  const topicNames = new Map<string, string>();
  for (const w of data.works) for (const t of (w.topics as unknown as WorkTopic[]) ?? []) topicNames.set(t.id, t.name);
  const topTopics = Object.entries((p?.topic_weights ?? {}) as Record<string, number>)
    .sort((a, b) => b[1] - a[1]).slice(0, 12).map(([id]) => topicNames.get(id) ?? id);
  const allTopics = [...topTopics, ...customTopics];
  const sorted = useMemo(() => sortWorks(data.works, sort), [data.works, sort]);
  const paged = paginate(sorted, page, size);

  async function generate(manual: boolean) {
    setDrafting(true);
    try {
      const r = await draft();
      if (r.text) {
        setInterests(r.text);
        setAiDrafted(true);
        // First-time user: keep the automatic draft so it is there next visit.
        if (!manual) {
          await save({ data: { text: r.text } });
          await qc.invalidateQueries({ queryKey: ["my-profile"] });
        }
      } else if (manual) toast.error(r.error ?? "Could not write a draft");
      else toast.info("We couldn't write your research interests yet. Press “Write with AI” to try again.");
    } catch {
      if (manual) toast.error("Could not write a draft");
    } finally {
      setDrafting(false);
    }
  }

  // Draft automatically for a first-time user as soon as publications are available.
  useEffect(() => {
    if (autoTried.current || p?.research_interests || !data.works.length) return;
    autoTried.current = true;
    void generate(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.works.length, p?.research_interests]);

  // Analysis runs only when the user asks for it.
  async function startAnalysis(force = false) {
    setAnalysing(true);
    const t = toast.loading("Analysing your profile… this usually takes under a minute.");
    try {
      const r = await analyse({ data: { force } });
      if (r.status === "done") toast.success("Analysis finished.", { id: t });
      else if (r.status === "failed") toast.error(r.reason, { id: t });
      else if (r.status === "running") toast.info("An analysis is already running. Please wait a moment.", { id: t });
      else toast.info(r.reason, { id: t });
    } catch {
      toast.error("The analysis could not run. Please try again.", { id: t });
    } finally {
      setAnalysing(false);
      await qc.invalidateQueries({ queryKey: ["my-profile"] });
    }
  }

  async function persistTopics(next: string[]) {
    try {
      await saveTopics({ data: { topics: next } });
      await qc.invalidateQueries({ queryKey: ["my-profile"] });
    } catch {
      toast.error("Could not save topics.");
    }
  }

  function addTopic() {
    const t = newTopic.trim().replace(/\s+/g, " ");
    if (!t) return;
    if (allTopics.some((x) => x.toLowerCase() === t.toLowerCase())) { toast.info("That topic is already listed"); return; }
    setNewTopic("");
    void persistTopics([...customTopics, t]);
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function doRefresh() {
    setRefreshing(true);
    try {
      const r = await refresh({ data: {} });
      toast.success(`Imported ${r.imported} works`);
      await qc.invalidateQueries({ queryKey: ["my-profile"] });
    } catch {
      toast.error("Refresh failed. Please try again.");
    } finally {
      setRefreshing(false);
    }
  }

  async function saveInterests() {
    try {
      await save({ data: { text: interests } });
      toast.success("Research interests saved");
      setAiDrafted(false);
      await qc.invalidateQueries({ queryKey: ["my-profile"] });
    } catch {
      toast.error("Could not save.");
    }
  }

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
        <ConfidentialNotice />
        <div className="flex flex-wrap items-center gap-5 rounded-xl border bg-card p-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary font-serif text-xl text-primary-foreground">{initials}</div>
          <div className="flex-1">
            <h1 className="font-serif text-3xl">{name}</h1>
            <p className="text-muted-foreground">{p?.institution || "No institution yet"}</p>
            {p?.orcid && (
              <span className="mt-2 inline-block rounded-full bg-accent px-3 py-0.5 font-mono text-xs text-accent-foreground">ORCID {p.orcid}</span>
            )}
          </div>
          <div className="flex gap-8 font-mono">
            <Stat label="works" value={data.works.length} />
            <Stat label="citations" value={citations} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {p?.openalex_author_id ? (
            <Button onClick={doRefresh} disabled={refreshing}>{refreshing ? "Refreshing…" : "Refresh my publications"}</Button>
          ) : (
            <Button onClick={() => navigate({ to: "/confirm" })}>Find my OpenAlex profile</Button>
          )}
          {p?.last_imported_at && (
            <span className="text-sm text-muted-foreground">Last updated {new Date(p.last_imported_at).toLocaleDateString()}</span>
          )}
        </div>
        {p?.works_truncated && (
          <p className="rounded-lg bg-secondary px-4 py-3 text-sm text-secondary-foreground">We imported your first 2,000 works; the rest were skipped.</p>
        )}

        <Section title="Research topics" defaultOpen={false} count={allTopics.length}>
          {allTopics.length ? (
            <div className="flex flex-wrap gap-2">
              {topTopics.map((t) => <span key={t} className="rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground">{t}</span>)}
              {customTopics.map((t) => (
                <span key={`c-${t}`} className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-sm text-accent-foreground">
                  {t}
                  <button aria-label={`Remove ${t}`} onClick={() => persistTopics(customTopics.filter((x) => x !== t))} className="opacity-70 hover:opacity-100">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No topics yet. They appear after your publications are imported, or add your own below.</p>}
          <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); addTopic(); }}>
            <Input value={newTopic} maxLength={80} onChange={(e) => setNewTopic(e.target.value)} placeholder="Add a research topic" />
            <Button type="submit" variant="outline" disabled={!newTopic.trim()}>Add</Button>
          </form>
        </Section>

        <Section title="Research interests">
          {drafting && !interests ? (
            <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /><Skeleton className="h-4 w-2/3" />
              <p className="text-sm text-muted-foreground">Writing a draft from your publications…</p></div>
          ) : (
            <Textarea rows={4} maxLength={500} value={interests} onChange={(e) => setInterests(e.target.value)}
              placeholder="What are you working on, or looking to explore?" />
          )}
          {aiDrafted && <p className="mt-2 text-xs text-muted-foreground">Drafted by AI from your publications. Review and save.</p>}
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="font-mono text-xs text-muted-foreground">{interests.length}/500</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => generate(true)} disabled={drafting || !data.works.length}>
                <Sparkles className="mr-1 h-4 w-4" />{drafting ? "Writing…" : "Write with AI"}
              </Button>
              <Button size="sm" onClick={saveInterests} disabled={interests === (p?.research_interests ?? "")}>Save</Button>
            </div>
          </div>
        </Section>

        <Section title="Profile analysis">
          <AnalysisSection analysis={data.analysis} edits={data.edits} running={analysing} hasWorks={data.works.length > 0}
            onRetry={() => startAnalysis(true)} />
        </Section>

        <Section title="Publications" count={data.works.length}>
          {data.works.length ? (
            <>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-2">Sort
                  <Select value={sort} onValueChange={(v) => { setSort(v as WorkSort); setPage(1); }}>
                    <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="recent">Most recent</SelectItem><SelectItem value="cited">Most cited</SelectItem></SelectContent>
                  </Select>
                </label>
                <label className="flex items-center gap-2">Per page
                  <Select value={String(size)} onValueChange={(v) => { setSize(Number(v)); setPage(1); }}>
                    <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                    <SelectContent>{PAGE_SIZES.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                  </Select>
                </label>
              </div>
              <ul className="mt-3 divide-y">
                {paged.items.map((w) => (
                  <li key={w.id} className="flex items-start justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <div className="font-medium"><PaperDialog href={w.doi} title={w.title} /></div>
                      <div className="text-sm text-muted-foreground">{[w.venue, w.year].filter(Boolean).join(" · ")}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {w.is_oa && <OaBadge />}
                      {w.type && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{w.type}</span>}
                      <span className="font-mono text-xs text-muted-foreground">{w.cited_by_count} cit.</span>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {(paged.page - 1) * size + 1}–{Math.min(paged.page * size, data.works.length)} of {data.works.length}
                </span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setPage(paged.page - 1)} disabled={paged.page <= 1}>Previous</Button>
                  <span className="font-mono text-xs">{paged.page}/{paged.pages}</span>
                  <Button size="sm" variant="outline" onClick={() => setPage(paged.page + 1)} disabled={paged.page >= paged.pages}>Next</Button>
                </div>
              </div>
            </>
          ) : <p className="text-sm text-muted-foreground">No publications yet.</p>}
        </Section>
      </main>
    </div>
  );
}


function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-right">
      <div className="text-2xl">{value.toLocaleString()}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
