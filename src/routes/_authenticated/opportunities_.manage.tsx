import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { RotateCcw, Trash2, ThumbsDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Logo } from "@/components/Logo";
import { ConfidentialNotice } from "@/components/ConfidentialNotice";
import { OpportunityCard } from "@/components/OpportunityCard";
import type { Suggestion } from "@/lib/opportunities";

const savedQuery = queryOptions({
  queryKey: ["saved-opportunities"],
  queryFn: async () => {
    const { data, error } = await supabase.from("saved_opportunities").select("id, source_key, state, snapshot, notes, notes_updated_at, created_at").order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
});

export const Route = createFileRoute("/_authenticated/opportunities_/manage")({
  head: () => ({
    meta: [
      { title: "Saved opportunities — Lattice Scout" },
      { name: "description", content: "Your saved and dismissed research opportunities, with private notes." },
      { property: "og:title", content: "Saved opportunities — Lattice Scout" },
      { property: "og:description", content: "Your saved and dismissed research opportunities, with private notes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(savedQuery),
  component: ManagePage,
});

function ManagePage() {
  const { data } = useSuspenseQuery(savedQuery);
  const qc = useQueryClient();
  const [tab, setTab] = useState<"saved" | "dismissed">("saved");
  const rows = data.filter((r) => r.state === tab);
  const refresh = () => Promise.all(["saved-opportunities", "saved-opportunity-states", "my-feedback"].map((k) => qc.invalidateQueries({ queryKey: [k] })));

  async function setState(r: (typeof data)[number], state: "saved" | "dismissed") {
    const { error } = await supabase.from("saved_opportunities").update({ state, updated_at: new Date().toISOString() }).eq("id", r.id);
    if (error) { toast.error("Could not update."); return; }
    await supabase.from("feedback").update({ value: state === "saved" ? 1 : -1 }).eq("target_type", "opportunity").eq("target_id", r.source_key);
    toast.success(state === "saved" ? "Restored to saved" : "Dismissed");
    await refresh();
  }
  async function remove(r: (typeof data)[number]) {
    const { error } = await supabase.from("saved_opportunities").delete().eq("id", r.id);
    if (error) { toast.error("Could not delete."); return; }
    await supabase.from("feedback").delete().eq("target_type", "opportunity").eq("target_id", r.source_key);
    toast.success("Deleted permanently");
    await refresh();
  }

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
        <div>
          <h1 className="font-serif text-3xl">Manage opportunities</h1>
          <p className="text-muted-foreground">Come back to saved ideas, keep private notes, or restore dismissed ones.</p>
        </div>
        <ConfidentialNotice />
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="saved">Saved ({data.filter((r) => r.state === "saved").length})</TabsTrigger>
            <TabsTrigger value="dismissed">Dismissed ({data.filter((r) => r.state === "dismissed").length})</TabsTrigger>
          </TabsList>
        </Tabs>
        {!rows.length ? (
          <div className="rounded-xl border border-dashed bg-card p-10 text-center text-muted-foreground">
            {tab === "saved" ? "Nothing saved yet. Press Save on an opportunity to keep it here." : "Nothing dismissed."}
          </div>
        ) : rows.map((r) => (
          <OpportunityCard key={r.id} s={r.snapshot as unknown as Suggestion} actions={
            <div className="flex gap-1">
              {tab === "saved"
                ? <Button variant="ghost" size="sm" onClick={() => setState(r, "dismissed")}><ThumbsDown className="h-4 w-4" /> Dismiss</Button>
                : <Button variant="ghost" size="sm" onClick={() => setState(r, "saved")}><RotateCcw className="h-4 w-4" /> Restore</Button>}
              <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="ghost" size="icon" aria-label="Delete permanently"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete permanently?</AlertDialogTitle>
                    <AlertDialogDescription>This removes the opportunity and your notes. It cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => remove(r)}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          }>
            {tab === "saved" && <Notes id={r.id} initial={r.notes} updatedAt={r.notes_updated_at} />}
          </OpportunityCard>
        ))}
      </main>
    </div>
  );
}

function Notes({ id, initial, updatedAt }: { id: string; initial: string; updatedAt: string | null }) {
  const [text, setText] = useState(initial);
  const [at, setAt] = useState(updatedAt);
  const [saving, setSaving] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(async () => {
      setSaving(true);
      const now = new Date().toISOString();
      const { error } = await supabase.from("saved_opportunities").update({ notes: text, notes_updated_at: now }).eq("id", id);
      setSaving(false);
      if (error) toast.error("Could not save your note."); else setAt(now);
    }, 800);
    return () => clearTimeout(t);
  }, [text, id]);
  return (
    <div className="space-y-1 border-t pt-4">
      <label className="text-sm font-medium" htmlFor={`n-${id}`}>Private notes</label>
      <Textarea id={`n-${id}`} value={text} maxLength={20000} onChange={(e) => setText(e.target.value)} placeholder="Only you can see these notes." rows={4} />
      <p className="text-xs text-muted-foreground">{saving ? "Saving…" : at ? `Last edited ${new Date(at).toLocaleString()}` : "Saved automatically"}</p>
    </div>
  );
}
