import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Logo } from "@/components/Logo";
import { Thumbs } from "@/components/Thumbs";
import { findOpportunities } from "@/lib/opportunities.functions";
import type { Suggestion } from "@/lib/opportunities";

const oppQuery = queryOptions({
  queryKey: ["my-opportunities"],
  queryFn: async () => {
    const { data, error } = await supabase.from("opportunities").select("suggestions, created_at").maybeSingle();
    if (error) throw error;
    return data;
  },
});
export const feedbackQuery = queryOptions({
  queryKey: ["my-feedback"],
  queryFn: async () => {
    const { data } = await supabase.from("feedback").select("target_type, target_id, value");
    return Object.fromEntries((data ?? []).map((f) => [`${f.target_type}:${f.target_id}`, f.value])) as Record<string, number>;
  },
});

export const Route = createFileRoute("/_authenticated/opportunities")({
  head: () => ({
    meta: [
      { title: "Research opportunities — Lattice Scout" },
      { name: "description", content: "Research gaps near your work, each backed by recent published papers." },
      { property: "og:title", content: "Research opportunities — Lattice Scout" },
      { property: "og:description", content: "Research gaps near your work, each backed by recent published papers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(oppQuery), context.queryClient.ensureQueryData(feedbackQuery)]),
  component: OpportunitiesPage,
});

function OpportunitiesPage() {
  const { data } = useSuspenseQuery(oppQuery);
  const { data: fb } = useSuspenseQuery(feedbackQuery);
  const qc = useQueryClient();
  const find = useServerFn(findOpportunities);
  const [busy, setBusy] = useState(false);
  const list = (data?.suggestions as unknown as Suggestion[]) ?? [];

  async function run(force: boolean) {
    setBusy(true);
    try {
      const r = await find({ data: { force } });
      if (r.status === "error") toast.error(r.reason);
      else if (r.status === "cached") toast.info("These are less than a week old. Showing saved results.");
      else toast.success("Opportunities updated");
      await qc.invalidateQueries({ queryKey: ["my-opportunities"] });
    } catch { toast.error("Could not look for opportunities. Please try again."); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Logo />
          <nav className="flex gap-4 text-sm">
            <Link to="/profile" className="text-muted-foreground hover:text-foreground">Profile</Link>
            <Link to="/matches" className="text-muted-foreground hover:text-foreground">Matches</Link>
            <Link to="/opportunities" className="font-medium text-foreground">Opportunities</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl">Opportunities</h1>
            <p className="text-muted-foreground">Possible research gaps, each backed by at least two recent papers.</p>
            {data?.created_at && <p className="text-xs text-muted-foreground">Last updated {new Date(data.created_at).toLocaleDateString()}</p>}
          </div>
          <Button onClick={() => run(list.length > 0)} disabled={busy}>{busy ? "Looking…" : list.length ? "Refresh" : "Find opportunities"}</Button>
        </div>

        {busy && !list.length ? (
          <div className="space-y-3"><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div>
        ) : !list.length ? (
          <div className="rounded-xl border border-dashed bg-card p-10 text-center text-muted-foreground">
            No opportunities yet. Run your profile analysis, then press "Find opportunities".
          </div>
        ) : list.map((s, i) => {
          const id = `${data?.created_at ?? ""}:${i}`;
          return (
            <article key={id} className="space-y-3 rounded-xl border bg-card p-6">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-serif text-xl">{s.title}</h2>
                <Thumbs type="opportunity" id={id} value={fb[`opportunity:${id}`] ?? 0} />
              </div>
              <p className="text-sm">{s.description}</p>
              {s.novelty != null && <p className="font-mono text-xs text-muted-foreground">{s.novelty.toLocaleString()} papers in OpenAlex on this topic{s.novelty < 50 ? " — little explored" : ""}</p>}
              <ul className="space-y-1 text-sm">
                {s.evidence.map((w) => (
                  <li key={w.id}><a href={w.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary">{w.title} <ExternalLink className="h-3 w-3" /></a></li>
                ))}
              </ul>
            </article>
          );
        })}
      </main>
    </div>
  );
}
