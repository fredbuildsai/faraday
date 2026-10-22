export const MAX_MATCH_SUMMARY_WORDS = 60;
export const MAX_IDEAS = 2;

export type Idea = { title: string; description: string };

const clip = (s: string, n: number) => {
  const w = s.trim().split(/\s+/).filter(Boolean);
  return w.length <= n ? w.join(" ") : w.slice(0, n).join(" ") + "…";
};

/** Tidy the AI answer: summary ≤60 words, at most 2 ideas with a title. */
export function cleanIdeas(raw: any): { summary: string; ideas: Idea[] } {
  const summary = clip(String(raw?.summary ?? ""), MAX_MATCH_SUMMARY_WORDS);
  const ideas = (Array.isArray(raw?.ideas) ? raw.ideas : [])
    .map((i: any) => ({ title: clip(String(i?.title ?? ""), 15), description: clip(String(i?.description ?? ""), 50) }))
    .filter((i: Idea) => i.title)
    .slice(0, MAX_IDEAS);
  return { summary, ideas };
}
