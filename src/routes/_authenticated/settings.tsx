import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { researchSettingsQuery, saveResearchSettings } from "@/lib/research-settings.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [
    { title: "Research settings — Lattice Scout" },
    { name: "description", content: "Your preferences for collaborator selection and research searches." },
    { property: "og:title", content: "Research settings — Lattice Scout" },
    { property: "og:description", content: "Your preferences for collaborator selection and research searches." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(researchSettingsQuery),
  component: SettingsPage,
});

function SettingsPage() {
  const { data } = useSuspenseQuery(researchSettingsQuery);
  const [settings, setSettings] = useState(data);
  const [limit, setLimit] = useState(String(data.collaboratorLimit));
  const [busy, setBusy] = useState(false);
  const save = useServerFn(saveResearchSettings);
  const qc = useQueryClient();
  const valid = Number.isSafeInteger(Number(limit)) && Number(limit) > 0;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    setBusy(true);
    try {
      await save({ data: { ...settings, collaboratorLimit: Number(limit) } });
      await Promise.all([qc.invalidateQueries({ queryKey: ["research-settings"] }), qc.invalidateQueries({ queryKey: ["opportunity-people"] })]);
      toast.success("Settings saved");
    } catch { toast.error("Could not save settings. Please try again."); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-5xl space-y-8 px-6 py-10">
    <h1 className="font-serif text-3xl">Settings</h1>
    <form onSubmit={submit} className="max-w-2xl space-y-8">
      <section className="space-y-5 border-b pb-8">
        <h2 className="font-serif text-xl">Opportunities</h2>
        <div className="flex flex-wrap items-center justify-between gap-4"><Label htmlFor="collaborator-limit">Most frequent collaborators</Label><Input id="collaborator-limit" type="number" min={1} step={1} value={limit} onChange={(event) => setLimit(event.target.value)} className="w-24" /></div>
        <div className="flex items-center justify-between gap-4"><Label htmlFor="default-network">Use only my network’s published research</Label><Switch id="default-network" checked={settings.opportunityMode === "network"} onCheckedChange={(value) => setSettings({ ...settings, opportunityMode: value ? "network" : "broad" })} /></div>
        <div className="flex items-center justify-between gap-4"><Label htmlFor="default-reviews">Exclude reviews</Label><Switch id="default-reviews" checked={settings.excludeReviews} onCheckedChange={(value) => setSettings({ ...settings, excludeReviews: value })} /></div>
        <div className="flex items-center justify-between gap-4"><Label htmlFor="default-mutual">Mutual-interest matches only</Label><Switch id="default-mutual" checked={settings.mutualOnly} onCheckedChange={(value) => setSettings({ ...settings, mutualOnly: value })} /></div>
      </section>
      <section className="space-y-5"><h2 className="font-serif text-xl">Match discovery</h2><div className="flex items-center justify-between gap-4"><Label htmlFor="default-pi">Principal investigators only</Label><Switch id="default-pi" checked={settings.piOnly} onCheckedChange={(value) => setSettings({ ...settings, piOnly: value })} /></div></section>
      <Button type="submit" disabled={busy || !valid}><Save className="h-4 w-4" />{busy ? "Saving…" : "Save settings"}</Button>
    </form>
  </main>;
}