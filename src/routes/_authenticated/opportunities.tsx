import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, AlertTriangle, Bookmark, BookmarkCheck, ThumbsDown } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { OpportunityCard } from "@/components/OpportunityCard";
import { NewProjectDialog } from "@/components/NewProjectDialog";
import { findOpportunities, getOpportunityPeople } from "@/lib/opportunities.functions";
import { eligibleOpportunityPeople } from "@/lib/opportunity-people";
import { researchSettingsQuery } from "@/lib/research-settings.functions";
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
  queryKey: ["opportunity-people"],
  queryFn: () => getOpportunityPeople(),
});

export const Route = createFileRoute("/_authenticated/opportunities")({
  head: () => ({
    meta: [
      { title: "Research opportunities — Faraday" },
      { name: "description", content: "Research gaps near your work, each backed by published papers and a whitespace check." },
      { property: "og:title", content: "Research opportunities — Faraday" },
      { property: "og:description", content: "Research gaps near your work, each backed by published papers and a whitespace check." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => Promise.all([
    context.queryClient.ensureQueryData(oppQuery),
    context.queryClient.ensureQueryData(savedStatesQuery),
    context.queryClient.ensureQueryData(matchesQuery),
    context.queryClient.ensureQueryData(researchSettingsQuery),
  ]),
  component: OpportunitiesPage,
});

function OpportunitiesPage() {
  const { data } = useSuspenseQuery(oppQuery);
  const { data: states } = useSuspenseQuery(savedStatesQuery);
  const { data: matches } = useSuspenseQuery(matchesQuery);
  const { data: preferences } = useSuspenseQuery(researchSettingsQuery);
  const qc = useQueryClient();
  const find = useServerFn(findOpportunities);
  const [busy, setBusy] = useState(false);
  const saved = (data?.settings ?? {}) as Partial<OppSettings>;
  const { opportunityMode: mode, excludeReviews, mutualOnly } = preferences;
  const [picked, setPicked] = useState<Set<string>>(new Set([...(saved.matchIds ?? []), ...(saved.collaboratorIds ?? [])]));
  const list = (data?.suggestions as unknown as Suggestion[]) ?? [];
  const shownMatches = eligibleOpportunityPeople(matches, mutualOnly);

  useEffect(() => {
    if (mutualOnly) setPicked((p) => new Set([...p].filter((id) => eligibleOpportunityPeople(matches, true).some((m) => m.id === id))));
  }, [mutualOnly, matches]);

  async function run(force: boolean) {
    setBusy(true);
    const t = toast.loading("Looking for opportunities and checking the literature…");
    try {
      const r = await find({ data: { force, mode, excludeReviews, mutualOnly, matchIds: [...picked].filter((id) => !id.startsWith("A")), collaboratorIds: [...picked].filter((id) => id.startsWith("A")) } });
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
      <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl">Opportunities</h1>
            <p className="text-muted-foreground">Possible research gaps, each backed by at least two published papers.</p>
            {data?.created_at && <p className="text-xs text-muted-foreground">Last updated {new Date(data.created_at).toLocaleDateString()}</p>}
          </div>
          <div className="flex gap-2"><NewProjectDialog trigger={<Button variant="outline"><Plus className="h-4 w-4" /> New opportunity</Button>} />
          <Button onClick={() => run(list.length > 0)} disabled={busy}>{busy ? "Looking…" : list.length ? "Refresh" : "Find opportunities"}</Button></div>
        </div>

        {mode === "network" && (
          <section className="space-y-4">
            {[
              { title: "Collaborators", people: shownMatches.filter((m) => m.collaborator), empty: "No collaborators found yet." },
              { title: "Matches", people: shownMatches.filter((m) => !m.collaborator), empty: mutualOnly ? "No mutual-interest matches yet." : "No matches yet." },
            ].map((g) => (
              <div key={g.title} className="space-y-2">
                <h2 className="font-serif text-xl">{g.title}</h2>
                {g.people.length ? (
                  <div className="flex flex-wrap gap-4">
                    {g.people.map((m) => (
                      <label key={m.id} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={picked.has(m.id)} onCheckedChange={(v) => setPicked((p) => { const n = new Set(p); v ? n.add(m.id) : n.delete(m.id); return n; })} />
                        {m.name}{m.mutual ? " · mutual" : ""}
                      </label>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground">{g.empty}</p>}
              </div>
            ))}
            {picked.size === 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>No one selected</AlertTitle>
                <AlertDescription>Opportunities will come from your own publications only. Each will list potential collaborators from your network.</AlertDescription>
              </Alert>
            )}
          </section>
        )}

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
