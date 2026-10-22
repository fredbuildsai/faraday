import { useEffect, useState, type ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { OaBadge } from "@/components/OaBadge";
import { abstractFromIndex, openalexWorkPath } from "@/lib/paper-link";

type Work = {
  title: string | null; publication_year?: number; cited_by_count?: number; doi?: string | null;
  open_access?: { is_oa?: boolean; oa_url?: string | null };
  primary_location?: { source?: { display_name?: string } | null } | null;
  authorships?: { author: { display_name: string } }[];
  abstract_inverted_index?: Record<string, number[]> | null;
};

/** Opens a paper's details (from OpenAlex) in a modal instead of leaving the app. */
export function PaperDialog({ href, title, children, className }: { href: string | null | undefined; title: string; children?: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const [work, setWork] = useState<Work | null>(null);
  const [error, setError] = useState(false);
  const path = openalexWorkPath(href);

  useEffect(() => { setWork(null); setError(false); }, [path]);
  useEffect(() => {
    if (!open || work || !path) return;
    fetch(`https://api.openalex.org${path}`).then((r) => { if (!r.ok) throw new Error(); return r.json(); }).then(setWork).catch(() => setError(true));
  }, [open, path, work]);

  if (!path && !href) return <span className={className}>{children ?? title}</span>;
  const abstract = abstractFromIndex(work?.abstract_inverted_index);
  const original = work?.doi || href;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" onPointerDown={(e) => e.stopPropagation()} className={`text-left hover:underline ${className ?? ""}`}>{children ?? title}</button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">{work?.title ?? title}</DialogTitle>
          <DialogDescription>{work ? [work.primary_location?.source?.display_name, work.publication_year, work.cited_by_count != null ? `${work.cited_by_count} citations` : null].filter(Boolean).join(" · ") : "Paper details"}</DialogDescription>
        </DialogHeader>
        {!path || error ? <p className="text-sm text-muted-foreground">Details for this paper are not available in the app.</p>
        : !work ? <p className="text-sm text-muted-foreground">Loading…</p>
        : (
          <div className="space-y-4 text-sm">
            {work.open_access?.is_oa && <OaBadge />}
            {!!work.authorships?.length && <p className="text-muted-foreground">{work.authorships.slice(0, 12).map((a) => a.author.display_name).join(", ")}{work.authorships.length > 12 ? ", et al." : ""}</p>}
            <div><p className="mb-1 font-medium">Abstract</p><p className="leading-relaxed">{abstract || "No abstract available."}</p></div>
          </div>
        )}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          {work?.open_access?.oa_url && <a className="inline-flex items-center gap-1 hover:underline" href={work.open_access.oa_url} target="_blank" rel="noreferrer">Open-access copy <ExternalLink className="h-3 w-3" /></a>}
          {original && <a className="inline-flex items-center gap-1 hover:underline" href={original} target="_blank" rel="noreferrer">Publisher page <ExternalLink className="h-3 w-3" /></a>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
