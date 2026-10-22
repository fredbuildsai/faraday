import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Logo } from "@/components/Logo";
import { computeMatches, setInterest } from "@/lib/matching.functions";

const matchesQuery = queryOptions({
  queryKey: ["my-matches"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("my_matches");
    if (error) throw error;
    return data ?? [];
  },
});

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
  loader: ({ context }) => context.queryClient.ensureQueryData(matchesQuery),
  component: MatchesPage,
});

function MatchesPage() {
  const { data } = useSuspenseQuery(matchesQuery);
  const qc = useQueryClient();
  const compute = useServerFn(computeMatches);
  const interest = useServerFn(setInterest);
  const [busy, setBusy] = useState(false);

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
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Logo />
          <nav className="flex gap-4 text-sm">
            <Link to="/profile" className="text-muted-foreground hover:text-foreground">Profile</Link>
            <Link to="/matches" className="font-medium text-foreground">Matches</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl">Your matches</h1>
            <p className="text-muted-foreground">Shared topics, different methods. Emails appear only when you both say yes.</p>
          </div>
          <Button onClick={find} disabled={busy}>{busy ? "Looking…" : "Find new matches"}</Button>
        </div>

        {!data.length ? (
          <div className="rounded-xl border border-dashed bg-card p-10 text-center text-muted-foreground">
            No matches yet. Run your profile analysis, then press "Find new matches".
          </div>
        ) : data.map((m) => (
          <article key={m.id} className="space-y-4 rounded-xl border bg-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-xl">{m.other_name || "A researcher"}</h2>
                <p className="text-sm text-muted-foreground">{m.other_institution || "Institution not given"}</p>
              </div>
              <span className="rounded-full bg-accent px-3 py-1 font-mono text-sm text-accent-foreground">{Math.round(m.score * 100)}%</span>
            </div>
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
            <div className="flex flex-wrap items-center gap-3 border-t pt-4">
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
          </article>
        ))}
      </main>
    </div>
  );
}
