import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { importWorks, saveResearchInterests } from "@/lib/openalex.functions";
import type { WorkTopic } from "@/lib/openalex-math";
import { Logo } from "@/components/Logo";
import { ConfidentialNotice } from "@/components/ConfidentialNotice";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const profileQuery = queryOptions({
  queryKey: ["my-profile"],
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user!.id;
    const [{ data: profile, error }, { data: works }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("works").select("id, title, venue, year, cited_by_count, type, topics, doi")
        .eq("user_id", uid).order("year", { ascending: false, nullsFirst: false }).limit(1000),
    ]);
    if (error) throw error;
    return { profile, works: works ?? [], email: u.user!.email ?? "" };
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
  const p = data.profile;
  const [interests, setInterests] = useState(p?.research_interests ?? "");
  const [refreshing, setRefreshing] = useState(false);
  const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ") || data.email;
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const citations = data.works.reduce((s, w) => s + (w.cited_by_count ?? 0), 0);

  const topicNames = new Map<string, string>();
  for (const w of data.works) for (const t of (w.topics as unknown as WorkTopic[]) ?? []) topicNames.set(t.id, t.name);
  const topTopics = Object.entries((p?.topic_weights ?? {}) as Record<string, number>)
    .sort((a, b) => b[1] - a[1]).slice(0, 12).map(([id]) => topicNames.get(id) ?? id);

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
      await qc.invalidateQueries({ queryKey: ["my-profile"] });
    } catch {
      toast.error("Could not save.");
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Logo />
          <Button variant="outline" size="sm" onClick={signOut}>Sign out</Button>
        </div>
      </header>
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

        <section className="rounded-xl border bg-card p-6">
          <h2 className="font-serif text-xl">Research topics</h2>
          {topTopics.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {topTopics.map((t) => <span key={t} className="rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground">{t}</span>)}
            </div>
          ) : <p className="mt-2 text-sm text-muted-foreground">No topics yet. They appear after your publications are imported.</p>}
        </section>

        <section className="rounded-xl border bg-card p-6">
          <h2 className="font-serif text-xl">Research interests</h2>
          <Textarea className="mt-3" rows={4} maxLength={500} value={interests} onChange={(e) => setInterests(e.target.value)}
            placeholder="What are you working on, or looking to explore?" />
          <div className="mt-2 flex items-center justify-between">
            <span className="font-mono text-xs text-muted-foreground">{interests.length}/500</span>
            <Button size="sm" onClick={saveInterests} disabled={interests === (p?.research_interests ?? "")}>Save</Button>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-6">
          <h2 className="font-serif text-xl">Publications</h2>
          {data.works.length ? (
            <ul className="mt-3 divide-y">
              {data.works.map((w) => (
                <li key={w.id} className="flex items-start justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <div className="font-medium">{w.doi ? <a href={w.doi} target="_blank" rel="noreferrer" className="hover:underline">{w.title}</a> : w.title}</div>
                    <div className="text-sm text-muted-foreground">{[w.venue, w.year].filter(Boolean).join(" · ")}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {w.type && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{w.type}</span>}
                    <span className="font-mono text-xs text-muted-foreground">{w.cited_by_count} cit.</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm text-muted-foreground">No publications yet.</p>}
        </section>
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
