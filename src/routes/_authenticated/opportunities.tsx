import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bookmark, BookmarkCheck, ThumbsDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { OpportunityCard } from "@/components/OpportunityCard";
import { findOpportunities } from "@/lib/opportunities.functions";
import { markOpportunity, type SavedState } from "@/lib/saved-opportunities";
import type { OppSettings, Suggestion } from "@/lib/opportunities";

const oppQuery = queryOptions({
  queryKey: ["my-opportunities"],
  queryFn: async () => {
    const { data, error } = await supabase.from("opportunities").select("suggestions, created_at, settings").maybeSingle();
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
export const savedStatesQuery = queryOptions({
  queryKey: ["saved-opportunity-states"],
  queryFn: async () => {
    const { data } = await supabase.from("saved_opportunities").select("source_key, state");
    return Object.fromEntries((data ?? []).map((r) => [r.source_key, r.state])) as Record<string, SavedState>;
  },
});
const matchesQuery = queryOptions({
  queryKey: ["my-matches-lite"],
  queryFn: async () => {
    const { data } = await supabase.rpc("my_matches");
    return (data ?? []).map((m: any) => ({ id: m.other_id as string, name: m.other_name as string, mutual: !!(m.i_am_interested && m.they_are_interested) }));
  },
});

export const Route = createFileRoute("/_authenticated/opportunities")({
  head: () => ({
    meta: [
      { title: "Research opportunities — Lattice Scout" },
      { name: "description", content: "Research gaps near your work, each backed by published papers and a whitespace check." },
      { property: "og:title", content: "Research opportunities — Lattice Scout" },
      { property: "og:description", content: "Research gaps near your work, each backed by published papers and a whitespace check." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => Promise.all([
    context.queryClient.ensureQueryData(oppQuery),
    context.queryClient.ensureQueryData(savedStatesQuery),
    context.queryClient.ensureQueryData(matchesQuery),
  ]),
  component: OpportunitiesPage,
});

function OpportunitiesPage() {
  const { data } = useSuspenseQuery(oppQuery);
  const { data: states } = useSuspenseQuery(savedStatesQuery);
  const { data: matches } = useSuspenseQuery(matchesQuery);
  const qc = useQueryClient();
  const find = useServerFn(findOpportunities);
  const [busy, setBusy] = useState(false);
  const saved = (data?.settings ?? {}) as Partial<OppSettings>;
  const [mode, setMode] = useState<"network" | "broad">(saved.mode ?? "broad");
  const [excludeReviews, setExcludeReviews] = useState(!!saved.excludeReviews);
  const [mutualOnly, setMutualOnly] = useState(!!saved.mutualOnly);
  const [picked, setPicked] = useState<Set<string>>(new Set(saved.matchIds ?? []));
  const list = (data?.suggestions as unknown as Suggestion[]) ?? [];
  const shownMatches = matches.filter((m) => !mutualOnly || m.mutual);

  useEffect(() => {
    if (mutualOnly) setPicked((p) => new Set([...p].filter((id) => matches.find((m) => m.id === id)?.mutual)));
  }, [mutualOnly, matches]);

  async function run(force: boolean) {
    setBusy(true);
    const t = toast.loading("Looking for opportunities and checking the literature…");
    try {
      const r = await find({ data: { force, mode, excludeReviews, mutualOnly, matchIds: [...picked] } });
      if (r.status === "error") toast.error(r.reason, { id: t });
      else if (r.status === "cached") toast.info("These are less than a week old. Showing saved results.", { id: t });
      else toast.success("Opportunities updated", { id: t });
      await qc.invalidateQueries({ queryKey: ["my-opportunities"] });
    } catch { toast.error("Could not look for opportunities. Please try again.", { id: t }); }
    finally { setBusy(false); }
  }

  async function mark(key: string, s: Suggestion, state: SavedState) {
    try {
      await markOpportunity(key, s, data?.settings, state);
      toast.success(state === "saved" ? "Saved" : "Dismissed. You can restore it from Manage.");
      await Promise.all([qc.invalidateQueries({ queryKey: ["saved-opportunity-states"] }), qc.invalidateQueries({ queryKey: ["saved-opportunities"] }), qc.invalidateQueries({ queryKey: ["my-feedback"] })]);
    } catch { toast.error("Could not save that. Please try again."); }
  }

  const visible = list.map((s, i) => ({ s, key: `${data?.created_at ?? ""}:${i}` })).filter((x) => states[x.key] !== "dismissed");

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Logo />
          <nav className="flex gap-4 text-sm">
            <Link to="/profile" className="text-muted-foreground hover:text-foreground">Profile</Link>
            <Link to="/matches" className="text-muted-foreground hover:text-foreground">Matches</Link>
            <Link to="/opportunities" className="font-medium text-foreground">Opportunities</Link>
            <Link to="/opportunities/manage" className="text-muted-foreground hover:text-foreground">Saved</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl">Opportunities</h1>
            <p className="text-muted-foreground">Possible research gaps, each backed by at least two published papers.</p>
            {data?.created_at && <p className="text-xs text-muted-foreground">Last updated {new Date(data.created_at).toLocaleDateString()}</p>}
          </div>
          <Button onClick={() => run(list.length > 0)} disabled={busy}>{busy ? "Looking…" : list.length ? "Refresh" : "Find opportunities"}</Button>
        </div>

        <section className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <Switch id="mode" checked={mode === "network"} onCheckedChange={(v) => setMode(v ? "network" : "broad")} />
              <Label htmlFor="mode">Only my and my matches' published research</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="reviews" checked={excludeReviews} onCheckedChange={setExcludeReviews} />
              <Label htmlFor="reviews">Exclude review articles</Label>
            </div>
          </div>
          {mode === "network" && (
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center gap-2">
                <Switch id="mutual" checked={mutualOnly} onCheckedChange={setMutualOnly} />
                <Label htmlFor="mutual">Mutual interest only</Label>
              </div>
              {shownMatches.length ? (
                <div className="flex flex-wrap gap-4">
                  {shownMatches.map((m) => (
                    <label key={m.id} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={picked.has(m.id)} onCheckedChange={(v) => setPicked((p) => { const n = new Set(p); v ? n.add(m.id) : n.delete(m.id); return n; })} />
                      {m.name}{m.mutual ? " · mutual" : ""}
                    </label>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">{mutualOnly ? "No matches with mutual interest yet." : "No matches yet. Find matches first."}</p>}
            </div>
          )}
          <p className="text-xs text-muted-foreground">Changing these and pressing {list.length ? "Refresh" : "Find opportunities"} looks again.</p>
        </section>

        {busy && !visible.length ? (
          <div className="space-y-3"><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div>
        ) : !visible.length ? (
          <div className="rounded-xl border border-dashed bg-card p-10 text-center text-muted-foreground">
            {list.length ? "You dismissed every opportunity here. Press Refresh to look again." : "No opportunities yet. Run your profile analysis, then press \"Find opportunities\"."}
          </div>
        ) : visible.map(({ s, key }) => (
          <OpportunityCard key={key} s={s} actions={
            <div className="flex gap-1">
              <Button variant={states[key] === "saved" ? "secondary" : "ghost"} size="sm" onClick={() => states[key] !== "saved" && mark(key, s, "saved")}>
                {states[key] === "saved" ? <><BookmarkCheck className="h-4 w-4" /> Saved</> : <><Bookmark className="h-4 w-4" /> Save</>}
              </Button>
              <Button variant="ghost" size="icon" aria-label="Dismiss" onClick={() => mark(key, s, "dismissed")}><ThumbsDown className="h-4 w-4" /></Button>
            </div>
          } />
        ))}
      </main>
    </div>
  );
}
