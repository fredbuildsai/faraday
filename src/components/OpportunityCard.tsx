import { OaBadge } from "@/components/OaBadge";
import type { ReactNode } from "react";
import { PaperDialog } from "@/components/PaperDialog";
import { OpenAlexDialog } from "@/components/OpenAlexDialog";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Suggestion } from "@/lib/opportunities";

const LEVEL: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  underexplored: { label: "Potentially underexplored", variant: "default" },
  moderate: { label: "Moderately studied", variant: "secondary" },
  crowded: { label: "Well studied", variant: "outline" },
  unknown: { label: "Whitespace unknown", variant: "outline" },
};

export function OpportunityCard({ s, actions, children }: { s: Suggestion; actions?: ReactNode; children?: ReactNode }) {
  const ws = s.whitespace;
  const lvl = LEVEL[ws?.level ?? "unknown"] ?? LEVEL["unknown"]!;
  return (
    <article className="space-y-4 rounded-xl border bg-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <h2 className="font-serif text-xl">{s.title}</h2>
          {ws && <Badge variant={lvl.variant}>{lvl.label}</Badge>}
        </div>
        {actions}
      </div>
      <p className="text-sm">{s.description}</p>

      {!!s.collaborators?.length && (
        <div className="text-sm"><span className="font-medium">Collaborators and matches whose papers are cited here: </span>{s.collaborators.map((c) => c.name).join(", ")}</div>
      )}
      {!!s.potential?.length && (
        <div className="text-sm">
          <p className="font-medium">Potential collaborators <span className="font-normal text-muted-foreground">(your collaborators and their co-authors working on this)</span></p>
          <ul className="mt-1 space-y-0.5 text-muted-foreground">
            {s.potential.map((p) => (
              <li key={p.id}>
                <OpenAlexDialog authorId={p.id} name={p.name} trigger={<button type="button" className="text-foreground hover:underline">{p.name}</button>} />
                {" · "}{p.degree === 1 ? "1st · direct collaborator" : `2nd · via ${p.via.join(", ")}`}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="text-sm">
        <p className="font-medium">Likely principal investigators <span className="font-normal text-muted-foreground">(last author of each evidence paper)</span></p>
        {s.pis?.length ? (
          <ul className="mt-1 space-y-0.5 text-muted-foreground">
            {s.pis.map((p) => (
              <li key={p.id}>
                {/A\d+$/.test(p.id) ? <OpenAlexDialog authorId={p.id} name={p.name} trigger={<button type="button" className="text-foreground hover:underline">{p.name}</button>} /> : <span className="text-foreground">{p.name}</span>}
                {p.institution ? ` · ${p.institution}` : ""}
              </li>
            ))}
          </ul>
        ) : <p className="text-muted-foreground">Not listed in the source papers.</p>}
      </div>

      <div className="text-sm">
        <p className="font-medium">Evidence papers</p>
        <ul className="mt-1 space-y-1">
          {s.evidence.map((w) => (
            <li key={w.id}><PaperDialog href={w.url || w.id} title={w.title} className="text-primary" />{w.isOa && <> <OaBadge /></>}</li>
          ))}
        </ul>
      </div>

      {ws && (
        <Collapsible>
          <CollapsibleTrigger className="text-sm font-medium text-primary">How the whitespace was checked</CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2 rounded-lg bg-muted/50 p-4 text-sm">
            <p className="font-mono text-xs text-muted-foreground">
              Search: “{ws.query}” · all years: {ws.totalCount?.toLocaleString() ?? "?"} papers · last 3 years{ws.sinceDate ? ` (since ${ws.sinceDate})` : ""}: {ws.recentCount?.toLocaleString() ?? "?"} papers (OpenAlex)
            </p>
            <ul className="list-disc pl-5">{ws.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
            {!!ws.closest.length && (
              <div>
                <p className="font-medium">Closest existing papers</p>
                <ul className="mt-1 space-y-1">
                  {ws.closest.map((c) => (
                    <li key={c.id || c.title}><PaperDialog href={c.url || c.id} title={c.title} className="text-primary" /> <span className="font-mono text-xs text-muted-foreground">{Math.round(c.similarity * 100)}% title overlap</span></li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-muted-foreground">An estimate from published literature, not proof that nobody is working on this.</p>
          </CollapsibleContent>
        </Collapsible>
      )}
      {children}
    </article>
  );
}
