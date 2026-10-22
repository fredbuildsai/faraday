/** OpenAlex API path for a paper reference (OpenAlex id/URL or DOI/DOI URL); null if unrecognised. */
export function openalexWorkPath(ref: string | null | undefined): string | null {
  if (!ref) return null;
  const w = ref.match(/(?:^|\/)(W\d+)$/i);
  if (w) return `/works/${w[1]!.toUpperCase()}`;
  const doi = ref.match(/(10\.\d{4,9}\/\S+)$/);
  return doi ? `/works/doi:${doi[1]}` : null;
}

/** Rebuilds an abstract from OpenAlex's inverted index. */
export function abstractFromIndex(index: Record<string, number[]> | null | undefined): string {
  if (!index) return "";
  const words: string[] = [];
  for (const [word, positions] of Object.entries(index)) for (const p of positions) words[p] = word;
  return words.filter(Boolean).join(" ");
}
