import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { OaBadge } from "@/components/OaBadge";

type Author = { display_name: string; works_count: number; cited_by_count: number; summary_stats?: { h_index?: number }; last_known_institutions?: { display_name: string }[]; topics?: { display_name: string }[]; counts_by_year?: { year: number; works_count: number }[] };
type Work = { id: string; title: string | null; publication_year: number; cited_by_count: number; doi: string | null; open_access?: { is_oa?: boolean }; primary_location?: { source?: { display_name?: string } | null } | null };

/** Shows an OpenAlex author profile inside the app (read from the public OpenAlex API). */
export function OpenAlexDialog({ authorId, name }: { authorId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [author, setAuthor] = useState<Author | null>(null);
  const [works, setWorks] = useState<Work[]>([]);
  const [error, setError] = useState(false);
  const id = authorId.split("/").pop()!;

  useEffect(() => {
    if (!open || author) return;
    const base = "https://api.openalex.org";
    Promise.all([
      fetch(`${base}/authors/${id}`).then((r) => { if (!r.ok) throw new Error(); return r.json(); }),
      fetch(`${base}/works?filter=author.id:${id}&sort=publication_date:desc&per_page=10&select=id,title,publication_year,cited_by_count,doi,open_access,primary_location`).then((r) => r.json()),
    ]).then(([a, w]) => { setAuthor(a); setWorks(w.results ?? []); }).catch(() => setError(true));
  }, [open, id, author]);

  const year = new Date().getFullYear();
  const recent = (author?.counts_by_year ?? []).filter((c) => c.year >= year - 2).reduce((s, c) => s + c.works_count, 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" onPointerDown={(e) => e.stopPropagation()}>View on OpenAlex</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{author?.display_name ?? name}</DialogTitle>
          <DialogDescription>{author?.last_known_institutions?.[0]?.display_name ?? "OpenAlex profile"}</DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-muted-foreground">Could not load this OpenAlex profile. Please try again later.</p>
        : !author ? <p className="text-sm text-muted-foreground">Loading…</p>
        : (
          <div className="space-y-5 text-sm">
            <div className="grid grid-cols-4 gap-2 text-center">
              {[["h-index", author.summary_stats?.h_index ?? 0], ["citations", author.cited_by_count.toLocaleString()], ["works", author.works_count], ["papers, 3 yrs", recent]].map(([l, v]) => (
                <div key={l as string} className="rounded-lg bg-secondary p-2"><p className="font-mono text-lg">{v}</p><p className="text-xs text-muted-foreground">{l}</p></div>
              ))}
            </div>
            {!!author.topics?.length && (
              <div><p className="mb-1 font-medium">Topics</p><div className="flex flex-wrap gap-1.5">{author.topics.slice(0, 8).map((t) => <span key={t.display_name} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">{t.display_name}</span>)}</div></div>
            )}
            <div>
              <p className="mb-2 font-medium">Latest publications</p>
              <ul className="space-y-2">
                {works.map((w) => (
                  <li key={w.id} className="rounded-lg border p-3">
                    <p className="font-medium">{w.doi ? <a className="text-primary hover:underline" href={w.doi} target="_blank" rel="noreferrer">{w.title}</a> : w.title}</p>
                    <p className="text-xs text-muted-foreground">{w.publication_year} · {w.primary_location?.source?.display_name ?? "Unknown venue"} · {w.cited_by_count} citations {w.open_access?.is_oa && <OaBadge isOa />}</p>
                  </li>
                ))}
              </ul>
            </div>
            <a className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline" href={`https://openalex.org/authors/${id}`} target="_blank" rel="noreferrer">Open full page on openalex.org <ExternalLink className="h-3 w-3" /></a>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
