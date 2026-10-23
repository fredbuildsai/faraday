/**
 * Passages from Michael Faraday, "The Chemical History of a Candle" (1861).
 * Every passage is quoted verbatim from the bundled public-domain copy at
 * /books/chemical-history-of-a-candle.txt (Project Gutenberg eBook #14474);
 * src/test/candle.test.ts checks that each one still appears in that file.
 */
export type Passage = { text: string; source: string };

export const BOOK_TITLE = "The Chemical History of a Candle";
export const BOOK_PATH = "/books/chemical-history-of-a-candle.txt";

export const PASSAGES: Passage[] = [
  {
    text: "There is no better, there is no more open door by which you can enter into the study of natural philosophy, than by considering the physical phenomena of a candle.",
    source: "Lecture I",
  },
  {
    text: "We come here to be philosophers; and I hope you will always remember that whenever a result happens, especially if it be new, you should say, “What is the cause? Why does it occur?” and you will in the course of time find out the reason.",
    source: "Lecture I",
  },
  {
    text: "The greatest mistakes and faults with regard to candles, as in many other things, often bring with them instruction which we should not receive if they had not occurred.",
    source: "Lecture I",
  },
  {
    text: "There is not a law under which any part of this universe is governed which does not come into play, and is touched upon in these phenomena.",
    source: "Lecture I",
  },
  {
    text: "That you may, like it, shine as lights to those about you; that, in all your actions, you may justify the beauty of the taper by making your deeds honourable and effectual in the discharge of your duty to your fellow-men.",
    source: "Lecture VI",
  },
];

/** Picks a passage; `seed` makes the choice deterministic (tests, SSR). */
export function pickPassage(seed: number = Math.random()): Passage {
  const i = Math.floor(Math.abs(seed) * PASSAGES.length) % PASSAGES.length;
  return PASSAGES[i];
}
