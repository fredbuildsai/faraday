import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { BOOK_TITLE, PASSAGES } from "@/lib/candle";

/**
 * A Faraday passage. Always opens on PASSAGES[0] — the default passage — and
 * "Next passage" cycles through the rest.
 */
export function CandleQuote({ compact = false }: { compact?: boolean }) {
  const [i, setI] = useState(0);
  const p = PASSAGES[i] ?? PASSAGES[0]!;
  return (
    <figure className={`border-l-2 border-primary text-left ${compact ? "pl-3" : "pl-5"}`}>
      <blockquote className={`font-serif italic leading-relaxed ${compact ? "text-sm" : "text-lg"}`}>“{p.text}”</blockquote>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
        <span>Michael Faraday, <cite>{BOOK_TITLE}</cite> (1861), {p.source}</span>
        {!compact && (
          <>
            <button type="button" className="text-primary hover:underline" onClick={() => setI((i + 1) % PASSAGES.length)}>Next passage</button>
            <Link to="/candle" className="text-primary hover:underline">Read the book</Link>
          </>
        )}
      </figcaption>
    </figure>
  );
}
