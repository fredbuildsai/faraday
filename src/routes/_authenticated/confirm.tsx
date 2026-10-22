import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { importWorks, resolveAuthor } from "@/lib/openalex.functions";
import type { AuthorCandidate } from "@/lib/openalex-math";
import { ConfidentialNotice } from "@/components/ConfidentialNotice";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/confirm")({
  head: () => ({
    meta: [
      { title: "Is this you? — Lattice Scout" },
      { name: "description", content: "Confirm your OpenAlex author profile to import your publications." },
      { property: "og:title", content: "Is this you? — Lattice Scout" },
      { property: "og:description", content: "Confirm your author profile." },
    ],
  }),
  component: ConfirmPage,
});

function ConfirmPage() {
  const resolve = useServerFn(resolveAuthor);
  const doImport = useServerFn(importWorks);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["resolve-author"], queryFn: () => resolve(), staleTime: Infinity, retry: false });
  const [importing, setImporting] = useState(false);
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const d = q.data;
  // Default selection: the suggested profile, until the user changes it.
  const selected = picked ?? new Set(d?.suggested ? [d.suggested.id] : []);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  }

  async function confirmSelected() {
    if (!selected.size) return;
    setImporting(true);
    try {
      const r = await doImport({ data: { authorIds: Array.from(selected) } });
      toast.success(`Imported ${r.imported} works from ${r.profiles} profile${r.profiles > 1 ? "s" : ""}${r.truncated ? " (stopped at 2,000)" : ""}`);
      await qc.invalidateQueries();
      navigate({ to: "/profile" });
    } catch {
      toast.error("Import failed. Please try again.");
      setImporting(false);
    }
  }

  const others = d ? d.candidates.filter((c) => c.id !== d.suggested?.id) : [];
  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
        <h1 className="font-serif text-4xl">Is this you{d?.firstName ? `, ${d.firstName}` : ""}?</h1>
        <p className="text-muted-foreground">
          We searched OpenAlex by your first and last name. OpenAlex sometimes splits one person into several profiles — select every one that is you, and we'll combine them.
        </p>

        {q.isLoading && (
          <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
        )}
        {q.isError && (
          <div className="rounded-xl border bg-card p-6">
            Could not reach OpenAlex. <Button variant="link" onClick={() => q.refetch()}>Try again</Button>
          </div>
        )}
        {d?.orcidNotFound && (
          <p className="rounded-lg bg-secondary px-4 py-3 text-sm text-secondary-foreground">
            Your ORCID wasn't found in OpenAlex, so we searched by name instead.
          </p>
        )}

        {d?.suggested && (
          <div className="space-y-3">
            <span className="inline-block rounded-full bg-accent px-3 py-0.5 text-xs font-medium text-accent-foreground">
              {d.viaOrcid ? "Matched by ORCID" : "Strong match"}
            </span>
            <CandidateCard c={d.suggested} checked={selected.has(d.suggested.id)} disabled={importing} onToggle={toggle} />
          </div>
        )}

        {d && !d.viaOrcid && (
          <div className="space-y-3">
            {d.suggested && others.length > 0 && <h2 className="pt-4 font-serif text-xl">Other possible matches</h2>}
            {others.map((c) => (
              <CandidateCard key={c.id} c={c} checked={selected.has(c.id)} disabled={importing} onToggle={toggle} />
            ))}
            {d.candidates.length === 0 && (
              <div className="rounded-xl border bg-card p-6 text-muted-foreground">
                No authors found for your name in OpenAlex.
              </div>
            )}
          </div>
        )}

        {d && (
          <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm">
            <span className="text-sm text-muted-foreground">{selected.size} profile{selected.size === 1 ? "" : "s"} selected</span>
            <div className="flex gap-2">
              <Button variant="ghost" disabled={importing} onClick={() => navigate({ to: "/profile", search: { skip: true } })}>None of these</Button>
              <Button disabled={importing || !selected.size} onClick={confirmSelected}>
                {importing ? "Importing…" : "Build my profile"}
              </Button>
            </div>
          </div>
        )}
        <ConfidentialNotice />
      </main>
    </div>
  );
}

function CandidateCard({ c, checked, disabled, onToggle }: {
  c: AuthorCandidate; checked: boolean; disabled: boolean; onToggle: (id: string) => void;
}) {
  return (
    <label className={`flex cursor-pointer items-center gap-4 rounded-xl border bg-card p-5 ${checked ? "border-primary ring-1 ring-primary" : ""}`}>
      <Checkbox checked={checked} disabled={disabled} onCheckedChange={() => onToggle(c.id)} aria-label={`Select ${c.name}`} />
      <div className="min-w-0">
        <div className="font-serif text-xl">{c.name}</div>
        <div className="text-sm text-muted-foreground">{c.institution ?? "Institution unknown"} · <span className="font-mono">{c.worksCount}</span> works</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {c.topTopics.map((t) => (
            <span key={t} className="rounded-full bg-muted px-2.5 py-0.5 text-xs">{t}</span>
          ))}
        </div>
      </div>
    </label>
  );
}
