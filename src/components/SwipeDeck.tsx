import { useEffect, useRef, useState } from "react";
import { Heart, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { swipeDecision } from "@/lib/swipe";
import { OpenAlexDialog } from "@/components/OpenAlexDialog";
import { LogoMark } from "@/components/Logo";

export type ScientistCard = {
  id: string;
  name: string;
  institution: string | null;
  score: number;
  t: number;
  layer: string;
  sharedTopics: string[];
  interests: string | null;
  hIndex: number;
  citations: number;
  worksCount: number;
  recentWorks: number;
  methods: string[];
  directions: string[];
  openalexId?: string | null;
  /** True when this researcher is a Lattice Scout member. */
  member?: boolean;
  /** True when the user dismissed this member before; they are proposed again with a note. */
  dismissed?: boolean;
};

type Props = {
  cards: ScientistCard[];
  onDecide: (id: string, d: "like" | "pass") => Promise<void> | void;
  onUndo?: () => void;
  canUndo?: boolean;
};

export function SwipeDeck({ cards, onDecide, onUndo, canUndo }: Props) {
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState<"like" | "pass" | null>(null);
  const start = useRef<number | null>(null);
  const top = cards[0];

  function decide(d: "like" | "pass") {
    if (!top || leaving) return;
    setLeaving(d);
    setTimeout(async () => {
      await onDecide(top.id, d);
      setLeaving(null);
      setDx(0);
    }, 220);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea")) return;
      if (e.key === "ArrowRight") decide("like");
      if (e.key === "ArrowLeft") decide("pass");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!top) {
    return (
      <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-muted-foreground">
        You've seen everyone for now. Press "Find new matches" or review your Saved list.
        {canUndo && <div className="mt-4"><Button variant="outline" size="sm" onClick={onUndo}><Undo2 className="mr-1 h-4 w-4" />Undo last</Button></div>}
      </div>
    );
  }

  const offset = leaving === "like" ? 600 : leaving === "pass" ? -600 : dx;
  const hint = swipeDecision(dx) ?? (leaving);

  return (
    <div className="mx-auto w-full max-w-md select-none">
      <div className="relative h-[560px]">
        {cards.slice(1, 3).reverse().map((c, i, arr) => (
          <div key={c.id} className="absolute inset-0 rounded-2xl border bg-card shadow-sm" style={{ transform: `translateY(${(arr.length - i) * 10}px) scale(${1 - (arr.length - i) * 0.04})` }} aria-hidden />
        ))}
        <div
          role="group"
          aria-label={`${top.name}. Swipe right to connect, left to pass.`}
          className="absolute inset-0 cursor-grab touch-pan-y overflow-hidden rounded-2xl border bg-card shadow-lg active:cursor-grabbing"
          style={{ transform: `translateX(${offset}px) rotate(${offset / 20}deg)`, transition: start.current === null ? "transform 220ms ease-out" : "none" }}
          onPointerDown={(e) => { start.current = e.clientX; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }}
          onPointerMove={(e) => { if (start.current !== null) setDx(e.clientX - start.current); }}
          onPointerUp={() => { const d = swipeDecision(dx); start.current = null; if (d) decide(d); else setDx(0); }}
          onPointerCancel={() => { start.current = null; setDx(0); }}
        >
          {hint && (
            <span className={`absolute top-6 z-10 rounded-md border-2 px-3 py-1 font-mono text-sm font-bold uppercase ${hint === "like" ? "left-6 -rotate-12 border-primary text-primary" : "right-6 rotate-12 border-destructive text-destructive"}`}>
              {hint === "like" ? "Connect" : "Pass"}
            </span>
          )}
          <CardBody c={top} />
        </div>
      </div>
      <div className="mt-6 flex items-center justify-center gap-5">
        <Button size="icon" variant="outline" className="h-14 w-14 rounded-full" aria-label="Pass" onClick={() => decide("pass")}><X className="h-6 w-6 text-destructive" /></Button>
        <Button size="icon" variant="ghost" className="h-10 w-10 rounded-full" aria-label="Undo last" disabled={!canUndo} onClick={onUndo}><Undo2 className="h-5 w-5" /></Button>
        <Button size="icon" className="h-14 w-14 rounded-full" aria-label="Connect" onClick={() => decide("like")}><Heart className="h-6 w-6" /></Button>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">Drag the card or use ← → keys. {cards.length} left.</p>
    </div>
  );
}

function initials(n: string) {
  return n.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "?";
}

function CardBody({ c }: { c: ScientistCard }) {
  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary font-serif text-2xl text-primary-foreground">{initials(c.name)}</div>
        <div className="min-w-0 flex-1">
          {c.member && (
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary" title="On Lattice Scout">
                <LogoMark className="h-4 w-4" /> Lattice Scout member
              </span>
              {c.dismissed && (
                <span className="rounded-full border border-dashed bg-muted px-2.5 py-1 text-xs text-muted-foreground">Previously dismissed</span>
              )}
            </div>
          )}
          <p className="mb-1 inline-block rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">{c.layer}</p>
          <h2 className="truncate font-serif text-2xl">{c.name}</h2>
          <p className="truncate text-sm text-muted-foreground">{c.institution || "Institution not given"}</p>
        </div>
        <span className="font-mono text-lg text-primary">{Math.round(c.score * 100)}%</span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="h-index" value={c.hIndex} />
        <Stat label="citations" value={c.citations.toLocaleString()} />
        <Stat label="papers, 3 yrs" value={c.recentWorks} />
      </div>
      {c.openalexId && <div><OpenAlexDialog authorId={c.openalexId} name={c.name} /></div>}

      {c.sharedTopics.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Shared research area</p>
          <div className="flex flex-wrap gap-1.5">{c.sharedTopics.slice(0, 4).map((t) => <span key={t} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">{t}</span>)}</div>
        </div>
      )}

      {c.methods.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Preferred methods</p>
          <div className="flex flex-wrap gap-1.5">{c.methods.slice(0, 5).map((t) => <span key={t} className="rounded-full border px-2.5 py-0.5 text-xs">{t}</span>)}</div>
        </div>
      )}

      {(c.interests || c.directions.length > 0) && (
        <div className="min-h-0 flex-1 overflow-hidden">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Scientific interests</p>
          <p className="line-clamp-5 text-sm text-muted-foreground">{c.interests || c.directions.join(" · ")}</p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-secondary/60 py-2">
      <p className="font-mono text-lg">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
