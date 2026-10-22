import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { importWorks, resolveAuthor } from "@/lib/openalex.functions";
import type { AuthorCandidate } from "@/lib/openalex-math";
import { Logo } from "@/components/Logo";
import { ConfidentialNotice } from "@/components/ConfidentialNotice";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

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
  const [importing, setImporting] = useState<string | null>(null);

  async function choose(c: AuthorCandidate) {
    setImporting(c.id);
    try {
      const r = await doImport({ data: { authorId: c.id } });
      toast.success(`Imported ${r.imported} works${r.truncated ? " (stopped at 2,000)" : ""}`);
      await qc.invalidateQueries();
      navigate({ to: "/profile" });
    } catch {
      toast.error("Import failed. Please try again.");
      setImporting(null);
    }
  }

  const d = q.data;
  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-4xl px-6 py-3"><Logo /></div>
      </header>
      <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
        <h1 className="font-serif text-4xl">Is this you{d?.firstName ? `, ${d.firstName}` : ""}?</h1>
        <p className="text-muted-foreground">We searched OpenAlex by your first and last name to build your profile from your publications.</p>

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
            <CandidateCard c={d.suggested} highlight busy={importing} onPick={choose} label="Yes, that's me" />
          </div>
        )}

        {d && !d.viaOrcid && (
          <div className="space-y-3">
            {d.suggested && <h2 className="pt-4 font-serif text-xl">Other possible matches</h2>}
            {d.candidates.filter((c) => c.id !== d.suggested?.id).map((c) => (
              <CandidateCard key={c.id} c={c} busy={importing} onPick={choose} label="This is me" />
            ))}
            {d.candidates.length === 0 && (
              <div className="rounded-xl border bg-card p-6 text-muted-foreground">
                No authors found for your name in OpenAlex.
              </div>
            )}
            <Button variant="ghost" onClick={() => navigate({ to: "/profile", search: { skip: true } })}>None of these</Button>
          </div>
        )}
        <ConfidentialNotice />
      </main>
    </div>
  );
}

function CandidateCard({ c, highlight, busy, onPick, label }: {
  c: AuthorCandidate; highlight?: boolean; busy: string | null; onPick: (c: AuthorCandidate) => void; label: string;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 rounded-xl border bg-card p-5 ${highlight ? "border-primary ring-1 ring-primary" : ""}`}>
      <div className="min-w-0">
        <div className="font-serif text-xl">{c.name}</div>
        <div className="text-sm text-muted-foreground">{c.institution ?? "Institution unknown"} · <span className="font-mono">{c.worksCount}</span> works</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {c.topTopics.map((t) => (
            <span key={t} className="rounded-full bg-muted px-2.5 py-0.5 text-xs">{t}</span>
          ))}
        </div>
      </div>
      <Button disabled={busy !== null} onClick={() => onPick(c)} variant={highlight ? "default" : "outline"}>
        {busy === c.id ? "Importing…" : label}
      </Button>
    </div>
  );
}
