import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { BOOK_PATH, BOOK_TITLE } from "@/lib/candle";

export const Route = createFileRoute("/candle")({
  head: () => ({
    meta: [
      { title: `${BOOK_TITLE} — Faraday` },
      { name: "description", content: "Read Michael Faraday's 1861 lectures, The Chemical History of a Candle, in full." },
      { property: "og:title", content: `${BOOK_TITLE} — Faraday` },
      { property: "og:description", content: "Michael Faraday's Royal Institution lectures, complete and public domain." },
      { property: "og:type", content: "book" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CandlePage,
});

/** Strips the Project Gutenberg header/footer, keeping the book itself. */
function bookBody(raw: string) {
  const start = raw.indexOf("*** START");
  const end = raw.indexOf("*** END");
  const s = start >= 0 ? raw.indexOf("\n", start) + 1 : 0;
  return raw.slice(s, end >= 0 ? end : undefined).trim();
}

function CandlePage() {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    fetch(BOOK_PATH).then((r) => r.text()).then((t) => setText(bookBody(t))).catch(() => setText(""));
  }, []);
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <Link to="/"><Logo /></Link>
        <a href={BOOK_PATH} download className="text-sm text-primary hover:underline">Download text</a>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="font-serif text-3xl font-semibold">{BOOK_TITLE}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Michael Faraday, 1861 · Public domain (Project Gutenberg #14474)</p>
        {text === null ? (
          <p className="mt-8 text-muted-foreground">Opening the book…</p>
        ) : (
          <div className="mt-8 whitespace-pre-wrap font-serif leading-relaxed">{text || "The book could not be loaded."}</div>
        )}
      </main>
    </div>
  );
}
