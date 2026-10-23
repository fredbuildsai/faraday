import { Link } from "@tanstack/react-router";
import { BOOK_TITLE, PASSAGES } from "@/lib/candle";

/** The fixed Faraday passage (PASSAGES[0]). Never rotates. */
export function CandleQuote({ compact = false }: { compact?: boolean }) {
  const p = PASSAGES[0]!;
  return (
    <figure className={`border-l-2 border-primary text-left ${compact ? "pl-3" : "pl-5"}`}>
      <blockquote className={`font-serif italic leading-relaxed ${compact ? "text-sm" : "text-lg"}`}>“{p.text}”</blockquote>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
        <span>Michael Faraday, <cite>{BOOK_TITLE}</cite> (1861), {p.source}</span>
        {!compact && <Link to="/candle" className="text-primary hover:underline">Read the book</Link>}
      </figcaption>
    </figure>
  );
}
