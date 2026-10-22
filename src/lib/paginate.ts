export type WorkSort = "recent" | "cited";
export const PAGE_SIZES = [5, 10, 20, 50] as const;
export const DEFAULT_PAGE_SIZE = 5;

export function sortWorks<T extends { year: number | null; cited_by_count: number | null }>(works: T[], sort: WorkSort): T[] {
  const c = [...works];
  if (sort === "cited") c.sort((a, b) => (b.cited_by_count ?? 0) - (a.cited_by_count ?? 0) || (b.year ?? 0) - (a.year ?? 0));
  else c.sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || (b.cited_by_count ?? 0) - (a.cited_by_count ?? 0));
  return c;
}

export function paginate<T>(items: T[], page: number, size: number) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const p = Math.min(Math.max(1, page), pages);
  return { items: items.slice((p - 1) * size, p * size), page: p, pages };
}
