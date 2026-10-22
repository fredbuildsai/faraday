import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RotateCw, X } from "lucide-react";
import { toast } from "sonner";
import { saveAnalysisEdit } from "@/lib/analysis.functions";
import { applyEdits, type Claim, type Edit, type ShownClaim } from "@/lib/analysis";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

interface Analysis {
  status: string; summary: string | null; interests: unknown; methods: unknown; directions: unknown;
  error: string | null; finished_at: string | null;
}

const CHIP: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  running: "bg-accent text-accent-foreground",
  done: "bg-secondary text-secondary-foreground",
  failed: "bg-destructive/10 text-destructive",
};

export function AnalysisSection({ analysis, edits, running, hasWorks, onRetry }: {
  analysis: Analysis | null; edits: Edit[]; running: boolean; hasWorks: boolean; onRetry: () => void;
}) {
  const status = running ? "running" : analysis?.status ?? "pending";
  const hasResult = !!analysis?.finished_at;
  if (!hasWorks) return <p className="text-sm text-muted-foreground">The analysis starts once your publications are imported.</p>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <span className={`rounded-full px-3 py-0.5 font-mono text-xs ${CHIP[status] ?? CHIP["pending"]}`}>{status}</span>
        <Button size="sm" variant="outline" onClick={onRetry} disabled={running}>
          <RotateCw className={`mr-1 h-4 w-4 ${running ? "animate-spin" : ""}`} />{running ? "Analysing…" : status === "failed" ? "Retry" : hasResult ? "Run again" : "Run analysis"}
        </Button>
      </div>
      {status === "failed" && analysis?.error && <p className="text-sm text-destructive">{analysis.error}</p>}

      {!hasResult && status === "running" ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /><Skeleton className="h-4 w-2/3" />
          <p className="text-sm text-muted-foreground">{analysis?.status === "running" && analysis?.error ? `${analysis.error}…` : "Analysing your profile…"}</p>
        </div>
      ) : !hasResult ? (
        <p className="text-sm text-muted-foreground">No analysis yet. Press "Run analysis" when you're ready.</p>
      ) : (
        <>
          {analysis?.summary && <p className="leading-relaxed">{analysis.summary}</p>}
          <ClaimList title="Research interests" kind="interest" claims={applyEdits(asClaims(analysis?.interests), edits, "interest")} editable />
          <ClaimList title="Methods" kind="method" claims={applyEdits(asClaims(analysis?.methods), edits, "method")} editable />
          <ClaimList title="Emerging directions" claims={asClaims(analysis?.directions)} />
          <p className="text-xs text-muted-foreground">Every item is backed by two of your own publications. Anything the AI could not back up is left out.</p>
        </>
      )}
    </div>
  );
}

const asClaims = (v: unknown): Claim[] => (Array.isArray(v) ? (v as Claim[]) : []);

function ClaimList({ title, claims, kind, editable }: { title: string; claims: ShownClaim[]; kind?: Edit["kind"]; editable?: boolean }) {
  const save = useServerFn(saveAnalysisEdit);
  const qc = useQueryClient();
  const [value, setValue] = useState("");
  async function edit(action: Edit["action"], v: string) {
    if (!kind) return;
    try {
      await save({ data: { kind, value: v, action } });
      await qc.invalidateQueries({ queryKey: ["my-profile"] });
    } catch { toast.error("Could not save."); }
  }
  return (
    <div>
      <h3 className="mb-2 font-serif text-lg">{title}</h3>
      {claims.length ? (
        <ul className="space-y-2">
          {claims.map((c) => (
            <li key={c.label} className="rounded-lg border px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{c.label}{c.byUser && <span className="ml-2 text-xs text-muted-foreground">added by you</span>}</span>
                {editable && (
                  <button aria-label={`Remove ${c.label}`} onClick={() => edit("remove", c.label)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                )}
              </div>
              {c.evidence.length > 0 && <p className="mt-1 text-xs text-muted-foreground">From: {c.evidence.join(" · ")}</p>}
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-muted-foreground">Nothing here yet.</p>}
      {editable && (
        <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); const v = value.trim(); if (v) { setValue(""); void edit("add", v); } }}>
          <Input value={value} maxLength={120} onChange={(e) => setValue(e.target.value)} placeholder={`Add your own ${kind}`} />
          <Button type="submit" variant="outline" disabled={!value.trim()}>Add</Button>
        </form>
      )}
    </div>
  );
}
